import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { EstatePlanningLeadForm } from '@/components/EstatePlanningLeadForm'
import { estateGuides } from '@/lib/estate-planning-guides'
import { getSiteUrl } from '@/lib/site-url'

export const metadata:Metadata={
  title:'Estate Planning & Trust Information | Wills, Trusts & Attorney Consultation',
  description:'Learn about estate planning, wills, living trusts, probate, powers of attorney, advance directives, asset protection and business succession, then request help coordinating an estate-planning attorney consultation.',
  keywords:['estate planning','estate planning trust','wills and trusts','living trust','estate planning attorney','probate','power of attorney','asset protection','business succession planning'],
  alternates:{canonical:'/estate-planning'},
  openGraph:{type:'website',url:'/estate-planning',title:'Estate Planning & Trust Information + Consultation Request',description:'Read practical estate-planning guides and request help coordinating a consultation with an estate-planning attorney.'},
  twitter:{card:'summary',title:'Estate Planning & Trust Information',description:'Guides about wills, trusts, probate, powers of attorney and planning ahead, plus consultation coordination.'},
}

const faq=[
  ['What happens after I submit the form?','Skylight Reflections Marketing reviews the preliminary qualifying information, follows up with you, and helps coordinate an appointment with the estate-planning attorney.'],
  ['What information should I provide?','Only basic contact information and preliminary qualifying details about the type of estate-planning help you are looking for, your location, general family context, and preferred timing. Do not send legal documents, account numbers, Social Security numbers, passwords, medical records, tax returns or other sensitive files.'],
  ['Can I request a consultation if I already have a will or trust?','Yes. One of the preliminary questions asks whether you already have a will or trust so Skylight can use that answer as part of the appointment qualification process.'],
  ['Does Skylight provide legal advice?','No. Central Illinois Local Pros and Skylight Reflections Marketing are not law firms. Skylight only handles preliminary qualification, follow-up, and appointment coordination.'],
  ['Does submitting this form create an attorney-client relationship?','No. Submitting the form only starts the qualification and appointment-setting process. Any attorney-client relationship is handled separately by the attorney or law office.'],
  ['Where can I learn about wills, trusts, probate and powers of attorney before I book?','Use the Estate Planning & Trust Resource Center for plain-English educational guides about wills, revocable living trusts, probate, powers of attorney, advance directives, family planning, business succession and federal estate-and-gift-tax basics.'],
]

const featuredSlugs=['estate-planning-101','will-vs-trust','estate-planning-checklist','power-of-attorney-guide','probate-basics','2026-federal-estate-gift-tax-basics']
const featured=featuredSlugs.map(slug=>estateGuides.find(g=>g.slug===slug)).filter(Boolean) as typeof estateGuides

export default function Page(){
  const base=getSiteUrl(),url=`${base}/estate-planning`
  const schema=[
    {'@context':'https://schema.org','@type':'WebPage','@id':`${url}#page`,name:'Estate Planning & Trust Information and Consultation Request',url,description:'Nationwide educational estate-planning information plus preliminary qualification and appointment-setting operated by Skylight Reflections Marketing.',inLanguage:'en-US'},
    {'@context':'https://schema.org','@type':'FAQPage','@id':`${url}#faq`,mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))},
    {'@context':'https://schema.org','@type':'ItemList','@id':`${url}#featured-guides`,name:'Featured Estate Planning Guides',numberOfItems:featured.length,itemListElement:featured.map((g,i)=>({'@type':'ListItem',position:i+1,url:`${base}/estate-planning/guides/${g.slug}`,name:g.title}))},
  ]
  return <SiteShell><main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>

    <section className="hero"><div className="container hero-grid"><div>
      <div className="eyebrow">Estate Planning & Trust · Nationwide</div>
      <h1>Understand your estate-planning options. Then book the right consultation.</h1>
      <p>Learn about wills, revocable living trusts, probate, powers of attorney, advance directives, asset protection, business succession and other estate-planning topics. When you are ready to speak with an attorney, Skylight Reflections Marketing asks preliminary qualifying questions, follows up with you and coordinates the appointment.</p>
      <div className="hero-actions"><a className="btn btn-primary" href="#estate-planning-form">Request a Consultation</a><Link className="btn btn-light" href="/estate-planning/guides">Read Estate Planning Guides</Link></div>
      <div className="trust-row"><span>✓ 15 educational guides</span><span>✓ Preliminary qualification</span><span>✓ Appointment coordination</span><span>✓ No legal advice from Skylight</span></div>
    </div><div className="card"><div className="kpi">How it works</div>
      <div className="info-row"><span>1. Learn what questions to ask</span><strong>Read plain-English estate-planning guides</strong></div>
      <div className="info-row"><span>2. Answer a few qualifying questions</span><strong>Basic planning need, location and timing</strong></div>
      <div className="info-row"><span>3. Skylight follows up</span><strong>We confirm appointment fit and availability</strong></div>
      <div className="info-row"><span>4. Speak with the attorney</span><strong>The attorney handles legal advice and the legal consultation separately</strong></div>
    </div></div></section>

    <section className="section"><div className="container"><div className="section-head"><div><div className="kpi">Estate Planning Resource Center</div><h2>Start with the questions people ask most</h2><p className="muted">These educational guides are designed to help you understand terminology and prepare better questions. Estate-planning laws vary by state, so the guides do not replace advice from an attorney licensed in the relevant state.</p></div><Link href="/estate-planning/guides">View all 15 guides →</Link></div><div className="grid grid-3 guide-grid">{featured.map(g=><article className="card guide-card" key={g.slug}><div className="guide-card-badges"><span className="badge neutral">{g.category}</span></div><h3><Link href={`/estate-planning/guides/${g.slug}`}>{g.title}</Link></h3><p className="muted">{g.excerpt}</p><div className="guide-card-footer"><span>Updated Sep 2026</span><Link href={`/estate-planning/guides/${g.slug}`}>Read guide →</Link></div></article>)}</div><div style={{marginTop:18}}><Link className="btn btn-primary" href="/estate-planning/guides">Browse the Estate Planning & Trust Resource Center</Link></div></div></section>

    <section className="section white"><div className="container"><div className="section-head"><div><div className="kpi">Common Consultation Topics</div><h2>What are you looking for help with?</h2><p className="muted">You do not need to diagnose your own legal needs. These choices simply help with preliminary qualification before the appointment.</p></div></div>
      <div className="grid grid-3">
        <div className="card"><h3>Wills & Living Trusts</h3><p className="muted">New planning, updates to an existing plan, wills, revocable trusts and related estate-planning questions.</p><Link href="/estate-planning/guides/will-vs-trust">Will vs. trust guide →</Link></div>
        <div className="card"><h3>Asset Protection</h3><p className="muted">General consultation requests involving family, business or investment assets.</p><Link href="/estate-planning/guides/asset-protection-estate-planning-basics">Asset-protection basics →</Link></div>
        <div className="card"><h3>Business Succession</h3><p className="muted">Questions about continuity, ownership transitions and long-term planning for a closely held business.</p><Link href="/estate-planning/guides/estate-planning-for-business-owners">Business-owner guide →</Link></div>
        <div className="card"><h3>Power of Attorney</h3><p className="muted">Consultation requests involving financial or incapacity planning.</p><Link href="/estate-planning/guides/power-of-attorney-guide">Power of attorney guide →</Link></div>
        <div className="card"><h3>Tax & Legacy Planning</h3><p className="muted">Questions involving long-term family, wealth-transfer or legacy goals.</p><Link href="/estate-planning/guides/2026-federal-estate-gift-tax-basics">2026 federal tax basics →</Link></div>
        <div className="card"><h3>Probate & Trust Administration</h3><p className="muted">Consultation requests involving an estate or trust after a death or major transition.</p><Link href="/estate-planning/guides/probate-basics">Probate basics →</Link></div>
      </div>
    </div></section>

    <section className="section" id="estate-planning-form"><div className="container" style={{maxWidth:980}}><div className="section-head"><div><div className="kpi">Request a Consultation</div><h2>Answer the preliminary qualifying questions</h2><p className="muted">Only provide the basic information requested here. Do not upload or send legal documents, Social Security numbers, account numbers, passwords, medical records, tax returns or other sensitive records.</p></div></div><EstatePlanningLeadForm/></div></section>

    <section className="section"><div className="container"><div className="section-head"><div><div className="kpi">Estate Planning FAQ</div><h2>Questions before you get started</h2></div></div><div className="grid grid-2">{faq.map(([q,a])=><div className="card" key={q}><h3>{q}</h3><p className="muted">{a}</p></div>)}</div></div></section>

    <section className="section"><div className="container"><div className="notice"><strong>Appointment-setting disclosure:</strong> Central Illinois Local Pros is operated by Skylight Reflections Marketing. Neither is a law firm and neither provides legal advice. Educational content is general information and laws vary by state. Skylight's role is limited to preliminary qualification, follow-up, and appointment coordination. Skylight does not collect legal documents or sensitive financial/account information for the attorney. Skylight uses the qualifying answers to determine appointment fit. If an appointment is booked, only the basic contact and appointment information needed to coordinate that consultation may be provided to the attorney or law office. Submitting this form does not create an attorney-client relationship.</div></div></section>
  </main></SiteShell>
}
