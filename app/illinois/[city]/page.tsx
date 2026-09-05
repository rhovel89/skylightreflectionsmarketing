import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { BusinessCard } from '@/components/BusinessCard'
import { FeaturedBusinessSidebar } from '@/components/FeaturedBusinessSidebar'
import { SearchForm } from '@/components/SearchForm'
import { GrowthTrackedLink } from '@/components/GrowthTracking'
import { getBusinesses, getCategories, getLocations, getSeoPage, getGuides, getFeaturedSidebarBusinesses } from '@/lib/data'
import { getSearchAvailability } from '@/lib/search-availability'
import { getSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params
  const locations = await getLocations()
  const loc = locations.find(l => l.slug === city)
  if (!loc) return {}
  const [seo, eligible] = await Promise.all([getSeoPage(loc.name), getBusinesses({ city, limit: 3 })])
  const title = seo?.title || `Local Businesses in ${loc.name}, IL`
  const description = seo?.description || `Explore local businesses in ${loc.name}, Illinois.`
  const canonical = `${getSiteUrl()}/illinois/${city}`
  return {
    title: seo?.title ? { absolute: seo.title } : title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title, description, siteName: 'Central Illinois Local Pros' },
    robots: { index: Boolean(seo && seo.reviewed && seo.index_mode !== 'noindex' && eligible.length >= 3), follow: true },
  }
}

export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params
  const locations = await getLocations()
  const loc = locations.find(l => l.slug === city)
  if (!loc) notFound()

  const [businesses, cats, seo, guides, featured, availability] = await Promise.all([
    getBusinesses({ city, limit: 150 }),
    getCategories(),
    getSeoPage(loc.name),
    getGuides(120),
    getFeaturedSidebarBusinesses({ city, pagePath: `/illinois/${city}`, limit: 4 }),
    getSearchAvailability(),
  ])

  const counts = new Map<string, number>()
  for (const b of businesses) {
    const seen = new Set<string>()
    for (const link of (b as any).business_categories ?? []) {
      const slug = link.categories?.slug
      if (slug && !seen.has(slug)) {
        counts.set(slug, (counts.get(slug) || 0) + 1)
        seen.add(slug)
      }
    }
  }

  const cityCats = cats
    .map(c => ({ ...c, count: counts.get(c.slug) || 0 }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  const cityGuides = (guides as any[]).filter(g => g.city === loc.name).slice(0, 3)
  const base = getSiteUrl()
  const canonical = `${base}/illinois/${city}`
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: base },
      { '@type': 'ListItem', position: 2, name: 'Illinois', item: `${base}/illinois` },
      { '@type': 'ListItem', position: 3, name: `${loc.name}, IL`, item: canonical },
    ],
  }
  const sponsorHref = `/contact?reason=visibility-plan&plan=sponsorship&city=${encodeURIComponent(loc.name)}&source=city-page#marketing-review`

  return <SiteShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\u003c') }} />
    <main>
      <section className="pagehero city-discovery-hero"><div className="container">
        <div className="crumb"><Link href="/illinois">Illinois</Link> › {loc.name}</div>
        <h1>{seo?.h1 || `Local Businesses in ${loc.name}, Illinois`}</h1>
        <p>{seo?.intro || `Explore local services, attorneys, restaurants and stores connected to ${loc.name} through active physical locations or clearly labeled service areas.`}</p>
        <div className="market-stats">
          <span><strong>{businesses.length}</strong> published businesses</span>
          <span><strong>{cityCats.length}</strong> active categories</span>
          {loc.county && <span><strong>{loc.county}</strong> County</span>}
        </div>
        <div className="city-hero-actions"><a className="btn btn-primary" href="#browse-categories">Browse Categories</a><a className="btn btn-light" href="#businesses">View Businesses</a><Link className="btn btn-light" href={`/search?city=${encodeURIComponent(city)}`}>Search {loc.name}</Link></div>
      </div></section>

      <section className="section"><div className="container">
        <div className="city-trust-grid">
          <div><span>Physical location</span><strong>Actual published office or storefront</strong><small>Addresses shown as locations come from an active business location record.</small></div>
          <div><span>Service area</span><strong>Serves {loc.name}, not an office claim</strong><small>Service-area matches stay clearly labeled and are never represented as a local branch.</small></div>
          <div><span>Sponsored</span><strong>Paid visibility stays labeled</strong><small>Featured advertising is separate from normal organic directory ordering.</small></div>
          <div><span>Owner access</span><strong>Claims are staff reviewed</strong><small>Claimed and Verified are separate states; a claim does not require payment.</small></div>
        </div>

        <div className="search-panel city-search-panel"><div className="city-search-copy"><strong>Search within {loc.name}</strong><span>Choose a category or enter a business/service keyword.</span></div><SearchForm categories={cats} locations={locations} defaults={{ city }} availability={availability} /></div>

        <div className="featured-content-layout" style={{ marginTop: 24 }}>
          <div className="featured-content-main">
            <section id="browse-categories" className="city-category-section">
              <div className="section-head"><div><div className="kpi">Explore {loc.name}</div><h2>Browse Local Categories</h2><p className="muted">Only categories with currently published business inventory connected to this market are shown.</p></div><Link href={`/search?city=${encodeURIComponent(city)}`}>Search everything →</Link></div>
              {cityCats.length
                ? <div className="grid grid-4 city-category-grid">{cityCats.slice(0, 16).map(c => <Link className="card category-card city-category-card" key={c.id} href={`/illinois/${city}/${c.slug}`}><span className="city-category-count">{c.count}</span><strong>{c.name}</strong><p className="small muted">published business{c.count === 1 ? '' : 'es'}</p><b>Compare {c.name} →</b></Link>)}</div>
                : <div className="empty empty-rich"><h3>Published category inventory is still being developed.</h3><p>Use search to look for a business name or browse another nearby market.</p><Link className="btn btn-light" href="/illinois">Browse Central Illinois</Link></div>}
            </section>

            {seo?.content && <div className="card local-copy city-local-copy"><div className="kpi">Local Guide</div><p className="muted">{seo.content}</p></div>}

            {cityGuides.length > 0 && <section className="inline-guide-section">
              <div className="section-head compact-head"><div><div className="kpi">Local reading</div><h2>Guides for {loc.name}</h2><p className="muted">Practical articles connected to this market.</p></div><Link href={`/guides?city=${encodeURIComponent(loc.name)}`}>All {loc.name} guides →</Link></div>
              <div className="inline-guide-grid">{cityGuides.map((g: any) => <Link className="inline-guide-card" key={g.id} href={`/guides/${g.slug}`}><span>{g.type === 'local_guide' ? 'City & Category Guide' : g.type || 'Local Guide'}</span><strong>{g.title}</strong><p>{g.summary}</p></Link>)}</div>
            </section>}

            <section id="businesses" className="city-business-section">
              <div className="section-head business-heading"><div><div className="kpi">Live directory inventory</div><h2>Businesses Serving {loc.name}</h2><p className="muted">Canonical profiles connected to this market by an active physical location or a clearly labeled service area. Service areas are never represented as offices; Featured advertising is shown separately.</p></div><Link className="btn btn-light" href={`/search?city=${encodeURIComponent(city)}`}>Search {loc.name}</Link></div>
              {businesses.length
                ? <div className="business-list">{businesses.map(b => <BusinessCard key={b.id} business={b} />)}</div>
                : <div className="empty empty-rich"><h3>No published provider inventory is available yet.</h3><p>Inventory remains excluded until legitimate business records are reviewed and published.</p><Link className="btn btn-light" href="/illinois">Browse another market</Link></div>}
            </section>

            <div className="city-owner-panel">
              <div><div className="kpi">For {loc.name} Business Owners</div><h2>Already listed? Claim it before creating anything new.</h2><p>Claiming an existing business remains free and staff reviewed. If the business is truly missing, submit one business record for review. Optional sponsorship can add clearly labeled paid visibility in {loc.name}, but it does not change organic directory ordering, verification or editorial relevance.</p></div>
              <div className="city-owner-actions"><Link className="btn btn-primary" href={`/search?claim=1&city=${encodeURIComponent(city)}`}>Find & Claim My Business</Link><Link className="btn btn-light" href="/list-your-business">Submit Missing Business</Link><GrowthTrackedLink eventType="market_sponsorship_click" city={loc.name} plan="sponsorship" source="city-page" className="btn btn-light" href={sponsorHref}>Ask About {loc.name} Sponsorship</GrowthTrackedLink></div>
            </div>
          </div>
          <FeaturedBusinessSidebar businesses={featured as any[]} contextLabel={`${loc.name}, Illinois`} />
        </div>
      </div></section>
    </main>
  </SiteShell>
}
