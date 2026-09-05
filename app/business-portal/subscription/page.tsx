import Link from 'next/link'
import { getOwnerData } from '@/lib/owner'
import { getBusinessPlanAccess } from '@/lib/business-plan'
import { PricingGrid } from '@/components/PricingGrid'
import { getPublicConfig } from '@/lib/data'

export const dynamic = 'force-dynamic'
function related(value: any) { return Array.isArray(value) ? value[0] : value }
const sourceLabel = (source: string) => ({ admin_trial: 'Admin Trial', admin_complimentary: 'Permanent Complimentary', paid_subscription: 'Paid Subscription', free: 'Free' } as Record<string, string>)[source] || source.replaceAll('_', ' ')
const d = (value: any) => value ? new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString() : '—'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const [{ businesses, s }, cfg] = await Promise.all([getOwnerData('/business-portal/subscription'), getPublicConfig()])
  if (!businesses.length) return <div className="card empty-rich"><h2>Claim a business first</h2><p className="muted">Subscription tools become available after staff approves a legitimate ownership claim.</p><Link className="btn btn-primary" href="/search">Find My Listing</Link></div>

  const requested = typeof sp.business === 'string' ? sp.business : ''
  const b = businesses.find((x: any) => x.id === requested) ?? businesses[0]
  const switcher = businesses.length > 1
    ? <form className="portal-switcher" action="/business-portal/subscription" method="get"><label>Managing<select name="business" defaultValue={b.id}>{businesses.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="btn btn-light" type="submit">Switch Business</button></form>
    : <div className="portal-current"><span>Managing</span><strong>{b.name}</strong></div>

  const [{ data }, { data: leadAccess }, access] = await Promise.all([
    s.from('subscriptions').select('id,status,billing_interval,current_period_end,ends_at,provider_subscription_id,plans(name,slug,monthly_price_cents,annual_price_cents,entitlements)').eq('business_id', b.id).order('updated_at', { ascending: false }).limit(10),
    s.rpc('get_business_lead_access', { p_business_id: b.id }),
    getBusinessPlanAccess(s, b.id),
  ])
  const current = (data ?? []).find((x: any) => ['active', 'trialing', 'past_due'].includes(x.status) && (!x.ends_at || new Date(x.ends_at).getTime() > Date.now())) as any
  const paidPlan = current ? related(current.plans) : null
  const entitlements = access.effective_entitlements ?? {}
  const galleryLimit = Math.max(0, Number(entitlements.max_gallery_images ?? 0) || 0)
  const menuUpload = Boolean(entitlements.menu_upload)
  const lead = (leadAccess ?? {}) as any
  const complimentary = ['admin_trial', 'admin_complimentary'].includes(access.access_source)
  const grantExists = Boolean(access.grant_id)

  return <div>
    {switcher}
    <div className="portal-section-head"><div><div className="kpi">Plan Management</div><h2>Subscription — {b.name}</h2><p className="muted">Directory plans are optional. Payment or complimentary plan access never automatically creates a Verified badge or changes organic rank.</p></div><Link className="btn btn-light" href={`/business-portal/growth?business=${b.id}`}>Growth Center</Link></div>

    <div className="grid grid-2" style={{ marginBottom: 18 }}>
      <div className="card">
        <div className="badges"><span className="badge sponsored">{access.effective_plan_name}</span><span className="badge neutral">{sourceLabel(access.access_source)}</span></div>
        <h3>Current Feature Access</h3>
        <p className="muted">This is the plan currently controlling your directory features. Billing and plan access are tracked separately so an admin trial never looks like a payment.</p>
        {complimentary && access.grant_kind === 'trial' ? <div className="notice success"><strong>Complimentary {access.grant_plan_name || access.effective_plan_name} trial.</strong> {d(access.grant_starts_on)} through {d(access.grant_ends_on)}. After the trial, access automatically returns to <strong>{access.base_plan_name}</strong> unless you subscribe to another plan.</div> : null}
        {complimentary && access.grant_kind === 'permanent' ? <div className="notice success"><strong>Permanent complimentary {access.grant_plan_name || access.effective_plan_name} access.</strong> There is no scheduled charge or end date. An administrator can change or revoke this access later.</div> : null}
        {access.grant_state === 'scheduled' ? <div className="notice"><strong>{access.grant_plan_name} complimentary access is scheduled.</strong> It begins {d(access.grant_starts_on)}. Until then your effective plan remains {access.base_plan_name}.</div> : null}
        {access.grant_state === 'expired' ? <div className="notice"><strong>Your complimentary trial has ended.</strong> Your feature access has already returned to {access.base_plan_name}.</div> : null}
        {grantExists && access.grant_state === 'active' && !access.grant_applied ? <div className="notice"><strong>A complimentary grant is on file,</strong> but your underlying {access.base_plan_name} plan already provides equal or higher access, so it is not reducing your features.</div> : null}
        {galleryLimit > 0 ? <div className="notice success" style={{ marginTop: 12 }}><strong>Media included:</strong> up to {galleryLimit} showcase photos{menuUpload ? ' plus restaurant menu upload for restaurant listings' : ''}. Menu files do not count against the photo limit.</div> : <div className="notice" style={{ marginTop: 12 }}><strong>Media:</strong> logo and cover-image tools are available for claimed listings. Featured adds 5 showcase photos; Pro adds 10.</div>}
        {lead.plan_slug === 'pro' ? <div className="notice success" style={{ marginTop: 12 }}><strong>Lead Inbox included with Pro access.</strong> Lead pricing is negotiated separately for your business. Charges apply only under the separate lead agreement.</div> : null}
        {lead.plan_slug === 'featured' && lead.lead_inbox ? <div className="notice success" style={{ marginTop: 12 }}><strong>Featured Lead Inbox add-on active.</strong> Lead billing remains separate from Featured access.</div> : null}
        {lead.plan_slug === 'featured' && !lead.lead_inbox ? <div className="notice" style={{ marginTop: 12 }}><strong>Lead Inbox is optional on Featured.</strong> You can add it separately without changing the rest of your plan.</div> : null}
        <div className="card-actions"><Link className="btn btn-primary" href={`/business-portal/media?business=${b.id}`}>Manage Photos & Media</Link>{lead.lead_inbox ? <Link className="btn btn-light" href={`/business-portal/leads?business=${b.id}`}>Open Lead Inbox</Link> : null}</div>
      </div>

      <div className="card">
        <div className="kpi">Billing Source</div>
        {current ? <><div className="badges"><span className="badge neutral">{current.status}</span>{current.billing_interval ? <span className="badge neutral">{current.billing_interval}</span> : null}</div><h3>{paidPlan?.name || 'Paid Directory Plan'}</h3><p className="muted">This is your Stripe-backed subscription. A complimentary trial can temporarily provide higher feature access without changing or canceling this subscription.</p>{current.current_period_end ? <p className="small muted">Current billing period ends: {new Date(current.current_period_end).toLocaleDateString()}</p> : null}</> : <><h3>No active paid subscription</h3><p className="muted">Your underlying plan is Free. If a complimentary trial ends, the business automatically returns to Free unless a paid subscription is active by then.</p></>}
        <p className="small muted">Verification remains a separate staff-reviewed trust state and cannot be purchased or granted through this plan screen.</p>
      </div>
    </div>

    <div className="section-head compact-head"><div><div className="kpi">Optional upgrades</div><h2>Current Public Plans</h2><p className="muted">These are the same live plan options shown publicly. Checkout is handled through the configured Stripe payment links.</p></div></div>
    <PricingGrid plans={cfg.plans ?? []} />
    <div className="notice" style={{ marginTop: 18 }}><strong>Lead billing is separate from plan billing:</strong> Pro includes access to the Lead Inbox, and Featured may add that access, but individual leads are billed according to the separate rate or lead-bundle agreement set for the business. Lead charges are based on delivery, not whether the business closes the opportunity.</div>
  </div>
}