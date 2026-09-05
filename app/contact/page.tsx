import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/SiteShell'
import { TENANT_ID } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Contact & Business Submissions',description:'Submit a Central Illinois business for directory review or contact Skylight Reflections Marketing about local visibility and digital marketing support.',alternates:{canonical:'/contact'}}

const MARKETING_INTERESTS=['Directory Visibility / Sponsorship','Website Design / Redesign','Local SEO','Google Business Profile','Social Media Management','Branding / Graphic Design','Lead Generation','Full Digital Marketing Review'] as const
const PLAN_INTERESTS=['free','verified','featured','pro','sponsorship','marketing_review'] as const
const SOURCE_CONTEXTS=['for-businesses','pricing-grid','market-page','city-page','business-profile','contact','navigation'] as const
const text=(fd:FormData,key:string)=>String(fd.get(key)||'').trim()
const validPlan=(x:string)=>(PLAN_INTERESTS as readonly string[]).includes(x)?x:null
const validSource=(x:string)=>(SOURCE_CONTEXTS as readonly string[]).includes(x)?x:'contact'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function submitBusiness(fd:FormData){
  'use server'
  if(text(fd,'company_fax'))redirect('/contact?submitted=business')
  const s=await createClient(),business_name=text(fd,'business_name'),category=text(fd,'category'),city=text(fd,'city'),phone=text(fd,'phone'),contact_name=text(fd,'contact_name'),email=text(fd,'email'),website=text(fd,'website'),description=text(fd,'description'),consent=fd.get('consent')==='on'
  if(business_name.length<2||phone.length<7||!category||!city||!consent)throw new Error('Please complete all required business-submission fields.')
  const[{data:validCategory},{data:validCity}]=await Promise.all([s.from('categories').select('id').eq('tenant_id',TENANT_ID).eq('is_active',true).eq('name',category).maybeSingle(),s.from('locations').select('id').eq('tenant_id',TENANT_ID).eq('is_active',true).eq('type','city').eq('name',city).maybeSingle()])
  if(!validCategory||!validCity)throw new Error('Please choose a valid directory category and city.')
  const payload={tenant_id:TENANT_ID,business_name,category,city,phone,website:website||null,description:description||null,status:'pending',contact_name:contact_name||null,email:email||null,service_areas:text(fd,'service_areas').split(',').map(x=>x.trim()).filter(Boolean).slice(0,30),consent_to_contact:true,source:'public_site'}
  const{error}=await s.from('business_submissions').insert(payload)
  if(error)throw new Error(error.message)
  await s.rpc('track_growth_event',{p_tenant_id:TENANT_ID,p_event_type:'listing_submit',p_page_path:'/contact',p_business_id:null,p_city:city,p_category:category,p_plan:'free',p_source:'contact'})
  redirect('/contact?submitted=business#submit-business')
}

async function marketing(fd:FormData){
  'use server'
  if(text(fd,'company_fax'))redirect('/contact?submitted=marketing')
  const s=await createClient(),business_name=text(fd,'business_name'),contact_name=text(fd,'contact_name'),phone=text(fd,'phone'),email=text(fd,'email'),requested=text(fd,'service_interest'),message=text(fd,'message'),consent=fd.get('consent')==='on',plan_interest=validPlan(text(fd,'plan_interest')),rawCity=text(fd,'context_city').slice(0,120),rawCategory=text(fd,'context_category').slice(0,160),rawBusinessId=text(fd,'context_business_id'),landingRaw=text(fd,'landing_path').slice(0,400),sourceContext=validSource(text(fd,'source_context'))
  if(!business_name||!contact_name||!email||!email.includes('@')||!consent)throw new Error('Please complete all required visibility-review fields.')
  const service_interest=(MARKETING_INTERESTS as readonly string[]).includes(requested)?requested:null
  let context_city:string|null=null,context_category:string|null=null,context_business_id:string|null=null
  if(rawCity){const{data}=await s.from('locations').select('name').eq('tenant_id',TENANT_ID).eq('is_active',true).eq('type','city').eq('name',rawCity).maybeSingle();if(data)context_city=rawCity}
  if(rawCategory){const{data}=await s.from('categories').select('name').eq('tenant_id',TENANT_ID).eq('is_active',true).eq('name',rawCategory).maybeSingle();if(data)context_category=rawCategory}
  if(rawBusinessId&&uuid.test(rawBusinessId)){const{data}=await s.from('businesses').select('id').eq('tenant_id',TENANT_ID).eq('status','published').eq('id',rawBusinessId).maybeSingle();if(data)context_business_id=rawBusinessId}
  const landing_path=landingRaw.startsWith('/')?landingRaw:null
  const{error}=await s.from('marketing_leads').insert({tenant_id:TENANT_ID,business_name,contact_name,phone:phone||null,email,service_interest,message:message||null,status:'new',consent_to_contact:true,source:'directory_contact',plan_interest,context_city,context_category,context_business_id,landing_path})
  if(error)throw new Error(error.message)
  await s.rpc('track_growth_event',{p_tenant_id:TENANT_ID,p_event_type:'marketing_lead_submit',p_page_path:landing_path||'/contact',p_business_id:context_business_id,p_city:context_city,p_category:context_category,p_plan:plan_interest||'marketing_review',p_source:sourceContext})
  redirect('/contact?submitted=marketing#marketing-review')
}

const Honeypot=()=> <label aria-hidden="true" style={{position:'absolute',left:'-10000px',width:1,height:1,overflow:'hidden'}}>Company Fax<input name="company_fax" tabIndex={-1} autoComplete="off"/></label>
const labelPlan=(p:string|null)=>p?({verified:'Verified',featured:'Featured',pro:'Pro',sponsorship:'Sponsored visibility',marketing_review:'Marketing review',free:'Free'} as Record<string,string>)[p]||p:''

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const sp=await searchParams,submitted=typeof sp.submitted==='string'?sp.submitted:'',reason=typeof sp.reason==='string'?sp.reason:'',plan=validPlan(typeof sp.plan==='string'?sp.plan:''),cityParam=typeof sp.city==='string'?sp.city.slice(0,120):'',categoryParam=typeof sp.category==='string'?sp.category.slice(0,160):'',businessSlug=typeof sp.business==='string'?sp.business.slice(0,180):'',source=validSource(typeof sp.source==='string'?sp.source:'contact')
  const s=await createClient()
  const[{data:categories},{data:cities}]=await Promise.all([s.from('categories').select('id,name,vertical').eq('tenant_id',TENANT_ID).eq('is_active',true).order('name'),s.from('locations').select('id,name,county').eq('tenant_id',TENANT_ID).eq('is_active',true).eq('type','city').order('name')])
  const validCity=(cities??[]).some((x:any)=>x.name===cityParam)?cityParam:'',validCategory=(categories??[]).some((x:any)=>x.name===categoryParam)?categoryParam:''
  let contextBusiness:any=null
  if(businessSlug){const{data}=await s.from('businesses').select('id,name,slug').eq('tenant_id',TENANT_ID).eq('status','published').eq('slug',businessSlug).maybeSingle();contextBusiness=data}
  const landingPath=`/contact${reason?`?reason=${encodeURIComponent(reason)}`:''}${plan?`${reason?'&':'?'}plan=${encodeURIComponent(plan)}`:''}`,planName=labelPlan(plan)

  return <SiteShell><main>
    <section className="pagehero"><div className="container"><div className="eyebrow">Business & Marketing Support</div><h1>{reason==='list-business'?'Submit a Business for Review':reason==='visibility-plan'&&planName?`${planName} Plan Information`:'Contact & Business Submissions'}</h1><p>{reason==='list-business'?'Use this page only when the business is not already published in the directory. Existing listings should be claimed instead.':'Connect with the directory or request a Skylight Reflections Marketing visibility review.'}</p></div></section>
    <section className="section"><div className="container">
      {submitted==='business'&&<div className="card conversion-success-card" role="status" style={{marginBottom:20}}><div className="kpi">Submission received</div><h2>Your business was sent for staff review.</h2><p className="muted">It was not automatically published. Staff can review the submitted details, supporting information and directory fit before creating or updating a public profile.</p><div className="card-actions"><Link className="btn btn-primary" href="/search?claim=1">Check Existing Listings</Link><Link className="btn btn-light" href="/for-businesses">Business Options</Link></div></div>}
      {submitted==='marketing'&&<div className="card conversion-success-card" role="status" style={{marginBottom:20}}><div className="kpi">Request received</div><h2>Your visibility request was submitted.</h2><p className="muted">Skylight Reflections Marketing can follow up using the contact information and consent you provided. This request does not affect organic directory ranking.</p><div className="card-actions"><Link className="btn btn-primary" href="/for-businesses">Review Business Options</Link><Link className="btn btn-light" href="/">Return to Directory</Link></div></div>}
      {reason==='list-business'&&!submitted&&<div className="claim-search-guide business-submit-guide"><div className="claim-search-guide-head"><div><div className="kpi">Before you create a submission</div><h2>Make sure the business is not already listed.</h2><p className="muted">The directory keeps one business profile connected to legitimate locations and service areas. If a profile already exists, claim it instead of creating a duplicate.</p></div><Link className="btn btn-primary" href="/search?claim=1">Search & Claim First</Link></div><div className="claim-search-steps"><div><span>1</span><strong>Search</strong><small>Look up the exact business name and city.</small></div><div><span>2</span><strong>Claim if found</strong><small>Use the existing profile and submit a free ownership claim.</small></div><div><span>3</span><strong>Submit if missing</strong><small>Only use the new-business form when no legitimate profile exists.</small></div></div></div>}
      {reason==='visibility-plan'&&!submitted&&<div className="card visibility-context-card" style={{marginBottom:20}}><div className="kpi">Directory visibility{planName?` · ${planName}`:''}</div><h2>{planName?`Request information about the ${planName} option.`:'Ask about a clearly labeled visibility plan.'}</h2><p className="muted">Paid business tools and sponsorship remain separate from organic directory relevance. Paying does not buy verification, organic rank, leads or editorial preference.</p>{(validCity||validCategory||contextBusiness)&&<p className="small"><strong>Request context:</strong> {[contextBusiness?.name,validCategory,validCity].filter(Boolean).join(' · ')}</p>}</div>}

      {!submitted&&<div className="contact-path-strip"><div><span>Need owner access?</span><strong>Claim an existing listing</strong><Link href="/search?claim=1">Start free claim →</Link></div><div><span>Business missing?</span><strong>Submit one record for review</strong><a href="#submit-business">Go to submission →</a></div><div><span>Want growth help?</span><strong>Request plan or marketing information</strong><a href="#marketing-review">Go to growth form →</a></div></div>}

      <div className="grid grid-2 conversion-form-grid">
        <form id="submit-business" action={submitBusiness} className="form-card public-conversion-form contact-conversion-card">
          <Honeypot/>
          <div className="form-intro-row"><span className="form-step">1</span><div><strong>New business submission</strong><small>For businesses that are not already published in the directory.</small></div></div>
          <h2>Submit a Business</h2><p className="muted small">Choose an existing directory category and city so staff can review the listing faster. Submissions remain pending until reviewed and are never auto-published.</p>
          <label>Business Name<input name="business_name" required minLength={2} maxLength={180} autoComplete="organization"/></label>
          <div className="form-grid"><label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose a category</option>{(categories??[]).map((c:any)=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label>City<select name="city" required defaultValue=""><option value="" disabled>Choose a city</option>{(cities??[]).map((l:any)=><option key={l.id} value={l.name}>{l.name}{l.county?` — ${l.county}`:''}</option>)}</select></label><label>Business Phone<input name="phone" type="tel" inputMode="tel" required minLength={7} maxLength={40} autoComplete="tel"/></label><label>Website <span className="optional-label">optional</span><input name="website" type="url" maxLength={300} placeholder="https://"/></label><label>Contact Name <span className="optional-label">optional</span><input name="contact_name" maxLength={120} autoComplete="name"/></label><label>Email <span className="optional-label">optional</span><input type="email" name="email" maxLength={160} autoComplete="email"/></label></div>
          <label>Service Areas <span className="optional-label">optional</span><input name="service_areas" maxLength={800} placeholder="Pontiac, Dwight, Livingston County"/></label>
          <label>Description <span className="optional-label">optional</span><textarea name="description" maxLength={1600} placeholder="Briefly describe what the business provides. Staff will review the submission before publication."/></label>
          <label className="check consent-check"><input type="checkbox" name="consent" required/> I agree to be contacted about this business submission.</label>
          <button className="btn btn-primary full">Submit New Business for Review</button>
          <p className="small muted conversion-form-note">Submission does not equal publication, claim approval or verification. Staff review is required.</p>
        </form>

        <form id="marketing-review" action={marketing} className="form-card public-conversion-form contact-conversion-card">
          <Honeypot/><input type="hidden" name="plan_interest" value={plan||'marketing_review'}/><input type="hidden" name="context_city" value={validCity}/><input type="hidden" name="context_category" value={validCategory}/><input type="hidden" name="context_business_id" value={contextBusiness?.id||''}/><input type="hidden" name="landing_path" value={landingPath}/><input type="hidden" name="source_context" value={source}/>
          <div className="form-intro-row"><span className="form-step">2</span><div><strong>Optional growth help</strong><small>This goes to Skylight Reflections Marketing and is separate from directory ranking.</small></div></div>
          <h2>{reason==='visibility-plan'&&planName?`${planName} Plan Request`:'Free Marketing Visibility Review'}</h2><p className="muted small">Tell us what you want to improve. Requesting or buying marketing services does not change organic directory ranking.</p>
          <label>Business Name<input name="business_name" required maxLength={180} autoComplete="organization" defaultValue={contextBusiness?.name||''}/></label>
          <label>Your Name<input name="contact_name" required maxLength={120} autoComplete="name"/></label>
          <div className="form-grid"><label>Phone <span className="optional-label">optional</span><input name="phone" type="tel" inputMode="tel" maxLength={40} autoComplete="tel"/></label><label>Email<input type="email" name="email" required maxLength={160} autoComplete="email"/></label></div>
          <label>What would you like help with?<select name="service_interest" defaultValue={reason==='visibility-plan'?'Directory Visibility / Sponsorship':'Full Digital Marketing Review'}>{MARKETING_INTERESTS.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>What are you trying to improve?<textarea name="message" maxLength={1600} placeholder={validCity||validCategory?`Tell us what you want to accomplish${validCity?` in ${validCity}`:''}${validCategory?` for ${validCategory}`:''}.`:'Tell us what you want to improve, where you serve customers and what result you are trying to achieve.'}/></label>
          <label className="check consent-check"><input type="checkbox" name="consent" required/> I agree to be contacted about this request.</label>
          <button className="btn btn-primary full">{reason==='visibility-plan'?'Request Plan Information':'Request My Free Review'}</button>
          <p className="small muted conversion-form-note">Directory plans, Sponsored placement, lead billing and Skylight marketing services remain separate products.</p>
        </form>
      </div>
    </div></section>
  </main></SiteShell>
}
