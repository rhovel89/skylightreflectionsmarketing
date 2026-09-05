import { createClient } from '@/lib/supabase/server'

const transparentGif=Uint8Array.from([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59])

export async function GET(request:Request){
  const token=new URL(request.url).searchParams.get('token')||''
  if(/^[0-9a-f-]{36}$/i.test(token)){
    const s=await createClient()
    await s.rpc('record_email_open',{p_token:token})
  }
  return new Response(transparentGif,{status:200,headers:{'Content-Type':'image/gif','Cache-Control':'no-store, no-cache, must-revalidate, max-age=0','Content-Length':String(transparentGif.byteLength)}})
}
