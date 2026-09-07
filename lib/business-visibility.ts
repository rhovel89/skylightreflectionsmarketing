import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

type AuditIssue={code:string;severity:'high'|'medium'|'low';label:string;detail:string}
type FetchResult={status:number;url:string;body:string;headers:Headers;responseMs:number;bytes:number}

type PageSpeedResult={
  performanceScore:number|null
  accessibilityScore:number|null
  bestPracticesScore:number|null
  seoScore:number|null
  coreWebVitals:Record<string,number|null>
}

export type WebsiteVisibilityAudit={
  websiteUrl:string
  finalUrl:string
  provider:'direct_site_fetch'|'combined'
  sourceUrl:string
  checkedAt:string
  httpStatus:number
  responseMs:number
  pageSizeBytes:number
  isHttps:boolean
  indexable:boolean
  technicalScore:number
  onPageSeoScore:number
  performanceScore:number|null
  accessibilityScore:number|null
  bestPracticesScore:number|null
  title:string|null
  metaDescription:string|null
  h1:string|null
  h1Count:number
  canonicalUrl:string|null
  robotsMeta:string|null
  robotsTxtStatus:number|null
  sitemapStatus:number|null
  htmlLang:string|null
  schemaTypes:string[]
  wordCount:number
  internalLinkCount:number
  externalLinkCount:number
  imageCount:number
  imagesMissingAlt:number
  coreWebVitals:Record<string,number|null>
  issues:AuditIssue[]
  rawSummary:Record<string,unknown>
}

const clamp=(value:number)=>Math.max(0,Math.min(100,Math.round(value)))
const clean=(value:string)=>value.replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim()
const attr=(tag:string,name:string)=>{const m=tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'));return (m?.[1]??m?.[2]??m?.[3]??'').trim()}

function isBlockedIpv4(address:string){
  const p=address.split('.').map(Number)
  if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return true
  const [a,b]=p
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0)||(a===192&&b===2)||(a===198&&(b===18||b===19))||(a===198&&b===51)||(a===203&&b===0)
}
function isBlockedAddress(address:string){
  const value=address.toLowerCase()
  const mapped=value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if(mapped)return isBlockedIpv4(mapped)
  if(isIP(value)===4)return isBlockedIpv4(value)
  if(isIP(value)===6)return value==='::'||value==='::1'||value.startsWith('fc')||value.startsWith('fd')||/^fe[89ab]/.test(value)||value.startsWith('ff')
  return true
}

export function normalizeWebsiteUrl(input:string){
  const raw=String(input||'').trim()
  if(!raw)throw new Error('This business does not have a website URL to audit.')
  const value=/^https?:\/\//i.test(raw)?raw:`https://${raw}`
  const url=new URL(value)
  if(!['http:','https:'].includes(url.protocol))throw new Error('Only http and https websites can be audited.')
  url.hash=''
  return url.toString()
}

async function assertPublicUrl(input:string){
  const url=new URL(input)
  if(!['http:','https:'].includes(url.protocol))throw new Error('Only public http/https URLs can be audited.')
  if(url.username||url.password)throw new Error('Website URLs with embedded credentials are not allowed.')
  const host=url.hostname.toLowerCase().replace(/\.$/,'')
  if(!host||host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||host==='metadata.google.internal')throw new Error('Private or local network targets are not allowed.')
  const addresses=isIP(host)?[{address:host}]:await lookup(host,{all:true,verbatim:true})
  if(!addresses.length||addresses.some(({address})=>isBlockedAddress(address)))throw new Error('The website resolves to a private or reserved network address and cannot be audited.')
  return url
}

async function safeFetch(input:string,maxBytes:number,accept:string):Promise<FetchResult>{
  let current=(await assertPublicUrl(input)).toString()
  let totalMs=0
  for(let hop=0;hop<5;hop++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000),started=Date.now()
    let response:Response
    try{
      response=await fetch(current,{redirect:'manual',signal:controller.signal,headers:{'user-agent':'Skylight-Visibility-Audit/1.0','accept':accept}})
    }catch(error:any){
      throw new Error(error?.name==='AbortError'?'Website request timed out.':`Website request failed: ${String(error?.message||error)}`)
    }finally{clearTimeout(timer)}
    totalMs+=Date.now()-started
    if(response.status>=300&&response.status<400){
      const location=response.headers.get('location')
      if(!location)throw new Error(`Website returned redirect status ${response.status} without a location.`)
      current=(await assertPublicUrl(new URL(location,current).toString())).toString()
      continue
    }
    const declared=Number(response.headers.get('content-length')||0)
    if(declared>maxBytes)throw new Error(`Website response exceeds the ${Math.round(maxBytes/1000000)} MB audit limit.`)
    const buffer=await response.arrayBuffer()
    if(buffer.byteLength>maxBytes)throw new Error(`Website response exceeds the ${Math.round(maxBytes/1000000)} MB audit limit.`)
    return {status:response.status,url:current,body:new TextDecoder().decode(buffer),headers:response.headers,responseMs:totalMs,bytes:buffer.byteLength}
  }
  throw new Error('Website redirected too many times.')
}

function metaValue(html:string,key:string){
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
    const token=(attr(tag,'name')||attr(tag,'property')).toLowerCase()
    if(token===key.toLowerCase())return attr(tag,'content')||null
  }
  return null
}
function linkHref(html:string,rel:string){
  for(const tag of html.match(/<link\b[^>]*>/gi)||[]){
    const rels=attr(tag,'rel').toLowerCase().split(/\s+/)
    if(rels.includes(rel.toLowerCase()))return attr(tag,'href')||null
  }
  return null
}
function schemaTypes(html:string){
  const set=new Set<string>()
  for(const script of html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[]){
    const body=script.replace(/^<script\b[^>]*>/i,'').replace(/<\/script>$/i,'')
    for(const m of body.matchAll(/"@type"\s*:\s*"([^"]+)"/gi))set.add(m[1].trim())
  }
  return [...set].filter(Boolean).slice(0,30)
}
function pageText(html:string){return clean(html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' '))}

async function pageSpeed(finalUrl:string):Promise<PageSpeedResult|null>{
  const key=process.env.GOOGLE_PAGESPEED_API_KEY?.trim()
  if(!key)return null
  const qs=new URLSearchParams({url:finalUrl,strategy:'mobile',key})
  for(const category of ['performance','accessibility','best-practices','seo'])qs.append('category',category)
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000)
  try{
    const response=await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs.toString()}`,{signal:controller.signal,headers:{accept:'application/json'}})
    if(!response.ok)return null
    const data:any=await response.json(),categories=data?.lighthouseResult?.categories||{},audits=data?.lighthouseResult?.audits||{}
    const score=(name:string)=>Number.isFinite(Number(categories?.[name]?.score))?Math.round(Number(categories[name].score)*100):null
    const numeric=(name:string)=>Number.isFinite(Number(audits?.[name]?.numericValue))?Number(audits[name].numericValue):null
    return {performanceScore:score('performance'),accessibilityScore:score('accessibility'),bestPracticesScore:score('best-practices'),seoScore:score('seo'),coreWebVitals:{lcp_ms:numeric('largest-contentful-paint'),cls:numeric('cumulative-layout-shift'),inp_ms:numeric('interaction-to-next-paint'),tbt_ms:numeric('total-blocking-time')}}
  }catch{return null}finally{clearTimeout(timer)}
}

export async function runWebsiteVisibilityAudit(input:string):Promise<WebsiteVisibilityAudit>{
  const websiteUrl=normalizeWebsiteUrl(input)
  const page=await safeFetch(websiteUrl,5_000_000,'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5')
  const html=page.body
  const titleMatch=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  const title=titleMatch?clean(titleMatch[1]):null
  const metaDescription=metaValue(html,'description')
  const h1Matches=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
  const h1=h1Matches[0]?clean(h1Matches[0][1]):null
  const canonicalRaw=linkHref(html,'canonical')
  let canonicalUrl:string|null=null
  try{canonicalUrl=canonicalRaw?new URL(canonicalRaw,page.url).toString():null}catch{}
  const robotsMeta=[metaValue(html,'robots'),page.headers.get('x-robots-tag')].filter(Boolean).join(', ')||null
  const indexable=!/\bnoindex\b/i.test(robotsMeta||'')
  const htmlLang=attr(html.match(/<html\b[^>]*>/i)?.[0]||'','lang')||null
  const viewport=metaValue(html,'viewport')
  const schemas=schemaTypes(html)
  const words=pageText(html).split(/\s+/).filter(Boolean).length
  const images=html.match(/<img\b[^>]*>/gi)||[]
  const imagesMissingAlt=images.filter(tag=>!attr(tag,'alt')).length
  const anchors=html.match(/<a\b[^>]*>/gi)||[]
  let internal=0,external=0
  const base=new URL(page.url)
  for(const tag of anchors){
    const href=attr(tag,'href');if(!href||/^(mailto:|tel:|javascript:|#)/i.test(href))continue
    try{const u=new URL(href,page.url);if(!['http:','https:'].includes(u.protocol))continue;u.hostname===base.hostname?internal++:external++}catch{}
  }
  let robotsStatus:number|null=null,sitemapStatus:number|null=null
  try{robotsStatus=(await safeFetch(new URL('/robots.txt',page.url).toString(),500_000,'text/plain,*/*;q=0.5')).status}catch{}
  try{sitemapStatus=(await safeFetch(new URL('/sitemap.xml',page.url).toString(),1_000_000,'application/xml,text/xml,*/*;q=0.5')).status}catch{}
  const issues:AuditIssue[]=[]
  const issue=(code:AuditIssue['code'],severity:AuditIssue['severity'],label:string,detail:string)=>issues.push({code,severity,label,detail})
  if(page.status<200||page.status>=300)issue('http_status','high','Homepage is not returning a successful status',`The audited URL returned HTTP ${page.status}.`)
  if(!page.url.startsWith('https://'))issue('https','high','Website is not using HTTPS','The final audited URL is not HTTPS.')
  if(!indexable)issue('noindex','high','Homepage is marked noindex','The robots directive indicates the homepage should not be indexed.')
  if(!title)issue('title_missing','high','Missing title tag','No HTML title tag was detected on the homepage.')
  else if(title.length<30||title.length>65)issue('title_length','low','Title length needs review',`Homepage title is ${title.length} characters.`)
  if(!metaDescription)issue('meta_description_missing','medium','Missing meta description','No meta description was detected on the homepage.')
  else if(metaDescription.length<70||metaDescription.length>170)issue('meta_description_length','low','Meta description length needs review',`Homepage meta description is ${metaDescription.length} characters.`)
  if(h1Matches.length===0)issue('h1_missing','high','Missing H1','No H1 heading was detected on the homepage.')
  else if(h1Matches.length>1)issue('multiple_h1','low','Multiple H1 headings',`${h1Matches.length} H1 headings were detected.`)
  if(!canonicalUrl)issue('canonical_missing','medium','Missing canonical URL','No canonical link was detected on the homepage.')
  if(!viewport)issue('viewport_missing','medium','Missing mobile viewport','No viewport meta tag was detected.')
  if(!htmlLang)issue('lang_missing','low','Missing document language','The HTML element does not declare a language.')
  if(!schemas.length)issue('schema_missing','low','No JSON-LD schema detected','No JSON-LD @type was detected on the homepage.')
  if(images.length&&imagesMissingAlt)issue('image_alt','low','Images missing alt text',`${imagesMissingAlt} of ${images.length} homepage images have no non-empty alt text.`)
  if(robotsStatus!==null&&robotsStatus>=400)issue('robots_txt','low','robots.txt not available',`/robots.txt returned HTTP ${robotsStatus}.`)
  if(sitemapStatus!==null&&sitemapStatus>=400)issue('sitemap','low','sitemap.xml not available',`/sitemap.xml returned HTTP ${sitemapStatus}.`)
  if(page.responseMs>3000)issue('response_time','medium','Slow server response',`The audited request took about ${page.responseMs} ms.`)
  if(page.bytes>2_000_000)issue('page_weight','medium','Large homepage payload',`The homepage response was about ${(page.bytes/1_000_000).toFixed(1)} MB.`)

  let onPage=100
  for(const row of issues){
    if(row.code==='noindex')onPage-=50
    else if(['title_missing','h1_missing'].includes(row.code))onPage-=20
    else if(row.code==='meta_description_missing')onPage-=15
    else if(['canonical_missing','viewport_missing'].includes(row.code))onPage-=8
    else if(['title_length','meta_description_length','multiple_h1','schema_missing','image_alt'].includes(row.code))onPage-=5
    else if(row.code==='lang_missing')onPage-=3
  }
  let technical=100
  for(const row of issues){
    if(row.code==='http_status')technical-=40
    else if(row.code==='https')technical-=20
    else if(row.code==='noindex')technical-=20
    else if(['response_time','page_weight'].includes(row.code))technical-=10
    else if(['canonical_missing','viewport_missing'].includes(row.code))technical-=7
    else if(['robots_txt','sitemap'].includes(row.code))technical-=4
  }
  const psi=await pageSpeed(page.url)
  return {
    websiteUrl,finalUrl:page.url,provider:psi?'combined':'direct_site_fetch',sourceUrl:page.url,checkedAt:new Date().toISOString(),httpStatus:page.status,responseMs:page.responseMs,pageSizeBytes:page.bytes,isHttps:page.url.startsWith('https://'),indexable,technicalScore:clamp(technical),onPageSeoScore:clamp(onPage),performanceScore:psi?.performanceScore??null,accessibilityScore:psi?.accessibilityScore??null,bestPracticesScore:psi?.bestPracticesScore??null,title,metaDescription,h1,h1Count:h1Matches.length,canonicalUrl,robotsMeta,robotsTxtStatus:robotsStatus,sitemapStatus,htmlLang,schemaTypes:schemas,wordCount:words,internalLinkCount:internal,externalLinkCount:external,imageCount:images.length,imagesMissingAlt,coreWebVitals:psi?.coreWebVitals||{},issues,rawSummary:{viewport_present:Boolean(viewport),pagespeed_configured:Boolean(process.env.GOOGLE_PAGESPEED_API_KEY),pagespeed_seo_score:psi?.seoScore??null,score_method:'Skylight deterministic technical/on-page audit; not a Google ranking score.'}
  }
}
