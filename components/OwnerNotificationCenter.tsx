'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type Notification={id:string;title:string;body:string;action_url?:string|null;read_at?:string|null;created_at:string;event_key?:string|null}

export function OwnerNotificationCenter({initialItems}:{initialItems:Notification[]}){
 const[items,setItems]=useState(initialItems)
 const[filter,setFilter]=useState<'all'|'unread'>('all')
 const[busy,setBusy]=useState(false)
 const[message,setMessage]=useState('')
 const unread=items.filter(x=>!x.read_at).length
 const visible=useMemo(()=>filter==='unread'?items.filter(x=>!x.read_at):items,[items,filter])
 async function mark(ids?:string[],all=false){setBusy(true);setMessage('');const r=await fetch('/api/owner/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,all})});const body=await r.json().catch(()=>({}));if(!r.ok){setMessage(String(body.error||'Unable to update notifications.'));setBusy(false);return}const now=new Date().toISOString();setItems(current=>current.map(x=>(all||ids?.includes(x.id))&&!x.read_at?{...x,read_at:now}:x));setMessage('Notification state updated.');setBusy(false)}
 return <div>
  <div className="owner-notification-toolbar"><div className="owner-notification-tabs"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')} type="button">All <span>{items.length}</span></button><button className={filter==='unread'?'active':''} onClick={()=>setFilter('unread')} type="button">Unread <span>{unread}</span></button></div>{unread?<button className="btn btn-light" disabled={busy} onClick={()=>mark(undefined,true)} type="button">{busy?'Updating…':'Mark All Read'}</button>:null}</div>
  {message?<div className="small muted" role="status" style={{marginBottom:8}}>{message}</div>:null}
  <div className="owner-notification-list">{visible.map(item=><article className={`owner-notification-item ${item.read_at?'read':'unread'}`} key={item.id}><div className="owner-notification-dot"/><div><div className="owner-notification-meta"><span>{label(item.event_key)}</span><time>{formatDate(item.created_at)}</time></div><h3>{item.title}</h3><p>{item.body}</p><div className="card-actions">{item.action_url?<Link className="btn btn-small btn-primary" href={safePath(item.action_url)}>Open</Link>:null}{!item.read_at?<button className="btn btn-small btn-light" disabled={busy} onClick={()=>mark([item.id])} type="button">Mark Read</button>:null}</div></div></article>)}</div>
  {!visible.length?<div className="empty empty-rich"><h3>{filter==='unread'?'You are caught up':'No notifications yet'}</h3><p>{filter==='unread'?'There are no unread business-account notifications.':'Account, lead, billing and workflow updates will appear here when available.'}</p></div>:null}
 </div>
}

function safePath(value:string){try{const url=new URL(value,'https://local.invalid');if(url.origin==='https://local.invalid')return `${url.pathname}${url.search}${url.hash}`;return '/business-portal'}catch{return '/business-portal'}}
function label(value?:string|null){const v=String(value||'account update').replaceAll('_',' ').replaceAll('-',' ');return v.replace(/\b\w/g,c=>c.toUpperCase())}
function formatDate(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
