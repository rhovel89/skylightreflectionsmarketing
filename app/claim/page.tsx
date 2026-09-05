import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound,redirect } from 'next/navigation'
import { SiteShell } from '@/components/SiteShell'
import { OwnershipClaimForm } from '@/components/OwnershipClaimForm'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Claim Your Business',description:'Secure business ownership review for Central Illinois Local Pros.',robots:{index:false,follow:false}}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const sp=await searchParams
  const businessId=typeof sp.business==='string'?sp.business:''
  if(!businessId)redirect('/search?claim=1')
  await requireUser(`/claim?business=${encodeURIComponent(businessId)}`)
  const s=await createClient()
  const{data:userData}=await s.auth.getUser()
  const email=userData.user?.email||''
  const{data,error}=await s.rpc('get_claimable_business',{p_business_id:businessId})
  if(error||!data?.length)notFound()
  const business=data[0] as any
  return <SiteShell><main className="business-onboarding-page">
    <section className="business-onboarding-hero"><div className="container"><div className="eyebrow">Secure Ownership Review</div><h1>Claim {business.name}</h1><p>Claiming connects an approved owner or authorized representative to the canonical business profile. It is free and does not automatically create verification, Sponsored placement or a better organic position.</p><div className="onboarding-hero-actions"><Link className="btn btn-light" href="/search?claim=1">Find Another Business</Link><Link className="btn btn-light" href="/for-businesses">How Business Accounts Work</Link></div></div></section>
    <section className="section"><div className="container claim-workflow-container">
      <div className="onboarding-intro-grid"><div className="card"><div className="kpi">Signed-in account</div><h2>{email}</h2><p className="muted">For a newly approved pending profile, this account email must match the email used on the original business submission.</p></div><div className="card"><div className="kpi">Current listing gate</div><h2>{business.status==='pending'?'Approved profile · ownership pending':'Published profile · ownership pending'}</h2><p className="muted">After staff approves ownership, a new pending profile still requires final source-backed directory verification before publication.</p></div></div>
      <OwnershipClaimForm businessId={business.id} accountEmail={email}/>
    </div></section>
  </main></SiteShell>
}
