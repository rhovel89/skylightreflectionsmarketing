import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined

type LocationRow = { id: string; name: string; slug: string; type?: string | null }
type CategoryRow = { id: string; name: string; slug: string; vertical?: string | null }
type CoverageRow = {
  key: string
  market: string
  marketSlug: string
  marketType: string
  category: string
  categorySlug: string
  vertical: string
  providers: number
  physical: number
  serviceOnly: number
  cityBusinesses: number
  localSearches: number
  zeroResultSearches: number
  generalSearches: number
  lastSearchAt: string | null
  historicalMin: number | null
  historicalMax: number | null
  researchProspects: number
  contactReadyProspects: number
  outreachProspects: number
  score: number
}

const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const norm = (value: unknown) => String(value || '').trim().toLowerCase()
const keyFor = (market: string, category: string) => `${norm(market)}::${norm(category)}`
const addToMapSet = (map: Map<string, Set<string>>, key: string, value: string) => {
  if (!key || !value) return
  const set = map.get(key) || new Set<string>()
  set.add(value)
  map.set(key, set)
}
const priorityLabel = (score: number, providers: number, searches: number) => {
  if (providers === 2 && searches > 0) return 'Immediate'
  if (score >= 250) return 'High'
  if (score >= 160) return 'Medium'
  return 'Research'
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  const sp = await searchParams
  const marketFilter = one(sp.market)
  const categoryFilter = one(sp.category)
  const verticalFilter = one(sp.vertical)
  const bucketFilter = one(sp.bucket)
  const demandFilter = one(sp.demand)
  const q = one(sp.q).trim().toLowerCase()

  const s = await createClient()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
  const [locations, categories, branches, serviceAreas, businessCategories, searches, prospects] = await Promise.all([
    s.from('locations').select('id,name,slug,type').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
    s.from('categories').select('id,name,slug,vertical').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
    s.from('business_locations').select('location_id,business_id,businesses!inner(status,tenant_id)').eq('tenant_id', TENANT_ID).eq('is_active', true).eq('businesses.status', 'published').eq('businesses.tenant_id', TENANT_ID).limit(15000),
    s.from('business_service_areas').select('business_id,location_id,businesses!inner(status,tenant_id)').eq('businesses.status', 'published').eq('businesses.tenant_id', TENANT_ID).limit(25000),
    s.from('business_categories').select('business_id,category_id,categories!inner(id,name,slug,vertical,tenant_id)').eq('categories.tenant_id', TENANT_ID).limit(30000),
    s.from('search_events').select('service,location,result_count,created_at').eq('tenant_id', TENANT_ID).gte('created_at', ninetyDaysAgo).order('created_at', { ascending: false }).limit(8000),
    s.from('business_prospects').select('city,category,status,crm_stage,priority,owner_contact_email,owner_contact_phone,business_id').eq('tenant_id', TENANT_ID).limit(5000),
  ])

  const errors = [locations.error, categories.error, branches.error, serviceAreas.error, businessCategories.error, searches.error, prospects.error].filter(Boolean)
  const locationRows = (locations.data ?? []) as unknown as LocationRow[]
  const categoryRows = (categories.data ?? []) as unknown as CategoryRow[]
  const locationById = new Map(locationRows.map(row => [String(row.id), row]))
  const locationByTerm = new Map<string, LocationRow>()
  const categoryByTerm = new Map<string, CategoryRow>()
  for (const row of locationRows) {
    locationByTerm.set(norm(row.name), row)
    locationByTerm.set(norm(row.slug), row)
  }
  for (const row of categoryRows) {
    categoryByTerm.set(norm(row.name), row)
    categoryByTerm.set(norm(row.slug), row)
  }

  const categoriesByBusiness = new Map<string, CategoryRow[]>()
  for (const raw of businessCategories.data ?? []) {
    const row = raw as any
    const businessId = String(row.business_id || '')
    const category = row.categories as CategoryRow | null
    if (!businessId || !category?.id) continue
    const current = categoriesByBusiness.get(businessId) || []
    if (!current.some(item => item.id === category.id)) current.push(category)
    categoriesByBusiness.set(businessId, current)
  }

  const physicalByMarket = new Map<string, Set<string>>()
  const serviceByMarket = new Map<string, Set<string>>()
  const cityBusinesses = new Map<string, Set<string>>()
  const allConnectedBusinesses = new Set<string>()

  const connect = (kind: 'physical' | 'service', businessId: string, locationId: string) => {
    const location = locationById.get(locationId)
    if (!location || !businessId) return
    allConnectedBusinesses.add(businessId)
    addToMapSet(cityBusinesses, norm(location.name), businessId)
    for (const category of categoriesByBusiness.get(businessId) || []) {
      const key = keyFor(location.name, category.name)
      addToMapSet(kind === 'physical' ? physicalByMarket : serviceByMarket, key, businessId)
    }
  }

  for (const raw of branches.data ?? []) {
    const row = raw as any
    connect('physical', String(row.business_id || ''), String(row.location_id || ''))
  }
  for (const raw of serviceAreas.data ?? []) {
    const row = raw as any
    connect('service', String(row.business_id || ''), String(row.location_id || ''))
  }

  const localDemand = new Map<string, { searches: number; zero: number; last: string | null; min: number; max: number }>()
  const generalDemand = new Map<string, number>()
  let taxonomyReview = 0
  for (const raw of searches.data ?? []) {
    const row = raw as any
    const service = String(row.service || '').trim()
    const market = String(row.location || '').trim()
    const resultCount = Number(row.result_count || 0)
    if (!service) continue
    if (!market) {
      generalDemand.set(norm(service), (generalDemand.get(norm(service)) || 0) + 1)
      continue
    }
    const location = locationByTerm.get(norm(market))
    const category = categoryByTerm.get(norm(service))
    if (!location || !category) {
      taxonomyReview++
      continue
    }
    const key = keyFor(location.name, category.name)
    const current = localDemand.get(key) || { searches: 0, zero: 0, last: null, min: Number.POSITIVE_INFINITY, max: 0 }
    current.searches += 1
    if (resultCount === 0) current.zero += 1
    current.min = Math.min(current.min, resultCount)
    current.max = Math.max(current.max, resultCount)
    if (!current.last || String(row.created_at || '') > current.last) current.last = String(row.created_at || '')
    localDemand.set(key, current)
  }

  const prospectState = new Map<string, { research: number; contactReady: number; outreach: number }>()
  let researchProspectsTotal = 0
  let contactReadyTotal = 0
  let contactableTotal = 0
  for (const raw of prospects.data ?? []) {
    const row = raw as any
    const market = String(row.city || '').trim()
    const category = String(row.category || '').trim()
    if (row.status === 'research') researchProspectsTotal++
    if (row.status === 'contact_ready') contactReadyTotal++
    if (row.owner_contact_email || row.owner_contact_phone) contactableTotal++
    if (!market || !category) continue
    const key = keyFor(market, category)
    const state = prospectState.get(key) || { research: 0, contactReady: 0, outreach: 0 }
    if (row.status === 'research' || row.crm_stage === 'research' || row.crm_stage === 'verify') state.research++
    if (row.status === 'contact_ready') state.contactReady++
    if (['claim_outreach', 'marketing_outreach', 'follow_up'].includes(String(row.crm_stage || ''))) state.outreach++
    prospectState.set(key, state)
  }

  const rows: CoverageRow[] = []
  for (const location of locationRows) {
    for (const category of categoryRows) {
      const key = keyFor(location.name, category.name)
      const physicalSet = physicalByMarket.get(key) || new Set<string>()
      const serviceSet = serviceByMarket.get(key) || new Set<string>()
      const union = new Set<string>([...physicalSet, ...serviceSet])
      let serviceOnly = 0
      for (const businessId of serviceSet) if (!physicalSet.has(businessId)) serviceOnly++
      const demand = localDemand.get(key)
      const state = prospectState.get(key) || { research: 0, contactReady: 0, outreach: 0 }
      const providers = union.size
      const localSearches = demand?.searches || 0
      const zeroResultSearches = demand?.zero || 0
      const generalSearches = generalDemand.get(norm(category.name)) || 0
      const marketDepth = cityBusinesses.get(norm(location.name))?.size || 0
      const score =
        (providers === 2 ? 180 : providers === 1 ? 100 : providers === 0 ? 35 : 0) +
        Math.min(localSearches * 35, 210) +
        Math.min(zeroResultSearches * 25, 125) +
        Math.min(generalSearches * 6, 60) +
        Math.min(marketDepth * 2, 80) +
        (location.type === 'city' ? 20 : 0) +
        (state.research > 0 ? 10 : 0)
      rows.push({
        key,
        market: location.name,
        marketSlug: location.slug,
        marketType: String(location.type || 'market'),
        category: category.name,
        categorySlug: category.slug,
        vertical: String(category.vertical || 'other'),
        providers,
        physical: physicalSet.size,
        serviceOnly,
        cityBusinesses: marketDepth,
        localSearches,
        zeroResultSearches,
        generalSearches,
        lastSearchAt: demand?.last || null,
        historicalMin: demand ? demand.min : null,
        historicalMax: demand ? demand.max : null,
        researchProspects: state.research,
        contactReadyProspects: state.contactReady,
        outreachProspects: state.outreach,
        score,
      })
    }
  }

  const zero = rows.filter(row => row.providers === 0).length
  const oneProvider = rows.filter(row => row.providers === 1).length
  const twoProviders = rows.filter(row => row.providers === 2).length
  const ready = rows.filter(row => row.providers >= 3).length
  const demandGaps = rows.filter(row => row.providers < 3 && row.localSearches > 0)
  const quickWins = rows.filter(row => row.providers === 2).sort((a, b) => b.score - a.score || b.localSearches - a.localSearches)
  const zeroDemandGaps = rows.filter(row => row.providers === 0 && row.localSearches > 0).sort((a, b) => b.localSearches - a.localSearches || b.score - a.score)
  const resolvedDemand = rows.filter(row => row.providers >= 3 && row.localSearches > 0).sort((a, b) => b.localSearches - a.localSearches)
  const researchQueue = rows
    .filter(row => row.providers < 3 && (row.providers > 0 || row.localSearches > 0 || row.generalSearches > 0))
    .sort((a, b) => b.score - a.score || b.providers - a.providers || b.cityBusinesses - a.cityBusinesses)

  const marketSummary = locationRows.map(location => {
    const marketRows = rows.filter(row => row.market === location.name)
    return {
      name: location.name,
      slug: location.slug,
      type: location.type || 'market',
      businesses: cityBusinesses.get(norm(location.name))?.size || 0,
      ready: marketRows.filter(row => row.providers >= 3).length,
      quickWins: marketRows.filter(row => row.providers === 2).length,
      thin: marketRows.filter(row => row.providers === 1).length,
      demandGaps: marketRows.filter(row => row.providers < 3 && row.localSearches > 0).length,
    }
  }).sort((a, b) => b.quickWins - a.quickWins || b.demandGaps - a.demandGaps || b.ready - a.ready || b.businesses - a.businesses)

  let filtered = rows.filter(row => {
    if (marketFilter && row.marketSlug !== marketFilter) return false
    if (categoryFilter && row.categorySlug !== categoryFilter) return false
    if (verticalFilter && row.vertical !== verticalFilter) return false
    if (bucketFilter === 'zero' && row.providers !== 0) return false
    if (bucketFilter === 'one' && row.providers !== 1) return false
    if (bucketFilter === 'two' && row.providers !== 2) return false
    if (bucketFilter === 'ready' && row.providers < 3) return false
    if (demandFilter === 'searched' && row.localSearches === 0) return false
    if (demandFilter === 'zero-result' && row.zeroResultSearches === 0) return false
    if (demandFilter === 'gap' && !(row.localSearches > 0 && row.providers < 3)) return false
    if (q && !`${row.market} ${row.category} ${row.vertical}`.toLowerCase().includes(q)) return false
    return true
  })
  filtered = filtered.sort((a, b) => b.score - a.score || b.providers - a.providers || a.market.localeCompare(b.market) || a.category.localeCompare(b.category))
  const shown = filtered.slice(0, 250)
  const coveragePct = rows.length ? Math.round((ready / rows.length) * 1000) / 10 : 0
  const hasFilters = Boolean(marketFilter || categoryFilter || verticalFilter || bucketFilter || demandFilter || q)
  const verticals = Array.from(new Set(categoryRows.map(row => String(row.vertical || 'other')))).sort()

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Private Growth Intelligence</div>
        <h1>Market Coverage Command Center</h1>
        <p className="muted">Tenant-wide inventory, demand, provider-threshold and acquisition intelligence across every active market/category intersection. Physical locations and legitimate service areas are counted separately; paid plans never influence organic provider counts or ranking.</p>
      </div>
      <span className="badge neutral">Internal only</span>
    </div>

    {errors.length > 0 && <div className="notice warn">One or more inventory inputs could not be loaded. Coverage and demand totals may be incomplete.</div>}
    <div className="notice"><strong>Research integrity:</strong> this dashboard is a prioritization system, not permission to fabricate providers. A market reaches the SEO threshold only with three legitimate published providers connected by an active physical location or a truthful service area. Historical zero-result searches automatically become resolved when current inventory reaches three.</div>

    <div className="stat-grid" style={{ marginTop: 18 }}>
      <div className="stat">Published Connected Businesses<strong>{allConnectedBusinesses.size}</strong></div>
      <div className="stat">Active Markets<strong>{locationRows.length}</strong></div>
      <div className="stat">Active Categories<strong>{categoryRows.length}</strong></div>
      <div className="stat">Market/Category Intersections<strong>{rows.length.toLocaleString()}</strong></div>
      <div className="stat">3+ Provider Markets<strong>{ready}</strong><span className="small muted">{coveragePct}% of intersections</span></div>
      <div className="stat">Exactly 2 Providers<strong>{twoProviders}</strong><span className="small muted">Fastest SEO unlocks</span></div>
      <div className="stat">Exactly 1 Provider<strong>{oneProvider}</strong></div>
      <div className="stat">Zero Providers<strong>{zero}</strong></div>
      <div className="stat">Demand Gaps<strong>{demandGaps.length}</strong><span className="small muted">Searched + under threshold</span></div>
      <div className="stat">Zero-Provider Demand<strong>{zeroDemandGaps.length}</strong></div>
      <div className="stat">Resolved Demand<strong>{resolvedDemand.length}</strong></div>
      <div className="stat">Taxonomy Review Signals<strong>{taxonomyReview}</strong></div>
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div><div className="kpi">Coverage Filters</div><h2>Audit all markets and categories</h2><p className="small muted">Filter the complete live coverage matrix by market, category, vertical, provider depth and demand state.</p></div>
        <div className="admin-row-actions"><Link className="btn btn-light" href="/admin/content-intelligence">Content Intelligence</Link><Link className="btn btn-light" href="/admin/search">Search Intelligence</Link>{hasFilters && <Link className="btn btn-light" href="/admin/inventory-expansion">Reset</Link>}</div>
      </div>
      <form method="get" className="grid grid-3" style={{ alignItems: 'end' }}>
        <label className="field"><span>Market</span><select name="market" defaultValue={marketFilter}><option value="">All markets</option>{locationRows.map(row => <option key={row.id} value={row.slug}>{row.name}</option>)}</select></label>
        <label className="field"><span>Category</span><select name="category" defaultValue={categoryFilter}><option value="">All categories</option>{categoryRows.map(row => <option key={row.id} value={row.slug}>{row.name}</option>)}</select></label>
        <label className="field"><span>Vertical</span><select name="vertical" defaultValue={verticalFilter}><option value="">All verticals</option>{verticals.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="field"><span>Provider Depth</span><select name="bucket" defaultValue={bucketFilter}><option value="">All depths</option><option value="zero">0 providers</option><option value="one">1 provider</option><option value="two">2 providers</option><option value="ready">3+ providers</option></select></label>
        <label className="field"><span>Demand State</span><select name="demand" defaultValue={demandFilter}><option value="">All demand</option><option value="searched">Has local searches</option><option value="zero-result">Has zero-result searches</option><option value="gap">Searched + under 3 providers</option></select></label>
        <label className="field"><span>Search</span><input name="q" defaultValue={one(sp.q)} placeholder="Market, category or vertical" /></label>
        <button className="btn btn-primary" type="submit">Apply Coverage Filters</button>
      </form>
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head"><div><div className="kpi">Fastest SEO Unlocks</div><h2>Exactly two legitimate providers</h2><p className="small muted">These markets need one more legitimate provider to reach the standard three-provider eligibility threshold. Demand and market depth raise priority; sponsorship never does.</p></div><span className="badge neutral">{quickWins.length} total</span></div>
      {quickWins.length ? <div className="grid grid-3">{quickWins.slice(0, 18).map((row, index) => <div className="card" key={row.key}>
        <div className="kpi">#{index + 1} · score {row.score} · {priorityLabel(row.score, row.providers, row.localSearches)}</div>
        <h3>{row.category} in {row.market}, IL</h3>
        <p className="small muted">2/3 providers · {row.physical} physical · {row.serviceOnly} service-area only · {row.cityBusinesses} businesses connected to market · {row.localSearches} local searches · {row.zeroResultSearches} zero-result searches</p>
        <p className="small muted">CRM: {row.researchProspects} research · {row.contactReadyProspects} contact-ready · {row.outreachProspects} outreach-stage</p>
        <div className="admin-row-actions"><Link href={`/illinois/${row.marketSlug}/${row.categorySlug}`} target="_blank">Review public market</Link><Link href="/admin/prospects">Open research CRM</Link></div>
      </div>)}</div> : <div className="notice">No markets are currently exactly one legitimate provider away from the threshold.</div>}
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head"><div><div className="kpi">Automated Research Queue</div><h2>What staff should research next</h2><p className="small muted">Priority combines threshold proximity, current market depth and real search demand. A zero-provider intersection appears here only when there is a reason to research it, such as recorded demand or category-wide demand.</p></div><span className="badge neutral">Top {Math.min(30, researchQueue.length)}</span></div>
      {researchQueue.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Priority</th><th>Market</th><th>Category</th><th>Providers</th><th>Demand</th><th>Coverage</th><th>Research State</th><th>Next Action</th></tr></thead><tbody>{researchQueue.slice(0, 30).map(row => <tr key={row.key}>
        <td><strong>{priorityLabel(row.score, row.providers, row.localSearches)}</strong><div className="small muted">Score {row.score}</div></td>
        <td>{row.market}<div className="small muted">{row.marketType} · {row.cityBusinesses} connected businesses</div></td>
        <td>{row.category}<div className="small muted">{row.vertical}</div></td>
        <td><strong>{row.providers}/3</strong><div className="small muted">{row.physical} physical · {row.serviceOnly} service only</div></td>
        <td>{row.localSearches} local<div className="small muted">{row.zeroResultSearches} zero-result · {row.generalSearches} general</div></td>
        <td>{3 - row.providers} provider{3 - row.providers === 1 ? '' : 's'} needed</td>
        <td>{row.researchProspects ? `${row.researchProspects} research` : 'Needs sourcing'}<div className="small muted">{row.contactReadyProspects} contact-ready · {row.outreachProspects} outreach</div></td>
        <td><Link href={`/illinois/${row.marketSlug}/${row.categorySlug}`} target="_blank">Review market</Link><br/><Link href="/admin/prospects">Research providers</Link></td>
      </tr>)}</tbody></table></div> : <p className="muted">No underfilled market currently has enough evidence to enter the research queue.</p>}
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head"><div><div className="kpi">Demand Reconciliation</div><h2>Historical searches vs current live inventory</h2><p className="small muted">Old zero-result events do not stay critical forever. Current provider inventory determines whether a demand gap is still open.</p></div></div>
      <div className="grid grid-2">
        <div><h3>Open demand gaps</h3>{demandGaps.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Market</th><th>Category</th><th>Searches</th><th>Current</th></tr></thead><tbody>{demandGaps.sort((a, b) => b.localSearches - a.localSearches || b.score - a.score).slice(0, 20).map(row => <tr key={row.key}><td>{row.market}</td><td>{row.category}</td><td>{row.localSearches}<div className="small muted">{row.zeroResultSearches} zero-result</div></td><td>{row.providers}/3</td></tr>)}</tbody></table></div> : <p className="muted">No current searched markets are below threshold.</p>}</div>
        <div><h3>Resolved demand gaps</h3>{resolvedDemand.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Market</th><th>Category</th><th>Searches</th><th>Current</th></tr></thead><tbody>{resolvedDemand.slice(0, 20).map(row => <tr key={row.key}><td>{row.market}</td><td>{row.category}</td><td>{row.localSearches}<div className="small muted">Historical range {row.historicalMin ?? 0}–{row.historicalMax ?? 0}</div></td><td><strong>{row.providers} providers</strong><div className="small muted">Resolved by live inventory</div></td></tr>)}</tbody></table></div> : <p className="muted">No historical low-result searches have been reconciled to 3+ current providers yet.</p>}</div>
      </div>
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head"><div><div className="kpi">Market Rollup</div><h2>Coverage health by city and town</h2><p className="small muted">Use this to decide where a concentrated inventory push can unlock the most category pages efficiently.</p></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Market</th><th>Connected Businesses</th><th>3+ Provider Categories</th><th>2-Provider Quick Wins</th><th>1-Provider Gaps</th><th>Searched Gaps</th></tr></thead><tbody>{marketSummary.slice(0, 30).map(row => <tr key={row.slug}><td><strong>{row.name}</strong><div className="small muted">{row.type}</div></td><td>{row.businesses}</td><td>{row.ready}</td><td>{row.quickWins}</td><td>{row.thin}</td><td>{row.demandGaps}</td></tr>)}</tbody></table></div>
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head"><div><div className="kpi">Acquisition Integration</div><h2>Inventory growth feeds the sales engine</h2><p className="small muted">New listings remain unclaimed and unverified unless evidence says otherwise. Research prospects do not become claim-invite ready until a legitimate owner/manager contact channel exists.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/prospects">Sales CRM</Link><Link className="btn btn-light" href="/admin/outreach">Outreach Tasks</Link><Link className="btn btn-light" href="/admin/growth-opportunities">Growth Opportunities</Link></div></div>
      <div className="stat-grid"><div className="stat">Research Prospects<strong>{researchProspectsTotal}</strong></div><div className="stat">Contact-Ready Prospects<strong>{contactReadyTotal}</strong></div><div className="stat">Prospects With Contact Channel<strong>{contactableTotal}</strong></div></div>
      <div className="notice" style={{ marginTop: 14 }}><strong>Pipeline rule:</strong> Published business → contact research → contactable → claim ready → claimed → paid → Pro → Featured/Sponsor → lead buyer → Skylight marketing client. No stage movement is inferred from a template, search result or paid plan.</div>
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head"><div><div className="kpi">Complete Coverage Matrix</div><h2>{filtered.length.toLocaleString()} matching intersections</h2><p className="small muted">Showing the highest-priority {shown.length} rows after filters. The underlying command center evaluates all {rows.length.toLocaleString()} active market/category combinations.</p></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Score</th><th>Market</th><th>Category</th><th>Providers</th><th>Physical</th><th>Service Only</th><th>Local Searches</th><th>Zero Results</th><th>CRM Research</th><th>Status</th></tr></thead><tbody>{shown.map(row => <tr key={row.key}><td>{row.score}</td><td>{row.market}</td><td>{row.category}<div className="small muted">{row.vertical}</div></td><td><strong>{row.providers}</strong></td><td>{row.physical}</td><td>{row.serviceOnly}</td><td>{row.localSearches}</td><td>{row.zeroResultSearches}</td><td>{row.researchProspects}</td><td>{row.providers >= 3 ? 'Threshold met' : row.providers === 2 ? '1 provider away' : row.providers === 1 ? '2 providers away' : row.localSearches ? 'Demand gap' : 'No current inventory'}</td></tr>)}</tbody></table></div>
    </div>
  </>
}
