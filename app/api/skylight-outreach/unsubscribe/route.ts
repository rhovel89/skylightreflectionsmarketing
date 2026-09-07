import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function POST(req:Request){
  try{const body=await req.json() as {token?:string};const token=String(body.token||'').trim();if(!/^[0-9a-f-]{36}$/i.test(token))return NextResponse.json({ok:true,suppressed:true});const s=await createClient();const {error}=await s.from('skylight_sales_unsubscribe_requests').insert({token});if(error)throw error;return NextResponse.json({ok:true,suppressed:true},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({ok:false,error:'Unable to update outreach preference.'},{status:400,headers:{'Cache-Control':'no-store'}})}
}
