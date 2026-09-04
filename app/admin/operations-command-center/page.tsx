import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined
const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const norm = (value: unknown) => String(value || '').trim().toLowerCase()
const daysOld = (value: unknown) => value ? Math.floor((Date.now() - new Date(String(value)).getTime()) / 86400000) : 9999
const titleCase = (value: string) => value.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const placementLabels: Record<string, string> = {
  homepage_featured: 'Homepage Featured',
  global_sidebar: 'Global Sidebar',
  city_sidebar: 'City Sidebar',
  category_sidebar: 'Category Sidebar',
  city_category: 'City + Category',
  exact_page: 'Exact Page',
  guide_sidebar: 'Guide Sidebar',
  business_profile_sidebar: 'Business Profile Sidebar',
  restaurant_sidebar: 'Restaurant Sidebar',
  home_services_sidebar: 'Home Services Sidebar',
  attorney_sidebar: 'Attorney Sidebar',
  local_stores_sidebar: 'Local Stores Sidebar',
}
const supportedPlacements = Object.keys(placementLabels)

type LocationRow = { id: string; name: string; slug: string; type?: string | null }
type CategoryRow = { id: string; name: string; slug: string; vertical?: string | null }
type BusinessRow = {
  id: string
  name: string
  slug: string
  claimed?: boolean | null
  phone?: string | null
  website?: string | null
  description?: string | null
  hours?: string | null
  address_text?: string | null
  source_url?: string | null
  source_checked_at?: string | null
  primary_location_id?: string | null
  published_at?: string | null
}

type QualityRow = BusinessRow & { issues: string[]; severity: number; categoryCount: number; marketCount: number; hasApprovedLogo: boolean }
type AcquisitionRow = { business: BusinessRow; demand: number; contactable: boolean; prospectStatus: string; crmStage: string; priority: string; score: number; nextAction: string }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  const sp = await searchParams
  const q = one(sp.q).trim().toLowerCase()
  const qualityFilter = one(sp.quality)
  const acquisitionFilter = one(sp.acquisition)
  const s = await createClient()
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const staleCutoff = new Date(Date.now() - 180 * 86400000).toISOString()

  const [businesses, locations, categories, branches, serviceAreas, businessCategories, seoPages, prospects, sponsors, media, searches, growthOpps] = await Promise.all([
    s.from('businesses').select('id,name,slug,claimed,phone,website,description,hours,address_text,source_url,source_checked_at,primary_location_id,published_at').eq('tenant_id', TENANT_ID).eq('status', 'published').limit(5000),
    s.from('locations').select('id,name,slug,type').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
    s.from('categories').select('id,name,slug,vertical').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
    s.from('business_locations').select('business_id,location_id,is_active').eq('tenant_id', TENANT_ID).eq('is_active', true).limit(15000),
    s.from('business_service_areas').select('business_id,location_id').limit(25000),
    s.from('business_categories').select('business_id,category_id').limit(30000),
    s.from('seo_pages').select('id,market_location_id,category_id,city,category,index_mode,reviewed,updated_at').eq('tenant_id', TENANT_ID).limit(8000),
    s.from('business_prospects').select('id,business_id,status,crm_stage,priority,owner_contact_email,owner_contact_phone,owner_contact_name,owner_contact_title,owner_contact_source_url').eq('tenant_id', TENANT_ID).limit(8000),
    s.from('sponsorships').select('id,business_id,market_location_id,category_id,placement,starts_on,ends_on,active,origin,priority,sort_order,rotation_weight,page_path').eq('tenant_id', TENANT_ID).limit(8000),
    s.from('business_media').select('business_id,media_type,status,approval_status').eq('tenant_id', TENANT_ID).limit(12000),
    s.from('search_events').select('service,location,result_count,created_at').eq('tenant_id', TENANT_ID).gte('created_at', since30).order('created_at', { ascending: false }).limit(8000),
    s.from('growth_opportunities').select('id,opportunity_type,business_id,status,score,next_action,source_facts').eq('tenant_id', TENANT_ID).in('status', ['open','in_progress','snoozed']).limit(5000),
  ])

  const errors = [businesses.error, locations.error, categories.error, branches.error, serviceAreas.error, businessCategories.error, seoPages.error, prospects.error, sponsors.error, media.error, searches.error, growthOpps.error].filter(Boolean)
  const businessRows = (businesses.data ?? []) as unknown as BusinessRow[]
  const locationRows = (locations.data ?? []) as unknown as LocationRow[]
  const categoryRows = (categories.data ?? []) as unknown as CategoryRow[]
  const published = new Set(businessRows.map(row => row.id))
  const locationById = new Map(locationRows.map(row => [row.id, row]))
  const locationByTerm = new Map<string, LocationRow>()
  const categoryById = new Map(categoryRows.map(row => [row.id, row]))
  const categoryByTerm = new Map<string, CategoryRow>()
  for (const row of locationRows) { locationByTerm.set(norm(row.name), row); locationByTerm.set(norm(row.slug), row) }
  for (const row of categoryRows) { categoryByTerm.set(norm(row.name), row); categoryByTerm.set(norm(row.slug), row) }

  const catsByBusiness = new Map<string, Set<string>>()
  for (const raw of businessCategories.data ?? []) {
    const row = raw as any
    const businessId = String(row.business_id || '')
    const categoryId = String(row.category_id || '')
    if (!published.has(businessId) || !categoryById.has(categoryId)) continue
    const set = catsByBusiness.get(businessId) || new Set<string>()
    set.add(categoryId)
    catsByBusiness.set(businessId, set)
  }

  const physicalMarketsByBusiness = new Map<string, Set<string>>()
  const serviceMarketsByBusiness = new Map<string, Set<string>>()
  const providersByMarket = new Map<string, Set<string>>()
  const addMarket = (kind: 'physical' | 'service', businessId: string, locationId: string) => {
    if (!published.has(businessId) || !locationById.has(locationId)) return
    const byBusiness = kind === 'physical' ? physicalMarketsByBusiness : serviceMarketsByBusiness
    const own = byBusiness.get(businessId) || new Set<string>(); own.add(locationId); byBusiness.set(businessId, own)
    const all = providersByMarket.get(locationId) || new Set<string>(); all.add(businessId); providersByMarket.set(locationId, all)
  }
  for (const raw of branches.data ?? []) { const row = raw as any; addMarket('physical', String(row.business_id || ''), String(row.location_id || '')) }
  for (const raw of serviceAreas.data ?? []) { const row = raw as any; addMarket('service', String(row.business_id || ''), String(row.location_id || '')) }

  const countFor = (locationId: string, categoryId?: string | null) => {
    const providers = providersByMarket.get(locationId) || new Set<string>()
    if (!categoryId) return providers.size
    let count = 0
    for (const businessId of providers) if (catsByBusiness.get(businessId)?.has(categoryId)) count++
    return count
  }

  const demandByMarketCategory = new Map<string, number>()
  const zeroByMarketCategory = new Map<string, number>()
  for (const raw of searches.data ?? []) {
    const row = raw as any
    const location = locationByTerm.get(norm(row.location))
    const category = categoryByTerm.get(norm(row.service))
    if (!location || !category) continue
    const key = `${location.id}|${category.id}`
    demandByMarketCategory.set(key, (demandByMarketCategory.get(key) || 0) + 1)
    if (Number(row.result_count || 0) === 0) zeroByMarketCategory.set(key, (zeroByMarketCategory.get(key) || 0) + 1)
  }

  const seoByKey = new Map<string, any>()
  for (const raw of seoPages.data ?? []) {
    const row = raw as any
    seoByKey.set(`${String(row.market_location_id || '')}|${String(row.category_id || '')}`, row)
  }
  const eligibleMissing: { location: LocationRow; category: CategoryRow | null; providers: number; demand: number; zero: number }[] = []
  const underThresholdIndexed: any[] = []
  let healthySeo = 0
  let explicitNoindex = 0
  for (const location of locationRows) {
    const cityCount = countFor(location.id)
    const citySeo = seoByKey.get(`${location.id}|`)
    if (cityCount >= 3) {
      if (citySeo?.reviewed && citySeo.index_mode !== 'noindex') healthySeo++
      else eligibleMissing.push({ location, category: null, providers: cityCount, demand: 0, zero: 0 })
    }
    if (citySeo?.index_mode === 'noindex') explicitNoindex++
    if (citySeo?.reviewed && citySeo.index_mode !== 'noindex' && cityCount < 3) underThresholdIndexed.push({ ...citySeo, providers: cityCount, label: 'City page' })
    for (const category of categoryRows) {
      const providers = countFor(location.id, category.id)
      const seo = seoByKey.get(`${location.id}|${category.id}`)
      const key = `${location.id}|${category.id}`
      if (providers >= 3) {
        if (seo?.reviewed && seo.index_mode !== 'noindex') healthySeo++
        else eligibleMissing.push({ location, category, providers, demand: demandByMarketCategory.get(key) || 0, zero: zeroByMarketCategory.get(key) || 0 })
      }
      if (seo?.index_mode === 'noindex') explicitNoindex++
      if (seo?.reviewed && seo.index_mode !== 'noindex' && providers < 3) underThresholdIndexed.push({ ...seo, providers, label: category.name })
    }
  }
  eligibleMissing.sort((a,b) => b.demand - a.demand || b.providers - a.providers || a.location.name.localeCompare(b.location.name))
  underThresholdIndexed.sort((a,b) => a.providers - b.providers || String(a.city || '').localeCompare(String(b.city || '')))

  const approvedLogo = new Set<string>()
  for (const raw of media.data ?? []) {
    const row = raw as any
    const approved = row.approval_status === 'approved' || row.status === 'approved'
    if (approved && row.media_type === 'logo') approvedLogo.add(String(row.business_id || ''))
  }

  const qualityRows: QualityRow[] = businessRows.map(business => {
    const issues: string[] = []
    const physical = physicalMarketsByBusiness.get(business.id)?.size || 0
    const service = serviceMarketsByBusiness.get(business.id)?.size || 0
    const categoryCount = catsByBusiness.get(business.id)?.size || 0
    if (!String(business.phone || '').trim()) issues.push('Missing phone')
    if (!String(business.website || '').trim()) issues.push('Missing website')
    if (String(business.description || '').trim().length < 80) issues.push('Thin/missing description')
    if (!String(business.source_url || '').trim()) issues.push('Missing source URL')
    if (!business.source_checked_at) issues.push('Source never checked')
    else if (String(business.source_checked_at) < staleCutoff) issues.push('Source older than 180 days')
    if (physical + service === 0) issues.push('No physical location or service area')
    if (categoryCount === 0) issues.push('No category')
    if (!approvedLogo.has(business.id)) issues.push('No approved logo')
    const severe = issues.filter(issue => ['Missing source URL','Source never checked','No physical location or service area','No category'].includes(issue)).length
    return { ...business, issues, severity: severe * 10 + issues.length, categoryCount, marketCount: physical + service, hasApprovedLogo: approvedLogo.has(business.id) }
  }).filter(row => row.issues.length).sort((a,b) => b.severity - a.severity || b.issues.length - a.issues.length || a.name.localeCompare(b.name))

  const qualityFiltered = qualityRows.filter(row => {
    if (q && !`${row.name} ${row.issues.join(' ')}`.toLowerCase().includes(q)) return false
    if (qualityFilter === 'critical' && !row.issues.some(issue => ['Missing source URL','Source never checked','No physical location or service area','No category'].includes(issue))) return false
    if (qualityFilter === 'contact' && !row.issues.includes('Missing phone')) return false
    if (qualityFilter === 'website' && !row.issues.includes('Missing website')) return false
    if (qualityFilter === 'media' && !row.issues.includes('No approved logo')) return false
    return true
  })

  const prospectByBusiness = new Map<string, any>()
  for (const raw of prospects.data ?? []) {
    const row = raw as any
    const businessId = String(row.business_id || '')
    if (!businessId) continue
    const existing = prospectByBusiness.get(businessId)
    const currentContact = Boolean(row.owner_contact_email || row.owner_contact_phone)
    const existingContact = Boolean(existing?.owner_contact_email || existing?.owner_contact_phone)
    if (!existing || (currentContact && !existingContact)) prospectByBusiness.set(businessId, row)
  }

  const demandForBusiness = (businessId: string) => {
    let total = 0
    const markets = new Set<string>([...(physicalMarketsByBusiness.get(businessId) || []), ...(serviceMarketsByBusiness.get(businessId) || [])])
    for (const locationId of markets) for (const categoryId of catsByBusiness.get(businessId) || []) total += demandByMarketCategory.get(`${locationId}|${categoryId}`) || 0
    return total
  }

  const acquisitionRows: AcquisitionRow[] = businessRows.filter(row => !row.claimed).map(business => {
    const prospect = prospectByBusiness.get(business.id) || {}
    const contactable = Boolean(prospect.owner_contact_email || prospect.owner_contact_phone)
    const demand = demandForBusiness(business.id)
    const prospectStatus = String(prospect.status || '')
    const crmStage = String(prospect.crm_stage || '')
    const priority = String(prospect.priority || '')
    const score = (contactable ? 80 : 25) + Math.min(demand * 12, 84) + (priority === 'hot' ? 25 : priority === 'high' ? 15 : 0) + (business.website ? 5 : 0) + (approvedLogo.has(business.id) ? 3 : 0)
    const nextAction = contactable && ['contact_ready','published'].includes(prospectStatus) ? 'Prepare claim invitation' : contactable ? 'Verify contact provenance / stage' : prospect.id ? 'Research decision-maker contact' : 'Create contact-research prospect'
    return { business, demand, contactable, prospectStatus, crmStage, priority, score, nextAction }
  }).sort((a,b) => b.score - a.score || b.demand - a.demand || a.business.name.localeCompare(b.business.name))

  const acquisitionFiltered = acquisitionRows.filter(row => {
    if (q && !`${row.business.name} ${row.nextAction} ${row.priority}`.toLowerCase().includes(q)) return false
    if (acquisitionFilter === 'ready' && !(row.contactable && ['contact_ready','published'].includes(row.prospectStatus))) return false
    if (acquisitionFilter === 'research' && row.contactable) return false
    if (acquisitionFilter === 'demand' && row.demand === 0) return false
    return true
  })

  const today = new Date().toISOString().slice(0,10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10)
  const activeSponsors = (sponsors.data ?? []).filter((raw:any) => raw.active && (!raw.starts_on || raw.starts_on <= today) && (!raw.ends_on || raw.ends_on >= today)) as any[]
  const activeByPlacement = new Map<string, number>()
  const promotionalByPlacement = new Map<string, number>()
  for (const row of activeSponsors) {
    const placement = String(row.placement || 'unset')
    activeByPlacement.set(placement, (activeByPlacement.get(placement) || 0) + 1)
    if (row.origin === 'promotional') promotionalByPlacement.set(placement, (promotionalByPlacement.get(placement) || 0) + 1)
  }
  const expiringSoon = activeSponsors.filter(row => row.ends_on && row.ends_on >= today && row.ends_on <= in30)
  const unusedPlacements = supportedPlacements.filter(placement => !activeByPlacement.get(placement))
  const sponsorshipOpps = (growthOpps.data ?? []).filter((raw:any) => raw.opportunity_type === 'sponsorship') as any[]

  const claimedCount = businessRows.filter(row => row.claimed).length
  const contactReady = acquisitionRows.filter(row => row.contactable && ['contact_ready','published'].includes(row.prospectStatus)).length
  const missingSource = qualityRows.filter(row => row.issues.includes('Missing source URL') || row.issues.includes('Source never checked')).length
  const orphaned = qualityRows.filter(row => row.issues.includes('No physical location or service area')).length
  const missingPhone = qualityRows.filter(row => row.issues.includes('Missing phone')).length
  const missingWebsite = qualityRows.filter(row => row.issues.includes('Missing website')).length

  return <>
    <div className="admin-page-head">
      <div><div className="kpi">Private Operations Intelligence</div><h1>Growth Operations Command Center</h1><p className="muted">A single operating view for SEO eligibility, directory data quality, owner acquisition and Sponsored inventory. All workflow scores stay private and are completely separate from public organic ranking.</p></div>
      <div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/inventory-expansion">Market Coverage</Link><Link className="btn btn-light" href="/admin/launch-growth">Revenue Growth</Link></div>
    </div>
    {errors.length > 0 && <div className="notice warn">One or more production inputs could not be loaded. Treat affected totals as incomplete until the source query recovers.</div>}
    <div className="notice"><strong>Non-negotiable rules:</strong> paid plans and Sponsored placements never change organic rank; service areas never become fake offices; claim readiness requires a legitimate contact path; data-quality flags are internal; provider thresholds use current published inventory.</div>

    <div className="stat-grid" style={{marginTop:18}}>
      <div className="stat">Published Businesses<strong>{businessRows.length}</strong><span className="small muted">{claimedCount} claimed</span></div>
      <div className="stat">SEO Healthy / Eligible<strong>{healthySeo} / {eligibleMissing.length}</strong><span className="small muted">Reviewed healthy / needs review</span></div>
      <div className="stat">Indexed Under Threshold<strong>{underThresholdIndexed.length}</strong><span className="small muted">Needs protection/review</span></div>
      <div className="stat">Quality Review Queue<strong>{qualityRows.length}</strong><span className="small muted">{missingSource} provenance · {orphaned} location</span></div>
      <div className="stat">Acquisition Contact-Ready<strong>{contactReady}</strong><span className="small muted">No outreach inferred</span></div>
      <div className="stat">Active Sponsored Records<strong>{activeSponsors.length}</strong><span className="small muted">{expiringSoon.length} expire within 30 days</span></div>
      <div className="stat">Unused Placement Types<strong>{unusedPlacements.length}</strong></div>
      <div className="stat">Sponsorship Opportunities<strong>{sponsorshipOpps.length}</strong></div>
    </div>

    <div className="admin-card" style={{marginTop:18}}>
      <div className="section-head compact-head"><div><div className="kpi">SEO Eligibility Automation</div><h2>Inventory threshold → review queue</h2><p className="small muted">A city or city/category enters this queue only after current live inventory reaches three legitimate published providers. Explicit noindex remains protected until staff changes it.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/seo">SEO Command Center</Link><Link className="btn btn-light" href="/admin/content-intelligence">Content Intelligence</Link></div></div>
      <div className="grid grid-3"><div className="card"><div className="kpi">Eligible Missing Review</div><h2>{eligibleMissing.length}</h2><p className="small muted">Threshold met, no reviewed indexable SEO record yet.</p></div><div className="card"><div className="kpi">Under-Threshold Indexable</div><h2>{underThresholdIndexed.length}</h2><p className="small muted">Reviewed indexable mode but current provider count is below 3.</p></div><div className="card"><div className="kpi">Explicit Noindex Records</div><h2>{explicitNoindex}</h2><p className="small muted">Intentional locks remain protected.</p></div></div>
      {eligibleMissing.length ? <div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Market</th><th>Page</th><th>Providers</th><th>30d Demand</th><th>Zero Results</th><th>Action</th></tr></thead><tbody>{eligibleMissing.slice(0,30).map(row => <tr key={`${row.location.id}-${row.category?.id || 'city'}`}><td>{row.location.name}</td><td>{row.category?.name || 'City page'}</td><td><strong>{row.providers}</strong></td><td>{row.demand}</td><td>{row.zero}</td><td><Link href="/admin/seo">Create/review SEO page</Link></td></tr>)}</tbody></table></div> : <p className="muted">No newly eligible markets are waiting for SEO review.</p>}
      {underThresholdIndexed.length > 0 && <div className="notice warn" style={{marginTop:14}}><strong>{underThresholdIndexed.length} reviewed indexable page{underThresholdIndexed.length===1?' is':'s are'} below the three-provider threshold.</strong> Review these before the next crawl/indexing pass.</div>}
    </div>

    <div className="admin-card" style={{marginTop:18}}>
      <div className="section-head compact-head"><div><div className="kpi">Data Quality & Reverification</div><h2>Keep the directory trustworthy as inventory scales</h2><p className="small muted">This queue never changes public trust signals automatically. It identifies incomplete, stale or structurally weak published records for staff review.</p></div><Link className="btn btn-light" href="/admin/businesses">Business Manager</Link></div>
      <div className="stat-grid"><div className="stat">Missing Phone<strong>{missingPhone}</strong></div><div className="stat">Missing Website<strong>{missingWebsite}</strong></div><div className="stat">Missing / Stale Provenance<strong>{missingSource}</strong></div><div className="stat">No Location / Service Area<strong>{orphaned}</strong></div></div>
      <form method="get" className="grid grid-3" style={{alignItems:'end',marginTop:14}}><label className="field"><span>Quality Filter</span><select name="quality" defaultValue={qualityFilter}><option value="">All quality flags</option><option value="critical">Critical structural/provenance</option><option value="contact">Missing phone</option><option value="website">Missing website</option><option value="media">No approved logo</option></select></label><label className="field"><span>Search</span><input name="q" defaultValue={one(sp.q)} placeholder="Business or issue" /></label><div><button className="btn btn-primary" type="submit">Filter Operations</button></div></form>
      {qualityFiltered.length ? <div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Business</th><th>Issues</th><th>Markets</th><th>Categories</th><th>Logo</th><th>Source Age</th><th>Action</th></tr></thead><tbody>{qualityFiltered.slice(0,40).map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.issues.slice(0,4).join(' · ')}{row.issues.length>4?` · +${row.issues.length-4} more`:''}</td><td>{row.marketCount}</td><td>{row.categoryCount}</td><td>{row.hasApprovedLogo?'Approved':'Missing'}</td><td>{row.source_checked_at?`${daysOld(row.source_checked_at)}d`:'Never'}</td><td><Link href={`/admin/businesses?q=${encodeURIComponent(row.name)}`}>Review listing</Link></td></tr>)}</tbody></table></div> : <p className="muted">No businesses match the selected quality filter.</p>}
      <p className="small muted" style={{marginTop:10}}>Recommended cadence: reverify source-backed listing facts at least every 180 days, sooner for broken links, ownership requests or structural inconsistencies.</p>
    </div>

    <div className="admin-card" style={{marginTop:18}}>
      <div className="section-head compact-head"><div><div className="kpi">Owner Acquisition Workbench</div><h2>Published → contact research → claim-ready</h2><p className="small muted">A template or generic business inbox never proves owner contact. Claim invitations should be sent only after a legitimate decision-maker/owner contact channel is researched and stored with provenance.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/prospects">Sales CRM</Link><Link className="btn btn-light" href="/admin/outreach">Outreach Tasks</Link></div></div>
      <form method="get" className="grid grid-3" style={{alignItems:'end'}}><label className="field"><span>Acquisition Filter</span><select name="acquisition" defaultValue={acquisitionFilter}><option value="">All unclaimed businesses</option><option value="ready">Claim-ready contact path</option><option value="research">Contact research needed</option><option value="demand">Businesses in searched markets</option></select></label><label className="field"><span>Search</span><input name="q" defaultValue={one(sp.q)} placeholder="Business, priority or next action" /></label><div><button className="btn btn-primary" type="submit">Filter Acquisition</button></div></form>
      {acquisitionFiltered.length ? <div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Score</th><th>Business</th><th>Demand</th><th>Contact Path</th><th>CRM</th><th>Priority</th><th>Next Action</th></tr></thead><tbody>{acquisitionFiltered.slice(0,50).map(row => <tr key={row.business.id}><td><strong>{row.score}</strong></td><td>{row.business.name}</td><td>{row.demand}</td><td>{row.contactable?'Available':'Research needed'}</td><td>{row.prospectStatus || 'No linked prospect'}<div className="small muted">{row.crmStage || '—'}</div></td><td>{row.priority || '—'}</td><td>{row.nextAction}</td></tr>)}</tbody></table></div> : <p className="muted">No unclaimed businesses match the selected acquisition filter.</p>}
      <div className="notice" style={{marginTop:14}}><strong>Stage integrity:</strong> this page recommends next actions only. It does not set contacted, claim-invite or claimed timestamps and does not infer owner identity from a business phone or generic inbox.</div>
    </div>

    <div className="admin-card" style={{marginTop:18}}>
      <div className="section-head compact-head"><div><div className="kpi">Sponsored Inventory Board</div><h2>Paid visibility without paid organic ranking</h2><p className="small muted">Shows currently used placement types, promotional vs paid origin and upcoming expirations. A Sponsored record affects only labeled advertising surfaces.</p></div><Link className="btn btn-primary" href="/admin/sponsorships">Manage Sponsored Placement</Link></div>
      <div className="grid grid-3">{supportedPlacements.map(placement => <div className="card" key={placement}><div className="kpi">{activeByPlacement.get(placement) ? 'In use' : 'No active placement'}</div><h3>{placementLabels[placement]}</h3><p className="small muted">{activeByPlacement.get(placement) || 0} active record{(activeByPlacement.get(placement)||0)===1?'':'s'} · {promotionalByPlacement.get(placement) || 0} promotional</p></div>)}</div>
      <div className="grid grid-3" style={{marginTop:14}}><div className="card"><div className="kpi">Unused Placement Types</div><h2>{unusedPlacements.length}</h2><p className="small muted">No active record today; not an invented capacity claim.</p></div><div className="card"><div className="kpi">Expiring in 30 Days</div><h2>{expiringSoon.length}</h2><p className="small muted">Review renewals or replacement inventory.</p></div><div className="card"><div className="kpi">Open Sponsorship Opportunities</div><h2>{sponsorshipOpps.length}</h2><p className="small muted">Internal opportunity signals only.</p></div></div>
      {activeSponsors.length ? <div className="admin-table-wrap" style={{marginTop:14}}><table className="admin-table"><thead><tr><th>Placement</th><th>Origin</th><th>Starts</th><th>Ends</th><th>Priority</th><th>Rotation</th><th>Page</th></tr></thead><tbody>{activeSponsors.slice(0,40).map(row => <tr key={row.id}><td>{placementLabels[row.placement] || titleCase(String(row.placement || 'unset'))}</td><td>{titleCase(String(row.origin || 'manual'))}</td><td>{row.starts_on || 'Open'}</td><td>{row.ends_on || 'Open'}</td><td>{row.priority ?? '—'}</td><td>{row.rotation_weight ?? '—'}</td><td>{row.page_path || 'Placement default'}</td></tr>)}</tbody></table></div> : <p className="muted">No active Sponsored records are currently live.</p>}
    </div>

    <div className="grid grid-4" style={{marginTop:18}}>
      <Link className="admin-card admin-quick-card" href="/admin/inventory-expansion"><strong>Inventory Coverage</strong><p className="small muted">Find 0/1/2-provider gaps and fastest threshold unlocks.</p><span className="kpi">Open →</span></Link>
      <Link className="admin-card admin-quick-card" href="/admin/content-intelligence"><strong>SEO & Content</strong><p className="small muted">Review index eligibility, guides and demand reconciliation.</p><span className="kpi">Open →</span></Link>
      <Link className="admin-card admin-quick-card" href="/admin/growth-opportunities"><strong>Growth Queue</strong><p className="small muted">Assign and work persistent internal opportunities.</p><span className="kpi">Open →</span></Link>
      <Link className="admin-card admin-quick-card" href="/admin/revenue-intelligence"><strong>Revenue Intelligence</strong><p className="small muted">Review measured plan, lead and receivables performance.</p><span className="kpi">Open →</span></Link>
    </div>
  </>
}
