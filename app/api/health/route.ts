import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID, TENANT_SLUG } from '@/lib/constants'

export const dynamic = 'force-dynamic'

// Runtime sync marker: customizable Skylight service intake, secure client asset collection, review workflow, and focused FK indexing are synchronized in this tree.
const deploymentCommit=()=>process.env.VERCEL_GIT_COMMIT_SHA||null

export async function GET() {
  const started = Date.now()
  try {
    const s = await createClient()
    const { error } = await s.from('tenants').select('id').eq('id', TENANT_ID).maybeSingle()
    if (error) return NextResponse.json({ ok:false,service:TENANT_SLUG,version:'15.5.0',database:'unavailable',deployment_commit:deploymentCommit() },{status:503,headers:{'Cache-Control':'no-store'}})
    return NextResponse.json({ ok:true,service:TENANT_SLUG,version:'15.5.0',database:'ok',deployment_commit:deploymentCommit(),response_ms:Date.now()-started },{status:200,headers:{'Cache-Control':'no-store'}})
  } catch {
    return NextResponse.json({ ok:false,service:TENANT_SLUG,version:'15.5.0',database:'unavailable',deployment_commit:deploymentCommit() },{status:503,headers:{'Cache-Control':'no-store'}})
  }
}
