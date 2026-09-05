import type{Metadata}from'next'
import{createClient}from'@/lib/supabase/server'
import{requireAdmin}from'@/lib/auth'
import{TENANT_ID}from'@/lib/constants'
import{SkylightIntakeTemplateManager}from'@/components/SkylightIntakeTemplateManager'
export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Skylight Intake & Client Assets | Admin',robots:{index:false,follow:false,noarchive:true}}
export default async function Page(){await requireAdmin('/admin/skylight-intake');const s=await createClient();const[{data:services},{data:questions},{data:assetRequirements},{data:projects},{data:projectFields},{data:projectRequirements},{data:projectAssets},{data:clients}]=await Promise.all([
 s.from('skylight_service_catalog').select('*').eq('tenant_id',TENANT_ID).order('sort_order'),
 s.from('skylight_service_intake_questions').select('*').eq('tenant_id',TENANT_ID).order('service_id').order('sort_order'),
 s.from('skylight_service_asset_requirements').select('*').eq('tenant_id',TENANT_ID).order('service_id').order('sort_order'),
 s.from('skylight_projects').select('id,client_id,project_number,name,status,intake_status,intake_submitted_at,intake_reviewed_at,created_at').eq('tenant_id',TENANT_ID).neq('intake_status','not_required').order('created_at',{ascending:false}).limit(500),
 s.from('skylight_project_intake_fields').select('*').eq('tenant_id',TENANT_ID).order('sort_order'),
 s.from('skylight_project_asset_requirements').select('*').eq('tenant_id',TENANT_ID).order('sort_order'),
 s.from('skylight_project_assets').select('*').eq('tenant_id',TENANT_ID).is('removed_at',null).order('created_at',{ascending:false}),
 s.from('skylight_clients').select('id,company_name,contact_name,email').eq('tenant_id',TENANT_ID).order('company_name')
]);return <><div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing</div><h1>Intake & Client Assets</h1><p className="muted">Build reusable onboarding questions and file requirements for any current or future service, then review each client project from the same private workspace.</p><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><a className="btn btn-primary" href="/admin/skylight-services">Services & Pricing</a><a className="btn btn-light" href="/admin/skylight-operations">Proposals & Projects</a></div></div><span className="badge verified">Admin Only</span></div><SkylightIntakeTemplateManager services={(services??[]) as any[]} questions={(questions??[]) as any[]} assetRequirements={(assetRequirements??[]) as any[]} projects={(projects??[]) as any[]} projectFields={(projectFields??[]) as any[]} projectRequirements={(projectRequirements??[]) as any[]} projectAssets={(projectAssets??[]) as any[]} clients={(clients??[]) as any[]}/></>}
