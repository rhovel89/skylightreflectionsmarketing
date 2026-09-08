import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { EstatePlanningLeadDesk } from '@/components/EstatePlanningLeadDesk'

export const dynamic='force-dynamic'

export default async function Page(){
  const s=await createClient()
  const {data:rows,error}=await s.from('leads').select('id,consumer_name,phone,email,city,message,timeline,status,source,consent_disclosure_version,consent_recorded_at,created_at,lead_project_details(project_type,property_type,zip_code,preferred_contact,answers),estate_planning_lead_sales(id,follow_up_status,appointment_at,owner_notes,last_contact_at,created_at,updated_at),estate_planning_lead_consents(consent_version,contact_consent_text,referral_consent_text,source_page,landing_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,recorded_at),estate_planning_lead_referrals(id,qualification_status,qualification_notes,updated_at)').eq('tenant_id',TENANT_ID).eq('source','estate_planning_nationwide').order('created_at',{ascending:false}).limit(500)
  const list=(rows??[]) as any[]
  const tracking=list.map(r=>Array.isArray(r.estate_planning_lead_sales)?r.estate_planning_lead_sales[0]:r.estate_planning_lead_sales).filter(Boolean)
  const qualifications=list.map(r=>Array.isArray(r.estate_planning_lead_referrals)?r.estate_planning_lead_referrals[0]:r.estate_planning_lead_referrals).filter(Boolean)
  const bookedStatuses=new Set(['appointment_scheduled','appointment_confirmed','appointment_completed'])
  const counts={
    new:tracking.filter(x=>x.follow_up_status==='new').length,
    qualified:qualifications.filter(x=>x.qualification_status==='qualified').length,
    booked:tracking.filter(x=>bookedStatuses.has(String(x.follow_up_status))).length,
    completed:tracking.filter(x=>x.follow_up_status==='appointment_completed').length,
    noShow:tracking.filter(x=>x.follow_up_status==='no_show').length,
  }
  return <>
    <div className="admin-page-head"><div><div className="kpi">Estate Planning Appointment Program</div><h1>Qualification & Appointment Desk</h1><p className="muted">Your workflow is simple: review the qualifying answers, contact the prospect, determine whether they qualify, and book the attorney's appointment.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btn-light" href="/admin/estate-planning-performance">Appointment Funnel</Link><span className="badge verified">Owner Controlled</span></div></div>
    <div className="stat-grid" style={{marginBottom:18}}>
      <div className="stat"><span>New</span><strong>{counts.new}</strong><small>Not yet worked</small></div>
      <div className="stat"><span>Qualified</span><strong>{counts.qualified}</strong><small>Meets your appointment criteria</small></div>
      <div className="stat"><span>Booked</span><strong>{counts.booked}</strong><small>Scheduled / confirmed / completed</small></div>
      <div className="stat"><span>Completed</span><strong>{counts.completed}</strong><small>Attorney consultation completed</small></div>
      <div className="stat"><span>No Show</span><strong>{counts.noShow}</strong><small>Appointment outcome tracking</small></div>
    </div>
    <div className="grid grid-2" style={{marginBottom:18}}><div className="admin-card"><div className="kpi">Your Role</div><h2>Qualify the prospect</h2><p className="small muted">Review only the preliminary questions needed to determine whether the person is appropriate for an appointment. Skylight does not provide legal advice or collect legal documents for the attorney.</p></div><div className="admin-card"><div className="kpi">Then Book</div><h2>Coordinate the attorney appointment</h2><p className="small muted">Track contact attempts, appointment date/time, confirmation, completion, cancellation or no-show. There is no provider network, provider onboarding, automatic routing, lead sale, or automatic billing in this workflow.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btn-primary" href="/estate-planning" target="_blank">View Public Form</Link></div></div></div>
    {error?<div className="notice warn">{error.message}</div>:<EstatePlanningLeadDesk rows={list}/>} 
  </>
}
