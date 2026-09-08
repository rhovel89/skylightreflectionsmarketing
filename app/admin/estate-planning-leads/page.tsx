import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { EstatePlanningLeadDesk } from '@/components/EstatePlanningLeadDesk'

export const dynamic='force-dynamic'

export default async function Page(){
  const s=await createClient()
  const [{data:rows,error},{data:providers}]=await Promise.all([
    s.from('leads').select('id,consumer_name,phone,email,city,message,timeline,status,source,consent_disclosure_version,consent_recorded_at,created_at,lead_project_details(project_type,property_type,zip_code,preferred_contact,answers),estate_planning_lead_sales(id,buyer_name,buyer_url,follow_up_status,sale_status,appointment_at,delivered_at,sold_at,sale_amount_cents,owner_notes,last_contact_at,created_at,updated_at),estate_planning_lead_consents(consent_version,contact_consent_text,referral_consent_text,source_page,landing_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,recorded_at),estate_planning_lead_referrals(id,qualification_status,referral_status,provider_id,provider_name,provider_state,provider_reference,qualification_notes,referral_notes,assigned_at,referred_at,provider_responded_at,updated_at),estate_planning_referral_events(id,event_type,provider_id,transmission_method,external_reference,notes,data_snapshot,occurred_at)').eq('tenant_id',TENANT_ID).eq('source','estate_planning_nationwide').order('created_at',{ascending:false}).limit(500),
    s.from('estate_planning_providers').select('id,display_name,provider_type,onboarding_status,operating_status,verification_status,capacity_limit,external_reference,estate_planning_provider_states(id,state_code,coverage_status,verification_status,verification_reference,referral_capacity,notes)').eq('tenant_id',TENANT_ID).order('display_name',{ascending:true})
  ])
  const list=(rows??[]) as any[]
  const sales=list.map(r=>Array.isArray(r.estate_planning_lead_sales)?r.estate_planning_lead_sales[0]:r.estate_planning_lead_sales).filter(Boolean)
  const referrals=list.map(r=>Array.isArray(r.estate_planning_lead_referrals)?r.estate_planning_lead_referrals[0]:r.estate_planning_lead_referrals).filter(Boolean)
  const events=list.flatMap(r=>Array.isArray(r.estate_planning_referral_events)?r.estate_planning_referral_events:[])
  const counts={new:sales.filter(x=>x.follow_up_status==='new').length,qualified:referrals.filter(x=>x.qualification_status==='qualified').length,appointments:sales.filter(x=>x.follow_up_status==='appointment_scheduled').length,prepared:events.filter(x=>x.event_type==='handoff_prepared').length,referred:referrals.filter(x=>['referred','accepted'].includes(String(x.referral_status))).length,sold:sales.filter(x=>x.sale_status==='sold').length}
  const recordedRevenue=sales.filter(x=>x.sale_status==='sold').reduce((n,x)=>n+Number(x.sale_amount_cents||0),0)
  return <>
    <div className="admin-page-head"><div><div className="kpi">Nationwide Lead Program</div><h1>Estate Planning Leads</h1><p className="muted">Private owner queue. Qualification, provider eligibility, assignment, handoff preparation, manual referral recording, delivery, sale and revenue remain separate controlled records.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btn-light" href="/admin/estate-planning-providers">Provider Network</Link><span className="badge verified">Owner Controlled</span></div></div>
    <div className="stat-grid" style={{marginBottom:18}}>
      <div className="stat"><span>New</span><strong>{counts.new}</strong><small>Not yet worked</small></div>
      <div className="stat"><span>Qualified</span><strong>{counts.qualified}</strong><small>Owner-reviewed inquiries</small></div>
      <div className="stat"><span>Appointments</span><strong>{counts.appointments}</strong><small>Scheduled consultations</small></div>
      <div className="stat"><span>Prepared</span><strong>{counts.prepared}</strong><small>Private handoff snapshots</small></div>
      <div className="stat"><span>Referred</span><strong>{counts.referred}</strong><small>Manual handoffs recorded</small></div>
      <div className="stat"><span>Sold</span><strong>{counts.sold}</strong><small>{recordedRevenue?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(recordedRevenue/100)+' recorded':'No sale revenue recorded yet'}</small></div>
    </div>
    <div className="grid grid-2" style={{marginBottom:18}}><div className="admin-card"><div className="kpi">Controlled Workflow</div><h2>Qualify → eligible provider → assign → prepare → manually hand off → outcome</h2><p className="small muted">The provider gate checks approved active relationship status, matching state coverage, reviewed state evidence and configured capacity. No provider is selected automatically.</p></div><div className="admin-card"><div className="kpi">Transmission Boundary</div><h2>Preparation is not transmission</h2><p className="small muted">Preparing a handoff freezes the exact private data/consent snapshot for review. “Record manual handoff” only documents a handoff staff says already occurred; the site itself does not send consumer data to the provider.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btn-primary" href="/estate-planning" target="_blank">View Public Funnel</Link></div></div></div>
    {error?<div className="notice warn">{error.message}</div>:<EstatePlanningLeadDesk rows={list} providers={(providers??[]) as any[]}/>} 
  </>
}
