import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { ChildcareLeadForm } from '@/components/ActionForms'

export const dynamic='force-dynamic'
export const metadata:Metadata={
  title:'Find Childcare in Central Illinois',
  description:'Submit a private childcare request for staff-reviewed matching with published Central Illinois childcare providers. Sensitive child information is not requested.',
  alternates:{canonical:'/childcare'},
}

export default function Page(){
  return <SiteShell><main>
    <section className="pagehero"><div className="container"><div className="crumb">Home › Local Services › Childcare</div><h1>Find Local Childcare</h1><p>Submit a private request for staff-reviewed matching with an appropriate published childcare provider.</p></div></section>
    <section className="section"><div className="container"><div className="grid grid-2">
      <div>
        <div className="card" style={{marginBottom:20}}><div className="kpi">Privacy-first matching</div><h2>What this service does</h2><p>We collect only the basic information needed to understand your childcare request. Your request is not posted publicly. Staff can review it before sharing it with an appropriate published provider.</p><p className="muted small">Do not provide a child’s full name, school, medical information, Social Security number, custody information or other sensitive details.</p></div>
        <div className="card"><h2>Before choosing a provider</h2><p className="muted">Central Illinois Local Pros is a directory and matching service. We do not represent that every childcare arrangement requires the same license or that a provider is licensed, background-checked, insured or appropriate for your family unless that status is specifically verified and displayed.</p><p className="muted">Illinois child-care licensing is administered by the Illinois Department of Early Childhood. Families should independently confirm licensing or exemption status, background checks, references, experience, capacity, safety practices and any other requirements that matter to them.</p><div className="actions"><Link className="btn btn-light" href="/local-services">Browse Local Services</Link><a className="btn btn-light" href="https://earlychildhood.illinois.gov/" target="_blank" rel="noreferrer">Illinois Early Childhood Resources</a></div></div>
      </div>
      <ChildcareLeadForm/>
    </div></div></section>
  </main></SiteShell>
}
