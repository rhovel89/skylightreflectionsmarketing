'use client'
import { useActionState } from 'react'
import { submitLead, submitLawnCareLead, submitListingReport, type ActionState } from '@/app/actions'

const init: ActionState = { ok:false, message:'' }
function Status({state}:{state:ActionState}){return state.message?<div role="status" aria-live="polite" className={state.ok?'form-status success':'form-status error'}>{state.message}</div>:null}

export function LeadForm({businessId='',service='',city=''}:{businessId?:string;service?:string;city?:string}){
  const[state,action,pending]=useActionState(submitLead,init)
  const direct=Boolean(businessId)
  return <form id="request-information" action={action} className="form-card public-conversion-form">
    <input type="hidden" name="business_id" value={businessId}/>
    <div className="request-assurance"><span>{direct?'Direct request':'Local matching request'}</span><span>No payment required</span><span>Consent applies to this request</span></div>
    <div className="form-intro-row"><span className="form-step">1</span><div><strong>Tell us what you need</strong><small>{direct?'This request stays associated with the business you selected.':'We use the service and city to route a general local request.'}</small></div></div>
    <div className="form-grid">
      <label>Service<input name="service" defaultValue={service} required maxLength={120} autoComplete="off"/></label>
      <label>City<input name="city" defaultValue={city} required maxLength={100} autoComplete="address-level2"/></label>
      <label>Timeline<select name="timeline" defaultValue="Immediately"><option>Immediately</option><option>Within 1 week</option><option>1–4 weeks</option><option>Planning ahead</option></select></label>
      <label className="full-row">What do you need?<textarea name="message" maxLength={1600} placeholder="Describe the service, project or question. Avoid payment-card, Social Security or other highly sensitive information."/></label>
    </div>
    <div className="form-intro-row"><span className="form-step">2</span><div><strong>How should the business reach you?</strong><small>Use contact information where you can respond to this request.</small></div></div>
    <div className="form-grid">
      <label>Name<input name="name" required maxLength={120} autoComplete="name"/></label>
      <label>Phone<input name="phone" type="tel" inputMode="tel" required maxLength={40} autoComplete="tel"/></label>
      <label>Email<input name="email" type="email" required maxLength={160} autoComplete="email"/></label>
    </div>
    <div className="form-intro-row"><span className="form-step">3</span><div><strong>Confirm this request</strong><small>Your consent applies to this request only.</small></div></div>
    <label className="check consent-check"><input name="consent" type="checkbox" required/> I agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me about this request and share my request and contact information with the business I selected, or for a general directory request, with one or more matched local businesses that may contact me by phone, text, or email about this request.</label>
    <p className="small muted conversion-form-note">{direct?'This is a direct directory request for the selected business. It is not automatically redistributed as a general marketplace lead.':'General requests may be matched through the directory lead service. This consent does not authorize unrelated marketing.'}</p>
    <button className="btn btn-primary full" disabled={pending}>{pending?'Sending…':direct?'Send Request to This Business':'Request Local Matches'}</button>
    <div className="request-next-step"><strong>What happens next?</strong><span>{direct?'The selected business can review the request and contact you directly using the information you provided.':'The directory can review the request and match it to eligible local businesses through the applicable lead workflow.'}</span></div>
    <Status state={state}/>
  </form>
}

export function LawnCareLeadForm(){
  const[state,action,pending]=useActionState(submitLawnCareLead,init)
  return <form action={action} className="form-card public-conversion-form">
    <div className="form-intro-row"><span className="form-step">1</span><div><strong>Describe the lawn-care need</strong><small>Staff review general requests before marketplace matching.</small></div></div>
    <div className="form-grid">
      <label>What do you need?<select name="need" required defaultValue=""><option value="" disabled>Select service</option><option>Mowing</option><option>Recurring lawn maintenance</option><option>Cleanup</option><option>Landscaping</option><option>Mulch</option><option>Trimming</option><option>Leaf removal</option><option>Brush cleanup</option><option>Other</option></select></label>
      <label>Property type<select name="property_type" required><option>Residential</option><option>Rental</option><option>Commercial</option><option>Other</option></select></label>
      <label>Frequency<select name="frequency" required><option>One-time</option><option>Weekly</option><option>Biweekly</option><option>Monthly</option><option>Seasonal</option><option>Not sure</option></select></label>
      <label>City<input name="city" required maxLength={100} autoComplete="address-level2"/></label>
      <label>ZIP<input name="zip" inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" required maxLength={10} autoComplete="postal-code"/></label>
      <label>Preferred timeline<select name="timeline"><option>Immediately</option><option>Within 1 week</option><option>1–4 weeks</option><option>Planning ahead</option></select></label>
      <label className="full-row">Project details<textarea name="details" maxLength={1600} placeholder="Describe the property and work needed. Do not include payment-card, Social Security or other highly sensitive information."/></label>
    </div>
    <div className="form-intro-row"><span className="form-step">2</span><div><strong>Add your contact information</strong><small>Matched businesses receive contact information only through the legitimate delivery workflow.</small></div></div>
    <div className="form-grid">
      <label>Name<input name="name" required maxLength={120} autoComplete="name"/></label>
      <label>Phone<input name="phone" type="tel" inputMode="tel" required maxLength={40} autoComplete="tel"/></label>
      <label>Email<input name="email" type="email" required maxLength={160} autoComplete="email"/></label>
    </div>
    <label className="check consent-check"><input name="consent" type="checkbox" required/> I agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me about this request and may share my request and contact information with one or more matched local lawn-care businesses that may contact me by phone, text, or email about this request.</label>
    <p className="small muted conversion-form-note">Businesses see only redacted opportunity information before a legitimate lead purchase. Buying a lead does not make a business verified, featured, sponsored or higher-ranked organically, and a lead is an opportunity rather than a guaranteed job.</p>
    <button className="btn btn-primary full" disabled={pending}>{pending?'Sending…':'Submit Lawn Care Request'}</button><Status state={state}/>
  </form>
}

export function ClaimForm({businessId}:{businessId:string}){
  return <div id="claim-listing" className="form-card public-conversion-form claim-conversion-form">
    <div className="claim-trust-strip"><span>Free claim</span><span>Secure account</span><span>Staff ownership review</span><span>No automatic verification</span></div>
    <div className="form-intro-row"><span className="form-step">1</span><div><strong>Own or manage this business?</strong><small>Use the secure ownership workflow instead of sending an anonymous claim.</small></div></div>
    <p className="small muted">You’ll sign in or create an account, identify your role, choose an ownership-verification method and submit evidence for staff review. An approved claim connects owner access to this canonical listing; it does not create a duplicate listing.</p>
    <div className="claim-next-steps"><div><b>1</b><span><strong>Sign in</strong><small>Use your business/account email.</small></span></div><div><b>2</b><span><strong>Submit evidence</strong><small>Explain how staff can verify your authority.</small></span></div><div><b>3</b><span><strong>Staff review</strong><small>Approved ownership connects the owner portal.</small></span></div></div>
    <a className="btn btn-primary claim-primary-link" href={`/claim?business=${encodeURIComponent(businessId)}`}>Claim This Business</a>
    <p className="small muted conversion-form-note">Claiming is free. Claimed, Verified, Sponsored and paid-plan states remain separate.</p>
  </div>
}

export function ListingReportForm({businessId}:{businessId:string}){
  const[state,action,pending]=useActionState(submitListingReport,init)
  return <form action={action} className="form-card public-conversion-form compact-report-form">
    <input type="hidden" name="business_id" value={businessId}/>
    <label>What needs attention?<select name="report_type"><option value="incorrect_info">Incorrect information</option><option value="ownership_dispute">Ownership dispute</option><option value="closed_business">Closed business</option><option value="duplicate_listing">Duplicate listing</option><option value="inappropriate_content">Inappropriate content</option><option value="other">Other</option></select></label>
    <label>Details<textarea name="details" required minLength={5} maxLength={1600} placeholder="Tell staff what appears incorrect and, when possible, how it can be verified."/></label>
    <div className="form-grid"><label>Name <span className="optional-label">optional</span><input name="name" maxLength={120} autoComplete="name"/></label><label>Email <span className="optional-label">optional</span><input type="email" name="email" maxLength={160} autoComplete="email"/></label></div>
    <button className="btn btn-light" disabled={pending}>{pending?'Sending…':'Send for Staff Review'}</button><Status state={state}/>
  </form>
}
