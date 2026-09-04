import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { AdminEntityEditor } from '@/components/AdminEntityEditor'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined
type ProspectRow = {
  id:string
  business_id?:string|null
  business_name:string
  vertical?:string|null
  category?:string|null
  city?:string|null
  phone?:string|null
  website?:string|null
  status?:string|null
  opportunity_score?:number|null
  crm_stage?:string|null
  priority?:string|null
  owner_contact_name?:string|null
  owner_contact_title?:string|null
  owner_contact_email?:string|null
  owner_contact_phone?:string|null
  owner_contact_source_url?:string|null
  owner_contact_checked_at?:string|null
  next_follow_up_at?:string|null
  last_contacted_at?:string|null
  claim_invite_sent_at?:string|null
  marketing_pitch_sent_at?:string|null
  notes?:string|null
  updated_at?:string|null
}

type TaskRow = { id:string; prospect_id?:string|null; task_type?:string|null; status?:string|null; due_at?:string|null }

const one=(v:SearchValue)=>Array.isArray(v)?v[0]??'':v??''
const text=(v:unknown)=>String(v||'').trim()
const contactable=(p:ProspectRow)=>Boolean(text(p.owner_contact_email)||text(p.owner_contact_phone))
const sourced=(p:ProspectRow)=>Boolean(text(p.owner_contact_source_url))
const checked=(p:ProspectRow)=>Boolean(p.owner_contact_checked_at)
const claimReady=(p:ProspectRow)=>contactable(p)&&sourced(p)&&checked(p)
const titleCase=(v:string)=>v.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())

export default async function Page({searchParams}:{searchParams:Promise<Record<string,SearchValue>>}){
  const sp=await searchParams
  const q=one(sp.q).trim().toLowerCase()
  const state=one(sp.state)||'research'
  const city=one(sp.city)
  const vertical=one(sp.vertical)
  const s=await createClient()
  const cfg=ADMIN_ENTITIES.prospects

  const [{data:prospectData,error:prospectError},{data:taskData,error:taskError},{count:publishedCount,error:businessError}]=await Promise.all([
    s.from('business_prospects').select(cfg.select).eq('tenant_id',TENANT_ID).order('priority',{ascending:false}).order('opportunity_score',{ascending:false}).order('updated_at',{ascending:false}).limit(2500),
    s.from('outreach_tasks').select('id,prospect_id,task_type,status,due_at').eq('tenant_id',TENANT_ID).in('status',['open','in_progress']).limit(5000),
    s.from('businesses').select('id',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('status','published'),
  ])

  const prospects=(prospectData??[]) as unknown as ProspectRow[]
  const tasks=(taskData??[]) as unknown as TaskRow[]
  const linked=prospects.filter(p=>Boolean(p.business_id))
  const withContact=linked.filter(contactable)
  const ready=linked.filter(claimReady)
  const contactNeedsSource=linked.filter(p=>contactable(p)&&(!sourced(p)||!checked(p)))
  const researchNeeded=linked.filter(p=>!contactable(p))
  const researchTasks=tasks.filter(t=>t.task_type==='contact_research')
  const claimTasks=tasks.filter(t=>t.task_type==='claim_invite')
  const marketingTasks=tasks.filter(t=>t.task_type==='marketing_outreach')
  const overdueResearch=researchTasks.filter(t=>t.due_at&&new Date(t.due_at).getTime()<Date.now())
  const cities=Array.from(new Set(linked.map(p=>text(p.city)).filter(Boolean))).sort()
  const verticals=Array.from(new Set(linked.map(p=>text(p.vertical)).filter(Boolean))).sort()
  const linkedIds=new Set(linked.map(p=>p.id))
  const researchTaskProspects=new Set(researchTasks.map(t=>text(t.prospect_id)).filter(Boolean))
  const orphanResearchTasks=researchTasks.filter(t=>!t.prospect_id||!linkedIds.has(t.prospect_id)).length

  let filtered=linked.filter(p=>{
    if(q&&!`${p.business_name} ${p.category||''} ${p.city||''} ${p.owner_contact_name||''} ${p.owner_contact_title||''} ${p.owner_contact_email||''} ${p.owner_contact_phone||''}`.toLowerCase().includes(q))return false
    if(city&&p.city!==city)return false
    if(vertical&&p.vertical!==vertical)return false
    if(state==='research'&&contactable(p))return false
    if(state==='provenance'&&!(contactable(p)&&(!sourced(p)||!checked(p))))return false
    if(state==='ready'&&!claimReady(p))return false
    if(state==='task'&&!researchTaskProspects.has(p.id))return false
    if(state==='all')return true
    return true
  })

  filtered=filtered.sort((a,b)=>{
    const priorityRank:Record<string,number>={hot:4,high:3,medium:2,low:1}
    return (priorityRank[text(b.priority)]||0)-(priorityRank[text(a.priority)]||0)
      ||Number(b.opportunity_score||0)-Number(a.opportunity_score||0)
      ||a.business_name.localeCompare(b.business_name)
  })
  const shown=filtered.slice(0,180)
  const hasFilters=Boolean(q||city||vertical||state!=='research')

  return <>
    <div className="admin-page-head"><div><div className="kpi">Private Owner Acquisition</div><h1>Acquisition Research Workbench</h1><p className="muted">Work the published → contact research → provenance → claim-ready pipeline without treating a generic business inbox or main phone as owner/decision-maker evidence.</p></div><div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/operations-command-center">Growth Operations</Link><Link className="btn btn-light" href="/admin/outreach">Outreach Tasks</Link></div></div>

    {(prospectError||taskError||businessError)&&<div className="notice warn">One or more acquisition inputs could not be loaded. Do not treat affected totals as complete until the query recovers.</div>}
    <div className="notice"><strong>Stage integrity:</strong> this workbench can organize research and store sourced decision-maker information. It does not infer ownership from listing contact fields, does not mark outreach as sent, does not auto-verify a listing, and never affects organic ranking.</div>

    <div className="stat-grid" style={{marginTop:18}}>
      <div className="stat">Published Businesses<strong>{publishedCount??0}</strong></div>
      <div className="stat">Linked Research Records<strong>{linked.length}</strong><span className="small muted">{Math.max(0,Number(publishedCount||0)-linked.length)} published listings not linked</span></div>
      <div className="stat">Contact Research Needed<strong>{researchNeeded.length}</strong></div>
      <div className="stat">Contact Path Found<strong>{withContact.length}</strong></div>
      <div className="stat">Provenance Incomplete<strong>{contactNeedsSource.length}</strong><span className="small muted">contact exists but source/check is incomplete</span></div>
      <div className="stat">Claim-Ready Evidence<strong>{ready.length}</strong><span className="small muted">contact + source URL + checked date</span></div>
      <div className="stat">Open Research Tasks<strong>{researchTasks.length}</strong><span className="small muted">{overdueResearch.length} overdue</span></div>
      <div className="stat">Open Claim Tasks<strong>{claimTasks.length}</strong><span className="small muted">task ≠ sent invitation</span></div>
    </div>

    <div className="admin-card" style={{marginTop:18}}>
      <div className="section-head compact-head"><div><div className="kpi">Research Queue</div><h2>Turn unclaimed inventory into evidence-backed contact paths</h2><p className="small muted">Default view is businesses still needing owner/decision-maker research. Contact details belong in the owner-contact fields only when a legitimate public source supports the association.</p></div>{hasFilters&&<Link className="btn btn-light" href="/admin/acquisition-research">Reset</Link>}</div>
      <form method="get" className="grid grid-4" style={{alignItems:'end'}}>
        <label className="field"><span>Work State</span><select name="state" defaultValue={state}><option value="research">Research needed</option><option value="provenance">Contact found / provenance incomplete</option><option value="ready">Claim-ready evidence</option><option value="task">Open contact-research task</option><option value="all">All linked prospects</option></select></label>
        <label className="field"><span>City / Market</span><select name="city" defaultValue={city}><option value="">All markets</option>{cities.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
        <label className="field"><span>Vertical</span><select name="vertical" defaultValue={vertical}><option value="">All verticals</option>{verticals.map(v=><option key={v} value={v}>{titleCase(v)}</option>)}</select></label>
        <label className="field"><span>Search</span><input name="q" defaultValue={one(sp.q)} placeholder="Business, contact, city, category"/></label>
        <div><button className="btn btn-primary" type="submit">Apply Research Filters</button></div>
      </form>
    </div>

    <div className="grid grid-3" style={{marginTop:18}}>
      <div className="admin-card"><div className="kpi">Research Discipline</div><h3>Generic ≠ owner contact</h3><p className="small muted">The listing phone, website or public company inbox can help research the business, but should not be copied into owner-contact fields unless the source identifies the decision-maker association.</p></div>
      <div className="admin-card"><div className="kpi">Location Discipline</div><h3>Service area ≠ office</h3><p className="small muted">A service-area business can be researched and acquired without inventing a physical branch in that market.</p></div>
      <div className="admin-card"><div className="kpi">Outreach Discipline</div><h3>Task ≠ sent</h3><p className="small muted">Claim and marketing timestamps remain evidence of actual outreach only. Research queue creation never advances them.</p></div>
    </div>

    <div className="admin-list-meta" style={{marginTop:18}}><span className="kpi">{filtered.length} matching research record{filtered.length===1?'':'s'} · showing {shown.length}</span><span className="small muted">Edit CRM/provenance fields below; owner contact verification should include a source URL and checked date.</span></div>
    {shown.length?<AdminEntityEditor section="prospects" cfg={cfg} rows={shown as unknown as Record<string,unknown>[]} />:<div className="notice">No acquisition records match the selected filters.</div>}
    {orphanResearchTasks>0&&<div className="notice warn" style={{marginTop:18}}>{orphanResearchTasks} open contact-research task{orphanResearchTasks===1?' is':'s are'} not currently tied to a linked published-business prospect. Review in Outreach Tasks before acting.</div>}
    <div className="admin-row-actions" style={{marginTop:18}}><Link className="btn btn-light" href="/admin/prospects">Full Sales CRM</Link><Link className="btn btn-light" href="/admin/growth-opportunities?type=contact_enrichment">Contact Enrichment Opportunities</Link><Link className="btn btn-light" href="/admin/outreach">Outreach Workbench</Link></div>
  </>
}
