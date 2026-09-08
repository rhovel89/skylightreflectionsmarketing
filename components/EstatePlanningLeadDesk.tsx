'use client'

import { FormEvent, useMemo, useState } from 'react'

type R=Record<string,any>
const pretty=(v:any)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())
const dateTime=(v:any)=>v?new Date(v).toLocaleString():'Not recorded'

export function EstatePlanningLeadDesk({rows}:{rows:R[]}){
  const [busy,setBusy]=useState<string|null>(null)
  const [message,setMessage]=useState('')
  const ordered=useMemo(()=>[...rows].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[rows])

  async function save(e:FormEvent<HTMLFormElement>,leadId:string){
    e.preventDefault();setBusy(leadId);setMessage('')
    const fd=new FormData(e.currentTarget)
    const payload={lead_id:leadId,action:'save',follow_up_status:String(fd.get('follow_up_status')||''),appointment_at:String(fd.get('appointment_at')||''),owner_notes:String(fd.get('owner_notes')||''),qualification_status:String(fd.get('qualification_status')||''),qualification_notes:String(fd.get('qualification_notes')||'')}
    const r=await fetch('/api/admin/estate-planning-leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const body=await r.json().catch(()=>({}))
    if(!r.ok){setMessage(String(body.error||'Unable to update inquiry.'));setBusy(null);return}
    setMessage(String(body.message||'Estate Planning appointment record updated.'))
    window.location.reload()
  }

  if(!ordered.length)return <div className="admin-card"><div className="kpi">Estate Planning Appointment Desk</div><h2>No inquiries yet</h2><p className="muted">New Estate Planning consultation requests will appear here automatically. No demo leads were created.</p></div>

  return <div style={{display:'grid',gap:14}}>
    {message?<div className="notice">{message}</div>:null}
    {ordered.map((lead)=>{
      const details=Array.isArray(lead.lead_project_details)?lead.lead_project_details[0]:lead.lead_project_details
      const tracking=Array.isArray(lead.estate_planning_lead_sales)?lead.estate_planning_lead_sales[0]:lead.estate_planning_lead_sales
      const consent=Array.isArray(lead.estate_planning_lead_consents)?lead.estate_planning_lead_consents[0]:lead.estate_planning_lead_consents
      const qualification=Array.isArray(lead.estate_planning_lead_referrals)?lead.estate_planning_lead_referrals[0]:lead.estate_planning_lead_referrals
      const answers=details?.answers||{},state=String(answers.state||'').toUpperCase()
      return <details className="admin-card" key={lead.id} open={tracking?.follow_up_status==='new'}>
        <summary style={{cursor:'pointer',display:'flex',justifyContent:'space-between',gap:14,alignItems:'center'}}><span><strong>{lead.consumer_name}</strong><span className="small muted" style={{display:'block'}}>{state||'State missing'} · {details?.project_type||'Estate Planning'} · {dateTime(lead.created_at)}</span></span><span style={{display:'flex',gap:6,flexWrap:'wrap'}}><span className={`badge ${qualification?.qualification_status==='qualified'?'verified':'sponsored'}`}>{pretty(qualification?.qualification_status||'new')}</span><span className={`badge ${tracking?.follow_up_status==='new'?'sponsored':'verified'}`}>{pretty(tracking?.follow_up_status||'new')}</span></span></summary>

        <div className="grid grid-3" style={{marginTop:16}}>
          <section className="card"><div className="kpi">Contact</div><div className="info-row"><span>Phone</span><strong><a href={`tel:${lead.phone}`}>{lead.phone}</a></strong></div><div className="info-row"><span>Email</span><strong><a href={`mailto:${lead.email}`}>{lead.email}</a></strong></div><div className="info-row"><span>Location</span><strong>{lead.city}, {state} {details?.zip_code||''}</strong></div><div className="info-row"><span>Preferred contact</span><strong>{details?.preferred_contact||'Not specified'}</strong></div><div className="info-row"><span>Desired timing</span><strong>{lead.timeline||'Not specified'}</strong></div></section>
          <section className="card"><div className="kpi">Qualifying Answers</div><div className="info-row"><span>Primary need</span><strong>{details?.project_type||'Not specified'}</strong></div><div className="info-row"><span>Existing will/trust</span><strong>{answers.existing_plan||'Not specified'}</strong></div><div className="info-row"><span>Family context</span><strong>{answers.family_context||'Not specified'}</strong></div><div className="info-row"><span>Business owner</span><strong>{answers.business_owner?'Yes':'No'}</strong></div><div className="info-row"><span>Real-estate owner</span><strong>{answers.real_estate_owner?'Yes':'No'}</strong></div></section>
          <section className="card"><div className="kpi">Consent & Source</div><div className="info-row"><span>Consent version</span><strong>{consent?.consent_version||lead.consent_disclosure_version||'Not recorded'}</strong></div><div className="info-row"><span>Recorded</span><strong>{dateTime(consent?.recorded_at||lead.consent_recorded_at)}</strong></div><div className="info-row"><span>UTM source</span><strong>{consent?.utm_source||'Direct / not tagged'}</strong></div><div className="info-row"><span>Campaign</span><strong>{consent?.utm_campaign||'Not tagged'}</strong></div><details><summary className="small">View exact consent text</summary><p className="small muted">{consent?.contact_consent_text||'Contact consent text not available.'}</p><p className="small muted">{consent?.referral_consent_text||'Appointment-sharing consent text not available.'}</p></details></section>
        </div>

        {lead.message?<div className="notice" style={{marginTop:12}}><strong>Prospect note:</strong> {lead.message}</div>:null}

        <form onSubmit={e=>void save(e,lead.id)} style={{display:'grid',gap:12,marginTop:14}}>
          <div className="kpi">Qualification & Appointment Tracking</div>
          <div className="grid grid-3">
            <label className="field"><span>Qualification</span><select name="qualification_status" defaultValue={qualification?.qualification_status||'new'}><option value="new">New</option><option value="reviewing">Reviewing</option><option value="qualified">Qualified</option><option value="not_qualified">Not Qualified</option></select></label>
            <label className="field" style={{gridColumn:'span 2'}}><span>Qualification notes</span><textarea name="qualification_notes" rows={2} defaultValue={qualification?.qualification_notes||''} placeholder="Why the inquiry qualifies, or why it does not…"/></label>
          </div>
          <div className="grid grid-3">
            <label className="field"><span>Follow-up / appointment status</span><select name="follow_up_status" defaultValue={tracking?.follow_up_status||'new'}><option value="new">New</option><option value="attempted_contact">Attempted Contact</option><option value="contacted">Contacted</option><option value="appointment_scheduled">Appointment Scheduled</option><option value="appointment_confirmed">Appointment Confirmed</option><option value="appointment_completed">Appointment Completed</option><option value="no_show">No Show</option><option value="canceled">Canceled</option><option value="not_reached">Not Reached</option><option value="not_qualified">Not Qualified</option><option value="closed">Closed</option></select></label>
            <label className="field"><span>Appointment date & time</span><input name="appointment_at" type="datetime-local" defaultValue={tracking?.appointment_at?String(tracking.appointment_at).slice(0,16):''}/></label>
            <label className="field"><span>Call / appointment notes</span><textarea name="owner_notes" rows={2} defaultValue={tracking?.owner_notes||''} placeholder="Contact outcome, appointment details, confirmation notes…"/></label>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><button className="btn btn-primary" disabled={busy===lead.id}>{busy===lead.id?'Saving…':'Save Qualification / Appointment'}</button>{tracking?.appointment_at?<span className="badge verified">Appointment: {dateTime(tracking.appointment_at)}</span>:null}</div>
          <p className="small muted">This workspace is for preliminary qualification and appointment setting only. It does not onboard the lawyer, collect lawyer documents, route providers, sell the lead, create an invoice, or automatically bill anyone.</p>
        </form>
      </details>
    })}
  </div>
}
