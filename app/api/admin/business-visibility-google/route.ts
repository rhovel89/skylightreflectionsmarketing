import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { parseDelimited,pick,numberValue,ctrValue,isoDate,monthStart,metricName,fingerprint,validHttpUrl,googleAccessToken,googleJson,dateParts,daysAgo,googleVisibilityApiConfigured,CsvRow } from '@/lib/google-owned-visibility'

type Row=Record<string,any>
const t=(v:any,n=5000)=>String(v??'').trim().slice(0,n)
const dims=new Set(['summary','query','page','device','country','search_appearance'])
const official={gsc:'https://search.google.com/search-console/performance/search-analytics',gbp:'https://business.google.com/locations'}

async function businessFor(s:any,id:string){const q=await s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error('Business was not found.');return q.data as Row}
async function prospectFor(s:any,id:string){const q=await s.from('business_prospects').select('id').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(1).maybeSingle();if(q.error)throw q.error;return q.data?.id?String(q.data.id):null}
async function upsertChunks(s:any,table:string,rows:Row[]){let saved=0;for(let i=0;i<rows.length;i+=400){const q=await s.from(table).upsert(rows.slice(i,i+400),{onConflict:'tenant_id,business_id,source_fingerprint'}).select('id');if(q.error)throw q.error;saved+=(q.data||[]).length}return saved}
async function startBatch(s:any,businessId:string,prospectId:string|null,userId:string,dataset:string,body:Row){const source=t(body.source_url,2000)|| (dataset==='search_console'?official.gsc:official.gbp);if(source&&!validHttpUrl(source))throw new Error('Import source URL must be a valid http/https URL.');const q=await s.from('business_visibility_google_import_batches').insert({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,dataset_type:dataset,source_url:source,original_filename:t(body.original_filename,300)||null,provider_reference:t(body.provider_reference,500)||null,status:'completed',created_by:userId}).select('*').single();if(q.error)throw q.error;return q.data as Row}
async function finishBatch(s:any,id:string,imported:number,rejected:number,warnings:string[]){const status=rejected?(imported?'partial':'failed'):'completed';const q=await s.from('business_visibility_google_import_batches').update({status,imported_rows:imported,rejected_rows:rejected,warnings:warnings.slice(0,100)}).eq('id',id);if(q.error)throw q.error;return status}
function dateRange(body:Row,defaultStart:string,defaultEnd:string){const start=isoDate(body.start_date)||defaultStart,end=isoDate(body.end_date)||defaultEnd;if(!start||!end||end<start)throw new Error('A valid start/end date range is required.');return {start,end}}
function detectGscDimension(row:CsvRow,requested:string){if(requested&&requested!=='auto'){if(!dims.has(requested))throw new Error('Invalid Search Console dimension.');return requested}for(const d of ['query','page','device','country','search_appearance'])if(pick(row,d))return d;return 'summary'}

async function importGsc(s:any,businessId:string,prospectId:string|null,userId:string,body:Row){
  const csv=t(body.csv_text,2_500_000),rows=parseDelimited(csv);if(!rows.length)throw new Error('No Search Console CSV/TSV rows were found.');if(rows.length>15000)throw new Error('Import is limited to 15,000 rows per batch.')
  const batch=await startBatch(s,businessId,prospectId,userId,'search_console',body),warnings:string[]=[],out:Row[]=[]
  const requested=t(body.dimension_type||'auto',40),baseStart=isoDate(body.period_start),baseEnd=isoDate(body.period_end),searchType=t(body.search_type||'web',40)||'web'
  rows.forEach((r,i)=>{try{
    const rowDate=isoDate(pick(r,'date')),dimension=detectGscDimension(r,requested),value=dimension==='summary'?null:pick(r,dimension),start=rowDate||baseStart,end=rowDate||baseEnd
    if(!start||!end||end<start)throw new Error('period/date missing')
    if(dimension!=='summary'&&!value)throw new Error(`${dimension} missing`)
    const clicks=numberValue(pick(r,'clicks')),impressions=numberValue(pick(r,'impressions')),ctr=ctrValue(pick(r,'ctr','click_through_rate')),position=numberValue(pick(r,'position','average_position'))
    if(clicks===null&&impressions===null)throw new Error('clicks/impressions missing')
    const fp=fingerprint(['gsc',businessId,start,end,dimension,value||'',searchType])
    out.push({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,import_batch_id:batch.id,connection_id:null,period_start:start,period_end:end,dimension_type:dimension,dimension_value:value||null,search_type:searchType,clicks:Math.max(0,Math.round(clicks||0)),impressions:Math.max(0,Math.round(impressions||0)),ctr:Math.max(0,ctr??((impressions||0)>0?(clicks||0)/(impressions||1):0)),position:position===null?null:Math.max(0,position),source_type:'google_search_console_export',source_url:batch.source_url,source_fingerprint:fp,checked_at:new Date().toISOString(),created_by:userId})
  }catch(e:any){warnings.push(`Row ${i+2}: ${t(e?.message||e,180)}`)}})
  const saved=out.length?await upsertChunks(s,'business_visibility_gsc_metrics',out):0;await finishBatch(s,batch.id,saved,warnings.length,warnings)
  return {batch_id:batch.id,processed:out.length,saved,rejected:warnings.length,warnings:warnings.slice(0,20)}
}

async function importGbpPerformance(s:any,businessId:string,prospectId:string|null,userId:string,body:Row){
  const rows=parseDelimited(t(body.csv_text,2_500_000));if(!rows.length)throw new Error('No Google Business Profile performance rows were found.');if(rows.length>10000)throw new Error('Import is limited to 10,000 source rows per batch.')
  const batch=await startBatch(s,businessId,prospectId,userId,'gbp_performance',body),warnings:string[]=[],out:Row[]=[],defaultLocation=t(body.location_name,240)
  rows.forEach((r,i)=>{try{
    const date=isoDate(pick(r,'date','day','metric_date'));if(!date)throw new Error('date missing')
    const location=pick(r,'location','location_name','business')||defaultLocation||null,metric=pick(r,'metric','daily_metric'),longValue=numberValue(pick(r,'value','metric_value'))
    const pairs:{name:string,value:number}[]=[]
    if(metric&&longValue!==null)pairs.push({name:metricName(metric),value:longValue})
    else for(const [key,value] of Object.entries(r)){if(['date','day','metric_date','location','location_name','business','business_name'].includes(key))continue;const n=numberValue(value);if(n!==null)pairs.push({name:metricName(key),value:n})}
    if(!pairs.length)throw new Error('no numeric performance metrics found')
    for(const pair of pairs){const fp=fingerprint(['gbp_metric',businessId,date,pair.name,location||'']);out.push({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,import_batch_id:batch.id,connection_id:null,location_name:location,metric_date:date,metric:pair.name,metric_value:Math.max(0,pair.value),subentity_type:{},source_type:'google_business_profile_export',source_url:batch.source_url,source_fingerprint:fp,checked_at:new Date().toISOString(),created_by:userId})}
  }catch(e:any){warnings.push(`Row ${i+2}: ${t(e?.message||e,180)}`)}})
  const saved=out.length?await upsertChunks(s,'business_visibility_gbp_metrics',out):0;await finishBatch(s,batch.id,saved,warnings.length,warnings)
  return {batch_id:batch.id,processed:out.length,saved,rejected:warnings.length,warnings:warnings.slice(0,20)}
}

async function importGbpKeywords(s:any,businessId:string,prospectId:string|null,userId:string,body:Row){
  const rows=parseDelimited(t(body.csv_text,2_500_000));if(!rows.length)throw new Error('No Google Business Profile keyword rows were found.');if(rows.length>10000)throw new Error('Import is limited to 10,000 rows per batch.')
  const batch=await startBatch(s,businessId,prospectId,userId,'gbp_keywords',body),warnings:string[]=[],out:Row[]=[],fallbackMonth=monthStart(body.month),defaultLocation=t(body.location_name,240)
  rows.forEach((r,i)=>{try{
    const month=monthStart(pick(r,'month','date','month_start'))||fallbackMonth,keyword=pick(r,'search_keyword','keyword','search_term','query').toLowerCase(),raw=pick(r,'impressions','impression_count','views')
    if(!month||!keyword||!raw)throw new Error('month, keyword or impressions missing')
    const thresholdMatch=raw.replace(/,/g,'').match(/^\s*<\s*(\d+)/),value=thresholdMatch?null:numberValue(raw),threshold=thresholdMatch?Number(thresholdMatch[1]):null
    if(value===null&&threshold===null)throw new Error('invalid impressions value')
    const location=pick(r,'location','location_name','business')||defaultLocation||null,fp=fingerprint(['gbp_keyword',businessId,month,keyword,location||''])
    out.push({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,import_batch_id:batch.id,connection_id:null,location_name:location,month_start:month,search_keyword:keyword,impressions_value:value===null?null:Math.max(0,Math.round(value)),impressions_threshold:threshold,source_type:'google_business_profile_export',source_url:batch.source_url,source_fingerprint:fp,checked_at:new Date().toISOString(),created_by:userId})
  }catch(e:any){warnings.push(`Row ${i+2}: ${t(e?.message||e,180)}`)}})
  const saved=out.length?await upsertChunks(s,'business_visibility_gbp_search_keywords',out):0;await finishBatch(s,batch.id,saved,warnings.length,warnings)
  return {batch_id:batch.id,processed:out.length,saved,rejected:warnings.length,warnings:warnings.slice(0,20)}
}

async function discover(accessToken:string){
  let gscSites:any[]=[],gbpLocations:any[]=[],gscError:string|null=null,gbpError:string|null=null
  try{const data=await googleJson('https://www.googleapis.com/webmasters/v3/sites',accessToken);gscSites=(data.siteEntry||[]).map((x:any)=>({siteUrl:x.siteUrl,permissionLevel:x.permissionLevel}))}catch(e:any){gscError=t(e?.message||e,700)}
  try{
    const accounts=await googleJson('https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20',accessToken)
    for(const account of (accounts.accounts||[]).slice(0,20)){
      const url=`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?pageSize=100&readMask=name,title,storeCode,websiteUri`
      const locations=await googleJson(url,accessToken)
      for(const loc of locations.locations||[])gbpLocations.push({accountName:account.name,accountLabel:account.accountName||account.name,locationName:loc.name,title:loc.title||loc.name,storeCode:loc.storeCode||null,websiteUri:loc.websiteUri||null})
    }
  }catch(e:any){gbpError=t(e?.message||e,700)}
  return {gsc_sites:gscSites,gbp_locations:gbpLocations,gsc_error:gscError,gbp_error:gbpError}
}

async function saveConnection(s:any,businessId:string,prospectId:string|null,userId:string,body:Row){
  const type=t(body.connection_type,40);if(!['search_console','business_profile'].includes(type))throw new Error('Connection type is invalid.')
  const values:any={tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,connection_type:type,status:'pending',updated_by:userId,updated_at:new Date().toISOString(),created_by:userId,last_error:null}
  if(type==='search_console'){const property=t(body.search_console_property,500);if(!property)throw new Error('Choose a Search Console property.');values.search_console_property=property;values.scopes=['https://www.googleapis.com/auth/webmasters.readonly']}
  else{const account=t(body.gbp_account_name,300),location=t(body.gbp_location_name,300);if(!account||!location)throw new Error('Choose a Business Profile account and location.');values.gbp_account_name=account;values.gbp_location_name=location;values.gbp_location_title=t(body.gbp_location_title,300)||null;values.scopes=['https://www.googleapis.com/auth/business.manage']}
  const q=await s.from('business_visibility_google_connections').upsert(values,{onConflict:'tenant_id,business_id,connection_type'}).select('id,connection_type,status,search_console_property,gbp_account_name,gbp_location_name,gbp_location_title,last_sync_at,last_error,updated_at').single();if(q.error)throw q.error;return q.data
}

async function syncGsc(s:any,businessId:string,prospectId:string|null,userId:string,body:Row){
  const cq=await s.from('business_visibility_google_connections').select('id,search_console_property').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('connection_type','search_console').maybeSingle();if(cq.error)throw cq.error;if(!cq.data?.search_console_property)throw new Error('Save a Search Console property first.')
  const {start,end}=dateRange(body,daysAgo(30),daysAgo(2)),token=await googleAccessToken(),property=String(cq.data.search_console_property),rows:Row[]=[]
  for(const dimension of ['summary','query','page','device','country']){
    const request:any={startDate:start,endDate:end,type:'web',rowLimit:dimension==='summary'?1:2500,startRow:0}
    if(dimension!=='summary')request.dimensions=[dimension]
    const url=`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`
    const data=await googleJson(url,token,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)})
    for(const r of data.rows||[]){const value=dimension==='summary'?null:String(r.keys?.[0]??''),fp=fingerprint(['gsc',businessId,start,end,dimension,value||'','web']);rows.push({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,import_batch_id:null,connection_id:cq.data.id,period_start:start,period_end:end,dimension_type:dimension,dimension_value:value,search_type:'web',clicks:Math.max(0,Math.round(Number(r.clicks||0))),impressions:Math.max(0,Math.round(Number(r.impressions||0))),ctr:Math.max(0,Number(r.ctr||0)),position:Number.isFinite(Number(r.position))?Math.max(0,Number(r.position)):null,source_type:'google_search_console_api',source_url:official.gsc,source_fingerprint:fp,checked_at:new Date().toISOString(),created_by:userId})}
  }
  const saved=rows.length?await upsertChunks(s,'business_visibility_gsc_metrics',rows):0,now=new Date().toISOString();const uq=await s.from('business_visibility_google_connections').update({status:'connected',last_sync_at:now,last_error:null,updated_by:userId,updated_at:now}).eq('id',cq.data.id);if(uq.error)throw uq.error
  return {saved,period_start:start,period_end:end,property,note:'Search Console may return top rows rather than every possible row.'}
}

async function syncGbp(s:any,businessId:string,prospectId:string|null,userId:string){
  const cq=await s.from('business_visibility_google_connections').select('id,gbp_account_name,gbp_location_name,gbp_location_title').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('connection_type','business_profile').maybeSingle();if(cq.error)throw cq.error;if(!cq.data?.gbp_location_name)throw new Error('Save a Google Business Profile location first.')
  const token=await googleAccessToken(),end=daysAgo(1),start=daysAgo(31),sp=dateParts(start),ep=dateParts(end),location=String(cq.data.gbp_location_name)
  if(!/^locations\/[^/]+$/.test(location))throw new Error('Stored Business Profile location resource is invalid.')
  const metrics=['BUSINESS_IMPRESSIONS_DESKTOP_MAPS','BUSINESS_IMPRESSIONS_DESKTOP_SEARCH','BUSINESS_IMPRESSIONS_MOBILE_MAPS','BUSINESS_IMPRESSIONS_MOBILE_SEARCH','BUSINESS_DIRECTION_REQUESTS','CALL_CLICKS','WEBSITE_CLICKS','BUSINESS_BOOKINGS','BUSINESS_FOOD_ORDERS','BUSINESS_FOOD_MENU_CLICKS']
  const qs=new URLSearchParams();for(const m of metrics)qs.append('dailyMetrics',m);qs.set('dailyRange.start_date.year',String(sp.year));qs.set('dailyRange.start_date.month',String(sp.month));qs.set('dailyRange.start_date.day',String(sp.day));qs.set('dailyRange.end_date.year',String(ep.year));qs.set('dailyRange.end_date.month',String(ep.month));qs.set('dailyRange.end_date.day',String(ep.day))
  const data=await googleJson(`https://businessprofileperformance.googleapis.com/v1/${location}:fetchMultiDailyMetricsTimeSeries?${qs}`,token),rows:Row[]=[]
  for(const group of data.multiDailyMetricTimeSeries||[])for(const series of group.dailyMetricTimeSeries||[]){const metric=String(series.dailyMetric||'DAILY_METRIC_UNKNOWN');for(const dv of series.timeSeries?.datedValues||[]){const d=dv.date||{},date=[d.year,String(d.month).padStart(2,'0'),String(d.day).padStart(2,'0')].join('-'),fp=fingerprint(['gbp_metric',businessId,date,metric,location]);rows.push({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,import_batch_id:null,connection_id:cq.data.id,location_name:location,metric_date:date,metric,metric_value:Math.max(0,Number(dv.value||0)),subentity_type:series.dailySubEntityType||{},source_type:'google_business_profile_api',source_url:official.gbp,source_fingerprint:fp,checked_at:new Date().toISOString(),created_by:userId})}}
  const savedMetrics=rows.length?await upsertChunks(s,'business_visibility_gbp_metrics',rows):0,keywordRows:Row[]=[],now=new Date()
  for(const offset of [3,2,1]){const md=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-offset,1)),year=md.getUTCFullYear(),month=md.getUTCMonth()+1,monthIso=`${year}-${String(month).padStart(2,'0')}-01`;let pageToken=''
    for(let page=0;page<10;page++){const kq=new URLSearchParams({'monthlyRange.start_month.year':String(year),'monthlyRange.start_month.month':String(month),'monthlyRange.end_month.year':String(year),'monthlyRange.end_month.month':String(month),pageSize:'100'});if(pageToken)kq.set('pageToken',pageToken);const kd=await googleJson(`https://businessprofileperformance.googleapis.com/v1/${location}/searchkeywords/impressions/monthly?${kq}`,token);for(const item of kd.searchKeywordsCounts||[]){const keyword=String(item.searchKeyword||'').trim().toLowerCase(),iv=item.insightsValue||{};if(!keyword)continue;const fp=fingerprint(['gbp_keyword',businessId,monthIso,keyword,location]);keywordRows.push({tenant_id:TENANT_ID,business_id:businessId,prospect_id:prospectId,import_batch_id:null,connection_id:cq.data.id,location_name:location,month_start:monthIso,search_keyword:keyword,impressions_value:iv.value!==undefined?Math.max(0,Number(iv.value)):null,impressions_threshold:iv.threshold!==undefined?Math.max(0,Number(iv.threshold)):null,source_type:'google_business_profile_api',source_url:official.gbp,source_fingerprint:fp,checked_at:new Date().toISOString(),created_by:userId})}pageToken=String(kd.nextPageToken||'');if(!pageToken)break}}
  const savedKeywords=keywordRows.length?await upsertChunks(s,'business_visibility_gbp_search_keywords',keywordRows):0,synced=new Date().toISOString();const uq=await s.from('business_visibility_google_connections').update({status:'connected',last_sync_at:synced,last_error:null,updated_by:userId,updated_at:synced}).eq('id',cq.data.id);if(uq.error)throw uq.error
  return {saved_metrics:savedMetrics,saved_keywords:savedKeywords,period_start:start,period_end:end,location}
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/businesses'),userId=String(claims.sub),s=await createClient(),body=await req.json() as Row,businessId=t(body.business_id,60),action=t(body.action,80)
    if(!businessId)throw new Error('Business is required.');await businessFor(s,businessId);const prospectId=await prospectFor(s,businessId)
    if(action==='import_search_console')return NextResponse.json({ok:true,...await importGsc(s,businessId,prospectId,userId,body),automatic_outreach:false,public_ranking_effect:false})
    if(action==='import_gbp_performance')return NextResponse.json({ok:true,...await importGbpPerformance(s,businessId,prospectId,userId,body),automatic_outreach:false,public_ranking_effect:false})
    if(action==='import_gbp_keywords')return NextResponse.json({ok:true,...await importGbpKeywords(s,businessId,prospectId,userId,body),automatic_outreach:false,public_ranking_effect:false})
    if(action==='discover_google_sources'){if(!googleVisibilityApiConfigured())return NextResponse.json({error:'Google Visibility OAuth credentials are not configured. CSV/import mode remains available.'},{status:503});return NextResponse.json({ok:true,...await discover(await googleAccessToken())})}
    if(action==='save_google_connection')return NextResponse.json({ok:true,connection:await saveConnection(s,businessId,prospectId,userId,body),api_credentials_configured:googleVisibilityApiConfigured()})
    if(action==='sync_search_console'){if(!googleVisibilityApiConfigured())return NextResponse.json({error:'Google Visibility OAuth credentials are not configured.'},{status:503});return NextResponse.json({ok:true,...await syncGsc(s,businessId,prospectId,userId,body),automatic_outreach:false})}
    if(action==='sync_business_profile'){if(!googleVisibilityApiConfigured())return NextResponse.json({error:'Google Visibility OAuth credentials are not configured. GBP API access also requires Google approval.'},{status:503});return NextResponse.json({ok:true,...await syncGbp(s,businessId,prospectId,userId),automatic_outreach:false})}
    if(action==='disconnect_google_source'){const type=t(body.connection_type,40);if(!['search_console','business_profile'].includes(type))throw new Error('Connection type is invalid.');const q=await s.from('business_visibility_google_connections').update({status:'disconnected',last_error:null,updated_by:userId,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('connection_type',type);if(q.error)throw q.error;return NextResponse.json({ok:true,message:'Google source disconnected. Historical metrics were preserved.'})}
    return NextResponse.json({error:'Unsupported Google visibility action.'},{status:400})
  }catch(error:any){return NextResponse.json({error:t(error?.message||'Unable to process Google visibility action.',2000)},{status:400})}
}
