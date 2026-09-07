import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TENANT_ID } from '@/lib/constants'
import { runWebsiteVisibilityAudit } from '@/lib/business-visibility'

export const dynamic='force-dynamic'
type Row=Record<string,any>
const cut=(v:any,n=1800)=>String(v??'').trim().slice(0,n)
const plusHours=(hours:number)=>new Date(Date.now()+hours*3600000).toISOString()

function ownRow(a:any,businessId:string,prospectId:string|null){
  return {tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,status:'completed',website_url:a.websiteUrl,final_url:a.finalUrl,provider:a.provider,source_url:a.sourceUrl,checked_at:a.checkedAt,http_status:a.httpStatus,response_ms:a.responseMs,page_size_bytes:a.pageSizeBytes,is_https:a.isHttps,indexable:a.indexable,technical_score:a.technicalScore,on_page_seo_score:a.onPageSeoScore,performance_score:a.performanceScore,accessibility_score:a.accessibilityScore,best_practices_score:a.bestPracticesScore,title:a.title,meta_description:a.metaDescription,h1:a.h1,h1_count:a.h1Count,canonical_url:a.canonicalUrl,robots_meta:a.robotsMeta,robots_txt_status:a.robotsTxtStatus,sitemap_status:a.sitemapStatus,html_lang:a.htmlLang,schema_types:a.schemaTypes,word_count:a.wordCount,internal_link_count:a.internalLinkCount,external_link_count:a.externalLinkCount,image_count:a.imageCount,images_missing_alt:a.imagesMissingAlt,core_web_vitals:a.coreWebVitals,issues:a.issues,raw_summary:a.rawSummary}
}
function competitorRow(a:any,businessId:string,competitorId:string){
  return {tenant_id:TENANT_ID,business_id:businessId,competitor_id:competitorId,website_url:a.websiteUrl,final_url:a.finalUrl,provider:a.provider,checked_at:a.checkedAt,status:'completed',http_status:a.httpStatus,response_ms:a.responseMs,is_https:a.isHttps,indexable:a.indexable,technical_score:a.technicalScore,on_page_seo_score:a.onPageSeoScore,performance_score:a.performanceScore,title:a.title,meta_description:a.metaDescription,h1:a.h1,word_count:a.wordCount,schema_types:a.schemaTypes,issues:a.issues,raw_summary:a.rawSummary}
}

export async function GET(req:Request){
  const secret=process.env.CRON_SECRET?.trim()
  if(!secret)return NextResponse.json({ok:false,error:'Visibility monitoring cron is not configured.',scheduled_monitoring:false},{status:503,headers:{'Cache-Control':'no-store'}})
  if(req.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false,error:'Unauthorized.'},{status:401,headers:{'Cache-Control':'no-store'}})
  if(!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())return NextResponse.json({ok:false,error:'Server-side Supabase service credential is not configured.',scheduled_monitoring:false},{status:503,headers:{'Cache-Control':'no-store'}})

  const s=createServiceClient(),now=new Date().toISOString()
  const due=await s.from('business_visibility_monitoring_policies').select('*')
    .eq('tenant_id',TENANT_ID).eq('active',true).eq('website_monitoring_enabled',true)
    .lte('next_website_audit_at',now).order('next_website_audit_at',{ascending:true}).limit(5)
  if(due.error)return NextResponse.json({ok:false,error:due.error.message},{status:500,headers:{'Cache-Control':'no-store'}})

  const results:any[]=[]
  for(const policy of due.data||[]){
    const businessId=String(policy.business_id),prospectId=policy.prospect_id?String(policy.prospect_id):null
    const bq=await s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).eq('id',businessId).maybeSingle()
    if(bq.error||!bq.data){
      results.push({business_id:businessId,ok:false,error:bq.error?.message||'Business not found.'})
      continue
    }
    let ownOk=false,ownError=''
    if(bq.data.website){
      try{
        const audit=await runWebsiteVisibilityAudit(String(bq.data.website))
        const iq=await s.from('business_visibility_audits').insert(ownRow(audit,businessId,prospectId))
        if(iq.error)throw iq.error
        ownOk=true
      }catch(error:any){
        ownError=cut(error?.message||error)||'Website audit failed.'
        await s.from('business_visibility_audits').insert({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,status:'failed',website_url:String(bq.data.website),provider:'direct_site_fetch',checked_at:new Date().toISOString(),error_message:ownError})
      }
    }else ownError='Business website is not recorded.'

    let competitorAttempted=0,competitorSucceeded=0
    if(policy.competitor_monitoring_enabled){
      const cq=await s.from('business_visibility_competitors').select('*').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('active',true).not('website_url','is',null).limit(3)
      if(!cq.error){
        for(const competitor of cq.data||[]){
          competitorAttempted++
          try{
            const audit=await runWebsiteVisibilityAudit(String(competitor.website_url))
            const iq=await s.from('business_visibility_competitor_audits').insert(competitorRow(audit,businessId,String(competitor.id)))
            if(iq.error)throw iq.error
            competitorSucceeded++
          }catch(error:any){
            await s.from('business_visibility_competitor_audits').insert({tenant_id:TENANT_ID,business_id:businessId,competitor_id:competitor.id,website_url:String(competitor.website_url),provider:'direct_site_fetch',checked_at:new Date().toISOString(),status:'failed',error_message:cut(error?.message||error)})
          }
        }
      }
    }

    const failures=(ownOk?0:1)+(competitorAttempted-competitorSucceeded)
    const successes=(ownOk?1:0)+competitorSucceeded
    const status=failures?(successes?'partial':'failed'):'ok'
    const message=`Scheduled website monitoring: business ${ownOk?'audited':'failed'}; competitors ${competitorSucceeded}/${competitorAttempted}. Rank auto-sync not executed.`
    const uq=await s.from('business_visibility_monitoring_policies').update({
      last_website_audit_at:now,
      next_website_audit_at:plusHours(Number(policy.website_interval_hours||168)),
      last_run_status:status,
      last_run_message:message,
      updated_at:now,
    }).eq('tenant_id',TENANT_ID).eq('id',policy.id)
    results.push({business_id:businessId,name:bq.data.name,ok:status!=='failed',status,message,policy_update_error:uq.error?.message||null,own_error:ownError||null})
  }

  const rankDue=await s.from('business_visibility_monitoring_policies').select('id',{count:'exact',head:true})
    .eq('tenant_id',TENANT_ID).eq('active',true).eq('rank_monitoring_enabled',true).lte('next_rank_check_at',now)

  return NextResponse.json({
    ok:true,
    processed:results.length,
    results,
    rank_targets_due:rankDue.count||0,
    google_rank_auto_sync:false,
    rank_note:'No ranking-provider endpoint is called until a verified provider contract is configured. Missing ranks remain Not measured.',
    automatic_outreach:false,
    billing_authorization:false,
    public_ranking_effect:false,
  },{status:200,headers:{'Cache-Control':'no-store'}})
}
