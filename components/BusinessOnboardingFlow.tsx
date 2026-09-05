'use client'

import { useMemo, useRef, useState } from 'react'
import { submitBusinessOnboarding } from '@/app/list-your-business/actions'

type Option={id:string;name:string;vertical?:string;county?:string|null}
const steps=['Business','Business type','Profile','Location','Media','Review']

export function BusinessOnboardingFlow({categories,cities}:{categories:Option[];cities:Option[]}){
  const[step,setStep]=useState(0)
  const[error,setError]=useState('')
  const[name,setName]=useState('')
  const[phone,setPhone]=useState('')
  const[email,setEmail]=useState('')
  const[model,setModel]=useState('')
  const[category,setCategory]=useState('')
  const formRef=useRef<HTMLFormElement>(null)
  const selectedCategory=useMemo(()=>categories.find(x=>x.name===category),[categories,category])
  const restaurant=selectedCategory?.vertical==='restaurant'
  const physical=model==='storefront'||model==='both'

  function next(){
    setError('')
    if(step===0){if(name.trim().length<2||phone.trim().length<7||!email.includes('@')){setError('Business name, phone number and email are required before continuing.');return}}
    if(step===1&&!model){setError('Choose Online Business, Storefront, or Both before continuing.');return}
    setStep(s=>Math.min(steps.length-1,s+1));window.scrollTo({top:0,behavior:'smooth'})
  }
  function back(){setError('');setStep(s=>Math.max(0,s-1));window.scrollTo({top:0,behavior:'smooth'})}

  return <form ref={formRef} action={submitBusinessOnboarding} className="business-onboarding-form" encType="multipart/form-data">
    <label className="onboarding-honeypot" aria-hidden="true">Leave blank<input name="cilp_form_guard" tabIndex={-1} autoComplete="off"/></label>
    <div className="onboarding-progress" aria-label="Business profile progress">{steps.map((label,i)=><div className={`${i===step?'active ':''}${i<step?'done':''}`} key={label}><span>{i<step?'✓':i+1}</span><small>{label}</small></div>)}</div>
    {error&&<div className="form-status error" role="alert">{error}</div>}

    <section hidden={step!==0} className="onboarding-step">
      <div className="onboarding-step-head"><div className="kpi">Step 1 of 6</div><h2>Make sure we have the business right.</h2><p>Start with the three details we need to identify the business and contact you about this submission. Everything else in the profile can be completed as it applies to your business.</p></div>
      <div className="form-grid">
        <label className="full-row">Business Name <b>Required</b><input name="business_name" required minLength={2} maxLength={200} value={name} onChange={e=>setName(e.target.value)} autoComplete="organization" placeholder="Exact public business name"/></label>
        <label>Business Phone <b>Required</b><input name="phone" required type="tel" minLength={7} maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"/></label>
        <label>Business Email <b>Required</b><input name="email" required type="email" maxLength={180} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
        <label className="full-row">Your Name <span>Optional</span><input name="contact_name" maxLength={120} autoComplete="name" placeholder="Owner, manager or person completing this profile"/></label>
      </div>
      <div className="onboarding-note"><strong>Why the email matters</strong><span>If staff approves the profile information, the ownership invitation is sent to this email. The account used to claim a new pending profile must match it.</span></div>
    </section>

    <section hidden={step!==1} className="onboarding-step">
      <div className="onboarding-step-head"><div className="kpi">Step 2 of 6</div><h2>How does this business operate?</h2><p>This prevents an online or service-area business from being shown as having a storefront it does not actually have.</p></div>
      <div className="business-model-grid">
        <label className={model==='online'?'selected':''}><input type="radio" name="operating_model" value="online" checked={model==='online'} onChange={()=>setModel('online')}/><strong>Online Business</strong><span>No public storefront or customer-facing office is being submitted.</span></label>
        <label className={model==='storefront'?'selected':''}><input type="radio" name="operating_model" value="storefront" checked={model==='storefront'} onChange={()=>setModel('storefront')}/><strong>Storefront / Physical Location</strong><span>Customers can visit a real office, store, restaurant, shop or service center.</span></label>
        <label className={model==='both'?'selected':''}><input type="radio" name="operating_model" value="both" checked={model==='both'} onChange={()=>setModel('both')}/><strong>Both</strong><span>The business operates online and also has a legitimate customer-facing physical location.</span></label>
      </div>
      <div className="onboarding-note"><strong>Location integrity</strong><span>A service area is never converted into a fake office. Physical address information is only used when you tell us a real location exists.</span></div>
    </section>

    <section hidden={step!==2} className="onboarding-step">
      <div className="onboarding-step-head"><div className="kpi">Step 3 of 6</div><h2>Build the business profile.</h2><p>Add as much useful customer-facing information as you have. These fields are optional and can be reviewed before publication.</p></div>
      <div className="form-grid">
        <label>Category <span>Optional</span><select name="category" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Choose a category later</option>{categories.map(c=><option key={c.id} value={c.name}>{c.vertical?`${c.vertical} · `:''}{c.name}</option>)}</select></label>
        <label>Website <span>Optional</span><input type="url" name="website" placeholder="https://"/></label>
        <label>Hours <span>Optional</span><input name="hours" maxLength={500} placeholder="Mon–Fri 8 AM–5 PM"/></label>
        <label>Price Range <span>Optional</span><input name="price_range" maxLength={80} placeholder="$ · $$ · Starting at…"/></label>
        <label className="full-row">Business Description <span>Optional</span><textarea name="description" maxLength={2400} placeholder="What does the business do, who does it help, and what should a customer know?"/></label>
        <label className="full-row">Services / Products <span>Optional</span><textarea name="services" maxLength={1800} placeholder={'One per line or comma-separated\nExample: Drain cleaning, Water heater repair, Emergency plumbing'}/></label>
      </div>
      <div className="onboarding-social-grid"><label>Facebook <span>Optional</span><input type="url" name="facebook" placeholder="https://facebook.com/..."/></label><label>Instagram <span>Optional</span><input type="url" name="instagram" placeholder="https://instagram.com/..."/></label><label>LinkedIn <span>Optional</span><input type="url" name="linkedin" placeholder="https://linkedin.com/..."/></label><label>TikTok <span>Optional</span><input type="url" name="tiktok" placeholder="https://tiktok.com/..."/></label><label>YouTube <span>Optional</span><input type="url" name="youtube" placeholder="https://youtube.com/..."/></label></div>
      {restaurant&&<div className="restaurant-onboarding-box"><div className="kpi">Restaurant profile detected</div><h3>Restaurant-specific links</h3><div className="form-grid"><label>Menu URL <span>Optional</span><input type="url" name="menu_url" placeholder="https://..."/></label><label>Online Ordering <span>Optional</span><input type="url" name="ordering_url" placeholder="https://..."/></label><label>Reservations <span>Optional</span><input type="url" name="reservation_url" placeholder="https://..."/></label></div></div>}
    </section>

    <section hidden={step!==3} className="onboarding-step">
      <div className="onboarding-step-head"><div className="kpi">Step 4 of 6</div><h2>{physical?'Add the real location and areas served.':'Tell us where you serve customers.'}</h2><p>{physical?'Address fields are optional, but only a real customer-facing location should be entered.':'Online and service-area businesses can list legitimate areas served without creating a physical office.'}</p></div>
      {physical&&<div className="form-grid"><label>City / Town <span>Optional</span><select name="city" defaultValue=""><option value="">Choose later</option>{cities.map(c=><option key={c.id} value={c.name}>{c.name}{c.county?` — ${c.county}`:''}</option>)}</select></label><label>Street Address <span>Optional</span><input name="address_text" maxLength={500} autoComplete="street-address"/></label><label>State <span>Optional</span><input name="state" defaultValue="IL" maxLength={30}/></label><label>ZIP <span>Optional</span><input name="postal_code" maxLength={20} autoComplete="postal-code"/></label></div>}
      {!physical&&<input type="hidden" name="city" value=""/>}
      <label className="onboarding-wide-label">Service Areas <span>Optional</span><input name="service_areas" maxLength={1200} placeholder="Pontiac, Dwight, Livingston County — comma separated"/></label>
      <div className="onboarding-note"><strong>{model==='online'?'Online-only profile':'Physical + service-area profile'}</strong><span>{model==='online'?'We will not invent or display a storefront from service-area information.':'The physical location and service areas stay separate in the directory so customers can tell the difference.'}</span></div>
    </section>

    <section hidden={step!==4} className="onboarding-step">
      <div className="onboarding-step-head"><div className="kpi">Step 5 of 6</div><h2>Add the visuals that make the profile yours.</h2><p>All uploads are optional and held privately with the submission until staff approves the profile. They are not public merely because they were uploaded.</p></div>
      <div className="media-upload-grid"><label><strong>Business Logo</strong><span>JPEG, PNG or WebP · up to 8 MB</span><input type="file" name="logo" accept="image/jpeg,image/png,image/webp"/></label><label><strong>Cover Image</strong><span>JPEG, PNG or WebP · up to 8 MB</span><input type="file" name="cover" accept="image/jpeg,image/png,image/webp"/></label><label><strong>Gallery Photos</strong><span>Select multiple photos · up to 8 MB each</span><input type="file" name="gallery_images" accept="image/jpeg,image/png,image/webp" multiple/></label>{restaurant&&<label className="restaurant-menu-upload"><strong>Restaurant Menu</strong><span>Optional PDF, JPEG, PNG or WebP · up to 12 MB</span><input type="file" name="menu" accept="application/pdf,image/jpeg,image/png,image/webp"/></label>}</div>
      {restaurant&&<div className="onboarding-note"><strong>Menu review</strong><span>The uploaded menu is staged for staff review. Publication and display also remain subject to the listing’s active profile entitlements.</span></div>}
    </section>

    <section hidden={step!==5} className="onboarding-step">
      <div className="onboarding-step-head"><div className="kpi">Step 6 of 6</div><h2>Review the path before you submit.</h2><p>Your information goes to staff first. It does not become a public, claimed or verified listing automatically.</p></div>
      <div className="onboarding-review-grid"><div><span>Business</span><strong>{name||'—'}</strong></div><div><span>Phone</span><strong>{phone||'—'}</strong></div><div><span>Email</span><strong>{email||'—'}</strong></div><div><span>Business type</span><strong>{model==='online'?'Online Business':model==='storefront'?'Storefront / Physical Location':model==='both'?'Online + Storefront':'—'}</strong></div><div><span>Category</span><strong>{category||'Not provided yet'}</strong></div><div><span>Restaurant flow</span><strong>{restaurant?'Enabled':'Not applicable'}</strong></div></div>
      <div className="onboarding-publication-path"><div><b>1</b><span><strong>Profile review</strong><small>Staff reviews the business information and staged media.</small></span></div><div><b>2</b><span><strong>Claim invitation</strong><small>If approved, we email you a secure path to claim the pending profile.</small></span></div><div><b>3</b><span><strong>Ownership review</strong><small>You submit ownership evidence from an account using this email.</small></span></div><div><b>4</b><span><strong>Verification + publish</strong><small>Final verification can publish the profile. Paid products are not required.</small></span></div></div>
      <label className="check consent-check"><input type="checkbox" name="consent" required/> I confirm the information is submitted in good faith and agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me about this business submission, ownership review, verification and account access.</label>
      <label className="check consent-check optional-marketing-consent"><input type="checkbox" name="marketing_opt_in"/> Optional: send me business-growth education, directory Sponsored/Featured information, and Skylight Reflections Marketing tips by email. I can unsubscribe at any time.</label>
      <div className="onboarding-note"><strong>Trust rules stay separate</strong><span>Submission ≠ approval. Approval ≠ claimed. Claimed ≠ verified. Paid placement ≠ verification or organic rank.</span></div>
    </section>

    <div className="onboarding-actions">{step>0&&<button type="button" className="btn btn-light" onClick={back}>← Back</button>}<span/><>{step<steps.length-1?<button type="button" className="btn btn-primary" onClick={next}>Continue →</button>:<button type="submit" className="btn btn-primary">Submit Completed Profile for Review</button>}</></div>
  </form>
}
