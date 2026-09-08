import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export const dynamic='force-dynamic'
const pct=(n:number,d:number)=>d>0?`${((n/d)*100).toFixed(1)}%`:'—'

export default async function Page(){
  const s=await createClient()
  const {data:leads,error}=await s.from('leads').select('id,created_at,lead_project_details(answers),estate_planning_lead_referrals(qualification_status),estate_planning_lead_sales(follow_up_status,appointment_at)').eq('tenant_id',TENANT_ID).eq('source','estate_planning_nationwide').order('created_at',{ascending:false}).limit(5000)
  const rows=(leads??[]) as any[]
  const norm=rows.map(r=>({lead:r,details:Array.isArray(r.lead_project_details)?r.lead_project_details[0]:r.lead_project_details,qualification:Array.isArray(r.estate_planning_lead_referrals)?r.estate_planning_lead_referrals[0]:r.estate_planning_lead_referrals,tracking:Array.isArray(r.estate_planning_lead_sales)?r.estate_planning_lead_sales[0]:r.estate_planning_lead_sales}))
  const total=norm.length
  const reviewing=norm.filter(x=>x.qualification?.qualification_status==='reviewing').length
  const qualified=norm.filter(x=>x.qualification?.qualification_status==='qualified').length
  const bookedStatuses=new Set(['appointment_scheduled','appointment_confirmed','appointment_completed'])
  const booked=norm.filter(x=>bookedStatuses.has(String(x.tracking?.follow_up_status))).length
  const confirmed=norm.filter(x=>['appointment_confirmed','appointment_completed'].includes(String(x.tracking?.follow_up_status))).length
  const completed=norm.filter(x=>x.tracking?.follow_up_status==='appointment_completed').length
  const noShow=norm.filter(x=>x.tracking?.follow_up_status==='no_show').length
  const canceled=norm.filter(x=>x.tracking?.follow_up_status==='canceled').length
  const notQualified=norm.filter(x=>x.qualification?.qualification_status==='not_qualified').length
  const states=new Map<string,{inquiries:number;qualified:number;booked:number}>()
  norm.forEach(x=>{const state=String(x.details?.answers?.state||'').toUpperCase();if(!/^[A-Z]{2}$/.test(state))return;const current=states.get(state)||{inquiries:0,qualified:0,booked:0};current.inquiries+=1;if(x.qualification?.qualification_status==='qualified')current.qualified+=1;if(bookedStatuses.has(String(x.tracking?.follow_up_status)))current.booked+=1;states.set(state,current)})
  return <>
    <div className="admin-page-head"><div><div className="kpi">Estate Planning Appointment Program</div><h1>Qualification & Booking Funnel</h1><p className="muted">Factual appointment-setting metrics only: inquiries, qualification, booked consultations, confirmations and appointment outcomes.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Link className="btn btn-light" href="/admin/estate-planning-leads">Appointment Desk</Link></div></div>
    {error?<div className="notice warn">{error.message}</div>:null}
    <div className="stat-grid" style={{marginBottom:18}}>
      <div className="stat"><span>Inquiries</span><strong>{total}</strong><small>Recorded consultation requests</small></div>
      <div className="stat"><span>Reviewing</span><strong>{reviewing}</strong><small>Qualification in progress</small></div>
      <div className="stat"><span>Qualified</span><strong>{qualified}</strong><small>{pct(qualified,total)} of inquiries</small></div>
      <div className="stat"><span>Booked</span><strong>{booked}</strong><small>{pct(booked,qualified)} of qualified</small></div>
      <div className="stat"><span>Confirmed</span><strong>{confirmed}</strong><small>{pct(confirmed,booked)} of booked</small></div>
      <div className="stat"><span>Completed</span><strong>{completed}</strong><small>{pct(completed,booked)} of booked</small></div>
      <div className="stat"><span>No Show</span><strong>{noShow}</strong><small>{pct(noShow,booked)} of booked</small></div>
      <div className="stat"><span>Canceled</span><strong>{canceled}</strong><small>{pct(canceled,booked)} of booked</small></div>
      <div className="stat"><span>Not Qualified</span><strong>{notQualified}</strong><small>{pct(notQualified,total)} of inquiries</small></div>
    </div>
    <div className="notice" style={{marginBottom:18}}><strong>Purpose:</strong> This dashboard measures your appointment-setting work. It does not track lawyer onboarding, provider coverage, referral handoffs, lead sales, or provider revenue.</div>
    <section className="admin-card"><div className="kpi">Inquiry & Booking by State</div><h2>Where appointment requests are coming from</h2>{states.size?<div style={{display:'grid',gap:6}}>{Array.from(states.entries()).sort((a,b)=>b[1].inquiries-a[1].inquiries||a[0].localeCompare(b[0])).map(([state,x])=><div className="info-row" key={state}><span>{state}</span><strong>{x.inquiries} inquiries · {x.qualified} qualified · {x.booked} booked</strong></div>)}</div>:<p className="muted">No recorded Estate Planning inquiries yet.</p>}</section>
  </>
}
