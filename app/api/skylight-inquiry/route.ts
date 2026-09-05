import{NextResponse}from'next/server'
import{createClient}from'@/lib/supabase/server'
import{TENANT_ID}from'@/lib/constants'
const str=(v:unknown,n:number)=>String(v??'').trim().slice(0,n)
export async function POST(req:Request){try{const body=await req.json() as Record<string,unknown>,s=await createClient();const{data,error}=await s.rpc('submit_skylight_service_inquiry',{p_tenant_id:TENANT_ID,p_service_slug:str(body.service_slug,120)||null,p_business_name:str(body.business_name,160),p_contact_name:str(body.contact_name,120)||null,p_phone:str(body.phone,80)||null,p_email:str(body.email,240)||null,p_message:str(body.message,2400)||null,p_consent_to_contact:Boolean(body.consent_to_contact)});if(error)throw error;return NextResponse.json({ok:true,id:data})}catch(e:any){return NextResponse.json({error:String(e?.message||'Unable to submit Skylight service request.')},{status:400})}}
