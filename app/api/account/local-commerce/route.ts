import{NextResponse}from'next/server'
import{createClient}from'@/lib/supabase/server'
import{getClaims}from'@/lib/auth'

const str=(v:unknown,n:number)=>String(v??'').trim().slice(0,n)
export async function POST(req:Request){try{const claims=await getClaims();if(!claims?.sub)return NextResponse.json({error:'Sign in is required for community recommendations, questions and local alerts.'},{status:401});const body=await req.json() as Record<string,unknown>;const action=str(body.action,40),s=await createClient();let data:any=null,error:any=null
 if(action==='recommendation')({data,error}=await s.rpc('submit_business_recommendation',{p_business_id:str(body.business_id,40),p_service:str(body.service,120)||null,p_city:str(body.city,100)||null,p_body:str(body.body,1200),p_service_date:body.service_date?str(body.service_date,10):null}))
 else if(action==='question')({data,error}=await s.rpc('submit_local_pro_question',{p_business_id:str(body.business_id,40),p_question:str(body.question,1200)}))
 else if(action==='alert')({data,error}=await s.rpc('upsert_consumer_local_alert',{p_location_id:body.location_id?str(body.location_id,40):null,p_category_id:body.category_id?str(body.category_id,40):null,p_alert_type:str(body.alert_type,40),p_email:body.email_enabled!==false,p_in_app:body.in_app_enabled!==false,p_active:body.active!==false}))
 else return NextResponse.json({error:'Unsupported account action.'},{status:400})
 if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true,id:data},{headers:{'Cache-Control':'no-store'}})
}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to save account action.'},{status:400})}}
