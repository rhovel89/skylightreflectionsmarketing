import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const norm = (value: unknown) => String(value || '').trim().toLowerCase()
const ageDays = (value: unknown) => value ? Math.floor((Date.now() - new Date(String(value)).getTime()) / 86400000) : 9999

type DemandRow = {
  service: string
  location: string
  searches: number
  results: number
  min: number
}

export default async function Page() {
  const s = await createClient()
  const ninety = new Date(Date.now() - 90 * 86400000).toISOString()
  const [
    { data: businesses },
    { data: locations },
    { data: categories },
    { data: branches },
    { data: areas },
    { data: bc },
    { data: seo },
    { data: guides },
    { data: searches },
  ] = await Promise.all([
    s.from('businesses').select('id').eq('tenant_id', TENANT_ID).eq('status', 'published').limit(5000),
    s.from('locations').select('id,name,slug').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
    s.from('categories').select('id,name,slug,vertical').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
    s.from('business_locations').select('business_id,location_id').eq('tenant_id', TENANT_ID).eq('is_active', true).limit(15000),
    s.from('business_service_areas').select('business_id,location_id').limit(20000),
    s.from('business_categories').select('business_id,category_id').limit(25000),
    s.from('seo_pages').select('id,market_location_id,category_id,city,category,title,index_mode,reviewed,updated_at').eq('tenant_id', TENANT_ID).limit(5000),
    s.from('guides').select('id,slug,title,type,city,category,summary,body,status,published_at,updated_at').eq('tenant_id', TENANT_ID).eq('status', 'published').order('updated_at', { ascending: true }).limit(3000),
    s.from('search_events').select('service,location,result_count,created_at').eq('tenant_id', TENANT_ID).gte('created_at', ninety).order('created_at', { ascending: false }).limit(5000),
  ])

  const published = new Set((businesses ?? []).map((row: any) => String(row.id)))
  const locMap = new Map((locations ?? []).map((row: any) => [String(row.id), row]))
  const catMap = new Map((categories ?? []).map((row: any) => [String(row.id), row]))
  const locationByTerm = new Map<string, any>()
  const categoryByTerm = new Map<string, any>()

  for (const location of locations ?? []) {
    locationByTerm.set(norm((location as any).name), location)
    locationByTerm.set(norm((location as any).slug), location)
  }
  for (const category of categories ?? []) {
    categoryByTerm.set(norm((category as any).name), category)
    categoryByTerm.set(norm((category as any).slug), category)
  }

  const catsByBusiness = new Map<string, Set<string>>()
  for (const row of bc ?? []) {
    const businessId = String((row as any).business_id)
    const categoryId = String((row as any).category_id)
    if (!published.has(businessId) || !catMap.has(categoryId)) continue
    const set = catsByBusiness.get(businessId) || new Set<string>()
    set.add(categoryId)
    catsByBusiness.set(businessId, set)
  }

  const providersByLocation = new Map<string, Set<string>>()
  const addProvider = (row: any) => {
    const businessId = String(row.business_id || '')
    const locationId = String(row.location_id || '')
    if (!published.has(businessId) || !locMap.has(locationId)) return
    const set = providersByLocation.get(locationId) || new Set<string>()
    set.add(businessId)
    providersByLocation.set(locationId, set)
  }
  for (const row of branches ?? []) addProvider(row)
  for (const row of areas ?? []) addProvider(row)

  const countFor = (locationId: string, categoryId?: string | null) => {
    const providers = providersByLocation.get(locationId) || new Set<string>()
    if (!categoryId) return providers.size
    let count = 0
    for (const businessId of providers) if (catsByBusiness.get(businessId)?.has(categoryId)) count++
    return count
  }

  const globalCountForCategory = (categoryId: string) => {
    let count = 0
    for (const businessId of published) if (catsByBusiness.get(businessId)?.has(categoryId)) count++
    return count
  }

  const reviewedIndexableByKey = new Map<string, any>()
  for (const row of seo ?? []) {
    if (!(row as any).reviewed || (row as any).index_mode === 'noindex') continue
    reviewedIndexableByKey.set(`${String((row as any).market_location_id)}|${String((row as any).category_id || '')}`, row)
  }

  const missingSeo: any[] = []
  for (const location of locations ?? []) {
    const locationId = String((location as any).id)
    const cityProviders = countFor(locationId)
    const cityKey = `${locationId}|`
    if (cityProviders >= 3 && !reviewedIndexableByKey.get(cityKey)) {
      missingSeo.push({ city: (location as any).name, category: 'City page', providers: cityProviders, kind: 'city' })
    }
    const catCounts = new Map<string, number>()
    for (const businessId of providersByLocation.get(locationId) || []) {
      for (const categoryId of catsByBusiness.get(businessId) || []) {
        catCounts.set(categoryId, (catCounts.get(categoryId) || 0) + 1)
      }
    }
    for (const [categoryId, count] of catCounts) {
      if (count < 3 || reviewedIndexableByKey.get(`${locationId}|${categoryId}`)) continue
      const category = catMap.get(categoryId)
      if (category) missingSeo.push({ city: (location as any).name, category: (category as any).name, providers: count, kind: 'category' })
    }
  }
  missingSeo.sort((a, b) => b.providers - a.providers || a.city.localeCompare(b.city))

  const underfilled = (seo ?? [])
    .map((row: any) => ({
      id: row.id,
      city: row.city,
      category: row.category || 'City page',
      providers: countFor(String(row.market_location_id), row.category_id ? String(row.category_id) : null),
      reviewed: Boolean(row.reviewed),
      index_mode: row.index_mode,
      updated_at: row.updated_at,
    }))
    .filter((row: any) => row.reviewed && row.index_mode !== 'noindex' && row.providers < 3)
    .sort((a: any, b: any) => a.providers - b.providers || a.city.localeCompare(b.city))

  const guideIssues = (guides ?? [])
    .map((guide: any) => {
      const chars = String(guide.body || '').trim().length
      const summaryChars = String(guide.summary || '').trim().length
      const days = ageDays(guide.updated_at)
      const issues: string[] = []
      if (chars < 1200) issues.push(`Thin body · ${chars} chars`)
      if (summaryChars < 80) issues.push(`Short summary · ${summaryChars} chars`)
      if (days > 180) issues.push(`Stale · ${days} days since update`)
      if (!String(guide.city || '').trim()) issues.push('No city assigned')
      return { ...guide, chars, summaryChars, days, issues }
    })
    .filter((guide: any) => guide.issues.length)
    .sort((a: any, b: any) => b.issues.length - a.issues.length || a.chars - b.chars)

  const dupMap = new Map<string, any[]>()
  for (const guide of guides ?? []) {
    const key = `${norm((guide as any).type)}|${norm((guide as any).city)}|${norm((guide as any).category)}`
    const group = dupMap.get(key) || []
    group.push(guide)
    dupMap.set(key, group)
  }
  const duplicates = [...dupMap.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      city: (group[0] as any).city || 'No city',
      category: (group[0] as any).category || 'General',
      type: (group[0] as any).type || 'Guide',
      count: group.length,
      titles: group.map((row: any) => row.title),
    }))
    .sort((a, b) => b.count - a.count)

  const searchMap = new Map<string, DemandRow>()
  for (const row of searches ?? []) {
    const service = String((row as any).service || '').trim() || 'Any service'
    const location = String((row as any).location || '').trim() || 'Any location'
    const key = `${norm(service)}|${norm(location)}`
    const value = searchMap.get(key) || { service, location, searches: 0, results: 0, min: 99999 }
    value.searches++
    value.results += Number((row as any).result_count || 0)
    value.min = Math.min(value.min, Number((row as any).result_count || 0))
    searchMap.set(key, value)
  }

  const historicalDemand = [...searchMap.values()]
    .map(row => {
      const historicalAvg = Math.round(row.results / Math.max(1, row.searches) * 10) / 10
      const location = row.location === 'Any location' ? null : locationByTerm.get(norm(row.location))
      const category = row.service === 'Any service' ? null : categoryByTerm.get(norm(row.service))
      const locationKnown = row.location === 'Any location' || Boolean(location)
      const categoryKnown = row.service === 'Any service' || Boolean(category)
      let currentProviders: number | null = null

      if (locationKnown && categoryKnown) {
        if (location && category) currentProviders = countFor(String((location as any).id), String((category as any).id))
        else if (location) currentProviders = countFor(String((location as any).id))
        else if (category) currentProviders = globalCountForCategory(String((category as any).id))
        else currentProviders = published.size
      }

      const gapToThree = currentProviders == null ? null : Math.max(0, 3 - currentProviders)
      return { ...row, historicalAvg, currentProviders, gapToThree, locationKnown, categoryKnown }
    })
    .filter(row => row.historicalAvg < 3)

  const demandGaps = historicalDemand
    .filter(row => row.currentProviders == null || row.currentProviders < 3)
    .sort((a, b) => b.searches - a.searches || (a.currentProviders ?? -1) - (b.currentProviders ?? -1) || a.historicalAvg - b.historicalAvg)
    .slice(0, 40)

  const resolvedDemandGaps = historicalDemand
    .filter(row => row.currentProviders != null && row.currentProviders >= 3)
    .sort((a, b) => b.searches - a.searches || b.currentProviders! - a.currentProviders!)

  const priorityFor = (row: typeof demandGaps[number]) => {
    if (!row.locationKnown || !row.categoryKnown || row.currentProviders == null) return 'Taxonomy review'
    if (row.searches >= 10 && row.currentProviders === 0) return 'Critical'
    if (row.searches >= 3 && row.currentProviders < 2) return 'High'
    if (row.currentProviders === 0) return 'Recruit providers'
    return `Add ${Math.max(1, 3 - row.currentProviders)} provider${3 - row.currentProviders === 1 ? '' : 's'}`
  }

  const eligibleSeo = (seo ?? []).filter((row: any) => row.reviewed && row.index_mode !== 'noindex' && countFor(String(row.market_location_id), row.category_id ? String(row.category_id) : null) >= 3).length

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Private Content & Market Intelligence</div>
        <h1>SEO Coverage, Guide Quality & Inventory Opportunities</h1>
        <p className="muted">Staff-only queues for index eligibility, missing reviewed SEO, guide freshness, overlapping content intent and customer searches that are returning too few providers. None of these diagnostics appear in customer accounts or public pages.</p>
      </div>
      <span className="badge sponsored">Internal only</span>
    </div>

    <div className="stat-grid">
      <div className="stat">Index-Eligible SEO Pages<strong>{eligibleSeo}</strong></div>
      <div className="stat">Eligible Pages Missing SEO<strong>{missingSeo.length}</strong></div>
      <div className="stat">Reviewed Pages Under Threshold<strong>{underfilled.length}</strong></div>
      <div className="stat">Published Guides<strong>{(guides ?? []).length}</strong></div>
      <div className="stat">Guide Review Queue<strong>{guideIssues.length}</strong></div>
      <div className="stat">Duplicate Intent Clusters<strong>{duplicates.length}</strong></div>
      <div className="stat">Resolved Demand Gaps<strong>{resolvedDemandGaps.length}</strong></div>
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head"><div>
        <div className="kpi">Index Expansion Queue</div>
        <h2>Markets with enough providers but no reviewed indexable SEO page</h2>
        <p className="small muted">A market enters this queue only after it has at least three published providers connected by an active physical location or clearly labeled service area. Paid placement does not affect provider counts. A reviewed page explicitly set to noindex remains out of the indexable set until staff changes that mode.</p>
      </div></div>
      {missingSeo.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>City</th><th>Page / Category</th><th>Providers</th><th>Opportunity</th></tr></thead><tbody>{missingSeo.slice(0, 60).map((row: any, index: number) => <tr key={`${row.city}-${row.category}-${index}`}><td>{row.city}</td><td>{row.category}</td><td>{row.providers}</td><td>{row.kind === 'city' ? 'Create/review city SEO page' : 'Create/review city-category SEO page'}</td></tr>)}</tbody></table></div> : <p className="muted">No index-eligible coverage gaps are currently missing a reviewed indexable SEO page.</p>}
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head"><div>
        <div className="kpi">Protected Noindex Queue</div>
        <h2>Indexable-mode SEO pages still below the provider threshold</h2>
        <p className="small muted">These pages remain protected from indexing until provider inventory reaches three. The correct action is usually inventory expansion, not forcing indexation. Pages explicitly set to noindex are intentional and excluded from this mismatch queue.</p>
      </div></div>
      {underfilled.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>City</th><th>Page / Category</th><th>Providers</th><th>Index Mode</th><th>Recommended Action</th></tr></thead><tbody>{underfilled.slice(0, 60).map((row: any) => <tr key={row.id}><td>{row.city}</td><td>{row.category}</td><td>{row.providers}</td><td>{row.index_mode}</td><td>{row.providers === 0 ? 'Recruit / verify provider inventory' : 'Add provider inventory before index eligibility'}</td></tr>)}</tbody></table></div> : <p className="muted">All reviewed SEO pages in an indexable mode currently meet the three-provider threshold.</p>}
    </div>

    <div className="grid grid-2" style={{ marginTop: 18 }}>
      <div className="admin-card">
        <div className="kpi">Guide Quality & Freshness</div>
        <h2>Published guides needing staff review</h2>
        <p className="small muted">This is a review queue, not an automatic takedown system. Thinness is initially flagged below 1,200 body characters; freshness is flagged after 180 days.</p>
        {guideIssues.length ? <div className="lead-route-list">{guideIssues.slice(0, 30).map((guide: any) => <div className="info-row" key={guide.id}><span>{guide.title}<small className="muted" style={{ display: 'block' }}>{guide.city || 'No city'} · {guide.category || guide.type || 'General'}</small></span><strong>{guide.issues.join(' · ')}</strong></div>)}</div> : <p className="muted">No published guides currently trigger the review thresholds.</p>}
      </div>
      <div className="admin-card">
        <div className="kpi">Duplicate Intent Review</div>
        <h2>Guide clusters that may overlap</h2>
        <p className="small muted">Matching city + category + guide type is a review signal only. Staff should merge, differentiate or cross-link based on actual search intent.</p>
        {duplicates.length ? <div className="lead-route-list">{duplicates.slice(0, 20).map(row => <div className="admin-card" key={row.key} style={{ marginTop: 10 }}><strong>{row.city} · {row.category} · {row.type}</strong><p className="small muted">{row.count} guides: {row.titles.join(' · ')}</p></div>)}</div> : <p className="muted">No duplicate intent clusters were detected by the current grouping rule.</p>}
      </div>
    </div>

    <div className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head"><div>
        <div className="kpi">Search Demand / Inventory Expansion</div>
        <h2>Historical low-result searches reconciled with today’s provider inventory</h2>
        <p className="small muted">Search volume and historical averages cover the last 90 days. Current Providers is recalculated from today’s published physical-location and legitimate service-area inventory, so a repaired historical gap automatically leaves this open queue. Unmapped search terms are routed to taxonomy review instead of being treated as confirmed zero-provider markets.</p>
      </div></div>
      {demandGaps.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Service</th><th>Location</th><th>Searches</th><th>Historical Avg.</th><th>Current Providers</th><th>Gap to 3</th><th>Priority</th></tr></thead><tbody>{demandGaps.map(row => <tr key={`${row.service}-${row.location}`}><td>{row.service}</td><td>{row.location}</td><td>{row.searches}</td><td>{row.historicalAvg}</td><td>{row.currentProviders == null ? 'Needs mapping' : row.currentProviders}</td><td>{row.gapToThree == null ? '—' : row.gapToThree}</td><td>{priorityFor(row)}</td></tr>)}</tbody></table></div> : <p className="muted">No unresolved low-result search clusters were recorded in the last 90 days.</p>}
      {resolvedDemandGaps.length > 0 && <p className="small muted" style={{ marginTop: 12 }}>{resolvedDemandGaps.length} historical low-result cluster{resolvedDemandGaps.length === 1 ? '' : 's'} now meet the three-provider inventory threshold and are excluded from the open expansion queue.</p>}
    </div>
  </>
}
