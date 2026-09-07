import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TENANT_ID, TENANT_SLUG } from '@/lib/constants'

export const dynamic='force-dynamic'
const deploymentCommit=()=>process.env.VERCEL_GIT_COMMIT_SHA||null
const releaseTrain='sales-command-center-3.8-client-acquisition-engine'

async function integrationFlags(){
  const flags:any={resend_api_key_configured:Boolean(process.env.RESEND_API_KEY),supabase_service_role_configured:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),resend_webhook_secret_configured:Boolean(process.env.RESEND_WEBHOOK_SECRET),sales_reply_to_configured:Boolean(process.env.SALES_INBOUND_REPLY_TO_EMAIL),google_calendar_configured:Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID&&process.env.GOOGLE_CALENDAR_CLIENT_SECRET&&process.env.GOOGLE_CALENDAR_REFRESH_TOKEN),stored_resend_webhook_secret_configured:false}
  if(flags.supabase_service_role_configured){try{const s=createServiceClient(),q=await s.from('skylight_sales_provider_secrets').select('id').eq('tenant_id',TENANT_ID).eq('provider','resend').eq('secret_key','sales_webhook_signing_secret').maybeSingle();flags.stored_resend_webhook_secret_configured=Boolean(q.data?.id)}catch{}}
  flags.inbound_email_runtime_ready=Boolean(flags.resend_api_key_configured&&flags.supabase_service_role_configured&&(flags.resend_webhook_secret_configured||flags.stored_resend_webhook_secret_configured))
  return flags
}

export async function GET(){
  const started=Date.now()
  try{
    const s=await createClient(),{error}=await s.from('tenants').select('id').eq('id',TENANT_ID).maybeSingle()
    if(error)return NextResponse.json({ok:false,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'unavailable',deployment_commit:deploymentCommit()},{status:503,headers:{'Cache-Control':'no-store'}})
    const integrations=await integrationFlags()
    return NextResponse.json({
      ok:true,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'ok',deployment_commit:deploymentCommit(),
      automatic_outreach:false,billing_authorization:false,public_ranking_effect:false,automatic_campaign_enrollment:false,
      reply_classification_advisory:true,response_send_requires_staff_approval:true,calendar_event_requires_staff_action:true,calendar_invite_requires_staff_confirmation:true,
      paid_revenue_attribution_only:true,database_action_automation:true,daily_metrics_snapshots:true,first_touch_campaign_attribution:true,forecast_close_dates_staff_entered:true,
      acquisition_readiness_metrics:true,acquisition_conversion_metrics_factual:true,acquisition_sample_maturity_labels:true,campaign_spend_staff_entered:true,acquisition_experiments_human_controlled:true,cac_requires_recorded_wins:true,roas_requires_recorded_spend:true,
      ...integrations,response_ms:Date.now()-started
    },{status:200,headers:{'Cache-Control':'no-store'}})
  }catch{
    return NextResponse.json({ok:false,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'unavailable',deployment_commit:deploymentCommit()},{status:503,headers:{'Cache-Control':'no-store'}})
  }
}
