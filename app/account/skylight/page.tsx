import type{Metadata}from'next'
import{createClient}from'@/lib/supabase/server'
import{requireUser}from'@/lib/auth'
import{SkylightClientWorkspace}from'@/components/SkylightClientWorkspace'
export const dynamic='force-dynamic'
export const metadata:Metadata={title:'My Skylight Services | Central Illinois Local Pros',robots:{index:false,follow:false,noarchive:true}}
export default async function Page(){await requireUser('/account/skylight');const s=await createClient();const{data,error}=await s.rpc('get_my_skylight_workspace');if(error)return <div className="consumer-panel"><div className="kpi">Skylight Reflections Marketing</div><h2>Customer Workspace</h2><p className="muted">We could not load your Skylight services workspace right now.</p></div>;return <SkylightClientWorkspace data={(data??{}) as any}/>}
