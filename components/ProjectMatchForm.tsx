'use client'
import{FormEvent,useState}from'react'

type Props={businessId?:string;service?:string;city?:string;compact?:boolean}
type State={kind:'idle'|'busy'|'ok'|'error';message:string;leadId?:string}

export function ProjectMatchForm({businessId='',service='',city='',compact=false}:Props){
 const[state,setState]=useState<State>({kind:'idle',message:''})
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setState({kind:'busy',message:'Submitting your project for staff review…'})
  const fd=new FormData(e.currentTarget)
  const payload={business_id:businessId||null,service:String(fd.get('service')||''),city:String(fd.get('city')||''),zip_code:String(fd.get('zip_code')||''),project_type:String(fd.get('project_type')||''),property_type:String(fd.get('property_type')||''),budget_range:String(fd.get('budget_range')||''),timeline:String(fd.get('timeline')||''),preferred_contact:String(fd.get('preferred_contact')||''),name:String(fd.get('name')||''),phone:String(fd.get('phone')||''),email:String(fd.get('email')||''),message:String(fd.get('message')||''),consent:fd.get('consent')==='on',answers:{project_size:String(fd.get('project_size')||''),financing_interested:fd.get('financing_interested')==='on',decision_stage:String(fd.get('decision_stage')||'')}}
  const r=await fetch('/api/project-match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
  const body=await r.json().catch(()=>({}))
  if(!r.ok){setState({kind:'error',message:String(body.error||'Unable to submit your project.')});return}
  setState({kind:'ok',message:'Your project is in the private Admin review queue. No business receives your contact information until staff deliberately matches and delivers the request.',leadId:body.lead_id})
  e.currentTarget.reset()
 }
 return <form onSubmit={submit} className="form-card public-conversion-form">
  <div className="request-assurance"><span>Staff-reviewed matching</span><span>No payment required</span><span>No automatic lead routing</span></div>
  <div className="form-intro-row"><span className="form-step">1</span><div><strong>Tell us about the project</strong><small>Structured details help us match the right local professional instead of blasting your request everywhere.</small></div></div>
  <div className="form-grid">
   <label>Service needed<input name="service" defaultValue={service} required maxLength={120} placeholder="HVAC replacement, estate planning, landscaping…"/></label>
   <label>City<input name="city" defaultValue={city} required maxLength={100} autoComplete="address-level2"/></label>
   <label>ZIP code<input name="zip_code" maxLength={10} inputMode="numeric" autoComplete="postal-code" placeholder="61764"/></label>
   <label>Project type<input name="project_type" maxLength={120} placeholder="Replacement, repair, consultation…"/></label>
   <label>Property / need type<select name="property_type" defaultValue=""><option value="">Not applicable / not sure</option><option>Residential</option><option>Commercial</option><option>Rental property</option><option>Business</option><option>Personal / legal matter</option><option>Other</option></select></label>
   <label>Budget range<select name="budget_range" defaultValue=""><option value="">Not sure / prefer to discuss</option><option>Under $500</option><option>$500–$1,500</option><option>$1,500–$5,000</option><option>$5,000–$10,000</option><option>$10,000–$25,000</option><option>$25,000+</option></select></label>
   <label>Timeline<select name="timeline" defaultValue="Within 1–4 weeks"><option>Immediately</option><option>Within 1 week</option><option>Within 1–4 weeks</option><option>1–3 months</option><option>Planning ahead</option></select></label>
   <label>Preferred contact<select name="preferred_contact"><option>Phone</option><option>Text</option><option>Email</option><option>Any</option></select></label>
   {!compact&&<><label>Approx. project size<input name="project_size" maxLength={120} placeholder="1,800 sq ft, 3 rooms, 2 locations…"/></label><label>Decision stage<select name="decision_stage"><option>Ready to hire</option><option>Comparing options</option><option>Need an estimate</option><option>Researching</option></select></label></>}
   <label className="full-row">Project details<textarea name="message" maxLength={2400} placeholder="Describe what you need, relevant constraints, and what a professional should know. Do not include payment-card, Social Security, medical, or other highly sensitive information."/></label>
  </div>
  {!compact&&<label className="check"><input name="financing_interested" type="checkbox"/> I may be interested in financing or payment options if the matched business offers them.</label>}
  <div className="form-intro-row"><span className="form-step">2</span><div><strong>How can a matched professional reach you?</strong><small>Your contact information remains private until staff deliberately delivers this request.</small></div></div>
  <div className="form-grid"><label>Name<input name="name" required maxLength={120} autoComplete="name"/></label><label>Phone<input name="phone" type="tel" required maxLength={40} autoComplete="tel"/></label><label>Email<input name="email" type="email" required maxLength={160} autoComplete="email"/></label></div>
  <label className="check consent-check"><input name="consent" type="checkbox" required/> I agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me about this request and may share this request and my contact information with the specific business I selected or with one or more local businesses that staff deliberately matches to this request.</label>
  <p className="small muted conversion-form-note"><strong>Admin-first rule:</strong> submitting this form does not automatically route, sell, bill, or release the lead. Sponsored status and paid plans do not control matching or organic directory rank.</p>
  <button className="btn btn-primary full" disabled={state.kind==='busy'}>{state.kind==='busy'?'Submitting…':businessId?'Request a Match With This Business':'Find Local Pros for My Project'}</button>
  {state.message&&<div role="status" className={state.kind==='error'?'form-status error':'form-status success'}>{state.message}</div>}
 </form>
}
