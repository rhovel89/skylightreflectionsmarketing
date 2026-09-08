import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { EstatePlanningLeadDesk } from '@/components/EstatePlanningLeadDesk'

export const dynamic='force-dynamic'

export default async function Page(){
  const s=await createClient()
  const {data:rows,error}=await s.from('leads').select('id,consumer_name,phone,email,city,message,timeline,status,source,created_at,lead_project_details(project_type,property_type,zip_code,preferred_contact,answers),estate_planning_lead_sales(id,buyer_name,buyer_url,follow_up_status,sale_status,appointment_at,delivered_at,sold_at,sale_amount_cents,owner_notes,last_contact_at,created_at,updated_at)').eq('tenant_id',TENANT_ID).eq('source','estate_planning_nationwide').order('created_at',{ascending:false}).limit(500)
  const list=(rows??[]) as any[]
  const sales=list.map(r=>Array.isArray(r.estate_planning_lead_sales)?r.estate_planning_lead_sales[0]:r.estate_planning_lead_sales).filter(Boolean)
  const counts={
    new:sales.filter(x=>x.follow_up_status==='new').length,
    contacted:sales.filter(x=>['attempted_contact','contacted'].includes(String(x.follow_up_status))).length,
    appointments:sales.filter(x=>x.follow_up_status==='appointment_scheduled').length,
    sold:sales.filter(x=>x.sale_status==='sold').length,
  }
  const recordedRevenue=sales.filter(x=>x.sale_status==='sold').reduce((n,x)=>n+Number(x.sale_amount_cents||0),0)
  return <>
    <div className="admin-page-head"><div><div className="kpi">Nationwide Lead Program</div><h1>Estate Planning Leads</h1><p className="muted">Private owner queue for Estate Planning & Trust inquiries intended for consultation follow-up and potential manual delivery to a participating estate-planning provider. Public directory ranking, Sponsored placement and generic Local Pros matching do not control this queue.</p></div><span className="badge verified">Owner Controlled</span></div>
    <div className="stat-grid" style={{marginBottom:18}}>
      <div className="stat"><span>New</span><strong>{counts.new}</strong><small>Not yet worked</small></div>
      <div className="stat"><span>Contact Activity</span><strong>{counts.contacted}</strong><small>Attempted or reached</small></div>
      <div className="stat"><span>Appointments Scheduled</span><strong>{counts.appointments}</strong><small>Recorded consultation appointments</small></div>
      <div className="stat"><span>Leads Sold</span><strong>{counts.sold}</strong><small>{recordedRevenue?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(recordedRevenue/100)+' recorded':'No sale revenue recorded yet'}</small></div>
    </div>
    <div className="grid grid-2" style={{marginBottom:18}}><div className="admin-card"><div className="kpi">Owner Workflow</div><h2>Inquiry → contact → appointment → lead sale</h2><p className="small muted">Use this desk to track your actual follow-up and appointment-setting work. Marking a lead Delivered or Sold is a manual owner record only; it does not send data, invoice a referral partner or charge anyone automatically.</p></div><div className="admin-card"><div className="kpi">Public Funnel</div><h2>Estate Planning & Trust</h2><p className="small muted">The public page is built for nationwide estate-planning search intent and contains provider-neutral consent and legal-services disclosures.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btn-primary" href="/estate-planning" target="_blank">View Public Funnel</Link></div></div></div>
    {error?<div className="notice warn">{error.message}</div>:<EstatePlanningLeadDesk rows={list}/>} 
  </>
}
