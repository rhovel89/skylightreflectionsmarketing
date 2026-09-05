'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect,useState } from 'react'

const items=[
 {href:'/account',label:'Overview',hint:'Your Local Pros home'},
 {href:'/account/saved',label:'Saved Businesses',hint:'Businesses you want to revisit'},
 {href:'/account/requests',label:'My Requests',hint:'Quote and information requests'},
 {href:'/account/notifications',label:'Notifications',hint:'Request and account updates'},
 {href:'/account/business-access',label:'Business Access',hint:'Username and business-account status'},
 {href:'/account/settings',label:'Settings',hint:'Contact and notification preferences'},
]
const active=(pathname:string,href:string)=>href==='/account'?pathname==='/account':pathname===href||pathname.startsWith(`${href}/`)

export function ConsumerAccountSidebar(){
 const pathname=usePathname()
 const[unread,setUnread]=useState(0)
 useEffect(()=>{let live=true;const load=()=>fetch('/api/account/notifications',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(x=>{if(live&&x)setUnread(Number(x.unread_count||0))}).catch(()=>{});load();const timer=window.setInterval(load,60000);return()=>{live=false;window.clearInterval(timer)}},[pathname])
 return <aside className="consumer-account-side"><div className="consumer-account-brand"><div>LP</div><span><strong>My Local Pros</strong><small>Private customer workspace</small></span></div><nav aria-label="My Local Pros account navigation">{items.map(i=><Link href={i.href} className={active(pathname,i.href)?'active':''} key={i.href}><span><strong>{i.label}{i.href==='/account/notifications'&&unread>0?<em>{unread>99?'99+':unread}</em>:null}</strong><small>{i.hint}</small></span><b aria-hidden="true">›</b></Link>)}</nav><div className="consumer-account-side-actions"><Link href="/search">Find Local Businesses</Link><Link href="/">← Public Site</Link><form action="/auth/signout" method="post"><button type="submit">Sign Out</button></form></div></aside>
}
