import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaims,getRoles } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

async function requireSuper(){const claims=await getClaims();if(!claims?.sub)return null;const roles=await getRoles(String(claims.sub));return roles.includes('super_admin')?claims:null}

export async function POST(req:Request){
  try{
    const claims=await requireSuper();if(!claims)return NextResponse.json({error:'Super Admin access required.'},{status:403})
    const body=await req.json() as any
    const s=await createClient()
    if(body.action==='qualify'){
      const {error}=await s.rpc('configure_marketplace_lead',{p_lead_id:String(body.lead_id||''),p_price_cents:Number(body.price_cents||0),p_sale_mode:String(body.sale_mode||'exclusive'),p_max_buyers:Number(body.max_buyers||1),p_quality_score:Number(body.quality_score||50),p_notes:body.notes?String(body.notes):null})
      if(error)return NextResponse.json({error:error.message},{status:400})
      return NextResponse.json({ok:true})
    }
    if(body.action==='offer'){
      const {data,error}=await s.rpc('create_marketplace_lead_offer',{p_lead_id:String(body.lead_id||''),p_business_id:String(body.business_id||''),p_price_cents:body.price_cents?Number(body.price_cents):null,p_expires_at:body.expires_at?String(body.expires_at):null})
      if(error)return NextResponse.json({error:error.message},{status:400})
      return NextResponse.json({ok:true,offer_id:data})
    }
    if(body.action==='withdraw'){
      const leadId=String(body.lead_id||'');if(!leadId)return NextResponse.json({error:'Lead is required.'},{status:400})
      const {error}=await s.from('lead_marketplace_inventory').update({marketplace_status:'withdrawn'}).eq('tenant_id',TENANT_ID).eq('lead_id',leadId)
      if(error)return NextResponse.json({error:error.message},{status:400})
      await s.from('lead_marketplace_offers').update({status:'canceled'}).eq('tenant_id',TENANT_ID).eq('lead_id',leadId).in('status',['offered','checkout_pending','reserved'])
      await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'lead_marketplace_withdrawn',action_text:`Withdrew lead ${leadId} from paid marketplace and canceled open offers.`})
      return NextResponse.json({ok:true})
    }
    if(body.action==='cancel_offer'){
      const offerId=String(body.offer_id||'');if(!offerId)return NextResponse.json({error:'Offer is required.'},{status:400})
      const {data:offer,error:findError}=await s.from('lead_marketplace_offers').select('id,lead_id,status').eq('tenant_id',TENANT_ID).eq('id',offerId).maybeSingle();if(findError||!offer)return NextResponse.json({error:'Offer not found.'},{status:404})
      if(['purchased','delivered'].includes(offer.status))return NextResponse.json({error:'A purchased lead cannot be canceled through this action.'},{status:400})
      const {error}=await s.from('lead_marketplace_offers').update({status:'canceled'}).eq('id',offerId);if(error)return NextResponse.json({error:error.message},{status:400})
      const {data:open}=await s.from('lead_marketplace_offers').select('id').eq('lead_id',offer.lead_id).in('status',['offered','checkout_pending','reserved']).limit(1)
      if(!(open??[]).length)await s.from('lead_marketplace_inventory').update({marketplace_status:'available'}).eq('lead_id',offer.lead_id).eq('review_status','qualified')
      await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'lead_marketplace_offer_canceled',action_text:`Canceled paid lead offer ${offerId}.`})
      return NextResponse.json({ok:true})
    }
    return NextResponse.json({error:'Unsupported marketplace action.'},{status:400})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to update lead marketplace.'},{status:400})}
}
