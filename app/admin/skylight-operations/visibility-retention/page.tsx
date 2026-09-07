import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { buildVisibilityClientHealth } from '@/lib/business-visibility-client-health'
import { VisibilityRetentionCommandCenter } from '@/components/VisibilityRetentionCommandCenter'

export const dynamic='force-dynamic'
export const metadata={title:'Visibility Client Results & Retention | Central Illinois Local Pros',robots:{index:false,follow:false}}
type Row=Record<string,any>

export default async function Page(){
  await requireStaff('/admin/skylight-operations/visibility-retention')
  const s=await createClient()
  const clientsQ=await s.from('skylight_clients').select('id,business_id,company_name,status,updated_at').eq('tenant_id',TENANT_ID).not('business_id','is',null).order('company_name').limit(1000)
  const clients=(clientsQ.data||[]) as Row[]
  if(clientsQ.error)return <div className="container" style={{padding:'24px 0 48px'}}><div className="notice warn">Linked Skylight clients could not be loaded. 4.5 will not infer client relationships.</div></div>
  if(!clients.length)return <div className="container" style={{padding:'24px 0 48px'}}><VisibilityRetentionCommandCenter rows={[]}/></div>

  const businessIds=[...new Set(clients.map(r=>String(r.business_id)).filter(Boolean))],clientIds=clients.map(r=>String(r.id))
  const [businessesQ,snapshotsQ,executionsQ,schedulesQ,projectsQ,invoicesQ,recurringQ,reportsQ,reviewsQ]=await Promise.all([
    s.from('businesses').select('id,name,website').eq('tenant_id',TENANT_ID).in('id',businessIds).limit(1500),
    s.from('business_visibility_opportunity_snapshots').select('*').eq('tenant_id',TENANT_ID).in('business_id',businessIds).order('generated_at',{ascending:false}).limit(5000),
    s.from('business_visibility_execution_items').select('*').eq('tenant_id',TENANT_ID).in('business_id',businessIds).order('updated_at',{ascending:false}).limit(5000),
    s.from('business_visibility_report_schedules').select('*').eq('tenant_id',TENANT_ID).in('business_id',businessIds).limit(1500),
    s.from('skylight_projects').select('*').eq('tenant_id',TENANT_ID).in('client_id',clientIds).order('updated_at',{ascending:false}).limit(5000),
    s.from('skylight_invoices').select('*').eq('tenant_id',TENANT_ID).in('client_id',clientIds).order('updated_at',{ascending:false}).limit(5000),
    s.from('skylight_recurring_services').select('*').eq('tenant_id',TENANT_ID).in('client_id',clientIds).order('updated_at',{ascending:false}).limit(5000),
    s.from('business_visibility_reports').select('*').eq('tenant_id',TENANT_ID).in('business_id',businessIds).eq('report_type','client').eq('status','finalized').order('finalized_at',{ascending:false}).limit(5000),
    s.from('business_visibility_retention_reviews').select('*').eq('tenant_id',TENANT_ID).in('client_id',clientIds).limit(1500),
  ])
  const errors=[businessesQ,snapshotsQ,executionsQ,schedulesQ,projectsQ,invoicesQ,recurringQ,reportsQ,reviewsQ].filter((q:any)=>q.error)
  const businesses=(businessesQ.data||[]) as Row[],projects=(projectsQ.data||[]) as Row[],invoices=(invoicesQ.data||[]) as Row[]
  const projectIds=projects.map(r=>String(r.id)),invoiceIds=invoices.map(r=>String(r.id))
  const tasksQ=projectIds.length?await s.from('skylight_project_tasks').select('*').in('project_id',projectIds).order('due_date',{ascending:true}).limit(10000):{data:[] as Row[],error:null}
  const paymentsQ=invoiceIds.length?await s.from('skylight_invoice_payments').select('*').in('invoice_id',invoiceIds).order('paid_at',{ascending:false}).limit(10000):{data:[] as Row[],error:null}
  if(tasksQ.error||paymentsQ.error)errors.push(tasksQ.error||paymentsQ.error)
  const businessMap=new Map(businesses.map(r=>[String(r.id),r])),reviewMap=new Map(((reviewsQ.data||[]) as Row[]).map(r=>[String(r.client_id),r]))
  const allSnapshots=(snapshotsQ.data||[]) as Row[],allExec=(executionsQ.data||[]) as Row[],allSchedules=(schedulesQ.data||[]) as Row[],allRecurring=(recurringQ.data||[]) as Row[],allReports=(reportsQ.data||[]) as Row[],allTasks=(tasksQ.data||[]) as Row[],allPayments=(paymentsQ.data||[]) as Row[]
  const rows=clients.flatMap(client=>{
    const business=businessMap.get(String(client.business_id));if(!business)return []
    const cp=projects.filter(r=>String(r.client_id)===String(client.id)),pids=new Set(cp.map(r=>String(r.id))),ci=invoices.filter(r=>String(r.client_id)===String(client.id)),iids=new Set(ci.map(r=>String(r.id)))
    const health=buildVisibilityClientHealth({client,business,visibilitySnapshots:allSnapshots.filter(r=>String(r.business_id)===String(business.id)),executions:allExec.filter(r=>String(r.business_id)===String(business.id)),reportSchedule:allSchedules.find(r=>String(r.business_id)===String(business.id))||null,projects:cp,projectTasks:allTasks.filter(r=>pids.has(String(r.project_id))),invoices:ci,payments:allPayments.filter(r=>iids.has(String(r.invoice_id))),recurringServices:allRecurring.filter(r=>String(r.client_id)===String(client.id)),finalizedReports:allReports.filter(r=>String(r.business_id)===String(business.id))})
    return [{client,business,health,review:reviewMap.get(String(client.id))||null}]
  }).sort((a,b)=>{const order:Record<string,number>={attention:0,watch:1,healthy:2,insufficient_data:3};return (order[a.health.health_status]??9)-(order[b.health.health_status]??9)||Number(b.health.attention_points)-Number(a.health.attention_points)||String(a.client.company_name).localeCompare(String(b.client.company_name))})

  return <div className="container" style={{padding:'24px 0 48px'}}>{errors.length?<div className="notice warn" style={{marginBottom:14}}>Some client-supporting records could not be loaded. 4.5 keeps missing data neutral and does not create replacement values, inferred churn predictions or estimated ROI.</div>:null}<VisibilityRetentionCommandCenter rows={rows}/></div>
}
