import Link from 'next/link'
import { getOwnerData } from '@/lib/owner'
import { PricingGrid } from '@/components/PricingGrid'
import { getPublicConfig } from '@/lib/data'

export const dynamic='force-dynamic'
function related(value:any){return Array.isArray(value)?value[0]:value}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const sp=await searchParams
  const [{businesses,s},cfg]=await Promise.all([getOwnerData('/business-portal/subscription'),getPublicConfig()])
  if(!businesses.length)return <div className="card empty-rich"><h2>Claim a business first</h2><p className="muted">Subscription tools become available after staff approves a legitimate ownership claim.</p><Link className="btn btn-primary" href="/search">Find My Listing</Link></div>
  const requested=typeof sp.business==='string'?sp.business:''
  const b=businesses.find((x:any)=>x.id===requested)??businesses[0]
  const switcher=businesses.length>1?<form className="portal-switcher" action="/business-portal/subscription" method="get"><label>Managing<select name="business" defaultValue={b.id}>{businesses.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="btn btn-light" type="submit">Switch Business</button></form>:<div className="portal-current"><span>Managing</span><strong>{b.name}</strong></div>
  const{data}=await s.from('subscriptions').select('id,status,billing_interval,current_period_end,provider_subscription_id,plans(name,slug,monthly_price_cents,annual_price_cents)').eq('business_id',b.id).order('updated_at',{ascending:false}).limit(10)
  const current=(data??[]).find((x:any)=>['active','trialing','past_due'].includes(x.status)) as any
  const plan=current?related(current.plans):null
  return <div>{switcher}<div className="portal-section-head"><div><div className="kpi">Plan Management</div><h2>Subscription — {b.name}</h2><p className="muted">Directory plans are optional. Payment never automatically creates a Verified badge or changes organic rank.</p></div><Link className="btn btn-light" href={`/business-portal/growth?business=${b.id}`}>Growth Center</Link></div>
    {current?<div className="card" style={{marginBottom:18}}><div className="badges"><span className="badge neutral">{current.status}</span>{current.billing_interval&&<span className="badge neutral">{current.billing_interval}</span>}</div><h3>{plan?.name||'Paid Directory Plan'}</h3><p className="muted">Your Stripe-backed subscription state is synchronized through the directory billing workflow. Verification remains a separate staff-reviewed trust state.</p>{current.current_period_end&&<p className="small muted">Current period ends: {new Date(current.current_period_end).toLocaleDateString()}</p>}</div>:<div className="card" style={{marginBottom:18}}><h3>Free / no active paid subscription</h3><p className="muted">Your business can remain eligible for normal organic directory inclusion without paying for a plan.</p></div>}
    <div className="section-head compact-head"><div><div className="kpi">Optional upgrades</div><h2>Current Public Plans</h2><p className="muted">These are the same live plan options shown publicly. Checkout is handled through the configured Stripe payment links.</p></div></div><PricingGrid plans={cfg.plans??[]}/>
    <div className="notice" style={{marginTop:18}}><strong>Separate products:</strong> Featured advertising, paid home-service leads and Skylight Reflections Marketing services are managed independently from your directory subscription.</div>
  </div>
}
