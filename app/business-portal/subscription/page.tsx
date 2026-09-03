import Link from 'next/link'
import { getOwnerData } from '@/lib/owner'
import { PricingGrid } from '@/components/PricingGrid'
import { getPublicConfig } from '@/lib/data'

export const dynamic = 'force-dynamic'
function related(value: any) { return Array.isArray(value) ? value[0] : value }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const [{ businesses, s }, cfg] = await Promise.all([getOwnerData('/business-portal/subscription'), getPublicConfig()])
  if (!businesses.length) return <div className="card empty-rich"><h2>Claim a business first</h2><p className="muted">Subscription tools become available after staff approves a legitimate ownership claim.</p><Link className="btn btn-primary" href="/search">Find My Listing</Link></div>

  const requested = typeof sp.business === 'string' ? sp.business : ''
  const b = businesses.find((x: any) => x.id === requested) ?? businesses[0]
  const switcher = businesses.length > 1
    ? <form className="portal-switcher" action="/business-portal/subscription" method="get"><label>Managing<select name="business" defaultValue={b.id}>{businesses.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="btn btn-light" type="submit">Switch Business</button></form>
    : <div className="portal-current"><span>Managing</span><strong>{b.name}</strong></div>

  const [{ data }, { data: leadAccess }] = await Promise.all([
    s.from('subscriptions').select('id,status,billing_interval,current_period_end,ends_at,provider_subscription_id,plans(name,slug,monthly_price_cents,annual_price_cents,entitlements)').eq('business_id', b.id).order('updated_at', { ascending: false }).limit(10),
    s.rpc('get_business_lead_access', { p_business_id: b.id })
  ])
  const current = (data ?? []).find((x: any) => ['active', 'trialing', 'past_due'].includes(x.status) && (!x.ends_at || new Date(x.ends_at).getTime() > Date.now())) as any
  const plan = current ? related(current.plans) : null
  const entitlements = plan?.entitlements ?? {}
  const galleryLimit = Math.max(0, Number(entitlements.max_gallery_images ?? 0) || 0)
  const menuUpload = Boolean(entitlements.menu_upload)
  const lead = (leadAccess ?? {}) as any

  return <div>
    {switcher}
    <div className="portal-section-head"><div><div className="kpi">Plan Management</div><h2>Subscription — {b.name}</h2><p className="muted">Directory plans are optional. Payment never automatically creates a Verified badge or changes organic rank.</p></div><Link className="btn btn-light" href={`/business-portal/growth?business=${b.id}`}>Growth Center</Link></div>

    {current
      ? <div className="card" style={{ marginBottom: 18 }}>
          <div className="badges"><span className="badge neutral">{current.status}</span>{current.billing_interval && <span className="badge neutral">{current.billing_interval}</span>}</div>
          <h3>{plan?.name || 'Paid Directory Plan'}</h3>
          <p className="muted">Your Stripe-backed subscription state is synchronized through the directory billing workflow. Verification remains a separate staff-reviewed trust state.</p>
          {galleryLimit > 0 && <div className="notice success" style={{ marginTop: 12 }}><strong>Media included:</strong> up to {galleryLimit} showcase photos{menuUpload ? ' plus restaurant menu upload for restaurant listings' : ''}. Menu files do not count against the photo limit.</div>}
          {galleryLimit === 0 && <div className="notice" style={{ marginTop: 12 }}><strong>Media:</strong> logo and cover-image tools are available for claimed listings. Upgrade to Featured for 5 showcase photos or Pro for 10.</div>}
          {lead.plan_slug === 'pro' && <div className="notice success" style={{ marginTop: 12 }}><strong>Lead Inbox included with Pro.</strong> Lead pricing is negotiated separately for your business. Charges apply to agreed leads when delivered, regardless of whether a lead ultimately closes.</div>}
          {lead.plan_slug === 'featured' && lead.lead_inbox && <div className="notice success" style={{ marginTop: 12 }}><strong>Featured Lead Inbox add-on active.</strong> Lead billing is separate from your Featured subscription and follows your business-specific lead agreement.</div>}
          {lead.plan_slug === 'featured' && !lead.lead_inbox && <div className="notice" style={{ marginTop: 12 }}><strong>Lead Inbox is optional on Featured.</strong> You can add Lead Inbox without upgrading the rest of your listing plan. Lead rates are set separately by agreement.</div>}
          {!['pro','featured'].includes(String(lead.plan_slug || 'free')) && <div className="notice" style={{ marginTop: 12 }}><strong>Lead Inbox:</strong> included with Pro, or available as an optional add-on to Featured.</div>}
          {current.current_period_end && <p className="small muted">Current period ends: {new Date(current.current_period_end).toLocaleDateString()}</p>}
          <div className="card-actions"><Link className="btn btn-primary" href={`/business-portal/media?business=${b.id}`}>Manage Photos & Media</Link>{lead.lead_inbox && <Link className="btn btn-light" href={`/business-portal/leads?business=${b.id}`}>Open Lead Inbox</Link>}{lead.plan_slug === 'featured' && !lead.lead_inbox && <Link className="btn btn-light" href={`/contact?reason=lead-inbox-addon&business=${encodeURIComponent(b.slug)}#marketing-review`}>Ask About Lead Inbox Add-on</Link>}</div>
        </div>
      : <div className="card" style={{ marginBottom: 18 }}><h3>Free / no active paid subscription</h3><p className="muted">Your business can remain eligible for normal organic directory inclusion without paying for a plan. Featured unlocks 5 showcase photos and restaurant menu upload; Pro unlocks 10 showcase photos, restaurant menu upload and Lead Inbox. Featured businesses can add Lead Inbox separately.</p><Link className="btn btn-light" href={`/business-portal/media?business=${b.id}`}>Manage Basic Listing Media</Link></div>}

    <div className="section-head compact-head"><div><div className="kpi">Optional upgrades</div><h2>Current Public Plans</h2><p className="muted">These are the same live plan options shown publicly. Checkout is handled through the configured Stripe payment links.</p></div></div>
    <PricingGrid plans={cfg.plans ?? []} />
    <div className="notice" style={{ marginTop: 18 }}><strong>Lead billing is separate from plan billing:</strong> Pro includes access to the Lead Inbox, and Featured may add that access, but individual leads are billed according to the separate rate or lead-bundle agreement set for the business. Lead charges are based on delivery, not whether the business closes the opportunity.</div>
  </div>
}
