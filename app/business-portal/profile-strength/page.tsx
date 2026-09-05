import Link from 'next/link'
import { getOwnerData } from '@/lib/owner'

const rel=(v:any)=>Array.isArray(v)?v[0]:v
const activeSub=(x:any)=>['active','trialing','past_due'].includes(String(x?.status||''))&&(!x?.ends_at||new Date(x.ends_at).getTime()>Date.now())

type SearchValue=string|string[]|undefined
const one=(v:SearchValue)=>Array.isArray(v)?v[0]??'':v??''

export default async function Page({searchParams}:{searchParams:Promise<Record<string,SearchValue>>}){
 const sp=await searchParams
 const{businesses,s}=await getOwnerData('/business-portal/profile-strength')
 if(!businesses.length)return <div className="card empty-rich"><h2>Claim a business first</h2><p className="muted">Profile Strength becomes available after staff approves a legitimate ownership claim.</p><Link className="btn btn-primary" href="/search">Find My Listing</Link></div>
 const requested=one(sp.business),b=businesses.find((x:any)=>x.id===requested)??businesses[0]
 const switcher=businesses.length>1?<form className="portal-switcher" action="/business-portal/profile-strength" method="get"><label>Managing<select name="business" defaultValue={b.id}>{businesses.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="btn btn-light" type="submit">Switch Business</button></form>:<div className="portal-current"><span>Managing</span><strong>{b.name}</strong></div>
 const[{data:media},{data:branches},{data:cats},{data:areas},{data:subs}]=await Promise.all([
  s.from('business_media').select('media_type,status,approval_status').eq('business_id',b.id),
  s.from('business_locations').select('id,is_active,is_primary,address_text,city,state').eq('business_id',b.id).eq('is_active',true),
  s.from('business_categories').select('category_id,categories(name,vertical)').eq('business_id',b.id),
  s.from('business_service_areas').select('location_id,locations(name,slug)').eq('business_id',b.id),
  s.from('subscriptions').select('status,ends_at,updated_at,plans(slug)').eq('business_id',b.id).in('status',['active','trialing','past_due']).order('updated_at',{ascending:false}).limit(10),
 ])
 const approvedMedia=(media??[]).filter((x:any)=>x.approval_status==='approved'||x.status==='published'||x.status==='active')
 const hasLogo=approvedMedia.some((x:any)=>x.media_type==='logo'),hasVisual=approvedMedia.some((x:any)=>['cover','gallery'].includes(x.media_type)),galleryCount=approvedMedia.filter((x:any)=>x.media_type==='gallery').length,desc=String(b.description||'').trim()
 const checks=[
  {label:'Business description',points:15,done:Boolean(desc),action:'Add a clear customer-facing description.',href:`/business-portal/listing?business=${b.id}`},
  {label:'Helpful description depth',points:5,done:desc.length>=120,action:'Expand the description to explain services, customers served and what makes the business useful.',href:`/business-portal/listing?business=${b.id}`},
  {label:'Phone number',points:15,done:Boolean(b.phone),action:'Add a current customer phone number.',href:`/business-portal/listing?business=${b.id}`},
  {label:'Website',points:10,done:Boolean(b.website),action:'Add the current business website if one is available.',href:`/business-portal/listing?business=${b.id}`},
  {label:'Business hours',points:10,done:Boolean(b.hours),action:'Add normal business hours or availability information.',href:`/business-portal/listing?business=${b.id}`},
  {label:'Directory category',points:10,done:Boolean(cats?.length),action:'Request the correct business category so customers can understand what you provide.',href:'/contact'},
  {label:'Local presence',points:15,done:Boolean(branches?.length||areas?.length),action:'Confirm a real physical location or accurately labeled service areas.',href:`/business-portal/areas?business=${b.id}`},
  {label:'Business logo',points:5,done:hasLogo,action:'Upload an approved logo so customers recognize the business.',href:`/business-portal/media?business=${b.id}`},
  {label:'Profile visuals',points:5,done:hasVisual,action:'Add a cover or approved gallery image.',href:`/business-portal/media?business=${b.id}`},
  {label:'Claimed ownership',points:5,done:Boolean(b.claimed),action:'Complete the legitimate ownership claim workflow.',href:'/claim'},
 ]
 const score=checks.reduce((n,x)=>n+(x.done?x.points:0),0),status=score>=90?'Excellent':score>=75?'Strong':score>=50?'Building':'Needs attention',missing=checks.filter(x=>!x.done),complete=checks.filter(x=>x.done),next=missing[0]
 const pro=Boolean((subs??[]).find((x:any)=>activeSub(x)&&rel(x.plans)?.slug==='pro'))
 const rawPro=b.attributes&&typeof b.attributes==='object'?(b.attributes as any).pro_profile||{}:{},today=new Date().toISOString().slice(0,10)
 const conversion=[
  {label:'3+ services',done:Array.isArray(rawPro.services)&&rawPro.services.filter((x:any)=>x?.name).length>=3},
  {label:'3+ FAQs',done:Array.isArray(rawPro.faqs)&&rawPro.faqs.filter((x:any)=>x?.question&&x?.answer).length>=3},
  {label:'Primary CTA',done:Boolean(rawPro.cta?.primary_label&&rawPro.cta?.primary_url)},
  {label:'Current offer',done:Boolean(rawPro.offer?.title&&(!rawPro.offer?.expires_on||String(rawPro.offer.expires_on)>=today))},
  {label:'Package / product',done:Array.isArray(rawPro.packages)&&rawPro.packages.some((x:any)=>x?.name)},
  {label:'Social profile',done:Boolean(rawPro.social_links&&Object.values(rawPro.social_links).some(Boolean))},
  {label:'Current announcement',done:Array.isArray(rawPro.announcements)&&rawPro.announcements.some((x:any)=>x?.title&&x?.body)},
  {label:'3+ showcase images',done:galleryCount>=3},
 ]
 const conversionScore=Math.round(conversion.filter(x=>x.done).length/conversion.length*100)
 return <div>{switcher}
  <div className="portal-section-head"><div><div className="kpi">Customer-Safe Profile Health</div><h2>Profile Strength — {b.name}</h2><p className="muted">A practical completeness score based only on customer-facing listing information. It does not expose internal SEO diagnostics and does not change organic ranking.</p></div><div className="card-actions"><Link className="btn btn-light" href={`/business/${b.slug}`}>View Public Profile</Link><Link className="btn btn-light" href={`/business-portal/analytics?business=${b.id}`}>View Analytics</Link></div></div>

  <div className="owner-strength-hero"><section className="owner-strength-score"><div><div className="kpi">Profile Strength</div><strong>{score}%</strong><span>{status}</span></div><div className="owner-strength-progress"><div><span style={{width:`${score}%`}}/></div><p>{complete.length} of {checks.length} customer-facing signals are complete. Verified status and paid products are not required for a 100% base score.</p></div></section><section className="owner-strength-context"><div><span>Physical locations</span><strong>{(branches??[]).length}</strong><small>real offices / storefronts</small></div><div><span>Service areas</span><strong>{(areas??[]).length}</strong><small>served markets, not offices</small></div><div><span>Trust</span><strong>{b.verified?'Verified':b.claimed?'Claimed':'Unclaimed'}</strong><small>separate protected workflow</small></div><div><span>Approved media</span><strong>{approvedMedia.length}</strong><small>logo / cover / gallery</small></div></section></div>

  {next?<section className="owner-strength-next"><div><div className="kpi">Best Next Action</div><h3>{next.label}</h3><p>{next.action}</p><small>Worth {next.points} profile-strength point{next.points===1?'':'s'} when complete.</small></div><Link className="btn btn-primary" href={next.href}>Improve This Now</Link></section>:<div className="notice success"><strong>Your base Profile Strength is complete.</strong> Keep your public information current and use Analytics to monitor customer interaction.</div>}

  <div className="owner-strength-grid">
   <section className="owner-dashboard-panel"><div className="owner-dashboard-panel-head"><div><div className="kpi">Strength Checklist</div><h3>What customers need to see</h3><p>Each item has a fixed point value; the scoring rules below are unchanged by plan level.</p></div><span className={`badge ${score>=75?'verified':'neutral'}`}>{status}</span></div><div className="owner-strength-checks">{checks.map(x=><div className={x.done?'done':'missing'} key={x.label}><b aria-hidden="true">{x.done?'✓':'!'}</b><span><strong>{x.label}</strong><small>{x.done?'Complete':x.action}</small></span><em>{x.points} pts</em>{!x.done?<Link href={x.href}>Improve →</Link>:null}</div>)}</div></section>
   <div className="owner-dashboard-stack"><section className="owner-dashboard-panel"><div className="kpi">Trust & Coverage Rules</div><h3>Accuracy matters more than padding</h3><div className="owner-strength-rules"><div><b>Physical location</b><span>Only a real office, shop or branch counts as a physical location.</span></div><div><b>Service area</b><span>A market you serve stays labeled as a service area and is never presented as an office.</span></div><div><b>Verification</b><span>Verification is reviewed separately and cannot be purchased automatically.</span></div><div><b>Organic rank</b><span>Profile Strength and paid products do not override organic relevance rules.</span></div></div></section>{missing.length>1?<section className="owner-dashboard-panel"><div className="kpi">After Your Next Fix</div><h3>{missing.length-1} more improvement{missing.length-1===1?'':'s'} remain</h3><div className="owner-strength-mini-list">{missing.slice(1,5).map(x=><Link href={x.href} key={x.label}><span>{x.label}</span><b>+{x.points}</b></Link>)}</div></section>:null}</div>
  </div>

  {pro?<section className="owner-pro-readiness"><div className="owner-dashboard-panel-head"><div><div className="kpi">Pro Conversion Readiness</div><h3>{conversionScore}% ready</h3><p>Optional Pro conversion tools are measured separately from base Profile Strength and organic ranking.</p></div><strong>{conversionScore}%</strong></div><div className="progress-track"><span style={{width:`${conversionScore}%`}}/></div><div className="owner-pro-checks">{conversion.map(x=><div className={x.done?'ready':'todo'} key={x.label}><b>{x.done?'✓':'+'}</b><span>{x.label}</span></div>)}</div><div className="card-actions"><Link className="btn btn-primary" href={`/business-portal/pro-profile?business=${b.id}`}>Improve Pro Conversion Tools</Link><Link className="btn btn-light" href={`/business-portal/performance?business=${b.id}`}>View Pro Performance</Link></div></section>:<div className="notice" style={{marginTop:18}}><strong>Optional Pro tools are excluded from your base score.</strong> Upgrading can add conversion features, but buying a plan is never required to improve the customer-safe Profile Strength score above.</div>}
 </div>
}
