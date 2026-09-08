import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export const dynamic='force-dynamic'
type Row=Record<string,any>
const related=(v:any)=>Array.isArray(v)?v[0]:v
const pct=(n:number,d:number)=>d?`${Math.round(n/d*1000)/10}%`:'—'
const add=(map:Map<string,number>,key:unknown)=>{const k=String(key??'').trim();if(k)map.set(k,(map.get(k)||0)+1)}
const top=(map:Map<string,number>,limit=8)=>[...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit)

export default async function Page(){
  const s=await createClient(),sinceDate=new Date(Date.now()-30*86400000),since=sinceDate.toISOString(),sinceDay=since.slice(0,10)
  const[eventsResult,listingResult,searchResult,claimsResult,submissionsResult,leadsResult,promosResult]=await Promise.all([
    s.from('analytics_events').select('event_type,page_path,business_id,city,category,metadata,occurred_at').eq('tenant_id',TENANT_ID).gte('occurred_at',since).order('occurred_at',{ascending:false}).limit(10000),
    s.from('listing_events').select('business_id,event_type,created_at,businesses!inner(id,name,slug,tenant_id)').eq('tenant_id',TENANT_ID).eq('businesses.tenant_id',TENANT_ID).gte('created_at',since).order('created_at',{ascending:false}).limit(10000),
    s.from('search_events').select('service,location,result_count,created_at').eq('tenant_id',TENANT_ID).gte('created_at',since).order('created_at',{ascending:false}).limit(5000),
    s.from('business_claims').select('id,businesses!inner(tenant_id)',{count:'exact',head:true}).eq('businesses.tenant_id',TENANT_ID).gte('created_at',since),
    s.from('business_submissions').select('id',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).gte('created_at',since),
    s.from('leads').select('id',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).gte('created_at',since),
    s.from('sponsorships').select('id,promo_text,placement,businesses(name,slug)').eq('tenant_id',TENANT_ID).eq('placement','homepage_ticker').order('created_at',{ascending:false}).limit(150),
  ])
  const events=(eventsResult.data??[]) as Row[],listing=(listingResult.data??[]) as Row[],searches=(searchResult.data??[]) as Row[]
  const count=(type:string)=>events.reduce((n,x)=>n+(x.event_type===type?1:0),0)
  const pageViews=count('public_page_view'),dealImpressions=count('deal_banner_impression'),dealClicks=count('deal_banner_click'),projectStarts=count('project_match_start'),projectComplete=count('project_match_complete'),estateStarts=count('estate_form_start'),estateComplete=count('estate_form_complete'),guideConsultClicks=count('estate_guide_consultation_click')
  const profileViews=listing.reduce((n,x)=>n+(x.event_type==='profile_view'?1:0),0),contactActions=listing.reduce((n,x)=>n+(['phone_click','website_click','directions_click'].includes(x.event_type)?1:0),0)
  const pageMap=new Map<string,number>(),locationMap=new Map<string,number>(),serviceMap=new Map<string,number>(),guideMap=new Map<string,number>(),dealImpressionMap=new Map<string,number>(),dealClickMap=new Map<string,number>(),businessMap=new Map<string,{name:string;slug:string;views:number;actions:number}>()
  for(const e of events){if(e.event_type==='public_page_view')add(pageMap,e.page_path);const campaign=String(e.metadata?.campaign_id||'').trim();if(e.event_type==='estate_guide_consultation_click')add(guideMap,campaign);if(e.event_type==='deal_banner_impression')add(dealImpressionMap,campaign);if(e.event_type==='deal_banner_click')add(dealClickMap,campaign)}
  for(const q of searches){add(locationMap,q.location);add(serviceMap,q.service)}
  for(const r of listing){const b=related(r.businesses);if(!b?.name)continue;const id=String(r.business_id),x=businessMap.get(id)??{name:String(b.name),slug:String(b.slug||''),views:0,actions:0};if(r.event_type==='profile_view')x.views++;if(['phone_click','website_click','directions_click'].includes(r.event_type))x.actions++;businessMap.set(id,x)}
  const promoById=new Map<string,{text:string;business:string}>();for(const p of promosResult.data??[]){const b=related((p as any).businesses);promoById.set(String((p as any).id),{text:String((p as any).promo_text||'Promotion'),business:String(b?.name||'Local business')})}
  const dealIds=[...new Set([...dealImpressionMap.keys(),...dealClickMap.keys()])].filter(Boolean).sort((a,b)=>(dealClicks?dealClickMap.get(b)||0:dealImpressionMap.get(b)||0)-(dealClicks?dealClickMap.get(a)||0:dealImpressionMap.get(a)||0)).slice(0,8)
  const businessLeaders=[...businessMap.values()].sort((a,b)=>(b.views+b.actions)-(a.views+a.actions)).slice(0,8)
  const errors=[eventsResult.error&&`Site events: ${eventsResult.error.message}`,listingResult.error&&`Listing activity: ${listingResult.error.message}`,searchResult.error&&`Search activity: ${searchResult.error.message}`,claimsResult.error&&`Claims: ${claimsResult.error.message}`,submissionsResult.error&&`Submissions: ${submissionsResult.error.message}`,leadsResult.error&&`Leads: ${leadsResult.error.message}`,promosResult.error&&`Deals: ${promosResult.error.message}`].filter(Boolean) as string[]

  return <>
    <div className="admin-page-head"><div><div className="kpi">First-Party Measurement</div><h1>What’s Working</h1><p className="muted">A simple 30-day view of real Local Pros usage and conversions. Counts come from first-party site events and existing lead/listing records; no traffic, ranking, lead, or conversion numbers are estimated.</p></div><span className="badge neutral">Last 30 days</span></div>
    {errors.length>0&&<div className="notice warn"><strong>Some measurements could not be loaded.</strong><ul>{errors.map(x=><li key={x}>{x}</li>)}</ul></div>}

    <div className="stat-grid">
      <div className="stat">Public Page Views<strong>{pageViews}</strong></div>
      <div className="stat">Business Profile Views<strong>{profileViews}</strong></div>
      <div className="stat">Business Contact Actions<strong>{contactActions}</strong></div>
      <div className="stat">Leads Created<strong>{leadsResult.count??0}</strong></div>
      <div className="stat">Claims Submitted<strong>{claimsResult.count??0}</strong></div>
      <div className="stat">Business Submissions<strong>{submissionsResult.count??0}</strong></div>
    </div>

    <div className="admin-section-title admin-section-title-spaced"><div><div className="kpi">Conversion Paths</div><h2>Are visitors taking the next step?</h2></div><p>Rates appear only when the measured denominator exists.</p></div>
    <div className="grid grid-3">
      <section className="card"><div className="kpi">Sitewide Deal Banner</div><h3>{dealClicks} click{dealClicks===1?'':'s'} from {dealImpressions} impression{dealImpressions===1?'':'s'}</h3><div className="info-row"><span>Click-through rate</span><strong>{pct(dealClicks,dealImpressions)}</strong></div><p className="muted">Each active paid promotion is measured separately. Sponsored clicks never affect organic rank.</p><Link href="/admin/sponsorships">Manage promotions →</Link></section>
      <section className="card"><div className="kpi">Get Quotes / Project Match</div><h3>{projectComplete} completed request{projectComplete===1?'':'s'}</h3><div className="info-row"><span>Form starts</span><strong>{projectStarts}</strong></div><div className="info-row"><span>Start → completion</span><strong>{pct(projectComplete,projectStarts)}</strong></div><Link href="/admin/leads">Review consumer leads →</Link></section>
      <section className="card"><div className="kpi">Estate Planning</div><h3>{estateComplete} completed consultation request{estateComplete===1?'':'s'}</h3><div className="info-row"><span>Form starts</span><strong>{estateStarts}</strong></div><div className="info-row"><span>Start → completion</span><strong>{pct(estateComplete,estateStarts)}</strong></div><div className="info-row"><span>Guide → consultation clicks</span><strong>{guideConsultClicks}</strong></div><Link href="/admin/estate-planning-performance">Open appointment funnel →</Link></section>
    </div>

    <div className="grid grid-2" style={{marginTop:18}}>
      <section className="admin-card"><div className="section-head compact-head"><div><div className="kpi">Traffic</div><h2>Top Public Pages</h2></div><span className="badge neutral">Measured views</span></div>{top(pageMap).length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>{top(pageMap).map(([path,n])=><tr key={path}><td><Link href={path} target="_blank">{path}</Link></td><td>{n}</td></tr>)}</tbody></table></div>:<p className="muted">Page-view measurement will populate as real visitors browse after this release.</p>}</section>
      <section className="admin-card"><div className="section-head compact-head"><div><div className="kpi">Directory Discovery</div><h2>Top Searches</h2></div><Link href="/admin/search">Search Intelligence →</Link></div><div className="grid grid-2"><div><h3>Locations</h3>{top(locationMap,6).length?top(locationMap,6).map(([name,n])=><div className="info-row" key={name}><span>{name}</span><strong>{n}</strong></div>):<p className="muted">No measured location searches yet.</p>}</div><div><h3>Services</h3>{top(serviceMap,6).length?top(serviceMap,6).map(([name,n])=><div className="info-row" key={name}><span>{name}</span><strong>{n}</strong></div>):<p className="muted">No measured service searches yet.</p>}</div></div></section>
    </div>

    <div className="grid grid-2" style={{marginTop:18}}>
      <section className="admin-card"><div className="section-head compact-head"><div><div className="kpi">Local Deals</div><h2>Promotion Performance</h2></div><span className="badge sponsored">Sponsored</span></div>{dealIds.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Promotion</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>{dealIds.map(id=>{const p=promoById.get(id),imp=dealImpressionMap.get(id)||0,clicks=dealClickMap.get(id)||0;return <tr key={id}><td><strong>{p?.business||'Promotion'}</strong><br/><span className="muted">{p?.text||id}</span></td><td>{imp}</td><td>{clicks}</td><td>{pct(clicks,imp)}</td></tr>})}</tbody></table></div>:<p className="muted">Deal performance begins accumulating from real sitewide banner traffic after this release.</p>}</section>
      <section className="admin-card"><div className="section-head compact-head"><div><div className="kpi">Business Profiles</div><h2>Most Active Profiles</h2></div><Link href="/admin/analytics">Full listing analytics →</Link></div>{businessLeaders.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Business</th><th>Views</th><th>Actions</th></tr></thead><tbody>{businessLeaders.map(x=><tr key={x.slug||x.name}><td>{x.slug?<Link href={`/business/${x.slug}`} target="_blank">{x.name}</Link>:x.name}</td><td>{x.views}</td><td>{x.actions}</td></tr>)}</tbody></table></div>:<p className="muted">No business-profile interaction data in this 30-day window.</p>}</section>
    </div>

    {top(guideMap,6).length>0&&<section className="admin-card" style={{marginTop:18}}><div className="section-head compact-head"><div><div className="kpi">Estate Planning Content</div><h2>Guides Driving Consultation Clicks</h2></div><Link href="/estate-planning/guides" target="_blank">Open guide hub →</Link></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Guide</th><th>Consultation clicks</th></tr></thead><tbody>{top(guideMap,6).map(([slug,n])=><tr key={slug}><td><Link href={`/estate-planning/guides/${slug}`} target="_blank">{slug}</Link></td><td>{n}</td></tr>)}</tbody></table></div></section>}

    <div className="notice" style={{marginTop:18}}><strong>Measurement note:</strong> new page-view, deal-banner and form-start tracking begins with this release. Historical rows are not backfilled or invented, so early rates may show “—” until enough real traffic is recorded. Window begins {sinceDay}.</div>
  </>
}
