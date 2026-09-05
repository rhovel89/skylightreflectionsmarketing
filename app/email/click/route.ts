import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'

export async function GET(request:Request){
  const url=new URL(request.url)
  const token=url.searchParams.get('token')||''
  if(!/^[0-9a-f-]{36}$/i.test(token))return Response.redirect(new URL('/for-businesses',getSiteUrl()),302)
  const s=await createClient()
  const{data}=await s.rpc('record_email_click',{p_token:token})
  const target=typeof data==='string'?data:''
  try{
    const destination=new URL(target,getSiteUrl())
    if(!['http:','https:'].includes(destination.protocol))throw new Error('unsupported protocol')
    return Response.redirect(destination,302)
  }catch{
    return Response.redirect(new URL('/for-businesses',getSiteUrl()),302)
  }
}
