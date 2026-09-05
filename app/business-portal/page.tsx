import Link from 'next/link'
import { getOwnerData } from '@/lib/owner'

type Row=Record<string,any>
const rel=(value:any)=>Array.isArray(value)?value[0]:value
const openInvoiceStatuses=new Set(['draft','sent','overdue','open'])
const activePlanStatuses=new Set(['active','trialing','past_due'])
const money=(cents:any)=>`$${(Number(cents||0)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`

export default async function Page(){
 const{businesses,s,claims}=await getOwnerData('/business-portal')
 if(!businesses.length)return <div className="card empty-rich"><h2>No business is connected to this account yet.</h2><p className="muted">Find your public listing and submit a claim. Staff reviews ownership before connecting the business to this private portal. Claimed ownership does not automatically create a Verified badge.</p><div className="card-actions"><Link className="btn btn-primary" href="/search">Find My Business</Link><Link className="btn btn-light" href="/for-businesses">Business Options</Link></div></div>

 const ids=businesses.map((b:any)=>String(b.id))
 const uid=String(claims.sub)
 const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10)
 const[requestsResult,leadsResult,invoicesResult,subsResult,mediaResult,statsResult]=await Promise.all([
  s.from('business_edit_requests').select('id,business_id,status,created_at').in('business_id',ids).eq('requested_by',uid).in('status',['pending','in_review']).order('created_at',{ascending:false}).limit(200),
  s.from('lead_recipients').select('id,business_id,status,routed_at,viewed_at,contacted_at').in('business_id',ids).order('routed_at',{ascending:false}).limit(500),
  s.from('lead_invoices').select('id,business_id,invoice_number,amount_due_cents,status,due_at,created_at,hosted_invoice_url').in('business_id',ids).order('created_at',{ascending:false}).limit(200),
  s.from('subscriptions').select('id,business_id,status,updated_at,plans(name,slug)').in('business_id',ids).order('updated_at',{ascending:false}).limit(100),
  s.from('business_media').select('id,business_id,media_type,status,approval_status').in('business_id',ids).limit(1000),
  s.from('listing_daily_stats').select('business_id,stat_date,profile_views,phone_clicks,website_clicks,directions_clicks,lead_submissions').in('business_id',ids).gte('stat_date',since).limit(5000),
 ])
 const sourceErrors=[['Change requests',requestsResult.error],['Lead inbox',leadsResult.error],['Billing',invoicesResult.error],['Subscriptions',subsResult.error],['Media',mediaResult.error],['Analytics',statsResult.error]].flatMap(([source,error])=>error?[`${source}: ${String((error as any).message||'unavailable')}`]:[])
 const requests=(requestsResult.data??[]) as Row[],leads=(leadsResult.data??[]) as Row[],invoices=(invoicesResult.data??[]) as Row[],subs=(subsResult.data??[]) as Row[],media=(mediaResult.data??[]) as Row[],stats=(statsResult.data??[]) as Row[]
 const pending=requests.length
 const freshLeads=leads.filter(x=>x.status==='new'||!x.viewed_at)
 const openInvoices=invoices.filter(x=>openInvoiceStatuses.has(String(x.status||'').toLowerCase()))
 const openBalance=openInvoices.reduce((sum,x)=>sum+Number(x.amount_due_cents||0),0)
 const profileNeeds=businesses.filter((b:any)=>Number(b.profile_score||0)<80)
 const views30=stats.reduce((sum,x)=>sum+Number(x.profile_views||0),0)
 const conversions30=stats.reduce((sum,x)=>sum+Number(x.phone_clicks||0)+Number(x.website_clicks||0)+Number(x.directions_clicks||0)+Number(x.lead_submissions||0),0)
 const activePlans=subs.filter(x=>activePlanStatuses.has(String(x.status||'').toLowerCase()))
 const actionTotal=pending+freshLeads.length+openInvoices.length+profileNeeds.length

 const byBusiness=(rows:Row[],id:string)=>rows.filter(x=>String(x.business_id)===id)
 const approvedMedia=(id:string)=>byBusiness(media,id).filter(x=>x.approval_status==='approved'||['published','active'].includes(String(x.status||'')))
 const activePlan=(id:string)=>byBusiness(subs,id).find(x=>activePlanStatuses.has(String(x.status||'').toLowerCase()))
 const nextAction=(b:any)=>{
  const id=String(b.id),businessInvoices=byBusiness(openInvoices,id),businessLeads=byBusiness(freshLeads,id),businessRequests=byBusiness(requests,id),score=Number(b.profile_score||0),visuals=approvedMedia(id)
  if(businessInvoices.length)return{label:'Review Billing',detail:`${businessInvoices.length} open invoice${businessInvoices.length===1?'':'s'} need attention.`,href:`/business-portal/billing?business=${id}`}
  if(businessLeads.length)return{label:'Review New Leads',detail:`${businessLeads.length} lead${businessLeads.length===1?'':'s'} ${businessLeads.length===1?'is':'are'} waiting for review.`,href:`/business-portal/leads?business=${id}`}
  if(businessRequests.length)return{label:'Track Pending Changes',detail:`${businessRequests.length} listing change request${businessRequests.length===1?' is':'s are'} still under review.`,href:`/business-portal/requests?business=${id}`}
  if(score<80)return{label:'Improve Profile',detail:`Profile Strength is ${score}%. Complete customer-facing information next.`,href:`/business-portal/profile-strength?business=${id}`}
  if(!visuals.length)return{label:'Add Photos & Media',detail:'Add approved visual content to strengthen the customer-facing profile.',href:`/business-portal/media?business=${id}`}
  return{label:'Review Performance',detail:'Your core profile is in good shape. Review recent customer activity next.',href:`/business-portal/analytics?business=${id}`}
 }

 const attentionItems=businesses.flatMap((b:any)=>{
  const id=String(b.id),items:{title:string;detail:string;href:string;tone:string}[]=[]
  const inv=byBusiness(openInvoices,id),newLeads=byBusiness(freshLeads,id),req=byBusiness(requests,id),score=Number(b.profile_score||0)
  if(inv.length)items.push({title:`${b.name}: billing attention`,detail:`${inv.length} open invoice${inv.length===1?'':'s'} · ${money(inv.reduce((n,x)=>n+Number(x.amount_due_cents||0),0))}`,href:`/business-portal/billing?business=${id}`,tone:'urgent'})
  if(newLeads.length)items.push({title:`${b.name}: new customer opportunities`,detail:`${newLeads.length} lead${newLeads.length===1?'':'s'} not yet fully reviewed.`,href:`/business-portal/leads?business=${id}`,tone:'warn'})
  if(req.length)items.push({title:`${b.name}: changes under review`,detail:`${req.length} protected listing update${req.length===1?' is':'s are'} pending.`,href:`/business-portal/requests?business=${id}`,tone:''})
  if(score<80)items.push({title:`${b.name}: profile can be stronger`,detail:`Profile Strength is ${score}%.`,href:`/business-portal/profile-strength?business=${id}`,tone:''})
  return items
 }).slice(0,12)

 return <div>
  <div className="owner-portal-dashboard-head"><div><div className="kpi">Owner Command Center</div><h2>Business Dashboard</h2><p className="muted">See what needs attention first, then move directly into listing, lead, billing and performance work without searching through the portal.</p></div><div className="owner-dashboard-actions"><Link className="btn btn-primary" href="/business-portal/profile-strength">Improve Profile</Link><Link className="btn btn-light" href="/business-portal/growth">Growth Center</Link></div></div>
  {sourceErrors.length?<div className="notice warn"><strong>Some dashboard signals are temporarily incomplete.</strong> The portal is still usable; unavailable sources: {sourceErrors.map(x=>x.split(':')[0]).join(', ')}.</div>:null}
  <div className="stat-grid owner-dashboard-stats">
   <div className="stat"><span>Needs Attention</span><strong>{actionTotal}</strong><small>profile + requests + leads + billing</small></div>
   <div className="stat"><span>New Leads</span><strong>{freshLeads.length}</strong><small>new or not yet viewed</small></div>
   <div className="stat"><span>Pending Changes</span><strong>{pending}</strong><small>protected updates under review</small></div>
   <div className="stat"><span>Open Balance</span><strong>{money(openBalance)}</strong><small>{openInvoices.length} open invoice{openInvoices.length===1?'':'s'}</small></div>
   <div className="stat"><span>30-Day Activity</span><strong>{views30}</strong><small>{conversions30} calls, clicks, directions or leads</small></div>
  </div>

  <div className="owner-dashboard-grid">
   <div className="owner-dashboard-stack">
    <section className="owner-dashboard-panel"><div className="owner-dashboard-panel-head"><div><div className="kpi">My Businesses</div><h3>Manage each listing from one place</h3><p>Profile completeness is customer-facing only. Claimed, Verified and paid-product states remain separate.</p></div><span className="badge neutral">{businesses.length} connected</span></div><div className="owner-business-grid">{businesses.map((b:any)=>{
     const id=String(b.id),score=Math.max(0,Math.min(100,Number(b.profile_score||0))),businessStats=byBusiness(stats,id),businessViews=businessStats.reduce((n,x)=>n+Number(x.profile_views||0),0),businessLeads=byBusiness(freshLeads,id).length,businessRequests=byBusiness(requests,id).length,businessInvoices=byBusiness(openInvoices,id).length,plan=activePlan(id),planName=rel(plan?.plans)?.name||'Free / Organic',next=nextAction(b)
     return <article className="owner-business-card" key={id}><div className="owner-business-card-head"><div><div className="badges">{b.claimed?<span className="badge neutral">Claimed</span>:null}{b.verified?<span className="badge verified">Verified</span>:null}{b.featured?<span className="badge sponsored">Sponsored</span>:null}</div><h3>{b.name}</h3><span className="small muted">{planName}</span></div><Link className="btn btn-small btn-light" href={`/business/${b.slug}`}>View Public</Link></div><div className="progress-track"><span style={{width:`${score}%`}}/></div><div className="small muted">Profile Strength <strong>{score}%</strong></div><div className="owner-business-metrics"><div><span>30d Views</span><strong>{businessViews}</strong></div><div><span>New Leads</span><strong>{businessLeads}</strong></div><div><span>Pending Edits</span><strong>{businessRequests}</strong></div><div><span>Open Invoices</span><strong>{businessInvoices}</strong></div></div><div className="owner-next-action"><div><span>Recommended next action</span><strong>{next.detail}</strong></div><Link className="btn btn-small btn-primary" href={next.href}>{next.label}</Link></div><div className="card-actions"><Link className="btn btn-light" href={`/business-portal/listing?business=${id}`}>Listing</Link><Link className="btn btn-light" href={`/business-portal/media?business=${id}`}>Media</Link><Link className="btn btn-light" href={`/business-portal/analytics?business=${id}`}>Analytics</Link><Link className="btn btn-light" href={`/business-portal/subscription?business=${id}`}>Plan</Link></div></article>
    })}</div></section>
   </div>

   <div className="owner-dashboard-stack">
    <section className="owner-dashboard-panel"><div className="owner-dashboard-panel-head"><div><div className="kpi">Attention Center</div><h3>What needs action</h3><p>Highest-value owner tasks are surfaced here first.</p></div></div>{attentionItems.length?<div className="owner-attention-list">{attentionItems.map((item,index)=><Link className={`owner-attention-item ${item.tone}`} href={item.href} key={`${item.href}-${index}`}><span><strong>{item.title}</strong><small>{item.detail}</small></span><b>›</b></Link>)}</div>:<div className="empty"><strong>Nothing urgent right now.</strong><p className="small muted">Your connected business workflows do not currently show an open billing, lead, change-request or low-profile alert.</p></div>}</section>

    <section className="owner-dashboard-panel"><div className="owner-dashboard-panel-head"><div><div className="kpi">Quick Tools</div><h3>Common owner workflows</h3></div></div><div className="owner-dashboard-links"><Link href="/business-portal/profile-strength"><span><strong>Profile Strength</strong><small>See exactly what customer-facing information to improve.</small></span><b>›</b></Link><Link href="/business-portal/media"><span><strong>Photos & Media</strong><small>Manage logos, cover photos, gallery images and eligible menus.</small></span><b>›</b></Link><Link href="/business-portal/leads"><span><strong>Lead Inbox</strong><small>Review delivered customer opportunities when your plan includes access.</small></span><b>›</b></Link><Link href="/business-portal/billing"><span><strong>Billing & Credits</strong><small>Review lead charges, invoices and available account credits.</small></span><b>›</b></Link><Link href="/business-portal/notifications"><span><strong>Notifications</strong><small>See account and workflow updates.</small></span><b>›</b></Link></div></section>

    <section className="owner-guardrail"><div className="kpi">Clear separation</div><h3>Organic visibility is not for sale</h3><p>Featured, Pro, Sponsored placement, Lead Inbox access and other paid products can add visibility or conversion tools, but they do not purchase a Verified badge or alter the directory's organic relevance rules.</p></section>
   </div>
  </div>
  {activePlans.length?<p className="small muted" style={{marginTop:16}}>Active/trialing paid plan records across connected businesses: {activePlans.length}. Paid plan state is displayed for account management only and does not determine organic rank.</p>:null}
 </div>
}
