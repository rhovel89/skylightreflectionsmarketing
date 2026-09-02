import Link from 'next/link'
import { getOwnerData } from '@/lib/owner'

export const dynamic='force-dynamic'
function related(value:any){return Array.isArray(value)?value[0]:value}
function money(cents:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format((cents||0)/100)}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const sp=await searchParams
  const {businesses,s}=await getOwnerData('/business-portal/growth')
  if(!businesses.length)return <div className="card empty-rich"><h2>Claim a business first</h2><p className="muted">Growth tools become available after staff approves a legitimate ownership claim.</p><Link className="btn btn-primary" href="/search">Find My Listing</Link></div>
  const requested=typeof sp.business==='string'?sp.business:''
  const b=businesses.find((x:any)=>x.id===requested)??businesses[0]
  const switcher=businesses.length>1?<form className="portal-switcher" action="/business-portal/growth" method="get"><label>Managing<select name="business" defaultValue={b.id}>{businesses.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="btn btn-light" type="submit">Switch Business</button></form>:<div className="portal-current"><span>Managing</span><strong>{b.name}</strong></div>
  const [catsQ,subsQ,sponsorsQ,offersQ,plansQ]=await Promise.all([
    s.from('business_categories').select('categories(name,vertical)').eq('business_id',b.id),
    s.from('subscriptions').select('id,status,billing_interval,plans(name,slug,monthly_price_cents,annual_price_cents)').eq('business_id',b.id).order('updated_at',{ascending:false}).limit(5),
    s.from('sponsorships').select('id,placement,active,starts_on,ends_on').eq('business_id',b.id).eq('active',true).limit(20),
    s.from('lead_marketplace_offers').select('id,status,price_cents,leads(service,city)').eq('business_id',b.id).in('status',['offered','reserved','checkout_pending','delivered']).order('offered_at',{ascending:false}).limit(20),
    s.from('plans').select('id,slug,name,monthly_price_cents,annual_price_cents').eq('is_active',true).order('sort_order'),
  ])
  const verticals=new Set((catsQ.data??[]).map((x:any)=>related(x.categories)?.vertical).filter(Boolean)),isHome=verticals.has('home'),isLegal=verticals.has('legal')&&!isHome
  const subscription=(subsQ.data??[]).find((x:any)=>['active','trialing','past_due'].includes(x.status)),plan=subscription?related((subscription as any).plans):null,activeSponsors=(sponsorsQ.data??[]) as any[],offers=(offersQ.data??[]) as any[],openOffers=offers.filter(x=>['offered','reserved','checkout_pending'].includes(x.status)),delivered=offers.filter(x=>x.status==='delivered')
  return <div>{switcher}
    <div className="portal-section-head"><div><div className="kpi">Business Growth</div><h2>Growth Center — {b.name}</h2><p className="muted">Choose the growth products that fit your business. Directory plans, Sponsored visibility, lead purchases and Skylight marketing services are separate products.</p></div><Link className="btn btn-light" href={`/business/${b.slug}`}>View Public Profile</Link></div>
    <div className="grid grid-2">
      <div className="card"><div className="kpi">1 · Directory Plan</div><h3>{plan?.name||'Free Listing'}</h3><p className="muted">{plan?`${subscription?.status} · ${subscription?.billing_interval||'billing cadence pending'}`:'Your business can remain organically listed without a paid subscription.'}</p>{plan&&<p className="small muted">Catalog price: {money(plan.monthly_price_cents)}/mo{plan.annual_price_cents?` · ${money(plan.annual_price_cents)}/yr`:''}</p>}<Link className="btn btn-primary" href={`/business-portal/subscription?business=${b.id}`}>Manage Plan Options</Link></div>
      <div className="card"><div className="kpi">2 · Featured Advertising</div><h3>{activeSponsors.length?`${activeSponsors.length} active Sponsored placement${activeSponsors.length===1?'':'s'}`:'Increase labeled visibility'}</h3><p className="muted">Featured and Sponsored placement is visibly labeled and stays separate from organic ranking, verification and editorial trust.</p><Link className="btn btn-primary" href="/for-businesses#plans">Explore Visibility Options</Link></div>
      <div className="card"><div className="kpi">3 · Qualified Leads</div><h3>{isHome?'Home-Service Lead Marketplace':isLegal?'Legal lead sales are restricted':'Lead marketplace not enabled for this category'}</h3>{isHome?<><p className="muted">You have {openOffers.length} current paid lead offer{openOffers.length===1?'':'s'} and {delivered.length} delivered lead{delivered.length===1?'':'s'} in your marketplace history.</p><Link className="btn btn-primary" href={`/business-portal/lead-marketplace?business=${b.id}`}>View Lead Marketplace</Link></>:isLegal?<p className="muted">Per-lead sales are not automatically enabled for legal businesses. Directory plans and flat Sponsored advertising remain available subject to applicable professional-conduct rules.</p>:<p className="muted">General restaurant and retail discovery is monetized through directory visibility rather than ordinary pay-per-lead. Specific high-intent categories may be added later after review.</p>}</div>
      <div className="card"><div className="kpi">4 · Skylight Marketing Services</div><h3>Need a bigger growth push?</h3><p className="muted">Skylight Reflections Marketing can separately help with websites, local SEO, Google Business Profile, social media, branding and lead generation. This service relationship is independent from directory ranking.</p><Link className="btn btn-primary" href={`/contact?reason=marketing-review&plan=marketing_review&source=business-growth&business=${encodeURIComponent(b.name)}#marketing-review`}>Request a Free Visibility Review</Link></div>
    </div>
    <div className="notice" style={{marginTop:18}}><strong>No forced bundle:</strong> you can use one, several or none of these paid products. Purchasing one never secretly changes your standing in another.</div>
  </div>
}
