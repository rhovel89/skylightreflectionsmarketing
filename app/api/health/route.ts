import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TENANT_ID, TENANT_SLUG } from '@/lib/constants'

export const dynamic='force-dynamic'
const deploymentCommit=()=>process.env.VERCEL_GIT_COMMIT_SHA||null
const releaseTrain='business-visibility-intelligence-4.2-google-owned-data'

async function integrationFlags(){
  const flags:any={
    resend_api_key_configured:Boolean(process.env.RESEND_API_KEY),
    supabase_service_role_configured:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    cron_secret_configured:Boolean(process.env.CRON_SECRET),
    resend_webhook_secret_configured:Boolean(process.env.RESEND_WEBHOOK_SECRET),
    sales_reply_to_configured:Boolean(process.env.SALES_INBOUND_REPLY_TO_EMAIL),
    google_calendar_configured:Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID&&process.env.GOOGLE_CALENDAR_CLIENT_SECRET&&process.env.GOOGLE_CALENDAR_REFRESH_TOKEN),
    stored_resend_webhook_secret_configured:false,
    brightlocal_api_key_configured:Boolean(process.env.BRIGHTLOCAL_API_KEY),
    google_pagespeed_api_key_configured:Boolean(process.env.GOOGLE_PAGESPEED_API_KEY),
    google_visibility_oauth_configured:Boolean(process.env.GOOGLE_VISIBILITY_CLIENT_ID&&process.env.GOOGLE_VISIBILITY_CLIENT_SECRET&&process.env.GOOGLE_VISIBILITY_REFRESH_TOKEN)
  }
  if(flags.supabase_service_role_configured){try{const s=createServiceClient(),q=await s.from('skylight_sales_provider_secrets').select('id').eq('tenant_id',TENANT_ID).eq('provider','resend').eq('secret_key','sales_webhook_signing_secret').maybeSingle();flags.stored_resend_webhook_secret_configured=Boolean(q.data?.id)}catch{}}
  flags.inbound_email_runtime_ready=Boolean(flags.resend_api_key_configured&&flags.supabase_service_role_configured&&(flags.resend_webhook_secret_configured||flags.stored_resend_webhook_secret_configured))
  flags.visibility_monitoring_cron_configured=Boolean(flags.cron_secret_configured&&flags.supabase_service_role_configured)
  flags.google_search_console_api_runtime_ready=flags.google_visibility_oauth_configured
  flags.google_business_profile_api_runtime_credentials_ready=flags.google_visibility_oauth_configured
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
      business_visibility_intelligence:true,website_live_audit:true,website_audit_ssrf_guard:true,google_ranking_history_source_backed:true,google_ranking_source_required:true,missing_rank_is_not_measured:true,visibility_data_public_ranking_effect:false,
      visibility_monitoring_foundation:true,visibility_competitor_intelligence:true,visibility_alert_engine:true,visibility_sales_evidence_human_approved:true,visibility_monitoring_cron_route:true,visibility_google_rank_auto_sync:false,visibility_brightlocal_adapter_ready:false,visibility_competitor_data_separate:true,visibility_missing_rank_not_measured:true,visibility_public_ranking_effect:false,
      visibility_free_mode:true,visibility_bulk_rank_import:true,visibility_import_provenance:true,visibility_brightlocal_optional:true,google_pagespeed_no_key_mode:true,google_pagespeed_api_key_optional:true,google_rank_scraping:false,visibility_recommendations_evidence_based:true,
      google_owned_data_intelligence:true,google_search_console_import:true,google_business_profile_performance_import:true,google_business_profile_keyword_import:true,google_owned_data_deduplicated:true,google_owned_data_source_backed:true,google_search_console_api_adapter:true,google_business_profile_api_adapter:true,google_business_profile_api_requires_google_approval:true,google_owned_data_public_ranking_effect:false,google_owned_data_schema_hardened:true,google_oauth_tokens_database_stored:false,
      ...integrations,response_ms:Date.now()-started
    },{status:200,headers:{'Cache-Control':'no-store'}})
  }catch{return NextResponse.json({ok:false,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'unavailable',deployment_commit:deploymentCommit()},{status:503,headers:{'Cache-Control':'no-store'}})}
}
