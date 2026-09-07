import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { buildVisibilityClientHealth } from '@/lib/business-visibility-client-health'
import { BusinessVisibilityClientHealthPanel } from '@/components/BusinessVisibilityClientHealthPanel'

export const dynamic='force-dynamic'
export const metadata={title:'Client Results & Retention Intelligence | Central Illinois Local Pros',robots:{index:false,follow:false}}
type Row=Record<string,any>

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {claims}=await requireStaff('/admin/businesses')
  const {id}=await params,s=await createClient()
  const [businessQ,clientsQ]=await Promise.all([
    s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle(),
    s.from('skylight_clients').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(20),
  ])
  if(businessQ.error||!businessQ.data)notFound()
  const clients=(clientsQ.data||[]) as Row[],client=clients.find(r=>String(r.status)==='active')||clients[0]||null
  const nav=<div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}><Link className="btn btn-light" href={`/admin/businesses/${id}`}>← Business Workspace</Link><Link className="btn btn-light" href={`/admin/businesses/${id}/visibility`}>Google & SEO Visibility 4.1</Link><Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/monitoring`}>Monitoring & Competitors 4.0</Link><Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/google`}>Google-Owned Data 4.2</Link><Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/reporting`}>Opportunity & Reporting 4.3</Link><Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/execution`}>Execution & Outcomes 4.4</Link><span className="btn btn-primary" aria-current="page">Client Results & Retention 4.5</span></div>
  if(clientsQ.error)return <div className="container" style={{padding:'24px 0 48px'}}>{nav}<div className="notice warn">The linked Skylight client record could not be loaded. 4.5 will not infer a client relationship.</div></div>
  if(!client)return <div className="container" style={{padding:'24px 0 48px'}}>{nav}<div className="card"><div className="kpi">Business Visibility Intelligence 4.5</div><h1>Client Results & Retention Intelligence</h1><div className="notice">This business is not linked to a Skylight client, so retention intelligence is intentionally unavailable. Convert/link the real client in Skylight Operations first; 4.5 will not create a synthetic client relationship.</div><div style={{marginTop:12}}><Link className="btn btn-light" href="/admin/skylight-operations/visibility-retention">Open Retention Command Center</Link></div></div></div>

  const [snapshotsQ,executionsQ,scheduleQ,projectsQ,invoicesQ,recurringQ,reportsQ,healthHistoryQ,reviewQ,eventsQ]=await Promise.all([
    s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('generated_at',{ascending:false}).limit(150),
    s.from('business_visibility_execution_items').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(500),
    s.from('business_visibility_report_schedules').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).maybeSingle(),
    s.from('skylight_projects').select('*').eq('tenant_id',TENANT_ID).eq('client_id',client.id).order('updated_at',{ascending:false}).limit(300),
    s.from('skylight_invoices').select('*').eq('tenant_id',TENANT_ID).eq('client_id',client.id).order('updated_at',{ascending:false}).limit(500),
    s.from('skylight_recurring_services').select('*').eq('tenant_id',TENANT_ID).eq('client_id',client.id).order('updated_at',{ascending:false}).limit(300),
    s.from('business_visibility_reports').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).eq('report_type','client').eq('status','finalized').order('finalized_at',{ascending:false}).limit(150),
    s.from('business_visibility_client_health_snapshots').select('*').eq('tenant_id',TENANT_ID).eq('client_id',client.id).order('created_at',{ascending:false}).limit(100),
    s.from('business_visibility_retention_reviews').select('*').eq('tenant_id',TENANT_ID).eq('client_id',client.id).maybeSingle(),
    s.from('business_visibility_retention_events').select('*').eq('tenant_id',TENANT_ID).eq('client_id',client.id).order('created_at',{ascending:false}).limit(250),
  ])
  const errors=[snapshotsQ,executionsQ,scheduleQ,projectsQ,invoicesQ,recurringQ,reportsQ,healthHistoryQ,reviewQ,eventsQ].filter((q:any)=>q.error)
  const projects=(projectsQ.data||[]) as Row[],invoices=(invoicesQ.data||[]) as Row[],projectIds=projects.map(r=>String(r.id)),invoiceIds=invoices.map(r=>String(r.id))
  const tasksQ=projectIds.length?await s.from('skylight_project_tasks').select('*').in('project_id',projectIds).order('due_date',{ascending:true}).limit(1500):{data:[] as Row[],error:null}
  const paymentsQ=invoiceIds.length?await s.from('skylight_invoice_payments').select('*').in('invoice_id',invoiceIds).order('paid_at',{ascending:false}).limit(1500):{data:[] as Row[],error:null}
  if(tasksQ.error||paymentsQ.error)errors.push(tasksQ.error||paymentsQ.error)
  const health=buildVisibilityClientHealth({client,business:businessQ.data as Row,visibilitySnapshots:(snapshotsQ.data||[]) as Row[],executions:(executionsQ.data||[]) as Row[],reportSchedule:(scheduleQ.data||null) as Row|null,projects,projectTasks:(tasksQ.data||[]) as Row[],invoices,payments:(paymentsQ.data||[]) as Row[],recurringServices:(recurringQ.data||[]) as Row[],finalizedReports:(reportsQ.data||[]) as Row[]})

  return <div className="container" style={{padding:'24px 0 48px'}}>{nav}<div style={{marginBottom:14}}><Link className="btn btn-light" href="/admin/skylight-operations/visibility-retention">← All Visibility Clients</Link></div>{errors.length?<div className="notice warn" style={{marginBottom:14}}>Some supporting client records could not be loaded. 4.5 keeps missing data neutral and does not replace missing evidence with zero, inferred churn risk or invented ROI.</div>:null}<BusinessVisibilityClientHealthPanel business={{id:String(businessQ.data.id),name:String(businessQ.data.name)}} client={client} currentHealth={health} healthSnapshots={(healthHistoryQ.data||[]) as Row[]} review={(reviewQ.data||null) as Row|null} retentionEvents={(eventsQ.data||[]) as Row[]} currentUserId={String(claims.sub)}/></div>
}
