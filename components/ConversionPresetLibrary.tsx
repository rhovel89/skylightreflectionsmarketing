'use client'
import{useState}from'react'
const PRESETS=[
 {goal:'Lead generation',label:'Request a Free Quote',note:'Strong default for home services and project-based businesses.'},
 {goal:'Lead generation',label:'Get an Estimate',note:'Useful when customers want pricing guidance before committing.'},
 {goal:'Appointments',label:'Book Online',note:'Best when your scheduling page can accept appointments immediately.'},
 {goal:'Appointments',label:'Schedule a Consultation',note:'Useful for professional services and higher-consideration purchases.'},
 {goal:'Phone calls',label:'Call Now',note:'Use when phone response is a primary conversion path.'},
 {goal:'Restaurants',label:'Order Online',note:'Send customers directly to your ordering system.'},
 {goal:'Restaurants',label:'Reserve a Table',note:'Send customers directly to your reservation system.'},
 {goal:'Offers',label:'Claim This Offer',note:'Pair with a current coupon or promotion in your Pro profile.'},
]
export function ConversionPresetLibrary(){const[copied,setCopied]=useState('');async function copy(label:string){try{await navigator.clipboard.writeText(label);setCopied(label);setTimeout(()=>setCopied(''),1800)}catch{setCopied('')}}return <div className="card" style={{marginBottom:16}}><div className="section-head compact-head"><div><div className="kpi">Conversion Toolkit</div><h2>Customer-action CTA templates</h2><p className="small muted">Use a clear action that matches what happens after the click. These templates do not affect organic directory ranking.</p></div><span className="badge neutral">Pro</span></div><div className="grid grid-2">{PRESETS.map(x=><div className="admin-card" key={`${x.goal}-${x.label}`}><div className="kpi">{x.goal}</div><h3>{x.label}</h3><p className="small muted">{x.note}</p><button type="button" className="btn btn-light" onClick={()=>copy(x.label)}>{copied===x.label?'Copied':'Copy CTA Text'}</button></div>)}</div><div className="notice" style={{marginTop:12,marginBottom:0}}><strong>Tracking:</strong> approved Pro offer, package, social and custom CTA clicks are reported separately in Pro Performance while still contributing to normal website-action totals.</div></div>}
