import{NextResponse}from'next/server'
import{createClient}from'@/lib/supabase/server'
import{TENANT_ID}from'@/lib/constants'

const str=(v:unknown,n:number)=>String(v??'').trim().slice(0,n)
export async function POST(req:Request){
 try{
  const body=await req.json() as Record<string,unknown>
  const s=await createClient()
  const businessId=str(body.business_id,40)||null
  const service=str(body.service,120),city=str(body.city,100),zip=str(body.zip_code,10),name=str(body.name,120),phone=str(body.phone,40),email=str(body.email,160)
  if(!service||!city||!name||phone.length<7||!email.includes('@')||body.consent!==true)return NextResponse.json({error:'Please complete the required project and contact fields and consent.'},{status:400})
  const answers=body.answers&&typeof body.answers==='object'&&!Array.isArray(body.answers)?body.answers:{}
  const{data,error}=await s.rpc('submit_project_match',{p_tenant_id:TENANT_ID,p_business_id:businessId,p_service:service,p_city:city,p_zip_code:zip||null,p_consumer_name:name,p_phone:phone,p_email:email,p_message:str(body.message,2400)||null,p_timeline:str(body.timeline,80)||null,p_project_type:str(body.project_type,120)||null,p_property_type:str(body.property_type,80)||null,p_budget_range:str(body.budget_range,80)||null,p_preferred_contact:str(body.preferred_contact,40)||null,p_answers:answers,p_consent_to_contact:true})
  if(error)return NextResponse.json({error:error.message},{status:400})
  return NextResponse.json({ok:true,lead_id:data},{headers:{'Cache-Control':'no-store'}})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to submit project.'},{status:400})}
}
