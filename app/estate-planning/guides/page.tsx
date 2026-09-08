import type{Metadata}from'next'
import Link from'next/link'
import{SiteShell}from'@/components/SiteShell'
import{estateGuides,estateGuideCategories}from'@/lib/estate-planning-guides'
import{getSiteUrl}from'@/lib/site-url'

export const metadata:Metadata={
 title:'Estate Planning & Trust Guides | Wills, Trusts, Probate & POA',
 description:'Read practical estate-planning guides about wills, trusts, probate, powers of attorney, advance directives, beneficiaries, business succession, asset protection and 2026 estate and gift tax basics.',
 keywords:['estate planning guides','estate planning information','wills and trusts guide','living trust guide','probate guide','power of attorney guide','estate planning checklist'],
 alternates:{canonical:'/estate-planning/guides'},
 openGraph:{type:'website',url:'/estate-planning/guides',title:'Estate Planning & Trust Resource Center',description:'Plain-English educational guides about wills, trusts, probate, powers of attorney, family planning and estate-tax basics.'},
 twitter:{card:'summary',title:'Estate Planning & Trust Resource Center',description:'Practical guides about wills, trusts, probate, powers of attorney and planning ahead.'}
}

export default function Page(){
 const base=getSiteUrl(),url=`${base}/estate-planning/guides`
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'CollectionPage','@id':`${url}#page`,name:'Estate Planning & Trust Resource Center',description:'Educational estate-planning and trust guides for people preparing to speak with an estate-planning attorney.',url,inLanguage:'en-US',isPartOf:{'@id':`${base}/#website`}},
  {'@type':'BreadcrumbList','@id':`${url}#breadcrumb`,itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:base},{'@type':'ListItem',position:2,name:'Estate Planning',item:`${base}/estate-planning`},{'@type':'ListItem',position:3,name:'Guides',item:url}]},
  {'@type':'ItemList','@id':`${url}#guides`,name:'Estate Planning Guides',numberOfItems:estateGuides.length,itemListElement:estateGuides.map((g,i)=>({'@type':'ListItem',position:i+1,url:`${url}/${g.slug}`,name:g.title}))}
 ]}
 return <SiteShell><main>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>
  <section className="pagehero guides-hero"><div className="container"><div className="eyebrow">Estate Planning & Trust · Resource Center</div><h1>Estate Planning Guides You Can Actually Read and Understand</h1><p>Learn the basics before your consultation. These plain-English resources cover wills, trusts, probate, powers of attorney, health-care directives, family planning, business succession, asset protection and current federal estate-and-gift-tax basics.</p><div className="hero-actions"><Link className="btn btn-primary" href="/estate-planning#estate-planning-form">Request a Consultation</Link><Link className="btn btn-light" href="/estate-planning">Estate Planning Overview</Link></div><div className="market-stats"><span><strong>{estateGuides.length}</strong> in-depth guides</span><span><strong>{estateGuideCategories.length}</strong> planning topics</span><span><strong>Nationwide</strong> educational resource</span></div></div></section>

  <section className="section"><div className="container"><div className="guide-intro-grid"><div><div className="kpi">Start here</div><h2>Learn first. Then bring your questions to the attorney.</h2><p className="muted">Estate planning is highly state-specific. These guides explain concepts and questions to consider; they do not tell you which documents you personally need. Skylight Reflections Marketing handles preliminary qualification and appointment coordination only.</p></div><div className="notice"><strong>Privacy reminder:</strong> Do not send wills, trusts, tax returns, Social Security numbers, account numbers, passwords, medical records or other sensitive documents through the preliminary appointment form. The attorney or law office can tell you what to provide directly if your consultation is booked.</div></div></div></section>

  {estateGuideCategories.map(category=>{const guides=estateGuides.filter(g=>g.category===category);return <section className="section white" key={category}><div className="container"><div className="section-head"><div><div className="kpi">{guides.length} guide{guides.length===1?'':'s'}</div><h2>{category}</h2></div></div><div className="grid grid-3 guide-grid">{guides.map(g=><article className="card guide-card" key={g.slug}><div className="guide-card-badges"><span className="badge neutral">{g.category}</span><span className="badge neutral">Updated Sep 2026</span></div><h3><Link href={`/estate-planning/guides/${g.slug}`}>{g.title}</Link></h3><p className="muted">{g.excerpt}</p><div className="guide-card-footer"><span>{Math.max(4,Math.ceil(g.sections.reduce((n,s)=>n+(s.paragraphs?.join(' ').split(/\s+/).length||0)+(s.bullets?.join(' ').split(/\s+/).length||0),0)/220))} min read</span><Link href={`/estate-planning/guides/${g.slug}`}>Read guide →</Link></div></article>)}</div></div></section>})}

  <section className="section"><div className="container"><div className="card"><div className="kpi">Ready for the next step?</div><h2>Turn your questions into a consultation.</h2><p className="muted">If you want to speak with an estate-planning attorney, answer the preliminary qualifying questions. Skylight reviews the inquiry, follows up, and coordinates the appointment if it meets the appointment criteria.</p><div className="hero-actions"><Link className="btn btn-primary" href="/estate-planning#estate-planning-form">Request My Consultation</Link><Link className="btn btn-light" href="/estate-planning">How the appointment process works</Link></div></div></div></section>
 </main></SiteShell>
}
