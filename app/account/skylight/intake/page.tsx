import type{Metadata}from'next'
import{createClient}from'@/lib/supabase/server'
import{requireUser}from'@/lib/auth'
import{SkylightClientIntake}from'@/components/SkylightClientIntake'
export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Skylight Client Intake & Files | Central Illinois Local Pros',robots:{index:false,follow:false,noarchive:true}}
export default async function Page(){await requireUser('/account/skylight/intake');const s=await createClient();const{data,error}=await s.rpc('get_my_skylight_intake');if(error)return <div className="consumer-panel"><div className="kpi">Skylight Reflections Marketing</div><h2>Client Intake & Files</h2><p className="muted">We could not load your private onboarding workspace right now.</p></div>;return <SkylightClientIntake data={(data??{}) as any}/>}
