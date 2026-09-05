import type { ReactNode } from 'react'
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
type Tab = 'overview' | 'profile' | 'coverage' | 'media' | 'leads' | 'trust' | 'revenue' | 'seo' | 'growth' | 'activity'
type Row = Record<string, any>

const BUSINESS_SELECT = 'id,name,slug,phone,email,website,description,hours,price_range,menu_url,ordering_url,reservation_url,status,claimed,verified,featured,profile_score,address_text,source_name,source_url,source_checked_at,updated_at'
const BRANCH_SELECT = 'id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,email,source_name,source_url,source_checked_at,updated_at'
const TABS: [Tab, string][] = [
  ['overview', 'Overview'], ['profile', 'Profile'], ['coverage', 'Coverage'], ['media', 'Media'], ['leads', 'Leads'],
  ['trust', 'Trust & Claims'], ['revenue', 'Revenue'], ['seo', 'SEO'], ['growth', 'Growth'], ['activity', 'Activity'],
]
const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const titleCase = (value: unknown) => String(value ?? '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const date = (value: unknown) => {
  if (!value) return '—'
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const activeStatuses = new Set(['active', 'trialing', 'past_due'])

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, SearchValue>> }) {
  const { id } = await params
  const sp = await searchParams
  const requested = one(sp.tab) as Tab
  const tab: Tab = TABS.some(([key]) => key === requested) ? requested : 'overview'
  const s = await createClient()

  const { data: businessData, error: businessError } = await s.from('businesses').select(BUSINESS_SELECT).eq('tenant_id', TENANT_ID).eq('id', id).maybeSingle()
  if (businessError || !businessData) notFound()
  const business = businessData as Row

  const [categoryLinksResult, categoriesResult, branchesResult, areasResult, locationsResult, mediaResult, claimsResult, ownersResult, editsResult, reportsResult, leadsResult, routesResult, subscriptionsResult, plansResult, sponsorshipsResult, prospectsResult, growthResult, qualityResult, statsResult, auditsResult] = await Promise.all([
    s.from('business_categories').select('category_id,is_primary').eq('business_id', id),
    s.from('categories').select('id,name,slug,vertical,is_active').eq('tenant_id', TENANT_ID).eq('is_active', true).order('vertical').order('name'),
    s.from('business_locations').select(BRANCH_SELECT).eq('tenant_id', TENANT_ID).eq('business_id', id).order('is_primary', { ascending: false }).order('city'),
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

  const errors = [categoryLinksResult.error, categoriesResult.error, branchesResult.error, areasResult.error, locationsResult.error, mediaResult.error, claimsResult.error, ownersResult.error, editsResult.error, reportsResult.error, leadsResult.error, routesResult.error, subscriptionsResult.error, plansResult.error, sponsorshipsResult.error, prospectsResult.error, growthResult.error, qualityResult.error, statsResult.error, auditsResult.error].filter(Boolean)
  const categoryLinks = (categoryLinksResult.data ?? []) as Row[]
  const categories = (categoriesResult.data ?? []) as Row[]
  const branches = (branchesResult.data ?? []) as Row[]
  const areaLinks = (areasResult.data ?? []) as Row[]
  const locations = (locationsResult.data ?? []) as Row[]
  const media = (mediaResult.data ?? []) as Row[]
  const claims = (claimsResult.data ?? []) as Row[]
  const owners = (ownersResult.data ?? []) as Row[]
  const edits = (editsResult.data ?? []) as Row[]
  const reports = (reportsResult.data ?? []) as Row[]
  const leads = (leadsResult.data ?? []) as Row[]
  const routes = (routesResult.data ?? []) as Row[]
  const subscriptions = (subscriptionsResult.data ?? []) as Row[]
  const plans = (plansResult.data ?? []) as Row[]
  const sponsorships = (sponsorshipsResult.data ?? []) as Row[]
  const prospects = (prospectsResult.data ?? []) as Row[]
  const growth = (growthResult.data ?? []) as Row[]
  const quality = (qualityResult.data ?? []) as Row[]
  const stats = (statsResult.data ?? []) as Row[]
  const audits = (auditsResult.data ?? []) as Row[]

  const prospectIds = prospects.map((row) => String(row.id || '')).filter(Boolean)
  const outreachResult = prospectIds.length ? await s.from('outreach_tasks').select(ADMIN_ENTITIES.outreach.select).eq('tenant_id', TENANT_ID).in('prospect_id', prospectIds).order('created_at', { ascending: false }).limit(100) : { data: [], error: null }
  const outreach = (outreachResult.data ?? []) as Row[]
  if (outreachResult.error) errors.push(outreachResult.error)

  const selectedCategoryIds = categoryLinks.map((row) => String(row.category_id))
  const primaryCategoryId = String(categoryLinks.find((row) => row.is_primary)?.category_id || selectedCategoryIds[0] || '')
  const selectedAreaIds = areaLinks.map((row) => String(row.location_id))
  const categoryById = new Map(categories.map((row) => [String(row.id), row]))
  const locationById = new Map(locations.map((row) => [String(row.id), row]))
  const planById = new Map(plans.map((row) => [String(row.id), row]))
  const physicalMarketIds = branches.map((row) => String(row.location_id || '')).filter(Boolean)
  const coverageMarketIds = [...new Set([...physicalMarketIds, ...selectedAreaIds])]

  const seoResult = coverageMarketIds.length && selectedCategoryIds.length ? await s.from('seo_pages').select('id,market_location_id,category_id,city,category,title,index_mode,reviewed,updated_at').eq('tenant_id', TENANT_ID).in('market_location_id', coverageMarketIds).in('category_id', selectedCategoryIds).order('updated_at', { ascending: false }).limit(300) : { data: [], error: null }
  const seo = (seoResult.data ?? []) as Row[]
  if (seoResult.error) errors.push(seoResult.error)

  const today = new Date().toISOString().slice(0, 10)
  const activeSponsorships = sponsorships.filter((row) => row.active && (!row.starts_on || row.starts_on <= today) && (!row.ends_on || row.ends_on >= today))
  const activeSubscription = subscriptions.find((row) => activeStatuses.has(String(row.status || '')) && (!row.ends_at || new Date(String(row.ends_at)).getTime() > Date.now()))
  const activePlan = activeSubscription ? planById.get(String(activeSubscription.plan_id || '')) : null
  const pendingClaims = claims.filter((row) => ['pending', 'in_review', 'new'].includes(String(row.status))).length
  const openQuality = quality.filter((row) => ['open', 'in_progress'].includes(String(row.status))).length
  const openGrowth = growth.filter((row) => ['open', 'in_progress', 'snoozed'].includes(String(row.status))).length
  const approvedMedia = media.filter((row) => row.status === 'approved' || row.approval_status === 'approved').length
  const analytics = stats.reduce((sum, row) => ({ impressions: sum.impressions + Number(row.impressions || 0), views: sum.views + Number(row.profile_views || 0), phone: sum.phone + Number(row.phone_clicks || 0), website: sum.website + Number(row.website_clicks || 0), directions: sum.directions + Number(row.directions_clicks || 0), leads: sum.leads + Number(row.lead_submissions || 0) }), { impressions: 0, views: 0, phone: 0, website: 0, directions: 0, leads: 0 })

  const sourceAge = business.source_checked_at ? Math.floor((Date.now() - new Date(String(business.source_checked_at)).getTime()) / 86400000) : null
  const alerts: { label: string; detail: string; href: string }[] = []
  if (!business.source_url || !business.source_checked_at) alerts.push({ label: 'Provenance incomplete', detail: 'Add a real source URL and checked date before treating business facts as recently reviewed.', href: '?tab=profile' })
  else if ((sourceAge ?? 0) >= 180) alerts.push({ label: 'Source reverification due', detail: `Current source evidence is approximately ${sourceAge} days old.`, href: '?tab=trust' })
  if (!business.claimed) alerts.push({ label: 'Business is unclaimed', detail: 'Ownership remains unclaimed until the protected claim workflow approves a matching account.', href: '?tab=trust' })
  if (!business.verified) alerts.push({ label: 'Business is unverified', detail: 'Verification requires documented source evidence and remains separate from claiming or payment.', href: '?tab=trust' })
  if (!selectedCategoryIds.length) alerts.push({ label: 'No directory category', detail: 'Assign at least one legitimate category before relying on discovery coverage.', href: '?tab=coverage' })
  if (!coverageMarketIds.length) alerts.push({ label: 'No market relationship', detail: 'Add a real branch or a legitimate service area. Never create a fake office to fill coverage.', href: '?tab=coverage' })
  if (!approvedMedia) alerts.push({ label: 'No approved media', detail: 'Add a logo or approved imagery to strengthen the public profile.', href: '?tab=media' })
  if (openQuality) alerts.push({ label: `${openQuality} open quality task${openQuality === 1 ? '' : 's'}`, detail: 'Resolve integrity work from the underlying facts rather than bypassing the task.', href: '?tab=trust' })

  const tabCounts: Record<Tab, number | null> = {
    overview: alerts.length, profile: null, coverage: branches.length + selectedAreaIds.length, media: media.length, leads: leads.length + routes.length,
    trust: pendingClaims + openQuality + edits.filter((row) => row.status === 'pending').length + reports.filter((row) => ['pending', 'open', 'new'].includes(String(row.status))).length,
    revenue: subscriptions.length + sponsorships.length, seo: seo.length, growth: prospects.length + openGrowth + outreach.filter((row) => row.status !== 'completed').length, activity: stats.length + audits.length,
  }

  const verificationRow = [{ id: business.id, name: business.name, status: business.status, claimed: business.claimed, verified: business.verified, featured: business.featured, phone: business.phone, website: business.website, address_text: business.address_text, source_name: business.source_name, source_url: business.source_url, source_checked_at: business.source_checked_at }]

  return <>
    <div className="business-workspace-head">
      <div className="business-workspace-head-main">
        <Link className="workspace-back" href="/admin/businesses">← Businesses</Link>
        <div className="badges"><span className={`badge ${business.status === 'published' ? 'verified' : 'neutral'}`}>{titleCase(business.status)}</span><span className={`badge ${business.claimed ? 'verified' : 'neutral'}`}>{business.claimed ? 'Claimed' : 'Unclaimed'}</span><span className={`badge ${business.verified ? 'verified' : 'neutral'}`}>{business.verified ? 'Verified' : 'Unverified'}</span>{activeSponsorships.length ? <span className="badge sponsored">Sponsored</span> : null}</div>
        <h1>{String(business.name)}</h1>
        <p>{[business.phone, business.email, business.website].filter(Boolean).join(' · ') || 'No public contact details stored'}</p>
      </div>
      <div className="business-workspace-head-actions">{business.status === 'published' ? <Link className="btn btn-primary" href={`/business/${business.slug}`} target="_blank">View Public Profile</Link> : null}<Link className="btn btn-light" href={`/admin/business-media?business=${business.id}`}>Media & Menus</Link><Link className="btn btn-light" href={`/admin/acquisition-research?q=${encodeURIComponent(String(business.name))}`}>Acquisition Research</Link></div>
    </div>

    {errors.length ? <div className="notice warn">One or more related systems could not be loaded completely. Available data is still shown, but missing totals should not be treated as zero until the affected query recovers.</div> : null}

    <div className="business-workspace-kpis">
      <Kpi label="Profile Score" value={`${Number(business.profile_score || 0)}%`} detail="Directory completeness signal" />
      <Kpi label="Plan" value={String(activePlan?.name || 'Free / none')} detail={activeSubscription ? titleCase(activeSubscription.status) : 'No active paid subscription'} />
      <Kpi label="Locations" value={branches.length} detail={`${selectedAreaIds.length} service area${selectedAreaIds.length === 1 ? '' : 's'}`} />
      <Kpi label="Media" value={approvedMedia} detail={`${media.length} total media records`} />
      <Kpi label="Leads" value={leads.length} detail={`${analytics.leads} analytics submissions recorded`} />
      <Kpi label="Open Work" value={alerts.length} detail={`${openGrowth} growth · ${openQuality} quality`} />
    </div>

    <nav className="business-workspace-tabs" aria-label="Business workspace sections">{TABS.map(([key, label]) => <Link className={tab === key ? 'active' : ''} href={`/admin/businesses/${id}?tab=${key}`} key={key}><span>{label}</span>{tabCounts[key] !== null ? <b>{tabCounts[key]}</b> : null}</Link>)}</nav>

    <div className="business-workspace-body">
      {tab === 'overview' ? <Overview business={business} alerts={alerts} analytics={analytics} categories={selectedCategoryIds.map((categoryId) => categoryById.get(categoryId)).filter(Boolean) as Row[]} branches={branches} serviceAreas={selectedAreaIds.map((locationId) => locationById.get(locationId)).filter(Boolean) as Row[]} activePlan={activePlan} activeSubscription={activeSubscription} activeSponsorships={activeSponsorships} audits={audits.slice(0, 8)} /> : null}

      {tab === 'profile' ? <><SectionHead eyebrow="Canonical Listing" title="Profile & Contact Information" text="Edit customer-facing business facts here. Claimed ownership, verification and Sponsored status remain controlled by dedicated workflows." /><AdminEntityEditor section="businesses" cfg={ADMIN_ENTITIES.businesses} rows={[business]} /></> : null}

      {tab === 'coverage' ? <><SectionHead eyebrow="Discovery Relationships" title="Categories, Physical Locations & Service Areas" text="Manage what the business actually is and where it legitimately operates without converting service coverage into fake offices." action={<Link className="btn btn-light" href="/admin/branches">Open Branch Manager</Link>} /><BusinessCoverageManager businessId={id} categories={categories} selectedCategoryIds={selectedCategoryIds} primaryCategoryId={primaryCategoryId} locations={locations} selectedServiceAreaIds={selectedAreaIds} /><SectionHead eyebrow="Physical Footprint" title="Physical Locations" text="Only real source-backed offices, storefronts, restaurants, shops or service centers belong here." />{branches.length ? <AdminEntityEditor section="branches" cfg={ADMIN_ENTITIES.branches} rows={branches} /> : <div className="empty">No physical branch records are attached. A service-area business can legitimately have zero physical branches.</div>}</> : null}

      {tab === 'media' ? <><SectionHead eyebrow="Public Presentation" title="Media & Menus" text="Review metadata here or use the dedicated upload workspace for logos, covers, photos and restaurant menu assets." action={<Link className="btn btn-primary" href={`/admin/business-media?business=${id}`}>Open Media Uploads</Link>} />{media.length ? <AdminEntityEditor section="media" cfg={ADMIN_ENTITIES.media} rows={media} /> : <div className="empty">No media records exist for this business yet.</div>}</> : null}

      {tab === 'leads' ? <><SectionHead eyebrow="Customer Demand" title="Leads & Routing" text="A lead route records delivery history. It does not imply a sale or customer outcome." action={<Link className="btn btn-light" href="/admin/leads">Open Lead Marketplace</Link>} /><MiniStats items={[['Lead Records', leads.length], ['Routes', routes.length], ['Profile Views', analytics.views], ['Phone Clicks', analytics.phone], ['Website Clicks', analytics.website], ['Directions', analytics.directions]]} /><Block title="Leads" text="Directly associated with or assigned to this business.">{leads.length ? <AdminEntityEditor section="leads" cfg={ADMIN_ENTITIES.leads} rows={leads} /> : <div className="empty">No related lead records.</div>}</Block><Block title="Routing History" text="Delivery records for this business.">{routes.length ? <AdminEntityEditor section="routing" cfg={ADMIN_ENTITIES.routing} rows={routes} /> : <div className="empty">No routing records.</div>}</Block></> : null}

      {tab === 'trust' ? <><SectionHead eyebrow="Ownership & Integrity" title="Trust, Claims & Moderation" text="Claimed means an approved owner relationship. Verified means staff documented evidence. Neither status can be purchased, and Sponsored placement is separate." /><BusinessVerificationPanel rows={verificationRow} /><MiniStats items={[['Approved Owners', owners.length], ['Claims', claims.length], ['Pending Claims', pendingClaims], ['Edit Requests', edits.length], ['Reports', reports.length], ['Open Quality', openQuality]]} /><Block title="Approved Owner Links" text="Account relationships created through protected claim approval."><SimpleTable headers={['User ID', 'Ownership Role']} rows={owners.map((row) => [String(row.user_id), titleCase(row.ownership_role)])} empty="No approved owner relationships." /></Block><Block title="Claims" text="Use the protected Claims queue for approve/reject decisions.">{claims.length ? <><Link className="btn btn-light" href="/admin/claims">Open Claims Queue</Link><AdminEntityEditor section="claims" cfg={ADMIN_ENTITIES.claims} rows={claims} /></> : <div className="empty">No ownership claims.</div>}</Block><Block title="Owner Edit Requests" text="Protected profile-change requests remain separate from direct staff editing.">{edits.length ? <AdminEntityEditor section="edit-requests" cfg={ADMIN_ENTITIES['edit-requests']} rows={edits} /> : <div className="empty">No owner edit requests.</div>}</Block><Block title="Listing Reports" text="Reports do not automatically alter the listing.">{reports.length ? <AdminEntityEditor section="reports" cfg={ADMIN_ENTITIES.reports} rows={reports} /> : <div className="empty">No listing reports.</div>}</Block><Block title="Data Quality Tasks" text="Persistent integrity work tied to this business.">{quality.length ? <AdminEntityEditor section="data-quality" cfg={ADMIN_ENTITIES['data-quality']} rows={quality} /> : <div className="empty">No data-quality tasks are tied to this business.</div>}</Block></> : null}

      {tab === 'revenue' ? <><SectionHead eyebrow="Monetization" title="Subscription & Sponsored Placement" text="Paid status can unlock customer features or labeled placement, but it never changes organic rank or verification." action={<div className="admin-row-actions"><Link className="btn btn-light" href={`/admin/subscriptions?business=${id}`}>Subscriptions</Link><Link className="btn btn-light" href={`/admin/sponsorships?business=${id}`}>Sponsorships</Link></div>} /><MiniStats items={[['Active Plan', String(activePlan?.name || 'None')], ['Subscription Records', subscriptions.length], ['Active Sponsored', activeSponsorships.length], ['Sponsored Records', sponsorships.length]]} /><Block title="Subscription History" text="Provider-backed plan state and controlled overrides.">{subscriptions.length ? <AdminEntityEditor section="subscriptions" cfg={ADMIN_ENTITIES.subscriptions} rows={subscriptions} /> : <div className="empty">No subscription records.</div>}</Block><Block title="Sponsored Placement" text="Clearly labeled paid placement remains separate from organic discovery.">{sponsorships.length ? <AdminEntityEditor section="sponsorships" cfg={ADMIN_ENTITIES.sponsorships} rows={sponsorships} /> : <div className="empty">No sponsorship records.</div>}</Block></> : null}

      {tab === 'seo' ? <><SectionHead eyebrow="Organic Eligibility Context" title="Related SEO Pages" text="These market/category pages intersect this business’s legitimate categories and physical/service-area coverage. This business alone does not make a page indexable; the live three-provider guardrail still controls eligibility." action={<div className="admin-row-actions"><Link className="btn btn-light" href="/admin/seo">SEO Command Center</Link><Link className="btn btn-light" href="/admin/data-quality?state=active&type=seo_inventory">SEO Inventory Queue</Link></div>} /><div className="notice"><strong>Organic integrity:</strong> claim status, verification, Pro plans and Sponsored placements do not improve organic rank. Service areas may count as legitimate coverage but never become offices.</div><SimpleTable headers={['Market', 'Category', 'Reviewed', 'Index Mode', 'Updated']} rows={seo.map((row) => [row.city || '—', row.category || '—', row.reviewed ? 'Yes' : 'No', titleCase(row.index_mode || 'auto'), date(row.updated_at)])} empty="No SEO records currently intersect this business’s selected categories and markets." /></> : null}

      {tab === 'growth' ? <><SectionHead eyebrow="Acquisition & Expansion" title="Growth Work" text="Prospect research, owner-contact provenance and outreach tasks are staff operations. A task is not evidence that outreach was sent." action={<div className="admin-row-actions"><Link className="btn btn-light" href="/admin/acquisition-research">Acquisition Research</Link><Link className="btn btn-light" href="/admin/outreach">Outreach Workbench</Link></div>} /><MiniStats items={[['Prospect Records', prospects.length], ['Open Opportunities', openGrowth], ['Outreach Tasks', outreach.length], ['Open Outreach', outreach.filter((row) => row.status !== 'completed').length]]} /><Block title="Acquisition Prospect" text="Decision-maker contact fields require source-backed provenance; a generic business inbox or main line is not owner evidence.">{prospects.length ? <AdminEntityEditor section="prospects" cfg={ADMIN_ENTITIES.prospects} rows={prospects} /> : <div className="empty">No acquisition prospect record is tied to this business.</div>}</Block><Block title="Growth Opportunities" text="Private commercial signals that never affect public ranking.">{growth.length ? <AdminEntityEditor section="growth-opportunities" cfg={ADMIN_ENTITIES['growth-opportunities']} rows={growth} /> : <div className="empty">No growth opportunities.</div>}</Block><Block title="Outreach Tasks" text="Work plans and completion state; sent timestamps belong to actual outreach events only.">{outreach.length ? <AdminEntityEditor section="outreach" cfg={ADMIN_ENTITIES.outreach} rows={outreach} /> : <div className="empty">No outreach tasks.</div>}</Block></> : null}

      {tab === 'activity' ? <><SectionHead eyebrow="Performance & History" title="Analytics & Audit Activity" text="Private operational history and listing-performance events for this business." action={<Link className="btn btn-light" href="/admin/audit">Full Audit Log</Link>} /><MiniStats items={[['Impressions', analytics.impressions], ['Profile Views', analytics.views], ['Phone Clicks', analytics.phone], ['Website Clicks', analytics.website], ['Directions', analytics.directions], ['Lead Submissions', analytics.leads]]} /><Block title="Daily Listing Analytics" text={`Showing ${stats.length} recent daily rollups.`}>{stats.length ? <AdminEntityEditor section="analytics" cfg={ADMIN_ENTITIES.analytics} rows={stats} /> : <div className="empty">No listing analytics have been recorded yet.</div>}</Block><Block title="Business Audit Trail" text="Admin events whose audit text references this business ID."><SimpleTable headers={['Date', 'Action', 'Details', 'Actor']} rows={audits.map((row) => [date(row.created_at), titleCase(row.action_type), String(row.action_text || ''), String(row.actor_user_id || 'System')])} empty="No matching audit records were found." /></Block></> : null}
    </div>
  </>
}

function Kpi({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div> }
function SectionHead({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: ReactNode }) { return <div className="workspace-section-head"><div><div className="kpi">{eyebrow}</div><h2>{title}</h2><p className="muted">{text}</p></div>{action}</div> }
function MiniStats({ items }: { items: [string, string | number][] }) { return <div className="workspace-mini-stats">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div> }
function Block({ title, text, children }: { title: string; text: string; children: ReactNode }) { return <section className="workspace-block"><div className="workspace-block-head"><div><h2>{title}</h2><p>{text}</p></div></div>{children}</section> }
function SimpleTable({ headers, rows, empty }: { headers: string[]; rows: (string | number | ReactNode)[][]; empty: string }) { if (!rows.length) return <div className="empty">{empty}</div>; return <div className="admin-table-wrap"><table className="admin-table workspace-simple-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> }
function Overview({ business, alerts, analytics, categories, branches, serviceAreas, activePlan, activeSubscription, activeSponsorships, audits }: { business: Row; alerts: { label: string; detail: string; href: string }[]; analytics: Row; categories: Row[]; branches: Row[]; serviceAreas: Row[]; activePlan?: Row; activeSubscription?: Row; activeSponsorships: Row[]; audits: Row[] }) {
  return <div className="workspace-overview-grid">
    <section className="admin-card workspace-overview-main"><div className="section-head compact-head"><div><div className="kpi">Today</div><h2>What needs attention</h2><p className="small muted">Derived from current business facts and related work queues.</p></div><span className="badge neutral">{alerts.length} items</span></div><div className="workspace-action-list">{alerts.length ? alerts.map((alert) => <Link href={alert.href} key={`${alert.label}-${alert.href}`}><span><strong>{alert.label}</strong><small>{alert.detail}</small></span><b>›</b></Link>) : <div className="workspace-clear-state"><strong>No immediate workspace alerts</strong><span>Core business relationships and trust fields have no obvious missing-state flags.</span></div>}</div></section>
    <section className="admin-card"><div className="kpi">Business Snapshot</div><h2>Listing identity</h2><Details rows={[['Status', titleCase(business.status)], ['Claimed', business.claimed ? 'Yes' : 'No'], ['Verified', business.verified ? 'Yes' : 'No'], ['Categories', categories.map((row) => row.name).join(', ') || 'None'], ['Physical locations', branches.length], ['Service areas', serviceAreas.length]]} /></section>
    <section className="admin-card"><div className="kpi">Source Provenance</div><h2>Evidence</h2><Details rows={[['Source', business.source_name || 'Not recorded'], ['Checked', date(business.source_checked_at)], ['Source URL', business.source_url ? <a href={String(business.source_url)} target="_blank" rel="noreferrer">Open source ↗</a> : 'Not recorded'], ['Address', business.address_text || 'No canonical address']]} /></section>
    <section className="admin-card"><div className="kpi">Revenue State</div><h2>Plan & placement</h2><Details rows={[['Plan', activePlan?.name || 'Free / none'], ['Subscription', activeSubscription ? titleCase(activeSubscription.status) : 'No active subscription'], ['Current period', activeSubscription ? date(activeSubscription.current_period_end) : '—'], ['Sponsored placements', activeSponsorships.length]]} /></section>
    <section className="admin-card workspace-overview-main"><div className="kpi">Performance</div><h2>Recent analytics rollup</h2><MiniStats items={[['Impressions', analytics.impressions], ['Views', analytics.views], ['Phone', analytics.phone], ['Website', analytics.website], ['Directions', analytics.directions], ['Leads', analytics.leads]]} /></section>
    <section className="admin-card workspace-overview-main"><div className="section-head compact-head"><div><div className="kpi">Audit</div><h2>Recent staff activity</h2></div><Link className="btn btn-small btn-light" href="?tab=activity">See Activity</Link></div><div className="workspace-timeline">{audits.length ? audits.map((row) => <div key={row.id}><span>{date(row.created_at)}</span><strong>{titleCase(row.action_type)}</strong><p>{row.action_text}</p></div>) : <div className="workspace-clear-state"><strong>No matching audit activity</strong><span>Business-specific audit entries will appear here when action text references this business ID.</span></div>}</div></section>
  </div>
}
function Details({ rows }: { rows: [string, ReactNode][] }) { return <dl className="workspace-detail-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> }
