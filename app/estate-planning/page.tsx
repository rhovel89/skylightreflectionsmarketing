import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { EstatePlanningLeadForm } from '@/components/EstatePlanningLeadForm'

export const metadata:Metadata={
  title:'Estate Planning Help & Consultation Request | Nationwide',
  description:'Request nationwide estate-planning help for wills, living trusts, business succession, powers of attorney, probate concerns and related planning through Skylight Reflections Marketing.',
  alternates:{canonical:'/estate-planning'},
  openGraph:{type:'website',url:'/estate-planning',title:'Estate Planning Help & Consultation Request — Nationwide',description:'Start an estate-planning consultation request for wills, trusts, succession planning and related needs.'},
}

const faq=[
  ['What can an estate-planning consultation cover?','Common topics include wills, revocable or living trusts, advanced trusts, powers of attorney, asset protection, business succession, tax and legacy planning, and probate or trust administration. The right approach depends on your situation and applicable law.'],
  ['Can I request a consultation if I already have a will or trust?','Yes. Many people request a review after major life, family, business, property or financial changes, or when an older plan may no longer match their goals.'],
  ['Are consultation requests accepted nationwide?','Yes. Consultation inquiries are accepted nationwide. The legal services available for a particular matter depend on applicable law, professional licensing, conflicts review and acceptance of the engagement by the participating provider.'],
  ['Does submitting this form create an attorney-client relationship?','No. Central Illinois Local Pros and Skylight Reflections Marketing are not law firms. Submitting this form is a lead-generation and consultation-request step only. An attorney-client relationship begins only after an attorney accepts the matter and the required engagement process is completed.'],
  ['Who receives my information?','Your request first goes to the private Skylight Reflections Marketing owner queue. If you consent, Skylight may share the request and your contact information with a participating estate-planning service provider to discuss and schedule a consultation.'],
]

export default function Page(){
  const schema=[
    {'@context':'https://schema.org','@type':'WebPage',name:'Estate Planning Help & Consultation Request — Nationwide',url:'https://central-il-local-pros.vercel.app/estate-planning',description:'A nationwide estate-planning consultation request and lead-generation page operated by Skylight Reflections Marketing.'},
    {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))},
  ]
  return <SiteShell><main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>

    <section className="hero"><div className="container hero-grid"><div>
      <div className="eyebrow">Estate Planning & Trust · Nationwide</div>
      <h1>Protect what you built. Plan what happens next.</h1>
      <p>If you are searching for an <strong>estate planning attorney</strong>, <strong>trust attorney</strong>, help with wills and trusts, asset protection, business succession, or legacy planning, start with a simple consultation request. Skylight Reflections Marketing will review your information and contact you to help coordinate next steps with a participating estate-planning professional.</p>
      <div className="hero-actions"><a className="btn btn-primary" href="#estate-planning-form">Request a Consultation</a><Link className="btn btn-light" href="/legal-services">Browse Legal Services</Link></div>
      <div className="trust-row"><span>✓ Nationwide inquiries</span><span>✓ Private owner review</span><span>✓ No automatic lead routing</span></div>
    </div><div className="card"><div className="kpi">How it works</div>
      <div className="info-row"><span>1. Tell us what you need</span><strong>Estate plan, trust, will, succession or related planning</strong></div>
      <div className="info-row"><span>2. Skylight reviews the request</span><strong>Your information enters a private owner queue</strong></div>
      <div className="info-row"><span>3. We contact you</span><strong>We help confirm fit and appointment timing</strong></div>
      <div className="info-row"><span>4. Professional consultation</span><strong>Legal engagement is handled separately by the participating provider</strong></div>
    </div></div></section>

    <section className="section"><div className="container"><div className="section-head"><div><div className="kpi">Estate Planning Services</div><h2>Common reasons people request a consultation</h2><p className="muted">You do not need to know which document or strategy you need before speaking with a professional.</p></div></div>
      <div className="grid grid-3">
        <div className="card"><h3>Wills & Living Trusts</h3><p className="muted">Planning for how assets should be managed and distributed, including wills, revocable trusts and related documents.</p></div>
        <div className="card"><h3>Asset Protection</h3><p className="muted">Explore structures intended to help protect family, business and investment assets within applicable law.</p></div>
        <div className="card"><h3>Business Succession</h3><p className="muted">Plan for ownership transitions, continuity and the long-term future of a closely held business.</p></div>
        <div className="card"><h3>Power of Attorney</h3><p className="muted">Prepare for incapacity and identify who can make financial or other authorized decisions when needed.</p></div>
        <div className="card"><h3>Tax & Legacy Strategy</h3><p className="muted">Coordinate estate-planning goals with wealth-transfer, tax and long-term family considerations.</p></div>
        <div className="card"><h3>Probate & Trust Administration</h3><p className="muted">Request guidance when administering an estate or trust after a death or major transition.</p></div>
      </div>
    </div></section>

    <section className="section"><div className="container grid grid-2"><div className="card"><div className="kpi">Who this may help</div><h2>Families, property owners and business owners</h2><p className="muted">Estate planning is not only for very large estates. People often seek help after marriage, children, buying property, starting or growing a business, retirement, a death in the family, or simply realizing their current documents are outdated.</p></div><div className="card"><div className="kpi">Already have a plan?</div><h2>Reviews and updates matter too</h2><p className="muted">Life changes. Assets change. Businesses change. Laws can change. A consultation can help identify whether an older will, trust, beneficiary structure or succession plan still reflects your goals.</p></div></div></section>

    <section className="section" id="estate-planning-form"><div className="container" style={{maxWidth:980}}><div className="section-head"><div><div className="kpi">Request a Consultation</div><h2>Tell us what you are planning for</h2><p className="muted">Complete what you know. Do not include Social Security numbers, account numbers, passwords, medical records or confidential legal documents.</p></div></div><EstatePlanningLeadForm/></div></section>

    <section className="section"><div className="container"><div className="section-head"><div><div className="kpi">Estate Planning FAQ</div><h2>Questions before you get started</h2></div></div><div className="grid grid-2">{faq.map(([q,a])=><div className="card" key={q}><h3>{q}</h3><p className="muted">{a}</p></div>)}</div></div></section>

    <section className="section"><div className="container"><div className="notice"><strong>Lead-generation and legal-services disclosure:</strong> Central Illinois Local Pros is operated by Skylight Reflections Marketing. Neither is a law firm, and neither provides legal advice. This page is a nationwide lead-generation and consultation-request service. With your consent, your inquiry may be shared with a participating estate-planning service provider for consultation scheduling. Submitting the form does not create an attorney-client relationship and does not guarantee representation, legal results, or a particular planning outcome. Legal services depend on applicable law, professional licensing, conflicts review and acceptance of the engagement.</div><div style={{marginTop:14}}><Link href="/legal-services">Browse Central Illinois attorney listings →</Link></div></div></section>
  </main></SiteShell>
}
