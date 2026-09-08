import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const followStatuses=new Set(['new','attempted_contact','contacted','appointment_scheduled','appointment_completed','not_reached','not_qualified','closed'])
const saleStatuses=new Set(['not_delivered','delivered','sold','not_sold','invalid'])
const qualificationStatuses=new Set(['new','reviewing','qualified','not_qualified'])
const handoffMethods=new Set(['manual_email','manual_phone','secure_portal','other'])
const text=(v:any,n=4000)=>String(v??'').trim().slice(0,n)
const uuid=(v:any)=>{const x=text(v,50);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/estate-planning-leads')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Record<string,any>
    const action=text(body.action,50)||'save',leadId=uuid(body.lead_id)
    if(!leadId)throw new Error('A valid Estate Planning lead is required.')

    if(action==='assign_provider'){
      const providerId=uuid(body.provider_id);if(!providerId)throw new Error('Select an eligible provider.')
      const q=await s.rpc('assign_estate_planning_provider',{p_lead_id:leadId,p_provider_id:providerId,p_notes:text(body.notes,4000)||null})
      if(q.error)throw q.error
      return NextResponse.json({ok:true,event_id:q.data,message:'Provider assigned for internal review. No consumer data was transmitted.',automatic_referral_transmission:false})
    }
    if(action==='clear_provider'){
      const q=await s.rpc('clear_estate_planning_provider_assignment',{p_lead_id:leadId,p_notes:text(body.notes,4000)||null})
      if(q.error)throw q.error
      return NextResponse.json({ok:true,event_id:q.data,message:'Provider assignment cleared. No consumer data was transmitted.',automatic_referral_transmission:false})
    }
    if(action==='prepare_handoff'){
      const q=await s.rpc('prepare_estate_planning_referral_handoff',{p_lead_id:leadId,p_notes:text(body.notes,4000)||null})
      if(q.error)throw q.error
      return NextResponse.json({ok:true,event_id:q.data,message:'Private handoff snapshot prepared and approved for manual referral. Nothing was sent.',automatic_referral_transmission:false})
    }
    if(action==='record_handoff'){
      const method=text(body.transmission_method,50);if(!handoffMethods.has(method))throw new Error('Select how the manual handoff occurred.')
      const q=await s.rpc('record_estate_planning_referral_handoff',{p_lead_id:leadId,p_transmission_method:method,p_external_reference:text(body.external_reference,1000)||null,p_notes:text(body.notes,4000)||null})
      if(q.error)throw q.error
      return NextResponse.json({ok:true,event_id:q.data,message:'Manual referral handoff recorded. This action did not send the lead; it records a handoff staff says already occurred.',automatic_referral_transmission:false})
    }
    if(action==='provider_response'){
      const response=text(body.response,20);if(!['accepted','declined'].includes(response))throw new Error('Provider response must be accepted or declined.')
      const q=await s.rpc('record_estate_planning_provider_response',{p_lead_id:leadId,p_response:response,p_notes:text(body.notes,4000)||null})
      if(q.error)throw q.error
      return NextResponse.json({ok:true,event_id:q.data,message:`Provider response recorded as ${response}. No sale, billing, or ranking action was performed.`})
    }
    if(action!=='save')throw new Error('Unsupported Estate Planning lead action.')

    const follow=text(body.follow_up_status,40),sale=text(body.sale_status,40),qualification=text(body.qualification_status,40)
    if(!followStatuses.has(follow)||!saleStatuses.has(sale)||!qualificationStatuses.has(qualification))throw new Error('Valid lead, qualification, follow-up and sale statuses are required.')
    const existing=await s.from('estate_planning_lead_sales').select('*').eq('tenant_id',TENANT_ID).eq('lead_id',leadId).maybeSingle()
    if(existing.error)throw existing.error
    if(!existing.data)throw new Error('Estate Planning lead sale record was not found.')
    const appointmentRaw=text(body.appointment_at,40),appointment=appointmentRaw?new Date(appointmentRaw):null
    if(appointmentRaw&&(!appointment||Number.isNaN(appointment.getTime())))throw new Error('Appointment date/time is invalid.')
    const amountRaw=text(body.sale_amount,40),amount=amountRaw===''?null:Math.round(Number(amountRaw)*100)
    if(amountRaw!==''&&(!Number.isFinite(amount)||amount===null||amount<0))throw new Error('Sale amount must be a valid non-negative number.')
    const now=new Date().toISOString(),contactTouched=['attempted_contact','contacted','appointment_scheduled','appointment_completed'].includes(follow)
    const payload:any={follow_up_status:follow,sale_status:sale,appointment_at:appointment?appointment.toISOString():null,sale_amount_cents:amount,owner_notes:text(body.owner_notes,4000)||null,updated_by:userId,updated_at:now}
    if(contactTouched&&!existing.data.last_contact_at)payload.last_contact_at=now
    if((sale==='delivered'||sale==='sold')&&!existing.data.delivered_at)payload.delivered_at=now
    if(sale==='sold'&&!existing.data.sold_at)payload.sold_at=now
    const update=await s.from('estate_planning_lead_sales').update(payload).eq('tenant_id',TENANT_ID).eq('lead_id',leadId).select('*').single()
    if(update.error)throw update.error

    const currentReferral=await s.from('estate_planning_lead_referrals').select('id').eq('tenant_id',TENANT_ID).eq('lead_id',leadId).maybeSingle()
    if(currentReferral.error)throw currentReferral.error
    const referralPayload:any={qualification_status:qualification,qualification_notes:text(body.qualification_notes,4000)||null,referral_notes:text(body.referral_notes,4000)||null,updated_by:userId,updated_at:now}
    if(currentReferral.data){const q=await s.from('estate_planning_lead_referrals').update(referralPayload).eq('tenant_id',TENANT_ID).eq('lead_id',leadId);if(q.error)throw q.error}
    else {const q=await s.from('estate_planning_lead_referrals').insert({tenant_id:TENANT_ID,lead_id:leadId,...referralPayload,created_by:userId});if(q.error)throw q.error}

    const leadStatus=sale==='sold'?'completed':(['not_qualified','closed'].includes(follow)||['not_sold','invalid'].includes(sale))?'closed':follow==='new'?'new':'in_progress'
    const leadUpdate=await s.from('leads').update({status:leadStatus}).eq('tenant_id',TENANT_ID).eq('id',leadId).eq('source','estate_planning_nationwide')
    if(leadUpdate.error)throw leadUpdate.error
    return NextResponse.json({ok:true,message:'Lead qualification, follow-up and sale records updated. Provider assignment/referral status can only advance through the controlled referral actions.',automatic_referral_transmission:false,automatic_delivery:false,automatic_billing:false,automatic_buyer_message:false})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to update Estate Planning lead.'},{status:400})}
}
