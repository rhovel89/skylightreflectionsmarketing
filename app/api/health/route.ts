import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID, TENANT_SLUG } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const deploymentCommit=()=>process.env.VERCEL_GIT_COMMIT_SHA||null
const releaseTrain='sales-command-center-3.2'

export async function GET() {
  const started = Date.now()
  try {
    const s = await createClient()
    const { error } = await s.from('tenants').select('id').eq('id', TENANT_ID).maybeSingle()
    if (error) return NextResponse.json({ ok:false,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'unavailable',deployment_commit:deploymentCommit() },{status:503,headers:{'Cache-Control':'no-store'}})
    return NextResponse.json({ ok:true,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'ok',deployment_commit:deploymentCommit(),response_ms:Date.now()-started },{status:200,headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({ ok:false,service:TENANT_SLUG,version:'15.5.0',release_train:releaseTrain,database:'unavailable',deployment_commit:deploymentCommit() },{status:503,headers:{'Cache-Control':'no-store'}})
  }
}
