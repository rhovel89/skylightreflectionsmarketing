import{createClient}from'@/lib/supabase/server'
import{requireUser}from'@/lib/auth'
import{TENANT_ID}from'@/lib/constants'
import{EddmCustomerPortal}from'@/components/EddmCustomerPortal'
export const dynamic='force-dynamic'
export default async function Page(){await requireUser('/account/eddm');const s=await createClient(),{data,error}=await s.rpc('get_my_eddm_portal');if(error)return <div className="consumer-panel"><h2>EDDM Customer Portal</h2><p className="muted">We could not load your EDDM workspace right now.</p></div>;return <EddmCustomerPortal tenantId={TENANT_ID} data={(data??{}) as any}/>}
