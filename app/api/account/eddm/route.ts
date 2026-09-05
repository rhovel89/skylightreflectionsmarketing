import{NextResponse}from'next/server'
import{createClient}from'@/lib/supabase/server'
import{requireUser}from'@/lib/auth'
const str=(v:unknown,n=4000)=>String(v??'').trim().slice(0,n)
export async function POST(req:Request){try{await requireUser('/account/eddm');const s=await createClient(),body=await req.json() as Record<string,any>,action=str(body.action,40)
 if(action==='claim'){const token=str(body.token,40);if(!/^[0-9a-f-]{36}$/i.test(token))return NextResponse.json({error:'Invalid portal invitation.'},{status:400});const{data,error}=await s.rpc('claim_skylight_client_portal_invite',{p_token:token});if(error)throw error;return NextResponse.json({ok:true,data})}
 if(action==='register_artwork'){const{data,error}=await s.rpc('customer_register_eddm_artwork',{p_interest_id:str(body.interest_id,40),p_file_name:str(body.file_name,240),p_storage_path:str(body.storage_path,700),p_mime_type:str(body.mime_type,120),p_file_size_bytes:Number(body.file_size_bytes||0),p_note:str(body.note,1600)||null});if(error)throw error;return NextResponse.json({ok:true,data})}
 if(action==='review_proof'){const{data,error}=await s.rpc('customer_review_eddm_proof',{p_asset_id:str(body.asset_id,40),p_decision:str(body.decision,20),p_note:str(body.note,2000)||null});if(error)throw error;return NextResponse.json({ok:true,data})}
 if(action==='send_message'){const{data,error}=await s.rpc('customer_send_eddm_portal_message',{p_interest_id:str(body.interest_id,40),p_body:str(body.body,4000)});if(error)throw error;return NextResponse.json({ok:true,data})}
 return NextResponse.json({error:'Unsupported EDDM portal action.'},{status:400})}catch(e:any){return NextResponse.json({error:String(e?.message||'Unable to process EDDM portal action.')},{status:400})}}
