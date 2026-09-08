'use client'

import { FormEvent, useMemo, useState } from 'react'

type R=Record<string,any>
const money=(v:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0)/100)
const pretty=(v:any)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())
const dateTime=(v:any)=>v?new Date(v).toLocaleString():'Not recorded'

export function EstatePlanningLeadDesk({rows}:{rows:R[]}){
  const [busy,setBusy]=useState<string|null>(null)
  const [message,setMessage]=useState('')
  const ordered=useMemo(()=>[...rows].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[rows])

  async function save(e:FormEvent<HTMLFormElement>,leadId:string){
    e.preventDefault();setBusy(leadId);setMessage('')
    const fd=new FormData(e.currentTarget)
    const payload={lead_id:leadId,follow_up_status:String(fd.get('follow_up_status')||''),sale_status:String(fd.get('sale_status')||''),appointment_at:String(fd.get('appointment_at')||''),sale_amount:String(fd.get('sale_amount')||''),owner_notes:String(fd.get('owner_notes')||''),qualification_status:String(fd.get('qualification_status')||''),referral_status:String(fd.get('referral_status')||''),provider_name:String(fd.get('provider_name')||''),provider_state:String(fd.get('provider_state')||''),provider_reference:String(fd.get('provider_reference')||''),qualification_notes:String(fd.get('qualification_notes')||''),referral_notes:String(fd.get('referral_notes')||'')}
    const r=await fetch('/api/admin/estate-planning-leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const body=await r.json().catch(()=>({}))
    if(!r.ok){setMessage(String(body.error||'Unable to update lead.'));setBusy(null);return}
    setMessage(String(body.message||'Estate-planning lead updated.'))
    window.location.reload()
  }

  if(!ordered.length)return <div className="admin-card"><div className="kpi">Estate Planning Lead Desk</div><h2>No estate-planning inquiries yet</h2><p className="muted">New submissions from the nationwide Estate Planning & Trust page will appear here automatically. No demo leads were created.</p></div>

  return <div style={{display:'grid',gap:14}}>
    {message?<div className="notice">{message}</div>:null}
    {ordered.map((lead)=>{
      const details=Array.isArray(lead.lead_project_details)?lead.lead_project_details[0]:lead.lead_project_details
      const sale=Array.isArray(lead.estate_planning_lead_sales)?lead.estate_planning_lead_sales[0]:lead.estate_planning_lead_sales
      const consent=Array.isArray(lead.estate_planning_lead_consents)?lead.estate_planning_lead_consents[0]:lead.estate_planning_lead_consents
      const referral=Array.isArray(lead.estate_planning_lead_referrals)?lead.estate_planning_lead_referrals[0]:lead.estate_planning_lead_referrals
      const answers=details?.answers||{}
      return <details className="admin-card" key={lead.id} open={sale?.follow_up_status==='new'}>
        <summary style={{cursor:'pointer',display:'flex',justifyContent:'space-between',gap:14,alignItems:'center'}}><span><strong>{lead.consumer_name}</strong><span className="small muted" style={{display:'block'}}>{answers.state||''} · {details?.project_type||'Estate Planning'} · {dateTime(lead.created_at)}</span></span><span style={{display:'flex',gap:6,flexWrap:'wrap'}}><span className={`badge ${referral?.qualification_status==='qualified'?'verified':'sponsored'}`}>{pretty(referral?.qualification_status||'new')}</span><span className={`badge ${sale?.follow_up_status==='new'?'sponsored':'verified'}`}>{pretty(sale?.follow_up_status||'new')}</span></span></summary>
        <div className="grid grid-3" style={{marginTop:16}}>
          <section className="card"><div className="kpi">Contact</div><div className="info-row"><span>Phone</span><strong><a href={`tel:${lead.phone}`}>{lead.phone}</a></strong></div><div className="info-row"><span>Email</span><strong><a href={`mailto:${lead.email}`}>{lead.email}</a></strong></div><div className="info-row"><span>Location</span><strong>{lead.city}, {answers.state||''} {details?.zip_code||''}</strong></div><div className="info-row"><span>Preferred contact</span><strong>{details?.preferred_contact||'Not specified'}</strong></div><div className="info-row"><span>Timeline</span><strong>{lead.timeline||'Not specified'}</strong></div></section>
          <section className="card"><div className="kpi">Planning Context</div><div className="info-row"><span>Primary need</span><strong>{details?.project_type||'Not specified'}</strong></div><div className="info-row"><span>Existing plan</span><strong>{answers.existing_plan||'Not specified'}</strong></div><div className="info-row"><span>Family context</span><strong>{answers.family_context||'Not specified'}</strong></div><div className="info-row"><span>Business owner</span><strong>{answers.business_owner?'Yes':'No'}</strong></div><div className="info-row"><span>Real-estate owner</span><strong>{answers.real_estate_owner?'Yes':'No'}</strong></div></section>
          <section className="card"><div className="kpi">Consent & Attribution</div><div className="info-row"><span>Consent version</span><strong>{consent?.consent_version||lead.consent_disclosure_version||'Not recorded'}</strong></div><div className="info-row"><span>Recorded</span><strong>{dateTime(consent?.recorded_at||lead.consent_recorded_at)}</strong></div><div className="info-row"><span>Source page</span><strong>{consent?.source_page||'Not recorded'}</strong></div><div className="info-row"><span>UTM source</span><strong>{consent?.utm_source||'Direct / not tagged'}</strong></div><div className="info-row"><span>Campaign</span><strong>{consent?.utm_campaign||'Not tagged'}</strong></div><details><summary className="small">View exact consent text</summary><p className="small muted">{consent?.contact_consent_text||'Exact contact consent text not available for this record.'}</p><p className="small muted">{consent?.referral_consent_text||'Exact referral consent text not available for this record.'}</p></details></section>
        </div>
        {lead.message?<div className="notice" style={{marginTop:12}}><strong>Prospect note:</strong> {lead.message}</div>:null}
        <form onSubmit={e=>void save(e,lead.id)} style={{display:'grid',gap:12,marginTop:14}}>
          <div className="grid grid-3">
            <label className="field"><span>Qualification</span><select name="qualification_status" defaultValue={referral?.qualification_status||'new'}><option value="new">New</option><option value="reviewing">Reviewing</option><option value="qualified">Qualified</option><option value="not_qualified">Not Qualified</option></select></label>
            <label className="field"><span>Referral status</span><select name="referral_status" defaultValue={referral?.referral_status||'unassigned'}><option value="unassigned">Unassigned</option><option value="pending_review">Pending Review</option><option value="approved_for_referral">Approved for Referral</option><option value="referred">Referred</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="closed">Closed</option></select></label>
            <label className="field"><span>Provider / law firm</span><input name="provider_name" maxLength={240} defaultValue={referral?.provider_name||''} placeholder="Only after an eligible provider is identified"/></label>
            <label className="field"><span>Provider state</span><input name="provider_state" maxLength={2} defaultValue={referral?.provider_state||''} placeholder="IL"/></label>
            <label className="field" style={{gridColumn:'span 2'}}><span>Provider reference</span><input name="provider_reference" maxLength={500} defaultValue={referral?.provider_reference||''} placeholder="Internal relationship, CRM, or agreement reference"/></label>
            <label className="field" style={{gridColumn:'span 3'}}><span>Qualification notes</span><textarea name="qualification_notes" rows={2} defaultValue={referral?.qualification_notes||''} placeholder="Why this inquiry is or is not qualified…"/></label>
            <label className="field" style={{gridColumn:'span 3'}}><span>Referral notes</span><textarea name="referral_notes" rows={2} defaultValue={referral?.referral_notes||''} placeholder="Provider fit, licensing/coverage review, manual referral notes…"/></label>
          </div>
          <div className="notice"><strong>Referral control:</strong> Recording a provider or referral status here is tracking only. It does not transmit consumer data or notify the provider.</div>
          <div className="grid grid-3">
            <label className="field"><span>Follow-up status</span><select name="follow_up_status" defaultValue={sale?.follow_up_status||'new'}><option value="new">New</option><option value="attempted_contact">Attempted Contact</option><option value="contacted">Contacted</option><option value="appointment_scheduled">Appointment Scheduled</option><option value="appointment_completed">Appointment Completed</option><option value="not_reached">Not Reached</option><option value="not_qualified">Not Qualified</option><option value="closed">Closed</option></select></label>
            <label className="field"><span>Appointment</span><input name="appointment_at" type="datetime-local" defaultValue={sale?.appointment_at?String(sale.appointment_at).slice(0,16):''}/></label>
            <label className="field"><span>Lead sale status</span><select name="sale_status" defaultValue={sale?.sale_status||'not_delivered'}><option value="not_delivered">Not Delivered</option><option value="delivered">Delivered</option><option value="sold">Sold</option><option value="not_sold">Not Sold</option><option value="invalid">Invalid</option></select></label>
            <label className="field"><span>Sale amount ($)</span><input name="sale_amount" type="number" min="0" step="0.01" defaultValue={sale?.sale_amount_cents!=null?Number(sale.sale_amount_cents)/100:''} placeholder="Only if recorded"/></label>
            <label className="field" style={{gridColumn:'span 2'}}><span>Owner notes</span><textarea name="owner_notes" rows={2} defaultValue={sale?.owner_notes||''} placeholder="Call outcome, appointment details, qualification notes…"/></label>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><button className="btn btn-primary" disabled={busy===lead.id}>{busy===lead.id?'Saving…':'Save Lead Update'}</button>{sale?.sale_amount_cents!=null?<span className="badge verified">Recorded sale: {money(sale.sale_amount_cents)}</span>:null}</div>
          <p className="small muted">Saving these records does not email a provider, transmit the lead, create an invoice, charge anyone, or automatically mark a lead delivered or sold. Those remain explicit owner-controlled actions.</p>
        </form>
      </details>
    })}
  </div>
}
