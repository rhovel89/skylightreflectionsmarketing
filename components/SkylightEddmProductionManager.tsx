'use client'

import{FormEvent,useMemo,useState}from'react'
import{createClient as createBrowserClient}from'@/lib/supabase/client'

type R=Record<string,any>
const rel=(v:any)=>Array.isArray(v)?v[0]??null:v??null
const money=(c:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(c||0)/100)
const dollars=(c:any)=>c==null?'':(Number(c)/100).toFixed(2)
const pretty=(v:any)=>String(v??'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())
const dateText=(v:any)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString():'—'
const dt=(v:any)=>v?new Date(v).toLocaleString():'—'
const autoGrid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:12} as const
const stageOptions=['interest','selling','filled','artwork','payment','ready_to_print','printing','usps_drop','mailed','completed','on_hold','cancelled']
const spotStatuses=['held','reserved','artwork','approved','paid','print_ready','cancelled','retired']
const assetTypes=['customer_artwork','proof','approved_proof','print_ready','usps_document','other']

async function post(payload:R){
  const r=await fetch('/api/admin/skylight-eddm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
  const b=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(String(b.error||'Request failed'))
  return b
}

export function SkylightEddmProductionManager({tenantId,packages,markets,interests,spots,assets,financials,activity}:{tenantId:string;packages:R[];markets:R[];interests:R[];spots:R[];assets:R[];financials:R[];activity:R[]}){
  const[msg,setMsg]=useState(''),[busy,setBusy]=useState(false)
  const marketById=useMemo(()=>new Map(markets.map(m=>[String(m.id),m])),[markets])
  const interestById=useMemo(()=>new Map(interests.map(i=>[String(i.id),i])),[interests])
  const finByMarket=useMemo(()=>new Map(financials.map(f=>[String(f.market_id),f])),[financials])
  const spotsByMarket=useMemo(()=>{const m=new Map<string,R[]>();for(const s of spots){const k=String(s.market_id),a=m.get(k)||[];a.push(s);m.set(k,a)}return m},[spots])
  const interestsByMarket=useMemo(()=>{const m=new Map<string,R[]>();for(const i of interests){if(!i.market_id)continue;const k=String(i.market_id),a=m.get(k)||[];a.push(i);m.set(k,a)}return m},[interests])
  const assetsByInterest=useMemo(()=>{const m=new Map<string,R[]>();for(const a of assets){if(!a.interest_id)continue;const k=String(a.interest_id),x=m.get(k)||[];x.push(a);m.set(k,x)}return m},[assets])
  const activeMarkets=markets.filter(m=>!['completed','cancelled'].includes(String(m.production_status||'')))
  const unassignedSingle=interests.filter(i=>i.mode==='single_business'&&!i.market_id&&!['lost','cancelled'].includes(String(i.status)))
  const activeFin=financials.filter(f=>activeMarkets.some(m=>String(m.id)===String(f.market_id)))
  const summary={jobs:activeMarkets.length,filled:activeFin.reduce((n,f)=>n+Number(f.filled_spots||0),0),artwork:activeFin.reduce((n,f)=>n+Number(f.artwork_pending_count||0),0),balance:activeFin.reduce((n,f)=>n+Number(f.balance_due_cents||0),0),profit:activeFin.reduce((n,f)=>n+Number(f.projected_profit_cents||0),0)}
  const attention=useMemo(()=>{
    const out:{level:string;text:string;marketId?:string}[]=[]
    const now=Date.now()
    for(const m of activeMarkets){
      const f=finByMarket.get(String(m.id))||{},mail=m.target_mail_date?new Date(`${m.target_mail_date}T12:00:00`).getTime():0,days=mail?Math.ceil((mail-now)/86400000):null
      if(m.campaign_mode==='coop'&&Number(f.total_spots||0)>Number(f.filled_spots||0)&&days!==null&&days<=14)out.push({level:'high',marketId:String(m.id),text:`${m.name}: ${Number(f.total_spots||0)-Number(f.filled_spots||0)} ad spots are still open with the target mail date ${days<0?'past due':`${days} day${days===1?'':'s'} away`}.`})
      if(Number(f.artwork_pending_count||0)>0)out.push({level:'high',marketId:String(m.id),text:`${m.name}: ${f.artwork_pending_count} committed advertiser${Number(f.artwork_pending_count)===1?'':'s'} still need approved/print-ready artwork.`})
      if(Number(f.balance_due_cents||0)>0&&['payment','ready_to_print','printing','usps_drop'].includes(String(m.production_status)))out.push({level:'high',marketId:String(m.id),text:`${m.name}: ${money(f.balance_due_cents)} remains unpaid while the campaign is in ${pretty(m.production_status)}.`})
      if(Number(f.break_even_remaining_cents||0)>0)out.push({level:'medium',marketId:String(m.id),text:`${m.name}: ${money(f.break_even_remaining_cents)} more committed revenue is needed to cover current estimated costs.`})
    }
    const readySingle=unassignedSingle.filter(i=>['committed','won'].includes(String(i.status))).length
    if(readySingle)out.unshift({level:'high',text:`${readySingle} committed dedicated EDDM request${readySingle===1?' is':'s are'} ready to become production jobs.`})
    const changes=assets.filter(a=>a.status==='needs_changes').length
    if(changes)out.unshift({level:'high',text:`${changes} artwork/proof file${changes===1?' is':'s are'} marked Needs Changes.`})
    return out.slice(0,20)
  },[activeMarkets,finByMarket,unassignedSingle,assets])

  const act=async(payload:R,success:string)=>{setBusy(true);setMsg('');try{await post(payload);setMsg(success);location.reload()}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}
  const saveProduction=(e:FormEvent<HTMLFormElement>,m:R)=>{e.preventDefault();const f=new FormData(e.currentTarget);void act({action:'save_market_production',id:m.id,production_status:f.get('production_status'),target_piece_count:f.get('target_piece_count'),target_mail_date:f.get('target_mail_date'),actual_mail_date:f.get('actual_mail_date'),artwork_due_date:f.get('artwork_due_date'),print_due_date:f.get('print_due_date'),target_revenue:f.get('target_revenue'),print_vendor:f.get('print_vendor'),usps_drop_location:f.get('usps_drop_location'),usps_confirmation:f.get('usps_confirmation'),print_cost_estimate:f.get('print_cost_estimate'),postage_cost_estimate:f.get('postage_cost_estimate'),design_cost_estimate:f.get('design_cost_estimate'),other_cost_estimate:f.get('other_cost_estimate'),print_cost_actual:f.get('print_cost_actual'),postage_cost_actual:f.get('postage_cost_actual'),design_cost_actual:f.get('design_cost_actual'),other_cost_actual:f.get('other_cost_actual'),production_notes:f.get('production_notes')},'Production job saved.')}
  const reserveSpot=(e:FormEvent<HTMLFormElement>,s:R)=>{e.preventDefault();const f=new FormData(e.currentTarget),submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null,mode=submitter?.value==='hold'?'hold':'reserve';void act({action:'reserve_spot',spot_id:s.id,interest_id:f.get('interest_id'),reservation_mode:mode,price:f.get('price')},mode==='hold'?'Spot placed on hold.':'Spot reserved.')}
  const updateSpot=(e:FormEvent<HTMLFormElement>,s:R)=>{e.preventDefault();const f=new FormData(e.currentTarget);void act({action:'update_spot',id:s.id,status:f.get('status'),price:f.get('price'),notes:f.get('notes')},'Spot updated.')}
  const saveTemplate=(e:FormEvent<HTMLFormElement>,p:R)=>{e.preventDefault();const f=new FormData(e.currentTarget);void act({action:'save_slot_template',id:p.id,slot_prefix:f.get('slot_prefix'),slot_count:f.get('slot_count')},'Spot template saved and open campaigns synchronized.')}
  const uploadAsset=async(e:FormEvent<HTMLFormElement>,i:R)=>{
    e.preventDefault();const form=e.currentTarget,f=new FormData(form),file=f.get('file') as File,assetType=String(f.get('asset_type')||'customer_artwork')
    if(!file||!file.size){setMsg('Choose an artwork or PDF file first.');return}
    if(file.size>26214400){setMsg('EDDM artwork files must be 25 MB or smaller.');return}
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){setMsg('Use JPG, PNG, WebP or PDF artwork.');return}
    setBusy(true);setMsg('')
    try{
      const supabase=createBrowserClient(),safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-140),path=`${tenantId}/${i.market_id||'independent'}/${i.id}/${Date.now()}-${safe}`
      const up=await supabase.storage.from('eddm-assets').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error
      try{await post({action:'register_asset',market_id:i.market_id||null,interest_id:i.id,asset_type:assetType,file_name:file.name,storage_path:path,mime_type:file.type,file_size_bytes:file.size,notes:f.get('notes')})}catch(err){await supabase.storage.from('eddm-assets').remove([path]);throw err}
      setMsg('Artwork uploaded to private EDDM storage.');form.reset();location.reload()
    }catch(err:any){setMsg(String(err?.message||'Artwork upload failed.'))}finally{setBusy(false)}
  }
  const viewAsset=async(a:R)=>{setBusy(true);setMsg('');try{const s=createBrowserClient(),{data,error}=await s.storage.from('eddm-assets').createSignedUrl(String(a.storage_path),300);if(error)throw error;if(data?.signedUrl)window.open(data.signedUrl,'_blank','noopener,noreferrer')}catch(e:any){setMsg(String(e?.message||'Unable to open artwork.'))}finally{setBusy(false)}}

  return <div style={{display:'grid',gap:18,marginBottom:22}}>
    {msg?<div className="notice">{msg}</div>:null}
    <div style={autoGrid}>
      <div className="admin-card"><div className="kpi">Active Production Jobs</div><h2>{summary.jobs}</h2></div>
      <div className="admin-card"><div className="kpi">Co-op Spots Filled</div><h2>{summary.filled}</h2></div>
      <div className="admin-card"><div className="kpi">Artwork Pending</div><h2>{summary.artwork}</h2></div>
      <div className="admin-card"><div className="kpi">Outstanding EDDM</div><h2>{money(summary.balance)}</h2></div>
      <div className="admin-card"><div className="kpi">Projected Profit</div><h2>{money(summary.profit)}</h2><div className="small muted">Estimate from committed revenue and entered estimated costs.</div></div>
    </div>

    <section className="admin-card">
      <div className="section-head"><div><div className="kpi">What Needs Attention Now?</div><h2>EDDM production attention queue</h2><p className="muted">Private operational warnings only. These do not affect public rankings, verification or Sponsored placement.</p></div><span className="badge">{attention.length} items</span></div>
      {attention.length?<div style={{display:'grid',gap:8}}>{attention.map((a,n)=><div className={`notice ${a.level==='high'?'warn':''}`} key={`${a.marketId||'global'}-${n}`}>{a.text}</div>)}</div>:<div className="notice">No immediate EDDM production warnings based on the current data.</div>}
    </section>

    <section className="admin-card">
      <div className="section-head"><div><div className="kpi">Mailer Spot Template</div><h2>Edit A/B/C inventory without touching code</h2><p className="muted">Changing a prefix or count adds missing slots to open co-op campaigns. Occupied historical spots are never automatically deleted.</p></div></div>
      <div className="grid grid-3">{packages.filter(p=>p.mode==='coop'&&p.active).map(p=><form className="card" key={p.id} onSubmit={e=>saveTemplate(e,p)}><strong>{p.name}</strong><div className="grid grid-2" style={{marginTop:8}}><label className="field"><span>Slot Prefix</span><input name="slot_prefix" required maxLength={8} defaultValue={p.slot_prefix||String(p.package_key||'').slice(-1).toUpperCase()}/></label><label className="field"><span>Slot Count</span><input name="slot_count" required type="number" min="1" max="100" defaultValue={p.slot_count||1}/></label></div><button className="btn btn-light" disabled={busy}>Save Slot Template</button></form>)}</div>
    </section>

    {unassignedSingle.length?<section className="admin-card"><div className="section-head"><div><div className="kpi">Dedicated EDDM</div><h2>Requests not yet converted to production jobs</h2></div></div><div style={{overflowX:'auto'}}><table><thead><tr><th>Business</th><th>Target</th><th>Pieces</th><th>Sales Status</th><th>Invoice</th><th>Production</th></tr></thead><tbody>{unassignedSingle.map(i=>{const inv=rel(i.invoice);return <tr key={i.id}><td><strong>{i.business_name}</strong><div className="small muted">{i.email||i.phone||'—'}</div></td><td>{[i.city,i.state,i.postal_code].filter(Boolean).join(' · ')||i.area_description||'To confirm'}</td><td>{i.desired_piece_count?Number(i.desired_piece_count).toLocaleString():'—'}</td><td><span className="badge">{pretty(i.status)}</span></td><td>{inv?<><strong>{inv.invoice_number}</strong><div className="small muted">{pretty(inv.status)} · {money(inv.total_cents)}</div></>:'Not created'}</td><td><button className="btn btn-primary" disabled={busy} onClick={()=>void act({action:'start_single_job',id:i.id},'Dedicated EDDM production job created.')}>Create Production Job</button></td></tr>})}</tbody></table></div></section>:null}

    <section className="admin-card">
      <div className="section-head"><div><div className="kpi">Production Board</div><h2>Campaigns from selling through USPS delivery</h2><p className="muted">Stages advance manually. Reaching an interest threshold never auto-bills, auto-prints or auto-mails.</p></div></div>
      <div style={{display:'grid',gap:18}}>{markets.length?markets.map(m=>{
        const f=finByMarket.get(String(m.id))||{},ms=(spotsByMarket.get(String(m.id))||[]).slice().sort((a,b)=>String(a.slot_code).localeCompare(String(b.slot_code),undefined,{numeric:true})),mi=interestsByMarket.get(String(m.id))||[],filled=Number(f.filled_spots||0),total=Number(f.total_spots||0),occupancy=total?Math.round(filled/total*100):0
        return <article className="card" id={`eddm-market-${m.id}`} key={m.id} style={{display:'grid',gap:14}}>
          <div className="section-head"><div><div className="kpi">{m.campaign_mode==='single_business'?'Dedicated EDDM Job':'Co-op Community Mailer'}</div><h2>{m.name}</h2><p className="muted">{[m.city,m.state,m.county].filter(Boolean).join(' · ')||m.area_description||'Market details to confirm'}</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><span className="badge">{pretty(m.production_status)}</span><span className="badge">{Number(m.target_piece_count||0).toLocaleString()} pieces</span></div></div>
          <div style={autoGrid}>
            <div><div className="kpi">Projected Revenue</div><strong>{money(f.projected_revenue_cents)}</strong></div>
            <div><div className="kpi">Estimated Cost</div><strong>{money(f.estimated_cost_cents)}</strong></div>
            <div><div className="kpi">Projected Profit</div><strong>{money(f.projected_profit_cents)}</strong></div>
            <div><div className="kpi">Paid</div><strong>{money(f.paid_cents)}</strong></div>
            <div><div className="kpi">Outstanding</div><strong>{money(f.balance_due_cents)}</strong></div>
            <div><div className="kpi">Break-even Gap</div><strong>{money(f.break_even_remaining_cents)}</strong></div>
          </div>
          {m.campaign_mode==='coop'?<div><div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong>Spot occupancy: {filled}/{total}</strong><span className="small muted">{occupancy}% filled · Max preset inventory {money(f.max_spot_revenue_cents)}</span></div><progress value={filled} max={Math.max(total,1)} style={{width:'100%',height:14}}/></div>:<div className="notice"><strong>Dedicated campaign:</strong> no shared ad-slot threshold applies. Revenue comes from the linked dedicated invoice/target amount.</div>}
          <form onSubmit={e=>saveProduction(e,m)} style={{display:'grid',gap:10}}>
            <div className="grid grid-4">
              <label className="field"><span>Production Stage</span><select name="production_status" defaultValue={m.production_status}>{stageOptions.map(x=><option key={x} value={x}>{pretty(x)}</option>)}</select></label>
              <label className="field"><span>Target Pieces</span><input name="target_piece_count" type="number" min="1" defaultValue={m.target_piece_count??''}/></label>
              <label className="field"><span>Target Mail Date</span><input name="target_mail_date" type="date" defaultValue={m.target_mail_date||''}/></label>
              <label className="field"><span>Actual Mail Date</span><input name="actual_mail_date" type="date" defaultValue={m.actual_mail_date||''}/></label>
              <label className="field"><span>Artwork Due</span><input name="artwork_due_date" type="date" defaultValue={m.artwork_due_date||''}/></label>
              <label className="field"><span>Print Due</span><input name="print_due_date" type="date" defaultValue={m.print_due_date||''}/></label>
              <label className="field"><span>Target Revenue ($)</span><input name="target_revenue" type="number" min="0" step="0.01" defaultValue={dollars(m.target_revenue_cents)}/></label>
              <label className="field"><span>Print Vendor</span><input name="print_vendor" defaultValue={m.print_vendor||''}/></label>
              <label className="field"><span>USPS Drop Location</span><input name="usps_drop_location" defaultValue={m.usps_drop_location||''}/></label>
              <label className="field"><span>USPS Confirmation / Reference</span><input name="usps_confirmation" defaultValue={m.usps_confirmation||''}/></label>
            </div>
            <div className="kpi">Estimated Campaign Costs</div>
            <div className="grid grid-4"><label className="field"><span>Printing ($)</span><input name="print_cost_estimate" type="number" min="0" step="0.01" defaultValue={dollars(m.print_cost_estimate_cents)}/></label><label className="field"><span>Postage ($)</span><input name="postage_cost_estimate" type="number" min="0" step="0.01" defaultValue={dollars(m.postage_cost_estimate_cents)}/></label><label className="field"><span>Design ($)</span><input name="design_cost_estimate" type="number" min="0" step="0.01" defaultValue={dollars(m.design_cost_estimate_cents)}/></label><label className="field"><span>Other ($)</span><input name="other_cost_estimate" type="number" min="0" step="0.01" defaultValue={dollars(m.other_cost_estimate_cents)}/></label></div>
            <div className="kpi">Actual Campaign Costs</div>
            <div className="grid grid-4"><label className="field"><span>Printing ($)</span><input name="print_cost_actual" type="number" min="0" step="0.01" defaultValue={dollars(m.print_cost_actual_cents)}/></label><label className="field"><span>Postage ($)</span><input name="postage_cost_actual" type="number" min="0" step="0.01" defaultValue={dollars(m.postage_cost_actual_cents)}/></label><label className="field"><span>Design ($)</span><input name="design_cost_actual" type="number" min="0" step="0.01" defaultValue={dollars(m.design_cost_actual_cents)}/></label><label className="field"><span>Other ($)</span><input name="other_cost_actual" type="number" min="0" step="0.01" defaultValue={dollars(m.other_cost_actual_cents)}/></label></div>
            <label className="field"><span>Private Production Notes</span><textarea name="production_notes" rows={3} defaultValue={m.production_notes||''}/></label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn btn-primary" disabled={busy}>Save Production Job</button>{m.campaign_mode==='coop'?<button type="button" className="btn btn-light" disabled={busy} onClick={()=>void act({action:'sync_spots',market_id:m.id},'Spot inventory synchronized.')}>Sync Spot Inventory</button>:null}</div>
          </form>

          {m.campaign_mode==='coop'?<div><div className="section-head"><div><div className="kpi">Ad Inventory</div><h3>Mailer spot map</h3></div><span className="badge">{filled}/{total} filled</span></div><div className="grid grid-4">{ms.map(s=>{const si=interestById.get(String(s.interest_id||'')),pkg=rel(s.package),inv=si?rel(si.invoice):null,eligible=mi.filter(i=>!['lost','cancelled'].includes(String(i.status)));return <div className="card" key={s.id} style={{display:'grid',gap:8}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong style={{fontSize:22}}>{s.slot_code}</strong><span className="badge">{pretty(s.status)}</span></div><div className="small muted">{pkg?.name||s.package_key} · preset {money(pkg?.price_cents)}</div>{si?<><div><strong>{si.business_name}</strong><div className="small muted">Artwork: {pretty(si.artwork_status)} · Invoice: {inv?pretty(inv.status):'Not Created'}</div></div><form onSubmit={e=>updateSpot(e,s)} style={{display:'grid',gap:6}}><select name="status" defaultValue={s.status}>{spotStatuses.map(x=><option value={x} key={x}>{pretty(x)}</option>)}</select><input name="price" type="number" min="0" step="0.01" defaultValue={dollars(s.agreed_price_cents??pkg?.price_cents)} placeholder="Agreed price"/><input name="notes" defaultValue={s.notes||''} placeholder="Private spot note"/><button className="btn btn-light" disabled={busy}>Update Spot</button></form><button className="btn btn-light" type="button" disabled={busy} onClick={()=>void act({action:'release_spot',spot_id:s.id},`Spot ${s.slot_code} released.`)}>Release Spot</button></>:<form onSubmit={e=>reserveSpot(e,s)} style={{display:'grid',gap:6}}><select name="interest_id" required defaultValue=""><option value="" disabled>Select advertiser</option>{eligible.map(i=><option key={i.id} value={i.id}>{i.business_name} — {pretty(i.status)}</option>)}</select><input name="price" type="number" min="0" step="0.01" defaultValue={dollars(pkg?.price_cents)} placeholder="Agreed price"/><div style={{display:'flex',gap:6}}><button className="btn btn-light" name="reservation_mode" value="hold" disabled={busy}>Hold</button><button className="btn btn-primary" name="reservation_mode" value="reserve" disabled={busy}>Reserve</button></div></form>}</div>})}</div></div>:null}

          <div><div className="section-head"><div><div className="kpi">Advertiser Readiness</div><h3>Artwork, invoice and production status</h3></div></div>{mi.length?<div style={{overflowX:'auto'}}><table><thead><tr><th>Advertiser</th><th>Spot</th><th>Sales</th><th>Artwork</th><th>Invoice</th><th>Balance</th><th>Artwork Files</th></tr></thead><tbody>{mi.filter(i=>!['lost','cancelled'].includes(String(i.status))).map(i=>{const inv=rel(i.invoice),is=i.id?ms.filter(s=>String(s.interest_id||'')===String(i.id)):[],ia=assetsByInterest.get(String(i.id))||[];return <tr key={i.id}><td><strong>{i.business_name}</strong><div className="small muted">{i.email||i.phone||'—'}</div></td><td>{is.map(s=>s.slot_code).join(', ')||'—'}</td><td><span className="badge">{pretty(i.status)}</span></td><td><span className="badge">{pretty(i.artwork_status)}</span><div className="small muted">Due {dateText(i.artwork_due_date||m.artwork_due_date)}</div></td><td>{inv?<><a href={`/invoice/${inv.public_token}`} target="_blank" rel="noreferrer"><strong>{inv.invoice_number}</strong></a><div className="small muted">{pretty(inv.status)} · {money(inv.total_cents)}</div></>:'Not created'}</td><td>{inv?money(inv.balance_due_cents):'—'}</td><td><form onSubmit={e=>uploadAsset(e,i)} style={{display:'grid',gap:5,minWidth:220}}><select name="asset_type" defaultValue="customer_artwork">{assetTypes.map(x=><option key={x} value={x}>{pretty(x)}</option>)}</select><input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required/><input name="notes" placeholder="File note"/><button className="btn btn-light" disabled={busy}>Upload Private Artwork</button></form>{ia.length?<div style={{display:'grid',gap:4,marginTop:6}}>{ia.slice(0,5).map(a=><div key={a.id} className="small"><button type="button" className="btn btn-light" onClick={()=>void viewAsset(a)} disabled={busy}>View</button> <strong>{a.file_name}</strong> · {pretty(a.asset_type)} · {pretty(a.status)} <button type="button" className="btn btn-light" onClick={()=>void act({action:'update_asset',id:a.id,status:'approved'},'Artwork approved.')} disabled={busy}>Approve</button> <button type="button" className="btn btn-light" onClick={()=>void act({action:'update_asset',id:a.id,status:'needs_changes'},'Artwork marked needs changes.')} disabled={busy}>Needs Changes</button> <button type="button" className="btn btn-light" onClick={()=>void act({action:'delete_asset',id:a.id},'Artwork removed.')} disabled={busy}>Delete</button></div>)}</div>:null}</td></tr>})}</tbody></table></div>:<div className="notice">No advertisers are linked to this production job yet.</div>}</div>
        </article>
      }):<div className="notice">No EDDM production jobs exist yet. Co-op markets are created below; dedicated requests can be converted from the queue above.</div>}</div>
    </section>

    <section className="admin-card"><div className="section-head"><div><div className="kpi">Production Activity</div><h2>EDDM operations timeline</h2></div></div>{activity.length?<div style={{display:'grid',gap:8}}>{activity.slice(0,100).map(a=>{const m=marketById.get(String(a.market_id||'')),i=interestById.get(String(a.interest_id||''));return <div className="card" key={a.id}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong>{pretty(a.event_type)}</strong><span className="small muted">{dt(a.created_at)}</span></div><div>{a.message}</div><div className="small muted">{m?.name||'EDDM'}{i?` · ${i.business_name}`:''}</div></div>})}</div>:<div className="notice">Production activity will appear as spots are reserved, artwork is uploaded and campaign stages change.</div>}</section>
  </div>
}
