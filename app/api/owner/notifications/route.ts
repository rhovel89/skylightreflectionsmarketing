import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

export async function GET(){
 const claims=await requireUser('/business-portal/notifications')
 const userId=String(claims.sub)
 const s=await createClient()
 const{data,error}=await s.from('notifications').select('id,title,body,action_url,read_at,created_at,event_key').eq('tenant_id',TENANT_ID).eq('user_id',userId).order('created_at',{ascending:false}).limit(100)
 if(error)return NextResponse.json({error:error.message},{status:400})
 const items=data??[]
 return NextResponse.json({items,unread_count:items.filter((x:any)=>!x.read_at).length},{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}})
}

export async function PATCH(req:Request){
 const claims=await requireUser('/business-portal/notifications')
 const userId=String(claims.sub)
 const body=await req.json().catch(()=>({})) as {ids?:string[];all?:boolean}
 const ids=Array.isArray(body.ids)?[...new Set(body.ids.map(String).filter(Boolean))].slice(0,100):[]
 if(!body.all&&!ids.length)return NextResponse.json({error:'Choose at least one notification.'},{status:400})
 const s=await createClient()
 let q=s.from('notifications').update({read_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('user_id',userId).is('read_at',null)
 if(!body.all)q=q.in('id',ids)
 const{error}=await q
 if(error)return NextResponse.json({error:error.message},{status:400})
 return NextResponse.json({ok:true})
}
