import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { SalesDailyOperatingSystem } from '@/components/SalesDailyOperatingSystem'

export const dynamic='force-dynamic'
type Row=Record<string,any>

export default async function SalesDailyPage(){
  await requireStaff('/admin/skylight-sales/daily')
  const s=await createClient(),now=Date.now(),since90=new Date(now-90*86400000).toISOString(),future180=new Date(now+180*86400000).toISOString()

  const lastRun=await s.from('skylight_sales_automation_runs').select('started_at,status').eq('tenant_id',TENANT_ID).eq('run_type','action_refresh').order('started_at',{ascending:false}).limit(1).maybeSingle()
  let refreshError:string|null=null
  if(!lastRun.error&&(!lastRun.data?.started_at||new Date(lastRun.data.started_at).getTime()<now-15*60000)){
    const refreshed=await s.rpc('refresh_skylight_sales_operating_system_staff',{p_tenant_id:TENANT_ID})
    if(refreshed.error)refreshError=refreshed.error.message
  }

  const [actionsR,settingsR,metricsR,oppsR,campaignsR,servicesR,meetingsR,runsR]=await Promise.all([
    s.from('skylight_sales_action_items').select('*').eq('tenant_id',TENANT_ID).in('status',['open','in_progress']).order('created_at',{ascending:false}).limit(3000),
    s.from('skylight_sales_action_settings').select('*').eq('tenant_id',TENANT_ID).maybeSingle(),
    s.from('skylight_sales_daily_metrics').select('*').eq('tenant_id',TENANT_ID).gte('metric_date',new Date(now-90*86400000).toISOString().slice(0,10)).order('metric_date',{ascending:false}).limit(5000),
    s.from('skylight_sales_opportunities').select('id,prospect_id,business_id,client_id,proposal_id,invoice_id,project_id,primary_service_slug,recommended_service_slugs,evidence_flags,score,priority,stage,active,estimated_value_cents,expected_close_date,assigned_user_id,last_contact_at,next_follow_up_at,first_reply_at,last_reply_at,won_at,lost_at,lost_reason,outcome_reason_code,attributed_revenue_cents,revenue_attributed_at,attribution_campaign_id,attribution_outreach_draft_id,attribution_source,attribution_locked_at,created_at,updated_at,prospect:business_prospects(id,business_name,city,status,owner_contact_name,owner_contact_title,owner_contact_email,owner_contact_phone)').eq('tenant_id',TENANT_ID).order('updated_at',{ascending:false}).limit(2500),
    s.from('skylight_sales_campaigns').select('id,name,slug,campaign_type,service_slug,status,created_at').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(1000),
    s.from('skylight_service_catalog').select('id,name,slug,service_kind,default_billing_interval,default_price_cents,active').eq('tenant_id',TENANT_ID).order('sort_order').limit(1000),
    s.from('skylight_sales_meetings').select('*').eq('tenant_id',TENANT_ID).gte('scheduled_at',since90).lte('scheduled_at',future180).order('scheduled_at',{ascending:true}).limit(1500),
    s.from('skylight_sales_automation_runs').select('*').eq('tenant_id',TENANT_ID).order('started_at',{ascending:false}).limit(100),
  ])

  const errors=[actionsR.error,settingsR.error,metricsR.error,oppsR.error,campaignsR.error,servicesR.error,meetingsR.error,runsR.error].filter(Boolean)
  const integrationStatus:Row={
    resend_api_key:Boolean(process.env.RESEND_API_KEY),
    supabase_service_role:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    resend_env_webhook_secret:Boolean(process.env.RESEND_WEBHOOK_SECRET),
    sales_reply_to:Boolean(process.env.SALES_INBOUND_REPLY_TO_EMAIL),
    google_calendar_credentials:Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID&&process.env.GOOGLE_CALENDAR_CLIENT_SECRET&&process.env.GOOGLE_CALENDAR_REFRESH_TOKEN),
    google_calendar_id:Boolean(process.env.GOOGLE_CALENDAR_ID),
    resend_stored_webhook_secret:false,
  }
  if(process.env.SUPABASE_SERVICE_ROLE_KEY){
    try{
      const service=createServiceClient(),q=await service.from('skylight_sales_provider_secrets').select('id,metadata').eq('tenant_id',TENANT_ID).eq('provider','resend').eq('secret_key','sales_webhook_signing_secret').maybeSingle()
      integrationStatus.resend_stored_webhook_secret=Boolean(q.data?.id)
      integrationStatus.resend_stored_webhook_id=q.data?.metadata?.webhook_id||null
    }catch{}
  }

  const defaults:Row={action_queue_enabled:true,auto_create_tasks:true,daily_snapshot_enabled:true,stale_opportunity_days:14,proposal_sent_followup_days:3,proposal_viewed_followup_days:2,proposal_expiring_days:3,meeting_reminder_hours:24,invoice_due_soon_days:3,hot_score_threshold:80,weight_new_bps:500,weight_research_bps:500,weight_contact_ready_bps:1500,weight_contacted_bps:2500,weight_qualified_bps:5000,weight_proposal_bps:7500,weight_nurture_bps:1000}
  return <>
    <div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing · Private Sales Operations</div><h1>Sales Command Center 3.7 — Daily Operating System</h1><p className="muted">A prioritized daily operating layer over Research, Outreach, Inbox, Meetings, Proposals, Projects and Revenue. It can generate administrative tasks, reconcile reporting and recommend next actions. It cannot authorize customer communication, billing, enrollment, routing, ranking or Sponsored placement.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/skylight-sales/inbox">Inbox & Revenue 3.6</Link><Link className="btn btn-light" href="/admin/skylight-sales/conversions">Conversion 3.5</Link></div></div>
    {refreshError?<div className="notice warn"><strong>Background refresh did not complete:</strong> {refreshError}. Existing source data is still shown; use Refresh Everything Now after resolving the error.</div>:null}
    {errors.length?<div className="notice warn"><strong>One or more 3.7 source queries are incomplete.</strong> Affected totals should not be treated as authoritative until the source query recovers.</div>:null}
    <div className="notice" style={{marginTop:14}}><strong>Human control remains authoritative.</strong> Daily automation creates tasks and factual snapshots only. Reply classifications are advisory; sends, calendar invitations, proposals, billing changes, DNC decisions and customer commitments require explicit staff actions.</div>
    <SalesDailyOperatingSystem actions={(actionsR.data||[]) as Row[]} settings={{...defaults,...(settingsR.data||{})}} metrics={(metricsR.data||[]) as Row[]} opportunities={(oppsR.data||[]) as Row[]} campaigns={(campaignsR.data||[]) as Row[]} services={(servicesR.data||[]) as Row[]} meetings={(meetingsR.data||[]) as Row[]} automationRuns={(runsR.data||[]) as Row[]} integrationStatus={integrationStatus}/>
  </>
}
