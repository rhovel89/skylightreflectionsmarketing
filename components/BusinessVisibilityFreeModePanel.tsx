'use client'

import { FormEvent, useMemo, useState } from 'react'

type Row=Record<string,any>
type Props={business:{id:string;name:string;website:string|null};audits:Row[];rankings:Row[];importBatches:Row[];defaultLocation:string}
const date=(v:any)=>v?new Date(String(v)).toLocaleString():'—'
const pct=(n:number,d:number)=>d?`${Math.round(n/d*100)}%`:'Not measured'

export function BusinessVisibilityFreeModePanel({business,audits,rankings,importBatches,defaultLocation}:Props){
  const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('')
  const [csv,setCsv]=useState('keyword,location,device,surface,position,checked_at\n')
  const [provider,setProvider]=useState('import'),[sourceUrl,setSourceUrl]=useState(''),[providerRef,setProviderRef]=useState(''),[filename,setFilename]=useState('')
  const latest=audits.find(a=>a.status==='completed')||null
  const current=useMemo(()=>{const m=new Map<string,Row>();for(const r of rankings){const k=[r.keyword,r.search_location,r.device,r.surface].join('|');if(!m.has(k))m.set(k,r)}return [...m.values()]},[rankings])
  const measured=current.filter(r=>!r.not_found&&Number.isFinite(Number(r.position)))
  const top10=measured.filter(r=>Number(r.position)<=10).length
  const fixes=useMemo(()=>{
    const out:{service:string;reason:string;priority:string}[]=[]
    const issues=Array.isArray(latest?.issues)?latest.issues:[]
    const codes=new Set(issues.map((i:any)=>String(i?.code||'')))
    if(!business.website)out.push({service:'Web Design',reason:'No website is stored for this business.',priority:'High'})
    if(latest?.technical_score!=null&&Number(latest.technical_score)<70)out.push({service:'Technical SEO',reason:`Measured technical score is ${latest.technical_score}/100.`,priority:'High'})
    if(latest?.on_page_seo_score!=null&&Number(latest.on_page_seo_score)<75)out.push({service:'On-Page SEO',reason:`Measured on-page score is ${latest.on_page_seo_score}/100.`,priority:'High'})
    if(['title_missing','meta_description_missing','h1_missing','canonical_missing','schema_missing'].some(c=>codes.has(c)))out.push({service:'SEO Optimization',reason:'The live audit found missing or incomplete on-page SEO elements.',priority:'Medium'})
    if(latest?.performance_score!=null&&Number(latest.performance_score)<60)out.push({service:'Website Performance',reason:`Google PageSpeed performance measured ${latest.performance_score}/100.`,priority:'Medium'})
    if(current.length&&current.some(r=>r.not_found||Number(r.position)>10))out.push({service:'Local SEO / GBP',reason:'At least one source-backed tracked keyword is outside the Google Top 10 or not found.',priority:'High'})
    return out.slice(0,6)
  },[latest,current,business.website])

  async function post(action:string,payload:Row={}){
    setBusy(action);setError('');setMessage('')
    try{
      const r=await fetch('/api/admin/business-visibility-free',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,business_id:business.id,...payload})})
      const d=await r.json().catch(()=>({}))
      if(!r.ok)throw new Error(d.error||'Request failed.')
      setMessage(d.message||`Completed. ${d.pagespeed_mode?`PageSpeed mode: ${d.pagespeed_mode}.`:''}`)
      window.location.reload()
    }catch(e:any){setError(String(e?.message||e))}finally{setBusy('')}
  }
  async function importCsv(e:FormEvent){e.preventDefault();await post('import_rank_csv',{csv,provider,source_url:sourceUrl,provider_reference:providerRef,filename,default_location:defaultLocation,default_device:'desktop',default_surface:'organic'})}

  return <div style={{display:'grid',gap:18,marginBottom:22}}>
    <section className="card">
      <div className="eyebrow">Visibility Intelligence 4.1 — Free Mode</div>
      <h2 style={{marginBottom:6}}>Use the SEO intelligence system without a paid BrightLocal plan</h2>
      <p className="muted">Website auditing is free-first. Google PageSpeed is attempted without an API key when no key is configured. Google/Maps positions remain source-backed: manual entry or imported reports only—no Google scraping and no invented rankings.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><span className="badge good">$0 website audit mode</span><span className="badge good">PageSpeed key optional</span><span className="badge good">CSV / TSV rank import</span><span className="badge good">BrightLocal optional</span><span className="badge good">No public ranking effect</span></div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}><button className="btn btn-primary" disabled={!business.website||Boolean(busy)} onClick={()=>post('run_free_audit',{website:business.website})}>{busy==='run_free_audit'?'Running…':'Run Free Enhanced Website Audit'}</button></div>
      {message?<div className="notice good" style={{marginTop:12}}>{message}</div>:null}{error?<div className="notice bad" style={{marginTop:12}}>{error}</div>:null}
    </section>

    <section className="kpi-grid">
      <div className="kpi-card"><div className="kpi">Technical SEO</div><strong>{latest?.technical_score!=null?`${latest.technical_score}/100`:'Not audited'}</strong><small>Skylight deterministic score</small></div>
      <div className="kpi-card"><div className="kpi">PageSpeed</div><strong>{latest?.performance_score!=null?`${latest.performance_score}/100`:'Not measured'}</strong><small>{latest?.raw_summary?.pagespeed_mode==='free_no_key'?'Google free no-key mode':latest?.raw_summary?.pagespeed_mode==='keyed'?'Google keyed mode':'Run enhanced audit'}</small></div>
      <div className="kpi-card"><div className="kpi">Tracked Readings</div><strong>{current.length}</strong><small>{measured.length?`${top10} Top-10 (${pct(top10,measured.length)})`:'No measured positions yet'}</small></div>
      <div className="kpi-card"><div className="kpi">Import Batches</div><strong>{importBatches.length}</strong><small>Every bulk import keeps provenance</small></div>
    </section>

    <section className="card">
      <h2>What Skylight Can Fix</h2>
      <p className="muted small">Recommendations below are derived only from measured audit/ranking evidence. They are sales guidance, not guaranteed ranking outcomes.</p>
      {!fixes.length?<div className="empty-state">Run an enhanced website audit or add source-backed ranking data to generate factual service opportunities.</div>:<div className="table-wrap"><table><thead><tr><th>Priority</th><th>Service</th><th>Measured reason</th></tr></thead><tbody>{fixes.map((f,i)=><tr key={`${f.service}-${i}`}><td>{f.priority}</td><td><strong>{f.service}</strong></td><td>{f.reason}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="card">
      <h2>Bulk Rank Import — Free / Provider Independent</h2>
      <p className="muted small">Paste CSV or tab-delimited data. Accepted headers include keyword/search_term, location/search_location, device, surface/search_type, position/rank, and checked_at/date. Use a report URL or provider reference so every imported number has provenance.</p>
      <form onSubmit={importCsv}>
        <div className="form-grid">
          <label><span>Source</span><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="import">Generic import</option><option value="brightlocal">BrightLocal trial/export</option><option value="other">Other provider</option></select></label>
          <label><span>Report/source URL</span><input value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://..."/></label>
          <label><span>Provider/report reference</span><input value={providerRef} onChange={e=>setProviderRef(e.target.value)} placeholder="Report ID or export reference"/></label>
          <label><span>Filename (optional)</span><input value={filename} onChange={e=>setFilename(e.target.value)} placeholder="rankings.csv"/></label>
        </div>
        <label style={{display:'grid',gap:6,marginTop:12}}><span>CSV / TSV data</span><textarea rows={9} value={csv} onChange={e=>setCsv(e.target.value)} style={{fontFamily:'monospace'}}/></label>
        <button className="btn btn-primary" style={{marginTop:10}} disabled={Boolean(busy)||!csv.trim()||(!sourceUrl&&!providerRef)}>{busy==='import_rank_csv'?'Importing…':'Import Source-Backed Rankings'}</button>
      </form>
      {importBatches.length?<div className="table-wrap" style={{marginTop:16}}><table><thead><tr><th>Date</th><th>Provider</th><th>Rows</th><th>Status</th><th>Source</th></tr></thead><tbody>{importBatches.slice(0,20).map(r=><tr key={r.id}><td>{date(r.created_at)}</td><td>{r.provider}</td><td>{r.imported_rows} imported / {r.rejected_rows} rejected</td><td>{r.status}</td><td>{r.source_url?<a href={r.source_url} target="_blank" rel="noreferrer">Report ↗</a>:r.provider_reference||'—'}</td></tr>)}</tbody></table></div>:null}
    </section>
  </div>
}
