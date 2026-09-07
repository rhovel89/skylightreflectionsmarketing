import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { buildVisibilityIntelligence } from '@/lib/business-visibility-reporting'
import { advanceReportingDueDate,compareVisibilityExecutionSnapshots } from '@/lib/business-visibility-execution'

type Row=Record<string,any>
const text=(v:any,n=5000)=>String(v??'').trim().slice(0,n)
const uuid=(v:any)=>{const x=text(v,50);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null}
const day=(v:any)=>{const x=text(v,20);return /^\d{4}-\d{2}-\d{2}$/.test(x)?x:null}
const priorities=new Set(['low','medium','high','critical'])
const safeUrl=(v:any)=>{const x=text(v,1500);if(!x)return null;try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)?u.toString():null}catch{return null}}

async function getBusiness(s:any,businessId:string){
  const q=await s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).eq('id',businessId).maybeSingle()
  if(q.error)throw q.error
  if(!q.data)throw new Error('Business was not found for this tenant.')
  return q.data as Row
}

async function getSalesContext(s:any,businessId:string){
  const prospectQ=await s.from('business_prospects').select('id').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(prospectQ.error)throw prospectQ.error
  const prospect=prospectQ.data as Row|null
  if(!prospect)return {prospect:null,opportunity:null,client_id:null}
  const opportunityQ=await s.from('skylight_sales_opportunities').select('id,client_id,stage,active,updated_at').eq('tenant_id',TENANT_ID).eq('prospect_id',prospect.id).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(opportunityQ.error)throw opportunityQ.error
  return {prospect,opportunity:(opportunityQ.data||null) as Row|null,client_id:opportunityQ.data?.client_id?String(opportunityQ.data.client_id):null}
}

async function getClientContext(s:any,businessId:string){
  const direct=await s.from('skylight_clients').select('id,company_name,status,updated_at').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('updated_at',{ascending:false}).limit(10)
  if(direct.error)throw direct.error
  const rows=(direct.data||[]) as Row[]
  const client=rows.find(r=>r.status==='active')||rows[0]||null
  if(client)return client
  const sales=await getSalesContext(s,businessId)
  if(!sales.client_id)return null
  const fallback=await s.from('skylight_clients').select('id,company_name,status,updated_at').eq('tenant_id',TENANT_ID).eq('id',sales.client_id).maybeSingle()
  if(fallback.error)throw fallback.error
  return (fallback.data||null) as Row|null
}

async function loadVisibilityData(s:any,businessId:string,business:Row){
  const [audits,rankings,competitorAudits,competitorRankings,alerts,gsc,gbp,gbpKeywords]=await Promise.all([
    s.from('business_visibility_audits').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('checked_at',{ascending:false}).limit(150),
    s.from('business_visibility_rankings').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('checked_at',{ascending:false}).limit(1500),
    s.from('business_visibility_competitor_audits').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('checked_at',{ascending:false}).limit(500),
    s.from('business_visibility_competitor_rankings').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('checked_at',{ascending:false}).limit(1500),
    s.from('business_visibility_alerts').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('last_seen_at',{ascending:false}).limit(500),
    s.from('business_visibility_gsc_metrics').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('period_end',{ascending:false}).limit(3000),
    s.from('business_visibility_gbp_metrics').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('metric_date',{ascending:false}).limit(5000),
    s.from('business_visibility_gbp_search_keywords').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('month_start',{ascending:false}).limit(2000),
  ])
  const results=[audits,rankings,competitorAudits,competitorRankings,alerts,gsc,gbp,gbpKeywords]
  const failed=results.find((r:any)=>r.error)
  if(failed?.error)throw failed.error
  return buildVisibilityIntelligence({business,audits:audits.data||[],rankings:rankings.data||[],competitorAudits:competitorAudits.data||[],competitorRankings:competitorRankings.data||[],alerts:alerts.data||[],gscMetrics:gsc.data||[],gbpMetrics:gbp.data||[],gbpKeywords:gbpKeywords.data||[]})
}

async function refreshSnapshot(s:any,businessId:string,business:Row,userId:string){
  const sales=await getSalesContext(s,businessId),intelligence=await loadVisibilityData(s,businessId,business)
  const existingQ=await s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('source_fingerprint',intelligence.source_fingerprint).maybeSingle()
  if(existingQ.error)throw existingQ.error
  let snapshot=existingQ.data as Row|null,created=false
  if(!snapshot){
    const insertQ=await s.from('business_visibility_opportunity_snapshots').insert({tenant_id:TENANT_ID,business_id:businessId,prospect_id:sales.prospect?.id||null,client_id:sales.client_id,period_start:intelligence.period_start,period_end:intelligence.period_end,opportunity_score:intelligence.opportunity_score,opportunity_band:intelligence.opportunity_band,measurement_coverage:intelligence.measurement_coverage,component_scores:intelligence.components,comparisons:intelligence.comparisons,source_manifest:intelligence.source_manifest,snapshot_data:intelligence,source_fingerprint:intelligence.source_fingerprint,created_by:userId}).select('*').single()
    if(insertQ.error){
      if((insertQ.error as any).code!=='23505')throw insertQ.error
      const race=await s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('source_fingerprint',intelligence.source_fingerprint).single()
      if(race.error)throw race.error
      snapshot=race.data
    }else{snapshot=insertQ.data;created=true}
  }
  if(!snapshot)throw new Error('Unable to create or reuse the visibility snapshot.')
  if(created){
    const rows=intelligence.recommendations.map(r=>({tenant_id:TENANT_ID,business_id:businessId,prospect_id:sales.prospect?.id||null,opportunity_id:sales.opportunity?.id||null,snapshot_id:snapshot!.id,recommendation_key:r.recommendation_key,category:r.category,priority:r.priority,title:r.title,finding:r.finding,recommended_action:r.recommended_action,source_refs:r.source_refs,source_fingerprint:r.source_fingerprint,status:'open',created_by:userId,updated_by:userId}))
    if(rows.length){const rq=await s.from('business_visibility_recommendations').upsert(rows,{onConflict:'tenant_id,business_id,recommendation_key,source_fingerprint',ignoreDuplicates:true});if(rq.error)throw rq.error}
  }
  return snapshot
}

async function getExecution(s:any,businessId:string,id:string){
  const q=await s.from('business_visibility_execution_items').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id).maybeSingle()
  if(q.error)throw q.error
  if(!q.data)throw new Error('Execution item was not found.')
  return q.data as Row
}

async function addEvent(s:any,businessId:string,executionId:string,eventType:string,message:string,userId:string,metadata:Row={}){
  const q=await s.from('business_visibility_execution_events').insert({tenant_id:TENANT_ID,business_id:businessId,execution_id:executionId,event_type:eventType,message,metadata,actor_user_id:userId})
  if(q.error)throw q.error
}

async function validateProject(s:any,projectId:string,clientId:string|null){
  if(!clientId)throw new Error('A linked Skylight client is required before a project task can be created.')
  const q=await s.from('skylight_projects').select('id,name,status,client_id').eq('tenant_id',TENANT_ID).eq('id',projectId).eq('client_id',clientId).maybeSingle()
  if(q.error)throw q.error
  if(!q.data)throw new Error('The selected project does not belong to this linked client.')
  if(q.data.status==='cancelled')throw new Error('Cancelled projects cannot receive new visibility work.')
  return q.data as Row
}

async function createProjectTask(s:any,project:Row,rec:Row,userId:string,dueDate:string|null,assignToMe:boolean){
  const priority=rec.priority==='critical'?'urgent':rec.priority==='high'?'high':rec.priority==='low'?'low':'normal'
  const description=`Visibility execution work item.\n\nMeasured finding: ${text(rec.finding,1600)}\n\nRecommended action: ${text(rec.recommended_action,1600)}\n\nCompleting this task records work completion only. A measured SEO/visibility outcome requires a separate source-backed remeasurement.`
  const q=await s.from('skylight_project_tasks').insert({project_id:project.id,title:text(rec.title,220),description,status:'todo',priority,due_date:dueDate,assigned_user_id:assignToMe?userId:null,client_visible:false,requires_client_approval:false,sort_order:100,created_by:userId,updated_by:userId}).select('id').single()
  if(q.error)throw q.error
  return String(q.data.id)
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/businesses')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Row
    const action=text(body.action,80),businessId=uuid(body.business_id)
    if(!businessId)throw new Error('Business is required.')
    const business=await getBusiness(s,businessId),now=new Date().toISOString()

    if(action==='create_execution'){
      const recommendationId=uuid(body.recommendation_id)
      if(!recommendationId)throw new Error('Accepted recommendation is required.')
      const rq=await s.from('business_visibility_recommendations').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',recommendationId).maybeSingle()
      if(rq.error)throw rq.error
      if(!rq.data)throw new Error('Recommendation was not found.')
      const rec=rq.data as Row
      if(rec.status!=='accepted')throw new Error('Accept the recommendation before creating an execution work item.')
      const existing=await s.from('business_visibility_execution_items').select('*').eq('tenant_id',TENANT_ID).eq('recommendation_id',recommendationId).maybeSingle()
      if(existing.error)throw existing.error
      if(existing.data)return NextResponse.json({ok:true,message:'This recommendation already has an execution work item.',execution:existing.data})
      const baselineQ=await s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',rec.snapshot_id).maybeSingle()
      if(baselineQ.error)throw baselineQ.error
      if(!baselineQ.data)throw new Error('The recommendation baseline snapshot was not found.')
      const client=await getClientContext(s,businessId),clientId=client?.id?String(client.id):null
      const dueDate=day(body.due_date),assignToMe=body.assign_to_me!==false,projectId=uuid(body.project_id)
      let project:Row|null=null,projectTaskId:string|null=null
      if(projectId){project=await validateProject(s,projectId,clientId);projectTaskId=await createProjectTask(s,project,rec,userId,dueDate,assignToMe)}
      const recSources=Array.isArray(rec.source_refs)?rec.source_refs:[]
      const beforeEvidence=[{table:'business_visibility_opportunity_snapshots',id:String(baselineQ.data.id),checked_at:baselineQ.data.generated_at||baselineQ.data.created_at||null,source_url:null,label:'Frozen execution baseline snapshot'},...recSources].slice(0,120)
      const insert=await s.from('business_visibility_execution_items').insert({tenant_id:TENANT_ID,business_id:businessId,recommendation_id:recommendationId,baseline_snapshot_id:baselineQ.data.id,client_id:clientId,project_id:project?.id||null,project_task_id:projectTaskId,status:'planned',priority:priorities.has(String(rec.priority))?rec.priority:'medium',assigned_user_id:assignToMe?userId:null,due_date:dueDate,before_evidence:beforeEvidence,created_by:userId,updated_by:userId}).select('*').single()
      if(insert.error){if(projectTaskId)await s.from('skylight_project_tasks').delete().eq('id',projectTaskId);throw insert.error}
      await addEvent(s,businessId,String(insert.data.id),'created','Execution work item created from an accepted evidence-backed recommendation.',userId,{recommendation_id:recommendationId,baseline_snapshot_id:baselineQ.data.id,assigned_to_creator:assignToMe})
      if(projectTaskId)await addEvent(s,businessId,String(insert.data.id),'project_task_linked','Linked Skylight project task created.',userId,{project_id:project?.id,project_task_id:projectTaskId})
      return NextResponse.json({ok:true,message:projectTaskId?'Execution work item and linked Skylight project task created.':'Execution work item created with a frozen evidence baseline.',execution:insert.data,automatic_outreach:false,automatic_client_notification:false})
    }

    if(action==='link_project_task'){
      const executionId=uuid(body.id),projectId=uuid(body.project_id)
      if(!executionId||!projectId)throw new Error('Execution item and project are required.')
      const exec=await getExecution(s,businessId,executionId)
      if(exec.project_task_id)throw new Error('This execution item already has a linked project task.')
      const client=exec.client_id?{id:exec.client_id}:await getClientContext(s,businessId),clientId=client?.id?String(client.id):null
      const project=await validateProject(s,projectId,clientId)
      const recQ=await s.from('business_visibility_recommendations').select('*').eq('tenant_id',TENANT_ID).eq('id',exec.recommendation_id).maybeSingle()
      if(recQ.error)throw recQ.error
      if(!recQ.data)throw new Error('Source recommendation was not found.')
      const taskId=await createProjectTask(s,project,recQ.data as Row,userId,exec.due_date||null,String(exec.assigned_user_id||'')===userId)
      const up=await s.from('business_visibility_execution_items').update({project_id:projectId,project_task_id:taskId,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',executionId)
      if(up.error){await s.from('skylight_project_tasks').delete().eq('id',taskId);throw up.error}
      await addEvent(s,businessId,executionId,'project_task_linked','Linked Skylight project task created.',userId,{project_id:projectId,project_task_id:taskId})
      return NextResponse.json({ok:true,message:'Linked Skylight project task created. Work completion and measured outcome remain separate.'})
    }

    if(action==='claim_execution'||action==='unassign_execution'){
      const executionId=uuid(body.id)
      if(!executionId)throw new Error('Execution item is required.')
      const exec=await getExecution(s,businessId,executionId),assigned=action==='claim_execution'?userId:null
      const up=await s.from('business_visibility_execution_items').update({assigned_user_id:assigned,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',executionId)
      if(up.error)throw up.error
      if(exec.project_task_id){const tq=await s.from('skylight_project_tasks').update({assigned_user_id:assigned,updated_by:userId,updated_at:now}).eq('id',exec.project_task_id);if(tq.error)throw tq.error}
      await addEvent(s,businessId,executionId,assigned?'claimed':'unassigned',assigned?'Work item claimed by the acting staff user.':'Work item assignment cleared.',userId)
      return NextResponse.json({ok:true,message:assigned?'Work item assigned to you.':'Work item is now unassigned.'})
    }

    if(action==='start_execution'){
      const executionId=uuid(body.id)
      if(!executionId)throw new Error('Execution item is required.')
      const exec=await getExecution(s,businessId,executionId)
      if(!['planned','in_progress'].includes(String(exec.status)))throw new Error('Only planned work can be started.')
      const up=await s.from('business_visibility_execution_items').update({status:'in_progress',assigned_user_id:exec.assigned_user_id||userId,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',executionId)
      if(up.error)throw up.error
      if(exec.project_task_id){const tq=await s.from('skylight_project_tasks').update({status:'in_progress',assigned_user_id:exec.assigned_user_id||userId,updated_by:userId,updated_at:now}).eq('id',exec.project_task_id);if(tq.error)throw tq.error}
      await addEvent(s,businessId,executionId,'started','Visibility work marked in progress.',userId)
      return NextResponse.json({ok:true,message:'Work marked in progress. No result has been claimed.'})
    }

    if(action==='add_work_note'){
      const executionId=uuid(body.id),note=text(body.note,4000),sourceUrl=safeUrl(body.source_url)
      if(!executionId||!note)throw new Error('Execution item and work note are required.')
      const exec=await getExecution(s,businessId,executionId)
      if(exec.status==='cancelled')throw new Error('Cancelled work cannot receive new evidence unless reopened.')
      if(text(body.source_url,1500)&&!sourceUrl)throw new Error('Evidence URL must use http or https.')
      const evidence=Array.isArray(exec.work_evidence)?exec.work_evidence:[]
      const entry={kind:sourceUrl?'staff_note_with_source':'staff_note',note,source_url:sourceUrl,added_at:now,added_by:userId}
      const up=await s.from('business_visibility_execution_items').update({work_evidence:[...evidence,entry].slice(-200),updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',executionId)
      if(up.error)throw up.error
      await addEvent(s,businessId,executionId,'work_note_added','Work evidence/note added by staff.',userId,{source_url:sourceUrl})
      return NextResponse.json({ok:true,message:'Work evidence saved. This records implementation activity, not a measured outcome.'})
    }

    if(action==='complete_work'){
      const executionId=uuid(body.id),summary=text(body.work_summary,5000),remeasureDate=day(body.remeasurement_due_date)
      if(!executionId||!summary)throw new Error('Execution item and a work-completion summary are required.')
      const exec=await getExecution(s,businessId,executionId)
      if(exec.status==='cancelled')throw new Error('Cancelled work must be reopened before completion.')
      if(exec.work_completed_at)throw new Error('This work item is already marked complete. Use remeasurement to record an outcome.')
      const up=await s.from('business_visibility_execution_items').update({status:remeasureDate?'remeasurement_due':'work_completed',work_summary:summary,work_completed_at:now,work_completed_by:userId,remeasurement_due_date:remeasureDate,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',executionId)
      if(up.error)throw up.error
      const recUp=await s.from('business_visibility_recommendations').update({status:'completed',completed_at:now,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',exec.recommendation_id)
      if(recUp.error)throw recUp.error
      if(exec.project_task_id){const tq=await s.from('skylight_project_tasks').update({status:'done',updated_by:userId,updated_at:now}).eq('id',exec.project_task_id);if(tq.error)throw tq.error}
      await addEvent(s,businessId,executionId,'work_completed','Implementation work marked complete. No SEO/visibility result was inferred.',userId,{remeasurement_due_date:remeasureDate})
      if(remeasureDate)await addEvent(s,businessId,executionId,'remeasurement_scheduled',`Remeasurement scheduled for ${remeasureDate}.`,userId,{remeasurement_due_date:remeasureDate})
      return NextResponse.json({ok:true,message:'Work completion recorded separately from outcome. Collect fresh source measurements before evaluating results.',measured_outcome:false})
    }

    if(action==='schedule_remeasurement'){
      const executionId=uuid(body.id),due=day(body.remeasurement_due_date)
      if(!executionId||!due)throw new Error('Execution item and remeasurement date are required.')
      const exec=await getExecution(s,businessId,executionId)
      if(!exec.work_completed_at)throw new Error('Complete the implementation work before scheduling remeasurement.')
      const up=await s.from('business_visibility_execution_items').update({status:'remeasurement_due',remeasurement_due_date:due,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',executionId)
      if(up.error)throw up.error
      await addEvent(s,businessId,executionId,'remeasurement_scheduled',`Remeasurement scheduled for ${due}.`,userId,{remeasurement_due_date:due})
      return NextResponse.json({ok:true,message:'Remeasurement due date saved. No automated scan or result claim was triggered.'})
    }

    if(action==='evaluate_remeasurement'){
      const executionId=uuid(body.id)
      if(!executionId)throw new Error('Execution item is required.')
      const exec=await getExecution(s,businessId,executionId)
      if(!exec.work_completed_at)throw new Error('Work must be completed before measuring an outcome.')
      const baselineQ=await s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',exec.baseline_snapshot_id).maybeSingle()
      if(baselineQ.error)throw baselineQ.error
      if(!baselineQ.data)throw new Error('Frozen baseline snapshot was not found.')
      const fresh=await refreshSnapshot(s,businessId,business,userId)
      if(String(fresh.id)===String(baselineQ.data.id)||String(fresh.source_fingerprint)===String(baselineQ.data.source_fingerprint))return NextResponse.json({error:'No changed source-backed visibility measurements exist since the frozen baseline. Collect fresh audit/ranking/Google data before evaluating an outcome.'},{status:409})
      const completedAt=new Date(String(exec.work_completed_at)).getTime()
      const manifest=Array.isArray(fresh.source_manifest)?fresh.source_manifest:[]
      const postWorkSources=manifest.filter((r:any)=>{const t=new Date(String(r?.checked_at||'')).getTime();return Number.isFinite(t)&&t>completedAt})
      if(!postWorkSources.length)return NextResponse.json({error:'The latest snapshot does not contain a source measurement dated after work completion. A post-work measurement is required before an outcome can be recorded.'},{status:409})
      const outcome=compareVisibilityExecutionSnapshots(baselineQ.data as Row,fresh as Row)
      const up=await s.from('business_visibility_execution_items').update({remeasurement_snapshot_id:fresh.id,status:'remeasured',remeasured_at:now,remeasured_by:userId,outcome_status:outcome.status,outcome_summary:outcome.summary,outcome_metrics:outcome.metrics,outcome_source_refs:outcome.source_refs,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',executionId)
      if(up.error)throw up.error
      await addEvent(s,businessId,executionId,'remeasurement_recorded','A post-work source-backed visibility snapshot was compared with the frozen baseline.',userId,{baseline_snapshot_id:baselineQ.data.id,remeasurement_snapshot_id:fresh.id,post_work_source_count:postWorkSources.length})
      await addEvent(s,businessId,executionId,'outcome_recorded',outcome.summary,userId,{outcome_status:outcome.status,comparable_count:outcome.comparable_count,favorable:outcome.favorable,unfavorable:outcome.unfavorable,unchanged:outcome.unchanged})
      return NextResponse.json({ok:true,message:`Remeasurement recorded: ${outcome.status.replace(/_/g,' ')}. The comparison does not claim causation.`,outcome})
    }

    if(action==='cancel_execution'||action==='reopen_execution'){
      const executionId=uuid(body.id)
      if(!executionId)throw new Error('Execution item is required.')
      const exec=await getExecution(s,businessId,executionId)
      if(action==='reopen_execution'&&exec.status!=='cancelled')throw new Error('Only cancelled work can be reopened.')
      const status=action==='cancel_execution'?'cancelled':'in_progress'
      const up=await s.from('business_visibility_execution_items').update({status,assigned_user_id:action==='reopen_execution'?(exec.assigned_user_id||userId):exec.assigned_user_id,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',executionId)
      if(up.error)throw up.error
      if(exec.project_task_id){const tq=await s.from('skylight_project_tasks').update({status:status==='cancelled'?'cancelled':'in_progress',updated_by:userId,updated_at:now}).eq('id',exec.project_task_id);if(tq.error)throw tq.error}
      await addEvent(s,businessId,executionId,status==='cancelled'?'cancelled':'reopened',status==='cancelled'?'Execution work item cancelled.':'Execution work item reopened and returned to in progress.',userId)
      return NextResponse.json({ok:true,message:status==='cancelled'?'Work item cancelled.':'Work item reopened.'})
    }

    if(action==='save_report_schedule'){
      const cadence=text(body.cadence,20) as 'monthly'|'quarterly',nextDue=day(body.next_due_date)
      if(!['monthly','quarterly'].includes(cadence)||!nextDue)throw new Error('Monthly or quarterly cadence and a next due date are required.')
      const client=await getClientContext(s,businessId)
      if(!client?.id)throw new Error('A linked Skylight client is required before recurring client reporting can be scheduled.')
      const payload={tenant_id:TENANT_ID,business_id:businessId,client_id:client.id,cadence,next_due_date:nextDue,active:true,assigned_user_id:body.assign_to_me!==false?userId:null,notes:text(body.notes,3000)||null,updated_by:userId,updated_at:now}
      const q=await s.from('business_visibility_report_schedules').upsert({...payload,created_by:userId},{onConflict:'tenant_id,business_id'}).select('*').single()
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:`${cadence==='monthly'?'Monthly':'Quarterly'} client reporting schedule saved. This is an internal due date only; no report will be automatically generated or sent.`,schedule:q.data,automatic_report_generation:false,automatic_send:false})
    }

    if(action==='disable_report_schedule'){
      const scheduleId=uuid(body.id)
      if(!scheduleId)throw new Error('Report schedule is required.')
      const q=await s.from('business_visibility_report_schedules').update({active:false,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',scheduleId).select('id').maybeSingle()
      if(q.error)throw q.error
      if(!q.data)throw new Error('Report schedule was not found.')
      return NextResponse.json({ok:true,message:'Recurring reporting schedule disabled. Existing reports remain unchanged.'})
    }

    if(action==='complete_report_schedule'){
      const scheduleId=uuid(body.id),reportId=uuid(body.report_id)
      if(!scheduleId||!reportId)throw new Error('Report schedule and finalized client report are required.')
      const scheduleQ=await s.from('business_visibility_report_schedules').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',scheduleId).maybeSingle()
      if(scheduleQ.error)throw scheduleQ.error
      if(!scheduleQ.data)throw new Error('Report schedule was not found.')
      const reportQ=await s.from('business_visibility_reports').select('id,report_type,status,finalized_at').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',reportId).maybeSingle()
      if(reportQ.error)throw reportQ.error
      if(!reportQ.data||reportQ.data.report_type!=='client'||reportQ.data.status!=='finalized')throw new Error('Choose a finalized client performance report.')
      const cadence=String(scheduleQ.data.cadence)==='quarterly'?'quarterly':'monthly'
      const nextDue=advanceReportingDueDate(String(scheduleQ.data.next_due_date),cadence,new Date().toISOString().slice(0,10))
      const up=await s.from('business_visibility_report_schedules').update({last_report_id:reportId,last_completed_at:now,next_due_date:nextDue,active:true,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',scheduleId)
      if(up.error)throw up.error
      return NextResponse.json({ok:true,message:`Reporting cycle completed. Next internal report due date: ${nextDue}. No client message was sent.`,next_due_date:nextDue,automatic_send:false})
    }

    return NextResponse.json({error:'Unsupported visibility execution action.'},{status:400})
  }catch(error:any){
    return NextResponse.json({error:text(error?.message||'Unable to process visibility execution action.',2000)},{status:400})
  }
}
