import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined
type LocationRow = { id:string; name:string; slug:string; type?:string|null }
type CategoryRow = { id:string; name:string; slug:string; vertical?:string|null }
type BusinessRow = { id:string; name:string; slug:string; claimed?:boolean|null; phone?:string|null; website?:string|null; description?:string|null; source_url?:string|null; source_checked_at?:string|null }
type QualityRow = BusinessRow & { issues:string[]; severity:number; marketCount:number; categoryCount:number }
type AcquisitionRow = { business:BusinessRow; demand:number; contactable:boolean; status:string; stage:string; priority:string; score:number; nextAction:string }

const one=(v:SearchValue)=>Array.isArray(v)?v[0]??'':v??''
const norm=(v:unknown)=>String(v||'').trim().toLowerCase()
const daysOld=(v:unknown)=>v?Math.max(0,Math.floor((Date.now()-new Date(String(v)).getTime())/86400000)):9999
const titleCase=(v:string)=>v.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
const placements:Record<string,string>={
  homepage_featured:'Homepage Featured',global_sidebar:'Global Sidebar',city_sidebar:'City Sidebar',category_sidebar:'Category Sidebar',city_category:'City + Category',exact_page:'Exact Page',guide_sidebar:'Guide Sidebar',business_profile_sidebar:'Business Profile Sidebar',restaurant_sidebar:'Restaurant Sidebar',home_services_sidebar:'Home Services Sidebar',attorney_sidebar:'Attorney Sidebar',local_stores_sidebar:'Local Stores Sidebar'
}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,SearchValue>>}){
  const sp=await searchParams
  const q=one(sp.q).trim().toLowerCase()
  const qualityFilter=one(sp.quality)
  const acquisitionFilter=one(sp.acquisition)
  const s=await createClient()
  const since30=new Date(Date.now()-30*86400000).toISOString()
  const staleCutoff=new Date(Date.now()-180*86400000).toISOString()

  const [businesses,locations,categories,branches,areas,bc,seo,prospects,sponsors,media,searches,growth,qualityTasks]=await Promise.all([
    s.from('businesses').select('id,name,slug,claimed,phone,website,description,source_url,source_checked_at').eq('tenant_id',TENANT_ID).eq('status','published').limit(5000),
    s.from('locations').select('id,name,slug,type').eq('tenant_id',TENANT_ID).eq('is_active',true).order('name'),
    s.from('categories').select('id,name,slug,vertical').eq('tenant_id',TENANT_ID).eq('is_active',true).order('name'),
    s.from('business_locations').select('business_id,location_id').eq('tenant_id',TENANT_ID).eq('is_active',true).limit(15000),
    s.from('business_service_areas').select('business_id,location_id').limit(25000),
    s.from('business_categories').select('business_id,category_id').limit(30000),
    s.from('seo_pages').select('id,market_location_id,category_id,city,category,index_mode,reviewed,updated_at').eq('tenant_id',TENANT_ID).limit(8000),
    s.from('business_prospects').select('id,business_id,status,crm_stage,priority,owner_contact_email,owner_contact_phone,owner_contact_source_url').eq('tenant_id',TENANT_ID).limit(8000),
    s.from('sponsorships').select('id,business_id,market_location_id,category_id,placement,starts_on,ends_on,active,origin,priority,rotation_weight,page_path').eq('tenant_id',TENANT_ID).limit(8000),
    s.from('business_media').select('business_id,media_type,status,approval_status').eq('tenant_id',TENANT_ID).limit(12000),
    s.from('search_events').select('service,location,result_count,created_at').eq('tenant_id',TENANT_ID).gte('created_at',since30).limit(8000),
    s.from('growth_opportunities').select('id,opportunity_type,business_id,status,score,next_action,source_facts').eq('tenant_id',TENANT_ID).in('status',['open','in_progress','snoozed']).limit(5000),
    s.from('data_quality_tasks').select('task_type,status,priority,source_snapshot').eq('tenant_id',TENANT_ID).in('status',['open','in_progress']).limit(5000),
  ])

  const errors=[businesses.error,locations.error,categories.error,branches.error,areas.error,bc.error,seo.error,prospects.error,sponsors.error,media.error,searches.error,growth.error,qualityTasks.error].filter(Boolean)
  const biz=(businesses.data??[]) as unknown as BusinessRow[]
  const locs=(locations.data??[]) as unknown as LocationRow[]
  const cats=(categories.data??[]) as unknown as CategoryRow[]
  const published=new Set(biz.map(r=>r.id))
  const locById=new Map(locs.map(r=>[r.id,r]))
  const locByTerm=new Map<string,LocationRow>()
  const catById=new Map(cats.map(r=>[r.id,r]))
  const catByTerm=new Map<string,CategoryRow>()
  for(const r of locs){locByTerm.set(norm(r.name),r);locByTerm.set(norm(r.slug),r)}
  for(const r of cats){catByTerm.set(norm(r.name),r);catByTerm.set(norm(r.slug),r)}

  const catsByBusiness=new Map<string,Set<string>>()
  for(const raw of bc.data??[]){const r=raw as any,bid=String(r.business_id||''),cid=String(r.category_id||'');if(!published.has(bid)||!catById.has(cid))continue;const set=catsByBusiness.get(bid)||new Set<string>();set.add(cid);catsByBusiness.set(bid,set)}
  const physicalByBusiness=new Map<string,Set<string>>()
  const serviceByBusiness=new Map<string,Set<string>>()
  const providersByLocation=new Map<string,Set<string>>()
  const connect=(kind:'physical'|'service',bid:string,lid:string)=>{if(!published.has(bid)||!locById.has(lid))return;const own=(kind==='physical'?physicalByBusiness:serviceByBusiness).get(bid)||new Set<string>();own.add(lid);(kind==='physical'?physicalByBusiness:serviceByBusiness).set(bid,own);const all=providersByLocation.get(lid)||new Set<string>();all.add(bid);providersByLocation.set(lid,all)}
  for(const raw of branches.data??[]){const r=raw as any;connect('physical',String(r.business_id||''),String(r.location_id||''))}
  for(const raw of areas.data??[]){const r=raw as any;connect('service',String(r.business_id||''),String(r.location_id||''))}
  const countFor=(lid:string,cid?:string|null)=>{const set=providersByLocation.get(lid)||new Set<string>();if(!cid)return set.size;let n=0;for(const bid of set)if(catsByBusiness.get(bid)?.has(cid))n++;return n}

  const demand=new Map<string,number>(),zero=new Map<string,number>()
  for(const raw of searches.data??[]){const r=raw as any,l=locByTerm.get(norm(r.location)),c=catByTerm.get(norm(r.service));if(!l||!c)continue;const key=`${l.id}|${c.id}`;demand.set(key,(demand.get(key)||0)+1);if(Number(r.result_count||0)===0)zero.set(key,(zero.get(key)||0)+1)}

  const seoByKey=new Map<string,any>()
  for(const raw of seo.data??[]){const r=raw as any;seoByKey.set(`${String(r.market_location_id||'')}|${String(r.category_id||'')}`,r)}
  const eligibleMissing:{location:LocationRow;category:CategoryRow|null;providers:number;demand:number;zero:number}[]=[]
  const underThreshold:any[]=[]
  let healthySeo=0,explicitNoindex=0
  for(const l of locs){
    const cityCount=countFor(l.id),citySeo=seoByKey.get(`${l.id}|`)
    if(cityCount>=3){if(citySeo?.reviewed&&citySeo.index_mode!=='noindex')healthySeo++;else eligibleMissing.push({location:l,category:null,providers:cityCount,demand:0,zero:0})}
    if(citySeo?.index_mode==='noindex')explicitNoindex++
    if(citySeo?.reviewed&&citySeo.index_mode!=='noindex'&&cityCount<3)underThreshold.push({...citySeo,providers:cityCount,label:'City page'})
    for(const c of cats){const n=countFor(l.id,c.id),row=seoByKey.get(`${l.id}|${c.id}`),key=`${l.id}|${c.id}`;if(n>=3){if(row?.reviewed&&row.index_mode!=='noindex')healthySeo++;else eligibleMissing.push({location:l,category:c,providers:n,demand:demand.get(key)||0,zero:zero.get(key)||0})}if(row?.index_mode==='noindex')explicitNoindex++;if(row?.reviewed&&row.index_mode!=='noindex'&&n<3)underThreshold.push({...row,providers:n,label:c.name})}
  }
  eligibleMissing.sort((a,b)=>b.demand-a.demand||b.providers-a.providers||a.location.name.localeCompare(b.location.name))
  underThreshold.sort((a,b)=>a.providers-b.providers||String(a.city||'').localeCompare(String(b.city||'')))

  const approvedLogo=new Set<string>()
  for(const raw of media.data??[]){const r=raw as any;if(r.media_type==='logo'&&(r.approval_status==='approved'||r.status==='approved'))approvedLogo.add(String(r.business_id||''))}
  const logoEnrichment=biz.filter(r=>!approvedLogo.has(r.id)).length
  const websiteEnrichment=biz.filter(r=>!String(r.website||'').trim()).length

  const qualityRows:QualityRow[]=biz.map(b=>{
    const issues:string[]=[]
    const marketCount=(physicalByBusiness.get(b.id)?.size||0)+(serviceByBusiness.get(b.id)?.size||0)
    const categoryCount=catsByBusiness.get(b.id)?.size||0
    if(!String(b.phone||'').trim())issues.push('Missing phone')
    if(String(b.description||'').trim().length<80)issues.push('Thin/missing description')
    if(!String(b.source_url||'').trim())issues.push('Missing source URL')
    if(!b.source_checked_at)issues.push('Source never checked')
    else if(String(b.source_checked_at)<staleCutoff)issues.push('Source older than 180 days')
    if(marketCount===0)issues.push('No physical location or service area')
    if(categoryCount===0)issues.push('No category')
    const severe=issues.filter(x=>['Missing source URL','Source never checked','No physical location or service area','No category'].includes(x)).length
    return {...b,issues,severity:severe*10+issues.length,marketCount,categoryCount}
  }).filter(r=>r.issues.length).sort((a,b)=>b.severity-a.severity||b.issues.length-a.issues.length||a.name.localeCompare(b.name))
  const qualityFiltered=qualityRows.filter(r=>{if(q&&!`${r.name} ${r.issues.join(' ')}`.toLowerCase().includes(q))return false;if(qualityFilter==='critical'&&!r.issues.some(x=>['Missing source URL','Source never checked','No physical location or service area','No category'].includes(x)))return false;if(qualityFilter==='contact'&&!r.issues.includes('Missing phone'))return false;return true})

  const prospectByBusiness=new Map<string,any>()
  for(const raw of prospects.data??[]){const r=raw as any,bid=String(r.business_id||'');if(!bid)continue;const existing=prospectByBusiness.get(bid),has=Boolean(r.owner_contact_email||r.owner_contact_phone),old=Boolean(existing?.owner_contact_email||existing?.owner_contact_phone);if(!existing||(has&&!old))prospectByBusiness.set(bid,r)}
  const demandForBusiness=(bid:string)=>{let n=0;const markets=new Set<string>([...(physicalByBusiness.get(bid)||[]),...(serviceByBusiness.get(bid)||[])]);for(const lid of markets)for(const cid of catsByBusiness.get(bid)||[])n+=demand.get(`${lid}|${cid}`)||0;return n}
  const acquisitionRows:AcquisitionRow[]=biz.filter(b=>!b.claimed).map(b=>{const p=prospectByBusiness.get(b.id)||{},contactable=Boolean(p.owner_contact_email||p.owner_contact_phone),d=demandForBusiness(b.id),status=String(p.status||''),stage=String(p.crm_stage||''),priority=String(p.priority||''),score=(contactable?80:25)+Math.min(d*12,84)+(priority==='hot'?25:priority==='high'?15:0)+(b.website?5:0),nextAction=contactable&&['contact_ready','published'].includes(status)?'Prepare claim invitation':contactable?'Verify contact provenance / stage':p.id?'Research decision-maker contact':'Create contact-research prospect';return {business:b,demand:d,contactable,status,stage,priority,score,nextAction}}).sort((a,b)=>b.score-a.score||b.demand-a.demand||a.business.name.localeCompare(b.business.name))
  const acquisitionFiltered=acquisitionRows.filter(r=>{if(q&&!`${r.business.name} ${r.nextAction} ${r.priority}`.toLowerCase().includes(q))return false;if(acquisitionFilter==='ready'&&!(r.contactable&&['contact_ready','published'].includes(r.status)))return false;if(acquisitionFilter==='research'&&r.contactable)return false;if(acquisitionFilter==='demand'&&r.demand===0)return false;return true})

  const today=new Date().toISOString().slice(0,10),in30=new Date(Date.now()+30*86400000).toISOString().slice(0,10)
  const activeSponsors=(sponsors.data??[]).filter((r:any)=>r.active&&(!r.starts_on||r.starts_on<=today)&&(!r.ends_on||r.ends_on>=today)) as any[]
  const activeByPlacement=new Map<string,number>(),promoByPlacement=new Map<string,number>()
  for(const r of activeSponsors){const p=String(r.placement||'unset');activeByPlacement.set(p,(activeByPlacement.get(p)||0)+1);if(r.origin==='promotional')promoByPlacement.set(p,(promoByPlacement.get(p)||0)+1)}
  const expiringSoon=activeSponsors.filter(r=>r.ends_on&&r.ends_on>=today&&r.ends_on<=in30)
  const unusedPlacements=Object.keys(placements).filter(p=>!activeByPlacement.get(p))
  const sponsorshipOpps=(growth.data??[]).filter((r:any)=>r.opportunity_type==='sponsorship') as any[]
  const claimed=biz.filter(b=>b.claimed).length
  const contactReady=acquisitionRows.filter(r=>r.contactable&&['contact_ready','published'].includes(r.status)).length
  const missingSource=qualityRows.filter(r=>r.issues.includes('Missing source URL')||r.issues.includes('Source never checked')||r.issues.includes('Source older than 180 days')).length
  const orphaned=qualityRows.filter(r=>r.issues.includes('No physical location or service area')).length
  const missingPhone=qualityRows.filter(r=>r.issues.includes('Missing phone')).length
  const activeQualityTasks=(qualityTasks.data??[]) as any[]
  const seoOneAway=activeQualityTasks.filter(r=>r.task_type==='seo_inventory'&&Number(r.source_snapshot?.current_providers||0)===2).length

  return <>
    <div className="admin-page-head"><div><div className="kpi">Private Operations Intelligence</div><h1>Growth Operations Command Center</h1><p className="muted">One operating view for SEO eligibility, listing quality, owner acquisition and Sponsored inventory. Internal workflow scores never affect public organic ranking.</p></div><div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/data-quality">Quality Queue</Link><Link className="btn btn-light" href="/admin/inventory-expansion">Market Coverage</Link><Link className="btn btn-light" href="/admin/launch-growth">Revenue Growth</Link></div></div>
    {errors.length>0&&<div className="notice warn">One or more production inputs could not be loaded. Treat affected totals as incomplete until the source query recovers.</div>}
    <div className="notice"><strong>Non-negotiable rules:</strong> paid plans and Sponsored placements never change organic rank; service areas never become fake offices; claim readiness requires a legitimate contact path; data-quality flags stay private; provider thresholds use current published inventory.</div>

    <div className="stat-grid" style={{marginTop:18}}><div className="stat">Published Businesses<strong>{biz.length}</strong><span className="small muted">{claimed} claimed</span></div><div className="stat">SEO Healthy / Eligible<strong>{healthySeo} / {eligibleMissing.length}</strong></div><div className="stat">Indexable Under Threshold<strong>{underThreshold.length}</strong></div><div className="stat">Persistent Quality Tasks<strong>{activeQualityTasks.length}</strong><span className="small muted">{seoOneAway} SEO markets one provider away</span></div><div className="stat">Acquisition Contact-Ready<strong>{contactReady}</strong></div><div className="stat">Active Sponsored Records<strong>{activeSponsors.length}</strong><span className="small muted">{expiringSoon.length} expire within 30 days</span></div><div className="stat">Unused Placement Types<strong>{unusedPlacements.length}</strong></div><div className="stat">Sponsorship Opportunities<strong>{sponsorshipOpps.length}</strong></div></div>

    <div className="admin-card" style={{marginTop:18}}><div className="section-head compact-head"><div><div className="kpi">SEO Eligibility Automation</div><h2>Inventory threshold → review queue</h2><p className="small muted">A city or city/category enters this queue only after live inventory reaches three legitimate published providers. Explicit noindex remains protected.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/seo">SEO Command Center</Link><Link className="btn btn-light" href="/admin/data-quality?type=seo_inventory">SEO Inventory Tasks</Link><Link className="btn btn-light" href="/admin/content-intelligence">Content Intelligence</Link></div></div><div className="grid grid-3"><div className="card"><div className="kpi">Eligible Missing Review</div><h2>{eligibleMissing.length}</h2></div><div className="card"><div className="kpi">Under-Threshold Indexable</div><h2>{underThreshold.length}</h2></div><div className="card"><div className="kpi">Explicit Noindex Records</div><h2>{explicitNoindex}</h2></div></div>{eligibleMissing.length?<div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Market</th><th>Page</th><th>Providers</th><th>30d Demand</th><th>Zero Results</th><th>Action</th></tr></thead><tbody>{eligibleMissing.slice(0,30).map(r=><tr key={`${r.location.id}-${r.category?.id||'city'}`}><td>{r.location.name}</td><td>{r.category?.name||'City page'}</td><td><strong>{r.providers}</strong></td><td>{r.demand}</td><td>{r.zero}</td><td><Link href="/admin/seo">Create/review SEO page</Link></td></tr>)}</tbody></table></div>:<p className="muted">No newly eligible markets are waiting for SEO review.</p>}{underThreshold.length>0&&<div className="notice warn" style={{marginTop:14}}><strong>{underThreshold.length} reviewed indexable page{underThreshold.length===1?' is':'s are'} below the three-provider threshold.</strong> Review before the next crawl/indexing pass.</div>}</div>

    <div className="admin-card" style={{marginTop:18}}><div className="section-head compact-head"><div><div className="kpi">Data Quality & Reverification</div><h2>Keep the directory trustworthy as inventory scales</h2><p className="small muted">Actionable provenance, location and reverification work now lives in a persistent queue. Missing websites and logos are optional enrichment—not quality failures.</p></div><div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/data-quality">Open Persistent Quality Queue</Link><Link className="btn btn-light" href="/admin/businesses">Business Manager</Link></div></div><div className="stat-grid"><div className="stat">Missing Phone<strong>{missingPhone}</strong></div><div className="stat">Missing / Stale Provenance<strong>{missingSource}</strong></div><div className="stat">No Location / Service Area<strong>{orphaned}</strong></div><div className="stat">Website Enrichment<strong>{websiteEnrichment}</strong><span className="small muted">Optional, not a defect</span></div><div className="stat">Logo Enrichment<strong>{logoEnrichment}</strong><span className="small muted">Optional, not a defect</span></div></div><form method="get" className="grid grid-3" style={{alignItems:'end',marginTop:14}}><label className="field"><span>Quality Filter</span><select name="quality" defaultValue={qualityFilter}><option value="">All quality flags</option><option value="critical">Critical structural/provenance</option><option value="contact">Missing phone</option></select></label><label className="field"><span>Search</span><input name="q" defaultValue={one(sp.q)} placeholder="Business or issue"/></label><div><button className="btn btn-primary" type="submit">Filter Operations</button></div></form>{qualityFiltered.length?<div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Business</th><th>Issues</th><th>Markets</th><th>Categories</th><th>Logo Enrichment</th><th>Source Age</th><th>Action</th></tr></thead><tbody>{qualityFiltered.slice(0,40).map(r=><tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.issues.slice(0,4).join(' · ')}{r.issues.length>4?` · +${r.issues.length-4} more`:''}</td><td>{r.marketCount}</td><td>{r.categoryCount}</td><td>{approvedLogo.has(r.id)?'Complete':'Optional'}</td><td>{r.source_checked_at?`${daysOld(r.source_checked_at)}d`:'Never'}</td><td><Link href={`/admin/businesses?q=${encodeURIComponent(r.name)}`}>Review listing</Link></td></tr>)}</tbody></table></div>:<p className="muted">No businesses match the selected quality filter.</p>}<p className="small muted" style={{marginTop:10}}>Persistent tasks are refreshed daily. Source-backed listing and branch facts enter reverification at 180 days unless corrected sooner.</p></div>

    <div className="admin-card" style={{marginTop:18}}><div className="section-head compact-head"><div><div className="kpi">Owner Acquisition Workbench</div><h2>Published → contact research → claim-ready</h2><p className="small muted">Claim invitations should be sent only after a legitimate owner/decision-maker contact channel is researched and stored with provenance.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/acquisition-research">Acquisition Research</Link><Link className="btn btn-light" href="/admin/prospects">Sales CRM</Link><Link className="btn btn-light" href="/admin/outreach">Outreach Tasks</Link></div></div><form method="get" className="grid grid-3" style={{alignItems:'end'}}><label className="field"><span>Acquisition Filter</span><select name="acquisition" defaultValue={acquisitionFilter}><option value="">All unclaimed businesses</option><option value="ready">Claim-ready contact path</option><option value="research">Contact research needed</option><option value="demand">Businesses in searched markets</option></select></label><label className="field"><span>Search</span><input name="q" defaultValue={one(sp.q)} placeholder="Business, priority or next action"/></label><div><button className="btn btn-primary" type="submit">Filter Acquisition</button></div></form>{acquisitionFiltered.length?<div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Score</th><th>Business</th><th>Demand</th><th>Contact Path</th><th>CRM</th><th>Priority</th><th>Next Action</th></tr></thead><tbody>{acquisitionFiltered.slice(0,50).map(r=><tr key={r.business.id}><td><strong>{r.score}</strong></td><td>{r.business.name}</td><td>{r.demand}</td><td>{r.contactable?'Available':'Research needed'}</td><td>{r.status||'No linked prospect'}<div className="small muted">{r.stage||'—'}</div></td><td>{r.priority||'—'}</td><td>{r.nextAction}</td></tr>)}</tbody></table></div>:<p className="muted">No unclaimed businesses match the selected acquisition filter.</p>}<div className="notice" style={{marginTop:14}}><strong>Stage integrity:</strong> recommendations do not set contacted, claim-invite or claimed timestamps and do not infer owner identity from a generic business phone or inbox.</div></div>

    <div className="admin-card" style={{marginTop:18}}><div className="section-head compact-head"><div><div className="kpi">Sponsored Inventory Board</div><h2>Paid visibility without paid organic ranking</h2><p className="small muted">Shows active placement types, promotional origin and expirations. Sponsored records affect only labeled advertising surfaces.</p></div><Link className="btn btn-primary" href="/admin/sponsorships">Manage Sponsored Placement</Link></div><div className="grid grid-3">{Object.keys(placements).map(p=><div className="card" key={p}><div className="kpi">{activeByPlacement.get(p)?'In use':'No active placement'}</div><h3>{placements[p]}</h3><p className="small muted">{activeByPlacement.get(p)||0} active · {promoByPlacement.get(p)||0} promotional</p></div>)}</div><div className="grid grid-3" style={{marginTop:14}}><div className="card"><div className="kpi">Unused Placement Types</div><h2>{unusedPlacements.length}</h2><p className="small muted">No active record today; not an invented capacity claim.</p></div><div className="card"><div className="kpi">Expiring in 30 Days</div><h2>{expiringSoon.length}</h2></div><div className="card"><div className="kpi">Open Sponsorship Opportunities</div><h2>{sponsorshipOpps.length}</h2></div></div>{activeSponsors.length?<div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Placement</th><th>Origin</th><th>Starts</th><th>Ends</th><th>Priority</th><th>Rotation</th><th>Page</th></tr></thead><tbody>{activeSponsors.slice(0,40).map(r=><tr key={r.id}><td>{placements[r.placement]||titleCase(String(r.placement||'unset'))}</td><td>{titleCase(String(r.origin||'manual'))}</td><td>{r.starts_on||'Open'}</td><td>{r.ends_on||'Open'}</td><td>{r.priority??'—'}</td><td>{r.rotation_weight??'—'}</td><td>{r.page_path||'Placement default'}</td></tr>)}</tbody></table></div>:<p className="muted">No active Sponsored records are currently live.</p>}</div>

    <div className="grid grid-4" style={{marginTop:18}}><Link className="admin-card admin-quick-card" href="/admin/data-quality"><strong>Data Quality Queue</strong><p className="small muted">Work provenance, reverification and closest SEO inventory gaps.</p><span className="kpi">Open →</span></Link><Link className="admin-card admin-quick-card" href="/admin/inventory-expansion"><strong>Inventory Coverage</strong><p className="small muted">Find 0/1/2-provider gaps and fastest legitimate threshold unlocks.</p><span className="kpi">Open →</span></Link><Link className="admin-card admin-quick-card" href="/admin/growth-opportunities"><strong>Growth Queue</strong><p className="small muted">Assign and work persistent internal opportunities.</p><span className="kpi">Open →</span></Link><Link className="admin-card admin-quick-card" href="/admin/revenue-intelligence"><strong>Revenue Intelligence</strong><p className="small muted">Review measured plan, lead and receivables performance.</p><span className="kpi">Open →</span></Link></div>
  </>
}
