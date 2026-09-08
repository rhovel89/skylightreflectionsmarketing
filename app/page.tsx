import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { SearchForm } from '@/components/SearchForm'
import { BusinessCard } from '@/components/BusinessCard'
import { GrowthTrackedLink } from '@/components/GrowthTracking'
import { getBusinesses, getCategories, getPublicConfig, getLocations, getGuides, getHomepageFeaturedBusinesses } from '@/lib/data'
import { getSearchAvailability } from '@/lib/search-availability'
import { VERTICALS } from '@/lib/constants'
import { getSiteUrl } from '@/lib/site-url'

export const dynamic='force-dynamic'
export const metadata:Metadata={alternates:{canonical:getSiteUrl()}}
const verticalIcons=['🏠','⚖️','🍽️','🛍️','🧰','📍']
const countyLabel=(county?:string|null)=>{const value=String(county??'').trim();return value?(/\bcounty$/i.test(value)?value:`${value} County`):''}

export default async function Home(){
  const[cfg,categories,businesses,locations,guides,featuredBusinesses,availability]=await Promise.all([
    getPublicConfig(),getCategories(),getBusinesses({limit:8}),getLocations(),getGuides(3),getHomepageFeaturedBusinesses(6),getSearchAvailability()
  ])
  const site=cfg.site??{}
  const featuredPlan=(cfg.plans??[]).find((p:any)=>p.slug==='featured')
  const featuredCheckout=(featuredPlan as any)?.stripe_monthly_payment_url||'/for-businesses'
  const title=String(site.hero_title||'Find the Right Local Pro.')
  const titlePrefix=title.includes('Local Pro.')?title.replace('Local Pro.',''):title

  return <SiteShell><main>
    <section className="hero public-home-hero"><div className="container hero-inner">
      <div className="home-hero-grid">
        <div className="home-hero-copy">
          <div className="eyebrow">{site.hero_eyebrow}</div>
          <h1>{titlePrefix}<span className="gradient-text">{title.includes('Local Pro.')?'Local Pro.':''}</span></h1>
          <p>{site.hero_subtitle}</p>
          <div className="home-intent-switcher">
            <a className="home-intent primary" href="#find-a-pro"><span>I need a local pro</span><strong>Search businesses →</strong></a>
            <Link className="home-intent" href="/search?claim=1"><span>I own or manage a business</span><strong>Find & claim my listing →</strong></Link>
          </div>
          <div id="find-a-pro" className="home-search-wrap"><div className="home-search-label"><strong>Search the live directory</strong><span>Choose a category, city, or search by business/service.</span></div><SearchForm categories={categories} locations={locations} availability={availability}/></div>
          <div className="hero-proof"><span className="proof-pill">{locations.length} active markets</span><span className="proof-pill">{categories.length} active categories</span><span className="proof-pill">Direct business connections</span><span className="proof-pill">No pay-to-rank organic results</span></div>
        </div>
        <aside className="home-trust-card">
          <div className="kpi">How this directory works</div>
          <h2>Useful local discovery without hiding the rules.</h2>
          <div className="home-trust-list"><div><span>1</span><p><strong>Search published profiles.</strong><small>Browse by service, city, category, or business name.</small></p></div><div><span>2</span><p><strong>Compare the details.</strong><small>Use locations, service areas, source-backed information, contact options and business-provided profile content.</small></p></div><div><span>3</span><p><strong>Contact the business directly.</strong><small>Call, visit the website, or send a directory request when available.</small></p></div></div>
          <div className="home-trust-note"><strong>Paid placement stays labeled.</strong><span>Sponsored visibility is separate from normal organic directory ordering.</span></div>
          <Link href="/listing-policy">How listings work →</Link>
        </aside>
      </div>
    </div></section>

    <section className="section home-path-section"><div className="container">
      <div className="section-head"><div><div className="kpi">Start with what you need</div><h2>Explore Central Illinois</h2><p className="muted">Choose a broad local-business path, then narrow by city and category.</p></div></div>
      <div className="grid grid-4 home-vertical-grid">{VERTICALS.map((v,i)=><Link className="card category-card home-vertical-card" key={v.key} href={v.href}><div className="category-icon">{verticalIcons[i]??'📍'}</div><div><h3>{v.label}</h3><p className="muted">Browse local {v.label.toLowerCase()} by city and category.</p></div><span>Explore {v.label} →</span></Link>)}</div>
    </div></section>

    <section className="section white"><div className="container">
      <div className="section-head"><div><div className="kpi">Separate advertising area</div><h2>Featured Businesses</h2><p className="muted">Paid featured placements are clearly labeled here and remain separate from organic directory results.</p></div><GrowthTrackedLink eventType="visibility_plan_click" plan="featured" source="homepage-featured-section" className="btn btn-primary" href={featuredCheckout}>Get Your Business Featured</GrowthTrackedLink></div>
      {featuredBusinesses.length>0?<div className="business-list">{featuredBusinesses.map(b=><BusinessCard key={b.id} business={b}/>)}</div>:<div className="card home-featured-empty"><span className="badge sponsored">SPONSORED</span><h3>Your Business Could Be Featured Here</h3><p className="muted">Featured placement adds a clearly labeled business card on the homepage while normal organic search and directory relevance remain independent.</p><div className="card-actions"><GrowthTrackedLink eventType="visibility_plan_click" plan="featured" source="homepage-featured-empty" className="btn btn-primary" href={featuredCheckout}>Start Featured · $49/mo</GrowthTrackedLink><Link className="btn btn-light" href="/for-businesses">Compare Plans</Link></div></div>}
      <p className="small muted home-ad-disclosure">Featured placement is advertising. It does not guarantee verification, leads, reviews, or higher organic ranking. See our <Link href="/advertising-disclosure">Advertising Disclosure</Link>.</p>
    </div></section>

    <section className="section"><div className="container">
      <div className="section-head"><div><div className="kpi">From the live directory</div><h2>Browse Local Businesses</h2><p className="muted">A sample of currently published business profiles. Use search for a specific service or market.</p></div><Link className="btn btn-light" href="/search">Search All Businesses</Link></div>
      <div className="business-list">{businesses.map(b=><BusinessCard key={b.id} business={b}/>)}</div>
    </div></section>

    <section className="section home-locations-section"><div className="container">
      <div className="section-head"><div><div className="kpi">Browse geographically</div><h2>Choose a Central Illinois Market</h2><p className="muted">Open a city or town to see currently published businesses, active categories and local guides.</p></div><Link href="/illinois">View all locations →</Link></div>
      <div className="grid grid-4 home-location-grid">{locations.slice(0,12).map(l=><Link className="card category-card home-location-card" key={l.id} href={`/illinois/${l.slug}`}><strong>{l.name}, IL</strong><span>{countyLabel(l.county)?`${countyLabel(l.county)} · `:''}Browse local directory →</span></Link>)}</div>
    </div></section>

    {guides.length>0&&<section className="section white"><div className="container"><div className="section-head"><div><div className="kpi">Local knowledge</div><h2>Latest Local Guides</h2><p className="muted">Practical Central Illinois articles for homeowners, diners, shoppers and people comparing local services.</p></div><Link href="/guides">Browse all guides →</Link></div><div className="inline-guide-grid">{guides.map((g:any)=><Link className="inline-guide-card" key={g.id} href={`/guides/${g.slug}`}><span>{g.city?`${g.city}, IL`:g.type||'Local Guide'}</span><strong>{g.title}</strong><p>{g.summary}</p></Link>)}</div></div></section>}

    <section className="section"><div className="container">
      <div className="home-owner-band"><div><div className="kpi">For Central Illinois businesses</div><h2>Already listed? Claim it. Missing? Submit it. Want more tools? Compare options.</h2><p>Claiming an existing profile is free and staff reviewed. New business submissions remain pending until review. Optional paid plans and clearly labeled sponsorship never buy organic rank.</p></div><div className="home-owner-actions"><Link className="btn btn-primary" href="/search?claim=1">Find & Claim My Business</Link><Link className="btn btn-light" href="/list-your-business">Submit Missing Business</Link><Link className="btn btn-light" href="/for-businesses">Compare Business Plans</Link></div></div>
      <div className="home-skylight-band"><div><strong>Powered by Skylight Reflections Marketing</strong><span>Website design, local SEO, Google Business Profile, social media, branding and lead-generation services are managed separately from organic directory relevance.</span></div><Link className="btn btn-light" href="/contact#marketing-review">Request Marketing Help</Link></div>
    </div></section>
  </main></SiteShell>
}
