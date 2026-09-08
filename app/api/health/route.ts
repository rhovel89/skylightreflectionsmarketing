import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID, TENANT_SLUG } from '@/lib/constants'

export const dynamic='force-dynamic'
// Production deployment retry: 2026-09-08. No behavior change.

export async function GET(){
  try{
    const s=await createClient(),{error}=await s.from('tenants').select('id').eq('id',TENANT_ID).maybeSingle()
    if(error)return NextResponse.json({ok:false,service:TENANT_SLUG},{status:503,headers:{'Cache-Control':'no-store'}})
    return NextResponse.json({ok:true,service:TENANT_SLUG},{status:200,headers:{'Cache-Control':'no-store'}})
  }catch{return NextResponse.json({ok:false,service:TENANT_SLUG},{status:503,headers:{'Cache-Control':'no-store'}})}
}
