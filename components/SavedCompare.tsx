'use client'
import{useMemo,useState}from'react'
import Link from'next/link'

type Business=Record<string,any>
const availabilityLabel:Record<string,string>={available_today:'Available Today',taking_new_customers:'Taking New Customers',emergency_24_7:'24/7 Emergency',limited:'Limited Availability',unavailable:'Unavailable'}
export function SavedCompare({businesses}:{businesses:Business[]}){
 const[selected,setSelected]=useState<string[]>([])
 const rows=useMemo(()=>businesses.filter(b=>selected.includes(String(b.id))),[businesses,selected])
 function toggle(id:string){setSelected(current=>current.includes(id)?current.filter(x=>x!==id):current.length<3?[...current,id]:current)}
 return <section className="admin-card" style={{marginBottom:18}}>
  <div className="section-head compact-head"><div><div className="kpi">Compare Local Pros</div><h2>Compare up to 3 saved businesses</h2><p className="muted">Compare factual profile and community signals side by side. Sponsored placement is intentionally excluded because payment does not make a business a better organic match.</p></div><span className="badge neutral">{selected.length}/3 selected</span></div>
  <div className="grid grid-3">{businesses.map(b=><label className="card" key={b.id} style={{cursor:'pointer'}}><div className="check"><input type="checkbox" checked={selected.includes(String(b.id))} onChange={()=>toggle(String(b.id))} disabled={!selected.includes(String(b.id))&&selected.length>=3}/> Compare</div><strong>{b.name}</strong><p className="small muted">{b.primary_city||b.address_text||'Central Illinois'}</p><div className="badges">{b.verified&&<span className="badge verified">Verified</span>}{b.claimed&&<span className="badge neutral">Claimed</span>}{b.availability_status&&<span className="badge neutral">{availabilityLabel[b.availability_status]||String(b.availability_status).replaceAll('_',' ')}</span>}</div></label>)}</div>
  {rows.length>=2&&<div style={{marginTop:18,overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Compare</th>{rows.map(b=><th key={b.id}>{b.name}</th>)}</tr></thead><tbody>
   <tr><td>Category</td>{rows.map(b=><td key={b.id}>{Array.isArray(b.categories)&&b.categories.length?b.categories.join(', '):'Not listed'}</td>)}</tr>
   <tr><td>Primary market</td>{rows.map(b=><td key={b.id}>{b.primary_city||'Not listed'}</td>)}</tr>
   <tr><td>Sourced rating</td>{rows.map(b=><td key={b.id}>{Number(b.rating||0)>0&&Number(b.review_count||0)>0?`${Number(b.rating).toFixed(1)} · ${Number(b.review_count)} reviews`:'No sourced rating shown'}</td>)}</tr>
   <tr><td>Local Faves</td>{rows.map(b=><td key={b.id}>{Number(b.local_faves||0)} moderated recommendation{Number(b.local_faves||0)===1?'':'s'}</td>)}</tr>
   <tr><td>Availability</td>{rows.map(b=><td key={b.id}>{b.availability_status?availabilityLabel[b.availability_status]||String(b.availability_status).replaceAll('_',' '):'No current availability status'}</td>)}</tr>
   <tr><td>Current deals</td>{rows.map(b=><td key={b.id}>{Number(b.active_deals||0)}</td>)}</tr>
   <tr><td>Price range</td>{rows.map(b=><td key={b.id}>{b.price_range||'Not listed'}</td>)}</tr>
   <tr><td>Trust</td>{rows.map(b=><td key={b.id}>{b.verified?'Verified':b.claimed?'Claimed':'Published profile'}</td>)}</tr>
   <tr><td>Contact</td>{rows.map(b=><td key={b.id}>{b.phone?'Phone ':''}{b.website?'Website':''}{!b.phone&&!b.website?'Profile only':''}</td>)}</tr>
   <tr><td>Profile</td>{rows.map(b=><td key={b.id}><Link className="btn btn-small btn-light" href={`/business/${b.slug}`}>Open Profile</Link></td>)}</tr>
  </tbody></table><p className="small muted" style={{marginTop:10}}>Ratings are sourced listing data when available. Local Faves are separately moderated community recommendations. Claimed, Verified and paid visibility remain distinct signals.</p></div>}
 </section>
}
