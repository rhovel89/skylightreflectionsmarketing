'use client'
import type{ReactNode,MouseEvent}from'react'
type EventType='phone_click'|'website_click'|'directions_click'
export function TrackedBusinessLink({businessId,eventType,href,className,children,target,rel}:{businessId:string;eventType:EventType;href:string;className?:string;children:ReactNode;target?:string;rel?:string}){function track(_:MouseEvent<HTMLAnchorElement>){const body=JSON.stringify({business_id:businessId,event_type:eventType});try{if(navigator.sendBeacon){navigator.sendBeacon('/api/track',new Blob([body],{type:'application/json'}));return}}catch{}fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{})}return <a href={href} className={className} target={target} rel={rel} onClick={track}>{children}</a>}
