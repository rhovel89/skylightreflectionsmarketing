type Row=Record<string,any>

export type ExecutionMovement='favorable'|'unfavorable'|'unchanged'
export type ExecutionOutcomeStatus='pending'|'not_comparable'|'improved'|'mixed'|'no_change'|'declined'
export type ExecutionMetric={key:string;label:string;unit:string;direction:'higher'|'lower';baseline:number;remeasured:number;delta:number;delta_pct:number|null;movement:ExecutionMovement}

const num=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:null}
const round=(n:number,d=3)=>Number(n.toFixed(d))
const snapshotData=(row:Row)=>row&&typeof row.snapshot_data==='object'&&row.snapshot_data?row.snapshot_data as Row:row
const metric=(key:string,label:string,unit:string,direction:'higher'|'lower',baseline:any,remeasured:any):ExecutionMetric|null=>{
  const b=num(baseline),a=num(remeasured)
  if(b==null||a==null)return null
  const delta=a-b,deltaPct=b===0?null:(delta/b)*100
  const movement:ExecutionMovement=Math.abs(delta)<1e-9?'unchanged':direction==='higher'?(delta>0?'favorable':'unfavorable'):(delta<0?'favorable':'unfavorable')
  return {key,label,unit,direction,baseline:round(b),remeasured:round(a),delta:round(delta),delta_pct:deltaPct==null?null:round(deltaPct,1),movement}
}

export function compareVisibilityExecutionSnapshots(baselineRow:Row,remeasuredRow:Row){
  const before=snapshotData(baselineRow),after=snapshotData(remeasuredRow)
  const bCurrent=(before.current||{}) as Row,aCurrent=(after.current||{}) as Row
  const metrics:(ExecutionMetric|null)[]=[
    metric('opportunity_score','Opportunity score','points','lower',before.opportunity_score,after.opportunity_score),
    metric('website_health','Website health','points','higher',bCurrent.website?.health,aCurrent.website?.health),
    metric('gsc_clicks','Organic clicks','count','higher',bCurrent.search_console?.clicks,aCurrent.search_console?.clicks),
    metric('gsc_impressions','Organic impressions','count','higher',bCurrent.search_console?.impressions,aCurrent.search_console?.impressions),
    metric('gsc_ctr','Organic CTR','ratio','higher',bCurrent.search_console?.ctr,aCurrent.search_console?.ctr),
    metric('gsc_position','Average organic position','position','lower',bCurrent.search_console?.position,aCurrent.search_console?.position),
    metric('ranking_average_position','Tracked ranking average position','position','lower',bCurrent.rankings?.average_position,aCurrent.rankings?.average_position),
    metric('ranking_top10','Tracked keywords in Top 10','count','higher',bCurrent.rankings?.top10,aCurrent.rankings?.top10),
    metric('gbp_actions','GBP measured actions','count','higher',bCurrent.gbp?.current_total,aCurrent.gbp?.current_total),
  ]
  const bComparisons=num(bCurrent.competitors?.rank_comparisons),aComparisons=num(aCurrent.competitors?.rank_comparisons)
  if(bComparisons!=null&&aComparisons!=null&&bComparisons===aComparisons&&bComparisons>0){
    metrics.push(metric('competitor_outranks','Competitor outrank measurements','count','lower',bCurrent.competitors?.competitor_outranks,aCurrent.competitors?.competitor_outranks))
  }
  const comparable=metrics.filter((m):m is ExecutionMetric=>Boolean(m))
  const favorable=comparable.filter(m=>m.movement==='favorable').length
  const unfavorable=comparable.filter(m=>m.movement==='unfavorable').length
  const unchanged=comparable.filter(m=>m.movement==='unchanged').length
  let status:ExecutionOutcomeStatus='not_comparable'
  if(comparable.length){
    if(favorable&&unfavorable)status='mixed'
    else if(favorable)status='improved'
    else if(unfavorable)status='declined'
    else status='no_change'
  }
  const summary=!comparable.length
    ?'No directly comparable stored metrics were available between the frozen baseline and the latest source-backed snapshot. No outcome is inferred.'
    :`Across ${comparable.length} directly comparable stored metric${comparable.length===1?'':'s'}, ${favorable} moved in a favorable direction, ${unfavorable} moved in an unfavorable direction and ${unchanged} were unchanged. This is a before/after measurement only and does not establish that the completed work caused the change.`
  const source_refs=[
    {table:'business_visibility_opportunity_snapshots',id:String(baselineRow.id),checked_at:baselineRow.generated_at||baselineRow.created_at||null,source_url:null,label:'Frozen baseline visibility snapshot'},
    {table:'business_visibility_opportunity_snapshots',id:String(remeasuredRow.id),checked_at:remeasuredRow.generated_at||remeasuredRow.created_at||null,source_url:null,label:'Remeasurement visibility snapshot'},
  ]
  return {status,summary,metrics:comparable,source_refs,favorable,unfavorable,unchanged,comparable_count:comparable.length}
}

const pad=(n:number)=>String(n).padStart(2,'0')
function addMonthsIso(iso:string,months:number){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if(!m)return iso
  const year=Number(m[1]),month=Number(m[2])-1,day=Number(m[3]),raw=month+months
  const targetYear=year+Math.floor(raw/12),targetMonth=((raw%12)+12)%12
  const maxDay=new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate()
  return `${targetYear}-${pad(targetMonth+1)}-${pad(Math.min(day,maxDay))}`
}

export function advanceReportingDueDate(currentDue:string,cadence:'monthly'|'quarterly',todayIso=new Date().toISOString().slice(0,10)){
  const step=cadence==='quarterly'?3:1
  let next=currentDue
  for(let i=0;i<60;i++){
    next=addMonthsIso(next,step)
    if(next>todayIso)return next
  }
  return next
}
