import Link from 'next/link'
import { getOwnerData } from '@/lib/owner'
import { submitOwnerEdit } from '@/app/actions'

type SearchValue=string|string[]|undefined
const one=(v:SearchValue)=>Array.isArray(v)?v[0]??'':v??''

export default async function Page({searchParams}:{searchParams:Promise<Record<string,SearchValue>>}){
 const sp=await searchParams
 const{claims,s,businesses}=await getOwnerData('/business-portal/listing')
 if(!businesses.length)return <div className="card empty-rich"><h2>Claim a business first</h2><p className="muted">Listing management becomes available after staff approves a legitimate ownership claim.</p><Link className="btn btn-primary" href="/search">Find My Listing</Link></div>
 const requested=one(sp.business),b=businesses.find((x:any)=>x.id===requested)??businesses[0],uid=String(claims.sub)
 const[{data:pending},{data:categories},{data:locations},{data:media}]=await Promise.all([
  s.from('business_edit_requests').select('id,status,created_at,proposed_changes,staff_notes').eq('business_id',b.id).eq('requested_by',uid).in('status',['pending','in_review']).order('created_at',{ascending:false}).limit(20),
  s.from('business_categories').select('category_id,categories(name)').eq('business_id',b.id),
  s.from('business_locations').select('id,is_active,is_primary').eq('business_id',b.id).eq('is_active',true),
  s.from('business_media').select('id,status,approval_status').eq('business_id',b.id),
 ])
 const approvedMedia=(media??[]).filter((x:any)=>x.approval_status==='approved'||['published','active'].includes(String(x.status||''))).length
 const complete=[b.description,b.phone,b.hours].filter(Boolean).length+(b.website?1:0)
 const switcher=businesses.length>1?<form className="portal-switcher" action="/business-portal/listing" method="get"><label>Managing<select name="business" defaultValue={b.id}>{businesses.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="btn btn-light" type="submit">Switch Business</button></form>:<div className="portal-current"><span>Managing</span><strong>{b.name}</strong></div>
 return <div>{switcher}
  <div className="portal-section-head"><div><div className="kpi">Protected Listing Editor</div><h2>My Listing — {b.name}</h2><p className="muted">Submit customer-facing updates for staff review. The current public record stays intact until an approved change is applied.</p></div><div className="card-actions"><Link className="btn btn-primary" href={`/business-portal/profile-strength?business=${b.id}`}>Profile Strength</Link><Link className="btn btn-light" href={`/business/${b.slug}`}>View Public Profile</Link></div></div>
  <div className="owner-listing-summary"><div><span>Profile Score</span><strong>{Number(b.profile_score||0)}%</strong></div><div><span>Pending Changes</span><strong>{(pending??[]).length}</strong></div><div><span>Categories</span><strong>{(categories??[]).length}</strong></div><div><span>Physical Locations</span><strong>{(locations??[]).length}</strong></div><div><span>Approved Media</span><strong>{approvedMedia}</strong></div></div>
  {(pending??[]).length?<div className="notice warn"><strong>{(pending??[]).length} change request{(pending??[]).length===1?' is':'s are'} already under review.</strong> You can submit another correction if needed, but staff will review requests independently and protected public data will not be overwritten automatically.</div>:<div className="notice success"><strong>No listing changes are waiting for review.</strong> The fields below reflect the current connected business record.</div>}
  <div className="owner-listing-layout">
   <form action={submitOwnerEdit} className="form-card owner-listing-form"><input type="hidden" name="business_id" value={b.id}/><div><div className="kpi">Request an Update</div><h3>Customer-facing business information</h3><p className="small muted">Only submit information that is current and genuinely belongs to this business. Staff review protects the directory from accidental or unauthorized public changes.</p></div><label>Description<textarea name="description" defaultValue={b.description||''} rows={8}/><small>Explain what the business does, who it serves and useful customer-facing details.</small></label><div className="form-grid"><label>Phone<input name="phone" defaultValue={b.phone||''}/><small>Use the current customer-facing business number.</small></label><label>Website<input name="website" defaultValue={b.website||''}/><small>Use the business's current official website when available.</small></label></div><label>Business Hours / Availability<input name="hours" defaultValue={b.hours||''}/><small>Use normal operating hours or a clear availability description.</small></label><div className="owner-listing-submit"><button className="btn btn-primary" type="submit">Submit Changes for Review</button><span>{complete}/4 core listing fields currently filled</span></div></form>
   <div className="owner-listing-side">
    <section className="owner-dashboard-panel"><div className="kpi">Current Public Record</div><h3>What customers can rely on now</h3><div className="owner-snapshot-list"><div><span>Business Name</span><strong>{b.name}</strong></div><div><span>Phone</span><strong>{b.phone||'Not listed'}</strong></div><div><span>Website</span><strong>{b.website||'Not listed'}</strong></div><div><span>Hours</span><strong>{b.hours||'Not listed'}</strong></div><div><span>Claim Status</span><strong>{b.claimed?'Claimed':'Not claimed'}</strong></div><div><span>Verification</span><strong>{b.verified?'Verified':'Not Verified'}</strong></div></div></section>
    <section className="owner-dashboard-panel"><div className="kpi">Review Workflow</div><h3>What happens after Submit</h3><ol className="owner-review-steps"><li><b>1</b><span><strong>Request is recorded</strong><small>Your proposed values are saved as a pending owner request.</small></span></li><li><b>2</b><span><strong>Staff reviews the change</strong><small>Staff can approve, reject or add clarification notes.</small></span></li><li><b>3</b><span><strong>Approved facts update safely</strong><small>Verification, paid products and organic relevance stay separate from the edit decision.</small></span></li></ol><Link className="btn btn-light full" href={`/business-portal/requests?business=${b.id}`}>Track Change Requests</Link></section>
   </div>
  </div>
 </div>
}
