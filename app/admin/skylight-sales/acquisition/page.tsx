import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { SalesAcquisitionEngine } from '@/components/SalesAcquisitionEngine'

export const dynamic='force-dynamic'
type Row=Record<string,any>

export default async function SalesAcquisitionPage(){
  await requireStaff('/admin/skylight-sales/acquisition')
  const s=await createClient()

  let latest=await s.from('skylight_sales_acquisition_metrics').select('metric_date,updated_at').eq('tenant_id',TENANT_ID).order('metric_date',{ascending:false}).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  let refreshError:string|null=null
  if(!latest.data?.metric_date){
    const refreshed=await s.rpc('refresh_skylight_sales_operating_system_staff',{p_tenant_id:TENANT_ID})
    if(refreshed.error)refreshError=refreshed.error.message
    else latest=await s.from('skylight_sales_acquisition_metrics').select('metric_date,updated_at').eq('tenant_id',TENANT_ID).order('metric_date',{ascending:false}).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  }
  const metricDate=String(latest.data?.metric_date||new Date().toISOString().slice(0,10))

  const [metricsR,settingsR,campaignsR,templatesR,spendR,experimentsR,readyR,runsR]=await Promise.all([
    s.from('skylight_sales_acquisition_metrics').select('*').eq('tenant_id',TENANT_ID).eq('metric_date',metricDate).order('window_days').order('dimension_type').limit(12000),
    s.from('skylight_sales_acquisition_settings').select('*').eq('tenant_id',TENANT_ID).maybeSingle(),
    s.from('skylight_sales_campaigns').select('id,name,slug,campaign_type,service_slug,status,description,created_at').eq('tenant_id',TENANT_ID).order('name').limit(1000),
    s.from('skylight_sales_outreach_templates').select('id,name,service_slug,vertical,channel,sequence_stage,active,sort_order').eq('tenant_id',TENANT_ID).order('sort_order').limit(1000),
    s.from('skylight_sales_campaign_spend').select('*').eq('tenant_id',TENANT_ID).order('spend_date',{ascending:false}).order('created_at',{ascending:false}).limit(2000),
    s.from('skylight_sales_acquisition_experiments').select('*').eq('tenant_id',TENANT_ID).order('updated_at',{ascending:false}).limit(1000),
    s.from('skylight_sales_opportunities').select('id,prospect_id,primary_service_slug,recommended_service_slugs,evidence_flags,score,priority,stage,active,prospect:business_prospects(id,business_name,category,city,owner_contact_name,owner_contact_title,owner_contact_email,owner_contact_phone,owner_contact_source_url,owner_contact_checked_at,status)').eq('tenant_id',TENANT_ID).eq('active',true).eq('stage','contact_ready').order('score',{ascending:false}).limit(250),
    s.from('skylight_sales_automation_runs').select('*').eq('tenant_id',TENANT_ID).eq('run_type','acquisition_snapshot').order('started_at',{ascending:false}).limit(50),
  ])
  const errors=[metricsR.error,settingsR.error,campaignsR.error,templatesR.error,spendR.error,experimentsR.error,readyR.error,runsR.error].filter(Boolean)
  const defaults:Row={default_window_days:90,min_segment_opportunities:3,min_sent_sample_directional:10,min_sent_sample_mature:30,min_wins_for_cac:3,experiment_planner_enabled:true}
  const integrations:Row={email_delivery_ready:Boolean(process.env.RESEND_API_KEY),inbound_reply_runtime_ready:Boolean(process.env.RESEND_API_KEY&&process.env.SUPABASE_SERVICE_ROLE_KEY&&(process.env.RESEND_WEBHOOK_SECRET)),google_calendar_ready:Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID&&process.env.GOOGLE_CALENDAR_CLIENT_SECRET&&process.env.GOOGLE_CALENDAR_REFRESH_TOKEN)}

  return <>
    <div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing · Private Acquisition Intelligence</div><h1>Sales Command Center 3.8 — Client Acquisition Engine</h1><p className="muted">Measure the full acquisition path from research readiness through first-touch campaign attribution, replies, meetings, proposals, wins and collected revenue. Readiness works immediately; conversion, CAC and ROAS stay explicitly insufficient until real staff-approved outreach and outcomes exist.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/skylight-sales/daily">Daily Command 3.7</Link><Link className="btn btn-light" href="/admin/skylight-sales/outreach">Outreach 3.4</Link></div></div>
    {refreshError?<div className="notice warn"><strong>Acquisition snapshot refresh did not complete:</strong> {refreshError}</div>:null}
    {errors.length?<div className="notice warn"><strong>One or more acquisition sources are incomplete.</strong> Do not treat affected metrics as authoritative until the source query recovers.</div>:null}
    <div className="notice" style={{marginTop:14}}><strong>Evidence before conclusions.</strong> The engine never invents wins, replies, spend or ROI. A segment is not presented as a conversion winner until real sent-sample data exists; campaign spend is staff-entered; customer communication, campaign enrollment, billing and public ranking remain outside this automation.</div>
    <SalesAcquisitionEngine metricDate={metricDate} metrics={(metricsR.data||[]) as Row[]} settings={{...defaults,...(settingsR.data||{})}} campaigns={(campaignsR.data||[]) as Row[]} templates={(templatesR.data||[]) as Row[]} spend={(spendR.data||[]) as Row[]} experiments={(experimentsR.data||[]) as Row[]} readyOpportunities={(readyR.data||[]) as Row[]} automationRuns={(runsR.data||[]) as Row[]} integrations={integrations}/>
  </>
}
