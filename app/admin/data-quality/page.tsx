import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { AdminEntityEditor } from '@/components/AdminEntityEditor'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined
type TaskRow = {
  id:string
  object_type:string
  object_key:string
  business_id?:string|null
  branch_id?:string|null
  seo_gap_id?:string|null
  task_type:string
  priority:string
  status:string
  title:string
  details?:string|null
  source_snapshot?:Record<string,unknown>|null
  due_at?:string|null
  assigned_user_id?:string|null
  notes?:string|null
  last_seen_at?:string|null
  resolved_at?:string|null
  updated_at?:string|null
}

const one=(v:SearchValue)=>Array.isArray(v)?v[0]??'':v??''
const text=(v:unknown)=>String(v??'').trim()
const titleCase=(v:string)=>v.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
const priorityRank:Record<string,number>={hot:4,high:3,medium:2,low:1}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,SearchValue>>}){
  const sp=await searchParams
  const state=one(sp.state)||'active'
  const type=one(sp.type)
  const priority=one(sp.priority)
  const q=one(sp.q).trim().toLowerCase()
  const s=await createClient()
  const cfg=ADMIN_ENTITIES['data-quality']

  const {data,error}=await s.from('data_quality_tasks')
    .select(cfg.select)
    .eq('tenant_id',TENANT_ID)
    .order('updated_at',{ascending:false})
    .limit(2500)

  const rows=(data??[]) as unknown as TaskRow[]
  const active=rows.filter(r=>r.status==='open'||r.status==='in_progress')
  const inProgress=rows.filter(r=>r.status==='in_progress')
  const resolved=rows.filter(r=>r.status==='resolved')
  const ignored=rows.filter(r=>r.status==='ignored')
  const businessProvenance=active.filter(r=>r.task_type==='business_provenance')
  const branchProvenance=active.filter(r=>r.task_type==='branch_provenance')
  const reverify=active.filter(r=>r.task_type==='business_reverify'||r.task_type==='branch_reverify')
  const seoInventory=active.filter(r=>r.task_type==='seo_inventory')
  const oneAway=seoInventory.filter(r=>Number(r.source_snapshot?.current_providers||0)===2)
  const deeperSeo=seoInventory.filter(r=>Number(r.source_snapshot?.current_providers||0)<=1)
  const overdue=active.filter(r=>r.due_at&&new Date(r.due_at).getTime()<Date.now())

  let filtered=rows.filter(r=>{
    if(state==='active'&&!(r.status==='open'||r.status==='in_progress'))return false
    if(state==='open'&&r.status!=='open')return false
    if(state==='in_progress'&&r.status!=='in_progress')return false
    if(state==='resolved'&&r.status!=='resolved')return false
    if(state==='ignored'&&r.status!=='ignored')return false
    if(type&&r.task_type!==type)return false
    if(priority&&r.priority!==priority)return false
    if(q){
      const snapshot=JSON.stringify(r.source_snapshot||{})
      if(!`${r.title} ${r.details||''} ${r.notes||''} ${snapshot}`.toLowerCase().includes(q))return false
    }
    return true
  })

  filtered=filtered.sort((a,b)=>(priorityRank[b.priority]||0)-(priorityRank[a.priority]||0)
    ||Number(Boolean(a.due_at))-Number(Boolean(b.due_at))
    ||(a.due_at&&b.due_at?new Date(a.due_at).getTime()-new Date(b.due_at).getTime():0)
    ||a.title.localeCompare(b.title))
  const shown=filtered.slice(0,180)

  return <>
    <div className="admin-page-head"><div><div className="kpi">Private Listing Integrity</div><h1>Data Quality & Reverification</h1><p className="muted">Persistent work queue for source provenance, branch evidence, scheduled reverification and SEO inventory gaps. Tasks resolve from corrected underlying facts instead of becoming a disconnected checklist.</p></div><div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/seo">SEO Command Center</Link><Link className="btn btn-light" href="/admin/inventory-expansion">Inventory Expansion</Link></div></div>

    {error&&<div className="notice warn">The data-quality queue could not be loaded completely: {error.message}</div>}
    <div className="notice"><strong>Quality rules:</strong> a missing website is not a defect. This queue focuses on source evidence, real location relationships, evidence age and legitimate provider coverage. Service areas must not be converted into physical branches simply to fill a market.</div>

    <div className="stat-grid" style={{marginTop:18}}>
      <div className="stat">Active Quality Tasks<strong>{active.length}</strong><span className="small muted">{overdue.length} overdue</span></div>
      <div className="stat">Business Provenance<strong>{businessProvenance.length}</strong><span className="small muted">missing source URL/check evidence</span></div>
      <div className="stat">Branch Provenance<strong>{branchProvenance.length}</strong><span className="small muted">active branch/location evidence</span></div>
      <div className="stat">Reverification Due<strong>{reverify.length}</strong><span className="small muted">180-day evidence cycle</span></div>
      <div className="stat">SEO One Away<strong>{oneAway.length}</strong><span className="small muted">2 providers; needs one legitimate addition</span></div>
      <div className="stat">Deeper SEO Gaps<strong>{deeperSeo.length}</strong><span className="small muted">1 or fewer providers</span></div>
      <div className="stat">In Progress<strong>{inProgress.length}</strong></div>
      <div className="stat">Resolved<strong>{resolved.length}</strong><span className="small muted">{ignored.length} currently ignored</span></div>
    </div>

    <div className="admin-card" style={{marginTop:18}}>
      <div className="section-head compact-head"><div><div className="kpi">Work Queue</div><h2>Prioritize evidence before expansion</h2><p className="small muted">Use status to claim work, add notes for research context, and edit the underlying listing/branch/SEO record when you have verified facts. Nightly refreshes preserve in-progress work and auto-resolve fixed conditions.</p></div><Link className="btn btn-light" href="/admin/data-quality">Reset</Link></div>
      <form method="get" className="grid grid-4" style={{alignItems:'end'}}>
        <label className="field"><span>Status</span><select name="state" defaultValue={state}><option value="active">Active</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="ignored">Ignored</option><option value="all">All</option></select></label>
        <label className="field"><span>Task Type</span><select name="type" defaultValue={type}><option value="">All task types</option><option value="business_provenance">Business provenance</option><option value="branch_provenance">Branch provenance</option><option value="business_reverify">Business reverify</option><option value="branch_reverify">Branch reverify</option><option value="seo_inventory">SEO inventory</option></select></label>
        <label className="field"><span>Priority</span><select name="priority" defaultValue={priority}><option value="">All priorities</option><option value="hot">Hot</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <label className="field"><span>Search</span><input name="q" defaultValue={one(sp.q)} placeholder="Business, city, category, source"/></label>
        <div><button className="btn btn-primary" type="submit">Apply Filters</button></div>
      </form>
    </div>

    {oneAway.length>0&&<div className="admin-card" style={{marginTop:18}}><div className="section-head"><div><div className="kpi">Highest-Leverage Inventory</div><h2>One legitimate provider away from SEO eligibility</h2><p className="small muted">These markets have exactly two published providers. Research a third only when the business/category/location relationship is real and source-backed.</p></div><span className="badge neutral">{oneAway.length} market{oneAway.length===1?'':'s'}</span></div><div className="grid grid-3">{oneAway.slice(0,12).map(r=>{const snap=r.source_snapshot||{};return <div className="card" key={r.id}><div className="kpi">{titleCase(r.priority)} priority · {text(snap.provider_gap)||'1'} provider gap</div><h3>{text(snap.category)||r.title}</h3><p className="small muted">{text(snap.city)} · {text(snap.current_providers)||'2'} current providers</p><p>{r.details}</p><div className="card-actions"><Link href="/admin/inventory-expansion">Research inventory →</Link><Link href="/admin/seo">SEO coverage →</Link></div></div>})}</div></div>}

    <div className="grid grid-3" style={{marginTop:18}}>
      <div className="admin-card"><div className="kpi">Provenance</div><h3>Source URL + checked date</h3><p className="small muted">A source name alone is not enough for durable verification. Store the exact source URL and refresh the checked date only after a real review.</p></div>
      <div className="admin-card"><div className="kpi">Reverification</div><h3>180-day cycle</h3><p className="small muted">Current records are fresh today. The queue automatically creates reverification work when evidence becomes 180 days old.</p></div>
      <div className="admin-card"><div className="kpi">SEO Integrity</div><h3>Threshold stays real</h3><p className="small muted">No task can override the live three-provider indexing guardrail. Paid placement, claim status and verification remain separate from organic eligibility.</p></div>
    </div>

    <div className="admin-list-meta" style={{marginTop:18}}><span className="kpi">{filtered.length} matching task{filtered.length===1?'':'s'} · showing {shown.length}</span><span className="small muted">Edit task status, due date, assignment and staff notes below. Correct facts in the underlying editor.</span></div>
    {shown.length?<AdminEntityEditor section="data-quality" cfg={cfg} rows={shown as unknown as Record<string,unknown>[]} />:<div className="notice">No data-quality tasks match the selected filters.</div>}

    <div className="admin-row-actions" style={{marginTop:18}}><Link className="btn btn-light" href="/admin/businesses">Business Editor</Link><Link className="btn btn-light" href="/admin/branches">Branch Editor</Link><Link className="btn btn-light" href="/admin/seo">SEO Editor</Link><Link className="btn btn-light" href="/admin/operations-command-center">Growth Operations</Link></div>
  </>
}
