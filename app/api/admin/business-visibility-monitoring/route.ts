import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { runWebsiteVisibilityAudit } from '@/lib/business-visibility'

type Row=Record<string,any>
const t=(v:any,n=5000)=>String(v??'').trim().slice(0,n)
const surfaces=new Set(['organic','local_pack','maps','local_finder'])
const devices=new Set(['desktop','mobile'])

function validUrl(value:string){
  try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)}catch{return false}
}
function iso(value:any,fallback=new Date()){
  const d=value?new Date(String(value)):fallback
  if(Number.isNaN(d.getTime()))throw new Error('A valid date/time is required.')
  return d.toISOString()
}
const plusHours=(hours:number)=>new Date(Date.now()+hours*3600000).toISOString()

async function getBusiness(s:any,id:string){
  const q=await s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle()
  if(q.error)throw q.error
  if(!q.data)throw new Error('Business was not found for this tenant.')
  return q.data as Row
}
async function getProspectId(s:any,businessId:string){
  const q=await s.from('business_prospects').select('id').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(q.error)throw q.error
  return q.data?.id?String(q.data.id):null
}
function businessAuditRow(a:any,businessId:string,prospectId:string|null,userId:string){
  return {tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,status:'completed',website_url:a.websiteUrl,final_url:a.finalUrl,provider:a.provider,source_url:a.sourceUrl,checked_at:a.checkedAt,http_status:a.httpStatus,response_ms:a.responseMs,page_size_bytes:a.pageSizeBytes,is_https:a.isHttps,indexable:a.indexable,technical_score:a.technicalScore,on_page_seo_score:a.onPageSeoScore,performance_score:a.performanceScore,accessibility_score:a.accessibilityScore,best_practices_score:a.bestPracticesScore,title:a.title,meta_description:a.metaDescription,h1:a.h1,h1_count:a.h1Count,canonical_url:a.canonicalUrl,robots_meta:a.robotsMeta,robots_txt_status:a.robotsTxtStatus,sitemap_status:a.sitemapStatus,html_lang:a.htmlLang,schema_types:a.schemaTypes,word_count:a.wordCount,internal_link_count:a.internalLinkCount,external_link_count:a.externalLinkCount,image_count:a.imageCount,images_missing_alt:a.imagesMissingAlt,core_web_vitals:a.coreWebVitals,issues:a.issues,raw_summary:a.rawSummary,created_by:userId}
}
function competitorAuditRow(a:any,businessId:string,competitorId:string,userId:string){
  return {tenant_id:TENANT_ID,business_id:businessId,competitor_id:competitorId,website_url:a.websiteUrl,final_url:a.finalUrl,provider:a.provider,checked_at:a.checkedAt,status:'completed',http_status:a.httpStatus,response_ms:a.responseMs,is_https:a.isHttps,indexable:a.indexable,technical_score:a.technicalScore,on_page_seo_score:a.onPageSeoScore,performance_score:a.performanceScore,title:a.title,meta_description:a.metaDescription,h1:a.h1,word_count:a.wordCount,schema_types:a.schemaTypes,issues:a.issues,raw_summary:a.rawSummary,created_by:userId}
}

async function auditOwnWebsite(s:any,business:Row,prospectId:string|null,userId:string){
  const website=t(business.website,2000)
  if(!website)throw new Error('Add a website URL to this business before running website monitoring.')
  try{
    const audit=await runWebsiteVisibilityAudit(website)
    const q=await s.from('business_visibility_audits').insert(businessAuditRow(audit,String(business.id),prospectId,userId)).select('id,checked_at').single()
    if(q.error)throw q.error
    return {ok:true,id:q.data.id,checked_at:q.data.checked_at}
  }catch(error:any){
    const message=t(error?.message||error,1800)||'Website audit failed.'
    const failed=await s.from('business_visibility_audits').insert({tenant_id:TENANT_ID,business_id:business.id,prospect_id:prospectId,status:'failed',website_url:website,provider:'direct_site_fetch',checked_at:new Date().toISOString(),error_message:message,created_by:userId})
    if(failed.error)console.error('Unable to record failed monitored website audit',failed.error)
    return {ok:false,error:message}
  }
}
async function auditCompetitor(s:any,businessId:string,competitor:Row,userId:string){
  const website=t(competitor.website_url,2000)
  if(!website)return {ok:false,error:'Competitor website is not recorded.'}
  try{
    const audit=await runWebsiteVisibilityAudit(website)
    const q=await s.from('business_visibility_competitor_audits').insert(competitorAuditRow(audit,businessId,String(competitor.id),userId)).select('id,checked_at').single()
    if(q.error)throw q.error
    return {ok:true,id:q.data.id,checked_at:q.data.checked_at}
  }catch(error:any){
    const message=t(error?.message||error,1800)||'Competitor website audit failed.'
    const failed=await s.from('business_visibility_competitor_audits').insert({tenant_id:TENANT_ID,business_id:businessId,competitor_id:competitor.id,website_url:website,provider:'direct_site_fetch',checked_at:new Date().toISOString(),status:'failed',error_message:message,created_by:userId})
    if(failed.error)console.error('Unable to record failed competitor audit',failed.error)
    return {ok:false,error:message}
  }
}

async function factualEvidence(s:any,businessId:string,prospectId:string,sourceTable:string,sourceId:string){
  if(sourceTable==='business_visibility_audits'){
    const q=await s.from(sourceTable).select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',sourceId).maybeSingle()
    if(q.error)throw q.error;if(!q.data)throw new Error('Website audit evidence was not found.')
    const r=q.data as Row
    const issueLabels=Array.isArray(r.issues)?r.issues.slice(0,3).map((x:any)=>t(x?.label,120)).filter(Boolean):[]
    return {evidence_type:'website_audit',summary:`Website audit checked ${new Date(r.checked_at).toLocaleDateString('en-US')}: technical ${r.technical_score??'Not measured'}/100, on-page ${r.on_page_seo_score??'Not measured'}/100${issueLabels.length?`. Documented issues: ${issueLabels.join('; ')}`:''}.`,source_url:r.source_url||r.final_url||r.website_url||null,checked_at:r.checked_at}
  }
  if(sourceTable==='business_visibility_rankings'){
    const q=await s.from(sourceTable).select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',sourceId).maybeSingle()
    if(q.error)throw q.error;if(!q.data)throw new Error('Ranking evidence was not found.')
    const r=q.data as Row,pos=r.not_found?'Not found':`#${r.position}`
    return {evidence_type:'ranking',summary:`Measured ${r.engine} ${r.surface} position for "${r.keyword}" in ${r.search_location}: ${pos} on ${new Date(r.checked_at).toLocaleDateString('en-US')} (${r.provider}).`,source_url:r.source_url||null,checked_at:r.checked_at}
  }
  if(sourceTable==='business_visibility_competitor_audits'){
    const q=await s.from(sourceTable).select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',sourceId).maybeSingle()
    if(q.error)throw q.error;if(!q.data)throw new Error('Competitor audit evidence was not found.')
    const r=q.data as Row,c=await s.from('business_visibility_competitors').select('competitor_name,source_url').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',r.competitor_id).maybeSingle()
    if(c.error)throw c.error
    return {evidence_type:'competitor_audit',summary:`Competitor website audit for ${c.data?.competitor_name||'tracked competitor'} checked ${new Date(r.checked_at).toLocaleDateString('en-US')}: technical ${r.technical_score??'Not measured'}/100, on-page ${r.on_page_seo_score??'Not measured'}/100.`,source_url:c.data?.source_url||r.final_url||r.website_url||null,checked_at:r.checked_at}
  }
  if(sourceTable==='business_visibility_competitor_rankings'){
    const q=await s.from(sourceTable).select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',sourceId).maybeSingle()
    if(q.error)throw q.error;if(!q.data)throw new Error('Competitor ranking evidence was not found.')
    const r=q.data as Row,c=await s.from('business_visibility_competitors').select('competitor_name').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',r.competitor_id).maybeSingle()
    if(c.error)throw c.error
    const pos=r.not_found?'Not found':`#${r.position}`
    return {evidence_type:'competitor_ranking',summary:`${c.data?.competitor_name||'Tracked competitor'} measured ${pos} for "${r.keyword}" in ${r.search_location} on ${r.surface}, checked ${new Date(r.checked_at).toLocaleDateString('en-US')} (${r.provider}).`,source_url:r.source_url||null,checked_at:r.checked_at}
  }
  if(sourceTable==='business_visibility_alerts'){
    const q=await s.from(sourceTable).select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',sourceId).maybeSingle()
    if(q.error)throw q.error;if(!q.data)throw new Error('Visibility alert evidence was not found.')
    const r=q.data as Row
    return {evidence_type:'visibility_alert',summary:`${t(r.title,240)} — ${t(r.detail,1200)}`,source_url:r.source_url||null,checked_at:r.last_seen_at||r.created_at}
  }
  throw new Error('Unsupported evidence source.')
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/businesses')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Row
    const action=t(body.action,80),businessId=t(body.business_id,60)
    if(!businessId)throw new Error('Business is required.')
    const business=await getBusiness(s,businessId)
    const prospectId=await getProspectId(s,businessId)
    const now=new Date().toISOString()

    if(action==='save_policy'){
      const webHours=Number(body.website_interval_hours||168),rankHours=Number(body.rank_interval_hours||168)
      if(!Number.isInteger(webHours)||webHours<24||webHours>2160||!Number.isInteger(rankHours)||rankHours<24||rankHours>2160)throw new Error('Monitoring intervals must be between 24 and 2160 hours.')
      const existing=await s.from('business_visibility_monitoring_policies').select('id,next_website_audit_at,next_rank_check_at,created_by').eq('tenant_id',TENANT_ID).eq('business_id',businessId).maybeSingle()
      if(existing.error)throw existing.error
      const values={prospect_id:prospectId,active:true,website_monitoring_enabled:Boolean(body.website_monitoring_enabled),website_interval_hours:webHours,rank_monitoring_enabled:Boolean(body.rank_monitoring_enabled),rank_interval_hours:rankHours,competitor_monitoring_enabled:Boolean(body.competitor_monitoring_enabled),next_website_audit_at:Boolean(body.website_monitoring_enabled)?(existing.data?.next_website_audit_at||now):null,next_rank_check_at:Boolean(body.rank_monitoring_enabled)?(existing.data?.next_rank_check_at||now):null,updated_by:userId,updated_at:now}
      const q=existing.data?.id
        ?await s.from('business_visibility_monitoring_policies').update(values).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',existing.data.id)
        :await s.from('business_visibility_monitoring_policies').insert({tenant_id:TENANT_ID,business_id:businessId,...values,created_by:userId})
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:'Monitoring policy saved. Scheduled execution remains fail-closed until runtime credentials are configured.',automatic_rank_sync:false,public_ranking_effect:false})
    }

    if(action==='run_monitoring_now'){
      const own=await auditOwnWebsite(s,business,prospectId,userId)
      const policyQ=await s.from('business_visibility_monitoring_policies').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).maybeSingle()
      if(policyQ.error)throw policyQ.error
      const webHours=Number(policyQ.data?.website_interval_hours||168)
      let competitorResults:any[]=[]
      const runCompetitors=policyQ.data?.competitor_monitoring_enabled!==false
      if(runCompetitors){
        const cq=await s.from('business_visibility_competitors').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('active',true).not('website_url','is',null).limit(5)
        if(cq.error)throw cq.error
        for(const c of cq.data||[])competitorResults.push({competitor_id:c.id,...await auditCompetitor(s,businessId,c as Row,userId)})
      }
      const failures=[own,...competitorResults].filter(r=>!r.ok).length
      const status=failures?((own.ok||competitorResults.some(r=>r.ok))?'partial':'failed'):'ok'
      const message=`Website monitoring completed: ${own.ok?'business audited':'business audit failed'}; ${competitorResults.filter(r=>r.ok).length}/${competitorResults.length} competitor audits succeeded. Google rank auto-sync was not run.`
      const values={tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,active:true,website_monitoring_enabled:true,website_interval_hours:webHours,next_website_audit_at:plusHours(webHours),last_website_audit_at:now,last_run_status:status,last_run_message:message,updated_by:userId,updated_at:now,created_by:userId}
      const pq=await s.from('business_visibility_monitoring_policies').upsert(values,{onConflict:'tenant_id,business_id'})
      if(pq.error)throw pq.error
      return NextResponse.json({ok:true,message,website:own,competitors:competitorResults,rank_auto_sync:false,public_ranking_effect:false})
    }

    if(action==='add_competitor'){
      const name=t(body.competitor_name,300),website=t(body.website_url,2000),google=t(body.google_business_url,2000),source=t(body.source_url,2000)
      if(name.length<2)throw new Error('Competitor name is required.')
      if(!validUrl(source))throw new Error('A valid competitor evidence/source URL is required.')
      if(website&&!validUrl(website))throw new Error('Competitor website must be a valid http/https URL.')
      if(google&&!validUrl(google))throw new Error('Google Business URL must be a valid http/https URL.')
      const q=await s.from('business_visibility_competitors').insert({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,competitor_name:name,website_url:website||null,google_business_url:google||null,source_url:source,source_checked_at:iso(body.source_checked_at),notes:t(body.notes,2000)||null,active:true,created_by:userId,updated_by:userId,updated_at:now}).select('*').single()
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:'Source-backed competitor added.',competitor:q.data})
    }

    if(action==='deactivate_competitor'){
      const id=t(body.competitor_id,60);if(!id)throw new Error('Competitor is required.')
      const q=await s.from('business_visibility_competitors').update({active:false,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id)
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:'Competitor deactivated. Historical evidence was preserved.'})
    }

    if(action==='audit_competitor_now'){
      const id=t(body.competitor_id,60);if(!id)throw new Error('Competitor is required.')
      const q=await s.from('business_visibility_competitors').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id).eq('active',true).maybeSingle()
      if(q.error)throw q.error;if(!q.data)throw new Error('Active competitor was not found.')
      const result=await auditCompetitor(s,businessId,q.data as Row,userId)
      if(!result.ok)throw new Error(result.error)
      return NextResponse.json({ok:true,message:'Competitor website audit completed from the live public site.',audit:result})
    }

    if(action==='save_competitor_rank'){
      const competitorId=t(body.competitor_id,60),targetId=t(body.target_id,60),keyword=t(body.keyword,240),location=t(body.search_location,240),surface=t(body.surface||'organic',30),device=t(body.device||'desktop',20),source=t(body.source_url,2000),notFound=Boolean(body.not_found)
      if(!competitorId||!keyword||!location)throw new Error('Competitor, keyword and search location are required.')
      if(!surfaces.has(surface)||!devices.has(device))throw new Error('Ranking surface or device is invalid.')
      if(!validUrl(source))throw new Error('Manual competitor ranking requires a valid source/report URL.')
      let position:number|null=null
      if(!notFound){position=Number(body.position);if(!Number.isInteger(position)||position<1||position>100)throw new Error('Position must be 1–100, or mark Not found.')}
      const cq=await s.from('business_visibility_competitors').select('id').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',competitorId).eq('active',true).maybeSingle()
      if(cq.error)throw cq.error;if(!cq.data)throw new Error('Active competitor was not found.')
      if(targetId){const tq=await s.from('business_visibility_keyword_targets').select('id').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',targetId).maybeSingle();if(tq.error)throw tq.error;if(!tq.data)throw new Error('Tracked keyword target was not found.')}
      const q=await s.from('business_visibility_competitor_rankings').insert({tenant_id:TENANT_ID,business_id:businessId,competitor_id:competitorId,target_id:targetId||null,keyword,search_location:location,engine:'google',surface,device,position,not_found:notFound,result_url:t(body.result_url,2000)||null,result_title:t(body.result_title,500)||null,provider:'manual',source_url:source,checked_at:iso(body.checked_at),notes:t(body.notes,2000)||null,created_by:userId}).select('*').single()
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:'Source-backed competitor ranking saved.',ranking:q.data})
    }

    if(action==='set_alert_status'){
      const id=t(body.id,60),status=t(body.status,30)
      if(!id||!['open','acknowledged','resolved'].includes(status))throw new Error('Valid alert and status are required.')
      const values:any={status,updated_at:now}
      if(status==='acknowledged'){values.acknowledged_by=userId;values.acknowledged_at=now}
      if(status==='resolved'){values.resolved_by=userId;values.resolved_at=now}
      if(status==='open'){values.acknowledged_by=null;values.acknowledged_at=null;values.resolved_by=null;values.resolved_at=null}
      const q=await s.from('business_visibility_alerts').update(values).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id)
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:`Visibility alert marked ${status}.`})
    }

    if(action==='approve_sales_evidence'){
      if(!prospectId)throw new Error('This business is not linked to a sales prospect.')
      const sourceTable=t(body.source_table,100),sourceId=t(body.source_record_id,60)
      if(!sourceTable||!sourceId)throw new Error('Evidence source is required.')
      const evidence=await factualEvidence(s,businessId,prospectId,sourceTable,sourceId)
      const oq=await s.from('skylight_sales_opportunities').select('id').eq('tenant_id',TENANT_ID).eq('prospect_id',prospectId).eq('active',true).order('updated_at',{ascending:false}).limit(1).maybeSingle()
      if(oq.error)throw oq.error
      const q=await s.from('business_visibility_sales_evidence').upsert({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,opportunity_id:oq.data?.id||null,evidence_type:evidence.evidence_type,evidence_summary:evidence.summary,source_table:sourceTable,source_record_id:sourceId,source_url:evidence.source_url,source_checked_at:evidence.checked_at,status:'approved',approved_by:userId,approved_at:now,revoked_by:null,revoked_at:null},{onConflict:'tenant_id,prospect_id,source_table,source_record_id'}).select('*').single()
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:'Factual visibility evidence approved for human Sales review. No outreach was sent or scheduled.',evidence:q.data,automatic_outreach:false,public_ranking_effect:false})
    }

    if(action==='revoke_sales_evidence'){
      const id=t(body.id,60);if(!id)throw new Error('Sales evidence record is required.')
      const q=await s.from('business_visibility_sales_evidence').update({status:'revoked',revoked_by:userId,revoked_at:now}).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id)
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:'Sales evidence approval revoked. Historical record was preserved.'})
    }

    return NextResponse.json({error:'Unsupported visibility monitoring action.'},{status:400})
  }catch(error:any){
    return NextResponse.json({error:t(error?.message||'Unable to process visibility monitoring action.',2000)},{status:400})
  }
}
