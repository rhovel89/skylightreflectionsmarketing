import type{Metadata}from'next'
import Link from'next/link'
import{notFound}from'next/navigation'
import{SiteShell}from'@/components/SiteShell'
import{estateGuides,getEstateGuide}from'@/lib/estate-planning-guides'
import{getSiteUrl}from'@/lib/site-url'

export const dynamicParams=false
export function generateStaticParams(){return estateGuides.map(g=>({slug:g.slug}))}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const{slug}=await params,g=getEstateGuide(slug);if(!g)return{}
 return{title:g.title,description:g.description,keywords:g.keywords,alternates:{canonical:`/estate-planning/guides/${slug}`},authors:[{name:'Central Illinois Local Pros'}],openGraph:{type:'article',url:`/estate-planning/guides/${slug}`,title:g.title,description:g.description,publishedTime:g.updated,modifiedTime:g.updated,authors:['Central Illinois Local Pros'],section:g.category},twitter:{card:'summary',title:g.title,description:g.description}}
}

export default async function Page({params}:{params:Promise<{slug:string}>}){
 const{slug}=await params,g=getEstateGuide(slug);if(!g)notFound()
 const base=getSiteUrl(),url=`${base}/estate-planning/guides/${g.slug}`
 const words=g.sections.reduce((n,s)=>n+(s.paragraphs?.join(' ').split(/\s+/).length||0)+(s.bullets?.join(' ').split(/\s+/).length||0),0)
 const minutes=Math.max(4,Math.ceil(words/220))
 const related=estateGuides.filter(x=>x.slug!==g.slug&&(x.category===g.category||x.keywords.some(k=>g.keywords.includes(k)))).slice(0,3)
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'Article','@id':`${url}#article`,headline:g.title,description:g.description,url,mainEntityOfPage:{'@type':'WebPage','@id':url},inLanguage:'en-US',datePublished:g.updated,dateModified:g.updated,articleSection:g.category,keywords:g.keywords.join(', '),author:{'@type':'Organization',name:'Central Illinois Local Pros',url:base},publisher:{'@type':'Organization',name:'Central Illinois Local Pros',url:base},isPartOf:{'@id':`${base}/estate-planning/guides#page`}},
  {'@type':'BreadcrumbList','@id':`${url}#breadcrumb`,itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:base},{'@type':'ListItem',position:2,name:'Estate Planning',item:`${base}/estate-planning`},{'@type':'ListItem',position:3,name:'Estate Planning Guides',item:`${base}/estate-planning/guides`},{'@type':'ListItem',position:4,name:g.title,item:url}]},
  {'@type':'FAQPage','@id':`${url}#faq`,mainEntity:g.faqs.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}
 ]}
 return <SiteShell><main>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>
  <section className="pagehero guide-article-hero"><div className="container"><div className="crumb"><Link href="/estate-planning">Estate Planning</Link> › <Link href="/estate-planning/guides">Guides</Link> › {g.category}</div><div className="guide-article-badges"><span className="badge neutral">{g.category}</span><span className="badge neutral">Educational guide</span></div><h1>{g.title}</h1><p>{g.excerpt}</p><div className="market-stats"><span><strong>{minutes} min</strong> read</span><span><strong>Updated</strong> Sep 7, 2026</span><span><strong>Nationwide</strong> general information</span></div></div></section>

  <section className="section"><div className="container guide-article-layout"><article className="card guide-article">
   <div className="notice" style={{marginBottom:22}}><strong>General information only:</strong> Estate-planning, probate, trust, tax and incapacity rules vary by state and individual circumstances. This guide is educational and is not legal, tax, financial or medical advice.</div>
   {g.sections.map(s=><section key={s.heading}><h2>{s.heading}</h2>{s.paragraphs?.map((p,i)=><p key={i}>{p}</p>)}{s.bullets&&<ul>{s.bullets.map((b,i)=><li key={i}>{b}</li>)}</ul>}</section>)}
   <section><h2>Frequently asked questions</h2>{g.faqs.map(f=><div key={f.q} style={{marginBottom:18}}><h3>{f.q}</h3><p>{f.a}</p></div>)}</section>
   <section><h2>Trusted sources and further reading</h2><p>For current rules and official guidance, review the primary sources below. State-specific legal questions should be discussed with an attorney licensed in the relevant state.</p><ul>{g.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ul></section>
   <div className="guide-disclaimer">Central Illinois Local Pros is operated by Skylight Reflections Marketing. Neither is a law firm. Skylight handles preliminary qualification, follow-up and appointment coordination only. Do not send legal documents or sensitive financial, medical or account information through the preliminary consultation form.</div>
  </article><aside className="guide-article-side"><div className="card sticky-card"><div className="kpi">Speak with an attorney</div><h3>Have questions about your own estate plan?</h3><p className="muted">Answer a few preliminary qualifying questions and request help coordinating an estate-planning consultation.</p><Link className="btn btn-primary" href="/estate-planning#estate-planning-form">Request a Consultation</Link><Link className="btn btn-light" href="/estate-planning/guides">Browse All Guides</Link></div><div className="card" style={{marginTop:18}}><div className="kpi">Privacy</div><h3>Keep sensitive documents with the law office.</h3><p className="muted">Skylight does not collect wills, trusts, account numbers, tax returns, medical records, Social Security numbers or passwords for the attorney.</p></div></aside></div></section>

  {related.length>0&&<section className="section white"><div className="container"><div className="section-head"><div><div className="kpi">Keep learning</div><h2>Related Estate Planning Guides</h2></div><Link href="/estate-planning/guides">View all guides →</Link></div><div className="grid grid-3 guide-grid">{related.map(r=><Link className="card guide-related" href={`/estate-planning/guides/${r.slug}`} key={r.slug}><span className="badge neutral">{r.category}</span><h3>{r.title}</h3><p className="muted">{r.excerpt}</p></Link>)}</div></div></section>}
 </main></SiteShell>
}
