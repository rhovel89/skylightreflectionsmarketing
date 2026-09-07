import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID, TENANT_SLUG } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const deploymentCommit=()=>process.env.VERCEL_GIT_COMMIT_SHA||null
const releaseTrain='sales-command-center-3.6-inbox-revenue-operations'
const inboundConfigured=()=>Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_WEBHOOK_SECRET&&process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function GET() {
  const started = Date.now()
  try {
    const s = await createClient()
    const { error } = await s.from('tenants').select('id').eq('id', TENANT_ID).maybeSingle()
    if (error) return NextResponse.json({ ok:false,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'unavailable',deployment_commit:deploymentCommit() },{status:503,headers:{'Cache-Control':'no-store'}})
    return NextResponse.json({ ok:true,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'ok',deployment_commit:deploymentCommit(),automatic_outreach:false,billing_authorization:false,public_ranking_effect:false,reply_classification_advisory:true,inbound_email_ingestion_configured:inboundConfigured(),response_send_requires_staff_approval:true,paid_revenue_attribution_only:true,response_ms:Date.now()-started },{status:200,headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({ ok:false,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'unavailable',deployment_commit:deploymentCommit() },{status:503,headers:{'Cache-Control':'no-store'}})
  }
}
