import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ESTATE_SOURCE_PAGE } from '@/lib/estate-planning'

const STATES=new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'])
const str=(v:unknown,n:number)=>String(v??'').trim().slice(0,n)
const cleanReferrer=(v:unknown)=>{
  const raw=str(v,1000)
  if(!raw)return ''
  try{const u=new URL(raw);return `${u.origin}${u.pathname}`.slice(0,1000)}catch{return raw}
}

export async function POST(req:Request){
  try{
    const body=await req.json() as Record<string,unknown>
    if(str(body.website,200))return NextResponse.json({error:'Unable to submit this request.'},{status:400})
    const name=str(body.consumer_name,120),phone=str(body.phone,40),email=str(body.email,160),city=str(body.city,100),state=str(body.state,2).toUpperCase(),zip=str(body.zip_code,10),need=str(body.primary_need,120)
    if(name.length<2||phone.length<7||!email.includes('@')||city.length<2||!STATES.has(state)||!/^\d{5}(-\d{4})?$/.test(zip)||need.length<2||body.consent_to_contact!==true||body.consent_to_share!==true){
      return NextResponse.json({error:'Please complete the required contact, location, planning-need, and consent fields.'},{status:400})
    }
    const rawAttr=body.attribution&&typeof body.attribution==='object'?body.attribution as Record<string,unknown>:{}
    const landingCandidate=str(rawAttr.landing_path,1000)
    const landingPath=landingCandidate.startsWith(ESTATE_SOURCE_PAGE)?landingCandidate:ESTATE_SOURCE_PAGE
    const attribution={
      landing_path:landingPath,
      referrer:cleanReferrer(rawAttr.referrer)||cleanReferrer(req.headers.get('referer')),
      utm_source:str(rawAttr.utm_source,200)||null,
      utm_medium:str(rawAttr.utm_medium,200)||null,
      utm_campaign:str(rawAttr.utm_campaign,200)||null,
      utm_content:str(rawAttr.utm_content,200)||null,
      utm_term:str(rawAttr.utm_term,200)||null,
    }
    const s=await createClient()
    const {error}=await s.rpc('submit_estate_planning_lead_v3',{
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
      p_attribution:attribution,
    })
    if(error)return NextResponse.json({error:'Unable to submit your request. Please review the form and try again.'},{status:400,headers:{'Cache-Control':'no-store'}})
    return NextResponse.json({ok:true,automatic_routing:false,automatic_sale:false,automatic_contact:false},{headers:{'Cache-Control':'no-store'}})
  }catch{
    return NextResponse.json({error:'Unable to submit your request. Please review the form and try again.'},{status:400,headers:{'Cache-Control':'no-store'}})
  }
}
