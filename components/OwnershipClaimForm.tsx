'use client'

import { useActionState } from 'react'
import { submitOwnershipClaim,type ClaimState } from '@/app/claim/actions'

const initial:ClaimState={ok:false,message:''}
const methods=[
  ['business_email','Business email / company domain','I can verify through an email or domain controlled by the business.'],
  ['listed_phone','Listed business phone','I can verify through the phone number already associated with the business.'],
  ['official_website','Official website','The business website identifies me or provides ownership/contact evidence.'],
  ['registration_license','Registration / license / public record','A state, county, professional or licensing record can support ownership.'],
  ['business_document','Business document','I can describe a legitimate business document staff can request or verify.'],
  ['official_social','Official social profile','An established official business social account can support the claim.'],
  ['other','Other evidence','I have another legitimate way for staff to verify my authority.'],
] as const

export function OwnershipClaimForm({businessId,accountEmail}:{businessId:string;accountEmail:string}){
  const[state,action,pending]=useActionState(submitOwnershipClaim,initial)
  return <form action={action} className="form-card public-conversion-form ownership-claim-form">
    <input type="hidden" name="business_id" value={businessId}/>
    <div className="claim-trust-strip"><span>Free ownership review</span><span>Account required</span><span>Staff verified</span><span>No paid plan required</span></div>
    <div className="form-intro-row"><span className="form-step">1</span><div><strong>Confirm who you are</strong><small>Your signed-in email is locked to this ownership request.</small></div></div>
    <div className="form-grid"><label>Your Name<input name="name" required maxLength={120} autoComplete="name"/></label><label>Your Role<input name="role" required maxLength={120} placeholder="Owner, manager, authorized representative"/></label><label>Signed-in Email<input value={accountEmail} readOnly aria-readonly="true"/></label><label>Phone <span className="optional-label">optional</span><input name="phone" type="tel" maxLength={40} autoComplete="tel"/></label></div>
    <div className="form-intro-row"><span className="form-step">2</span><div><strong>Choose how staff can verify ownership</strong><small>Select the strongest evidence available. Staff may request additional confirmation.</small></div></div>
    <div className="ownership-methods">{methods.map(([value,title,copy])=><label key={value}><input type="radio" name="verification_method" value={value} required/><span><strong>{title}</strong><small>{copy}</small></span></label>)}</div>
    <label>Ownership / authorization evidence<textarea name="verification_details" required minLength={10} maxLength={1800} placeholder="Explain exactly how staff can confirm that you own, manage or are authorized to represent this business. Include registry/license numbers or other non-sensitive verification details when useful."/></label>
    <label>Verification URL <span className="optional-label">optional</span><input name="verification_url" type="url" maxLength={600} placeholder="https:// official website, registry, licensing page or business social profile"/></label>
    <div className="onboarding-note"><strong>Do not upload sensitive identity documents here.</strong><span>Do not include Social Security numbers, payment-card data, passwords, full government-ID numbers or other highly sensitive personal information. Staff can request an appropriate verification step if more evidence is needed.</span></div>
    <div className="form-intro-row"><span className="form-step">3</span><div><strong>Submit for protected staff review</strong><small>Approval marks the listing Claimed. It does not automatically create the Verified badge or buy organic ranking.</small></div></div>
    <button className="btn btn-primary full" disabled={pending}>{pending?'Submitting ownership evidence…':'Submit Ownership Evidence for Review'}</button>
    {state.message&&<div role="status" className={state.ok?'form-status success':'form-status error'}>{state.message}</div>}
  </form>
}
