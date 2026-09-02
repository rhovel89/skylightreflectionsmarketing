import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function related(value:any){return Array.isArray(value)?value[0]:value}
function money(cents:number){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format((cents||0)/100)}
function date(value:string|null|undefined){if(!value)return '—';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value))}

export default async function RevenuePage(){
  await requireAdmin('/admin/revenue')
  const s=await createClient()
  const [subsQ,sponsorsQ,plansQ,hooksQ]=await Promise.all([
    s.from('subscriptions').select('id,business_id,plan_id,provider,status,billing_interval,current_period_end,starts_at,ends_at,updated_at,businesses(name,slug),plans(name,slug,monthly_price_cents,annual_price_cents)').eq('tenant_id',TENANT_ID).order('updated_at',{ascending:false}).limit(100),
    s.from('sponsorships').select('id,business_id,placement,starts_on,ends_on,active,provider,provider_subscription_id,created_at,businesses(name,slug)').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(100),
    s.from('plans').select('id,slug,name,monthly_price_cents,annual_price_cents,is_active').eq('tenant_id',TENANT_ID).eq('is_active',true).order('sort_order',{ascending:true}),
    s.from('stripe_webhook_events').select('event_id,event_type,status,received_at,processed_at').eq('tenant_id',TENANT_ID).order('received_at',{ascending:false}).limit(25),
  ])
  const subscriptions=(subsQ.data??[]) as any[]
  const sponsorships=(sponsorsQ.data??[]) as any[]
  const plans=(plansQ.data??[]) as any[]
  const hooks=(hooksQ.data??[]) as any[]
  const active=subscriptions.filter(r=>['active','trialing'].includes(r.status))
  const pastDue=subscriptions.filter(r=>r.status==='past_due')
  const today=new Date().toISOString().slice(0,10)
  const homepage=sponsorships.filter(r=>r.active&&r.placement==='homepage_featured'&&(!r.starts_on||r.starts_on<=today)&&(!r.ends_on||r.ends_on>=today))
  const reviewHooks=hooks.filter(r=>['needs_review','error'].includes(r.status))
  const unknownCadence=active.filter(r=>!r.billing_interval).length
  const monthlyEquivalent=active.reduce((sum,row)=>{
    const p=related(row.plans)||{}
    return sum+(row.billing_interval==='annual'?Math.round((p.annual_price_cents||0)/12):(p.monthly_price_cents||0))
  },0)
  const planMix=new Map<string,number>()
  for(const row of active){const p=related(row.plans);const key=p?.name||'Unassigned';planMix.set(key,(planMix.get(key)||0)+1)}

  return <>
    <div className="admin-page-head"><div><div className="kpi">Private Revenue Operations</div><h1>Revenue & Featured Placement</h1><p className="muted">Manage recurring directory plans, paid homepage visibility and billing health without mixing sponsorship into organic relevance or verification.</p></div><span className="badge sponsored">Admin only</span></div>

    <div className="stat-grid">
      <div className="stat">Active Subscriptions<strong>{active.length}</strong></div>
      <div className="stat">Monthly-Equivalent Value<strong>{money(monthlyEquivalent)}</strong></div>
      <div className="stat">Homepage Featured<strong>{homepage.length}</strong></div>
      <div className="stat">Billing Attention<strong>{pastDue.length+reviewHooks.length}</strong></div>
    </div>

    <div className="admin-card" style={{marginTop:18}}>
      <div className="kpi">Stripe + Directory State</div><h2>Checkout is live; subscription state stays auditable</h2>
      <p className="muted">The subscription-sync endpoint is deployed and idempotent. Live Stripe webhook endpoint registration still requires completion in Stripe, so staff should confirm new payments and activate sponsorships from the protected controls until automatic delivery is registered.</p>
      {unknownCadence>0&&<p className="small muted"><strong>{unknownCadence}</strong> active subscription{unknownCadence===1?'':'s'} do not yet have a stored billing cadence. Their dashboard value uses the plan monthly price until Stripe sync supplies monthly or annual cadence.</p>}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}><Link className="btn btn-primary" href="/admin/sponsorships">Manage Featured Placements</Link><Link className="btn btn-light" href="/admin/subscriptions">Subscription Manager</Link><Link className="btn btn-light" href="/admin/pricing">Pricing & Plans</Link></div>
    </div>

    <div className="section-head admin-quick-head"><div><h2>Active Plan Mix</h2><p className="muted">Current active/trialing subscription assignments. Monthly-equivalent value normalizes annual plans to one-twelfth of annual catalog price.</p></div></div>
    <div className="grid grid-4 admin-quick-grid">{plans.map((p:any)=><div className="admin-card" key={p.id}><div className="kpi">{p.slug}</div><strong>{p.name}</strong><p className="small muted">{money(p.monthly_price_cents)}/mo · {money(p.annual_price_cents)}/yr</p><span className="badge neutral">{planMix.get(p.name)||0} active</span></div>)}</div>

    <div className="section-head admin-quick-head"><div><h2>Recent Subscriptions</h2><p className="muted">Provider state is billing state only. It never grants a Verified badge by itself.</p></div><Link href="/admin/subscriptions">Open manager →</Link></div>
    <div className="admin-card" style={{overflowX:'auto'}}>{subscriptions.length===0?<p className="muted">No paid subscriptions yet.</p>:subscriptions.slice(0,20).map((row:any)=>{const b=related(row.businesses);const p=related(row.plans);return <div key={row.id} style={{display:'grid',gridTemplateColumns:'minmax(180px,2fr) minmax(120px,1fr) minmax(100px,1fr) minmax(110px,1fr) minmax(130px,1fr)',gap:12,padding:'12px 0',borderBottom:'1px solid rgba(127,127,127,.2)',alignItems:'center'}}><div><strong>{b?.name||'Business'}</strong><div className="small muted">{row.provider||'manual'}</div></div><div>{p?.name||'Unassigned'}</div><div><span className="badge neutral">{row.status}</span></div><div>{row.billing_interval||'cadence pending'}</div><div className="small muted">Renews/ends {date(row.current_period_end||row.ends_at)}</div></div>})}</div>

    <div className="section-head admin-quick-head"><div><h2>Homepage Featured Placements</h2><p className="muted">Only active, in-date <code>homepage_featured</code> sponsorships appear in the paid homepage section.</p></div><Link href="/admin/sponsorships">Manage sponsorships →</Link></div>
    <div className="admin-card">{homepage.length===0?<p className="muted">No active homepage advertisers yet. The public homepage shows the paid-placement sales card until the first sponsorship activates.</p>:homepage.map((row:any)=>{const b=related(row.businesses);return <div key={row.id} style={{display:'flex',justifyContent:'space-between',gap:14,padding:'12px 0',borderBottom:'1px solid rgba(127,127,127,.2)',alignItems:'center',flexWrap:'wrap'}}><div><strong>{b?.name||'Business'}</strong><div className="small muted">{row.provider||'manual'} · starts {date(row.starts_on)}</div></div><div><span className="badge sponsored">Sponsored</span> <span className="small muted">{row.ends_on?`through ${date(row.ends_on)}`:'ongoing'}</span></div></div>})}</div>

    <div className="section-head admin-quick-head"><div><h2>Billing Health</h2><p className="muted">Recent webhook processing visibility is private to admins.</p></div></div>
    <div className="grid grid-4 admin-quick-grid">
      <div className="admin-card"><strong>{pastDue.length}</strong><p className="small muted">Past-due subscriptions</p></div>
      <div className="admin-card"><strong>{reviewHooks.length}</strong><p className="small muted">Recent webhook events needing review</p></div>
      <div className="admin-card"><strong>{hooks.filter(r=>r.status==='processed').length}</strong><p className="small muted">Processed events in recent ledger</p></div>
      <Link className="admin-card admin-quick-card" href="/admin/prospects"><strong>Sales CRM</strong><p className="small muted">Move published businesses from claim outreach into paid plan conversations.</p><span className="kpi">Open →</span></Link>
    </div>
    <div style={{marginTop:12}}><Link className="btn btn-light" href="/admin/outreach">Open Outreach Queue</Link></div>
  </>
}
