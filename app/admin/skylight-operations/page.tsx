import{createClient}from'@/lib/supabase/server'
import{requireAdmin}from'@/lib/auth'
import{TENANT_ID}from'@/lib/constants'
import{SkylightOperationsManager}from'@/components/SkylightOperationsManager'
export const dynamic='force-dynamic'
export default async function Page(){await requireAdmin('/admin/skylight-operations');const s=await createClient();const[{data:clients},{data:services},{data:packages},{data:packageItems},{data:templates},{data:proposals},{data:proposalItems},{data:agreements},{data:projects},{data:projectServices},{data:milestones},{data:tasks},{data:recurring},{data:messages},{data:access},{data:invites},{data:invoices}]=await Promise.all([
 s.from('skylight_clients').select('*').eq('tenant_id',TENANT_ID).order('company_name'),
 s.from('skylight_service_catalog').select('*').eq('tenant_id',TENANT_ID).order('sort_order'),
 s.from('skylight_service_packages').select('*').eq('tenant_id',TENANT_ID).order('sort_order'),
 s.from('skylight_service_package_items').select('*'),
 s.from('skylight_service_task_templates').select('*').eq('tenant_id',TENANT_ID).order('service_id').order('sort_order'),
 s.from('skylight_proposals').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(500),
 s.from('skylight_proposal_items').select('*').order('sort_order'),
 s.from('skylight_agreements').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(500),
 s.from('skylight_projects').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(500),
 s.from('skylight_project_services').select('*'),
 s.from('skylight_project_milestones').select('*').order('sort_order'),
 s.from('skylight_project_tasks').select('*').order('due_date',{ascending:true}),
 s.from('skylight_recurring_services').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(500),
 s.from('skylight_project_messages').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(500),
 s.from('skylight_client_portal_access').select('*').eq('tenant_id',TENANT_ID),
 s.from('skylight_client_portal_invites').select('*').eq('tenant_id',TENANT_ID).is('interest_id',null).order('created_at',{ascending:false}).limit(500),
 s.from('skylight_invoices').select('id,client_id,invoice_number,status,total_cents,amount_paid_cents,balance_due_cents,due_date,public_token,created_at,internal_note').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(750)
]);return <><div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing</div><h1>Proposals, Agreements & Projects</h1><p className="muted">Run customizable service sales and delivery from proposal through electronic acceptance, explicit invoicing, project milestones, client approvals and recurring-service planning.</p><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><a className="btn btn-primary" href="/admin/skylight-services">Customize Services</a><a className="btn btn-light" href="/admin/skylight-invoices">Service Invoices</a><a className="btn btn-light" href="/admin/skylight-sales">Sales Command Center</a></div></div><span className="badge verified">Admin Only</span></div><SkylightOperationsManager clients={(clients??[]) as any[]} services={(services??[]) as any[]} packages={(packages??[]) as any[]} packageItems={(packageItems??[]) as any[]} templates={(templates??[]) as any[]} proposals={(proposals??[]) as any[]} proposalItems={(proposalItems??[]) as any[]} agreements={(agreements??[]) as any[]} projects={(projects??[]) as any[]} projectServices={(projectServices??[]) as any[]} milestones={(milestones??[]) as any[]} tasks={(tasks??[]) as any[]} recurring={(recurring??[]) as any[]} messages={(messages??[]) as any[]} access={(access??[]) as any[]} invites={(invites??[]) as any[]} invoices={(invoices??[]) as any[]}/></>}
