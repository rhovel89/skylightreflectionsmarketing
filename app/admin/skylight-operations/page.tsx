import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { SkylightOperationsManager } from '@/components/SkylightOperationsManager'
import { SkylightClientCommunicationManager } from '@/components/SkylightClientCommunicationManager'

export const dynamic='force-dynamic'

export default async function Page(){
  await requireAdmin('/admin/skylight-operations')
  const s=await createClient()
  const[{data:clients},{data:services},{data:packages},{data:packageItems},{data:templates},{data:proposals},{data:proposalItems},{data:agreements},{data:projects},{data:projectServices},{data:milestones},{data:tasks},{data:recurring},{data:messages},{data:access},{data:invites},{data:invoices}]=await Promise.all([
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
  ])
  const c=(clients??[]) as any[],p=(projects??[]) as any[],m=(messages??[]) as any[],a=(access??[]) as any[]
  const proposalRows=(proposals??[]) as any[],taskRows=(tasks??[]) as any[],invoiceRows=(invoices??[]) as any[]
  const today=new Date().toISOString().slice(0,10)
  const openProjects=p.filter(row=>!['completed','cancelled','archived'].includes(String(row.status||'').toLowerCase())).length
  const overdueTasks=taskRows.filter(row=>row.due_date&&String(row.due_date).slice(0,10)<today&&!['completed','done','cancelled'].includes(String(row.status||'').toLowerCase())).length
  const openProposals=proposalRows.filter(row=>!['accepted','declined','converted','expired','cancelled'].includes(String(row.status||'').toLowerCase())).length
  const invoicesWithBalance=invoiceRows.filter(row=>Number(row.balance_due_cents||0)>0&&!['paid','void','cancelled'].includes(String(row.status||'').toLowerCase())).length

  return <>
    <div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing</div><h1>Proposals, Agreements & Projects</h1><p className="muted">Use this workspace to move a real client from proposal and agreement through delivery. Intake, services, invoices and results stay one click away in the Client Work bar above.</p></div><span className="badge verified">Owner Controlled</span></div>
    <div className="admin-focus-strip" aria-label="Client work owner snapshot">
      <Link className="admin-focus-card" href="/admin/skylight-operations"><span>Open Projects</span><strong>{openProjects}</strong><small>Projects still in active delivery or planning.</small></Link>
      <Link className={`admin-focus-card ${overdueTasks ? 'attention' : ''}`} href="/admin/skylight-operations"><span>Overdue Tasks</span><strong>{overdueTasks}</strong><small>Project work with a past due date and no completed status.</small></Link>
      <Link className="admin-focus-card" href="/admin/skylight-operations"><span>Open Proposals</span><strong>{openProposals}</strong><small>Proposal records not yet accepted, declined, converted or closed.</small></Link>
      <Link className={`admin-focus-card ${invoicesWithBalance ? 'attention' : ''}`} href="/admin/skylight-invoices"><span>Invoices With Balance</span><strong>{invoicesWithBalance}</strong><small>Recorded service invoices that still have a balance due.</small></Link>
    </div>
    <SkylightOperationsManager clients={c} services={(services??[]) as any[]} packages={(packages??[]) as any[]} packageItems={(packageItems??[]) as any[]} templates={(templates??[]) as any[]} proposals={proposalRows} proposalItems={(proposalItems??[]) as any[]} agreements={(agreements??[]) as any[]} projects={p} projectServices={(projectServices??[]) as any[]} milestones={(milestones??[]) as any[]} tasks={taskRows} recurring={(recurring??[]) as any[]} messages={m} access={a} invites={(invites??[]) as any[]} invoices={invoiceRows}/>
    <div style={{height:18}}/>
    <SkylightClientCommunicationManager clients={c} projects={p} messages={m} access={a}/>
  </>
}
