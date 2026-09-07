'use client'

import { useMemo,useState } from 'react'

type Row=Record<string,any>
type Props={opportunities:Row[];replies:Row[];meetings:Row[];handoffs:Row[];conversionEvents:Row[];drafts:Row[];campaigns:Row[];members:Row[];proposals:Row[]}
const relation=(v:any)=>Array.isArray(v)?v[0]||{}:v||{}
const fmtDate=(v:any)=>v?new Date(String(v)).toLocaleString():'—'
const dollars=(c:any)=>typeof c==='number'?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(c/100):'—'
const pct=(a:number,b:number)=>b?`${((a/b)*100).toFixed(1)}%`:'0.0%'
const localIso=(v:FormDataEntryValue|null)=>v?new Date(String(v)).toISOString():undefined
const probabilities:Record<string,number>={research:.05,contact_ready:.10,contacted:.20,qualified:.50,proposal:.70,nurture:.15,won:1,lost:0,disqualified:0}
const classifications=['positive','question','neutral','negative','do_not_contact','wrong_person','out_of_office','bounce','ambiguous']

export function SalesConversionWorkbench({opportunities,replies,meetings,handoffs,conversionEvents,drafts,campaigns,members,proposals}:Props){
  void members
  const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('')
  const [replyOpp,setReplyOpp]=useState(opportunities.find(o=>o.active)?.id||''),[meetingOpp,setMeetingOpp]=useState(opportunities.find(o=>o.active)?.id||''),[handoffOpp,setHandoffOpp]=useState(opportunities.find(o=>o.active)?.id||'')
  const active=opportunities.filter(o=>o.active&&!['won','lost','disqualified'].includes(String(o.stage)))
  const valued=active.filter(o=>Number.isFinite(Number(o.estimated_value_cents))&&Number(o.estimated_value_cents)>=0)
  const pipeline=valued.reduce((n,o)=>n+Number(o.estimated_value_cents||0),0)
  const weighted=valued.reduce((n,o)=>n+Number(o.estimated_value_cents||0)*(probabilities[String(o.stage)]??0),0)
  const pending=replies.filter(r=>r.review_status==='pending')
  const scheduled=meetings.filter(m=>m.status==='scheduled').sort((a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime())
  const openHandoffs=handoffs.filter(h=>['draft','ready'].includes(String(h.status)))
  const oppById=useMemo(()=>new Map(opportunities.map(o=>[o.id,o])),[opportunities])
  const campaignMetrics:Row[]=useMemo(()=>campaigns.map((c:Row)=>{
    const sent=drafts.filter(d=>d.campaign_id===c.id).length,rs=replies.filter(r=>r.campaign_id===c.id),confirmedPositive=rs.filter(r=>r.review_status==='confirmed'&&r.confirmed_classification==='positive').length,ms=meetings.filter(m=>m.campaign_id===c.id).length,hs=handoffs.filter(h=>h.campaign_id===c.id).length,ev=conversionEvents.filter(e=>e.campaign_id===c.id),wins=ev.filter(e=>e.event_type==='won').length,losses=ev.filter(e=>e.event_type==='lost').length
    return {id:c.id,name:c.name,service_slug:c.service_slug,campaign_type:c.campaign_type,status:c.status,sent,replies:rs.length,positive:confirmedPositive,meetings:ms,handoffs:hs,wins,losses}
  }),[campaigns,drafts,replies,meetings,handoffs,conversionEvents])

  const nameFor=(id:string)=>{const o=oppById.get(id);const p=relation(o?.prospect);return p.business_name||`Opportunity ${id.slice(0,8)}`}
  async function post(payload:Row,key:string){
    setBusy(key);setMessage('');setError('')
    try{const r=await fetch('/api/admin/skylight-sales/conversions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Sales action failed.');setMessage('Saved. Refreshing Sales 3.5…');window.location.reload()}
    catch(e:any){setError(e?.message||'Sales action failed.')}
    finally{setBusy('')}
  }

  return <div style={{display:'grid',gap:24,marginTop:24}}>
    {message?<div className="notice"><strong>{message}</strong></div>:null}{error?<div className="notice warn"><strong>{error}</strong></div>:null}

    <section className="admin-card">
      <div className="admin-page-head"><div><div className="kpi">Internal forecast</div><h2>Pipeline Forecast</h2><p className="muted">Weighted forecast is a clearly labeled internal heuristic, not booked revenue. Only opportunities with a staff-configured value are included.</p></div></div>
      <div className="stat-grid"><div className="stat">Unweighted Pipeline<strong>{dollars(pipeline)}</strong><small>{valued.length} valued opportunities</small></div><div className="stat">Weighted Forecast<strong>{dollars(Math.round(weighted))}</strong><small>stage probability heuristic</small></div><div className="stat">Excluded — No Value<strong>{active.length-valued.length}</strong><small>not assigned a dollar estimate</small></div><div className="stat">Proposal Stage<strong>{active.filter(o=>o.stage==='proposal').length}</strong></div></div>
      <p className="small muted" style={{marginTop:12}}>Weights: Research 5% · Contact Ready 10% · Contacted 20% · Qualified 50% · Proposal 70% · Nurture 15% · Won 100%.</p>
    </section>

    <section className="admin-card">
      <div className="admin-page-head"><div><div className="kpi">Staff review required</div><h2>Reply Review Queue</h2><p className="muted">Suggestions are deterministic triage only. Nothing consequential happens until a staff member confirms a classification.</p></div><span className="pill">{pending.length} pending</span></div>
      {pending.length===0?<p className="muted">No replies are waiting for review.</p>:<div style={{display:'grid',gap:14}}>{pending.slice(0,100).map(r=><ReplyReview key={r.id} reply={r} business={nameFor(r.opportunity_id)} busy={busy} onPost={post}/>)}</div>}
    </section>

    <section className="admin-card">
      <div className="kpi">Manual reply capture</div><h2>Record a Reply</h2><p className="muted">Use this for email, phone, SMS, LinkedIn or social responses not automatically ingested. The system suggests a classification but leaves it pending for staff review.</p>
      <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);post({action:'record_reply',opportunity_id:f.get('opportunity_id'),channel:f.get('channel'),sender_name:f.get('sender_name'),sender_email:f.get('sender_email'),subject:f.get('subject'),body:f.get('body'),received_at:localIso(f.get('received_at'))},'record_reply')}} style={{display:'grid',gap:10}}>
        <label>Opportunity<select name="opportunity_id" value={replyOpp} onChange={e=>setReplyOpp(e.target.value)} required>{active.map(o=><option key={o.id} value={o.id}>{nameFor(o.id)} · {o.stage} · {o.primary_service_slug||'service TBD'}</option>)}</select></label>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}><label>Channel<select name="channel" defaultValue="email"><option>email</option><option>phone</option><option>sms</option><option>linkedin</option><option>social</option></select></label><label>Received at<input name="received_at" type="datetime-local"/></label><label>Sender name<input name="sender_name"/></label><label>Sender email<input name="sender_email" type="email"/></label></div>
        <label>Subject<input name="subject"/></label><label>Reply body<textarea name="body" rows={5} required/></label><button className="btn btn-primary" disabled={busy==='record_reply'}>{busy==='record_reply'?'Saving…':'Record Reply for Review'}</button>
      </form>
    </section>

    <section className="admin-card">
      <div className="admin-page-head"><div><div className="kpi">Human-booked conversion</div><h2>Meetings</h2><p className="muted">Booking a meeting cancels open chase follow-ups for that opportunity. It does not send an email or create an invoice.</p></div></div>
      <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);post({action:'book_meeting',opportunity_id:f.get('opportunity_id'),meeting_type:f.get('meeting_type'),scheduled_at:localIso(f.get('scheduled_at')),duration_minutes:f.get('duration_minutes'),location_type:f.get('location_type'),location_detail:f.get('location_detail'),notes:f.get('notes')},'book_meeting')}} style={{display:'grid',gap:10,marginBottom:18}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10}}><label>Opportunity<select name="opportunity_id" value={meetingOpp} onChange={e=>setMeetingOpp(e.target.value)} required>{active.map(o=><option key={o.id} value={o.id}>{nameFor(o.id)} · {o.stage}</option>)}</select></label><label>Type<select name="meeting_type" defaultValue="discovery"><option>discovery</option><option>strategy</option><option>demo</option><option>follow_up</option><option>other</option></select></label><label>Date/time<input name="scheduled_at" type="datetime-local" required/></label><label>Minutes<input name="duration_minutes" type="number" min="5" max="480" defaultValue="30"/></label><label>Location<select name="location_type" defaultValue="phone"><option>phone</option><option>video</option><option>in_person</option><option>other</option></select></label><label>Location detail<input name="location_detail" placeholder="Phone / Meet link / address"/></label></div><label>Notes<textarea name="notes" rows={2}/></label><button className="btn btn-primary" disabled={busy==='book_meeting'}>{busy==='book_meeting'?'Booking…':'Book Meeting'}</button>
      </form>
      <div style={{display:'grid',gap:10}}>{scheduled.length===0?<p className="muted">No scheduled sales meetings.</p>:scheduled.slice(0,100).map(m=><MeetingRow key={m.id} meeting={m} business={nameFor(m.opportunity_id)} busy={busy} onPost={post}/>)}</div>
    </section>

    <section className="admin-card">
      <div className="kpi">Proposal handoff — no automatic send</div><h2>Proposal Handoffs</h2><p className="muted">Create an internal scope/pricing handoff first. Staff can mark it ready and explicitly link an existing Skylight proposal. Linking never sends the proposal and never creates an invoice.</p>
      <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),opp=oppById.get(String(f.get('opportunity_id')));post({action:'create_handoff',opportunity_id:f.get('opportunity_id'),title:f.get('title'),scope_notes:f.get('scope_notes'),pricing_notes:f.get('pricing_notes'),estimated_value_cents:f.get('estimated_value_dollars')?Math.round(Number(f.get('estimated_value_dollars'))*100):null,recommended_service_slugs:opp?.recommended_service_slugs||[]},'create_handoff')}} style={{display:'grid',gap:10,marginBottom:18}}>
        <label>Opportunity<select name="opportunity_id" value={handoffOpp} onChange={e=>setHandoffOpp(e.target.value)} required>{active.map(o=><option key={o.id} value={o.id}>{nameFor(o.id)} · {o.stage} · {(o.recommended_service_slugs||[]).join(', ')||'services TBD'}</option>)}</select></label><label>Handoff title<input name="title" placeholder="Proposal scope for business"/></label><label>Scope notes<textarea name="scope_notes" rows={3}/></label><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10}}><label>Pricing notes<textarea name="pricing_notes" rows={2}/></label><label>Estimated value ($)<input name="estimated_value_dollars" type="number" min="0" step="1"/></label></div><button className="btn btn-primary" disabled={busy==='create_handoff'}>{busy==='create_handoff'?'Creating…':'Create Draft Handoff'}</button>
      </form>
      <div style={{display:'grid',gap:12}}>{openHandoffs.length===0?<p className="muted">No open proposal handoffs.</p>:openHandoffs.slice(0,100).map(h=><HandoffRow key={h.id} handoff={h} business={nameFor(h.opportunity_id)} proposals={proposals} busy={busy} onPost={post}/>)}</div>
    </section>

    <section className="admin-card">
      <div className="kpi">Explicit pipeline control</div><h2>Opportunity Value + Win/Loss</h2><p className="muted">Values and outcomes below are staff-authoritative. No billing action is triggered.</p>
      <div style={{display:'grid',gap:10}}>{active.slice(0,150).map(o=><OpportunityOutcome key={o.id} opportunity={o} business={nameFor(o.id)} busy={busy} onPost={post}/>)}</div>
    </section>

    <section className="admin-card">
      <div className="kpi">90-day campaign performance</div><h2>Campaign Conversion Analytics</h2>
      <div style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Campaign</th><th>Sent</th><th>Replies</th><th>Reply Rate</th><th>Positive</th><th>Meetings</th><th>Handoffs</th><th>Won</th><th>Lost</th></tr></thead><tbody>{campaignMetrics.map(c=><tr key={c.id}><td><strong>{c.name}</strong><br/><small>{c.service_slug||c.campaign_type}</small></td><td>{c.sent}</td><td>{c.replies}</td><td>{pct(c.replies,c.sent)}</td><td>{c.positive}</td><td>{c.meetings}</td><td>{c.handoffs}</td><td>{c.wins}</td><td>{c.losses}</td></tr>)}</tbody></table></div>
    </section>

    <section className="admin-card">
      <div className="kpi">Append-only sales conversion history</div><h2>Recent Conversion Timeline</h2><div style={{display:'grid',gap:8}}>{conversionEvents.slice(0,120).map(e=><div key={e.id} className="notice" style={{padding:10}}><strong>{String(e.event_type).replaceAll('_',' ')}</strong> · {nameFor(e.opportunity_id)} · {fmtDate(e.created_at)} {e.value_cents!=null?` · ${dollars(e.value_cents)}`:''}{e.reason_code?` · ${e.reason_code}`:''}</div>)}</div>
    </section>
  </div>
}

function ReplyReview({reply,business,busy,onPost}:{reply:Row;business:string;busy:string;onPost:(p:Row,k:string)=>void}){
  const [classification,setClassification]=useState(String(reply.classification_suggestion||'ambiguous'))
  return <div className="notice" style={{padding:14}}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><strong>{business}</strong> · {reply.channel} · {fmtDate(reply.received_at)}<br/><small>{reply.sender_name||reply.sender_email||'Sender not entered'}{reply.subject?` · ${reply.subject}`:''}</small></div><span className="pill">Suggested: {reply.classification_suggestion} · {reply.classification_confidence}%</span></div><p style={{whiteSpace:'pre-wrap',margin:'10px 0'}}>{String(reply.body||'').slice(0,1800)}</p><p className="small muted">Why: {reply.suggestion_reason||'No reason recorded.'}</p><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}><label style={{minWidth:210}}>Staff classification<select value={classification} onChange={e=>setClassification(e.target.value)}>{classifications.map(c=><option key={c}>{c}</option>)}</select></label><button className="btn btn-primary" disabled={busy===`confirm_${reply.id}`} onClick={()=>onPost({action:'confirm_reply',reply_id:reply.id,classification},`confirm_${reply.id}`)}>Confirm Classification</button><button className="btn btn-light" disabled={busy===`dismiss_${reply.id}`} onClick={()=>onPost({action:'dismiss_reply',reply_id:reply.id},`dismiss_${reply.id}`)}>Dismiss Suggestion</button></div></div>
}

function MeetingRow({meeting,business,busy,onPost}:{meeting:Row;business:string;busy:string;onPost:(p:Row,k:string)=>void}){
  const [outcome,setOutcome]=useState('qualified')
  return <div className="notice" style={{padding:12}}><strong>{business}</strong> · {meeting.meeting_type} · {fmtDate(meeting.scheduled_at)} · {meeting.location_type}<div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end',marginTop:8}}><label>Outcome<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option>qualified</option><option>proposal_requested</option><option>not_ready</option><option>not_fit</option><option>follow_up</option><option>other</option></select></label><button className="btn btn-primary" disabled={busy===`meeting_${meeting.id}`} onClick={()=>onPost({action:'complete_meeting',meeting_id:meeting.id,outcome},`meeting_${meeting.id}`)}>Complete Meeting</button></div></div>
}

function HandoffRow({handoff,business,proposals,busy,onPost}:{handoff:Row;business:string;proposals:Row[];busy:string;onPost:(p:Row,k:string)=>void}){
  const [proposalId,setProposalId]=useState('')
  return <div className="notice" style={{padding:12}}><div><strong>{handoff.title}</strong> · {business} · <span className="pill">{handoff.status}</span><br/><small>{(handoff.recommended_service_slugs||[]).join(', ')||'No services selected'} · {dollars(handoff.estimated_value_cents)}</small></div><p className="small">{handoff.scope_notes||'No scope notes.'}</p><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}>{handoff.status==='draft'?<button className="btn btn-primary" disabled={busy===`ready_${handoff.id}`} onClick={()=>onPost({action:'mark_handoff_ready',handoff_id:handoff.id},`ready_${handoff.id}`)}>Mark Ready</button>:null}<label style={{minWidth:280}}>Existing proposal<select value={proposalId} onChange={e=>setProposalId(e.target.value)}><option value="">Select proposal to link…</option>{proposals.map(p=><option key={p.id} value={p.id}>{p.proposal_number||p.id.slice(0,8)} · {p.title} · {p.status} · {dollars(p.total_cents)}</option>)}</select></label><button className="btn btn-light" disabled={!proposalId||busy===`link_${handoff.id}`} onClick={()=>onPost({action:'link_proposal',handoff_id:handoff.id,proposal_id:proposalId},`link_${handoff.id}`)}>Link Proposal — Do Not Send</button></div></div>
}

function OpportunityOutcome({opportunity,business,busy,onPost}:{opportunity:Row;business:string;busy:string;onPost:(p:Row,k:string)=>void}){
  const [value,setValue]=useState(opportunity.estimated_value_cents!=null?String(Math.round(Number(opportunity.estimated_value_cents)/100)):'')
  const [reason,setReason]=useState('')
  return <div className="notice" style={{padding:12}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><div><strong>{business}</strong> · {opportunity.stage} · {opportunity.primary_service_slug||'service TBD'}<br/><small>Current value: {dollars(opportunity.estimated_value_cents)}</small></div><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}><label>Value ($)<input style={{width:120}} type="number" min="0" value={value} onChange={e=>setValue(e.target.value)}/></label><button className="btn btn-light" disabled={value===''||busy===`value_${opportunity.id}`} onClick={()=>onPost({action:'update_value',opportunity_id:opportunity.id,estimated_value_cents:Math.round(Number(value)*100)},`value_${opportunity.id}`)}>Save Value</button><button className="btn btn-primary" disabled={busy===`won_${opportunity.id}`} onClick={()=>onPost({action:'mark_won',opportunity_id:opportunity.id,value_cents:value===''?undefined:Math.round(Number(value)*100),reason_code:'staff_confirmed_win'},`won_${opportunity.id}`)}>Mark Won</button><label>Loss reason<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Required to mark lost"/></label><button className="btn btn-light" disabled={!reason||busy===`lost_${opportunity.id}`} onClick={()=>onPost({action:'mark_lost',opportunity_id:opportunity.id,reason_code:reason,value_cents:value===''?undefined:Math.round(Number(value)*100)},`lost_${opportunity.id}`)}>Mark Lost</button></div></div></div>
}
