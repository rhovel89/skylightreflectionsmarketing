'use client'

import{FormEvent,useMemo,useState}from'react'
import{createClient}from'@/lib/supabase/client'

type R=Record<string,any>
const types=['short_text','long_text','number','url','email','phone','date','single_select','multi_select','checkbox']
const defaultMimes='image/jpeg, image/png, image/webp, application/pdf'
const pretty=(v:any)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())
const stamp=(v:any)=>v?new Date(v).toLocaleString():'—'
const answer=(v:any)=>v==null?'—':Array.isArray(v)?v.join(', '):typeof v==='object'?JSON.stringify(v):String(v)
async function post(payload:R){const r=await fetch('/api/admin/skylight-intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(String(b.error||'Request failed'));return b}

export function SkylightIntakeTemplateManager({services,questions,assetRequirements,projects,projectFields,projectRequirements,projectAssets,clients}:{services:R[];questions:R[];assetRequirements:R[];projects:R[];projectFields:R[];projectRequirements:R[];projectAssets:R[];clients:R[]}){
 const[tab,setTab]=useState<'templates'|'projects'>('templates')
 const[msg,setMsg]=useState('')
 const[busy,setBusy]=useState(false)
 const clientMap=useMemo(()=>new Map(clients.map(x=>[String(x.id),x])),[clients])
 const qByService=useMemo(()=>group(questions,'service_id'),[questions])
 const reqByService=useMemo(()=>group(assetRequirements,'service_id'),[assetRequirements])
 const fieldsByProject=useMemo(()=>group(projectFields,'project_id'),[projectFields])
 const reqByProject=useMemo(()=>group(projectRequirements,'project_id'),[projectRequirements])
 const assetsByProject=useMemo(()=>group(projectAssets,'project_id'),[projectAssets])
 const configured=services.filter(s=>(qByService.get(String(s.id))||[]).some(x=>x.active)||(reqByService.get(String(s.id))||[]).some(x=>x.active)).length
 const pending=projects.filter(p=>p.intake_status==='submitted').length
 const inProgress=projects.filter(p=>['pending','in_progress'].includes(String(p.intake_status))).length
 const reviewed=projects.filter(p=>p.intake_status==='reviewed').length
 const run=async(payload:R,ok:string)=>{setBusy(true);setMsg('');try{await post(payload);setMsg(ok);location.reload()}catch(e:any){setMsg(String(e?.message||'Request failed'))}finally{setBusy(false)}}
 const saveQuestion=async(e:FormEvent<HTMLFormElement>,id?:string)=>{e.preventDefault();const f=new FormData(e.currentTarget);await run({action:'save_question',id,service_id:f.get('service_id'),label:f.get('label'),help_text:f.get('help_text'),question_type:f.get('question_type'),required:f.get('required')==='on',options:f.get('options'),placeholder:f.get('placeholder'),sort_order:f.get('sort_order'),active:f.get('active')==='on'},'Intake question saved.')}
 const saveRequirement=async(e:FormEvent<HTMLFormElement>,id?:string)=>{e.preventDefault();const f=new FormData(e.currentTarget);await run({action:'save_asset_requirement',id,service_id:f.get('service_id'),label:f.get('label'),description:f.get('description'),required:f.get('required')==='on',category:f.get('category'),allowed_mime_types:f.get('allowed_mime_types'),max_files:f.get('max_files'),sort_order:f.get('sort_order'),active:f.get('active')==='on'},'File requirement saved.')}
 const review=async(e:FormEvent<HTMLFormElement>,projectId:string)=>{e.preventDefault();const f=new FormData(e.currentTarget),submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null,decision=submitter?.value==='changes_requested'?'changes_requested':'reviewed';await run({action:'review_intake',project_id:projectId,decision,note:f.get('note')},decision==='reviewed'?'Onboarding marked reviewed.':'Client notified that onboarding needs changes.')}
 const viewAsset=async(a:R)=>{setBusy(true);setMsg('');try{const s=createClient(),{data,error}=await s.storage.from('skylight-project-assets').createSignedUrl(String(a.storage_path),300);if(error)throw error;if(data?.signedUrl)window.open(data.signedUrl,'_blank','noopener,noreferrer')}catch(e:any){setMsg(String(e?.message||'Unable to open file.'))}finally{setBusy(false)}}
 return <div style={{display:'grid',gap:16}}>
  {msg?<div className="notice">{msg}</div>:null}
  <div className="stat-grid">
   <div className="stat"><span>Configured Services</span><strong>{configured}</strong><small>Have onboarding rules</small></div>
   <div className="stat"><span>Client Intake Pending</span><strong>{inProgress}</strong><small>Not submitted yet</small></div>
   <div className="stat"><span>Ready for Review</span><strong>{pending}</strong><small>Submitted by clients</small></div>
   <div className="stat"><span>Reviewed</span><strong>{reviewed}</strong><small>Completed onboarding</small></div>
  </div>
  <div className="admin-card"><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   <button type="button" className={`btn ${tab==='templates'?'btn-primary':'btn-light'}`} onClick={()=>setTab('templates')}>Service Intake Templates</button>
   <button type="button" className={`btn ${tab==='projects'?'btn-primary':'btn-light'}`} onClick={()=>setTab('projects')}>Client Intake Review</button>
  </div></div>
  {tab==='templates'?<TemplateWorkspace services={services} qByService={qByService} reqByService={reqByService} busy={busy} saveQuestion={saveQuestion} saveRequirement={saveRequirement} run={run}/>:null}
  {tab==='projects'?<ProjectReviewWorkspace projects={projects} fieldsByProject={fieldsByProject} reqByProject={reqByProject} assetsByProject={assetsByProject} clientMap={clientMap} busy={busy} review={review} viewAsset={viewAsset}/>:null}
 </div>
}

function group(rows:R[],key:string){const m=new Map<string,R[]>();for(const row of rows){const k=String(row[key]||''),a=m.get(k)||[];a.push(row);m.set(k,a)}return m}

function TemplateWorkspace({services,qByService,reqByService,busy,saveQuestion,saveRequirement,run}:{services:R[];qByService:Map<string,R[]>;reqByService:Map<string,R[]>;busy:boolean;saveQuestion:(e:FormEvent<HTMLFormElement>,id?:string)=>Promise<void>;saveRequirement:(e:FormEvent<HTMLFormElement>,id?:string)=>Promise<void>;run:(p:R,m:string)=>Promise<void>}){
 return <>
  <section className="admin-card">
   <div className="section-head"><div><div className="kpi">Custom Question Builder</div><h2>Add onboarding questions to any service</h2><p className="muted">Active templates are copied into a new project. Later template changes never rewrite an existing client project.</p></div></div>
   <form onSubmit={e=>void saveQuestion(e)} className="grid grid-3" style={{alignItems:'end'}}>
    <label className="field"><span>Service</span><select name="service_id" required defaultValue=""><option value="" disabled>Select service</option>{services.filter(s=>s.active).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
    <label className="field"><span>Question</span><input name="label" required placeholder="What is the primary goal for this project?"/></label>
    <label className="field"><span>Answer Type</span><select name="question_type" defaultValue="long_text">{types.map(x=><option value={x} key={x}>{pretty(x)}</option>)}</select></label>
    <label className="field"><span>Options</span><input name="options" placeholder="For select fields: Option A, Option B"/></label>
    <label className="field"><span>Placeholder</span><input name="placeholder"/></label>
    <label className="field"><span>Sort Order</span><input name="sort_order" type="number" defaultValue="100"/></label>
    <label className="field" style={{gridColumn:'1/-1'}}><span>Help Text</span><textarea name="help_text" rows={2}/></label>
    <label><input type="checkbox" name="required"/> Required</label><label><input type="checkbox" name="active" defaultChecked/> Active</label>
    <button className="btn btn-primary" disabled={busy}>Add Question</button>
   </form>
  </section>
  <section className="admin-card">
   <div className="kpi">Existing Questions</div><h2>Questions by service</h2>
   <div style={{display:'grid',gap:12}}>{services.map(s=><QuestionGroup key={s.id} service={s} rows={qByService.get(String(s.id))||[]} busy={busy} saveQuestion={saveQuestion} run={run}/>)}</div>
  </section>
  <section className="admin-card">
   <div className="section-head"><div><div className="kpi">Client File Requirements</div><h2>Define files each service can request</h2><p className="muted">Examples include logos, photos, menus, documents, spreadsheets, existing copy and creative assets.</p></div><a className="btn btn-light" href="/admin/skylight-services">Service Delivery Defaults</a></div>
   <form onSubmit={e=>void saveRequirement(e)} className="grid grid-3" style={{alignItems:'end'}}>
    <label className="field"><span>Service</span><select name="service_id" required defaultValue=""><option value="" disabled>Select service</option>{services.filter(s=>s.active).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
    <label className="field"><span>File Requirement</span><input name="label" required placeholder="Logo / brand files"/></label>
    <label className="field"><span>Category</span><input name="category" defaultValue="general"/></label>
    <label className="field"><span>Allowed MIME Types</span><input name="allowed_mime_types" defaultValue={defaultMimes}/></label>
    <label className="field"><span>Max Files</span><input name="max_files" type="number" min="1" max="25" defaultValue="5"/></label>
    <label className="field"><span>Sort Order</span><input name="sort_order" type="number" defaultValue="100"/></label>
    <label className="field" style={{gridColumn:'1/-1'}}><span>Description / Instructions</span><textarea name="description" rows={2}/></label>
    <label><input type="checkbox" name="required"/> Required</label><label><input type="checkbox" name="active" defaultChecked/> Active</label>
    <button className="btn btn-primary" disabled={busy}>Add File Requirement</button>
   </form>
   <div style={{display:'grid',gap:12,marginTop:16}}>{services.map(s=><RequirementGroup key={s.id} service={s} rows={reqByService.get(String(s.id))||[]} busy={busy} saveRequirement={saveRequirement} run={run}/>)}</div>
  </section>
 </>
}

function QuestionGroup({service,rows,busy,saveQuestion,run}:{service:R;rows:R[];busy:boolean;saveQuestion:(e:FormEvent<HTMLFormElement>,id?:string)=>Promise<void>;run:(p:R,m:string)=>Promise<void>}){
 if(!rows.length)return null
 return <details className="card" style={{padding:12}}><summary><strong>{service.name}</strong> <span className="small muted">· {rows.filter(x=>x.active).length} active questions</span></summary><div style={{display:'grid',gap:10,marginTop:10}}>{rows.map(q=><form key={q.id} onSubmit={e=>void saveQuestion(e,String(q.id))} className="card" style={{padding:10,display:'grid',gap:8}}>
  <input type="hidden" name="service_id" value={q.service_id}/><div className="grid grid-3">
   <label className="field"><span>Question</span><input name="label" defaultValue={q.label} required/></label>
   <label className="field"><span>Type</span><select name="question_type" defaultValue={q.question_type}>{types.map(x=><option value={x} key={x}>{pretty(x)}</option>)}</select></label>
   <label className="field"><span>Sort</span><input name="sort_order" type="number" defaultValue={q.sort_order}/></label>
   <label className="field"><span>Options</span><input name="options" defaultValue={Array.isArray(q.options)?q.options.join(', '):''}/></label>
   <label className="field"><span>Placeholder</span><input name="placeholder" defaultValue={q.placeholder||''}/></label>
  </div><label className="field"><span>Help Text</span><textarea name="help_text" rows={2} defaultValue={q.help_text||''}/></label>
  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><label><input type="checkbox" name="required" defaultChecked={Boolean(q.required)}/> Required</label><label><input type="checkbox" name="active" defaultChecked={Boolean(q.active)}/> Active</label></div>
  <div><button className="btn btn-light" disabled={busy}>Save Question</button> <button type="button" className="btn btn-light" disabled={busy||!q.active} onClick={()=>void run({action:'archive_question',id:q.id},'Question archived. Existing project snapshots are unchanged.')}>Archive</button></div>
 </form>)}</div></details>
}

function RequirementGroup({service,rows,busy,saveRequirement,run}:{service:R;rows:R[];busy:boolean;saveRequirement:(e:FormEvent<HTMLFormElement>,id?:string)=>Promise<void>;run:(p:R,m:string)=>Promise<void>}){
 if(!rows.length)return null
 return <details className="card" style={{padding:12}}><summary><strong>{service.name}</strong> <span className="small muted">· {rows.filter(x=>x.active).length} active file requirements</span></summary><div style={{display:'grid',gap:10,marginTop:10}}>{rows.map(r=><form key={r.id} onSubmit={e=>void saveRequirement(e,String(r.id))} className="card" style={{padding:10,display:'grid',gap:8}}>
  <input type="hidden" name="service_id" value={r.service_id}/><div className="grid grid-3">
   <label className="field"><span>Label</span><input name="label" defaultValue={r.label} required/></label>
   <label className="field"><span>Category</span><input name="category" defaultValue={r.category||'general'}/></label>
   <label className="field"><span>Max Files</span><input name="max_files" type="number" min="1" max="25" defaultValue={r.max_files}/></label>
   <label className="field"><span>Allowed MIME Types</span><input name="allowed_mime_types" defaultValue={Array.isArray(r.allowed_mime_types)?r.allowed_mime_types.join(', '):defaultMimes}/></label>
   <label className="field"><span>Sort</span><input name="sort_order" type="number" defaultValue={r.sort_order}/></label>
  </div><label className="field"><span>Instructions</span><textarea name="description" rows={2} defaultValue={r.description||''}/></label>
  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><label><input type="checkbox" name="required" defaultChecked={Boolean(r.required)}/> Required</label><label><input type="checkbox" name="active" defaultChecked={Boolean(r.active)}/> Active</label></div>
  <div><button className="btn btn-light" disabled={busy}>Save Requirement</button> <button type="button" className="btn btn-light" disabled={busy||!r.active} onClick={()=>void run({action:'archive_asset_requirement',id:r.id},'File requirement archived. Existing project snapshots are unchanged.')}>Archive</button></div>
 </form>)}</div></details>
}

function ProjectReviewWorkspace({projects,fieldsByProject,reqByProject,assetsByProject,clientMap,busy,review,viewAsset}:{projects:R[];fieldsByProject:Map<string,R[]>;reqByProject:Map<string,R[]>;assetsByProject:Map<string,R[]>;clientMap:Map<string,R>;busy:boolean;review:(e:FormEvent<HTMLFormElement>,projectId:string)=>Promise<void>;viewAsset:(a:R)=>Promise<void>}){
 return <section className="admin-card"><div className="section-head"><div><div className="kpi">Client Onboarding Review</div><h2>Answers & uploaded files</h2><p className="muted">Project intake is private operations data and never affects Local Pros verification, Sponsored placement or organic ranking.</p></div></div>
  <div style={{display:'grid',gap:14}}>{projects.map(p=>{
   const fs=fieldsByProject.get(String(p.id))||[],rs=reqByProject.get(String(p.id))||[],assets=assetsByProject.get(String(p.id))||[],requiredQ=fs.filter(x=>x.required),answeredQ=requiredQ.filter(x=>x.response!=null&&answer(x.response)!=='—'),requiredR=rs.filter(x=>x.required),filledR=requiredR.filter(r=>assets.some(a=>String(a.requirement_id)===String(r.id)&&!a.removed_at))
   return <details key={p.id} className="card" style={{padding:14}} open={p.intake_status==='submitted'}><summary style={{cursor:'pointer'}}><strong>{p.project_number} · {p.name}</strong> <span className="small muted">· {clientMap.get(String(p.client_id))?.company_name||'Client'} · {pretty(p.intake_status)}</span></summary>
    <div className="grid grid-3" style={{marginTop:12}}><div className="card"><span className="small muted">Required answers</span><strong>{answeredQ.length}/{requiredQ.length}</strong></div><div className="card"><span className="small muted">Required files</span><strong>{filledR.length}/{requiredR.length}</strong></div><div className="card"><span className="small muted">Submitted</span><strong>{stamp(p.intake_submitted_at)}</strong></div></div>
    {fs.length?<div style={{marginTop:12}}><strong>Client answers</strong><div style={{display:'grid',gap:7,marginTop:7}}>{fs.map(f=><div className="card" key={f.id} style={{padding:10}}><strong>{f.label}{f.required?' *':''}</strong><div style={{whiteSpace:'pre-wrap'}}>{answer(f.response)}</div>{f.help_text?<div className="small muted">{f.help_text}</div>:null}</div>)}</div></div>:null}
    {rs.length?<div style={{marginTop:12}}><strong>Requested files</strong><div style={{display:'grid',gap:7,marginTop:7}}>{rs.map(r=>{const files=assets.filter(a=>String(a.requirement_id)===String(r.id)&&!a.removed_at);return <div className="card" key={r.id} style={{padding:10}}><strong>{r.label}{r.required?' *':''}</strong><div className="small muted">{r.description||pretty(r.category)} · {files.length}/{r.max_files} files</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>{files.map(a=><button key={a.id} type="button" className="btn btn-light" disabled={busy} onClick={()=>void viewAsset(a)}>{a.file_name}</button>)}</div></div>})}</div></div>:null}
    <form onSubmit={e=>void review(e,String(p.id))} style={{display:'grid',gap:8,marginTop:12}}><label className="field"><span>Client-visible review note</span><textarea name="note" rows={2} placeholder="Optional approval note or explain what needs to change."/></label><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn btn-primary" name="decision" value="reviewed" disabled={busy||p.intake_status!=='submitted'}>Mark Reviewed</button><button className="btn btn-light" name="decision" value="changes_requested" disabled={busy}>Request Changes</button></div></form>
   </details>
  })}{!projects.length?<p className="muted">No Skylight projects currently have intake requirements.</p>:null}</div>
 </section>
}
