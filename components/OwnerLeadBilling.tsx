'use client'

import { useMemo, useState } from 'react'

const money=(c:any)=>`$${(Number(c||0)/100).toFixed(2)}`
const date=(v:any)=>v?new Date(String(v)).toLocaleDateString():'—'
const rel=(v:any)=>Array.isArray(v)?v[0]:v
const label=(v:any)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const OPEN_INVOICE=new Set(['draft','sent','open','overdue'])

export function OwnerLeadBilling({business,access,program,invoices,charges,requests,credits}:{business:any;access:any;program:any;invoices:any[];charges:any[];requests:any[];credits:any[]}){
 const[selected,setSelected]=useState('')
 const[reason,setReason]=useState('duplicate')
 const[details,setDetails]=useState('')
 const[busy,setBusy]=useState(false)
 const[message,setMessage]=useState('')
 const[invoiceFilter,setInvoiceFilter]=useState<'all'|'open'|'overdue'|'paid'>('open')
 const[chargeFilter,setChargeFilter]=useState('all')
 const[chargeQuery,setChargeQuery]=useState('')

 const open=invoices.filter(x=>['sent','overdue'].includes(String(x.status)))
 const outstanding=open.reduce((n,x)=>n+Number(x.amount_due_cents||0),0)
 const overdueInvoices=invoices.filter(x=>x.status==='overdue')
 const overdue=overdueInvoices.reduce((n,x)=>n+Number(x.amount_due_cents||0),0)
 const availableCredit=credits.filter(x=>x.status==='available').reduce((n,x)=>n+Number(x.remaining_amount_cents||0),0)
 const pendingByCharge=new Set(requests.filter(x=>x.status==='pending').map(x=>x.charge_id))
 const approvedByCharge=new Set(requests.filter(x=>x.status==='approved').map(x=>x.charge_id))
 const selectedCharge=charges.find(x=>x.id===selected)
 const monthDelivered=charges.filter(x=>x.billing_status!=='void'&&new Date(x.delivered_at)>=new Date(new Date().getFullYear(),new Date().getMonth(),1)).length
 const invoiceCounts=useMemo(()=>({all:invoices.length,open:invoices.filter(x=>OPEN_INVOICE.has(String(x.status))).length,overdue:overdueInvoices.length,paid:invoices.filter(x=>x.status==='paid').length}),[invoices])
 const visibleInvoices=useMemo(()=>invoices.filter(x=>invoiceFilter==='all'||(invoiceFilter==='open'&&OPEN_INVOICE.has(String(x.status)))||x.status===invoiceFilter),[invoices,invoiceFilter])
 const chargeStatuses=useMemo(()=>Array.from(new Set(charges.map(x=>String(x.billing_status||'unknown')))).sort(),[charges])
 const visibleCharges=useMemo(()=>{const q=chargeQuery.trim().toLowerCase();return charges.filter(c=>{if(chargeFilter!=='all'&&String(c.billing_status)!==chargeFilter)return false;const lead=rel(c.leads);if(q&&!`${lead?.service||''} ${lead?.city||''} ${c.billing_status||''}`.toLowerCase().includes(q))return false;return true})},[charges,chargeFilter,chargeQuery])
 const paymentPriority=overdueInvoices.find(x=>x.hosted_invoice_url)||open.find(x=>x.hosted_invoice_url)||null
 const statusText=useMemo(()=>{if(program?.status==='paused')return'Paused by agreement';if(program?.status==='ended')return'Agreement ended';if(program?.manual_delivery_hold)return program.delivery_hold_reason?`Delivery hold: ${program.delivery_hold_reason}`:'Delivery hold active';if(Number(access?.overdue_invoice_count)>0&&program?.stop_delivery_on_overdue)return'New delivery may be blocked by overdue balance';if(Number(access?.open_invoice_count)>0&&program?.stop_delivery_on_open_balance)return'New delivery is blocked while balance is open';return access?.lead_inbox?'Lead delivery enabled':'Lead Inbox not enabled'},[access,program])

 async function submit(){
  if(!selected)return
  setBusy(true);setMessage('')
  const r=await fetch('/api/owner/lead-credit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({charge_id:selected,reason,details})})
  const j=await r.json().catch(()=>({}))
  setBusy(false);setMessage(String(j.message||j.error||'Unable to submit credit request.'))
  if(r.ok)location.reload()
 }

 return <div>
  <div className="notice"><strong>Lead billing rule:</strong> your agreement bills for an eligible lead when it is delivered—not when you close a sale. A lead that does not convert is still billable unless an approved credit exception applies.</div>
  <div className="stat-grid owner-billing-stats"><div className="stat">Delivered This Month<strong>{monthDelivered}{program?.max_leads_per_month?` / ${program.max_leads_per_month}`:''}</strong></div><div className="stat">Open Balance<strong>{money(outstanding)}</strong></div><div className="stat">Overdue<strong>{money(overdue)}</strong></div><div className="stat">Available Credits<strong>{money(availableCredit)}</strong></div></div>

  {paymentPriority?<div className={`owner-payment-priority ${paymentPriority.status==='overdue'?'urgent':''}`}><div><div className="kpi">Payment Priority</div><h3>{paymentPriority.status==='overdue'?'Overdue invoice needs attention':'Open invoice available'}</h3><p>{paymentPriority.invoice_number} · {money(paymentPriority.amount_due_cents)} · due {date(paymentPriority.due_at)}</p></div><a className="btn btn-primary" href={paymentPriority.hosted_invoice_url} target="_blank" rel="noreferrer">View / Pay Invoice</a></div>:null}

  <section className="card owner-billing-agreement"><div className="section-head compact-head"><div><div className="kpi">Lead Agreement</div><h2>{business.name}</h2></div><span className={`badge ${access?.lead_inbox&&program?.status==='active'?'verified':'neutral'}`}>{statusText}</span></div><div className="owner-billing-agreement-grid"><div><span>Lead Inbox</span><strong>{access?.access_source==='pro_included'?'Included with Pro':access?.access_source==='featured_addon'?'Featured add-on':'Not enabled'}</strong></div><div><span>Billing</span><strong>{program?.billing_model==='lead_bundle'?`${money(program.bundle_price_cents)} per ${program.bundle_lead_count} delivered leads`:`${money(program?.per_lead_price_cents)} per delivered lead`}</strong></div><div><span>Lead Type</span><strong>{program?.lead_sale_mode==='shared'?`Shared · up to ${program.max_buyers_per_lead} businesses`:'Exclusive'}</strong></div><div><span>Agreement</span><strong>{program?.agreement_started_on?date(program.agreement_started_on):'Open start'} → {program?.agreement_ends_on?date(program.agreement_ends_on):'Open ended'}</strong></div><div><span>Invoice Terms</span><strong>Due in {program?.due_days??7} day{Number(program?.due_days??7)===1?'':'s'}</strong></div><div><span>Monthly Limit</span><strong>{program?.max_leads_per_month?`${program.max_leads_per_month} delivered leads`:'No configured cap'}</strong></div></div></section>

  <section className="card owner-billing-section"><div className="section-head compact-head"><div><div className="kpi">Invoices & Payment History</div><h2>Lead Billing</h2><p className="small muted">Filter your invoice history without changing payment or delivery status.</p></div></div>
   <nav className="owner-billing-tabs" aria-label="Invoice filters"><button type="button" className={invoiceFilter==='open'?'active':''} onClick={()=>setInvoiceFilter('open')}>Open <span>{invoiceCounts.open}</span></button><button type="button" className={invoiceFilter==='overdue'?'active':''} onClick={()=>setInvoiceFilter('overdue')}>Overdue <span>{invoiceCounts.overdue}</span></button><button type="button" className={invoiceFilter==='paid'?'active':''} onClick={()=>setInvoiceFilter('paid')}>Paid <span>{invoiceCounts.paid}</span></button><button type="button" className={invoiceFilter==='all'?'active':''} onClick={()=>setInvoiceFilter('all')}>All <span>{invoiceCounts.all}</span></button></nav>
   {visibleInvoices.length?<div className="owner-invoice-list">{visibleInvoices.map(i=><article className={`owner-invoice-card ${i.status==='overdue'?'overdue':''}`} key={i.id}><div className="owner-invoice-head"><div><span className={`badge ${i.status==='paid'?'verified':i.status==='overdue'?'sponsored':'neutral'}`}>{label(i.status)}</span><h3>{i.invoice_number}</h3><small>{i.lead_count} delivered lead{i.lead_count===1?'':'s'} · created {date(i.created_at)}</small></div><strong>{money(i.amount_due_cents)}</strong></div><div className="owner-invoice-meta"><span>Subtotal {money(i.subtotal_cents)}</span>{Number(i.credit_applied_cents)>0?<span>Credit {money(i.credit_applied_cents)}</span>:null}<span>Due {date(i.due_at)}</span>{i.paid_at?<span>Paid {date(i.paid_at)}</span>:null}</div><div className="card-actions">{i.hosted_invoice_url&&i.status!=='paid'?<a className="btn btn-primary" href={i.hosted_invoice_url} target="_blank" rel="noreferrer">View / Pay Invoice</a>:i.hosted_invoice_url?<a className="btn btn-light" href={i.hosted_invoice_url} target="_blank" rel="noreferrer">View Invoice</a>:null}{i.invoice_pdf_url?<a className="btn btn-light" href={i.invoice_pdf_url} target="_blank" rel="noreferrer">Invoice PDF</a>:null}</div></article>)}</div>:<div className="empty">No invoices match this view.</div>}
  </section>

  <section className="card owner-billing-section"><div className="section-head compact-head"><div><div className="kpi">Delivered Lead Ledger</div><h2>Charges</h2><p className="small muted">Each row is the pricing snapshot recorded when an eligible lead was delivered.</p></div></div><div className="owner-charge-filterbar"><label><span aria-hidden="true">⌕</span><input type="search" value={chargeQuery} onChange={e=>setChargeQuery(e.target.value)} placeholder="Search service or city…"/></label><select value={chargeFilter} onChange={e=>setChargeFilter(e.target.value)}><option value="all">All billing states</option>{chargeStatuses.map(status=><option key={status} value={status}>{label(status)}</option>)}</select></div>
   {visibleCharges.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Delivered</th><th>Lead</th><th>Charge</th><th>Billing</th><th>Credit Review</th></tr></thead><tbody>{visibleCharges.map(c=>{const l=rel(c.leads),unit=c.billing_model==='pay_per_lead'?Number(c.per_lead_price_cents||0):Math.round(Number(c.bundle_price_cents||0)/Math.max(1,Number(c.bundle_lead_count||1)));return <tr key={c.id}><td>{date(c.delivered_at)}</td><td>{l?.service||'Delivered lead'}{l?.city?` · ${l.city}`:''}</td><td>{c.billing_model==='lead_bundle'?`${money(c.bundle_price_cents)} / ${c.bundle_lead_count}-lead bundle`:`${money(unit)} / lead`}</td><td><span className="badge neutral">{label(c.billing_status)}</span></td><td>{pendingByCharge.has(c.id)?<span className="badge sponsored">Pending Review</span>:approvedByCharge.has(c.id)?<span className="badge verified">Credit Approved</span>:c.billing_status==='void'?<span className="badge neutral">Voided</span>:<button className="btn btn-small btn-light" onClick={()=>{setSelected(c.id);setMessage('')}}>Request Review</button>}</td></tr>})}</tbody></table></div>:<div className="empty">No delivered charges match this filter.</div>}
  </section>

  {selectedCharge?<section className="card owner-credit-request"><div className="kpi">Credit Exception Request</div><h2>Request review of this delivered lead</h2><p className="muted">Credits are not based on whether you closed the lead. Use this only for a documented exception such as a duplicate, materially invalid contact, spam/fraud, or a lead materially outside the agreed scope.</p><div className="admin-form-grid"><label>Reason<select value={reason} onChange={e=>setReason(e.target.value)}><option value="duplicate">Duplicate lead</option><option value="invalid_contact">Materially invalid contact information</option><option value="spam_or_fraud">Spam or suspected fraud</option><option value="out_of_scope">Outside agreed service scope</option><option value="other">Other documented exception</option></select></label><label className="full-row">Details<textarea value={details} onChange={e=>setDetails(e.target.value)} maxLength={1600} placeholder="Explain what is wrong with the delivered lead and provide enough detail for staff to verify it."/></label></div>{message?<div className={`notice ${message.includes('submitted')?'success':'warn'}`}>{message}</div>:null}<div className="card-actions"><button className="btn btn-primary" disabled={busy||details.trim().length<10} onClick={submit}>{busy?'Submitting…':'Submit Credit Request'}</button><button className="btn btn-light" onClick={()=>{setSelected('');setDetails('');setMessage('')}}>Cancel</button></div></section>:null}

  {requests.length>0?<section className="card owner-billing-section"><div className="section-head compact-head"><div><div className="kpi">Credit Request History</div><h2>Reviews</h2></div><span className="badge neutral">{requests.length}</span></div><div className="owner-credit-history">{requests.map(r=><article key={r.id}><div><span className={`badge ${r.status==='approved'?'verified':r.status==='pending'?'sponsored':'neutral'}`}>{label(r.status)}</span><strong>{label(r.reason)}</strong><small>Requested {date(r.created_at)}{r.reviewed_at?` · reviewed ${date(r.reviewed_at)}`:''}</small></div>{r.approved_credit_cents!=null?<b>{money(r.approved_credit_cents)}</b>:null}{r.details?<p>{r.details}</p>:null}{r.staff_notes?<p className="muted"><strong>Staff note:</strong> {r.staff_notes}</p>:null}</article>)}</div></section>:null}
 </div>
}
