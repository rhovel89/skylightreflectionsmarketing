import Link from 'next/link'
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

  return <div className="container" style={{padding:'24px 0 48px'}}>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
      <Link className="btn btn-light" href={`/admin/businesses/${id}`}>← Business Workspace</Link>
      <Link className="btn btn-light" href={`/admin/businesses/${id}/visibility`}>Google & SEO Visibility 4.1</Link>
      <Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/monitoring`}>Monitoring & Competitors 4.0</Link>
      <Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/google`}>Google-Owned Data 4.2</Link>
      <Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/reporting`}>Opportunity & Reporting 4.3</Link>
      <span className="btn btn-primary" aria-current="page">Execution & Outcomes 4.4</span>
    </div>
    {errors.length?<div className="notice warn" style={{marginBottom:14}}>Some execution/supporting records could not be loaded completely. 4.4 will not substitute missing measurements or infer an outcome from incomplete data.</div>:null}
    <BusinessVisibilityExecutionPanel
      business={{id:String(businessQ.data.id),name:String(businessQ.data.name)}}
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
