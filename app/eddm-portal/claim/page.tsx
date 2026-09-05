import type{Metadata}from'next'
import{notFound}from'next/navigation'
import{requireUser}from'@/lib/auth'
import{SiteShell}from'@/components/SiteShell'
import{EddmPortalClaim}from'@/components/EddmPortalClaim'
export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Connect EDDM Portal | Skylight Reflections Marketing',robots:{index:false,follow:false,noarchive:true}}
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){const p=await searchParams,token=String(p.token||'');if(!/^[0-9a-f-]{36}$/i.test(token))notFound();await requireUser(`/eddm-portal/claim?token=${encodeURIComponent(token)}`);return <SiteShell><main className="section"><div className="container"><EddmPortalClaim token={token}/></div></main></SiteShell>}
