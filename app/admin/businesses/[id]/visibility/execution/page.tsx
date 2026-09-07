import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { BusinessVisibilityExecutionPanel } from '@/components/BusinessVisibilityExecutionPanel'

export const dynamic='force-dynamic'
export const metadata={title:'Visibility Execution & Outcomes | Central Illinois Local Pros',robots:{index:false,follow:false}}
type Row=Record<string,any>

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {claims}=await requireStaff('/admin/businesses')
  const {id}=await params,s=await createClient()
  const [businessQ,recommendationsQ,executionsQ,eventsQ,scheduleQ,reportsQ,clientsQ,prospectQ]=await Promise.all([
    s.from('businesses').select('id,name').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle(),
    s.from('business_visibility_recommendations').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(800),
    s.from('business_visibility_execution_items').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(300),
    s.from('business_visibility_execution_events').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('created_at',{ascending:false}).limit(500),
    s.from('business_visibility_report_schedules').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).maybeSingle(),
    s.from('business_visibility_reports').select('id,title,report_type,status,created_at,finalized_at').eq('tenant_id',TENANT_ID).eq('business_id',id).eq('report_type','client').eq('status','finalized').order('finalized_at',{ascending:false}).limit(100),
    s.from('skylight_clients').select('id,company_name,status,updated_at').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(20),
    s.from('business_prospects').select('id').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
  ])
  if(businessQ.error||!businessQ.data)notFound()
  const errors=[recommendationsQ.error,executionsQ.error,eventsQ.error,scheduleQ.error,reportsQ.error,clientsQ.error,prospectQ.error].filter(Boolean)
  const clients=[...((clientsQ.data||[]) as Row[])]
  if(prospectQ.data?.id){
    const oq=await s.from('skylight_sales_opportunities').select('client_id').eq('tenant_id',TENANT_ID).eq('prospect_id',prospectQ.data.id).order('updated_at',{ascending:false}).limit(1).maybeSingle()
    if(oq.error)errors.push(oq.error)
    const fallbackId=oq.data?.client_id?String(oq.data.client_id):''
    if(fallbackId&&!clients.some(c=>String(c.id)===fallbackId)){
      const cq=await s.from('skylight_clients').select('id,company_name,status,updated_at').eq('tenant_id',TENANT_ID).eq('id',fallbackId).maybeSingle()
      if(cq.error)errors.push(cq.error);else if(cq.data)clients.push(cq.data as Row)
    }
  }
  const clientIds=[...new Set(clients.map(c=>String(c.id)).filter(Boolean))]
  const projectsQ=clientIds.length?await s.from('skylight_projects').select('id,client_id,project_number,name,status,due_date,updated_at').eq('tenant_id',TENANT_ID).in('client_id',clientIds).neq('status','cancelled').order('updated_at',{ascending:false}).limit(200):{data:[] as Row[],error:null}
  if(projectsQ.error)errors.push(projectsQ.error)
  const business=businessQ.data as Row

  return <div className="admin-visibility-page">
    <div className="admin-page-head"><div><div className="kpi">Business Visibility Intelligence 4.4</div><h1>{String(business.name)} · Execution & Outcomes</h1><p className="muted">Turn accepted recommendations into accountable work, preserve the before snapshot, and remeasure later. Completing the work never automatically claims an SEO improvement.</p></div><div className="admin-head-badge-stack"><span className="badge verified">Remeasurement Required</span><span className="badge neutral">No Causality Claim</span></div></div>
    {errors.length?<div className="notice warn">Some execution/supporting records could not be loaded completely. 4.4 will not substitute missing measurements or infer an outcome from incomplete data.</div>:null}
    <BusinessVisibilityExecutionPanel
      business={{id:String(business.id),name:String(business.name)}}
      currentUserId={String(claims.sub)}
      recommendations={(recommendationsQ.data||[]) as Row[]}
      executions={(executionsQ.data||[]) as Row[]}
      events={(eventsQ.data||[]) as Row[]}
      schedule={(scheduleQ.data||null) as Row|null}
      projects={(projectsQ.data||[]) as Row[]}
      clientLinked={clientIds.length>0}
      finalizedClientReports={(reportsQ.data||[]) as Row[]}
    />
  </div>
}
