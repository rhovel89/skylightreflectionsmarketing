import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export const dynamic='force-dynamic'
const pct=(n:number,d:number)=>d>0?`${((n/d)*100).toFixed(1)}%`:'—'
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)

export default async function Page(){
  const s=await createClient()
  const [{data:leads,error},{data:providers}]=await Promise.all([
    s.from('leads').select('id,created_at,lead_project_details(zip_code,answers),estate_planning_lead_referrals(qualification_status,referral_status,provider_id,provider_state,assigned_at,referred_at,provider_responded_at),estate_planning_lead_sales(follow_up_status,sale_status,appointment_at,sale_amount_cents,sold_at),estate_planning_referral_events(event_type,provider_id,occurred_at)').eq('tenant_id',TENANT_ID).eq('source','estate_planning_nationwide').order('created_at',{ascending:false}).limit(5000),
    s.from('estate_planning_providers').select('id,display_name,onboarding_status,operating_status,estate_planning_provider_states(state_code,coverage_status,verification_status,verification_reference),estate_planning_lead_referrals(lead_id,referral_status,provider_state,referred_at,provider_responded_at)').eq('tenant_id',TENANT_ID).order('display_name',{ascending:true})
  ])
  const rows=(leads??[]) as any[],providerRows=(providers??[]) as any[]
  const norm=rows.map(r=>({lead:r,details:Array.isArray(r.lead_project_details)?r.lead_project_details[0]:r.lead_project_details,ref:Array.isArray(r.estate_planning_lead_referrals)?r.estate_planning_lead_referrals[0]:r.estate_planning_lead_referrals,sale:Array.isArray(r.estate_planning_lead_sales)?r.estate_planning_lead_sales[0]:r.estate_planning_lead_sales,events:Array.isArray(r.estate_planning_referral_events)?r.estate_planning_referral_events:[]}))
  const total=norm.length,qualified=norm.filter(x=>x.ref?.qualification_status==='qualified').length,assigned=norm.filter(x=>Boolean(x.ref?.provider_id)).length,prepared=norm.filter(x=>x.events.some((e:any)=>e.event_type==='handoff_prepared')).length,referred=norm.filter(x=>['referred','accepted'].includes(String(x.ref?.referral_status))).length,accepted=norm.filter(x=>x.ref?.referral_status==='accepted').length,appointments=norm.filter(x=>['appointment_scheduled','appointment_completed'].includes(String(x.sale?.follow_up_status))).length,sold=norm.filter(x=>x.sale?.sale_status==='sold').length
  const revenue=norm.filter(x=>x.sale?.sale_status==='sold').reduce((sum,x)=>sum+Number(x.sale?.sale_amount_cents||0),0)
  const demand=new Map<string,number>()
  norm.forEach(x=>{const state=String(x.details?.answers?.state||'').toUpperCase();if(/^[A-Z]{2}$/.test(state))demand.set(state,(demand.get(state)||0)+1)})
  const ready=new Map<string,number>()
  providerRows.filter(p=>p.onboarding_status==='approved'&&p.operating_status==='active').forEach(p=>(Array.isArray(p.estate_planning_provider_states)?p.estate_planning_provider_states:[]).forEach((x:any)=>{if(x.coverage_status==='approved'&&x.verification_status==='reviewed'&&x.verification_reference)ready.set(x.state_code,(ready.get(x.state_code)||0)+1)}))
  const states=Array.from(new Set([...demand.keys(),...ready.keys()])).sort()
  const saleByLead=new Map(norm.map(x=>[x.lead.id,x.sale]))
  return <>
    <div className="admin-page-head"><div><div className="kpi">Estate Planning Intelligence</div><h1>Referral Funnel & Coverage</h1><p className="muted">Factual operational reporting from recorded leads, referral events, provider responses and sales only. No modeled conversion rates, predicted revenue or fabricated benchmarks.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btn-light" href="/admin/estate-planning-leads">Lead Desk</Link><Link className="btn btn-light" href="/admin/estate-planning-providers">Provider Network</Link></div></div>
    {error?<div className="notice warn">{error.message}</div>:null}
    <div className="stat-grid" style={{marginBottom:18}}>
      <div className="stat"><span>Inquiries</span><strong>{total}</strong><small>Recorded nationwide leads</small></div>
      <div className="stat"><span>Qualified</span><strong>{qualified}</strong><small>{pct(qualified,total)} of inquiries</small></div>
      <div className="stat"><span>Assigned</span><strong>{assigned}</strong><small>{pct(assigned,qualified)} of qualified</small></div>
      <div className="stat"><span>Prepared</span><strong>{prepared}</strong><small>{pct(prepared,assigned)} of assigned</small></div>
      <div className="stat"><span>Referred</span><strong>{referred}</strong><small>{pct(referred,prepared)} of prepared</small></div>
      <div className="stat"><span>Accepted</span><strong>{accepted}</strong><small>{pct(accepted,referred)} of referred</small></div>
      <div className="stat"><span>Appointments</span><strong>{appointments}</strong><small>{pct(appointments,total)} of inquiries</small></div>
      <div className="stat"><span>Sold</span><strong>{sold}</strong><small>{pct(sold,total)} of inquiries</small></div>
      <div className="stat"><span>Recorded revenue</span><strong style={{fontSize:22}}>{money(revenue)}</strong><small>Sold records only</small></div>
    </div>
    <div className="notice" style={{marginBottom:18}}><strong>Sample-size rule:</strong> percentages display only when a real denominator exists. A dash means there is not enough recorded production activity for that rate yet.</div>
    <div className="grid grid-2">
      <section className="admin-card"><div className="kpi">State Demand vs. Ready Coverage</div><h2>Where the network needs attention</h2>{states.length?<div style={{display:'grid',gap:6}}>{states.map(state=><div className="info-row" key={state}><span>{state} · {demand.get(state)||0} lead{(demand.get(state)||0)===1?'':'s'}</span><strong>{ready.get(state)||0} assignment-ready provider{(ready.get(state)||0)===1?'':'s'}{(demand.get(state)||0)>0&&(ready.get(state)||0)===0?' · COVERAGE GAP':''}</strong></div>)}</div>:<p className="muted">No recorded Estate Planning demand or assignment-ready provider coverage yet.</p>}<p className="small muted" style={{marginTop:10}}>“Assignment-ready” requires approved + active provider status and approved configured state coverage with reviewed evidence reference.</p></section>
      <section className="admin-card"><div className="kpi">Provider Performance</div><h2>Recorded outcomes by provider</h2>{providerRows.length?<div style={{display:'grid',gap:8}}>{providerRows.map(p=>{const refs=Array.isArray(p.estate_planning_lead_referrals)?p.estate_planning_lead_referrals:[],refCount=refs.filter((r:any)=>['referred','accepted','declined'].includes(String(r.referral_status))).length,acceptedCount=refs.filter((r:any)=>r.referral_status==='accepted').length,soldCount=refs.filter((r:any)=>saleByLead.get(r.lead_id)?.sale_status==='sold').length;return <div className="card" key={p.id}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><strong>{p.display_name}</strong><span className="badge">{p.operating_status}</span></div><div className="info-row"><span>Recorded referrals</span><strong>{refCount}</strong></div><div className="info-row"><span>Accepted</span><strong>{acceptedCount} · {pct(acceptedCount,refCount)}</strong></div><div className="info-row"><span>Sold</span><strong>{soldCount} · {pct(soldCount,refCount)}</strong></div></div>})}</div>:<p className="muted">No providers configured. Performance reporting will populate from real referral activity.</p>}</section>
    </div>
  </>
}
