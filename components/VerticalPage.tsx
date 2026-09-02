import Link from 'next/link'
import { SiteShell } from './SiteShell'
import { SearchForm } from './SearchForm'
import { BusinessCard } from './BusinessCard'
import { FeaturedBusinessSidebar } from './FeaturedBusinessSidebar'
import {
  getBusinesses,
  getCategories,
  getLocations,
  getGuides,
  getFeaturedSidebarBusinesses,
} from '@/lib/data'
import { getSiteUrl } from '@/lib/site-url'

const guideTypeByVertical: Record<string, string> = {
  home: 'Homeowner Guide',
  legal: 'Legal Guide',
  restaurant: 'Dining Guide',
  retail: 'Shopping Guide',
}

const pathByVertical: Record<string, string> = {
  home: '/home-services',
  legal: '/legal-services',
  restaurant: '/restaurants',
  retail: '/local-stores',
}

const placementByVertical: Record<string, string> = {
  home: 'home_services_sidebar',
  legal: 'attorney_sidebar',
  restaurant: 'restaurant_sidebar',
  retail: 'local_stores_sidebar',
}

export async function VerticalPage({
  vertical,
  title,
  description,
}: {
  vertical: string
  title: string
  description: string
}) {
  const path = pathByVertical[vertical] || '/'

  // Load enough inventory to determine which categories are genuinely populated.
  // The public category cards and vertical search dropdown must never advertise an
  // empty category simply because that category is active in the database.
  const [cats, inventory, locations, guides, featured] = await Promise.all([
    getCategories(vertical),
    getBusinesses({ vertical, limit: 1000 }),
    getLocations(),
    getGuides(120),
    getFeaturedSidebarBusinesses({
      pagePath: path,
      placement: placementByVertical[vertical],
      limit: 4,
    }),
  ])

  const usedCategorySlugs = new Set(
    (inventory as any[]).flatMap((business: any) =>
      (business.business_categories ?? [])
        .map((row: any) => row.categories?.slug)
        .filter(Boolean),
    ),
  )

  const visibleCats = cats.filter((category) => usedCategorySlugs.has(category.slug))
  const businesses = inventory.slice(0, 60)
  const categoryNames = new Set(visibleCats.map((category) => category.name))
  const preferredType = guideTypeByVertical[vertical]
  const relevant = (guides as any[])
    .filter(
      (guide) =>
        (preferredType && guide.type === preferredType) ||
        (guide.category && categoryNames.has(guide.category)),
    )
    .slice(0, 3)

  const base = getSiteUrl()
  const canonical = `${base}${path}`
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: base },
        { '@type': 'ListItem', position: 2, name: title, item: canonical },
      ],
    },
    ...(businesses.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `Published ${title} in Central Illinois`,
            itemListOrder: 'https://schema.org/ItemListUnordered',
            numberOfItems: businesses.length,
            itemListElement: businesses.map((business: any, index: number) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: {
                '@type': 'LocalBusiness',
                name: business.name,
                url: `${base}/business/${business.slug}`,
              },
            })),
          },
        ]
      : []),
  ]

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <main>
        <section className="pagehero">
          <div className="container">
            <div className="crumb">Home › {title}</div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <SearchForm categories={visibleCats} locations={locations} />

            <div className="featured-content-layout" style={{ marginTop: 24 }}>
              <div className="featured-content-main">
                <div className="grid grid-4">
                  {visibleCats.map((category) => (
                    <Link
                      className="card"
                      key={category.id}
                      href={`/search?category=${category.slug}`}
                    >
                      <strong>{category.name}</strong>
                      <p className="muted small">Browse local {category.name.toLowerCase()}</p>
                    </Link>
                  ))}
                </div>

                {relevant.length > 0 && (
                  <section className="inline-guide-section">
                    <div className="section-head compact-head">
                      <div>
                        <div className="kpi">Helpful local reading</div>
                        <h2>{title} Guides</h2>
                        <p className="muted">
                          Practical articles to help you plan, compare and make better-informed local decisions.
                        </p>
                      </div>
                      <Link href="/guides">All Local Guides →</Link>
                    </div>
                    <div className="inline-guide-grid">
                      {relevant.map((guide: any) => (
                        <Link
                          className="inline-guide-card"
                          key={guide.id}
                          href={`/guides/${guide.slug}`}
                        >
                          <span>{guide.city ? `${guide.city}, IL` : guide.type || 'Local Guide'}</span>
                          <strong>{guide.title}</strong>
                          <p>{guide.summary}</p>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                <div className="section-head" style={{ marginTop: 45 }}>
                  <div>
                    <h2>Published {title}</h2>
                    <p className="muted">
                      Listings are displayed from the live directory inventory. Paid Featured inventory is shown separately.
                    </p>
                  </div>
                </div>

                <div className="business-list">
                  {businesses.map((business) => (
                    <BusinessCard key={business.id} business={business} />
                  ))}
                </div>

                {!businesses.length && (
                  <div className="empty">No published listings match this section yet.</div>
                )}
              </div>

              <FeaturedBusinessSidebar
                businesses={featured as any[]}
                contextLabel={title.toLowerCase()}
              />
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  )
}
