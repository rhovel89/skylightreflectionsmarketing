import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { runWebsiteVisibilityAudit } from '@/lib/business-visibility'

type Row=Record<string,any>
const text=(v:any,n=5000)=>String(v??'').trim().slice(0,n)
const devices=new Set(['desktop','mobile'])
const engines=new Set(['google','bing'])
const surfaces=new Set(['organic','local_pack','maps','local_finder'])
const providers=new Set(['brightlocal','manual','import','other'])

async function businessFor(s:any,businessId:string){
  const q=await s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).eq('id',businessId).maybeSingle()
  if(q.error)throw q.error
  if(!q.data)throw new Error('Business was not found for this tenant.')
  return q.data as Row
}

async function linkedProspectId(s:any,businessId:string){
  const q=await s.from('business_prospects').select('id').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(q.error)throw q.error
  return q.data?.id?String(q.data.id):null
}

function validSourceUrl(value:string){
  try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)}catch{return false}
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/businesses')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Row,action=text(body.action,80),businessId=text(body.business_id,60),now=new Date().toISOString()
    if(!businessId)throw new Error('Business is required.')
    const business=await businessFor(s,businessId)
    const prospectId=await linkedProspectId(s,businessId)

    if(action==='run_website_audit'){
      const website=text(body.website||business.website,2000)
      if(!website)throw new Error('Add a website URL to the business before running an audit.')
      try{
        const audit=await runWebsiteVisibilityAudit(website)
        const row={tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,status:'completed',website_url:audit.websiteUrl,final_url:audit.finalUrl,provider:audit.provider,source_url:audit.sourceUrl,checked_at:audit.checkedAt,http_status:audit.httpStatus,response_ms:audit.responseMs,page_size_bytes:audit.pageSizeBytes,is_https:audit.isHttps,indexable:audit.indexable,technical_score:audit.technicalScore,on_page_seo_score:audit.onPageSeoScore,performance_score:audit.performanceScore,accessibility_score:audit.accessibilityScore,best_practices_score:audit.bestPracticesScore,title:audit.title,meta_description:audit.metaDescription,h1:audit.h1,h1_count:audit.h1Count,canonical_url:audit.canonicalUrl,robots_meta:audit.robotsMeta,robots_txt_status:audit.robotsTxtStatus,sitemap_status:audit.sitemapStatus,html_lang:audit.htmlLang,schema_types:audit.schemaTypes,word_count:audit.wordCount,internal_link_count:audit.internalLinkCount,external_link_count:audit.externalLinkCount,image_count:audit.imageCount,images_missing_alt:audit.imagesMissingAlt,core_web_vitals:audit.coreWebVitals,issues:audit.issues,raw_summary:audit.rawSummary,created_by:userId}
        const q=await s.from('business_visibility_audits').insert(row).select('*').single();if(q.error)throw q.error
        return NextResponse.json({ok:true,audit:q.data,google_rankings_measured:false,automatic_outreach:false,public_ranking_effect:false})
      }catch(error:any){
        const message=text(error?.message||error,2000)||'Website audit failed.'
        const failed=await s.from('business_visibility_audits').insert({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,status:'failed',website_url:website,provider:'direct_site_fetch',checked_at:now,error_message:message,created_by:userId})
        if(failed.error)console.error('Unable to record failed visibility audit',failed.error)
        throw new Error(message)
      }
    }

    if(action==='save_target'){
      const keyword=text(body.keyword,240),location=text(body.search_location,240),device=text(body.device||'desktop',20),provider=text(body.preferred_provider||'brightlocal',30)
      if(!keyword||!location)throw new Error('Keyword and search location are required.')
      if(!devices.has(device))throw new Error('Device must be desktop or mobile.')
      if(!providers.has(provider))throw new Error('Ranking provider is invalid.')
      const row={tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,keyword,search_location:location,device,active:body.active!==false,preferred_provider:provider,updated_by:userId,updated_at:now,created_by:userId}
      const q=await s.from('business_visibility_keyword_targets').upsert(row,{onConflict:'tenant_id,business_id,keyword,search_location,device'}).select('*').single();if(q.error)throw q.error
      return NextResponse.json({ok:true,target:q.data,rank_position_created:false})
    }

    if(action==='delete_target'){
      const id=text(body.id,60);if(!id)throw new Error('Keyword target is required.')
      const q=await s.from('business_visibility_keyword_targets').delete().eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id);if(q.error)throw q.error
      return NextResponse.json({ok:true})
    }

    if(action==='save_rank'){
      const targetId=text(body.target_id,60),keyword=text(body.keyword,240),location=text(body.search_location,240),engine=text(body.engine||'google',20),surface=text(body.surface||'organic',30),device=text(body.device||'desktop',20),provider=text(body.provider||'manual',30),sourceUrl=text(body.source_url,2000),providerReference=text(body.provider_reference,500),notes=text(body.notes,2000),notFound=Boolean(body.not_found)
      if(!keyword||!location)throw new Error('Keyword and search location are required.')
      if(!engines.has(engine)||!surfaces.has(surface)||!devices.has(device)||!providers.has(provider))throw new Error('One or more ranking dimensions are invalid.')
      let position:number|null=null
      if(!notFound){position=Number(body.position);if(!Number.isInteger(position)||position<1||position>100)throw new Error('Ranking position must be an integer from 1 to 100, or mark Not found.')}
      if(provider==='manual'&&!validSourceUrl(sourceUrl))throw new Error('Manual rank readings require a valid source/report URL.')
      if(provider!=='manual'&&!sourceUrl&&!providerReference)throw new Error('Provider/import rank readings require a source URL or provider reference.')
      const checked=new Date(String(body.checked_at||now));if(Number.isNaN(checked.getTime()))throw new Error('A valid checked date/time is required.')
      if(targetId){const t=await s.from('business_visibility_keyword_targets').select('id').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',targetId).maybeSingle();if(t.error)throw t.error;if(!t.data)throw new Error('Tracked keyword target was not found.')}
      const row={tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,target_id:targetId||null,keyword,search_location:location,engine,surface,device,position,not_found:notFound,result_url:text(body.result_url,2000)||null,result_title:text(body.result_title,500)||null,provider,provider_reference:providerReference||null,source_url:sourceUrl||null,checked_at:checked.toISOString(),notes:notes||null,created_by:userId}
      const q=await s.from('business_visibility_rankings').insert(row).select('*').single();if(q.error)throw q.error
      return NextResponse.json({ok:true,ranking:q.data,source_backed:true})
    }

    if(action==='delete_rank'){
      const id=text(body.id,60);if(!id)throw new Error('Ranking record is required.')
      const q=await s.from('business_visibility_rankings').delete().eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('id',id);if(q.error)throw q.error
      return NextResponse.json({ok:true})
    }

    return NextResponse.json({error:'Unsupported Business Visibility action.'},{status:400})
  }catch(error:any){
    return NextResponse.json({error:text(error?.message||'Unable to process Business Visibility action.',2000)},{status:400})
  }
}
