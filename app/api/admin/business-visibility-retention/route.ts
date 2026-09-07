import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { buildVisibilityClientHealth } from '@/lib/business-visibility-client-health'

type Row=Record<string,any>
const text=(v:any,n=6000)=>String(v??'').trim().slice(0,n)
const uuid=(v:any)=>{const x=text(v,50);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null}
const day=(v:any)=>{const x=text(v,20);return /^\d{4}-\d{2}-\d{2}$/.test(x)?x:null}
const reviewStatuses=new Set(['not_reviewed','monitor','renewal_review','renewal_discussion','retained','churn_risk','churned','closed'])
const readinesses=new Set(['not_assessed','ready_for_review','needs_attention','insufficient_data'])

async function loadContext(s:any,businessId:string,clientId:string){
  const [businessQ,clientQ,snapshotsQ,executionsQ,scheduleQ,projectsQ,invoicesQ,recurringQ,reportsQ]=await Promise.all([
    s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).eq('id',businessId).maybeSingle(),
    s.from('skylight_clients').select('*').eq('tenant_id',TENANT_ID).eq('id',clientId).eq('business_id',businessId).maybeSingle(),
    s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('generated_at',{ascending:false}).limit(150),
    s.from('business_visibility_execution_items').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('updated_at',{ascending:false}).limit(500),
    s.from('business_visibility_report_schedules').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).maybeSingle(),
    s.from('skylight_projects').select('*').eq('tenant_id',TENANT_ID).eq('client_id',clientId).order('updated_at',{ascending:false}).limit(300),
    s.from('skylight_invoices').select('*').eq('tenant_id',TENANT_ID).eq('client_id',clientId).order('updated_at',{ascending:false}).limit(500),
    s.from('skylight_recurring_services').select('*').eq('tenant_id',TENANT_ID).eq('client_id',clientId).order('updated_at',{ascending:false}).limit(300),
    s.from('business_visibility_reports').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('report_type','client').eq('status','finalized').order('finalized_at',{ascending:false}).limit(150),
  ])
  const firstError=[businessQ,clientQ,snapshotsQ,executionsQ,scheduleQ,projectsQ,invoicesQ,recurringQ,reportsQ].find((q:any)=>q.error)?.error
  if(firstError)throw firstError
  if(!businessQ.data)throw new Error('Business was not found for this tenant.')
  if(!clientQ.data)throw new Error('A Skylight client linked to this business is required.')
  const projects=(projectsQ.data||[]) as Row[],invoices=(invoicesQ.data||[]) as Row[]
  const projectIds=projects.map(r=>String(r.id)).filter(Boolean),invoiceIds=invoices.map(r=>String(r.id)).filter(Boolean)
  const tasksQ=projectIds.length?await s.from('skylight_project_tasks').select('*').in('project_id',projectIds).order('due_date',{ascending:true}).limit(1500):{data:[] as Row[],error:null}
  if(tasksQ.error)throw tasksQ.error
  const paymentsQ=invoiceIds.length?await s.from('skylight_invoice_payments').select('*').in('invoice_id',invoiceIds).order('paid_at',{ascending:false}).limit(1500):{data:[] as Row[],error:null}
  if(paymentsQ.error)throw paymentsQ.error
  return {business:businessQ.data as Row,client:clientQ.data as Row,visibilitySnapshots:(snapshotsQ.data||[]) as Row[],executions:(executionsQ.data||[]) as Row[],reportSchedule:(scheduleQ.data||null) as Row|null,projects,projectTasks:(tasksQ.data||[]) as Row[],invoices,payments:(paymentsQ.data||[]) as Row[],recurringServices:(recurringQ.data||[]) as Row[],finalizedReports:(reportsQ.data||[]) as Row[]}
}

async function addEvent(s:any,input:{businessId:string;clientId:string;reviewId?:string|null;healthSnapshotId?:string|null;eventType:string;message:string;userId:string;metadata?:Row}){
  const q=await s.from('business_visibility_retention_events').insert({tenant_id:TENANT_ID,business_id:input.businessId,client_id:input.clientId,review_id:input.reviewId||null,health_snapshot_id:input.healthSnapshotId||null,event_type:input.eventType,message:input.message,metadata:input.metadata||{},actor_user_id:input.userId})
  if(q.error)throw q.error
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/businesses')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Row
    const action=text(body.action,80),businessId=uuid(body.business_id),clientId=uuid(body.client_id)
    if(!businessId||!clientId)throw new Error('Business and linked Skylight client are required.')

    if(action==='capture_health'){
      const ctx=await loadContext(s,businessId,clientId),health=buildVisibilityClientHealth(ctx)
      const existing=await s.from('business_visibility_client_health_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('client_id',clientId).eq('source_fingerprint',health.source_fingerprint).maybeSingle()
      if(existing.error)throw existing.error
      if(existing.data)return NextResponse.json({ok:true,message:'Current records match an existing immutable client-health snapshot. No duplicate snapshot was created.',snapshot:existing.data,health,automatic_client_message:false,automatic_renewal_action:false})
      const insert=await s.from('business_visibility_client_health_snapshots').insert({tenant_id:TENANT_ID,business_id:businessId,client_id:clientId,captured_on:new Date().toISOString().slice(0,10),health_status:health.health_status,attention_points:health.attention_points,latest_visibility_snapshot_id:health.latest_visibility_snapshot_id,latest_visibility_snapshot_at:health.latest_visibility_snapshot_at,signal_counts:health.signal_counts,delivery_metrics:health.delivery_metrics,revenue_metrics:health.revenue_metrics,trend_windows:health.trend_windows,signals:health.signals,source_refs:health.source_refs,source_fingerprint:health.source_fingerprint,created_by:userId}).select('*').single()
      if(insert.error){
        if((insert.error as any).code==='23505'){
          const race=await s.from('business_visibility_client_health_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('client_id',clientId).eq('source_fingerprint',health.source_fingerprint).single()
          if(race.error)throw race.error
          return NextResponse.json({ok:true,message:'A matching immutable client-health snapshot already exists.',snapshot:race.data,health,automatic_client_message:false,automatic_renewal_action:false})
        }
        throw insert.error
      }
      await addEvent(s,{businessId,clientId,healthSnapshotId:String(insert.data.id),eventType:'health_snapshot_captured',message:`Client health snapshot captured as ${health.health_status} with ${health.attention_points} factual attention point${health.attention_points===1?'':'s'}.`,userId,metadata:{health_status:health.health_status,attention_points:health.attention_points,signal_counts:health.signal_counts,suggested_renewal_readiness:health.suggested_renewal_readiness}})
      return NextResponse.json({ok:true,message:'Immutable client-health snapshot captured from current recorded evidence. No client message, renewal action, upsell, billing change or client-status change was performed.',snapshot:insert.data,health,automatic_client_message:false,automatic_renewal_action:false,billing_authorization:false})
    }

    if(action==='save_review'){
      await loadContext(s,businessId,clientId)
      const reviewStatus=text(body.review_status,40),renewalReadiness=text(body.renewal_readiness,40)
      if(!reviewStatuses.has(reviewStatus)||!readinesses.has(renewalReadiness))throw new Error('A valid human review status and renewal-readiness status are required.')
      const healthSnapshotId=uuid(body.health_snapshot_id)
      if(healthSnapshotId){const hq=await s.from('business_visibility_client_health_snapshots').select('id').eq('tenant_id',TENANT_ID).eq('client_id',clientId).eq('id',healthSnapshotId).maybeSingle();if(hq.error)throw hq.error;if(!hq.data)throw new Error('Selected client-health snapshot does not belong to this client.')}
      const existing=await s.from('business_visibility_retention_reviews').select('*').eq('tenant_id',TENANT_ID).eq('client_id',clientId).maybeSingle()
      if(existing.error)throw existing.error
      const assigned=body.assign_to_me===true?userId:body.assign_to_me===false?null:(existing.data?.assigned_user_id||null),nextReview=body.next_review_date?day(body.next_review_date):null
      if(body.next_review_date&&!nextReview)throw new Error('Next review date must use YYYY-MM-DD.')
      const payload={business_id:businessId,health_snapshot_id:healthSnapshotId||existing.data?.health_snapshot_id||null,review_status:reviewStatus,renewal_readiness:renewalReadiness,assigned_user_id:assigned,next_review_date:nextReview,notes:text(body.notes,6000)||null,updated_by:userId,updated_at:new Date().toISOString()}
      let review:Row
      if(existing.data){const q=await s.from('business_visibility_retention_reviews').update(payload).eq('tenant_id',TENANT_ID).eq('id',existing.data.id).select('*').single();if(q.error)throw q.error;review=q.data as Row}
      else{const q=await s.from('business_visibility_retention_reviews').insert({tenant_id:TENANT_ID,business_id:businessId,client_id:clientId,...payload,created_by:userId}).select('*').single();if(q.error)throw q.error;review=q.data as Row}
      const changedStatus=String(existing.data?.review_status||'not_reviewed')!==reviewStatus||String(existing.data?.renewal_readiness||'not_assessed')!==renewalReadiness
      await addEvent(s,{businessId,clientId,reviewId:String(review.id),healthSnapshotId:review.health_snapshot_id||null,eventType:existing.data?'review_updated':'review_created',message:existing.data?'Human retention review updated.':'Human retention review created.',userId,metadata:{previous_review_status:existing.data?.review_status||null,review_status:reviewStatus,previous_renewal_readiness:existing.data?.renewal_readiness||null,renewal_readiness:renewalReadiness,status_changed:changedStatus,next_review_date:nextReview}})
      return NextResponse.json({ok:true,message:'Retention review saved as a human-controlled internal record. No client status, recurring service, invoice, outreach or renewal action was changed.',review,automatic_client_message:false,automatic_renewal_action:false,client_status_changed:false})
    }

    if(action==='claim_review'||action==='unassign_review'){
      const q=await s.from('business_visibility_retention_reviews').select('*').eq('tenant_id',TENANT_ID).eq('client_id',clientId).eq('business_id',businessId).maybeSingle()
      if(q.error)throw q.error
      if(!q.data)throw new Error('Create the retention review before assigning it.')
      const assigned=action==='claim_review'?userId:null
      const up=await s.from('business_visibility_retention_reviews').update({assigned_user_id:assigned,updated_by:userId,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',q.data.id).select('*').single()
      if(up.error)throw up.error
      await addEvent(s,{businessId,clientId,reviewId:String(q.data.id),healthSnapshotId:q.data.health_snapshot_id||null,eventType:action==='claim_review'?'review_claimed':'review_unassigned',message:action==='claim_review'?'Retention review assigned to the current staff user.':'Retention review assignment cleared.',userId})
      return NextResponse.json({ok:true,message:action==='claim_review'?'Retention review assigned to you.':'Retention review unassigned.',review:up.data})
    }

    return NextResponse.json({error:'Unsupported client-results/retention action.'},{status:400})
  }catch(error:any){
    return NextResponse.json({error:text(error?.message||'Unable to process client-results/retention action.',2000)},{status:400})
  }
}
