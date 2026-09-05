import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { BusinessCard } from '@/components/BusinessCard'
import { FeaturedBusinessSidebar } from '@/components/FeaturedBusinessSidebar'
import { SearchForm } from '@/components/SearchForm'
import { getBusinesses, getCategories, getLocations, getFeaturedSidebarBusinesses, recordListingEvents, recordSearchEvent } from '@/lib/data'
import { getSearchAvailability } from '@/lib/search-availability'
import { resolveCategoryIntent } from '@/lib/search-intent'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Search Local Businesses',
  description: 'Search published Central Illinois local business profiles by category, city, or business name.',
  robots: { index: false, follow: true },
}

const relatedCategoryMap: Record<string, string[]> = {
  'mobile-pet-grooming': ['pet-grooming', 'dog-grooming'],
  'mobile-nail-trimming': ['pet-grooming', 'dog-grooming'],
  'cat-grooming': ['pet-grooming'],
}

function automatedRequest(userAgent: string, params: Record<string, string | string[] | undefined>) {
  if (typeof params._vercel_share === 'string' || params.internal_check === '1') return true
  return /curl|bot\b|crawler|spider|slurp|headless|lighthouse|pagespeed/i.test(userAgent)
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const category = typeof sp.category === 'string' ? sp.category : undefined
  const city = typeof sp.city === 'string' ? sp.city : undefined
  const q = typeof sp.q === 'string' ? sp.q : undefined
  const claim = sp.claim === '1'
  const intent = !category && q?.trim() ? resolveCategoryIntent(q) : null
  const effectiveCategory = category || intent?.slug
  const keyword = intent && !category ? undefined : q

  const [cats, locations, businesses, featured, availability] = await Promise.all([
    getCategories(),
    getLocations(),
    getBusinesses({ category: effectiveCategory, city, q: keyword, limit: 150 }),
    getFeaturedSidebarBusinesses({ category: effectiveCategory, city, pagePath: '/search', limit: 4 }),
    getSearchAvailability(),
  ])

  const catLabel = cats.find(c => c.slug === effectiveCategory)?.name
  const cityLabel = locations.find(l => l.slug === city)?.name
  const intentLabel = intent && catLabel && q?.trim() ? `“${q.trim()}” → ${catLabel}` : undefined
  const filters = [intentLabel || catLabel, cityLabel, !intent && q?.trim() ? `“${q.trim()}”` : undefined].filter(Boolean) as string[]
  const requestHeaders = await headers()
  const isAutomated = automatedRequest(requestHeaders.get('user-agent') || '', sp)

  if (!isAutomated) {
    await Promise.all([
      recordSearchEvent(catLabel || q?.trim() || undefined, cityLabel, businesses.length),
      recordListingEvents(businesses.map(b => b.id), 'impression'),
    ])
  }

  const context = [catLabel, cityLabel].filter(Boolean).join(' in ') || 'Central Illinois local search'
  const browseCats = city ? cats.filter(c => Number(availability[city]?.[c.slug] ?? 0) > 0) : cats
  const relatedCats = businesses.length === 0 && city && effectiveCategory
    ? (relatedCategoryMap[effectiveCategory] ?? []).map(slug => {
        const cat = cats.find(c => c.slug === slug)
        const count = Number(availability[city]?.[slug] ?? 0)
        return cat && count > 0 ? { cat, count } : null
      }).filter((x): x is { cat: (typeof cats)[number], count: number } => Boolean(x))
    : []

  return <SiteShell>
    <main>
      <section className="pagehero"><div className="container">
        <div className="eyebrow">{claim?'Business Owner Claim Search':'Central Illinois Local Search'}</div>
        <h1>{claim?'Find Your Business Listing':'Find Local Businesses'}</h1>
        <p>{claim?'Search the existing directory before creating anything new. Opening the correct profile lets you submit a free ownership claim for staff review.':'Search published local profiles by category, city, business name, or common service phrases. Category choices automatically reflect the businesses currently available in the selected city or town.'}</p>
      </div></section>
      <section className="section"><div className="container">
        {claim && <div className="claim-search-guide">
          <div className="claim-search-guide-head"><div><div className="kpi">Free owner claim</div><h2>Use the existing listing when one already exists.</h2><p className="muted">This prevents duplicate business profiles and keeps source-backed public information connected to the correct business record.</p></div><Link className="btn btn-light" href="/list-your-business">Business not listed?</Link></div>
          <div className="claim-search-steps"><div><span>1</span><strong>Search</strong><small>Use the business name and city to find the correct public profile.</small></div><div><span>2</span><strong>Open</strong><small>Select the matching profile. A claimed badge means an owner connection already exists.</small></div><div><span>3</span><strong>Claim</strong><small>Submit your role and contact information. Staff reviews ownership before portal access.</small></div></div>
          <div className="claim-search-trust"><strong>Claiming is free.</strong><span>Claimed ≠ Verified · Payment is not required · A claim never buys organic rank.</span></div>
        </div>}
        <div className="search-panel"><SearchForm categories={cats} locations={locations} defaults={{ category, city, q }} availability={availability} /></div>
        {intent && catLabel && <div className="notice" style={{ marginTop: 16 }}><strong>Search intent matched:</strong> “{q?.trim()}” is being interpreted as <strong>{catLabel}</strong>. Results still use normal organic relevance and location rules; this mapping does not create or promote providers.</div>}
        <div className="featured-content-layout" style={{ marginTop: 24 }}>
          <div className="featured-content-main">
            <div className="results-toolbar">
              <div>
                <span className="kpi">{businesses.length} result{businesses.length === 1 ? '' : 's'}</span>
                {claim&&businesses.length>0?<p className="small muted claim-results-helper">Open the correct business profile below to continue the ownership claim.</p>:null}
                {filters.length > 0 && <div className="filter-pills">{filters.map(f => <span className="filter-pill" key={f}>{f}</span>)}</div>}
              </div>
              {filters.length > 0 && <Link className="btn btn-light" href={claim ? '/search?claim=1' : '/search'}>Clear filters</Link>}
            </div>
            {businesses.length
              ? <div className="business-list">{businesses.map(b => <BusinessCard key={b.id} business={b} claimMode={claim} />)}</div>
              : <div className="empty empty-rich">
                  <h2>{claim?'We could not find that business yet':'No matching businesses found'}</h2>
                  <p>{claim?'Try the exact business name, a shorter version of the name, or the city. If the business truly is not listed, submit one business record for staff review instead of creating duplicates.':cityLabel ? 'That service or category is not currently represented by a published listing in this market. Choose another available category or search by business name.' : 'Try removing one filter, choosing a nearby Central Illinois market, or searching by the business name.'}</p>
                  {relatedCats.length > 0 && <div className="card" style={{ margin: '18px 0', textAlign: 'left' }}>
                    <div className="kpi">Related local options</div>
                    <h3>Related providers in {cityLabel}</h3>
                    <p className="small muted">These are related local options only. They are not being represented as the exact service you searched for.</p>
                    <div className="grid grid-2" style={{ marginTop: 12 }}>{relatedCats.map(({ cat, count }) =>
                      <Link className="card category-card" key={cat.id} href={`/search?category=${encodeURIComponent(cat.slug)}&city=${encodeURIComponent(city!)}${claim ? '&claim=1' : ''}`}>
                        <strong>{cat.name}</strong><p className="small muted">{count} published local {count === 1 ? 'profile' : 'profiles'}</p>
                      </Link>)}</div>
                  </div>}
                  <div className="card-actions claim-empty-actions"><Link className="btn btn-primary" href={claim ? '/search?claim=1' : '/search'}>Browse all published businesses</Link>{claim&&<Link className="btn btn-light" href="/list-your-business">Submit a New Business for Review</Link>}</div>
                </div>}
            <div className="section-head search-browse-head"><div>
              <h2>{cityLabel ? `Browse Categories in ${cityLabel}` : 'Browse Popular Categories'}</h2>
              <p className="muted">{cityLabel ? 'Only categories with at least one published business in this market are shown below.' : 'Prefer to browse? Start with a category and narrow by city.'}</p>
            </div></div>
            <div className="grid grid-4">{browseCats.slice(0, 12).map(c => {
              const n = city ? Number(availability[city]?.[c.slug] ?? 0) : 0
              return <Link className="card category-card" key={c.id} href={`/search?category=${encodeURIComponent(c.slug)}${city ? `&city=${encodeURIComponent(city)}` : ''}${claim ? '&claim=1' : ''}`}>
                <strong>{c.name}</strong><p className="small muted">{city ? `${n} published local ${n === 1 ? 'profile' : 'profiles'}` : 'View published local profiles'}</p>
              </Link>
            })}</div>
          </div>
          <FeaturedBusinessSidebar businesses={featured as any[]} contextLabel={context} />
        </div>
      </div></section>
    </main>
  </SiteShell>
}
