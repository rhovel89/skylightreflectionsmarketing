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
      <section className="pagehero"><div className="container">
        <div className="crumb">Illinois › {loc.name}</div>
        <h1>{seo?.h1 || `Local Businesses in ${loc.name}, Illinois`}</h1>
        <p>{seo?.intro || `Explore local services, attorneys, restaurants and stores connected to ${loc.name} through active physical locations or clearly labeled service areas.`}</p>
        <div className="market-stats">
          <span><strong>{businesses.length}</strong> published businesses</span>
          <span><strong>{cityCats.length}</strong> active categories</span>
          {loc.county && <span><strong>{loc.county}</strong> County</span>}
        </div>
      </div></section>

      <section className="section"><div className="container">
        <div className="search-panel"><SearchForm categories={cats} locations={locations} defaults={{ city }} availability={availability} /></div>
        <div className="featured-content-layout" style={{ marginTop: 24 }}>
          <div className="featured-content-main">
            <div className="section-head"><div>
              <div className="kpi">Explore {loc.name}</div>
              <h2>Browse Local Categories</h2>
              <p className="muted">Categories shown here currently have published provider inventory connected to this market.</p>
            </div></div>

            {cityCats.length
              ? <div className="grid grid-4">{cityCats.slice(0, 12).map(c => <Link className="card category-card" key={c.id} href={`/illinois/${city}/${c.slug}`}><strong>{c.name}</strong><p className="small muted">{c.count} published business{c.count === 1 ? '' : 'es'}</p></Link>)}</div>
              : <div className="empty">Published category inventory is still being developed for this market.</div>}

            {seo?.content && <div className="card local-copy"><div className="kpi">Local Guide</div><p className="muted">{seo.content}</p></div>}

            {cityGuides.length > 0 && <section className="inline-guide-section">
              <div className="section-head compact-head"><div>
                <div className="kpi">Local reading</div>
                <h2>Guides for {loc.name}</h2>
                <p className="muted">Practical articles connected to this market.</p>
              </div><Link href={`/guides?city=${encodeURIComponent(loc.name)}`}>All {loc.name} guides →</Link></div>
              <div className="inline-guide-grid">{cityGuides.map((g: any) => <Link className="inline-guide-card" key={g.id} href={`/guides/${g.slug}`}><span>{g.type === 'local_guide' ? 'City & Category Guide' : g.type || 'Local Guide'}</span><strong>{g.title}</strong><p>{g.summary}</p></Link>)}</div>
            </section>}

            <div className="section-head business-heading"><div>
              <h2>Businesses Serving {loc.name}</h2>
              <p className="muted">Canonical business profiles connected to this market by an active physical location or a clearly labeled service area. Service areas are never represented as offices, and Featured advertising is displayed separately.</p>
            </div><Link href={`/search?city=${encodeURIComponent(city)}`}>Search {loc.name} →</Link></div>

            {businesses.length
              ? <div className="business-list">{businesses.map(b => <BusinessCard key={b.id} business={b} />)}</div>
              : <div className="empty">No published provider inventory is available for this market yet.</div>}

            <div className="card local-copy" style={{ marginTop: 24 }}>
              <div className="kpi">For {loc.name} Business Owners</div>
              <h2>Interested in clearly labeled local visibility?</h2>
              <p className="muted">Claiming or submitting a business remains free. Optional sponsorship can add clearly labeled paid visibility in the {loc.name} market, but it does not change organic directory ordering, verification or editorial relevance.</p>
              <GrowthTrackedLink eventType="market_sponsorship_click" city={loc.name} plan="sponsorship" source="city-page" className="btn btn-light" href={sponsorHref}>Ask About {loc.name} Sponsorship</GrowthTrackedLink>
            </div>
          </div>
          <FeaturedBusinessSidebar businesses={featured as any[]} contextLabel={`${loc.name}, Illinois`} />
        </div>
      </div></section>
    </main>
  </SiteShell>
}
