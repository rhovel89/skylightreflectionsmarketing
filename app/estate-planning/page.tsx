import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { EstatePlanningLeadForm } from '@/components/EstatePlanningLeadForm'

export const metadata:Metadata={
  title:'Estate Planning Consultation Request | Nationwide',
  description:'Answer a few preliminary estate-planning questions and request help coordinating a consultation appointment with an estate-planning attorney.',
  alternates:{canonical:'/estate-planning'},
  openGraph:{type:'website',url:'/estate-planning',title:'Estate Planning Consultation Request — Nationwide',description:'Answer preliminary qualifying questions and request help coordinating an estate-planning consultation appointment.'},
}

const faq=[
  ['What happens after I submit the form?','Skylight Reflections Marketing reviews the preliminary qualifying information, follows up with you, and helps coordinate an appointment with the estate-planning attorney.'],
  ['What information should I provide?','Only basic contact information and preliminary qualifying details about the type of estate-planning help you are looking for, your location, general family context, and preferred timing. Do not send legal documents, account numbers, Social Security numbers, passwords, medical records, or other sensitive files.'],
  ['Can I request a consultation if I already have a will or trust?','Yes. One of the preliminary questions asks whether you already have a will or trust so the attorney has basic context for the consultation.'],
  ['Does Skylight provide legal advice?','No. Central Illinois Local Pros and Skylight Reflections Marketing are not law firms. Skylight only handles preliminary qualification, follow-up, and appointment coordination.'],
  ['Does submitting this form create an attorney-client relationship?','No. Submitting the form only starts the qualification and appointment-setting process. Any attorney-client relationship is handled separately by the attorney or law office.'],
]

export default function Page(){
  const schema=[
    {'@context':'https://schema.org','@type':'WebPage',name:'Estate Planning Consultation Request — Nationwide',url:'https://central-il-local-pros.vercel.app/estate-planning',description:'A nationwide preliminary qualification and appointment-setting page operated by Skylight Reflections Marketing.'},
    {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))},
  ]
  return <SiteShell><main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>

    <section className="hero"><div className="container hero-grid"><div>
      <div className="eyebrow">Estate Planning & Trust · Nationwide</div>
      <h1>Start with a few qualifying questions. Then we help book your consultation.</h1>
      <p>If you are looking for help with a will, trust, estate-plan update, asset protection, business succession, power of attorney, probate, or related planning, complete the short form below. Skylight Reflections Marketing asks preliminary qualifying questions, follows up with you, and coordinates an appointment with the estate-planning attorney.</p>
      <div className="hero-actions"><a className="btn btn-primary" href="#estate-planning-form">Request a Consultation</a><Link className="btn btn-light" href="/legal-services">Browse Legal Services</Link></div>
      <div className="trust-row"><span>✓ Preliminary qualification</span><span>✓ Appointment coordination</span><span>✓ No legal advice from Skylight</span></div>
    </div><div className="card"><div className="kpi">How it works</div>
      <div className="info-row"><span>1. Answer a few questions</span><strong>Basic estate-planning need, location and timing</strong></div>
      <div className="info-row"><span>2. Skylight reviews the inquiry</span><strong>We confirm whether the inquiry meets the appointment criteria</strong></div>
      <div className="info-row"><span>3. We contact you</span><strong>We confirm details and coordinate an available appointment</strong></div>
      <div className="info-row"><span>4. Speak with the attorney</span><strong>The attorney handles the legal consultation separately</strong></div>
    </div></div></section>

    <section className="section"><div className="container"><div className="section-head"><div><div className="kpi">Common Consultation Topics</div><h2>What are you looking for help with?</h2><p className="muted">You do not need to diagnose your own legal needs. These choices simply help with preliminary qualification before the appointment.</p></div></div>
      <div className="grid grid-3">
        <div className="card"><h3>Wills & Living Trusts</h3><p className="muted">New planning, updates to an existing plan, wills, revocable trusts and related estate-planning questions.</p></div>
        <div className="card"><h3>Asset Protection</h3><p className="muted">General consultation requests involving family, business or investment assets.</p></div>
        <div className="card"><h3>Business Succession</h3><p className="muted">Questions about continuity, ownership transitions and long-term planning for a closely held business.</p></div>
        <div className="card"><h3>Power of Attorney</h3><p className="muted">Consultation requests involving financial or incapacity planning.</p></div>
        <div className="card"><h3>Tax & Legacy Planning</h3><p className="muted">Questions involving long-term family, wealth-transfer or legacy goals.</p></div>
        <div className="card"><h3>Probate & Trust Administration</h3><p className="muted">Consultation requests involving an estate or trust after a death or major transition.</p></div>
      </div>
    </div></section>

    <section className="section" id="estate-planning-form"><div className="container" style={{maxWidth:980}}><div className="section-head"><div><div className="kpi">Request a Consultation</div><h2>Answer the preliminary qualifying questions</h2><p className="muted">Only provide the basic information requested here. Do not upload or send legal documents, Social Security numbers, account numbers, passwords, medical records, or other sensitive records.</p></div></div><EstatePlanningLeadForm/></div></section>

    <section className="section"><div className="container"><div className="section-head"><div><div className="kpi">Estate Planning FAQ</div><h2>Questions before you get started</h2></div></div><div className="grid grid-2">{faq.map(([q,a])=><div className="card" key={q}><h3>{q}</h3><p className="muted">{a}</p></div>)}</div></div></section>

    <section className="section"><div className="container"><div className="notice"><strong>Appointment-setting disclosure:</strong> Central Illinois Local Pros is operated by Skylight Reflections Marketing. Neither is a law firm and neither provides legal advice. Skylight's role is limited to preliminary qualification, follow-up, and appointment coordination. Skylight does not collect legal documents or sensitive financial/account information for the attorney. With your consent, the contact information and qualifying answers you submit may be shared with the estate-planning attorney or law office connected to the appointment request. Submitting this form does not create an attorney-client relationship.</div></div></section>
  </main></SiteShell>
}
