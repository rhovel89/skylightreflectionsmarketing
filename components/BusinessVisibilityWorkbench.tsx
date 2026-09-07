'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Row=Record<string,any>
type Props={
  business:{id:string;name:string;website?:string|null;rating?:number|null;review_count?:number|null;source_name?:string|null;source_url?:string|null;source_checked_at?:string|null}
  audits:Row[]
  targets:Row[]
  rankings:Row[]
  suggestedKeywords:string[]
  defaultLocation:string
  brightLocalConfigured:boolean
  pageSpeedConfigured:boolean
}

const date=(value:any)=>{if(!value)return '—';const d=new Date(String(value));return Number.isNaN(d.getTime())?String(value):d.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}
const titleCase=(v:any)=>String(v??'').replaceAll('_',' ').replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase())
const score=(v:any)=>Number.isFinite(Number(v))?`${Math.round(Number(v))}/100`:'Not measured'
const position=(r:Row)=>r.not_found?'Not found':Number.isFinite(Number(r.position))?`#${Number(r.position)}`:'—'

export function BusinessVisibilityWorkbench({business,audits,targets,rankings,suggestedKeywords,defaultLocation,brightLocalConfigured,pageSpeedConfigured}:Props){
  const router=useRouter(),latest=audits.find(a=>a.status==='completed')||null
  const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('')
  const [targetId,setTargetId]=useState(targets[0]?.id||''),[notFound,setNotFound]=useState(false)
  const chosenTarget=useMemo(()=>targets.find(t=>String(t.id)===String(targetId))||null,[targets,targetId])
  const latestRanks=useMemo(()=>rankings.slice(0,60),[rankings])
  const organicBest=latestRanks.filter(r=>r.surface==='organic'&&!r.not_found&&Number.isFinite(Number(r.position))).reduce((best,r)=>Math.min(best,Number(r.position)),Infinity)
  const localBest=latestRanks.filter(r=>['local_pack','maps','local_finder'].includes(String(r.surface))&&!r.not_found&&Number.isFinite(Number(r.position))).reduce((best,r)=>Math.min(best,Number(r.position)),Infinity)
  const highIssues=Array.isArray(latest?.issues)?latest.issues.filter((i:any)=>i?.severity==='high').length:0

  async function post(action:string,payload:Row={}){
    setBusy(action);setMessage('');setError('')
    try{
      const response=await fetch('/api/admin/business-visibility',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,business_id:business.id,...payload})})
      const data=await response.json().catch(()=>({}))
      if(!response.ok||data?.error)throw new Error(data?.error||'Request failed.')
      setMessage(action==='run_website_audit'?'Website audit completed from the live site.':'Saved.')
      router.refresh()
    }catch(e:any){setError(String(e?.message||e))}finally{setBusy('')}
  }

  async function addTarget(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget)
    await post('save_target',{keyword:String(f.get('keyword')||''),search_location:String(f.get('search_location')||''),device:String(f.get('device')||'desktop'),preferred_provider:'brightlocal'})
    e.currentTarget.reset()
  }
  async function addRank(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!chosenTarget){setError('Add or choose a tracked keyword first.');return}
    const f=new FormData(e.currentTarget)
    await post('save_rank',{target_id:chosenTarget.id,keyword:chosenTarget.keyword,search_location:chosenTarget.search_location,device:chosenTarget.device,engine:'google',surface:String(f.get('surface')||'organic'),position:String(f.get('position')||''),not_found:notFound,provider:'manual',source_url:String(f.get('source_url')||''),checked_at:String(f.get('checked_at')||new Date().toISOString()),notes:String(f.get('notes')||'')})
    setNotFound(false);e.currentTarget.reset()
  }

  return <div>
    <div className="business-workspace-head">
      <div className="business-workspace-head-main">
        <div className="eyebrow">Skylight Business Visibility Intelligence</div>
        <h1>{business.name}</h1>
        <p>Google/local ranking history and source-backed website SEO intelligence. Measurements here never change Local Pros organic placement.</p>
      </div>
      <div className="business-workspace-head-actions">
        <button className="btn btn-primary" disabled={!business.website||Boolean(busy)} onClick={()=>post('run_website_audit',{website:business.website})}>{busy==='run_website_audit'?'Auditing…':'Run Live Website Audit'}</button>
        {business.website?<a className="btn btn-light" href={/^https?:\/\//i.test(business.website)?business.website:`https://${business.website}`} target="_blank" rel="noreferrer">Open Website</a>:null}
      </div>
    </div>

    {message?<div className="notice">{message}</div>:null}
    {error?<div className="notice warn"><strong>Visibility action failed:</strong> {error}</div>:null}
    {!business.website?<div className="notice warn"><strong>No website stored.</strong> Add the business website in the main workspace before running an audit.</div>:null}

    <div className="business-workspace-kpis">
      <Kpi label="On-Page SEO" value={latest?score(latest.on_page_seo_score):'Not audited'} detail="Skylight deterministic homepage audit" />
      <Kpi label="Technical" value={latest?score(latest.technical_score):'Not audited'} detail={latest?`${highIssues} high-priority issue${highIssues===1?'':'s'}`:'Run the live website audit'} />
      <Kpi label="Performance" value={latest?score(latest.performance_score):'Not measured'} detail={pageSpeedConfigured?'Google PageSpeed provider enabled':'Needs optional PageSpeed API key'} />
      <Kpi label="Best Organic" value={Number.isFinite(organicBest)?`#${organicBest}`:'Not measured'} detail="Best recorded Google organic position" />
      <Kpi label="Best Local / Maps" value={Number.isFinite(localBest)?`#${localBest}`:'Not measured'} detail="Best recorded local surface position" />
      <Kpi label="Freshness" value={latest?date(latest.checked_at):'—'} detail={latest?String(latest.provider||'direct site fetch'):'No website snapshot yet'} />
    </div>

    <section className="workspace-block">
      <div className="workspace-block-head"><div><div className="kpi">Live Website Audit</div><h2>Current Website SEO & Technical Health</h2><p>The audit fetches the business’s actual public homepage, follows validated public redirects, and records the source URL and checked time.</p></div></div>
      {latest?<>
        <div className="workspace-mini-stats">
          <Mini label="HTTP" value={latest.http_status??'—'} /><Mini label="HTTPS" value={latest.is_https?'Yes':'No'} /><Mini label="Indexable" value={latest.indexable?'Yes':'No'} /><Mini label="Response" value={latest.response_ms!=null?`${latest.response_ms} ms`:'—'} /><Mini label="Words" value={latest.word_count??'—'} /><Mini label="Schema Types" value={Array.isArray(latest.schema_types)?latest.schema_types.length:0} />
        </div>
        <div className="admin-grid two" style={{marginTop:16}}>
          <div className="admin-card"><h3>On-page signals</h3><p><strong>Title:</strong> {latest.title||'Missing'}</p><p><strong>Meta description:</strong> {latest.meta_description||'Missing'}</p><p><strong>H1:</strong> {latest.h1||'Missing'} {latest.h1_count!=null?`(${latest.h1_count} detected)`:''}</p><p><strong>Canonical:</strong> {latest.canonical_url||'Missing'}</p><p><strong>Robots:</strong> {latest.robots_meta||'No noindex directive detected'}</p><p><strong>Language:</strong> {latest.html_lang||'Missing'}</p></div>
          <div className="admin-card"><h3>Technical signals</h3><p><strong>robots.txt:</strong> {latest.robots_txt_status??'Not measured'}</p><p><strong>sitemap.xml:</strong> {latest.sitemap_status??'Not measured'}</p><p><strong>Homepage bytes:</strong> {latest.page_size_bytes??'—'}</p><p><strong>Links:</strong> {latest.internal_link_count??0} internal · {latest.external_link_count??0} external</p><p><strong>Images:</strong> {latest.image_count??0} total · {latest.images_missing_alt??0} missing alt</p><p><strong>JSON-LD:</strong> {(latest.schema_types||[]).join(', ')||'None detected'}</p></div>
        </div>
        <div style={{marginTop:16}}><h3>Audit opportunities</h3>{Array.isArray(latest.issues)&&latest.issues.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Priority</th><th>Issue</th><th>Evidence</th></tr></thead><tbody>{latest.issues.map((i:any,index:number)=><tr key={`${i.code}-${index}`}><td><span className={`badge ${i.severity==='high'?'warn':'neutral'}`}>{titleCase(i.severity)}</span></td><td>{i.label}</td><td>{i.detail}</td></tr>)}</tbody></table></div>:<div className="notice">No deterministic homepage audit issues were detected in this snapshot.</div>}</div>
        <p className="muted small" style={{marginTop:12}}>Source: <a href={latest.source_url||latest.final_url} target="_blank" rel="noreferrer">{latest.source_url||latest.final_url}</a> · checked {date(latest.checked_at)}. These internal scores are not Google ranking scores.</p>
      </>:<div className="empty">No successful website audit exists yet.</div>}
    </section>

    <section className="workspace-block">
      <div className="workspace-block-head"><div><div className="kpi">Google & Local Search</div><h2>Keyword Ranking Tracker</h2><p>Track the exact keyword, search location, device and Google surface. A ranking is shown only when a source-backed reading exists.</p></div></div>
      <div className={brightLocalConfigured?'notice':'notice warn'}><strong>BrightLocal connector:</strong> {brightLocalConfigured?'API key detected. Automated report synchronization can be enabled against configured BrightLocal reports.':'No API key is configured yet. The tracker still works with source-backed manual/report readings; it will not scrape Google or guess rankings.'}</div>
      <form onSubmit={addTarget} className="admin-card" style={{marginTop:16}}>
        <h3>Add tracked keyword</h3><div className="admin-form-grid">
          <label>Keyword<input name="keyword" list="visibility-keywords" required placeholder="plumber near me" /><datalist id="visibility-keywords">{suggestedKeywords.map(k=><option value={k} key={k}/>)}</datalist></label>
          <label>Search location<input name="search_location" required defaultValue={defaultLocation} placeholder="Pontiac, IL" /></label>
          <label>Device<select name="device" defaultValue="desktop"><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></label>
        </div><button className="btn btn-primary" disabled={Boolean(busy)}>Add Keyword Target</button>
      </form>

      <div style={{marginTop:18}}>{targets.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Keyword</th><th>Location</th><th>Device</th><th>Provider</th><th></th></tr></thead><tbody>{targets.map(t=><tr key={t.id}><td><strong>{t.keyword}</strong></td><td>{t.search_location}</td><td>{titleCase(t.device)}</td><td>{titleCase(t.preferred_provider)}</td><td><button className="btn btn-light" onClick={()=>post('delete_target',{id:t.id})} disabled={Boolean(busy)}>Remove</button></td></tr>)}</tbody></table></div>:<div className="empty">No ranking targets yet. Suggested keywords above are ideas only, not measured rankings.</div>}</div>

      <form onSubmit={addRank} className="admin-card" style={{marginTop:18}}>
        <h3>Record a source-backed Google reading</h3><p className="muted small">Use this for a BrightLocal/report reading until the API connector is configured. Manual entries require a source/report URL.</p>
        <div className="admin-form-grid">
          <label>Tracked keyword<select value={targetId} onChange={e=>setTargetId(e.target.value)} required><option value="">Choose target</option>{targets.map(t=><option value={t.id} key={t.id}>{t.keyword} — {t.search_location} ({t.device})</option>)}</select></label>
          <label>Google surface<select name="surface" defaultValue="organic"><option value="organic">Organic</option><option value="local_pack">Local Pack</option><option value="maps">Google Maps</option><option value="local_finder">Local Finder</option></select></label>
          <label>Position<input name="position" type="number" min="1" max="100" disabled={notFound} placeholder="1" /></label>
          <label>Checked at<input name="checked_at" type="datetime-local" defaultValue={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)} required /></label>
          <label style={{gridColumn:'1 / -1'}}>Source / report URL<input name="source_url" type="url" required placeholder="https://..." /></label>
          <label style={{gridColumn:'1 / -1'}}>Notes<input name="notes" placeholder="Optional context about search location/report" /></label>
        </div>
        <label className="checkbox-row"><input type="checkbox" checked={notFound} onChange={e=>setNotFound(e.target.checked)} /> Not found in the provider’s measured range</label>
        <button className="btn btn-primary" disabled={!chosenTarget||Boolean(busy)}>Save Ranking Reading</button>
      </form>

      <div style={{marginTop:18}}><h3>Ranking history</h3>{latestRanks.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Checked</th><th>Keyword</th><th>Location</th><th>Surface</th><th>Position</th><th>Device</th><th>Source</th><th></th></tr></thead><tbody>{latestRanks.map(r=><tr key={r.id}><td>{date(r.checked_at)}</td><td>{r.keyword}</td><td>{r.search_location}</td><td>{titleCase(r.surface)}</td><td><strong>{position(r)}</strong></td><td>{titleCase(r.device)}</td><td>{r.source_url?<a href={r.source_url} target="_blank" rel="noreferrer">{titleCase(r.provider)}</a>:titleCase(r.provider)}</td><td><button className="btn btn-light" onClick={()=>post('delete_rank',{id:r.id})} disabled={Boolean(busy)}>Delete</button></td></tr>)}</tbody></table></div>:<div className="empty">No Google/local ranking readings exist yet. The system intentionally shows “Not measured” instead of estimating a position.</div>}</div>
    </section>

    <section className="workspace-block">
      <div className="workspace-block-head"><div><div className="kpi">History & Provenance</div><h2>Website Audit History</h2><p>Snapshots are append-only so staff can compare changes without rewriting the prior evidence.</p></div></div>
      {audits.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Checked</th><th>Status</th><th>On-page SEO</th><th>Technical</th><th>Performance</th><th>HTTP</th><th>Provider</th></tr></thead><tbody>{audits.slice(0,25).map(a=><tr key={a.id}><td>{date(a.checked_at)}</td><td>{titleCase(a.status)}</td><td>{a.status==='completed'?score(a.on_page_seo_score):'—'}</td><td>{a.status==='completed'?score(a.technical_score):'—'}</td><td>{a.status==='completed'?score(a.performance_score):'—'}</td><td>{a.http_status??'—'}</td><td>{titleCase(a.provider)}</td></tr>)}</tbody></table></div>:<div className="empty">No website audit snapshots.</div>}
    </section>
  </div>
}

function Kpi({label,value,detail}:{label:string;value:string|number;detail:string}){return <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>}
function Mini({label,value}:{label:string;value:string|number}){return <div><span>{label}</span><strong>{value}</strong></div>}
