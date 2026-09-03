import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { InventoryExpansionPanel } from '@/components/InventoryExpansionPanel'

export const dynamic='force-dynamic'

export default async function Page(){
  const s=await createClient(); const ninetyDaysAgo=new Date(Date.now()-90*86400000).toISOString();
  const [locations,branches,serviceAreas,categories,searches]=await Promise.all([
    s.from('locations').select('id,name,slug').eq('tenant_id',TENANT_ID).eq('is_active',true).order('name'),
    s.from('business_locations').select('city,location_id,business_id,businesses!inner(status,tenant_id)').eq('tenant_id',TENANT_ID).eq('is_active',true).eq('businesses.status','published').eq('businesses.tenant_id',TENANT_ID).limit(10000),
    s.from('business_service_areas').select('business_id,location_id,businesses!inner(status,tenant_id)').eq('businesses.status','published').eq('businesses.tenant_id',TENANT_ID).limit(20000),
    s.from('business_categories').select('business_id,categories!inner(name,slug,vertical,tenant_id)').eq('categories.tenant_id',TENANT_ID).limit(20000),
    s.from('search_events').select('service,location,result_count,created_at').eq('tenant_id',TENANT_ID).gte('created_at',ninetyDaysAgo).order('created_at',{ascending:false}).limit(5000),
  ]);
  const errors=[locations.error,branches.error,serviceAreas.error,categories.error,searches.error].filter(Boolean);
  return <><div className="admin-page-head"><div><div className="kpi">Private Growth Intelligence</div><h1>Inventory Expansion</h1><p className="muted">Prioritize legitimate provider research using the same physical-location + service-area coverage model used by public index eligibility.</p></div><span className="badge neutral">Internal only</span></div>{errors.length>0&&<div className="notice warn">One or more inventory inputs could not be loaded. The opportunity ranking may be incomplete.</div>}<InventoryExpansionPanel locations={(locations.data??[]) as any[]} branches={(branches.data??[]) as any[]} serviceAreas={(serviceAreas.data??[]) as any[]} businessCategories={(categories.data??[]) as any[]} searchEvents={(searches.data??[]) as any[]}/></>
}
