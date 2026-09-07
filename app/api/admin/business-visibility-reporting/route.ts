import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { buildReportExecutiveSummary,buildVisibilityIntelligence } from '@/lib/business-visibility-reporting'

type Row=Record<string,any>
const text=(v:any,n=5000)=>String(v??'').trim().slice(0,n)
const allowedRecommendationStatuses=new Set(['open','accepted','completed','dismissed'])

async function getBusiness(s:any,businessId:string){
  const q=await s.from('businesses').select('id,name,website,rating,review_count').eq('tenant_id',TENANT_ID).eq('id',businessId).maybeSingle()
  if(q.error)throw q.error
  if(!q.data)throw new Error('Business was not found for this tenant.')
  return q.data as Row
}

async function getSalesContext(s:any,businessId:string){
  const prospectQ=await s.from('business_prospects').select('id,business_name,category,city').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(prospectQ.error)throw prospectQ.error
  const prospect=prospectQ.data as Row|null
  if(!prospect)return {prospect:null,opportunity:null,client_id:null}
  const opportunityQ=await s.from('skylight_sales_opportunities').select('id,client_id,stage,active,updated_at').eq('tenant_id',TENANT_ID).eq('prospect_id',prospect.id).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(opportunityQ.error)throw opportunityQ.error
  return {prospect,opportunity:(opportunityQ.data||null) as Row|null,client_id:opportunityQ.data?.client_id?String(opportunityQ.data.client_id):null}
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

async function refreshIntelligence(s:any,businessId:string,business:Row,userId:string){
  const sales=await getSalesContext(s,businessId)
  const intelligence=await loadVisibilityData(s,businessId,business)
  const existingQ=await s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('source_fingerprint',intelligence.source_fingerprint).maybeSingle()
  if(existingQ.error)throw existingQ.error
  let snapshot=existingQ.data as Row|null
  let created=false
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
    const rows=intelligence.recommendations.map(r=>({tenant_id:TENANT_ID,business_id:businessId,prospect_id:sales.prospect?.id||null,opportunity_id:sales.opportunity?.id||null,snapshot_id:snapshot.id,recommendation_key:r.recommendation_key,category:r.category,priority:r.priority,title:r.title,finding:r.finding,recommended_action:r.recommended_action,source_refs:r.source_refs,source_fingerprint:r.source_fingerprint,status:'open',created_by:userId,updated_by:userId}))
    if(rows.length){const rq=await s.from('business_visibility_recommendations').upsert(rows,{onConflict:'tenant_id,business_id,recommendation_key,source_fingerprint',ignoreDuplicates:true});if(rq.error)throw rq.error}
  }
  const countQ=await s.from('business_visibility_recommendations').select('id',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('snapshot_id',snapshot.id)
  if(countQ.error)throw countQ.error
  return {snapshot,created,recommendation_count:countQ.count||0,intelligence}
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/businesses')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Row
    const action=text(body.action,80),businessId=text(body.business_id,60)
    if(!businessId)throw new Error('Business is required.')
    const business=await getBusiness(s,businessId)
    const now=new Date().toISOString()

    if(action==='refresh_intelligence'){
      const result=await refreshIntelligence(s,businessId,business,userId)
      return NextResponse.json({ok:true,message:result.created?'New evidence-backed opportunity snapshot created.':'No source measurements changed; the existing immutable snapshot was reused.',snapshot:result.snapshot,recommendation_count:result.recommendation_count,automatic_outreach:false,automatic_reporting:false,public_ranking_effect:false})
    }

    if(action==='set_recommendation_status'){
      const id=text(body.id,60),status=text(body.status,30)
      if(!id||!allowedRecommendationStatuses.has(status))throw new Error('Valid recommendation and status are required.')
      const values:Row={status,updated_by:userId,updated_at:now,completed_at:status==='completed'?now:null}
      const q=await s.from('business_visibility_recommendations').update(values).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id).select('id,status').maybeSingle()
      if(q.error)throw q.error
      if(!q.data)throw new Error('Recommendation was not found.')
      return NextResponse.json({ok:true,message:`Recommendation marked ${status}.`,recommendation:q.data})
    }

    if(action==='approve_recommendation_for_sales'){
      const id=text(body.id,60)
      if(!id)throw new Error('Recommendation is required.')
      const rq=await s.from('business_visibility_recommendations').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id).maybeSingle()
      if(rq.error)throw rq.error
      if(!rq.data)throw new Error('Recommendation was not found.')
      const rec=rq.data as Row
      if(!rec.prospect_id)throw new Error('This business is not linked to a sales prospect.')
      const oq=await s.from('skylight_sales_opportunities').select('id').eq('tenant_id',TENANT_ID).eq('prospect_id',rec.prospect_id).eq('active',true).order('updated_at',{ascending:false}).limit(1).maybeSingle()
      if(oq.error)throw oq.error
      const sourceRefs=Array.isArray(rec.source_refs)?rec.source_refs:[],first=sourceRefs[0]||{}
      const summary=`${text(rec.finding,1600)} Recommended next step: ${text(rec.recommended_action,1600)}`
      const eq=await s.from('business_visibility_sales_evidence').upsert({tenant_id:TENANT_ID,business_id:businessId,prospect_id:rec.prospect_id,opportunity_id:oq.data?.id||rec.opportunity_id||null,evidence_type:'visibility_recommendation',evidence_summary:summary,source_table:'business_visibility_recommendations',source_record_id:rec.id,source_url:first.source_url||null,source_checked_at:first.checked_at||rec.updated_at||rec.created_at,status:'approved',approved_by:userId,approved_at:now,revoked_by:null,revoked_at:null},{onConflict:'tenant_id,prospect_id,source_table,source_record_id'}).select('*').single()
      if(eq.error)throw eq.error
      return NextResponse.json({ok:true,message:'Measured recommendation approved as Sales evidence for human review. No outreach was sent, drafted or scheduled.',evidence:eq.data,automatic_outreach:false,public_ranking_effect:false})
    }

    if(action==='create_report'){
      const reportType=text(body.report_type,20) as 'prospect'|'client'
      if(!['prospect','client'].includes(reportType))throw new Error('Report type must be prospect or client.')
      let snapshotId=text(body.snapshot_id,60)
      if(!snapshotId){const refreshed=await refreshIntelligence(s,businessId,business,userId);snapshotId=String(refreshed.snapshot.id)}
      const sq=await s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',snapshotId).maybeSingle()
      if(sq.error)throw sq.error
      if(!sq.data)throw new Error('Opportunity snapshot was not found.')
      const sales=await getSalesContext(s,businessId)
      const recQ=await s.from('business_visibility_recommendations').select('id,recommendation_key,category,priority,title,finding,recommended_action,source_refs,status,completed_at,created_at,updated_at').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('snapshot_id',snapshotId).order('created_at',{ascending:true})
      if(recQ.error)throw recQ.error
      const snapshotData=sq.data.snapshot_data as Row
      const reportData={...snapshotData,report_type:reportType,report_created_at:now,recommendations:recQ.data||[],report_source_snapshot_id:snapshotId}
      const executive=buildReportExecutiveSummary(reportType,snapshotData,recQ.data||[])
      const defaultTitle=reportType==='prospect'?`Business Visibility Opportunity Report — ${business.name}`:`Business Visibility Performance Report — ${business.name}`
      const q=await s.from('business_visibility_reports').insert({tenant_id:TENANT_ID,business_id:businessId,prospect_id:sales.prospect?.id||null,client_id:sales.client_id,snapshot_id:snapshotId,report_type:reportType,title:text(body.title,300)||defaultTitle,period_start:sq.data.period_start,period_end:sq.data.period_end,status:'draft',executive_summary:executive,snapshot_data:reportData,internal_notes:text(body.internal_notes,5000)||null,created_by:userId,updated_by:userId}).select('*').single()
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:`${reportType==='prospect'?'Prospect':'Client'} report draft created from immutable source snapshot. Nothing was emailed or published.`,report:q.data,automatic_send:false,public_share:false})
    }

    if(action==='set_report_status'){
      const id=text(body.id,60),status=text(body.status,30)
      if(!id||!['draft','finalized','archived'].includes(status))throw new Error('Valid report and status are required.')
      const values:Row={status,updated_by:userId,updated_at:now}
      if(status==='finalized'){values.finalized_by=userId;values.finalized_at=now}
      if(status==='draft'){values.finalized_by=null;values.finalized_at=null}
      const q=await s.from('business_visibility_reports').update(values).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id).select('id,status').maybeSingle()
      if(q.error)throw q.error
      if(!q.data)throw new Error('Report was not found.')
      return NextResponse.json({ok:true,message:`Report marked ${status}. No report was automatically sent or published.`,report:q.data,automatic_send:false})
    }

    return NextResponse.json({error:'Unsupported visibility reporting action.'},{status:400})
  }catch(error:any){
    return NextResponse.json({error:text(error?.message||'Unable to process visibility reporting action.',2000)},{status:400})
  }
}
