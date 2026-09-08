import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { EstatePlanningProviderNetwork } from '@/components/EstatePlanningProviderNetwork'

export const dynamic='force-dynamic'

export default async function Page(){
  const s=await createClient()
  const {data:providers,error}=await s.from('estate_planning_providers').select('id,display_name,provider_type,onboarding_status,operating_status,verification_status,primary_contact_name,primary_contact_email,primary_contact_phone,website,external_reference,capacity_limit,capacity_notes,internal_notes,approved_at,verified_at,created_at,updated_at,estate_planning_provider_states(id,state_code,coverage_status,verification_status,verification_reference,referral_capacity,notes,reviewed_at,updated_at),estate_planning_lead_referrals(id,referral_status,provider_state,assigned_at,referred_at,provider_responded_at)').eq('tenant_id',TENANT_ID).order('display_name',{ascending:true})
  const list=(providers??[]) as any[]
  const states=list.flatMap(p=>Array.isArray(p.estate_planning_provider_states)?p.estate_planning_provider_states:[])
  const refs=list.flatMap(p=>Array.isArray(p.estate_planning_lead_referrals)?p.estate_planning_lead_referrals:[])
  const readyStates=states.filter(x=>x.coverage_status==='approved'&&x.verification_status==='reviewed'&&x.verification_reference).length
  const active=list.filter(p=>p.onboarding_status==='approved'&&p.operating_status==='active').length
  const openRefs=refs.filter(r=>['pending_review','approved_for_referral','referred','accepted'].includes(String(r.referral_status))).length
  return <>
    <div className="admin-page-head"><div><div className="kpi">Estate Planning Provider Network</div><h1>Providers & State Coverage</h1><p className="muted">Private operational registry for real provider relationships, state-specific evidence review, capacity and controlled referral eligibility. Nothing here is published as a licensing claim.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btn-light" href="/admin/estate-planning-leads">Lead Desk</Link><span className="badge verified">Human Controlled</span></div></div>
    <div className="stat-grid" style={{marginBottom:18}}>
      <div className="stat"><span>Providers</span><strong>{list.length}</strong><small>Private records</small></div>
      <div className="stat"><span>Active</span><strong>{active}</strong><small>Approved + active providers</small></div>
      <div className="stat"><span>Assignment-ready states</span><strong>{readyStates}</strong><small>Approved configuration + reviewed evidence</small></div>
      <div className="stat"><span>Open referrals</span><strong>{openRefs}</strong><small>Tracked, not auto-routed</small></div>
    </div>
    <div className="grid grid-2" style={{marginBottom:18}}>
      <div className="admin-card"><div className="kpi">Eligibility Model</div><h2>Relationship + state evidence + capacity</h2><p className="small muted">A provider must be approved, active, and have the lead's state configured as Approved with reviewed evidence before assignment is allowed. Capacity gates are enforced when configured.</p></div>
      <div className="admin-card"><div className="kpi">Transmission Boundary</div><h2>No automatic consumer-data sharing</h2><p className="small muted">Provider configuration does not send leads. Assignment does not send leads. Preparing a handoff creates a private snapshot only. A referral becomes “Referred” only when staff explicitly records that a manual handoff already occurred.</p></div>
    </div>
    {error?<div className="notice warn">{error.message}</div>:<EstatePlanningProviderNetwork providers={list}/>} 
  </>
}
