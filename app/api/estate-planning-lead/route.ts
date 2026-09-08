import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const STATES=new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'])
const str=(v:unknown,n:number)=>String(v??'').trim().slice(0,n)

export async function POST(req:Request){
  try{
    const body=await req.json() as Record<string,unknown>
    const name=str(body.consumer_name,120),phone=str(body.phone,40),email=str(body.email,160),city=str(body.city,100),state=str(body.state,2).toUpperCase(),zip=str(body.zip_code,10),need=str(body.primary_need,120)
    if(name.length<2||phone.length<7||!email.includes('@')||city.length<2||!STATES.has(state)||!/^\d{5}(-\d{4})?$/.test(zip)||need.length<2||body.consent_to_contact!==true||body.consent_to_share!==true){
      return NextResponse.json({error:'Please complete the required contact, location, planning-need, and consent fields.'},{status:400})
    }
    const s=await createClient()
    const {data,error}=await s.rpc('submit_estate_planning_lead',{
      p_tenant_id:TENANT_ID,
      p_consumer_name:name,
      p_phone:phone,
      p_email:email,
      p_city:city,
      p_state:state,
      p_zip_code:zip,
      p_primary_need:need,
      p_existing_plan:str(body.existing_plan,120)||null,
      p_family_context:str(body.family_context,160)||null,
      p_business_owner:body.business_owner===true,
      p_real_estate_owner:body.real_estate_owner===true,
      p_timeline:str(body.timeline,80)||null,
      p_preferred_contact:str(body.preferred_contact,40)||null,
      p_message:str(body.message,2000)||null,
      p_consent_to_contact:true,
      p_consent_to_share:true,
    })
    if(error)return NextResponse.json({error:error.message},{status:400})
    return NextResponse.json({ok:true,lead_id:data,automatic_routing:false,automatic_sale:false,automatic_contact:false},{headers:{'Cache-Control':'no-store'}})
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Unable to submit estate-planning request.'},{status:400})
  }
}
