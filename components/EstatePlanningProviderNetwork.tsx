'use client'

import { FormEvent, useMemo, useState } from 'react'

type R=Record<string,any>
const pretty=(v:any)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())
const dt=(v:any)=>v?new Date(v).toLocaleString():'Not recorded'

export function EstatePlanningProviderNetwork({providers}:{providers:R[]}){
  const [busy,setBusy]=useState('')
  const [message,setMessage]=useState('')
  const ordered=useMemo(()=>[...providers].sort((a,b)=>String(a.display_name).localeCompare(String(b.display_name))),[providers])

  async function post(payload:R,key:string){
    setBusy(key);setMessage('')
    const r=await fetch('/api/admin/estate-planning-providers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const body=await r.json().catch(()=>({}))
    if(!r.ok){setMessage(String(body.error||'Unable to update provider network.'));setBusy('');return}
    setMessage(String(body.message||'Provider network updated.'));window.location.reload()
  }

  function create(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget)
    void post({action:'create_provider',display_name:f.get('display_name'),provider_type:f.get('provider_type'),primary_contact_name:f.get('primary_contact_name'),primary_contact_email:f.get('primary_contact_email'),primary_contact_phone:f.get('primary_contact_phone'),website:f.get('website'),external_reference:f.get('external_reference'),capacity_limit:f.get('capacity_limit'),capacity_notes:f.get('capacity_notes'),internal_notes:f.get('internal_notes')},'create')
  }

  function updateProvider(e:FormEvent<HTMLFormElement>,providerId:string){
    e.preventDefault();const f=new FormData(e.currentTarget)
    void post({action:'update_provider',provider_id:providerId,display_name:f.get('display_name'),provider_type:f.get('provider_type'),onboarding_status:f.get('onboarding_status'),operating_status:f.get('operating_status'),verification_status:f.get('verification_status'),primary_contact_name:f.get('primary_contact_name'),primary_contact_email:f.get('primary_contact_email'),primary_contact_phone:f.get('primary_contact_phone'),website:f.get('website'),external_reference:f.get('external_reference'),capacity_limit:f.get('capacity_limit'),capacity_notes:f.get('capacity_notes'),internal_notes:f.get('internal_notes')},`provider:${providerId}`)
  }

  function saveState(e:FormEvent<HTMLFormElement>,providerId:string){
    e.preventDefault();const f=new FormData(e.currentTarget)
    void post({action:'upsert_state',provider_id:providerId,state_code:f.get('state_code'),coverage_status:f.get('coverage_status'),verification_status:f.get('state_verification_status'),verification_reference:f.get('verification_reference'),referral_capacity:f.get('referral_capacity'),notes:f.get('state_notes')},`state:${providerId}`)
  }

  return <div style={{display:'grid',gap:16}}>
    {message?<div className="notice">{message}</div>:null}
    <section className="admin-card">
      <div className="kpi">Add Provider</div><h2>Create a private provider record</h2>
      <p className="small muted">New providers start as <strong>Prospect + Paused + Unverified</strong>. Creating a record never makes the provider eligible for a referral.</p>
      <form onSubmit={create} style={{display:'grid',gap:10}}>
        <div className="grid grid-3">
          <label className="field"><span>Provider / firm name</span><input name="display_name" required maxLength={240}/></label>
          <label className="field"><span>Provider type</span><select name="provider_type" defaultValue="law_firm"><option value="law_firm">Law Firm</option><option value="attorney">Attorney</option><option value="estate_planning_service">Estate Planning Service</option><option value="other">Other</option></select></label>
          <label className="field"><span>Internal / CRM reference</span><input name="external_reference" maxLength={500}/></label>
          <label className="field"><span>Primary contact</span><input name="primary_contact_name" maxLength={160}/></label>
          <label className="field"><span>Contact email</span><input name="primary_contact_email" type="email" maxLength={240}/></label>
          <label className="field"><span>Contact phone</span><input name="primary_contact_phone" maxLength={80}/></label>
          <label className="field"><span>Website</span><input name="website" maxLength={500} placeholder="https://…"/></label>
          <label className="field"><span>Overall open-referral capacity</span><input name="capacity_limit" type="number" min="0" step="1" placeholder="Blank = no configured limit"/></label>
          <label className="field"><span>Capacity notes</span><input name="capacity_notes" maxLength={2000}/></label>
          <label className="field" style={{gridColumn:'span 3'}}><span>Internal notes</span><textarea name="internal_notes" rows={2}/></label>
        </div>
        <div><button className="btn btn-primary" disabled={busy==='create'}>{busy==='create'?'Creating…':'Create Paused Provider Record'}</button></div>
      </form>
    </section>

    {!ordered.length?<section className="admin-card"><div className="kpi">Provider Network</div><h2>No providers configured yet</h2><p className="muted">That is a valid production state. Add real providers only after you have a relationship and evidence you are comfortable documenting.</p></section>:ordered.map(provider=>{
      const states=Array.isArray(provider.estate_planning_provider_states)?provider.estate_planning_provider_states:[]
      const refs=Array.isArray(provider.estate_planning_lead_referrals)?provider.estate_planning_lead_referrals:[]
      const openRefs=refs.filter((r:R)=>['pending_review','approved_for_referral','referred','accepted'].includes(String(r.referral_status))).length
      const approvedStates=states.filter((x:R)=>x.coverage_status==='approved'&&x.verification_status==='reviewed'&&x.verification_reference).length
      return <details className="admin-card" key={provider.id} open={provider.onboarding_status!=='approved'}>
        <summary style={{cursor:'pointer',display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
          <span><strong>{provider.display_name}</strong><span className="small muted" style={{display:'block'}}>{pretty(provider.provider_type)} · {approvedStates} assignment-ready state{approvedStates===1?'':'s'} · {openRefs} open referral{openRefs===1?'':'s'}</span></span>
          <span style={{display:'flex',gap:6,flexWrap:'wrap'}}><span className={`badge ${provider.onboarding_status==='approved'?'verified':'sponsored'}`}>{pretty(provider.onboarding_status)}</span><span className={`badge ${provider.operating_status==='active'?'verified':'sponsored'}`}>{pretty(provider.operating_status)}</span><span className="badge">{pretty(provider.verification_status)}</span></span>
        </summary>
        <form onSubmit={e=>updateProvider(e,provider.id)} style={{display:'grid',gap:10,marginTop:14}}>
          <div className="grid grid-3">
            <label className="field"><span>Name</span><input name="display_name" required defaultValue={provider.display_name}/></label>
            <label className="field"><span>Type</span><select name="provider_type" defaultValue={provider.provider_type}><option value="law_firm">Law Firm</option><option value="attorney">Attorney</option><option value="estate_planning_service">Estate Planning Service</option><option value="other">Other</option></select></label>
            <label className="field"><span>Internal / CRM reference</span><input name="external_reference" defaultValue={provider.external_reference||''}/></label>
            <label className="field"><span>Onboarding</span><select name="onboarding_status" defaultValue={provider.onboarding_status}><option value="prospect">Prospect</option><option value="reviewing">Reviewing</option><option value="approved">Approved</option><option value="declined">Declined</option></select></label>
            <label className="field"><span>Operating</span><select name="operating_status" defaultValue={provider.operating_status}><option value="paused">Paused</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <label className="field"><span>Provider dossier review</span><select name="verification_status" defaultValue={provider.verification_status}><option value="unverified">Unverified</option><option value="documents_pending">Documents Pending</option><option value="reviewed">Reviewed</option></select></label>
            <label className="field"><span>Primary contact</span><input name="primary_contact_name" defaultValue={provider.primary_contact_name||''}/></label>
            <label className="field"><span>Email</span><input name="primary_contact_email" type="email" defaultValue={provider.primary_contact_email||''}/></label>
            <label className="field"><span>Phone</span><input name="primary_contact_phone" defaultValue={provider.primary_contact_phone||''}/></label>
            <label className="field"><span>Website</span><input name="website" defaultValue={provider.website||''}/></label>
            <label className="field"><span>Overall capacity</span><input name="capacity_limit" type="number" min="0" step="1" defaultValue={provider.capacity_limit??''}/></label>
            <label className="field"><span>Capacity notes</span><input name="capacity_notes" defaultValue={provider.capacity_notes||''}/></label>
            <label className="field" style={{gridColumn:'span 3'}}><span>Internal notes</span><textarea name="internal_notes" rows={2} defaultValue={provider.internal_notes||''}/></label>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><button className="btn btn-primary" disabled={busy===`provider:${provider.id}`}>{busy===`provider:${provider.id}`?'Saving…':'Save Provider'}</button><span className="small muted">Approved: {dt(provider.approved_at)} · Dossier reviewed: {dt(provider.verified_at)}</span></div>
        </form>

        <div className="notice" style={{marginTop:14}}><strong>State evidence rule:</strong> “Approved coverage” is an internal routing configuration, not a public licensing claim. A lead cannot be assigned unless the same state is marked <strong>Approved + Reviewed</strong> with an evidence reference.</div>
        <div className="grid grid-2" style={{marginTop:14}}>
          <section className="card"><div className="kpi">Configured States</div>{states.length?states.sort((a:R,b:R)=>String(a.state_code).localeCompare(String(b.state_code))).map((x:R)=><div className="info-row" key={x.id}><span>{x.state_code}</span><strong>{pretty(x.coverage_status)} · {pretty(x.verification_status)}{x.verification_reference?' · evidence linked':''}</strong></div>):<p className="small muted">No states configured.</p>}</section>
          <section className="card"><div className="kpi">Add / Update State</div>
            <form onSubmit={e=>saveState(e,provider.id)} style={{display:'grid',gap:8}}>
              <div className="grid grid-2">
                <label className="field"><span>State code</span><input name="state_code" required minLength={2} maxLength={2} placeholder="IL" style={{textTransform:'uppercase'}}/></label>
                <label className="field"><span>Configured coverage</span><select name="coverage_status" defaultValue="eligible_for_review"><option value="not_configured">Not Configured</option><option value="eligible_for_review">Eligible for Review</option><option value="approved">Approved</option><option value="paused">Paused</option></select></label>
                <label className="field"><span>State evidence review</span><select name="state_verification_status" defaultValue="pending"><option value="unverified">Unverified</option><option value="pending">Pending</option><option value="reviewed">Reviewed</option></select></label>
                <label className="field"><span>State capacity</span><input name="referral_capacity" type="number" min="0" step="1"/></label>
                <label className="field" style={{gridColumn:'span 2'}}><span>Verification evidence reference</span><input name="verification_reference" maxLength={1000} placeholder="Internal document, source, bar-directory review, agreement, or evidence reference"/></label>
                <label className="field" style={{gridColumn:'span 2'}}><span>State notes</span><textarea name="state_notes" rows={2}/></label>
              </div>
              <div><button className="btn btn-light" disabled={busy===`state:${provider.id}`}>{busy===`state:${provider.id}`?'Saving…':'Save State Record'}</button></div>
            </form>
          </section>
        </div>
      </details>
    })}
  </div>
}
