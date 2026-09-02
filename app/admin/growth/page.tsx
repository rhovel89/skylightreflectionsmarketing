import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const pct = (n:number,d:number) => d > 0 ? `${Math.round((n/d)*100)}%` : '—'

export default async function Page(){
  const s=await createClient()
  const since30=new Date(Date.now()-30*24*60*60*1000).toISOString()
  const since90=new Date(Date.now()-90*24*60*60*1000).toISOString()
  const [eventsRes,claimsRes,submissionsRes,marketingRes,sponsorshipsRes,subscriptionsRes,prospectsRes,tasksRes]=await Promise.all([
    s.from('analytics_events').select('event_type,city,category,metadata,occurred_at').eq('tenant_id',TENANT_ID).gte('occurred_at',since30).order('occurred_at',{ascending:false}).limit(5000),
    s.from('business_claims').select('id,created_at,businesses!inner(tenant_id)').eq('businesses.tenant_id',TENANT_ID).gte('created_at',since30).limit(1000),
    s.from('business_submissions').select('id,created_at').eq('tenant_id',TENANT_ID).gte('created_at',since30).limit(1000),
    s.from('marketing_leads').select('id,plan_interest,context_city,context_category,service_interest,status,created_at').eq('tenant_id',TENANT_ID).gte('created_at',since90).order('created_at',{ascending:false}).limit(2000),
    s.from('sponsorships').select('id,active,starts_on,ends_on,businesses!inner(tenant_id)').eq('businesses.tenant_id',TENANT_ID).eq('active',true).limit(1000),
    s.from('subscriptions').select('id,status,plans(slug,name),businesses!inner(tenant_id)').eq('businesses.tenant_id',TENANT_ID).in('status',['active','trialing']).limit(1000),
    s.from('business_prospects').select('id,priority,crm_stage,status,owner_contact_email,owner_contact_phone,claim_invite_sent_at,marketing_pitch_sent_at').eq('tenant_id',TENANT_ID).limit(2000),
    s.from('outreach_tasks').select('prospect_id,task_type,status,due_at').eq('tenant_id',TENANT_ID).in('status',['open','in_progress']).limit(3000),
  ])
  const errors=[eventsRes.error,claimsRes.error,submissionsRes.error,marketingRes.error,sponsorshipsRes.error,subscriptionsRes.error,prospectsRes.error,tasksRes.error].filter(Boolean)
  const events=(eventsRes.data??[]) as any[],marketing=(marketingRes.data??[]) as any[],prospects=(prospectsRes.data??[]) as any[],tasks=(tasksRes.data??[]) as any[]
  const eventCount=(name:string)=>events.filter(e=>e.event_type===name).length
  const ownerClicks=eventCount('claim_cta_click')+eventCount('business_visibility_click')
  const claimClicks=eventCount('claim_cta_click'),claimSubmits=eventCount('claim_submit')
  const planClicks=eventCount('visibility_plan_click')+eventCount('market_sponsorship_click')+eventCount('business_visibility_click')
  const marketingSubmits=eventCount('marketing_lead_submit')
  const activeSponsorships=(sponsorshipsRes.data??[]).length,activeSubscriptions=(subscriptionsRes.data??[]).length
  const outreachProspects=prospects.filter(p=>p.crm_stage==='claim_outreach'&&['published','contact_ready'].includes(p.status))
  const priorities=['hot','high','medium'] as const
  const planLabels:Record<string,string>={verified:'Verified',featured:'Featured',pro:'Pro',sponsorship:'Sponsorship',marketing_review:'Marketing Review',free:'Free'}
  const planCounts=marketing.reduce((m:Record<string,number>,r:any)=>{const k=r.plan_interest||'unspecified';m[k]=(m[k]||0)+1;return m},{})
  const marketCounts=events.filter(e=>e.city||e.category).reduce((m:Record<string,number>,e:any)=>{const k=[e.category,e.city].filter(Boolean).join(' · ');m[k]=(m[k]||0)+1;return m},{})
  const topMarkets=Object.entries(marketCounts).sort((a,b)=>b[1]-a[1]).slice(0,8)
  const openClaimTasks=new Set(tasks.filter(t=>t.task_type==='claim_invite').map(t=>t.prospect_id))
  return <>
    <div className="admin-page-head"><div><div className="kpi">Growth & Revenue Intelligence</div><h1>Acquisition Funnel</h1><p className="muted">Track organic business-owner intent, free claims, plan interest, marketing requests and real paid-account state without mixing sponsorship into organic relevance.</p></div><span className="badge neutral">Real events only</span></div>
    {errors.length>0&&<div className="notice warn">One or more growth queries returned an error. Metrics shown below may be incomplete.</div>}
    <div className="stat-grid"><div className="stat">Owner / Growth CTA Clicks<strong>{ownerClicks}</strong></div><div className="stat">Claim Submits · 30d<strong>{(claimsRes.data??[]).length}</strong></div><div className="stat">Plan / Sponsor Clicks<strong>{planClicks}</strong></div><div className="stat">Marketing Requests · 90d<strong>{marketing.length}</strong></div></div>
    <div className="grid grid-2" style={{marginTop:18}}><div className="admin-card"><div className="kpi">30-day measured funnel</div><h2>Owner acquisition</h2><div className="info-row"><span>For Businesses page views</span><strong>{eventCount('for_businesses_view')}</strong></div><div className="info-row"><span>Claim CTA clicks</span><strong>{claimClicks}</strong></div><div className="info-row"><span>Tracked claim submits</span><strong>{claimSubmits}</strong></div><div className="info-row"><span>Claim click → tracked submit</span><strong>{pct(claimSubmits,claimClicks)}</strong></div><div className="info-row"><span>New business submissions</span><strong>{(submissionsRes.data??[]).length}</strong></div><p className="small muted">Submission tables remain the source of truth. Funnel events measure behavior and never manufacture a claim or lead.</p></div><div className="admin-card"><div className="kpi">Revenue readiness</div><h2>Paid visibility pipeline</h2><div className="info-row"><span>Plan / sponsor CTA clicks</span><strong>{planClicks}</strong></div><div className="info-row"><span>Tracked marketing submits</span><strong>{marketingSubmits}</strong></div><div className="info-row"><span>Click → tracked request</span><strong>{pct(marketingSubmits,planClicks)}</strong></div><div className="info-row"><span>Active paid subscriptions</span><strong>{activeSubscriptions}</strong></div><div className="info-row"><span>Active sponsorships</span><strong>{activeSponsorships}</strong></div><p className="small muted">A paid subscription or sponsorship is counted only when an actual database record exists. Organic rank is excluded from this funnel.</p></div></div>
    <div className="section-head admin-quick-head"><div><h2>Claim Outreach Pipeline</h2><p className="muted">Existing researched prospects staged for owner acquisition. Open tasks are plans—not proof that outreach was sent.</p></div><Link href="/admin/prospects">Open Sales CRM →</Link></div>
    <div className="grid grid-3">{priorities.map(priority=>{const rows=outreachProspects.filter(p=>p.priority===priority),withTask=rows.filter(p=>openClaimTasks.has(p.id)).length,sent=rows.filter(p=>p.claim_invite_sent_at).length;return <div className="admin-card" key={priority}><div className="kpi">{priority.toUpperCase()}</div><h2>{rows.length} prospects</h2><p className="small muted">{withTask} have open claim-invite tasks · {sent} are marked actually sent.</p></div>})}</div>
    <div className="grid grid-2" style={{marginTop:18}}><div className="admin-card"><div className="kpi">90-day requests</div><h2>Plan Interest</h2>{Object.keys(planCounts).length?Object.entries(planCounts).sort((a,b)=>b[1]-a[1]).map(([plan,count])=><div className="info-row" key={plan}><span>{planLabels[plan]||plan}</span><strong>{count}</strong></div>):<p className="muted">No structured plan requests have been submitted yet. New requests now retain their plan context.</p>}<Link className="btn btn-light" href="/admin/marketing-leads">Open Skylight Leads</Link></div><div className="admin-card"><div className="kpi">30-day intent</div><h2>Top Market Interest</h2>{topMarkets.length?topMarkets.map(([market,count])=><div className="info-row" key={market}><span>{market}</span><strong>{count}</strong></div>):<p className="muted">No contextual market-growth clicks have been recorded yet. Tracking begins with this release.</p>}<Link className="btn btn-light" href="/admin/search">Open Search Intelligence</Link></div></div>
    <div className="section-head admin-quick-head"><div><h2>Revenue Operations</h2><p className="muted">Move from interest to approved owner access, then optional paid tools or clearly labeled sponsorship.</p></div></div><div className="grid grid-4 admin-quick-grid"><Link className="admin-card admin-quick-card" href="/admin/outreach"><strong>Outreach Tasks</strong><p className="small muted">Work the existing claim-invite and follow-up queue.</p><span className="kpi">Open →</span></Link><Link className="admin-card admin-quick-card" href="/admin/claims"><strong>Claims Queue</strong><p className="small muted">Review genuine owner claims before granting access.</p><span className="kpi">Open →</span></Link><Link className="admin-card admin-quick-card" href="/admin/pricing"><strong>Plans & Pricing</strong><p className="small muted">Manage optional business tools and plan pricing.</p><span className="kpi">Open →</span></Link><Link className="admin-card admin-quick-card" href="/admin/sponsorships"><strong>Sponsored Placement</strong><p className="small muted">Create clearly labeled placements only after a real agreement exists.</p><span className="kpi">Open →</span></Link></div>
  </>
}
