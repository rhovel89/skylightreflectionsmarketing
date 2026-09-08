'use client'

import { FormEvent, useMemo, useState } from 'react'

type R=Record<string,any>
const money=(v:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0)/100)
const pretty=(v:any)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())
const dateTime=(v:any)=>v?new Date(v).toLocaleString():'Not recorded'

export function EstatePlanningLeadDesk({rows,providers}:{rows:R[];providers:R[]}){
  const [busy,setBusy]=useState<string|null>(null)
  const [message,setMessage]=useState('')
  const ordered=useMemo(()=>[...rows].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[rows])

  async function post(leadId:string,action:string,payload:R={},key=action){
    setBusy(`${leadId}:${key}`);setMessage('')
    const r=await fetch('/api/admin/estate-planning-leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lead_id:leadId,action,...payload})})
    const body=await r.json().catch(()=>({}))
    if(!r.ok){setMessage(String(body.error||'Unable to update lead.'));setBusy(null);return}
    setMessage(String(body.message||'Estate Planning lead updated.'));window.location.reload()
  }

  function save(e:FormEvent<HTMLFormElement>,leadId:string){
    e.preventDefault();const fd=new FormData(e.currentTarget)
    void post(leadId,'save',{follow_up_status:String(fd.get('follow_up_status')||''),sale_status:String(fd.get('sale_status')||''),appointment_at:String(fd.get('appointment_at')||''),sale_amount:String(fd.get('sale_amount')||''),owner_notes:String(fd.get('owner_notes')||''),qualification_status:String(fd.get('qualification_status')||''),qualification_notes:String(fd.get('qualification_notes')||''),referral_notes:String(fd.get('referral_notes')||'')},'save')
  }

  if(!ordered.length)return <div className="admin-card"><div className="kpi">Estate Planning Lead Desk</div><h2>No Estate Planning inquiries yet</h2><p className="muted">New submissions from the nationwide Estate Planning & Trust page will appear here automatically. No demo leads were created.</p></div>

  return <div style={{display:'grid',gap:14}}>
    {message?<div className="notice">{message}</div>:null}
    {ordered.map((lead)=>{
      const details=Array.isArray(lead.lead_project_details)?lead.lead_project_details[0]:lead.lead_project_details
      const sale=Array.isArray(lead.estate_planning_lead_sales)?lead.estate_planning_lead_sales[0]:lead.estate_planning_lead_sales
      const consent=Array.isArray(lead.estate_planning_lead_consents)?lead.estate_planning_lead_consents[0]:lead.estate_planning_lead_consents
      const referral=Array.isArray(lead.estate_planning_lead_referrals)?lead.estate_planning_lead_referrals[0]:lead.estate_planning_lead_referrals
      const answers=details?.answers||{},state=String(answers.state||'').toUpperCase()
      const events=(Array.isArray(lead.estate_planning_referral_events)?lead.estate_planning_referral_events:[]).sort((a:R,b:R)=>new Date(b.occurred_at).getTime()-new Date(a.occurred_at).getTime())
      const eligible=providers.filter((p:R)=>p.onboarding_status==='approved'&&p.operating_status==='active'&&(Array.isArray(p.estate_planning_provider_states)?p.estate_planning_provider_states:[]).some((x:R)=>x.state_code===state&&x.coverage_status==='approved'&&x.verification_status==='reviewed'&&x.verification_reference))
      const assigned=providers.find((p:R)=>p.id===referral?.provider_id)
      const prepared=events.find((x:R)=>x.event_type==='handoff_prepared')
      const handed=events.find((x:R)=>x.event_type==='handoff_recorded')
      const snapshot=prepared?.data_snapshot||{}
      return <details className="admin-card" key={lead.id} open={sale?.follow_up_status==='new'}>
        <summary style={{cursor:'pointer',display:'flex',justifyContent:'space-between',gap:14,alignItems:'center'}}><span><strong>{lead.consumer_name}</strong><span className="small muted" style={{display:'block'}}>{state||'State missing'} · {details?.project_type||'Estate Planning'} · {dateTime(lead.created_at)}</span></span><span style={{display:'flex',gap:6,flexWrap:'wrap'}}><span className={`badge ${referral?.qualification_status==='qualified'?'verified':'sponsored'}`}>{pretty(referral?.qualification_status||'new')}</span><span className="badge">{pretty(referral?.referral_status||'unassigned')}</span><span className={`badge ${sale?.follow_up_status==='new'?'sponsored':'verified'}`}>{pretty(sale?.follow_up_status||'new')}</span></span></summary>

        <div className="grid grid-3" style={{marginTop:16}}>
          <section className="card"><div className="kpi">Contact</div><div className="info-row"><span>Phone</span><strong><a href={`tel:${lead.phone}`}>{lead.phone}</a></strong></div><div className="info-row"><span>Email</span><strong><a href={`mailto:${lead.email}`}>{lead.email}</a></strong></div><div className="info-row"><span>Location</span><strong>{lead.city}, {state} {details?.zip_code||''}</strong></div><div className="info-row"><span>Preferred contact</span><strong>{details?.preferred_contact||'Not specified'}</strong></div><div className="info-row"><span>Timeline</span><strong>{lead.timeline||'Not specified'}</strong></div></section>
          <section className="card"><div className="kpi">Planning Context</div><div className="info-row"><span>Primary need</span><strong>{details?.project_type||'Not specified'}</strong></div><div className="info-row"><span>Existing plan</span><strong>{answers.existing_plan||'Not specified'}</strong></div><div className="info-row"><span>Family context</span><strong>{answers.family_context||'Not specified'}</strong></div><div className="info-row"><span>Business owner</span><strong>{answers.business_owner?'Yes':'No'}</strong></div><div className="info-row"><span>Real-estate owner</span><strong>{answers.real_estate_owner?'Yes':'No'}</strong></div></section>
          <section className="card"><div className="kpi">Consent & Attribution</div><div className="info-row"><span>Consent version</span><strong>{consent?.consent_version||lead.consent_disclosure_version||'Not recorded'}</strong></div><div className="info-row"><span>Recorded</span><strong>{dateTime(consent?.recorded_at||lead.consent_recorded_at)}</strong></div><div className="info-row"><span>Source page</span><strong>{consent?.source_page||'Not recorded'}</strong></div><div className="info-row"><span>UTM source</span><strong>{consent?.utm_source||'Direct / not tagged'}</strong></div><div className="info-row"><span>Campaign</span><strong>{consent?.utm_campaign||'Not tagged'}</strong></div><details><summary className="small">View exact consent text</summary><p className="small muted">{consent?.contact_consent_text||'Exact contact consent text not available for this record.'}</p><p className="small muted">{consent?.referral_consent_text||'Exact referral consent text not available for this record.'}</p></details></section>
        </div>
        {lead.message?<div className="notice" style={{marginTop:12}}><strong>Prospect note:</strong> {lead.message}</div>:null}

        <section className="admin-card" style={{marginTop:14}}>
          <div className="kpi">Controlled Provider Referral</div><h3>Eligibility and handoff</h3>
          <div className="grid grid-3">
            <div className="stat"><span>Lead state</span><strong>{state||'Missing'}</strong><small>State-specific gate</small></div>
            <div className="stat"><span>Eligible candidates</span><strong>{eligible.length}</strong><small>Approved + active + reviewed state evidence</small></div>
            <div className="stat"><span>Referral status</span><strong style={{fontSize:18}}>{pretty(referral?.referral_status||'unassigned')}</strong><small>{assigned?assigned.display_name:'No provider assigned'}</small></div>
          </div>
          {!referral?.provider_id?<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void post(lead.id,'assign_provider',{provider_id:f.get('provider_id'),notes:f.get('notes')},'assign')}} style={{display:'grid',gap:8,marginTop:12}}>
            <div className="grid grid-2"><label className="field"><span>Eligible provider candidate</span><select name="provider_id" required defaultValue=""><option value="" disabled>Select provider</option>{eligible.map((p:R)=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label><label className="field"><span>Assignment notes</span><input name="notes" maxLength={4000} placeholder="Why this provider is the right manual review candidate…"/></label></div>
            {referral?.qualification_status!=='qualified'?<div className="notice warn">Save this lead as <strong>Qualified</strong> before assigning a provider.</div>:eligible.length===0?<div className="notice warn">No assignment-ready provider is configured for {state||'this state'}. Add real provider coverage and reviewed evidence in the Provider Network.</div>:null}
            <div><button className="btn btn-primary" disabled={referral?.qualification_status!=='qualified'||eligible.length===0||busy===`${lead.id}:assign`}>{busy===`${lead.id}:assign`?'Assigning…':'Assign Provider for Review'}</button></div>
          </form>:<div style={{marginTop:12,display:'grid',gap:10}}>
            <div className="notice"><strong>Assigned:</strong> {assigned?.display_name||referral.provider_name} for {referral.provider_state||state}. Assignment is internal only; no consumer data was sent.</div>
            {referral.referral_status==='pending_review'?<div style={{display:'grid',gap:8}}><div className="small muted">Preparing freezes the exact consumer/request/consent snapshot for final staff review. It still sends nothing.</div><button className="btn btn-primary" disabled={busy===`${lead.id}:prepare`} onClick={()=>void post(lead.id,'prepare_handoff',{notes:'Prepared after provider eligibility and consent review.'},'prepare')}>{busy===`${lead.id}:prepare`?'Preparing…':'Prepare Private Handoff Snapshot'}</button></div>:null}
            {referral.referral_status==='approved_for_referral'?<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void post(lead.id,'record_handoff',{transmission_method:f.get('transmission_method'),external_reference:f.get('external_reference'),notes:f.get('handoff_notes')},'handoff')}} style={{display:'grid',gap:8}}>
              <div className="notice warn"><strong>Attestation step:</strong> Use this only after you have actually shared the approved snapshot with the assigned provider outside this site. This button does not send it.</div>
              <div className="grid grid-3"><label className="field"><span>Manual handoff method</span><select name="transmission_method" required defaultValue="manual_email"><option value="manual_email">Manual Email</option><option value="manual_phone">Manual Phone</option><option value="secure_portal">Secure Portal</option><option value="other">Other</option></select></label><label className="field"><span>External reference</span><input name="external_reference" maxLength={1000} placeholder="Message/thread/portal reference"/></label><label className="field"><span>Handoff notes</span><input name="handoff_notes" maxLength={4000}/></label></div>
              <div><button className="btn btn-primary" disabled={busy===`${lead.id}:handoff`}>{busy===`${lead.id}:handoff`?'Recording…':'Record Manual Handoff Already Completed'}</button></div>
            </form>:null}
            {referral.referral_status==='referred'?<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn btn-light" disabled={busy===`${lead.id}:response`} onClick={()=>void post(lead.id,'provider_response',{response:'accepted',notes:'Provider acceptance recorded by staff.'},'response')}>Record Accepted</button><button className="btn btn-light" disabled={busy===`${lead.id}:response`} onClick={()=>void post(lead.id,'provider_response',{response:'declined',notes:'Provider decline recorded by staff.'},'response')}>Record Declined</button></div>:null}
            {!['referred','accepted'].includes(String(referral.referral_status))?<button className="btn btn-light" disabled={busy===`${lead.id}:clear`} onClick={()=>void post(lead.id,'clear_provider',{notes:'Assignment cleared by staff.'},'clear')}>Clear Provider Assignment</button>:null}
          </div>}
          {prepared?<details style={{marginTop:12}}><summary className="small"><strong>Review prepared handoff snapshot</strong></summary><div className="card" style={{marginTop:8}}><div className="info-row"><span>Consumer</span><strong>{snapshot.consumer_name||lead.consumer_name}</strong></div><div className="info-row"><span>Contact</span><strong>{snapshot.phone||lead.phone} · {snapshot.email||lead.email}</strong></div><div className="info-row"><span>Location</span><strong>{snapshot.city||lead.city}, {snapshot.state||state} {snapshot.zip_code||details?.zip_code||''}</strong></div><div className="info-row"><span>Planning need</span><strong>{snapshot.primary_need||details?.project_type||'Not specified'}</strong></div><div className="info-row"><span>Consent version</span><strong>{snapshot.consent_version||'Not recorded'}</strong></div><p className="small muted"><strong>Referral consent:</strong> {snapshot.referral_consent_text||'Not recorded in snapshot.'}</p><p className="small muted">Prepared {dateTime(prepared.occurred_at)}. This snapshot is private and immutable as an event record.</p></div></details>:null}
          {handed?<p className="small muted" style={{marginTop:10}}>Latest recorded manual handoff: {dateTime(handed.occurred_at)} · {pretty(handed.transmission_method)}{handed.external_reference?` · ${handed.external_reference}`:''}</p>:null}
          {events.length?<details style={{marginTop:10}}><summary className="small">Referral event history ({events.length})</summary><div style={{display:'grid',gap:6,marginTop:8}}>{events.map((x:R)=><div className="info-row" key={x.id}><span>{dateTime(x.occurred_at)}</span><strong>{pretty(x.event_type)}{x.notes?` · ${x.notes}`:''}</strong></div>)}</div></details>:null}
        </section>

        <form onSubmit={e=>save(e,lead.id)} style={{display:'grid',gap:12,marginTop:14}}>
          <div className="kpi">Lead Qualification & Commercial Tracking</div>
          <div className="grid grid-3">
            <label className="field"><span>Qualification</span><select name="qualification_status" defaultValue={referral?.qualification_status||'new'}><option value="new">New</option><option value="reviewing">Reviewing</option><option value="qualified">Qualified</option><option value="not_qualified">Not Qualified</option></select></label>
            <label className="field" style={{gridColumn:'span 2'}}><span>Qualification notes</span><textarea name="qualification_notes" rows={2} defaultValue={referral?.qualification_notes||''} placeholder="Why this inquiry is or is not qualified…"/></label>
            <label className="field" style={{gridColumn:'span 3'}}><span>Referral notes</span><textarea name="referral_notes" rows={2} defaultValue={referral?.referral_notes||''} placeholder="Internal referral context. Status advances only through controlled actions above."/></label>
          </div>
          <div className="grid grid-3">
            <label className="field"><span>Follow-up status</span><select name="follow_up_status" defaultValue={sale?.follow_up_status||'new'}><option value="new">New</option><option value="attempted_contact">Attempted Contact</option><option value="contacted">Contacted</option><option value="appointment_scheduled">Appointment Scheduled</option><option value="appointment_completed">Appointment Completed</option><option value="not_reached">Not Reached</option><option value="not_qualified">Not Qualified</option><option value="closed">Closed</option></select></label>
            <label className="field"><span>Appointment</span><input name="appointment_at" type="datetime-local" defaultValue={sale?.appointment_at?String(sale.appointment_at).slice(0,16):''}/></label>
            <label className="field"><span>Lead sale status</span><select name="sale_status" defaultValue={sale?.sale_status||'not_delivered'}><option value="not_delivered">Not Delivered</option><option value="delivered">Delivered</option><option value="sold">Sold</option><option value="not_sold">Not Sold</option><option value="invalid">Invalid</option></select></label>
            <label className="field"><span>Sale amount ($)</span><input name="sale_amount" type="number" min="0" step="0.01" defaultValue={sale?.sale_amount_cents!=null?Number(sale.sale_amount_cents)/100:''} placeholder="Only if recorded"/></label>
            <label className="field" style={{gridColumn:'span 2'}}><span>Owner notes</span><textarea name="owner_notes" rows={2} defaultValue={sale?.owner_notes||''} placeholder="Call outcome, appointment details, commercial notes…"/></label>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><button className="btn btn-primary" disabled={busy===`${lead.id}:save`}>{busy===`${lead.id}:save`?'Saving…':'Save Lead Update'}</button>{sale?.sale_amount_cents!=null?<span className="badge verified">Recorded sale: {money(sale.sale_amount_cents)}</span>:null}</div>
          <p className="small muted">This save action cannot assign a provider or advance referral status. It also does not email a provider, transmit a lead, create an invoice, charge anyone, or alter public ranking.</p>
        </form>
      </details>
    })}
  </div>
}
