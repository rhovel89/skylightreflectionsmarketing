import Link from 'next/link'
import { getOwnerData } from '@/lib/owner'

type SearchValue=string|string[]|undefined
const one=(v:SearchValue)=>Array.isArray(v)?v[0]??'':v??''
const titleCase=(v:string)=>v.replaceAll('_',' ').replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase())
const statusTone=(status:string)=>['approved','resolved','complete'].includes(status)?'verified':['pending','in_review'].includes(status)?'sponsored':'neutral'

export default async function Page({searchParams}:{searchParams:Promise<Record<string,SearchValue>>}){
 const sp=await searchParams
 const{claims,s,businesses}=await getOwnerData('/business-portal/requests')
 if(!businesses.length)return <div className="card empty-rich"><h2>Claim a business first</h2><p className="muted">Change-request history becomes available after staff approves a legitimate ownership claim.</p><Link className="btn btn-primary" href="/search">Find My Listing</Link></div>
 const requested=one(sp.business),b=businesses.find((x:any)=>x.id===requested)??businesses[0],uid=String(claims.sub),state=one(sp.state)||'all'
 const{data,error}=await s.from('business_edit_requests').select('id,request_type,proposed_changes,status,staff_notes,created_at,reviewed_at').eq('business_id',b.id).eq('requested_by',uid).order('created_at',{ascending:false}).limit(100)
 const rows=(data??[]) as any[]
 const counts={all:rows.length,pending:rows.filter(x=>x.status==='pending').length,in_review:rows.filter(x=>x.status==='in_review').length,approved:rows.filter(x=>x.status==='approved').length,rejected:rows.filter(x=>x.status==='rejected').length}
 const filtered=state==='all'?rows:rows.filter(x=>x.status===state)
 const switcher=businesses.length>1?<form className="portal-switcher" action="/business-portal/requests" method="get"><label>Managing<select name="business" defaultValue={b.id}>{businesses.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="btn btn-light" type="submit">Switch Business</button></form>:<div className="portal-current"><span>Managing</span><strong>{b.name}</strong></div>
 const href=(next:string)=>`/business-portal/requests?business=${encodeURIComponent(b.id)}${next==='all'?'':`&state=${next}`}`
 return <div>{switcher}
  <div className="portal-section-head"><div><div className="kpi">Moderated Listing Changes</div><h2>Change Requests — {b.name}</h2><p className="muted">Track every protected listing update you submitted, including review status and staff notes.</p></div><Link className="btn btn-primary" href={`/business-portal/listing?business=${b.id}`}>Submit New Update</Link></div>
  {error?<div className="notice warn">Change requests could not be loaded completely: {error.message}</div>:null}
  <nav className="owner-request-tabs" aria-label="Change request status filters"><Link className={state==='all'?'active':''} href={href('all')}>All <span>{counts.all}</span></Link><Link className={state==='pending'?'active':''} href={href('pending')}>Pending <span>{counts.pending}</span></Link><Link className={state==='in_review'?'active':''} href={href('in_review')}>In Review <span>{counts.in_review}</span></Link><Link className={state==='approved'?'active':''} href={href('approved')}>Approved <span>{counts.approved}</span></Link><Link className={state==='rejected'?'active':''} href={href('rejected')}>Rejected <span>{counts.rejected}</span></Link></nav>
  <div className="owner-request-list">{filtered.map(r=><article className="owner-request-card" key={r.id}><div className="owner-request-card-head"><div><span className={`badge ${statusTone(String(r.status||''))}`}>{titleCase(String(r.status||'unknown'))}</span><h3>{titleCase(String(r.request_type||'profile update'))}</h3><small>Submitted {formatDate(r.created_at)}{r.reviewed_at?` · reviewed ${formatDate(r.reviewed_at)}`:''}</small></div><Link className="btn btn-small btn-light" href={`/business/${b.slug}`}>Current Public Profile</Link></div><div className="owner-request-changes">{Object.entries(r.proposed_changes??{}).map(([key,value])=><div key={key}><span>{titleCase(key)}</span><strong>{String(value||'—')}</strong></div>)}</div>{r.staff_notes?<div className="notice warn owner-request-note"><strong>Staff note:</strong> {r.staff_notes}</div>:null}</article>)}</div>
  {!filtered.length?<div className="empty empty-rich"><h3>{state==='all'?'No change requests yet':`No ${titleCase(state)} requests`}</h3><p>{state==='all'?'When you submit a listing update, its protected review history will appear here.':'Choose another status or submit a new listing update.'}</p><div className="card-actions"><Link className="btn btn-primary" href={`/business-portal/listing?business=${b.id}`}>Edit My Listing</Link>{state!=='all'?<Link className="btn btn-light" href={href('all')}>Show All</Link>:null}</div></div>:null}
  <div className="owner-guardrail" style={{marginTop:16}}><div className="kpi">Trust separation</div><h3>An approved edit is not a verification purchase</h3><p>Staff approval only confirms that the requested listing fields can be updated. Claimed ownership, Verified status, paid products and organic directory relevance remain separate controls.</p></div>
 </div>
}
function formatDate(value:any){if(!value)return'—';const d=new Date(String(value));return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
