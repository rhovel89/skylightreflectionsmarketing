import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { LawnCareLeadForm } from '@/components/ActionForms'

export const dynamic='force-dynamic'
export const metadata:Metadata={
  title:'Lawn Care in Central Illinois | Request Local Service',
  description:'Request mowing, recurring lawn maintenance, cleanup, landscaping, mulch, trimming, leaf removal and other lawn care from local Central Illinois providers.',
  alternates:{canonical:'/lawn-care'},
}

export default function Page(){return <SiteShell><main>
  <section className="pagehero"><div className="container"><div className="crumb">Home › Home Services › Lawn Care</div><h1>Find Local Lawn Care</h1><p>Tell us what you need and staff can review your general request for matching with eligible Central Illinois lawn-care providers.</p></div></section>
  <section className="section"><div className="container"><div className="grid grid-2">
    <div>
      <div className="card" style={{marginBottom:20}}><div className="kpi">Local lawn-care pilot</div><h2>Built for real local projects</h2><p>Request mowing, recurring maintenance, seasonal cleanup, landscaping, mulch, trimming, leaf removal, brush cleanup and other lawn services. The request enters the existing Home Services lead workflow.</p><p className="muted small">A general request may be reviewed, qualified and offered to eligible local businesses. Before a legitimate purchase, businesses see only redacted project information such as service, market, timeline and price — not your full contact details.</p></div>
      <div className="card"><h2>Lead integrity stays separate from rankings</h2><p className="muted">Purchasing an opportunity does not make a business verified, featured or sponsored and never improves its organic ranking. A paid lead is an opportunity, not a guaranteed job or customer.</p><p className="muted">If you contact a specific business from that business’s profile, that request remains associated with the business you selected and is not sold or routed to competitors.</p><div className="actions"><Link className="btn btn-light" href="/home-services">Browse Home Services</Link><Link className="btn btn-light" href="/illinois">Browse by City</Link></div></div>
    </div>
    <LawnCareLeadForm/>
  </div></div></section>
</main></SiteShell>}
