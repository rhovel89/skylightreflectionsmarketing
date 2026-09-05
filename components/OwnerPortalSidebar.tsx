'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type PortalItem={href:string;label:string;keywords?:string}
type PortalGroup={id:string;label:string;description:string;items:PortalItem[]}

const shortcuts:PortalItem[]=[
 {href:'/business-portal',label:'Dashboard'},
 {href:'/business-portal/profile-strength',label:'Improve Profile'},
 {href:'/business-portal/leads',label:'Leads'},
 {href:'/business-portal/billing',label:'Billing'},
]

const groups:PortalGroup[]=[
 {id:'listing',label:'My Business',description:'Profile, media and local presence',items:[
  {href:'/business-portal/listing',label:'My Listing',keywords:'profile edit business information'},
  {href:'/business-portal/requests',label:'Change Requests',keywords:'pending edits moderation updates'},
  {href:'/business-portal/media',label:'Photos & Media',keywords:'logo cover gallery images menus'},
  {href:'/business-portal/profile-strength',label:'Profile Strength',keywords:'score completeness recommendations'},
  {href:'/business-portal/onboarding',label:'Getting Started',keywords:'onboarding setup checklist'},
  {href:'/business-portal/areas',label:'Cities & Branches',keywords:'physical locations offices'},
  {href:'/business-portal/service-areas',label:'Service Areas · Pro',keywords:'areas served cities pro'},
 ]},
 {id:'customers',label:'Customers & Performance',description:'Leads, activity and conversion signals',items:[
  {href:'/business-portal/lead-marketplace',label:'Lead Marketplace',keywords:'buy opportunities leads'},
  {href:'/business-portal/leads',label:'Lead Inbox · Pro',keywords:'customer leads inbox opportunities'},
  {href:'/business-portal/analytics',label:'Analytics',keywords:'views clicks directions impressions'},
  {href:'/business-portal/performance',label:'Performance · Pro',keywords:'conversion performance pro'},
 ]},
 {id:'growth',label:'Growth Options',description:'Optional paid products kept separate from organic rank',items:[
  {href:'/business-portal/growth',label:'Growth Center',keywords:'upgrade marketing advertising growth'},
  {href:'/business-portal/pro-profile',label:'Premium Profile · Featured / Pro',keywords:'featured pro premium conversion'},
 ]},
 {id:'account',label:'Account & Billing',description:'Plans, credits and account updates',items:[
  {href:'/business-portal/billing',label:'Billing & Credits',keywords:'invoices charges credits payments'},
  {href:'/business-portal/subscription',label:'Subscription',keywords:'plan subscription pricing'},
  {href:'/business-portal/notifications',label:'Notifications',keywords:'updates alerts account'},
 ]},
]

const totalTools=groups.reduce((sum,g)=>sum+g.items.length,0)
const isPathActive=(pathname:string,href:string)=>href==='/business-portal'?pathname==='/business-portal':pathname===href||pathname.startsWith(`${href}/`)

export function OwnerPortalSidebar(){
 const pathname=usePathname()
 const[query,setQuery]=useState('')
 const[unread,setUnread]=useState(0)
 const[businessId,setBusinessId]=useState('')
 const[openGroups,setOpenGroups]=useState<Record<string,boolean>>(()=>Object.fromEntries(groups.map(g=>[g.id,g.items.some(i=>isPathActive(pathname,i.href))||g.id==='listing'])))
 const normalized=query.trim().toLowerCase()
 const visible=useMemo(()=>normalized?groups.map(g=>({...g,items:g.items.filter(i=>`${i.label} ${i.keywords??''} ${g.label}`.toLowerCase().includes(normalized))})).filter(g=>g.items.length):groups,[normalized])
 const portalHref=(href:string)=>href==='/business-portal'||!businessId?href:`${href}${href.includes('?')?'&':'?'}business=${encodeURIComponent(businessId)}`
 useEffect(()=>{const current=new URLSearchParams(window.location.search).get('business')||'';setBusinessId(current)},[pathname])
 useEffect(()=>{let alive=true;const load=()=>fetch('/api/owner/notifications',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(body=>{if(alive&&body)setUnread(Number(body.unread_count||0))}).catch(()=>{});load();const timer=window.setInterval(load,60000);return()=>{alive=false;window.clearInterval(timer)}},[pathname])
 return <aside className="owner-portal-side"><div className="owner-portal-side-inner">
  <div className="owner-portal-brand"><div className="owner-portal-brand-mark">CLP</div><div><strong>Business Portal</strong><span>Private owner workspace</span></div></div>
  <div className="owner-portal-shortcuts">{shortcuts.map(i=><Link className={isPathActive(pathname,i.href)?'active':''} href={portalHref(i.href)} key={i.href}>{i.label}</Link>)}</div>
  <label className="owner-portal-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Find among ${totalTools} tools…`} aria-label="Search business portal"/>{query?<button type="button" onClick={()=>setQuery('')} aria-label="Clear portal search">×</button>:null}</label>
  <nav className="owner-portal-nav" aria-label="Business portal navigation">{visible.map(group=>{const expanded=normalized?true:Boolean(openGroups[group.id]);return <section className="owner-portal-nav-group" key={group.id}>
   <button type="button" className="owner-portal-nav-toggle" onClick={()=>setOpenGroups(v=>({...v,[group.id]:!v[group.id]}))} disabled={Boolean(normalized)} aria-expanded={expanded}><span><strong>{group.label}</strong><small>{group.description}</small></span><b aria-hidden="true">⌄</b></button>
   {expanded?<div className="owner-portal-nav-items">{group.items.map(item=><Link className={isPathActive(pathname,item.href)?'active':''} href={portalHref(item.href)} key={item.href}><span>{item.label}{item.href==='/business-portal/notifications'&&unread>0?<em className="owner-unread-badge">{unread>99?'99+':unread}</em>:null}</span><b aria-hidden="true">›</b></Link>)}</div>:null}
  </section>})}{!visible.length?<div className="owner-portal-nav-empty"><strong>No matching tools</strong><span>Try another search term.</span></div>:null}</nav>
  <div className="owner-portal-side-footer"><span>{businessId?'Business context stays selected':'Select a business inside any workspace'} · {totalTools} tools</span><Link href="/">← View Public Site</Link><form action="/auth/signout" method="post"><button type="submit">Log Out</button></form></div>
 </div></aside>
}
