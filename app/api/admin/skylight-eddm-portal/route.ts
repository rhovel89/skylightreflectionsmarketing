import{NextResponse}from'next/server'
import{createClient}from'@/lib/supabase/server'
import{requireAdmin}from'@/lib/auth'
import{TENANT_ID}from'@/lib/constants'
const str=(v:unknown,n=4000)=>String(v??'').trim().slice(0,n)
export async function POST(req:Request){try{await requireAdmin('/admin/skylight-eddm');const s=await createClient(),body=await req.json() as Record<string,any>,action=str(body.action,40)
 if(action==='invite'){const origin=new URL(req.url).origin,{data,error}=await s.rpc('admin_create_eddm_portal_invite',{p_interest_id:str(body.interest_id,40),p_base_url:origin,p_send_email:body.send_email!==false});if(error)throw error;return NextResponse.json({ok:true,...(data as any)})}
 if(action==='reply'){const{data,error}=await s.rpc('admin_send_eddm_portal_message',{p_interest_id:str(body.interest_id,40),p_body:str(body.body,4000)});if(error)throw error;await s.from('skylight_eddm_portal_messages').update({read_by_staff_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('interest_id',str(body.interest_id,40)).eq('sender_type','customer').is('read_by_staff_at',null);return NextResponse.json({ok:true,data})}
 if(action==='access'){const{data,error}=await s.rpc('admin_set_skylight_client_portal_access',{p_access_id:str(body.access_id,40),p_status:str(body.status,20)});if(error)throw error;return NextResponse.json({ok:true,data})}
 if(action==='mark_read'){const{error}=await s.from('skylight_eddm_portal_messages').update({read_by_staff_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',str(body.message_id,40));if(error)throw error;return NextResponse.json({ok:true})}
 return NextResponse.json({error:'Unsupported portal Admin action.'},{status:400})}catch(e:any){return NextResponse.json({error:String(e?.message||'Unable to process portal Admin action.')},{status:400})}}
