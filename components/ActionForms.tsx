'use client'
import { useActionState } from 'react'
import { submitLead, submitChildcareLead, submitClaim, submitListingReport, type ActionState } from '@/app/actions'

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

export function ChildcareLeadForm(){
  const[state,action,pending]=useActionState(submitChildcareLead,init)
  return <form action={action} className="form-card">
    <h2>Private Childcare Request</h2>
    <p className="muted small">Give only the information needed to find an appropriate provider. Do not enter a child’s full name, school, medical history, disability information, custody details, Social Security number or other sensitive information.</p>
    <div className="form-grid">
      <label>City<input name="city" required maxLength={100}/></label>
      <label>Number of Children<input name="child_count" type="number" min={1} max={10} defaultValue={1} required/></label>
      <label>Parent / Guardian Name<input name="name" required maxLength={120}/></label>
      <label>Phone<input name="phone" required maxLength={40}/></label>
      <label>Email<input name="email" type="email" required maxLength={160}/></label>
      <label>When do you need care?<select name="timeline"><option>Immediately</option><option>Within 1 week</option><option>1–4 weeks</option><option>Planning ahead</option></select></label>
    </div>
    <fieldset className="form-card" style={{padding:16,margin:'12px 0'}}><legend><strong>Approximate age range(s)</strong></legend>
      <div className="grid grid-2">
        <label className="check"><input type="checkbox" name="age_range" value="Infant"/> Infant</label>
        <label className="check"><input type="checkbox" name="age_range" value="Toddler"/> Toddler</label>
        <label className="check"><input type="checkbox" name="age_range" value="Preschool"/> Preschool</label>
        <label className="check"><input type="checkbox" name="age_range" value="School-age"/> School-age</label>
      </div>
    </fieldset>
    <label>Schedule / general needs<textarea name="schedule" maxLength={1000} placeholder="Example: Mon–Fri, 7:30 AM–4:30 PM; care needed near Pontiac. Do not include sensitive information about a child."/></label>
    <label className="check"><input name="consent" type="checkbox" required/> I agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me about this childcare request and may share the request and my contact information with an appropriate published childcare provider after directory review.</label>
    <p className="small muted">This is a directory matching service, not an employment agency or childcare licensing authority. Provider licensing, exemptions, background-check status, qualifications and fit should be independently confirmed before care begins.</p>
    <button className="btn btn-primary" disabled={pending}>{pending?'Sending…':'Submit Private Childcare Request'}</button><Status state={state}/>
  </form>
}

export function ClaimForm({businessId}:{businessId:string}){const[state,action,pending]=useActionState(submitClaim,init);return <form action={action} className="form-card"><input type="hidden" name="business_id" value={businessId}/><label>Your Name<input name="name" required/></label><label>Your Role<input name="role" placeholder="Owner, manager, authorized representative" required/></label><label>Email<input type="email" name="email" required/></label><label>Phone<input name="phone"/></label><button className="btn btn-primary" disabled={pending}>{pending?'Submitting…':'Claim This Listing'}</button><Status state={state}/></form>}
export function ListingReportForm({businessId}:{businessId:string}){const[state,action,pending]=useActionState(submitListingReport,init);return <form action={action} className="form-card"><input type="hidden" name="business_id" value={businessId}/><label>Report Type<select name="report_type"><option value="incorrect_info">Incorrect information</option><option value="ownership_dispute">Ownership dispute</option><option value="closed_business">Closed business</option><option value="duplicate_listing">Duplicate listing</option><option value="inappropriate_content">Inappropriate content</option><option value="other">Other</option></select></label><label>Details<textarea name="details" required minLength={5}/></label><div className="form-grid"><label>Name<input name="name"/></label><label>Email<input type="email" name="email"/></label></div><button className="btn btn-light" disabled={pending}>{pending?'Sending…':'Report / Suggest Edit'}</button><Status state={state}/></form>}
