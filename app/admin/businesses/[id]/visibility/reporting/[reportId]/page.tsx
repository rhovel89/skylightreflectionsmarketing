import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { VisibilityReportPrintButton } from '@/components/VisibilityReportPrintButton'

export const dynamic='force-dynamic'
export const metadata={title:'Business Visibility Report | Skylight Reflections Marketing',robots:{index:false,follow:false}}
type Row=Record<string,any>
const fmt=(v:any,d=0)=>v==null?'Not measured':Number(v).toLocaleString(undefined,{maximumFractionDigits:d})
const pretty=(v:any)=>String(v??'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
const date=(v:any)=>v?new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—'
const compareValue=(v:any,unit:string)=>v==null?'Not measured':unit==='ratio'?`${(Number(v)*100).toFixed(1)}%`:unit==='points'?`${Number(v).toFixed(1)} pts`:unit==='position'?Number(v).toFixed(1):fmt(v,1)

export default async function Page({params}:{params:Promise<{id:string;reportId:string}>}){
  await requireStaff('/admin/businesses')
  const {id,reportId}=await params,s=await createClient()
  const [businessQ,reportQ]=await Promise.all([
    s.from('businesses').select('id,name,website,address_text,rating,review_count').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle(),
    s.from('business_visibility_reports').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).eq('id',reportId).maybeSingle(),
  ])
  if(businessQ.error||reportQ.error||!businessQ.data||!reportQ.data)notFound()
  const business=businessQ.data as Row,report=reportQ.data as Row,data=(report.snapshot_data||{}) as Row
  const components=Array.isArray(data.components)?data.components:[],comparisons=Array.isArray(data.comparisons)?data.comparisons:[],recommendations=Array.isArray(data.recommendations)?data.recommendations:[],sources=Array.isArray(data.source_manifest)?data.source_manifest:[],current=(data.current||{}) as Row
  const completed=recommendations.filter((r:any)=>r.status==='completed')
  const open=recommendations.filter((r:any)=>!['completed','dismissed'].includes(String(r.status)))

  return <div className="report-shell container" style={{padding:'24px 0 60px',maxWidth:1080}}>
    <style>{`@media print{.site-header,.site-footer,.no-print{display:none!important}.report-shell{max-width:none!important;padding:0!important}.card,.notice{break-inside:avoid;box-shadow:none!important}body{background:#fff!important}a{color:inherit;text-decoration:none}}`}</style>
    <div className="no-print" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:18}}><Link className="btn btn-light" href={`/admin/businesses/${id}/visibility/reporting`}>← Reporting Workspace</Link><VisibilityReportPrintButton/></div>

    <section className="card" style={{padding:28}}>
      <div className="eyebrow">Skylight Reflections Marketing</div>
      <h1 style={{margin:'8px 0 6px'}}>{report.title}</h1>
      <p className="muted" style={{marginTop:0}}>{business.name}{business.address_text?` · ${business.address_text}`:''}</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><span className="badge ok">{report.report_type==='prospect'?'Prospect Opportunity Report':'Client Performance Report'}</span><span className="badge">{pretty(report.status)}</span><span className="badge">Source-backed snapshot</span><span className="badge">Private / noindex</span></div>
      <p className="small muted" style={{marginTop:14}}>Report period: {report.period_start||'Not measured'} → {report.period_end||'Not measured'} · Created {date(report.created_at)}{report.finalized_at?` · Finalized ${date(report.finalized_at)}`:''}</p>
    </section>

    <section className="card"><h2>Executive summary</h2><p style={{fontSize:17,lineHeight:1.65}}>{report.executive_summary}</p><div className="kpi-grid" style={{marginTop:14}}><div className="kpi-card"><span>Opportunity score</span><strong>{data.opportunity_score==null?'Not measured':`${fmt(data.opportunity_score,1)}/100`}</strong><small>Higher means more measured room to improve</small></div><div className="kpi-card"><span>Opportunity band</span><strong>{pretty(data.opportunity_band||'not_measured')}</strong><small>Not a quality or ranking guarantee</small></div><div className="kpi-card"><span>Measurement coverage</span><strong>{fmt(data.measurement_coverage,0)}%</strong><small>Missing dimensions excluded from score</small></div><div className="kpi-card"><span>Recommendations</span><strong>{recommendations.length}</strong><small>{completed.length} completed · {open.length} active</small></div></div></section>

    <section className="card"><h2>Current visibility snapshot</h2><div className="kpi-grid"><div className="kpi-card"><span>Website health</span><strong>{current.website?.health==null?'Not measured':`${fmt(current.website.health,1)}/100`}</strong><small>{current.website?.checked_at?`Checked ${date(current.website.checked_at)}`:'No completed website audit'}</small></div><div className="kpi-card"><span>Organic clicks</span><strong>{fmt(current.search_console?.clicks)}</strong><small>{current.search_console?`${current.search_console.period_start} → ${current.search_console.period_end}`:'Search Console not measured'}</small></div><div className="kpi-card"><span>Organic impressions</span><strong>{fmt(current.search_console?.impressions)}</strong><small>{current.search_console?.position!=null?`Avg. position ${fmt(current.search_console.position,1)}`:'Average position not measured'}</small></div><div className="kpi-card"><span>Tracked rankings</span><strong>{fmt(current.rankings?.tracked)}</strong><small>{current.rankings?.top10!=null?`${current.rankings.top10} currently Top 10`:'Not measured'}</small></div><div className="kpi-card"><span>GBP actions</span><strong>{fmt(current.gbp?.current_total)}</strong><small>{current.gbp?.change_pct!=null?`${Number(current.gbp.change_pct)>0?'+':''}${fmt(current.gbp.change_pct,1)}% vs prior window`:'No comparable prior GBP window'}</small></div><div className="kpi-card"><span>Competitor comparisons</span><strong>{fmt(current.competitors?.rank_comparisons)}</strong><small>{current.competitors?.competitor_outranks!=null?`${current.competitors.competitor_outranks} competitor outrank measurements`:'Not measured'}</small></div></div></section>

    <section className="card"><h2>Opportunity score breakdown</h2>{!components.length?<div className="notice">No measured score components were available when this report was created.</div>:<div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Component</th><th>Weight</th><th>Opportunity</th><th>Evidence note</th></tr></thead><tbody>{components.map((c:any)=><tr key={c.key}><td><strong>{c.label}</strong></td><td>{c.weight}%</td><td>{c.score==null?'Not measured':`${fmt(c.score,1)}/100`}</td><td>{c.detail}</td></tr>)}</tbody></table></div>}</section>

    <section className="card"><h2>Before / after and period comparisons</h2>{!comparisons.length?<div className="notice">Insufficient comparable history. A single measurement is not presented as a trend.</div>:<div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Metric</th><th>Previous</th><th>Current</th><th>Change</th><th>Compared periods</th></tr></thead><tbody>{comparisons.map((c:any)=><tr key={c.key}><td><strong>{c.label}</strong></td><td>{compareValue(c.previous,c.unit)}</td><td>{compareValue(c.current,c.unit)}</td><td>{c.delta==null?'Not measured':`${Number(c.delta)>0?'+':''}${compareValue(c.delta,c.unit)}${c.delta_pct!=null?` (${Number(c.delta_pct)>0?'+':''}${fmt(c.delta_pct,1)}%)`:''}`}</td><td className="small">{c.previous_period}<br/>→ {c.current_period}</td></tr>)}</tbody></table></div>}</section>

    {report.report_type==='client'&&completed.length?<section className="card"><h2>Completed improvements</h2><div style={{display:'grid',gap:10}}>{completed.map((r:any)=><div className="notice" key={r.id||r.recommendation_key}><strong>{r.title}</strong><div className="small" style={{marginTop:4}}>{r.finding}</div><div className="small muted" style={{marginTop:4}}>Marked completed {r.completed_at?date(r.completed_at):'before this report snapshot'}.</div></div>)}</div></section>:null}

    <section className="card"><h2>{report.report_type==='prospect'?'Measured opportunities':'Recommended priorities'}</h2>{!open.length?<div className="notice">No active recommendation was captured in this report snapshot.</div>:<div style={{display:'grid',gap:12}}>{open.map((r:any)=><div className="notice" key={r.id||r.recommendation_key}><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><strong>{r.title}</strong><span className={`badge ${r.priority==='critical'||r.priority==='high'?'warn':''}`}>{pretty(r.priority)}</span><span className="badge">{pretty(r.category)}</span></div><p style={{margin:'8px 0 4px'}}><strong>Finding:</strong> {r.finding}</p><p style={{margin:'4px 0'}}><strong>Recommended action:</strong> {r.recommended_action}</p></div>)}</div>}</section>

    <section className="card"><h2>Source transparency</h2><p className="muted">This report is a saved snapshot of source-backed measurements. Source records are listed so findings can be traced. Missing data was excluded, not converted to zero.</p>{!sources.length?<div className="notice">No source manifest was available.</div>:<div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Source</th><th>Checked / period</th><th>Reference</th></tr></thead><tbody>{sources.slice(0,100).map((r:any)=><tr key={`${r.table}:${r.id}`}><td>{r.label||pretty(r.table)}</td><td>{r.checked_at||'—'}</td><td>{r.source_url?<a href={r.source_url} target="_blank" rel="noreferrer">Open source</a>:'Stored source record'}</td></tr>)}</tbody></table>{sources.length>100?<p className="small muted">Showing the first 100 source references of {sources.length} stored with this snapshot.</p>:null}</div>}</section>

    <section className="notice"><strong>Measurement disclosure:</strong> Search Console average position, organic rank measurements, Local Pack/Maps measurements, website audit scores, GBP performance and competitor measurements are separate signals. This report does not promise future rankings, traffic, leads or revenue. Paid directory products, Sponsored placement and Lead Buyer participation do not alter Central Illinois Local Pros organic ranking.</section>
  </div>
}
