import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { runWebsiteVisibilityAudit } from '@/lib/business-visibility'

type Row=Record<string,any>
const cut=(v:any,n=5000)=>String(v??'').trim().slice(0,n)
const validUrl=(value:string)=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)}catch{return false}}
const providers=new Set(['brightlocal','import','other'])
const devices=new Set(['desktop','mobile'])
const surfaces=new Set(['organic','local_pack','maps','local_finder'])

function parseDelimited(input:string){
  const text=String(input||'').replace(/^\uFEFF/,'')
  const delimiter=(text.split('\n')[0]||'').includes('\t')?'\t':','
  const rows:string[][]=[]
  let row:string[]=[],field='',quoted=false
  for(let i=0;i<text.length;i++){
    const ch=text[i]
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){field+='"';i++}
      else quoted=!quoted
    }else if(ch===delimiter&&!quoted){row.push(field);field=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&text[i+1]==='\n')i++
      row.push(field);field=''
      if(row.some(v=>v.trim()))rows.push(row)
      row=[]
    }else field+=ch
  }
  row.push(field);if(row.some(v=>v.trim()))rows.push(row)
  return rows
}
const norm=(v:string)=>v.toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')
function pick(row:Record<string,string>,keys:string[]){for(const k of keys){if(row[k]!==undefined&&String(row[k]).trim()!=='')return String(row[k]).trim()}return ''}
function normalizeSurface(value:string){
  const v=norm(value)
  if(['local','local_pack','map_pack','maps_pack','3_pack'].includes(v))return 'local_pack'
  if(['maps','google_maps'].includes(v))return 'maps'
  if(['local_finder','finder'].includes(v))return 'local_finder'
  return 'organic'
}
function normalizeDevice(value:string){return norm(value)==='mobile'?'mobile':'desktop'}
function parsePosition(value:string){
  const v=value.trim().toLowerCase()
  if(!v||['not_found','not found','n/a','na','none','>100','100+','101'].includes(v))return {position:null,not_found:true}
  const n=Number(v.replace(/^#/,'').replace(/[^0-9]/g,''))
  if(!Number.isInteger(n)||n<1||n>100)throw new Error(`Invalid ranking position: ${value}`)
  return {position:n,not_found:false}
}

async function pageSpeed(finalUrl:string){
  const key=process.env.GOOGLE_PAGESPEED_API_KEY?.trim()
  const qs=new URLSearchParams({url:finalUrl,strategy:'mobile'})
  if(key)qs.set('key',key)
  for(const category of ['performance','accessibility','best-practices','seo'])qs.append('category',category)
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000)
  try{
    const r=await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs.toString()}`,{signal:controller.signal,headers:{accept:'application/json'}})
    if(!r.ok)return null
    const data:any=await r.json(),cats=data?.lighthouseResult?.categories||{},audits=data?.lighthouseResult?.audits||{}
    const score=(name:string)=>Number.isFinite(Number(cats?.[name]?.score))?Math.round(Number(cats[name].score)*100):null
    const numeric=(name:string)=>Number.isFinite(Number(audits?.[name]?.numericValue))?Number(audits[name].numericValue):null
    return {performance:score('performance'),accessibility:score('accessibility'),bestPractices:score('best-practices'),seo:score('seo'),vitals:{lcp_ms:numeric('largest-contentful-paint'),cls:numeric('cumulative-layout-shift'),inp_ms:numeric('interaction-to-next-paint'),tbt_ms:numeric('total-blocking-time')},mode:key?'keyed':'free_no_key'}
  }catch{return null}finally{clearTimeout(timer)}
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/businesses')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Row
    const action=cut(body.action,80),businessId=cut(body.business_id,60)
    if(!businessId)throw new Error('Business is required.')
    const bq=await s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).eq('id',businessId).maybeSingle()
    if(bq.error)throw bq.error;if(!bq.data)throw new Error('Business not found.')
    const pq=await s.from('business_prospects').select('id').eq('tenant_id',TENANT_ID).eq('business_id',businessId).order('updated_at',{ascending:false}).limit(1).maybeSingle()
    if(pq.error)throw pq.error
    const prospectId=pq.data?.id?String(pq.data.id):null

    if(action==='run_free_audit'){
      const website=cut(body.website||bq.data.website,2000)
      if(!website)throw new Error('Add the business website before running an audit.')
      const base=await runWebsiteVisibilityAudit(website)
      const psi=await pageSpeed(base.finalUrl)
      const row={tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,status:'completed',website_url:base.websiteUrl,final_url:base.finalUrl,provider:psi?'combined':base.provider,source_url:base.sourceUrl,checked_at:new Date().toISOString(),http_status:base.httpStatus,response_ms:base.responseMs,page_size_bytes:base.pageSizeBytes,is_https:base.isHttps,indexable:base.indexable,technical_score:base.technicalScore,on_page_seo_score:base.onPageSeoScore,performance_score:psi?.performance??base.performanceScore,accessibility_score:psi?.accessibility??base.accessibilityScore,best_practices_score:psi?.bestPractices??base.bestPracticesScore,title:base.title,meta_description:base.metaDescription,h1:base.h1,h1_count:base.h1Count,canonical_url:base.canonicalUrl,robots_meta:base.robotsMeta,robots_txt_status:base.robotsTxtStatus,sitemap_status:base.sitemapStatus,html_lang:base.htmlLang,schema_types:base.schemaTypes,word_count:base.wordCount,internal_link_count:base.internalLinkCount,external_link_count:base.externalLinkCount,image_count:base.imageCount,images_missing_alt:base.imagesMissingAlt,core_web_vitals:psi?.vitals||base.coreWebVitals,issues:base.issues,raw_summary:{...base.rawSummary,pagespeed_mode:psi?.mode||'unavailable',pagespeed_key_optional:true,pagespeed_seo_score:psi?.seo??null,free_mode:true},created_by:userId}
      const iq=await s.from('business_visibility_audits').insert(row).select('*').single();if(iq.error)throw iq.error
      return NextResponse.json({ok:true,audit:iq.data,pagespeed_mode:psi?.mode||'unavailable',free_mode:true,google_rankings_measured:false,automatic_outreach:false,public_ranking_effect:false})
    }

    if(action==='import_rank_csv'){
      const csv=String(body.csv||'')
      if(!csv.trim())throw new Error('Paste CSV or tab-delimited ranking data first.')
      if(csv.length>1_500_000)throw new Error('Import is too large. Keep each import under 1.5 MB.')
      const provider=cut(body.provider||'import',30)
      if(!providers.has(provider))throw new Error('Provider must be BrightLocal, Import, or Other.')
      const sourceUrl=cut(body.source_url,2000),providerRef=cut(body.provider_reference,500)
      if(!sourceUrl&&!providerRef)throw new Error('Add a source/report URL or provider reference for provenance.')
      if(sourceUrl&&!validUrl(sourceUrl))throw new Error('Source/report URL must be a valid http/https URL.')
      const parsed=parseDelimited(csv)
      if(parsed.length<2)throw new Error('Import needs a header row and at least one data row.')
      const headers=parsed[0].map(norm)
      const rawRows=parsed.slice(1,501)
      const accepted:any[]=[],warnings:string[]=[]
      const defaultLocation=cut(body.default_location,240),defaultDevice=normalizeDevice(cut(body.default_device||'desktop',30)),defaultSurface=normalizeSurface(cut(body.default_surface||'organic',40)),defaultChecked=cut(body.default_checked_at,80)
      const seen=new Set<string>()
      for(let i=0;i<rawRows.length;i++){
        const obj:Record<string,string>={};headers.forEach((h,j)=>obj[h]=rawRows[i][j]??'')
        try{
          const keyword=pick(obj,['keyword','search_term','search_query','term','keyword_phrase'])
          const location=pick(obj,['search_location','location','city','locality','search_area'])||defaultLocation
          const device=normalizeDevice(pick(obj,['device','search_device'])||defaultDevice)
          const surface=normalizeSurface(pick(obj,['surface','search_type','rank_type','result_type'])||defaultSurface)
          const value=pick(obj,['position','rank','ranking','search_rank','current_rank'])
          const checkedRaw=pick(obj,['checked_at','checked_date','report_date','date','run_date'])||defaultChecked||new Date().toISOString()
          if(!keyword||!location)throw new Error('keyword and location are required')
          if(!devices.has(device)||!surfaces.has(surface))throw new Error('invalid device or surface')
          const checked=new Date(checkedRaw);if(Number.isNaN(checked.getTime()))throw new Error('invalid checked date')
          const pos=parsePosition(value)
          const dedupe=`${keyword.toLowerCase()}|${location.toLowerCase()}|${device}|${surface}|${checked.toISOString()}`
          if(seen.has(dedupe)){warnings.push(`Row ${i+2}: duplicate skipped.`);continue}seen.add(dedupe)
          accepted.push({keyword,search_location:location,device,surface,checked_at:checked.toISOString(),...pos,result_url:pick(obj,['result_url','url','ranking_url'])||null,result_title:pick(obj,['result_title','title'])||null})
        }catch(error:any){warnings.push(`Row ${i+2}: ${cut(error?.message||error,180)}`)}
      }
      if(!accepted.length)throw new Error(`No valid ranking rows found. ${warnings.slice(0,3).join(' ')}`)
      const batch=await s.from('business_visibility_import_batches').insert({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,provider,source_url:sourceUrl||null,provider_reference:providerRef||null,original_filename:cut(body.filename,300)||null,status:warnings.length?'partial':'completed',imported_rows:accepted.length,rejected_rows:warnings.length,warnings:warnings.slice(0,100),created_by:userId}).select('*').single()
      if(batch.error)throw batch.error
      const targetRows=[...new Map(accepted.map(r=>[`${r.keyword.toLowerCase()}|${r.search_location.toLowerCase()}|${r.device}`,{tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,keyword:r.keyword,search_location:r.search_location,device:r.device,active:true,preferred_provider:provider==='brightlocal'?'brightlocal':'import',created_by:userId,updated_by:userId,updated_at:new Date().toISOString()}])).values()]
      const tq=await s.from('business_visibility_keyword_targets').upsert(targetRows,{onConflict:'tenant_id,business_id,keyword,search_location,device'}).select('id,keyword,search_location,device')
      if(tq.error)throw tq.error
      const targetMap=new Map((tq.data||[]).map((r:any)=>[`${String(r.keyword).toLowerCase()}|${String(r.search_location).toLowerCase()}|${r.device}`,r.id]))
      const rankRows=accepted.map(r=>({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,target_id:targetMap.get(`${r.keyword.toLowerCase()}|${r.search_location.toLowerCase()}|${r.device}`)||null,import_batch_id:batch.data.id,keyword:r.keyword,search_location:r.search_location,engine:'google',surface:r.surface,device:r.device,position:r.position,not_found:r.not_found,result_url:r.result_url,result_title:r.result_title,provider,provider_reference:providerRef||`import:${batch.data.id}`,source_url:sourceUrl||null,checked_at:r.checked_at,notes:'Bulk imported through Visibility Free Mode 4.1.',created_by:userId}))
      const rq=await s.from('business_visibility_rankings').insert(rankRows)
      if(rq.error)throw rq.error
      return NextResponse.json({ok:true,message:`Imported ${accepted.length} source-backed ranking reading${accepted.length===1?'':'s'}.`,batch_id:batch.data.id,imported:accepted.length,rejected:warnings.length,warnings:warnings.slice(0,20),automatic_rank_scraping:false,public_ranking_effect:false})
    }

    return NextResponse.json({error:'Unsupported Visibility Free Mode action.'},{status:400})
  }catch(error:any){return NextResponse.json({error:cut(error?.message||error,2000)||'Visibility Free Mode action failed.'},{status:400})}
}
