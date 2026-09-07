import { createHash } from 'node:crypto'
import { compareVisibilityExecutionSnapshots } from '@/lib/business-visibility-execution'

type Row=Record<string,any>
export type ClientHealthStatus='healthy'|'watch'|'attention'|'insufficient_data'
export type ClientHealthSeverity='info'|'watch'|'attention'|'critical'
export type ClientHealthSignal={key:string;severity:ClientHealthSeverity;label:string;detail:string;points:number;source_refs:Row[]}

const hash=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const ts=(v:any)=>{if(typeof v==='number'&&Number.isFinite(v))return v;const n=new Date(String(v||'')).getTime();return Number.isFinite(n)?n:0}
const num=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:0}
const daysBetween=(a:any,b:any)=>{const x=ts(a),y=ts(b);return x&&y?Math.max(0,Math.floor((y-x)/86400000)):null}
const money=(rows:Row[],kind:string)=>rows.filter(r=>String(r.kind||'payment')===kind).reduce((s,r)=>s+num(r.amount_cents),0)
const sourceRef=(table:string,row:Row,label:string,dateField='updated_at')=>({table,id:String(row.id),checked_at:row[dateField]||row.created_at||null,source_url:null,label})
const activeTask=(r:Row)=>!['done','cancelled'].includes(String(r.status||''))
const activeExecution=(r:Row)=>['planned','in_progress'].includes(String(r.status||''))

function trendWindow(snapshots:Row[],days:number){
  const rows=[...snapshots].filter(r=>ts(r.generated_at||r.created_at)>0).sort((a,b)=>ts(b.generated_at||b.created_at)-ts(a.generated_at||a.created_at))
  const latest=rows[0]
  if(!latest)return {status:'not_comparable',label:`${days}-day`,actual_days:null,summary:'No source-backed visibility snapshot is available.',metrics:[]}
  const latestAt=ts(latest.generated_at||latest.created_at),target=latestAt-days*86400000
  const candidates=rows.slice(1).map(r=>({row:r,diff:Math.abs(ts(r.generated_at||r.created_at)-target)})).sort((a,b)=>a.diff-b.diff)
  const baseline=candidates[0]?.row
  if(!baseline)return {status:'not_comparable',label:`${days}-day`,actual_days:null,summary:`A ${days}-day comparison needs at least two source-backed visibility snapshots.`,metrics:[]}
  const actual=Math.round((latestAt-ts(baseline.generated_at||baseline.created_at))/86400000)
  if(actual<Math.max(7,Math.round(days*.4))||actual>Math.round(days*1.8))return {status:'not_comparable',label:`${days}-day`,actual_days:actual,summary:`The nearest stored baseline is ${actual} days from the latest snapshot, outside the comparison tolerance for a ${days}-day trend.`,metrics:[]}
  const comparison=compareVisibilityExecutionSnapshots(baseline,latest)
  return {status:comparison.status,label:`${days}-day`,actual_days:actual,summary:comparison.summary,metrics:comparison.metrics,favorable:comparison.favorable,unfavorable:comparison.unfavorable,unchanged:comparison.unchanged,baseline_snapshot_id:String(baseline.id),latest_snapshot_id:String(latest.id),baseline_at:baseline.generated_at||baseline.created_at||null,latest_at:latest.generated_at||latest.created_at||null}
}

export function buildVisibilityClientHealth(input:{
  client:Row;business:Row;visibilitySnapshots:Row[];executions:Row[];reportSchedule:Row|null;projects:Row[];projectTasks:Row[];invoices:Row[];payments:Row[];recurringServices:Row[];finalizedReports:Row[];todayIso?:string
}){
  const todayIso=input.todayIso||new Date().toISOString().slice(0,10),todayTs=ts(`${todayIso}T23:59:59Z`)
  const snapshots=[...input.visibilitySnapshots].sort((a,b)=>ts(b.generated_at||b.created_at)-ts(a.generated_at||a.created_at)),latest=snapshots[0]||null
  const signals:ClientHealthSignal[]=[]
  const add=(key:string,severity:ClientHealthSeverity,label:string,detail:string,points:number,refs:Row[]=[])=>signals.push({key,severity,label,detail,points,source_refs:refs})

  const overdueExecutions=input.executions.filter(r=>activeExecution(r)&&r.due_date&&String(r.due_date)<todayIso)
  if(overdueExecutions.length){const oldest=Math.max(...overdueExecutions.map(r=>daysBetween(`${r.due_date}T00:00:00Z`,todayTs)||0));const critical=overdueExecutions.some(r=>['critical','high'].includes(String(r.priority))&&Number(daysBetween(`${r.due_date}T00:00:00Z`,todayTs)||0)>=7);add('execution_overdue',critical?'critical':'attention','Visibility work overdue',`${overdueExecutions.length} visibility execution item${overdueExecutions.length===1?' is':'s are'} overdue; oldest is ${oldest} day${oldest===1?'':'s'} past due.`,critical?28:20,overdueExecutions.slice(0,20).map(r=>sourceRef('business_visibility_execution_items',r,'Overdue visibility execution','updated_at')))}

  const overdueRemeasurements=input.executions.filter(r=>['work_completed','remeasurement_due'].includes(String(r.status))&&!r.remeasurement_snapshot_id&&r.remeasurement_due_date&&String(r.remeasurement_due_date)<todayIso)
  if(overdueRemeasurements.length)add('remeasurement_overdue','attention','Remeasurement overdue',`${overdueRemeasurements.length} completed work item${overdueRemeasurements.length===1?' needs':'s need'} a source-backed post-work measurement.`,18,overdueRemeasurements.slice(0,20).map(r=>sourceRef('business_visibility_execution_items',r,'Overdue remeasurement','updated_at')))

  const schedule=input.reportSchedule
  if(schedule?.active&&schedule.next_due_date&&String(schedule.next_due_date)<todayIso){const late=daysBetween(`${schedule.next_due_date}T00:00:00Z`,todayTs)||0;add('report_overdue',late>=14?'critical':'attention','Client visibility report overdue',`The internal ${String(schedule.cadence)} reporting cycle is ${late} day${late===1?'':'s'} past its due date.`,late>=14?25:18,[sourceRef('business_visibility_report_schedules',schedule,'Overdue client reporting schedule','updated_at')])}

  const projectIds=new Set(input.projects.map(r=>String(r.id)))
  const overdueTasks=input.projectTasks.filter(r=>projectIds.has(String(r.project_id))&&activeTask(r)&&r.due_date&&String(r.due_date)<todayIso)
  if(overdueTasks.length){const urgent=overdueTasks.some(r=>String(r.priority)==='urgent');add('project_tasks_overdue',urgent?'critical':'attention','Project tasks overdue',`${overdueTasks.length} linked Skylight project task${overdueTasks.length===1?' is':'s are'} overdue.`,urgent?22:14,overdueTasks.slice(0,25).map(r=>sourceRef('skylight_project_tasks',r,'Overdue project task','updated_at')))}

  const unhealthyProjects=input.projects.filter(r=>['attention','at_risk','blocked'].includes(String(r.health))&&!['completed','cancelled'].includes(String(r.status)))
  if(unhealthyProjects.length){const blocked=unhealthyProjects.some(r=>String(r.health)==='blocked'||String(r.health)==='at_risk');add('project_health',blocked?'critical':'watch','Project health needs attention',`${unhealthyProjects.length} active Skylight project${unhealthyProjects.length===1?' is':'s are'} marked ${blocked?'at risk/blocked':'attention'}.`,blocked?20:8,unhealthyProjects.slice(0,20).map(r=>sourceRef('skylight_projects',r,'Project health status','updated_at')))}

  const clientUpdatesDue=input.projects.filter(r=>r.next_client_update_at&&ts(r.next_client_update_at)<todayTs&&!['completed','cancelled'].includes(String(r.status)))
  if(clientUpdatesDue.length)add('client_update_due','watch','Client update due',`${clientUpdatesDue.length} active project${clientUpdatesDue.length===1?' has':'s have'} a client update date in the past.`,7,clientUpdatesDue.slice(0,20).map(r=>sourceRef('skylight_projects',r,'Client update due','updated_at')))

  const overdueInvoices=input.invoices.filter(r=>num(r.balance_due_cents)>0&&!['paid','void'].includes(String(r.status))&&((r.due_date&&String(r.due_date)<todayIso)||String(r.status)==='overdue'))
  if(overdueInvoices.length){const balance=overdueInvoices.reduce((s,r)=>s+num(r.balance_due_cents),0);add('invoice_overdue','attention','Recorded invoice balance overdue',`${overdueInvoices.length} invoice${overdueInvoices.length===1?' has':'s have'} an overdue recorded balance totaling $${(balance/100).toFixed(2)}.`,18,overdueInvoices.slice(0,20).map(r=>sourceRef('skylight_invoices',r,'Overdue invoice','updated_at')))}

  const measurementAge=latest?daysBetween(latest.generated_at||latest.created_at,todayTs):null
  if(!latest)add('visibility_not_measured','info','Visibility measurement unavailable','No stored source-backed visibility opportunity snapshot is available. Missing measurement is not treated as zero or as poor performance.',0,[])
  else if(measurementAge!=null&&measurementAge>45)add('visibility_measurement_stale','watch','Visibility measurement is stale',`The latest stored source-backed visibility snapshot is ${measurementAge} days old.`,10,[sourceRef('business_visibility_opportunity_snapshots',latest,'Latest visibility snapshot','generated_at')])

  const recentCutoff=todayTs-90*86400000
  const recentMeasured=input.executions.filter(r=>r.remeasured_at&&ts(r.remeasured_at)>=recentCutoff)
  const declined=recentMeasured.filter(r=>String(r.outcome_status)==='declined'),mixed=recentMeasured.filter(r=>String(r.outcome_status)==='mixed')
  if(declined.length)add('recent_declined_outcome','watch','Recent measured decline',`${declined.length} remeasured work item${declined.length===1?' has':'s have'} a declined before/after outcome in the last 90 days. This is observational and does not establish causation.`,12,declined.slice(0,20).map(r=>sourceRef('business_visibility_execution_items',r,'Declined measured outcome','remeasured_at')))
  else if(mixed.length)add('recent_mixed_outcome','watch','Recent mixed outcome',`${mixed.length} remeasured work item${mixed.length===1?' has':'s have'} a mixed before/after outcome in the last 90 days.`,5,mixed.slice(0,20).map(r=>sourceRef('business_visibility_execution_items',r,'Mixed measured outcome','remeasured_at')))

  const activeRecurring=input.recurringServices.filter(r=>String(r.status)==='active')
  const renewalSoon=activeRecurring.filter(r=>{if(!r.contract_end_date||String(r.contract_end_date)<todayIso)return false;const until=daysBetween(`${todayIso}T00:00:00Z`,`${r.contract_end_date}T00:00:00Z`);return until!=null&&until<=90})
  if(renewalSoon.length){const soonest=[...renewalSoon].sort((a,b)=>String(a.contract_end_date).localeCompare(String(b.contract_end_date)))[0];add('renewal_window','info','Contract review window approaching',`${renewalSoon.length} active recurring service${renewalSoon.length===1?' has':'s have'} a recorded contract end within 90 days; the nearest is ${soonest.contract_end_date}.`,0,renewalSoon.slice(0,20).map(r=>sourceRef('skylight_recurring_services',r,'Recurring service contract window','updated_at')))}

  const attentionPoints=Math.min(100,signals.reduce((s,r)=>s+r.points,0)),hasCritical=signals.some(r=>r.severity==='critical')
  const hasMeasuredEvidence=Boolean(latest||recentMeasured.length||input.finalizedReports.length)
  let health_status:ClientHealthStatus='healthy'
  if(hasCritical||attentionPoints>=30)health_status='attention'
  else if(attentionPoints>0)health_status='watch'
  else if(!hasMeasuredEvidence)health_status='insufficient_data'

  const trend_windows={days_30:trendWindow(snapshots,30),days_60:trendWindow(snapshots,60),days_90:trendWindow(snapshots,90)}
  const invoiceIds=new Set(input.invoices.map(r=>String(r.id)))
  const scopedPayments=input.payments.filter(r=>invoiceIds.has(String(r.invoice_id)))
  const payments90=scopedPayments.filter(r=>ts(r.paid_at)>=recentCutoff)
  const net90=money(payments90,'payment')-money(payments90,'refund'),netLifetime=money(scopedPayments,'payment')-money(scopedPayments,'refund')
  const openBalance=input.invoices.filter(r=>String(r.status)!=='void').reduce((s,r)=>s+num(r.balance_due_cents),0),overdueBalance=overdueInvoices.reduce((s,r)=>s+num(r.balance_due_cents),0)
  const delivery_metrics={open_execution_items:input.executions.filter(r=>!['remeasured','cancelled'].includes(String(r.status))).length,overdue_execution_items:overdueExecutions.length,overdue_remeasurements:overdueRemeasurements.length,overdue_project_tasks:overdueTasks.length,projects_needing_attention:unhealthyProjects.length,client_updates_due:clientUpdatesDue.length,report_overdue:Boolean(schedule?.active&&schedule.next_due_date&&String(schedule.next_due_date)<todayIso),latest_finalized_report_at:input.finalizedReports[0]?.finalized_at||null,latest_visibility_snapshot_at:latest?.generated_at||latest?.created_at||null,measurement_age_days:measurementAge,measured_outcomes_90d:recentMeasured.length,improved_outcomes_90d:recentMeasured.filter(r=>String(r.outcome_status)==='improved').length,mixed_outcomes_90d:mixed.length,declined_outcomes_90d:declined.length}
  const revenue_metrics={recorded_net_payments_90d_cents:net90,recorded_net_payments_lifetime_cents:netLifetime,open_balance_cents:openBalance,overdue_balance_cents:overdueBalance,active_recurring_services:activeRecurring.length,recorded_recurring_amount_cents:activeRecurring.reduce((s,r)=>s+num(r.amount_cents),0),renewal_windows_90d:renewalSoon.length,roi_status:'not_calculated_without_cost_evidence'}
  const signal_counts={info:signals.filter(r=>r.severity==='info').length,watch:signals.filter(r=>r.severity==='watch').length,attention:signals.filter(r=>r.severity==='attention').length,critical:signals.filter(r=>r.severity==='critical').length}
  const suggested_renewal_readiness=health_status==='attention'||health_status==='watch'?'needs_attention':!hasMeasuredEvidence?'insufficient_data':renewalSoon.length?'ready_for_review':'not_assessed'

  const refs:Row[]=[]
  if(latest)refs.push(sourceRef('business_visibility_opportunity_snapshots',latest,'Latest visibility snapshot','generated_at'))
  refs.push(...input.executions.slice(0,100).map(r=>sourceRef('business_visibility_execution_items',r,'Visibility execution','updated_at')))
  if(schedule)refs.push(sourceRef('business_visibility_report_schedules',schedule,'Client reporting schedule','updated_at'))
  refs.push(...input.projects.slice(0,50).map(r=>sourceRef('skylight_projects',r,'Skylight project','updated_at')))
  refs.push(...input.projectTasks.slice(0,100).map(r=>sourceRef('skylight_project_tasks',r,'Skylight project task','updated_at')))
  refs.push(...input.invoices.slice(0,80).map(r=>sourceRef('skylight_invoices',r,'Skylight invoice','updated_at')))
  refs.push(...scopedPayments.slice(0,100).map(r=>sourceRef('skylight_invoice_payments',r,'Recorded invoice payment','paid_at')))
  refs.push(...input.recurringServices.slice(0,50).map(r=>sourceRef('skylight_recurring_services',r,'Recurring service','updated_at')))
  refs.push(...input.finalizedReports.slice(0,30).map(r=>sourceRef('business_visibility_reports',r,'Finalized client visibility report','finalized_at')))

  const source_fingerprint=hash({as_of:todayIso,client_id:input.client.id,business_id:input.business.id,snapshots:snapshots.map(r=>[r.id,r.generated_at||r.created_at,r.source_fingerprint]),executions:input.executions.map(r=>[r.id,r.status,r.priority,r.due_date,r.remeasurement_due_date,r.remeasured_at,r.outcome_status,r.updated_at]),schedule:schedule?[schedule.id,schedule.active,schedule.next_due_date,schedule.last_report_id,schedule.updated_at]:null,projects:input.projects.map(r=>[r.id,r.status,r.health,r.due_date,r.next_client_update_at,r.updated_at]),tasks:input.projectTasks.map(r=>[r.id,r.status,r.priority,r.due_date,r.updated_at]),invoices:input.invoices.map(r=>[r.id,r.status,r.due_date,r.balance_due_cents,r.updated_at]),payments:scopedPayments.map(r=>[r.id,r.kind,r.amount_cents,r.paid_at]),recurring:input.recurringServices.map(r=>[r.id,r.status,r.amount_cents,r.billing_interval,r.contract_end_date,r.auto_renew,r.updated_at]),reports:input.finalizedReports.map(r=>[r.id,r.finalized_at])})

  return {health_status,attention_points:attentionPoints,signal_counts,signals,delivery_metrics,revenue_metrics,trend_windows,suggested_renewal_readiness,latest_visibility_snapshot_id:latest?.id||null,latest_visibility_snapshot_at:latest?.generated_at||latest?.created_at||null,source_refs:refs.slice(0,300),source_fingerprint,measurement_disclosure:'Missing data is neutral. Operational health flags are deterministic summaries of recorded facts, not predictions of churn or client sentiment.',outcome_disclosure:'Visibility changes are observational before/after measurements and do not prove that Skylight work caused the change.',roi_disclosure:'Paid revenue is shown only from recorded invoice payments. ROI is not calculated without recorded cost evidence.'}
}
