import{createClient}from'@/lib/supabase/server'
import{TENANT_ID}from'@/lib/constants'
import{requireAdmin}from'@/lib/auth'
import{SkylightServiceCatalogManager}from'@/components/SkylightServiceCatalogManager'
export const dynamic='force-dynamic'
export default async function Page(){await requireAdmin('/admin/skylight-services');const s=await createClient();const[{data:services},{data:mappings}]=await Promise.all([s.from('skylight_service_catalog').select('*').eq('tenant_id',TENANT_ID).order('sort_order'),s.from('skylight_signal_service_map').select('*').eq('tenant_id',TENANT_ID).order('signal_key')]);return <><div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing</div><h1>Services & Pricing</h1><p className="muted">Edit the public Skylight service catalog, default pricing behavior and the private signal-to-service recommendations used by the sales engine.</p></div><span className="badge verified">Admin Only</span></div><SkylightServiceCatalogManager services={(services??[]) as any[]} mappings={(mappings??[]) as any[]}/></>}
