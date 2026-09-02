import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { BusinessCard } from '@/components/BusinessCard'
import { FeaturedBusinessSidebar } from '@/components/FeaturedBusinessSidebar'
import { SearchForm } from '@/components/SearchForm'
import { getBusinesses, getCategories, getLocations, getSeoPage, getGuides, getFeaturedSidebarBusinesses } from '@/lib/data'
import { getSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

type CategoryLabel = { singular: string; plural: string }
function categoryLabel(slug: string, name: string, vertical: string): CategoryLabel {
  const labels: Record<string, CategoryLabel> = {
    'cafes-coffee': { singular: 'coffee shop or cafe', plural: 'coffee shop and cafe' },
    'breweries-taprooms': { singular: 'brewery or taproom', plural: 'brewery and taproom' },
    'bars-pubs': { singular: 'bar or pub', plural: 'bar and pub' }, pizza: { singular: 'pizza restaurant', plural: 'pizza restaurant' }, antiques: { singular: 'antique store', plural: 'antique store' },
    'american-restaurants': { singular: 'American restaurant', plural: 'American restaurant' }, 'bakeries-desserts': { singular: 'bakery or dessert shop', plural: 'bakery and dessert shop' },
    'boutiques-clothing': { singular: 'boutique or clothing store', plural: 'boutique and clothing store' }, 'books-records': { singular: 'bookstore or record shop', plural: 'bookstore and record shop' },
    'gift-shops': { singular: 'gift shop', plural: 'gift shop' }, 'grocery-specialty-foods': { singular: 'grocery or specialty-food store', plural: 'grocery and specialty-food store' },
    'fine-dining': { singular: 'fine-dining restaurant', plural: 'fine-dining restaurant' }, 'family-restaurants': { singular: 'family restaurant', plural: 'family restaurant' },
    'mexican-restaurants': { singular: 'Mexican restaurant', plural: 'Mexican restaurant' }, 'italian-restaurants': { singular: 'Italian restaurant', plural: 'Italian restaurant' },
    'thai-restaurants': { singular: 'Thai restaurant', plural: 'Thai restaurant' }, steakhouses: { singular: 'steakhouse', plural: 'steakhouse' }, hvac: { singular: 'HVAC company', plural: 'HVAC company' },
    plumbing: { singular: 'plumber', plural: 'plumber' }, electrical: { singular: 'electrician', plural: 'electrician' }, roofing: { singular: 'roofing contractor', plural: 'roofing contractor' },
  }
  if (labels[slug]) return labels[slug]
  if (vertical === 'legal') return { singular: `${name} attorney`, plural: `${name} attorney` }
  return { singular: `${name.toLowerCase()} provider`, plural: `${name.toLowerCase()} provider` }
}
function indefiniteArticle(label: string) { return /^[aeiou]/i.test(label) || /^HVAC\b/.test(label) ? 'an' : 'a' }
function comparisonAdvice(slug: string, vertical: string, categoryName: string) {
  const specific: Record<string, string> = {
    'cafes-coffee': 'Compare current hours, coffee and food options, seating, accessibility, parking and whether the cafe fits a quick stop, breakfast, meeting or longer work session. Confirm time-sensitive details directly before visiting.',
    'breweries-taprooms': 'Compare current tap lists, food service, seating, events, group policies and hours. If alcohol is part of the plan, arrange a safe ride or designated driver before the outing.',
    'bars-pubs': 'Compare kitchen and bar hours, food and drink options, seating, entertainment or event schedules, parking and the atmosphere you want. If alcohol is part of the plan, arrange safe transportation in advance.',
    pizza: 'Compare current menus, dine-in and carryout options, delivery area, online ordering, group-size needs, specialty pizzas and dietary options. Confirm current pricing and quoted order times directly with the restaurant.',
    antiques: 'Compare inventory focus, dealer or booth format, store hours, payment policies, accessibility and pickup options for larger items. Antique inventory changes quickly, so call ahead if you are looking for something specific.',
    'bakeries-desserts': 'Compare current bakery and dessert selections, preorder requirements, custom-order lead times, hours, dietary options and pickup details. Seasonal and daily inventory can change, so confirm specific items directly.',
    'boutiques-clothing': 'Compare current inventory, sizing and style focus, store hours, return policies, special-order options and accessibility. Call ahead when you need a specific size, brand or item.',
    'books-records': 'Compare the store’s current focus, new versus used inventory, special-order options, trade or resale policies, hours and events. Inventory changes frequently, so confirm a specific title or release directly.',
    'grocery-specialty-foods': 'Compare the products you need, current inventory, store hours, parking, accessibility and specialty or international-food focus. Call ahead for hard-to-find ingredients or seasonal products.',
    hvac: 'Compare the diagnosis, written scope, repair-versus-replacement reasoning, equipment sizing, efficiency when relevant, warranties, scheduling and total price. Confirm credentials or manufacturer certifications directly when they matter to the job.',
    plumbing: 'Compare diagnostic or service-call fees, written scope, emergency pricing, parts and fixture allowances, labor warranties, cleanup and permit responsibility when applicable. Ask what is included and excluded before approving work.',
    electrical: 'Compare the written scope, troubleshooting or service-call fees, permit responsibility, materials, scheduling, warranty terms and who will perform the work. Confirm licensing or insurance directly when applicable to the project.',
    roofing: 'Compare inspection findings, written scope, materials, tear-off and disposal, flashing and ventilation work, warranties, payment schedule and timing. Confirm insurance, licensing or manufacturer credentials directly when they matter.',
  }
  if (specific[slug]) return specific[slug]
  const category = categoryName.toLowerCase()
  if (vertical === 'home') return `When comparing ${category} providers, review the exact scope of work, written estimates, scheduling, warranties, insurance or licensing when applicable, and who will perform the work. Confirm important credentials directly with the provider or issuing organization.`
  if (vertical === 'legal') return `When comparing ${category} attorneys, ask about relevant practice experience, consultation and communication process, fee or retainer structure, conflicts, deadlines and who will work on the matter. Directory information is not legal advice or a prediction of case results.`
  if (vertical === 'restaurant') return 'Compare current menus, hours, reservations or wait-list policies, takeout options, dietary needs, location and group-size needs. Restaurant details can change, so confirm time-sensitive information directly before visiting.'
  if (vertical === 'retail') return 'Compare current inventory, store hours, return policies, special-order options, accessibility and whether the shop fits the type of local shopping trip you are planning. Confirm time-sensitive details directly with the store.'
  return 'Compare published profiles, current contact details, services or products, availability and the factors that matter most for your specific need. Confirm important details directly before making a decision.'
}
function schemaBusinessType(vertical: string) { if (vertical === 'home') return 'HomeAndConstructionBusiness'; if (vertical === 'legal') return 'LegalService'; if (vertical === 'restaurant') return 'Restaurant'; if (vertical === 'retail') return 'Store'; return 'LocalBusiness' }
function trustResource(vertical: string) {
  if (vertical === 'home') return {label:'Illinois consumer resource',title:'Home Repair Consumer Guidance',body:'The Illinois Attorney General provides home-repair guidance covering written estimates, contract terms, consumer rights and warning signs of repair scams. Use it alongside your own contractor comparison.',href:'https://illinoisattorneygeneral.gov/consumer-protection/home-repair/',link:'Open Illinois Attorney General guidance →'}
  if (vertical === 'legal') return {label:'Illinois court resource',title:'Court Forms, Legal Help & Self-Help Resources',body:'The Illinois Courts Self-Help Center provides court forms, Illinois Court Help, legal-aid information and lawyer-finding resources. It provides legal information, not advice for your specific case.',href:'https://www.illinoiscourts.gov/self-help/',link:'Open Illinois Courts Self-Help →'}
  return null
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; category: string }> }): Promise<Metadata> {
  const { city, category } = await params; const [locations, cats] = await Promise.all([getLocations(), getCategories()]); const loc = locations.find(l => l.slug === city); const cat = cats.find(c => c.slug === category); if (!loc || !cat) return {}
  const [seo, eligible] = await Promise.all([getSeoPage(loc.name, cat.name),getBusinesses({ city, category, limit: 3 })]); const title = seo?.title || `${cat.name} in ${loc.name}, IL`; const description = seo?.description || `Compare published ${cat.name.toLowerCase()} profiles in ${loc.name}, Illinois.`; const canonical = `${getSiteUrl()}/illinois/${city}/${category}`
  return {title: seo?.title ? { absolute: seo.title } : title,description,alternates: { canonical },openGraph: { type: 'website', url: canonical, title, description, siteName: 'Central Illinois Local Pros' },robots: { index: Boolean(seo && seo.reviewed && seo.index_mode !== 'noindex' && eligible.length >= 3), follow: true }}
}

export default async function Page({ params }: { params: Promise<{ city: string; category: string }> }) {
  const { city, category } = await params; const [locations, cats] = await Promise.all([getLocations(), getCategories()]); const loc = locations.find(l => l.slug === city); const cat = cats.find(c => c.slug === category); if (!loc || !cat) notFound()
  const [businesses, cityBusinesses, seo, guides, featured] = await Promise.all([getBusinesses({ city, category, limit: 100 }),getBusinesses({ city, limit: 500 }),getSeoPage(loc.name, cat.name),getGuides(120),getFeaturedSidebarBusinesses({city,category,pagePath:`/illinois/${city}/${category}`,limit:4})])
  const categoryCounts = new Map<string, number>(); for (const business of cityBusinesses as any[]) { const seen = new Set<string>(); for (const row of business.business_categories ?? []) { const businessCategory = row?.categories; const slug = businessCategory?.slug; if (!slug || seen.has(slug)) continue; seen.add(slug); categoryCounts.set(slug, (categoryCounts.get(slug) ?? 0) + 1) } }
  const related = cats.filter(c => c.slug !== category && c.vertical === cat.vertical && (categoryCounts.get(c.slug) ?? 0) >= 3).sort((a, b) => (categoryCounts.get(b.slug) ?? 0) - (categoryCounts.get(a.slug) ?? 0) || a.name.localeCompare(b.name)).slice(0, 8)
  const guideRows = guides as any[], exact = guideRows.filter(g => g.city === loc.name && g.category === cat.name), broader = guideRows.filter(g => g.city === loc.name && g.category !== cat.name), relevantGuides = [...exact, ...broader].filter((g, i, all) => all.findIndex(x => x.id === g.id) === i).slice(0, 3)
  const label = categoryLabel(cat.slug, cat.name, cat.vertical),article = indefiniteArticle(label.singular),officialResource = trustResource(cat.vertical),faq = [
    {question:`How many ${label.plural} profiles are published in ${loc.name}?`,answer:`This page currently includes ${businesses.length} published ${label.plural} profile${businesses.length === 1 ? '' : 's'} connected to an active ${loc.name} location. The count can change as directory inventory is reviewed, added or updated.`},
    {question:`What should I compare when choosing ${article} ${label.singular} in ${loc.name}?`,answer:comparisonAdvice(cat.slug, cat.vertical, cat.name)},
    {question:'Can a business pay to rank higher in the organic directory results?',answer:'No. Sponsorship or advertising may be displayed separately, but paid placement does not control organic directory ordering. Use published profiles as a starting point and make your own comparison.'},
  ]
  const base = getSiteUrl(),canonical = `${base}/illinois/${city}/${category}`,businessType = schemaBusinessType(cat.vertical),schema = [
    {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:base},{'@type':'ListItem',position:2,name:'Illinois',item:`${base}/illinois`},{'@type':'ListItem',position:3,name:`${loc.name}, IL`,item:`${base}/illinois/${city}`},{'@type':'ListItem',position:4,name:cat.name,item:canonical}]},
    ...(businesses.length?[{'@context':'https://schema.org','@type':'ItemList',name:`${cat.name} in ${loc.name}, IL`,itemListOrder:'https://schema.org/ItemListUnordered',numberOfItems:businesses.length,itemListElement:businesses.map((business:any,index:number)=>({'@type':'ListItem',position:index+1,item:{'@type':businessType,name:business.name,url:`${base}/business/${business.slug}`}}))}]:[]),
    ...(businesses.length>=3?[{'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))}]:[]),
  ]
  return <SiteShell><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} /><main><section className="pagehero"><div className="container"><div className="crumb"><Link href="/illinois">Illinois</Link> › <Link href={`/illinois/${city}`}>{loc.name}</Link> › {cat.name}</div><h1>{seo?.h1 || `${cat.name} in ${loc.name}, IL`}</h1><p>{seo?.intro || `Compare published ${cat.name.toLowerCase()} profiles with active physical-location evidence in ${loc.name}.`}</p><div className="market-stats"><span><strong>{businesses.length}</strong> published provider{businesses.length === 1 ? '' : 's'}</span><span><strong>{cat.name}</strong> category</span><span><strong>{loc.name}</strong> market</span></div></div></section><section className="section"><div className="container"><div className="search-panel"><SearchForm categories={cats} locations={locations} defaults={{ city, category }} /></div><div className="featured-content-layout" style={{marginTop:24}}><div className="featured-content-main">
    {seo?.content && <div className="card local-copy"><div className="kpi">Local Buying Guide</div><p className="muted">{seo.content}</p></div>}
    {officialResource && <div className="card local-copy"><div className="kpi">{officialResource.label}</div><h3>{officialResource.title}</h3><p className="muted">{officialResource.body}</p><a href={officialResource.href} target="_blank" rel="noreferrer">{officialResource.link}</a></div>}
    {relevantGuides.length > 0 && <section className="inline-guide-section"><div className="section-head compact-head"><div><div className="kpi">Helpful local reading</div><h2>{cat.name} & Local Guides</h2><p className="muted">Articles connected to {loc.name}{exact.length ? ` and ${cat.name.toLowerCase()}` : ''}.</p></div><Link href={`/guides?city=${encodeURIComponent(loc.name)}`}>More {loc.name} guides →</Link></div><div className="inline-guide-grid">{relevantGuides.map((guide:any)=><Link className="inline-guide-card" key={guide.id} href={`/guides/${guide.slug}`}><span>{guide.category || guide.type || 'Local Guide'}</span><strong>{guide.title}</strong><p>{guide.summary}</p></Link>)}</div></section>}
    <div className="results-toolbar"><div><div className="kpi">{businesses.length} result{businesses.length === 1 ? '' : 's'}</div><h2>{cat.name} in {loc.name}</h2></div><Link className="btn btn-light" href={`/illinois/${city}`}>All {loc.name} businesses</Link></div>
    {businesses.length?<div className="business-list">{businesses.map(business => <BusinessCard key={business.id} business={business} />)}</div>:<div className="empty empty-rich"><h2>Local inventory is still being developed</h2><p>This category does not yet have enough published physical-location inventory to display providers. Thin pages remain excluded from search indexing until they meet the directory’s quality threshold.</p><Link className="btn btn-primary" href={`/illinois/${city}`}>Browse {loc.name}</Link></div>}
    {businesses.length >= 3 && <section className="inline-guide-section"><div className="section-head compact-head"><div><div className="kpi">Local comparison help</div><h2>Frequently Asked Questions</h2><p className="muted">Quick answers for comparing {cat.name.toLowerCase()} in {loc.name}.</p></div></div><div className="grid grid-3">{faq.map(item => <div className="card" key={item.question}><h3>{item.question}</h3><p className="muted">{item.answer}</p></div>)}</div></section>}
    {related.length > 0 && <><div className="section-head search-browse-head"><div><h2>Explore More {cat.vertical === 'home' ? 'Home Services' : cat.vertical === 'legal' ? 'Legal Services' : cat.vertical === 'restaurant' ? 'Restaurant Categories' : cat.vertical === 'retail' ? 'Local Store Categories' : 'Categories'}</h2><p className="muted">Continue browsing established {loc.name} categories with at least three published providers.</p></div></div><div className="grid grid-4">{related.map(relatedCategory => <Link className="card category-card" key={relatedCategory.id} href={`/illinois/${city}/${relatedCategory.slug}`}><strong>{relatedCategory.name}</strong><p className="small muted">{categoryCounts.get(relatedCategory.slug)} published providers</p></Link>)}</div></>}
  </div><FeaturedBusinessSidebar businesses={featured as any[]} contextLabel={`${cat.name} in ${loc.name}`}/></div></div></section></main></SiteShell>
}
