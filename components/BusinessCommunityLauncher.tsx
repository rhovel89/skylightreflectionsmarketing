'use client'
import Link from'next/link'
import{usePathname}from'next/navigation'
export function BusinessCommunityLauncher({slug}:{slug:string}){const p=usePathname();if(p.endsWith('/community'))return null;return <div style={{position:'fixed',right:18,bottom:86,zIndex:45,filter:'drop-shadow(0 8px 20px rgba(0,0,0,.18))'}}><Link href={`/business/${slug}/community`} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 16px',borderRadius:999,background:'#4a00e0',color:'#fff',fontWeight:800,textDecoration:'none',border:'1px solid rgba(255,255,255,.2)'}}>♥ Local Faves · Deals · Q&A</Link></div>}
