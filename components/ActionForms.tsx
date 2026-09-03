'use client'
import { useActionState } from 'react'
import { submitLead, submitLawnCareLead, submitClaim, submitListingReport, type ActionState } from '@/app/actions'

const init: ActionState = { ok:false, message:'' }
function Status({state}:{state:ActionState}){return state.message?<div className={state.ok?'form-status success':'form-status error'}>{state.message}</div>:null}

export function LeadForm({businessId='',service='',city=''}:{businessId?:string;service?:string;city?:string}){
  const[state,action,pending]=useActionState(submitLead,init)
  return <form action={action} className="form-card">
    <input type="hidden" name="business_id" value={businessId}/>
    <div className="form-grid">
      <label>Service<input name="service" defaultValue={service} required/></label>
      <label>City<input name="city" defaultValue={city} required/></label>
      <label>Name<input name="name" required/></label>
      <label>Phone<input name="phone" required/></label>
      <label>Email<input name="email" type="email" required/></label>
      <label>Timeline<select name="timeline"><option>Immediately</option><option>Within 1 week</option><option>1–4 weeks</option><option>Planning ahead</option></select></label>
    </div>
    <label>What do you need?<textarea name="message"/></label>
    <label className="check"><input name="consent" type="checkbox" required/> I agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me about this request and share my request and contact information with the business I selected, or for a general directory request, with one or more matched local businesses that may contact me by phone, text, or email about this request.</label>
    <p className="small muted">A request sent from a specific business listing stays associated with that business. General requests may be matched through our lead service. This consent is limited to this request and does not authorize unrelated marketing.</p>
    <button className="btn btn-primary" disabled={pending}>{pending?'Sending…':'Request Information'}</button><Status state={state}/>
  </form>
}

export function LawnCareLeadForm(){
  const[state,action,pending]=useActionState(submitLawnCareLead,init)
  return <form action={action} className="form-card">
    <h2>Request Lawn Care</h2>
    <p className="muted small">This form creates a general directory request. Staff review requests before matching or offering them through the Home Services lead marketplace.</p>
    <div className="form-grid">
      <label>What do you need?<select name="need" required defaultValue=""><option value="" disabled>Select service</option><option>Mowing</option><option>Recurring lawn maintenance</option><option>Cleanup</option><option>Landscaping</option><option>Mulch</option><option>Trimming</option><option>Leaf removal</option><option>Brush cleanup</option><option>Other</option></select></label>
      <label>Property type<select name="property_type" required><option>Residential</option><option>Rental</option><option>Commercial</option><option>Other</option></select></label>
      <label>Frequency<select name="frequency" required><option>One-time</option><option>Weekly</option><option>Biweekly</option><option>Monthly</option><option>Seasonal</option><option>Not sure</option></select></label>
      <label>City<input name="city" required maxLength={100}/></label>
      <label>ZIP<input name="zip" inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" required maxLength={10}/></label>
      <label>Preferred timeline<select name="timeline"><option>Immediately</option><option>Within 1 week</option><option>1–4 weeks</option><option>Planning ahead</option></select></label>
      <label>Name<input name="name" required maxLength={120}/></label>
      <label>Phone<input name="phone" required maxLength={40}/></label>
      <label>Email<input name="email" type="email" required maxLength={160}/></label>
    </div>
    <label>Project details<textarea name="details" maxLength={1600} placeholder="Describe the property and work needed. Do not include payment-card, Social Security, or other highly sensitive information."/></label>
    <label className="check"><input name="consent" type="checkbox" required/> I agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me about this request and may share my request and contact information with one or more matched local lawn-care businesses that may contact me by phone, text, or email about this request.</label>
    <p className="small muted">Businesses see only redacted opportunity information before a legitimate lead purchase. Buying a lead does not make a business verified, featured, sponsored, or higher-ranked organically, and a lead is an opportunity rather than a guaranteed job.</p>
    <button className="btn btn-primary" disabled={pending}>{pending?'Sending…':'Submit Lawn Care Request'}</button><Status state={state}/>
  </form>
}

export function ClaimForm({businessId}:{businessId:string}){const[state,action,pending]=useActionState(submitClaim,init);return <form action={action} className="form-card"><input type="hidden" name="business_id" value={businessId}/><label>Your Name<input name="name" required/></label><label>Your Role<input name="role" placeholder="Owner, manager, authorized representative" required/></label><label>Email<input type="email" name="email" required/></label><label>Phone<input name="phone"/></label><button className="btn btn-primary" disabled={pending}>{pending?'Submitting…':'Claim This Listing'}</button><Status state={state}/></form>}
export function ListingReportForm({businessId}:{businessId:string}){const[state,action,pending]=useActionState(submitListingReport,init);return <form action={action} className="form-card"><input type="hidden" name="business_id" value={businessId}/><label>Report Type<select name="report_type"><option value="incorrect_info">Incorrect information</option><option value="ownership_dispute">Ownership dispute</option><option value="closed_business">Closed business</option><option value="duplicate_listing">Duplicate listing</option><option value="inappropriate_content">Inappropriate content</option><option value="other">Other</option></select></label><label>Details<textarea name="details" required minLength={5}/></label><div className="form-grid"><label>Name<input name="name"/></label><label>Email<input type="email" name="email"/></label></div><button className="btn btn-light" disabled={pending}>{pending?'Sending…':'Report / Suggest Edit'}</button><Status state={state}/></form>}
