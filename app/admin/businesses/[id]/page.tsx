import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { AdminEntityEditor } from '@/components/AdminEntityEditor'
import { BusinessVerificationPanel } from '@/components/BusinessVerificationPanel'
import { BusinessCoverageManager } from '@/components/BusinessCoverageManager'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined
const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
const date = (value: unknown) => {
  if (!value) return '—'
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const titleCase = (value: unknown) => String(value ?? '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const activeStatuses = new Set(['active', 'trialing', 'past_due'])

const tabs = [
  ['overview', 'Overview'],
  ['profile', 'Profile'],
  ['coverage', 'Coverage'],
  ['media', 'Media'],
  ['leads', 'Leads'],
  ['trust', 'Trust & Claims'],
  ['revenue', 'Revenue'],
  ['seo', 'SEO'],
  ['growth', 'Growth'],
  ['activity', 'Activity'],
] as const

type Tab = typeof tabs[number][0]

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, SearchValue>> }) {
  const { id } = await params
  const sp = await searchParams
  const requestedTab = one(sp.tab) as Tab
  const tab: Tab = tabs.some(([key]) => key === requestedTab) ? requestedTab : 'overview'
  const s = await createClient()
  const businessCfg = ADMIN_ENTITIES.businesses

  const { data: business, error: businessError } = await s.from('businesses').select(businessCfg.select).eq('tenant_id', TENANT_ID).eq('id', id).maybeSingle()
  if (businessError || !business) notFound()

  const [
    categoryLinksResult,
    categoriesResult,
    branchesResult,
    serviceAreasResult,
    locationsResult,
    mediaResult,
    claimsResult,
    ownersResult,
    editsResult,
    reportsResult,
    leadsResult,
    routesResult,
    subscriptionsResult,
    plansResult,
    sponsorshipsResult,
    prospectsResult,
    growthResult,
    qualityResult,
    statsResult,
    auditResult,
  ] = await Promise.all([
    s.from('business_categories').select('category_id,is_primary').eq('business_id', id),
    s.from('categories').select('id,name,slug,vertical,is_active').eq('tenant_id', TENANT_ID).eq('is_active', true).order('vertical').order('name'),
    s.from('business_locations').select(ADMIN_ENTITIES.branches.select).eq('tenant_id', TENANT_ID).eq('business_id', id).order('is_primary', { ascending: false }).order('city'),
    s.from('business_service_areas').select('location_id').eq('business_id', id),
    s.from('locations').select('id,name,slug,county,state,type,is_active').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
    s.from('business_media').select(ADMIN_ENTITIES.media.select).eq('tenant_id', TENANT_ID).eq('business_id', id).order('sort_order').limit(100),
    s.from('business_claims').select(ADMIN_ENTITIES.claims.select).eq('business_id', id).order('created_at', { ascending: false }).limit(50),
    s.from('business_owners').select('business_id,user_id,ownership_role').eq('business_id', id),
    s.from('business_edit_requests').select(ADMIN_ENTITIES['edit-requests'].select).eq('tenant_id', TENANT_ID).eq('business_id', id).order('created_at', { ascending: false }).limit(50),
    s.from('listing_reports').select(ADMIN_ENTITIES.reports.select).eq('tenant_id', TENANT_ID).eq('business_id', id).order('created_at', { ascending: false }).limit(50),
    s.from('leads').select(ADMIN_ENTITIES.leads.select).eq('tenant_id', TENANT_ID).or(`business_id.eq.${id},assigned_business_id.eq.${id}`).order('created_at', { ascending: false }).limit(100),
    s.from('lead_recipients').select(ADMIN_ENTITIES.routing.select).eq('tenant_id', TENANT_ID).eq('business_id', id).order('routed_at', { ascending: false }).limit(100),
    s.from('subscriptions').select(ADMIN_ENTITIES.subscriptions.select).eq('business_id', id).order('updated_at', { ascending: false }).limit(50),
    s.from('plans').select('id,name,slug,monthly_price_cents,annual_price_cents').eq('tenant_id', TENANT_ID),
    s.from('sponsorships').select(ADMIN_ENTITIES.sponsorships.select).eq('business_id', id).order('created_at', { ascending: false }).limit(50),
    s.from('business_prospects').select(ADMIN_ENTITIES.prospects.select).eq('tenant_id', TENANT_ID).eq('business_id', id).order('updated_at', { ascending: false }).limit(25),
    s.from('growth_opportunities').select(ADMIN_ENTITIES['growth-opportunities'].select).eq('tenant_id', TENANT_ID).eq('business_id', id).order('score', { ascending: false }).limit(100),
    s.from('data_quality_tasks').select(ADMIN_ENTITIES['data-quality'].select).eq('tenant_id', TENANT_ID).eq('business_id', id).order('updated_at', { ascending: false }).limit(100),
    s.from('listing_daily_stats').select(ADMIN_ENTITIES.analytics.select).eq('business_id', id).order('stat_date', { ascending: false }).limit(120),
    s.from('audit_logs').select('id,actor_user_id,action_type,action_text,created_at').eq('tenant_id', TENANT_ID).ilike('action_text', `%${id}%`).order('created_at', { ascending: false }).limit(100),
  ])

  const errors = [categoryLinksResult.error, categoriesResult.error, branchesResult.error, serviceAreasResult.error, locationsResult.error, mediaResult.error, claimsResult.error, ownersResult.error, editsResult.error, reportsResult.error, leadsResult.error, routesResult.error, subscriptionsResult.error, plansResult.error, sponsorshipsResult.error, prospectsResult.error, growthResult.error, qualityResult.error, statsResult.error, auditResult.error].filter(Boolean)

  const categoryLinks = (categoryLinksResult.data ?? []) as any[]
  const allCategories = (categoriesResult.data ?? []) as any[]
  const branches = (branchesResult.data ?? []) as unknown as Record<string, unknown>[]
  const serviceAreaLinks = (serviceAreasResult.data ?? []) as any[]
  const allLocations = (locationsResult.data ?? []) as any[]
  const mediaRows = (mediaResult.data ?? []) as unknown as Record<string, unknown>[]
  const claims = (claimsResult.data ?? []) as unknown as Record<string, unknown>[]
  const owners = (ownersResult.data ?? []) as any[]
  const edits = (editsResult.data ?? []) as unknown as Record<string, unknown>[]
  const reports = (reportsResult.data ?? []) as unknown as Record<string, unknown>[]
  const leads = (leadsResult.data ?? []) as unknown as Record<string, unknown>[]
  const routes = (routesResult.data ?? []) as unknown as Record<string, unknown>[]
  const subscriptions = (subscriptionsResult.data ?? []) as unknown as Record<string, unknown>[]
  const plans = (plansResult.data ?? []) as any[]
  const sponsorships = (sponsorshipsResult.data ?? []) as unknown as Record<string, unknown>[]
  const prospects = (prospectsResult.data ?? []) as unknown as Record<string, unknown>[]
  const growth = (growthResult.data ?? []) as unknown as Record<string, unknown>[]
  const quality = (qualityResult.data ?? []) as unknown as Record<string, unknown>[]
  const stats = (statsResult.data ?? []) as any[]
  const audits = (auditResult.data ?? []) as any[]

  const prospectIds = prospects.map((row) => String(row.id || '')).filter(Boolean)
  const outreachResult = prospectIds.length
    ? await s.from('outreach_tasks').select(ADMIN_ENTITIES.outreach.select).eq('tenant_id', TENANT_ID).in('prospect_id', prospectIds).order('created_at', { ascending: false }).limit(100)
    : { data: [], error: null }
  const outreach = (outreachResult.data ?? []) as unknown as Record<string, unknown>[]
  if (outreachResult.error) errors.push(outreachResult.error)

  const selectedCategoryIds = categoryLinks.map((row) => String(row.category_id))
  const primaryCategoryId = String(categoryLinks.find((row) => row.is_primary)?.category_id || selectedCategoryIds[0] || '')
  const categoryById = new Map(allCategories.map((row) => [String(row.id), row]))
  const locationById = new Map(allLocations.map((row) => [String(row.id), row]))
  const planById = new Map(plans.map((row) => [String(row.id), row]))
  const selectedServiceAreaIds = serviceAreaLinks.map((row) => String(row.location_id))
  const physicalMarketIds = new Set(branches.map((row) => String((row as any).location_id || '')).filter(Boolean))
  const coverageMarketIds = [...new Set([...physicalMarketIds, ...selectedServiceAreaIds])]

  const seoResult = coverageMarketIds.length && selectedCategoryIds.length
    ? await s.from('seo_pages').select('id,market_location_id,category_id,city,category,title,index_mode,reviewed,updated_at').eq('tenant_id', TENANT_ID).in('market_location_id', coverageMarketIds).in('category_id', selectedCategoryIds).order('updated_at', { ascending: false }).limit(300)
    : { data: [], error: null }
  const seoRows = (seoResult.data ?? []) as any[]
  if (seoResult.error) errors.push(seoResult.error)

  const today = new Date().toISOString().slice(0, 10)
  const activeSponsorships = sponsorships.filter((row: any) => row.active && (!row.starts_on || row.starts_on <= today) && (!row.ends_on || row.ends_on >= today))
  const activeSubscription = subscriptions.find((row: any) => activeStatuses.has(String(row.status || '')) && (!row.ends_at || new Date(String(row.ends_at)).getTime() > Date.now())) as any
  const activePlan = activeSubscription ? planById.get(String(activeSubscription.plan_id || '')) : null
  const pendingClaims = claims.filter((row: any) => ['pending', 'in_review', 'new'].includes(String(row.status))).length
  const openQuality = quality.filter((row: any) => ['open', 'in_progress'].includes(String(row.status))).length
  const openGrowth = growth.filter((row: any) => ['open', 'in_progress', 'snoozed'].includes(String(row.status))).length
  const approvedMedia = mediaRows.filter((row: any) => row.status === 'approved' || row.approval_status === 'approved').length

  const analytics = stats.reduce((sum, row) => ({
    impressions: sum.impressions + Number(row.impressions || 0),
    views: sum.views + Number(row.profile_views || 0),
    phone: sum.phone + Number(row.phone_clicks || 0),
    website: sum.website + Number(row.website_clicks || 0),
    directions: sum.directions + Number(row.directions_clicks || 0),
    leads: sum.leads + Number(row.lead_submissions || 0),
  }), { impressions: 0, views: 0, phone: 0, website: 0, directions: 0, leads: 0 })

  const sourceAge = business.source_checked_at ? Math.floor((Date.now() - new Date(String(business.source_checked_at)).getTime()) / 86400000) : null
  const alerts: { label: string; detail: string; href: string }[] = []
  if (!business.source_url || !business.source_checked_at) alerts.push({ label: 'Provenance incomplete', detail: 'Add a real source URL and checked date before treating business facts as recently reviewed.', href: '?tab=profile' })
  else if ((sourceAge ?? 0) >= 180) alerts.push({ label: 'Source reverification due', detail: `Current source evidence is approximately ${sourceAge} days old.`, href: '?tab=trust' })
  if (!business.claimed) alerts.push({ label: 'Business is unclaimed', detail: 'Ownership remains unclaimed until the protected claim workflow approves a matching account.', href: '?tab=trust' })
  if (!business.verified) alerts.push({ label: 'Business is unverified', detail: 'Verification requires documented source evidence and remains separate from claiming or payment.', href: '?tab=trust' })
  if (!selectedCategoryIds.length) alerts.push({ label: 'No directory category', detail: 'Assign at least one legitimate category before relying on discovery coverage.', href: '?tab=coverage' })
  if (!coverageMarketIds.length) alerts.push({ label: 'No market relationship', detail: 'Add a real branch or a legitimate service area. Never create a fake office to fill coverage.', href: '?tab=coverage' })
  if (!approvedMedia) alerts.push({ label: 'No approved media', detail: 'Add a logo or approved imagery to strengthen the public profile.', href: '?tab=media' })
  if (openQuality) alerts.push({ label: `${openQuality} open quality task${openQuality === 1 ? '' : 's'}`, detail: 'Resolve source, branch, reverification, or other persistent integrity work from the underlying facts.', href: '?tab=trust' })

  const tabCount: Record<Tab, number | null> = {
    overview: alerts.length,
    profile: null,
    coverage: branches.length + selectedServiceAreaIds.length,
    media: mediaRows.length,
    leads: leads.length + routes.length,
    trust: pendingClaims + openQuality + edits.filter((row: any) => row.status === 'pending').length + reports.filter((row: any) => ['pending', 'open', 'new'].includes(String(row.status))).length,
    revenue: subscriptions.length + sponsorships.length,
    seo: seoRows.length,
    growth: prospects.length + openGrowth + outreach.filter((row: any) => row.status !== 'completed').length,
    activity: stats.length + audits.length,
  }

  const verificationRow = [{
    id: business.id,
    name: business.name,
    status: business.status,
    claimed: business.claimed,
    verified: business.verified,
    featured: business.featured,
    phone: business.phone,
    website: business.website,
    address_text: business.address_text,
    source_name: business.source_name,
    source_url: business.source_url,
    source_checked_at: business.source_checked_at,
  }]

  return <>
    <div className="business-workspace-head">
      <div className="business-workspace-head-main">
        <Link className="workspace-back" href="/admin/businesses">← Businesses</Link>
        <div className="badges">
          <span className={`badge ${business.status === 'published' ? 'verified' : 'neutral'}`}>{titleCase(business.status)}</span>
          <span className={`badge ${business.claimed ? 'verified' : 'neutral'}`}>{business.claimed ? 'Claimed' : 'Unclaimed'}</span>
          <span className={`badge ${business.verified ? 'verified' : 'neutral'}`}>{business.verified ? 'Verified' : 'Unverified'}</span>
          {activeSponsorships.length ? <span className="badge sponsored">Sponsored</span> : null}
        </div>
        <h1>{String(business.name)}</h1>
        <p>{[business.phone, business.email, business.website].filter(Boolean).join(' · ') || 'No public contact details stored'}</p>
      </div>
      <div className="business-workspace-head-actions">
        {business.status === 'published' ? <Link className="btn btn-primary" href={`/business/${business.slug}`} target="_blank">View Public Profile</Link> : null}
        <Link className="btn btn-light" href={`/admin/business-media?business=${business.id}`}>Media & Menus</Link>
        <Link className="btn btn-light" href={`/admin/acquisition-research?q=${encodeURIComponent(String(business.name))}`}>Acquisition Research</Link>
      </div>
    </div>

    {errors.length ? <div className="notice warn">One or more related business systems could not be loaded completely. The workspace is showing the data that was available; do not treat missing totals as zero until the affected query recovers.</div> : null}

    <div className="business-workspace-kpis">
      <div><span>Profile Score</span><strong>{Number(business.profile_score || 0)}%</strong><small>Directory completeness signal</small></div>
      <div><span>Plan</span><strong>{activePlan?.name || 'Free / none'}</strong><small>{activeSubscription ? titleCase(activeSubscription.status) : 'No active paid subscription'}</small></div>
      <div><span>Locations</span><strong>{branches.length}</strong><small>{selectedServiceAreaIds.length} service area{selectedServiceAreaIds.length === 1 ? '' : 's'}</small></div>
      <div><span>Media</span><strong>{approvedMedia}</strong><small>{mediaRows.length} total media record{mediaRows.length === 1 ? '' : 's'}</small></div>
      <div><span>Leads</span><strong>{leads.length}</strong><small>{analytics.leads} analytics submissions recorded</small></div>
      <div><span>Open Work</span><strong>{alerts.length}</strong><small>{openGrowth} growth · {openQuality} quality</small></div>
    </div>

    <nav className="business-workspace-tabs" aria-label="Business workspace sections">
      {tabs.map(([key, label]) => <Link className={tab === key ? 'active' : ''} href={`/admin/businesses/${id}?tab=${key}`} key={key}><span>{label}</span>{tabCount[key] !== null ? <b>{tabCount[key]}</b> : null}</Link>)}
    </nav>

    <div className="business-workspace-body">
      {tab === 'overview' ? <Overview business={business} alerts={alerts} analytics={analytics} categories={selectedCategoryIds.map((id) => categoryById.get(id)).filter(Boolean)} branches={branches} serviceAreas={selectedServiceAreaIds.map((id) => locationById.get(id)).filter(Boolean)} activePlan={activePlan} activeSubscription={activeSubscription} activeSponsorships={activeSponsorships} recentAudits={audits.slice(0, 8)} /> : null}

      {tab === 'profile' ? <>
        <div className="workspace-section-head"><div><div className="kpi">Canonical Listing</div><h2>Profile & Contact Information</h2><p className="muted">Edit customer-facing business facts here. Claimed ownership, verification and Sponsored status remain controlled by their dedicated workflows.</p></div></div>
        <AdminEntityEditor section="businesses" cfg={businessCfg} rows={[business as unknown as Record<string, unknown>]} />
      </> : null}

      {tab === 'coverage' ? <>
        <div className="workspace-section-head"><div><div className="kpi">Discovery Relationships</div><h2>Categories, Physical Locations & Service Areas</h2><p className="muted">Manage what the business actually is and where it legitimately operates without converting service coverage into fake offices.</p></div><Link className="btn btn-light" href="/admin/branches">Open Branch Manager</Link></div>
        <BusinessCoverageManager businessId={id} categories={allCategories} selectedCategoryIds={selectedCategoryIds} primaryCategoryId={primaryCategoryId} locations={allLocations} selectedServiceAreaIds={selectedServiceAreaIds} />
        <div className="workspace-section-head workspace-subhead"><div><div className="kpi">Physical Footprint</div><h2>Physical Locations</h2><p className="muted">Only real source-backed offices, storefronts, restaurants, shops or service centers belong here.</p></div></div>
        {branches.length ? <AdminEntityEditor section="branches" cfg={ADMIN_ENTITIES.branches} rows={branches} /> : <div className="empty">No physical branch records are attached to this business. A service-area business can legitimately have zero physical branches.</div>}
      </> : null}

      {tab === 'media' ? <>
        <div className="workspace-section-head"><div><div className="kpi">Public Presentation</div><h2>Media & Menus</h2><p className="muted">Review metadata here or open the dedicated upload workspace for logos, covers, showcase photos and restaurant menu assets.</p></div><Link className="btn btn-primary" href={`/admin/business-media?business=${id}`}>Open Media Uploads</Link></div>
        {mediaRows.length ? <AdminEntityEditor section="media" cfg={ADMIN_ENTITIES.media} rows={mediaRows} /> : <div className="empty">No media records exist for this business yet.</div>}
      </> : null}

      {tab === 'leads' ? <>
        <div className="workspace-section-head"><div><div className="kpi">Customer Demand</div><h2>Leads & Routing</h2><p className="muted">Lead records remain operational data. A route records delivery history; it does not imply a sale or customer outcome.</p></div><Link className="btn btn-light" href="/admin/leads">Open Lead Marketplace</Link></div>
        <WorkspaceStats items={[['Lead Records', leads.length], ['Routes', routes.length], ['Profile Views', analytics.views], ['Phone Clicks', analytics.phone], ['Website Clicks', analytics.website], ['Directions', analytics.directions]]} />
        <WorkspaceBlock title="Leads" subtitle="Leads directly associated with or assigned to this business.">{leads.length ? <AdminEntityEditor section="leads" cfg={ADMIN_ENTITIES.leads} rows={leads} /> : <div className="empty">No related lead records.</div>}</WorkspaceBlock>
        <WorkspaceBlock title="Routing History" subtitle="Delivery records for this business.">{routes.length ? <AdminEntityEditor section="routing" cfg={ADMIN_ENTITIES.routing} rows={routes} /> : <div className="empty">No lead routing records.</div>}</WorkspaceBlock>
      </> : null}

      {tab === 'trust' ? <>
        <div className="workspace-section-head"><div><div className="kpi">Ownership & Integrity</div><h2>Trust, Claims & Moderation</h2><p className="muted">Claimed means an approved owner relationship. Verified means staff documented evidence. Neither status can be purchased, and Sponsored placement is separate.</p></div></div>
        <BusinessVerificationPanel rows={verificationRow as any[]} />
        <WorkspaceStats items={[['Approved Owners', owners.length], ['Claims', claims.length], ['Pending Claims', pendingClaims], ['Edit Requests', edits.length], ['Reports', reports.length], ['Open Quality', openQuality]]} />
        <WorkspaceBlock title="Approved Owner Links" subtitle="Account relationships created through protected claim approval."><SimpleTable headers={['User ID', 'Ownership Role']} rows={owners.map((row) => [String(row.user_id), titleCase(row.ownership_role)])} empty="No approved owner relationships." /></WorkspaceBlock>
        <WorkspaceBlock title="Claims" subtitle="Use the protected Claims queue for approve/reject decisions.">{claims.length ? <><div className="workspace-inline-actions"><Link className="btn btn-light" href="/admin/claims">Open Claims Queue</Link></div><AdminEntityEditor section="claims" cfg={ADMIN_ENTITIES.claims} rows={claims} /></> : <div className="empty">No ownership claims for this business.</div>}</WorkspaceBlock>
        <WorkspaceBlock title="Owner Edit Requests" subtitle="Protected profile-change requests remain separate from direct staff editing.">{edits.length ? <><div className="workspace-inline-actions"><Link className="btn btn-light" href="/admin/edit-requests">Open Edit Request Queue</Link></div><AdminEntityEditor section="edit-requests" cfg={ADMIN_ENTITIES['edit-requests']} rows={edits} /></> : <div className="empty">No owner edit requests.</div>}</WorkspaceBlock>
        <WorkspaceBlock title="Listing Reports" subtitle="Reports are reviewed through the moderation workflow and do not automatically alter the listing.">{reports.length ? <><div className="workspace-inline-actions"><Link className="btn btn-light" href="/admin/reports">Open Reports Queue</Link></div><AdminEntityEditor section="reports" cfg={ADMIN_ENTITIES.reports} rows={reports} /></> : <div className="empty">No public listing reports.</div>}</WorkspaceBlock>
        <WorkspaceBlock title="Data Quality Tasks" subtitle="Persistent integrity work tied to this business.">{quality.length ? <AdminEntityEditor section="data-quality" cfg={ADMIN_ENTITIES['data-quality']} rows={quality} /> : <div className="empty">No data-quality tasks are currently tied to this business.</div>}</WorkspaceBlock>
      </> : null}

      {tab === 'revenue' ? <>
        <div className="workspace-section-head"><div><div className="kpi">Monetization</div><h2>Subscription & Sponsored Placement</h2><p className="muted">Paid status can unlock customer features or labeled placement, but it never changes organic rank or verification.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href={`/admin/subscriptions?business=${id}`}>Subscriptions</Link><Link className="btn btn-light" href={`/admin/sponsorships?business=${id}`}>Sponsorships</Link></div></div>
        <WorkspaceStats items={[['Active Plan', activePlan?.name || 'None'], ['Subscription Records', subscriptions.length], ['Active Sponsored', activeSponsorships.length], ['Sponsored Records', sponsorships.length]]} />
        <WorkspaceBlock title="Subscription History" subtitle="Stripe/provider-backed plan state and controlled overrides.">{subscriptions.length ? <AdminEntityEditor section="subscriptions" cfg={ADMIN_ENTITIES.subscriptions} rows={subscriptions} /> : <div className="empty">No subscription records.</div>}</WorkspaceBlock>
        <WorkspaceBlock title="Sponsored Placement" subtitle="Clearly labeled paid placement records remain separate from organic discovery.">{sponsorships.length ? <AdminEntityEditor section="sponsorships" cfg={ADMIN_ENTITIES.sponsorships} rows={sponsorships} /> : <div className="empty">No sponsorship records.</div>}</WorkspaceBlock>
      </> : null}

      {tab === 'seo' ? <>
        <div className="workspace-section-head"><div><div className="kpi">Organic Eligibility Context</div><h2>Related SEO Pages</h2><p className="muted">These are market/category pages intersecting this business’s legitimate categories and physical/service-area coverage. This business alone does not make a page indexable; the live three-provider guardrail still controls eligibility.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/seo">SEO Command Center</Link><Link className="btn btn-light" href="/admin/data-quality?state=active&type=seo_inventory">SEO Inventory Queue</Link></div></div>
        <div className="notice"><strong>Organic integrity:</strong> claim status, verification, Pro plans and Sponsored placements do not improve organic rank. Service areas may count as legitimate coverage where the business truly serves the market, but they never become office locations.</div>
        <SimpleTable headers={['Market', 'Category', 'Reviewed', 'Index Mode', 'Updated']} rows={seoRows.map((row) => [row.city || '—', row.category || '—', row.reviewed ? 'Yes' : 'No', titleCase(row.index_mode || 'auto'), date(row.updated_at)])} empty="No SEO records currently intersect this business’s selected categories and markets." />
      </> : null}

      {tab === 'growth' ? <>
        <div className="workspace-section-head"><div><div className="kpi">Acquisition & Expansion</div><h2>Growth Work</h2><p className="muted">Prospect research, owner-contact provenance and outreach tasks are staff operations. A task is not evidence that outreach was sent.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/acquisition-research">Acquisition Research</Link><Link className="btn btn-light" href="/admin/outreach">Outreach Workbench</Link></div></div>
        <WorkspaceStats items={[['Prospect Records', prospects.length], ['Open Opportunities', openGrowth], ['Outreach Tasks', outreach.length], ['Open Outreach', outreach.filter((row: any) => row.status !== 'completed').length]]} />
        <WorkspaceBlock title="Acquisition Prospect" subtitle="Decision-maker contact fields require source-backed provenance; a generic business inbox or main line is not owner evidence.">{prospects.length ? <AdminEntityEditor section="prospects" cfg={ADMIN_ENTITIES.prospects} rows={prospects} /> : <div className="empty">No acquisition prospect record is tied to this business.</div>}</WorkspaceBlock>
        <WorkspaceBlock title="Growth Opportunities" subtitle="Private commercial signals that never affect public ranking.">{growth.length ? <AdminEntityEditor section="growth-opportunities" cfg={ADMIN_ENTITIES['growth-opportunities']} rows={growth} /> : <div className="empty">No open or historical growth opportunities tied to this business.</div>}</WorkspaceBlock>
        <WorkspaceBlock title="Outreach Tasks" subtitle="Work plans and completion state; sent timestamps belong to actual outreach events only.">{outreach.length ? <AdminEntityEditor section="outreach" cfg={ADMIN_ENTITIES.outreach} rows={outreach} /> : <div className="empty">No outreach tasks tied to the business prospect.</div>}</WorkspaceBlock>
      </> : null}

      {tab === 'activity' ? <>
        <div className="workspace-section-head"><div><div className="kpi">Performance & History</div><h2>Analytics & Audit Activity</h2><p className="muted">Private operational history and listing-performance events for this business.</p></div><Link className="btn btn-light" href="/admin/audit">Full Audit Log</Link></div>
        <WorkspaceStats items={[['Impressions', analytics.impressions], ['Profile Views', analytics.views], ['Phone Clicks', analytics.phone], ['Website Clicks', analytics.website], ['Directions', analytics.directions], ['Lead Submissions', analytics.leads]]} />
        <WorkspaceBlock title="Daily Listing Analytics" subtitle={`Showing up to ${stats.length} recent daily rollups.`}>{stats.length ? <AdminEntityEditor section="analytics" cfg={ADMIN_ENTITIES.analytics} rows={stats as unknown as Record<string, unknown>[]} /> : <div className="empty">No listing analytics have been recorded yet.</div>}</WorkspaceBlock>
        <WorkspaceBlock title="Business Audit Trail" subtitle="Admin events whose audit text references this business ID."><SimpleTable headers={['Date', 'Action', 'Details', 'Actor']} rows={audits.map((row) => [date(row.created_at), titleCase(row.action_type), String(row.action_text || ''), String(row.actor_user_id || 'System')])} empty="No matching audit records were found for this business ID." /></WorkspaceBlock>
      </> : null}
    </div>
  </>
}

function Overview({ business, alerts, analytics, categories, branches, serviceAreas, activePlan, activeSubscription, activeSponsorships, recentAudits }: any) {
  return <div className="workspace-overview-grid">
    <section className="admin-card workspace-overview-main">
      <div className="section-head compact-head"><div><div className="kpi">Today</div><h2>What needs attention</h2><p className="small muted">This list is derived from current business facts and related work queues.</p></div><span className="badge neutral">{alerts.length} item{alerts.length === 1 ? '' : 's'}</span></div>
      <div className="workspace-action-list">{alerts.length ? alerts.map((alert: any) => <Link href={alert.href} key={`${alert.label}-${alert.href}`}><span><strong>{alert.label}</strong><small>{alert.detail}</small></span><b>›</b></Link>) : <div className="workspace-clear-state"><strong>No immediate workspace alerts</strong><span>Current core business relationships and trust fields have no obvious missing-state flags.</span></div>}</div>
    </section>

    <section className="admin-card">
      <div className="kpi">Business Snapshot</div><h2>Listing identity</h2>
      <dl className="workspace-detail-list">
        <div><dt>Status</dt><dd>{titleCase(business.status)}</dd></div>
        <div><dt>Claimed</dt><dd>{business.claimed ? 'Yes' : 'No'}</dd></div>
        <div><dt>Verified</dt><dd>{business.verified ? 'Yes' : 'No'}</dd></div>
        <div><dt>Categories</dt><dd>{categories.map((row: any) => row.name).join(', ') || 'None assigned'}</dd></div>
        <div><dt>Physical locations</dt><dd>{branches.length}</dd></div>
        <div><dt>Service areas</dt><dd>{serviceAreas.length}</dd></div>
      </dl>
    </section>

    <section className="admin-card">
      <div className="kpi">Source Provenance</div><h2>Evidence</h2>
      <dl className="workspace-detail-list">
        <div><dt>Source</dt><dd>{String(business.source_name || 'Not recorded')}</dd></div>
        <div><dt>Checked</dt><dd>{date(business.source_checked_at)}</dd></div>
        <div><dt>Source URL</dt><dd>{business.source_url ? <a href={String(business.source_url)} target="_blank" rel="noreferrer">Open source ↗</a> : 'Not recorded'}</dd></div>
        <div><dt>Address</dt><dd>{String(business.address_text || 'No canonical address')}</dd></div>
      </dl>
    </section>

    <section className="admin-card">
      <div className="kpi">Revenue State</div><h2>Plan & placement</h2>
      <dl className="workspace-detail-list">
        <div><dt>Plan</dt><dd>{activePlan?.name || 'Free / none'}</dd></div>
        <div><dt>Subscription</dt><dd>{activeSubscription ? titleCase(activeSubscription.status) : 'No active subscription'}</dd></div>
        <div><dt>Current period</dt><dd>{activeSubscription ? date(activeSubscription.current_period_end) : '—'}</dd></div>
        <div><dt>Sponsored placements</dt><dd>{activeSponsorships.length}</dd></div>
      </dl>
    </section>

    <section className="admin-card workspace-overview-main">
      <div className="section-head compact-head"><div><div className="kpi">Performance</div><h2>Recent analytics rollup</h2></div></div>
      <WorkspaceStats items={[['Impressions', analytics.impressions], ['Views', analytics.views], ['Phone', analytics.phone], ['Website', analytics.website], ['Directions', analytics.directions], ['Leads', analytics.leads]]} />
    </section>

    <section className="admin-card workspace-overview-main">
      <div className="section-head compact-head"><div><div className="kpi">Audit</div><h2>Recent staff activity</h2></div><Link className="btn btn-small btn-light" href="?tab=activity">See Activity</Link></div>
      <div className="workspace-timeline">{recentAudits.length ? recentAudits.map((row: any) => <div key={row.id}><span>{date(row.created_at)}</span><strong>{titleCase(row.action_type)}</strong><p>{row.action_text}</p></div>) : <div className="workspace-clear-state"><strong>No matching audit activity</strong><span>Business-specific audit entries will appear here when action text references this business ID.</span></div>}</div>
    </section>
  </div>
}

function WorkspaceStats({ items }: { items: [string, string | number][] }) {
  return <div className="workspace-mini-stats">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{typeof value === 'number' && label.toLowerCase().includes('revenue') ? money(value) : value}</strong></div>)}</div>
}

function WorkspaceBlock({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="workspace-block"><div className="workspace-block-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</section>
}

function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: (string | number | React.ReactNode)[][]; empty: string }) {
  if (!rows.length) return <div className="empty">{empty}</div>
  return <div className="admin-table-wrap"><table className="admin-table workspace-simple-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
}
