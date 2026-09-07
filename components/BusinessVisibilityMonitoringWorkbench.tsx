'use client'

import { useMemo, useState } from 'react'

type Row=Record<string,any>
type Props={
  business:{id:string;name:string;website:string|null;rating:number|null;review_count:number|null}
  prospect:Row|null
  policy:Row|null
  audits:Row[]
  targets:Row[]
  rankings:Row[]
  competitors:Row[]
  competitorAudits:Row[]
  competitorRankings:Row[]
  alerts:Row[]
  salesEvidence:Row[]
  brightLocalConfigured:boolean
  pageSpeedConfigured:boolean
  scheduledMonitoringConfigured:boolean
}

const fmtDate=(v:any)=>v?new Date(String(v)).toLocaleString():'Not measured'
const fmtPos=(r:Row|null|undefined)=>!r?'Not measured':r.not_found?'Not found':Number.isFinite(Number(r.position))?`#${Number(r.position)}`:'Not measured'
const tone=(n:number|null)=>n===null?'muted':n>=80?'good':n>=55?'warn':'bad'
const text=(v:any)=>String(v??'').trim()

function latestBy(rows:Row[],key:(r:Row)=>string){
  const map=new Map<string,Row[]>()
  for(const row of rows){const k=key(row);const a=map.get(k)||[];a.push(row);map.set(k,a)}
  return [...map.entries()].map(([k,a])=>({key:k,current:a[0]||null,previous:a[1]||null}))
}
function rankKey(r:Row){return text(r.target_id)||[r.keyword,r.search_location,r.engine,r.surface,r.device].join('|')}
function positionValue(r:Row|null){return !r?null:r.not_found?101:(Number.isInteger(Number(r.position))?Number(r.position):null)}
function scorePosition(v:number|null){
  if(v===null)return null
  if(v===101)return 0
  if(v<=3)return 100-(v-1)*5
  if(v<=10)return 88-(v-4)*4
  if(v<=20)return 60-(v-11)*3
  if(v<=50)return 30-Math.floor((v-21)/3)
  return 8
}

export function BusinessVisibilityMonitoringWorkbench(props:Props){
  const {business,prospect,policy,audits,targets,rankings,competitors,competitorAudits,competitorRankings,alerts,salesEvidence}=props
  const [busy,setBusy]=useState('')
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const [webEnabled,setWebEnabled]=useState(policy?.website_monitoring_enabled!==false)
  const [webHours,setWebHours]=useState(String(policy?.website_interval_hours||168))
  const [rankEnabled,setRankEnabled]=useState(Boolean(policy?.rank_monitoring_enabled))
  const [rankHours,setRankHours]=useState(String(policy?.rank_interval_hours||168))
  const [compEnabled,setCompEnabled]=useState(Boolean(policy?.competitor_monitoring_enabled))
  const [competitorName,setCompetitorName]=useState('')
  const [competitorWebsite,setCompetitorWebsite]=useState('')
  const [competitorSource,setCompetitorSource]=useState('')
  const [rankCompetitor,setRankCompetitor]=useState('')
  const [rankTarget,setRankTarget]=useState('')
  const [rankKeyword,setRankKeyword]=useState('')
  const [rankLocation,setRankLocation]=useState('')
  const [rankSurface,setRankSurface]=useState('organic')
  const [rankDevice,setRankDevice]=useState('desktop')
  const [rankPosition,setRankPosition]=useState('')
  const [rankNotFound,setRankNotFound]=useState(false)
  const [rankSource,setRankSource]=useState('')

  const grouped=useMemo(()=>latestBy(rankings,rankKey),[rankings])
  const currentRanks=grouped.map(x=>x.current).filter(Boolean) as Row[]
  const measured=currentRanks.filter(r=>!r.not_found&&Number.isInteger(Number(r.position)))
  const top3=measured.filter(r=>Number(r.position)<=3).length
  const top10=measured.filter(r=>Number(r.position)<=10).length
  const top20=measured.filter(r=>Number(r.position)<=20).length
  const gains=grouped.filter(({current,previous})=>{const a=positionValue(current),b=positionValue(previous);return a!==null&&b!==null&&a<b}).length
  const losses=grouped.filter(({current,previous})=>{const a=positionValue(current),b=positionValue(previous);return a!==null&&b!==null&&a>b}).length
  const visibilityScore=measured.length||currentRanks.some(r=>r.not_found)
    ?Math.round(currentRanks.map(r=>scorePosition(positionValue(r))).filter((v):v is number=>v!==null).reduce((a,b)=>a+b,0)/Math.max(1,currentRanks.length))
    :null
  const latestAudit=audits[0]||null,previousAudit=audits[1]||null
  const opportunityScore=useMemo(()=>{
    const signals:number[]=[]
    if(latestAudit?.technical_score!==null&&latestAudit?.technical_score!==undefined)signals.push(100-Number(latestAudit.technical_score))
    if(latestAudit?.on_page_seo_score!==null&&latestAudit?.on_page_seo_score!==undefined)signals.push(100-Number(latestAudit.on_page_seo_score))
    if(visibilityScore!==null)signals.push(100-visibilityScore)
    return signals.length?Math.round(signals.reduce((a,b)=>a+b,0)/signals.length):null
  },[latestAudit,visibilityScore])
  const openAlerts=alerts.filter(r=>r.status==='open')
  const activeCompetitors=competitors.filter(r=>r.active!==false)
  const evidenceKeys=new Set(salesEvidence.filter(r=>r.status==='approved').map(r=>`${r.source_table}:${r.source_record_id}`))

  const latestCompetitorAudit=new Map<string,Row>()
  for(const row of competitorAudits)if(!latestCompetitorAudit.has(String(row.competitor_id)))latestCompetitorAudit.set(String(row.competitor_id),row)

  const ownLatest=new Map(grouped.map(g=>[g.key,g.current]))
  const compLatest=latestBy(competitorRankings,r=>`${r.competitor_id}|${rankKey(r)}`).map(g=>g.current).filter(Boolean) as Row[]

  async function act(action:string,payload:Row={}){
    setBusy(action+text(payload.id||payload.competitor_id||payload.source_record_id))
    setError('');setNotice('')
    try{
      const res=await fetch('/api/admin/business-visibility-monitoring',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,business_id:business.id,...payload})})
      const data=await res.json()
      if(!res.ok)throw new Error(data.error||'Action failed.')
      setNotice(data.message||'Saved.')
      window.location.reload()
    }catch(e:any){setError(String(e?.message||e))}finally{setBusy('')}
  }

  function chooseTarget(id:string){
    setRankTarget(id)
    const t=targets.find(r=>String(r.id)===id)
    if(t){setRankKeyword(text(t.keyword));setRankLocation(text(t.search_location));setRankDevice(text(t.device)||'desktop')}
  }

  return <div style={{display:'grid',gap:20}}>
    <section className="card">
      <div className="eyebrow">Business Visibility Intelligence 4.0</div>
      <h1 style={{marginBottom:6}}>{business.name}: Monitoring & Competitor Intelligence</h1>
      <p className="muted" style={{maxWidth:980}}>
        This private workspace compares factual website snapshots and source-backed ranking readings over time. Missing data stays “Not measured.” Competitor evidence is stored separately and never changes this business’s public Local Pros ranking.
      </p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <span className={`badge ${props.scheduledMonitoringConfigured?'good':'warn'}`}>{props.scheduledMonitoringConfigured?'Scheduled runtime ready':'Scheduled runtime not configured'}</span>
        <span className={`badge ${props.brightLocalConfigured?'good':'muted'}`}>{props.brightLocalConfigured?'BrightLocal key present':'BrightLocal key not configured'}</span>
        <span className={`badge ${props.pageSpeedConfigured?'good':'muted'}`}>{props.pageSpeedConfigured?'PageSpeed metrics enabled':'PageSpeed optional metrics off'}</span>
        <span className="badge good">Public ranking effect: none</span>
        <span className="badge good">Sales evidence: human approval only</span>
      </div>
      {!props.scheduledMonitoringConfigured?<div className="notice warn" style={{marginTop:14}}>
        Automatic scheduled execution is intentionally inactive until both CRON_SECRET and the server-side Supabase service credential are configured. Manual Run Now monitoring remains available to staff.
      </div>:null}
      {!props.brightLocalConfigured?<div className="notice" style={{marginTop:10}}>
        Google/Maps auto-sync is not active. Rank history remains source-backed manual/import data until a verified ranking-provider integration is configured.
      </div>:null}
    </section>

    {notice?<div className="notice good">{notice}</div>:null}
    {error?<div className="notice bad">{error}</div>:null}

    <section className="kpi-grid">
      <div className="kpi-card"><div className="kpi">Visibility Score</div><strong className={tone(visibilityScore)}>{visibilityScore===null?'Not measured':`${visibilityScore}/100`}</strong><small>Skylight score from measured current ranks</small></div>
      <div className="kpi-card"><div className="kpi">SEO Opportunity</div><strong>{opportunityScore===null?'Not measured':`${opportunityScore}/100`}</strong><small>Higher = more measurable room to improve</small></div>
      <div className="kpi-card"><div className="kpi">Top 3</div><strong>{currentRanks.length?top3:'Not measured'}</strong><small>of {currentRanks.length||0} current tracked readings</small></div>
      <div className="kpi-card"><div className="kpi">Top 10</div><strong>{currentRanks.length?top10:'Not measured'}</strong><small>Top 20: {currentRanks.length?top20:'Not measured'}</small></div>
      <div className="kpi-card"><div className="kpi">Movement</div><strong>{grouped.length?`↑ ${gains} / ↓ ${losses}`:'Not measured'}</strong><small>Compared with prior actual reading</small></div>
      <div className="kpi-card"><div className="kpi">Website Technical</div><strong className={tone(latestAudit?.technical_score??null)}>{latestAudit?.technical_score??'Not measured'}{latestAudit?.technical_score!=null?'/100':''}</strong><small>{previousAudit?.technical_score!=null&&latestAudit?.technical_score!=null?`Prior ${previousAudit.technical_score}/100`:fmtDate(latestAudit?.checked_at)}</small></div>
      <div className="kpi-card"><div className="kpi">Open Alerts</div><strong>{openAlerts.length}</strong><small>{openAlerts.filter(r=>r.severity==='critical').length} critical</small></div>
      <div className="kpi-card"><div className="kpi">Competitors</div><strong>{activeCompetitors.length}</strong><small>{salesEvidence.filter(r=>r.status==='approved').length} approved Sales evidence items</small></div>
    </section>

    <section className="card">
      <h2>Monitoring Policy</h2>
      <p className="muted small">Intervals are stored now. Scheduled execution is fail-closed until the production runtime credentials are present.</p>
      <div className="form-grid">
        <label><span>Website monitoring</span><select value={webEnabled?'yes':'no'} onChange={e=>setWebEnabled(e.target.value==='yes')}><option value="yes">Enabled</option><option value="no">Disabled</option></select></label>
        <label><span>Website interval</span><select value={webHours} onChange={e=>setWebHours(e.target.value)}><option value="24">Daily</option><option value="72">Every 3 days</option><option value="168">Weekly</option><option value="336">Every 2 weeks</option><option value="720">Monthly</option></select></label>
        <label><span>Rank monitoring</span><select value={rankEnabled?'yes':'no'} onChange={e=>setRankEnabled(e.target.value==='yes')}><option value="no">Disabled</option><option value="yes">Enabled when provider is ready</option></select></label>
        <label><span>Rank interval</span><select value={rankHours} onChange={e=>setRankHours(e.target.value)}><option value="24">Daily</option><option value="72">Every 3 days</option><option value="168">Weekly</option><option value="336">Every 2 weeks</option><option value="720">Monthly</option></select></label>
        <label><span>Competitor monitoring</span><select value={compEnabled?'yes':'no'} onChange={e=>setCompEnabled(e.target.value==='yes')}><option value="no">Disabled</option><option value="yes">Enabled</option></select></label>
      </div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}>
        <button className="btn btn-primary" disabled={Boolean(busy)} onClick={()=>act('save_policy',{website_monitoring_enabled:webEnabled,website_interval_hours:Number(webHours),rank_monitoring_enabled:rankEnabled,rank_interval_hours:Number(rankHours),competitor_monitoring_enabled:compEnabled})}>Save Monitoring Policy</button>
        <button className="btn btn-light" disabled={Boolean(busy)||!business.website} onClick={()=>act('run_monitoring_now')}>Run Website + Competitor Monitoring Now</button>
      </div>
      <div className="muted small" style={{marginTop:10}}>
        Last website run: {fmtDate(policy?.last_website_audit_at)} · Next website due: {fmtDate(policy?.next_website_audit_at)} · Last status: {policy?.last_run_status||'Not run'}
      </div>
    </section>

    <section className="card">
      <h2>Ranking Trend</h2>
      <p className="muted small">Only actual stored readings are compared. “Not found” is not displayed as a fabricated numeric rank.</p>
      {!grouped.length?<div className="empty-state">No ranking history measured yet. Add source-backed readings in Google & SEO Visibility 3.9.</div>:
      <div className="table-wrap"><table><thead><tr><th>Keyword</th><th>Location</th><th>Surface</th><th>Current</th><th>Previous</th><th>Movement</th><th>Checked</th><th>Source</th></tr></thead><tbody>
        {grouped.slice(0,100).map(({key,current,previous})=>{
          const a=positionValue(current),b=positionValue(previous)
          const movement=a!==null&&b!==null?(a<b?`↑ ${b-a}`:a>b?`↓ ${a-b}`:'—'):'Not measured'
          return <tr key={key}><td><strong>{current.keyword}</strong></td><td>{current.search_location}</td><td>{current.surface} / {current.device}</td><td>{fmtPos(current)}</td><td>{fmtPos(previous)}</td><td>{movement}</td><td>{fmtDate(current.checked_at)}</td><td>{current.source_url?<a href={current.source_url} target="_blank" rel="noreferrer">Evidence ↗</a>:current.provider_reference||current.provider}</td></tr>
        })}
      </tbody></table></div>}
    </section>

    <section className="card">
      <h2>Competitor Intelligence</h2>
      <p className="muted small">A competitor must have a source URL and checked date. It is not inferred from category proximity or invented by the system.</p>
      <div className="form-grid">
        <label><span>Competitor name</span><input value={competitorName} onChange={e=>setCompetitorName(e.target.value)} placeholder="Actual competitor business"/></label>
        <label><span>Website</span><input value={competitorWebsite} onChange={e=>setCompetitorWebsite(e.target.value)} placeholder="https://..."/></label>
        <label><span>Evidence/source URL *</span><input value={competitorSource} onChange={e=>setCompetitorSource(e.target.value)} placeholder="https://source-or-report..."/></label>
      </div>
      <button className="btn btn-primary" style={{marginTop:10}} disabled={Boolean(busy)||!competitorName||!competitorSource} onClick={()=>act('add_competitor',{competitor_name:competitorName,website_url:competitorWebsite,source_url:competitorSource})}>Add Source-Backed Competitor</button>

      <div style={{display:'grid',gap:12,marginTop:18}}>
        {activeCompetitors.length===0?<div className="empty-state">No competitors have been documented yet.</div>:activeCompetitors.map(c=>{
          const audit=latestCompetitorAudit.get(String(c.id))
          return <div className="subcard" key={c.id}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
              <div><strong>{c.competitor_name}</strong><div className="muted small">{c.website_url||'Website not recorded'} · source checked {fmtDate(c.source_checked_at)}</div></div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {c.website_url?<button className="btn btn-light btn-small" disabled={Boolean(busy)} onClick={()=>act('audit_competitor_now',{competitor_id:c.id})}>Audit Website</button>:null}
                <button className="btn btn-light btn-small" disabled={Boolean(busy)} onClick={()=>act('deactivate_competitor',{competitor_id:c.id})}>Deactivate</button>
              </div>
            </div>
            <div className="small" style={{marginTop:8}}>
              Latest audit: Technical <strong>{audit?.technical_score??'Not measured'}</strong> · On-page <strong>{audit?.on_page_seo_score??'Not measured'}</strong> · Performance <strong>{audit?.performance_score??'Not measured'}</strong> · {fmtDate(audit?.checked_at)}
              {c.source_url?<span> · <a href={c.source_url} target="_blank" rel="noreferrer">Competitor provenance ↗</a></span>:null}
            </div>
          </div>
        })}
      </div>

      <h3 style={{marginTop:22}}>Add Competitor Rank Reading</h3>
      <div className="form-grid">
        <label><span>Competitor *</span><select value={rankCompetitor} onChange={e=>setRankCompetitor(e.target.value)}><option value="">Select...</option>{activeCompetitors.map(c=><option key={c.id} value={c.id}>{c.competitor_name}</option>)}</select></label>
        <label><span>Tracked keyword</span><select value={rankTarget} onChange={e=>chooseTarget(e.target.value)}><option value="">Manual keyword</option>{targets.map(t=><option key={t.id} value={t.id}>{t.keyword} — {t.search_location}</option>)}</select></label>
        <label><span>Keyword *</span><input value={rankKeyword} onChange={e=>setRankKeyword(e.target.value)}/></label>
        <label><span>Search location *</span><input value={rankLocation} onChange={e=>setRankLocation(e.target.value)}/></label>
        <label><span>Google surface</span><select value={rankSurface} onChange={e=>setRankSurface(e.target.value)}><option value="organic">Organic</option><option value="local_pack">Local Pack</option><option value="maps">Maps</option><option value="local_finder">Local Finder</option></select></label>
        <label><span>Device</span><select value={rankDevice} onChange={e=>setRankDevice(e.target.value)}><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></label>
        <label><span>Position</span><input type="number" min="1" max="100" value={rankPosition} disabled={rankNotFound} onChange={e=>setRankPosition(e.target.value)}/></label>
        <label><span>Not found</span><select value={rankNotFound?'yes':'no'} onChange={e=>setRankNotFound(e.target.value==='yes')}><option value="no">No</option><option value="yes">Yes</option></select></label>
        <label><span>Source/report URL *</span><input value={rankSource} onChange={e=>setRankSource(e.target.value)} placeholder="https://..."/></label>
      </div>
      <button className="btn btn-primary" style={{marginTop:10}} disabled={Boolean(busy)||!rankCompetitor||!rankKeyword||!rankLocation||!rankSource||(!rankNotFound&&!rankPosition)}
        onClick={()=>act('save_competitor_rank',{competitor_id:rankCompetitor,target_id:rankTarget||null,keyword:rankKeyword,search_location:rankLocation,surface:rankSurface,device:rankDevice,position:rankPosition,not_found:rankNotFound,source_url:rankSource})}>
        Save Source-Backed Competitor Rank
      </button>

      {compLatest.length?<div className="table-wrap" style={{marginTop:18}}><table><thead><tr><th>Competitor</th><th>Keyword</th><th>Location</th><th>Competitor</th><th>Business</th><th>Comparison</th><th>Checked</th></tr></thead><tbody>
        {compLatest.slice(0,80).map(r=>{
          const c=competitors.find(x=>String(x.id)===String(r.competitor_id))
          const own=ownLatest.get(rankKey(r))
          const cv=positionValue(r),ov=positionValue(own||null)
          const comparison=cv!==null&&ov!==null?(cv<ov?'Competitor ahead':cv>ov?'Business ahead':'Tied'):'Not measured'
          return <tr key={r.id}><td>{c?.competitor_name||'Competitor'}</td><td>{r.keyword}</td><td>{r.search_location}</td><td>{fmtPos(r)}</td><td>{fmtPos(own)}</td><td>{comparison}</td><td>{fmtDate(r.checked_at)}</td></tr>
        })}
      </tbody></table></div>:null}
    </section>

    <section className="card">
      <h2>Visibility Alerts</h2>
      <p className="muted small">Alerts are generated from factual snapshot changes: outages, noindex, score regressions, rank movement, Top‑3/10 changes, and measured competitor outranking.</p>
      {!alerts.length?<div className="empty-state">No visibility changes have triggered an alert yet.</div>:
      <div style={{display:'grid',gap:10}}>{alerts.map(a=>{
        const approved=evidenceKeys.has(`${a.source_table}:${a.source_record_id}`)
        return <div className={`notice ${a.severity==='critical'?'bad':a.severity==='warning'?'warn':''}`} key={a.id}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <div><strong>{a.title}</strong><div className="small">{a.detail}</div><div className="muted small">{a.alert_type} · {a.severity} · {fmtDate(a.last_seen_at)}</div></div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <span className="badge">{a.status}</span>
              {a.status==='open'?<button className="btn btn-light btn-small" disabled={Boolean(busy)} onClick={()=>act('set_alert_status',{id:a.id,status:'acknowledged'})}>Acknowledge</button>:null}
              {a.status!=='resolved'?<button className="btn btn-light btn-small" disabled={Boolean(busy)} onClick={()=>act('set_alert_status',{id:a.id,status:'resolved'})}>Resolve</button>:null}
              {prospect&&!approved?<button className="btn btn-primary btn-small" disabled={Boolean(busy)} onClick={()=>act('approve_sales_evidence',{evidence_type:'visibility_alert',source_table:'business_visibility_alerts',source_record_id:a.id})}>Approve as Sales Evidence</button>:null}
              {approved?<span className="badge good">Sales evidence approved</span>:null}
            </div>
          </div>
        </div>
      })}</div>}
    </section>

    <section className="card">
      <h2>Human-Approved Sales Evidence</h2>
      <p className="muted small">This evidence is available for staff review. Approval never sends outreach, enrolls a campaign, changes public ranking, or authorizes billing.</p>
      {!salesEvidence.length?<div className="empty-state">{prospect?'No visibility evidence has been approved for Sales yet.':'This business is not linked to a prospect, so Sales evidence cannot be created.'}</div>:
      <div className="table-wrap"><table><thead><tr><th>Evidence</th><th>Type</th><th>Checked</th><th>Status</th><th>Source</th><th></th></tr></thead><tbody>
        {salesEvidence.map(e=><tr key={e.id}><td style={{maxWidth:520}}>{e.evidence_summary}</td><td>{e.evidence_type}</td><td>{fmtDate(e.source_checked_at)}</td><td>{e.status}</td><td>{e.source_url?<a href={e.source_url} target="_blank" rel="noreferrer">Evidence ↗</a>:e.source_table}</td><td>{e.status==='approved'?<button className="btn btn-light btn-small" disabled={Boolean(busy)} onClick={()=>act('revoke_sales_evidence',{id:e.id})}>Revoke</button>:null}</td></tr>)}
      </tbody></table></div>}
    </section>
  </div>
}
