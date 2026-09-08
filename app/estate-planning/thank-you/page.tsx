import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'

export const metadata:Metadata={
  title:'Estate Planning Request Received',
  description:'Confirmation for an estate-planning consultation request.',
  robots:{index:false,follow:false,noarchive:true},
}

export default function Page(){
  return <SiteShell><main><section className="section"><div className="container" style={{maxWidth:820}}>
    <div className="card"><div className="kpi">Request Received</div><h1>Thank you. Your estate-planning consultation request is ready for review.</h1>
      <p className="muted">Skylight Reflections Marketing will review your preliminary qualifying answers, contact you if needed, and coordinate an appointment if the inquiry meets the appointment criteria.</p>
      <div className="notice" style={{marginTop:16}}><strong>Important:</strong> Central Illinois Local Pros and Skylight Reflections Marketing are not law firms and do not provide legal advice. We do not collect legal documents or sensitive financial/account information for the attorney. This confirmation does not create an attorney-client relationship or guarantee an appointment, representation, legal result, or planning outcome.</div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:18}}><Link className="btn btn-primary" href="/">Return Home</Link><Link className="btn btn-light" href="/legal-services">Browse Legal Services</Link></div>
    </div>
  </div></section></main></SiteShell>
}
