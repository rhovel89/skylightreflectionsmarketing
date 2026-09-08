'use client'

import { FormEvent, useState } from 'react'

const STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
] as const

type State = { kind:'idle'|'busy'|'ok'|'error'; message:string }

export function EstatePlanningLeadForm(){
  const [state,setState]=useState<State>({kind:'idle',message:''})

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    setState({kind:'busy',message:'Submitting your consultation request…'})
    const fd=new FormData(e.currentTarget)
    const payload={
      consumer_name:String(fd.get('consumer_name')||''),
      phone:String(fd.get('phone')||''),
      email:String(fd.get('email')||''),
      city:String(fd.get('city')||''),
      state:String(fd.get('state')||''),
      zip_code:String(fd.get('zip_code')||''),
      primary_need:String(fd.get('primary_need')||''),
      existing_plan:String(fd.get('existing_plan')||''),
      family_context:String(fd.get('family_context')||''),
      business_owner:fd.get('business_owner')==='on',
      real_estate_owner:fd.get('real_estate_owner')==='on',
      timeline:String(fd.get('timeline')||''),
      preferred_contact:String(fd.get('preferred_contact')||''),
      message:String(fd.get('message')||''),
      consent_to_contact:fd.get('consent_to_contact')==='on',
      consent_to_share:fd.get('consent_to_share')==='on',
    }
    const r=await fetch('/api/estate-planning-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const body=await r.json().catch(()=>({}))
    if(!r.ok){setState({kind:'error',message:String(body.error||'Unable to submit your request.')});return}
    setState({kind:'ok',message:'Thank you. Your request is in our private owner queue. Skylight Reflections Marketing will contact you to help with next steps and consultation scheduling. Your information is not automatically sent or sold when you submit this form.'})
    e.currentTarget.reset()
  }

  return <form className="form-card public-conversion-form" onSubmit={submit}>
    <div className="request-assurance"><span>Nationwide inquiries</span><span>Private owner review</span><span>No automatic lead routing</span></div>

    <div className="form-intro-row"><span className="form-step">1</span><div><strong>What kind of planning help are you looking for?</strong><small>Choose the closest fit. You do not need to know the exact legal document you need.</small></div></div>
    <div className="form-grid">
      <label>Planning need<select name="primary_need" required defaultValue=""><option value="" disabled>Select a planning need</option><option>New estate plan</option><option>Update an existing estate plan</option><option>Will and testament</option><option>Living / revocable trust</option><option>Irrevocable or advanced trust planning</option><option>Asset protection</option><option>Business succession planning</option><option>Tax and legacy planning</option><option>Power of attorney / incapacity planning</option><option>Probate or trust administration</option><option>Not sure — need guidance</option></select></label>
      <label>Do you already have a will or trust?<select name="existing_plan" defaultValue="No"><option>No</option><option>Yes — will only</option><option>Yes — trust</option><option>Yes — both</option><option>Not sure</option></select></label>
      <label>Family situation<select name="family_context" defaultValue=""><option value="">Optional / prefer to discuss</option><option>Single</option><option>Married / partnered</option><option>Children or dependents</option><option>Blended family</option><option>Special-needs planning</option><option>Other</option></select></label>
      <label>When would you like to speak with someone?<select name="timeline" defaultValue="Within 1–2 weeks"><option>As soon as possible</option><option>Within 1 week</option><option>Within 1–2 weeks</option><option>Within 1 month</option><option>Planning ahead</option></select></label>
    </div>
    <div className="grid grid-2" style={{marginTop:10}}>
      <label className="check"><input name="business_owner" type="checkbox"/> I own a business or closely held company.</label>
      <label className="check"><input name="real_estate_owner" type="checkbox"/> I own real estate or investment property.</label>
    </div>

    <div className="form-intro-row"><span className="form-step">2</span><div><strong>Where are you located?</strong><small>Estate-planning laws vary by state. Location helps us qualify the consultation correctly.</small></div></div>
    <div className="form-grid">
      <label>City<input name="city" required maxLength={100} autoComplete="address-level2"/></label>
      <label>State<select name="state" required defaultValue=""><option value="" disabled>Select state</option>{STATES.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
      <label>ZIP code<input name="zip_code" required maxLength={10} inputMode="numeric" autoComplete="postal-code" placeholder="12345"/></label>
      <label>Preferred contact<select name="preferred_contact" defaultValue="Phone"><option>Phone</option><option>Text</option><option>Email</option><option>Any</option></select></label>
      <label className="full-row">Anything else we should know?<textarea name="message" maxLength={2000} rows={4} placeholder="Share general goals or questions. Do not include Social Security numbers, bank/account numbers, passwords, or confidential legal documents."/></label>
    </div>

    <div className="form-intro-row"><span className="form-step">3</span><div><strong>How can we reach you?</strong><small>Skylight Reflections Marketing will use this information to follow up about your consultation request.</small></div></div>
    <div className="form-grid">
      <label>Name<input name="consumer_name" required maxLength={120} autoComplete="name"/></label>
      <label>Phone<input name="phone" required type="tel" maxLength={40} autoComplete="tel"/></label>
      <label>Email<input name="email" required type="email" maxLength={160} autoComplete="email"/></label>
    </div>

    <label className="check consent-check"><input name="consent_to_contact" type="checkbox" required/> I agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me by phone, text, or email about this estate-planning consultation request. Message and data rates may apply.</label>
    <label className="check consent-check"><input name="consent_to_share" type="checkbox" required/> I agree that Skylight Reflections Marketing may share this request and my contact information with a <strong>participating estate-planning service provider</strong> for the purpose of discussing and scheduling an estate-planning consultation.</label>

    <div className="notice" style={{marginTop:12}}><strong>Important:</strong> Central Illinois Local Pros and Skylight Reflections Marketing are not law firms and do not provide legal advice. Submitting this form does not create an attorney-client relationship. Legal representation, if any, begins only after an attorney accepts the matter and the required engagement process is completed.</div>
    <button className="btn btn-primary full" disabled={state.kind==='busy'}>{state.kind==='busy'?'Submitting…':'Request My Estate Planning Consultation'}</button>
    {state.message?<div role="status" className={state.kind==='error'?'form-status error':'form-status success'}>{state.message}</div>:null}
  </form>
}
