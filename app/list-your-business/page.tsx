import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { BusinessOnboardingFlow } from '@/components/BusinessOnboardingFlow'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireBusinessAccount } from '@/lib/auth'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'List Your Business',description:'Build and submit a Central Illinois Local Pros business profile for staff review, ownership confirmation and verification.',alternates:{canonical:'/list-your-business'}}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const sp=await searchParams
  const account=await requireBusinessAccount('/list-your-business')
  const submitted=sp.submitted==='1'
  const s=await createClient()
  const[{data:categories},{data:cities}]=await Promise.all([
    s.from('categories').select('id,name,vertical').eq('tenant_id',TENANT_ID).eq('is_active',true).order('vertical').order('name'),
    s.from('locations').select('id,name,county').eq('tenant_id',TENANT_ID).eq('is_active',true).in('type',['city','town']).order('name'),
  ])
  return <SiteShell><main className="business-onboarding-page">
    <section className="business-onboarding-hero"><div className="container"><div className="eyebrow">Business Profile Builder · @{account.username}</div><h1>Build your local business profile step by step.</h1><p>Your authenticated Local Pros account is connected to this submission. Start with your business name, phone and email, then add only the information that applies to your business. Nothing becomes public until review, ownership and verification are completed.</p><div className="onboarding-hero-actions"><Link className="btn btn-light" href="/search?claim=1">Already Listed? Find & Claim It</Link><Link className="btn btn-light" href="/account/business-access?next=/list-your-business">Business Account</Link><Link className="btn btn-light" href="/for-businesses">Business Options</Link></div></div></section>
    <section className="section"><div className="container">
      {submitted?<div className="onboarding-success card"><div className="kpi">Profile submitted</div><h2>Your business profile is in the staff review queue.</h2><p className="muted">Your submission is tied to @{account.username}, and any uploaded media remains private. If the profile information is approved, we’ll notify the business email supplied and this account remains the originating owner account for the ownership-review step.</p><div className="onboarding-success-path"><div><b>1</b><span><strong>Staff profile review</strong><small>Business information and staged uploads are checked.</small></span></div><div><b>2</b><span><strong>Claim invitation</strong><small>The approved pending profile stays connected to the account that submitted it.</small></span></div><div><b>3</b><span><strong>Ownership verification</strong><small>You submit ownership evidence while signed in to this account.</small></span></div><div><b>4</b><span><strong>Verified + published</strong><small>Final source-backed verification can make the new profile public.</small></span></div></div><p className="small muted">A paid plan or Sponsored placement is not required for claim approval, verification or organic publication.</p><div className="card-actions"><Link className="btn btn-primary" href="/">Return to Directory</Link><Link className="btn btn-light" href="/for-businesses">Explore Business Tools</Link></div></div>:<>
        <div className="onboarding-intro-grid"><div className="card"><div className="kpi">Account required · @{account.username}</div><h2>Only 3 business-profile fields are mandatory.</h2><p className="muted">Business Name, Business Phone and Business Email are required. Your signed-in username/password account is a separate security requirement and identifies who submitted the business.</p></div><div className="card"><div className="kpi">No instant publication</div><h2>Your profile stays protected while it is reviewed.</h2><p className="muted">Logos, photos and restaurant menus are staged privately. Staff approval creates a pending canonical profile—not a public listing—until ownership and final verification are completed.</p></div></div>
        <BusinessOnboardingFlow categories={(categories??[]) as any[]} cities={(cities??[]) as any[]}/>
      </>}
    </div></section>
  </main></SiteShell>
}
