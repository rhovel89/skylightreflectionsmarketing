import{createClient}from'@/lib/supabase/server'
import{TENANT_ID}from'@/lib/constants'
import{requireAdmin}from'@/lib/auth'
import{SkylightEddmManager}from'@/components/SkylightEddmManager'
import{SkylightEddmProductionManager}from'@/components/SkylightEddmProductionManager'
import{SkylightEddmPortalAdmin}from'@/components/SkylightEddmPortalAdmin'

export const dynamic='force-dynamic'
export default async function Page(){
 await requireAdmin('/admin/skylight-eddm');const s=await createClient()
 const[{data:settings},{data:packages},{data:markets},{data:interests},{data:spots},{data:assets},{data:financials},{data:activity},{data:portalAccess},{data:portalInvites},{data:portalMessages}]=await Promise.all([
  s.from('skylight_eddm_settings').select('*').eq('tenant_id',TENANT_ID).maybeSingle(),
  s.from('skylight_eddm_packages').select('*').eq('tenant_id',TENANT_ID).order('sort_order'),
  s.from('skylight_eddm_markets').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}),
  s.from('skylight_eddm_interests').select('*,market:skylight_eddm_markets(id,name,campaign_mode,production_status),invoice:skylight_invoices(id,invoice_number,status,total_cents,amount_paid_cents,balance_due_cents,due_date,public_token)').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(750),
  s.from('skylight_eddm_spots').select('*,package:skylight_eddm_packages(id,name,package_key,price_cents,slot_prefix),interest:skylight_eddm_interests(id,business_name,status,artwork_status,invoice_id)').eq('tenant_id',TENANT_ID).order('slot_code'),
  s.from('skylight_eddm_artwork_assets').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(1000),
  s.from('skylight_eddm_market_financials').select('*').eq('tenant_id',TENANT_ID),
  s.from('skylight_eddm_activity').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(300),
  s.from('skylight_client_portal_access').select('*,client:skylight_clients(id,company_name,email)').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}),
  s.from('skylight_client_portal_invites').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(500),
  s.from('skylight_eddm_portal_messages').select('*,interest:skylight_eddm_interests(id,business_name)').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(300),
 ])
 const p=(packages??[]) as any[],nameByKey=new Map(p.map(x=>[String(x.package_key),x])),enriched=((interests??[]) as any[]).map(i=>({...i,package:nameByKey.get(String(i.package_key||''))||null}))
 return <><div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing</div><h1>EDDM Production & Community Mailers</h1><p className="muted">Operate co-op and dedicated EDDM from interest through customer portal access, spot sales, artwork, payment, print, USPS drop and completed mail delivery.</p></div><span className="badge verified">Admin Only</span></div><SkylightEddmPortalAdmin interests={enriched} access={(portalAccess??[]) as any[]} invites={(portalInvites??[]) as any[]} messages={(portalMessages??[]) as any[]}/><SkylightEddmProductionManager tenantId={TENANT_ID} packages={p} markets={(markets??[]) as any[]} interests={enriched} spots={(spots??[]) as any[]} assets={(assets??[]) as any[]} financials={(financials??[]) as any[]} activity={(activity??[]) as any[]}/><SkylightEddmManager settings={(settings??null) as any} packages={p} markets={(markets??[]) as any[]} interests={enriched}/></>
}
