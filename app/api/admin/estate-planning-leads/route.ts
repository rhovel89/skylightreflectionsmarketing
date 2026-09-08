import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const followStatuses=new Set(['new','attempted_contact','contacted','appointment_scheduled','appointment_completed','not_reached','not_qualified','closed'])
const saleStatuses=new Set(['not_delivered','delivered','sold','not_sold','invalid'])
const qualificationStatuses=new Set(['new','reviewing','qualified','not_qualified'])
const referralStatuses=new Set(['unassigned','pending_review','approved_for_referral','referred','accepted','declined','closed'])
const text=(v:any,n=4000)=>String(v??'').trim().slice(0,n)
const uuid=(v:any)=>{const x=text(v,50);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/estate-planning-leads')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Record<string,any>
    const leadId=uuid(body.lead_id),follow=text(body.follow_up_status,40),sale=text(body.sale_status,40),qualification=text(body.qualification_status,40),referral=text(body.referral_status,40)
    if(!leadId||!followStatuses.has(follow)||!saleStatuses.has(sale)||!qualificationStatuses.has(qualification)||!referralStatuses.has(referral))throw new Error('A valid estate-planning lead and status are required.')
    const providerName=text(body.provider_name,240),providerState=text(body.provider_state,2).toUpperCase(),providerReference=text(body.provider_reference,500)
    if(providerState&&!/^[A-Z]{2}$/.test(providerState))throw new Error('Provider state must be a two-letter state code.')
    if(['approved_for_referral','referred','accepted','declined'].includes(referral)&&!providerName)throw new Error('Provider / law firm name is required before this referral status can be recorded.')

    const existing=await s.from('estate_planning_lead_sales').select('*').eq('tenant_id',TENANT_ID).eq('lead_id',leadId).maybeSingle()
    if(existing.error)throw existing.error
    if(!existing.data)throw new Error('Estate-planning lead sale record was not found.')
    const appointmentRaw=text(body.appointment_at,40),appointment=appointmentRaw?new Date(appointmentRaw):null
    if(appointmentRaw&&(!appointment||Number.isNaN(appointment.getTime())))throw new Error('Appointment date/time is invalid.')
    const amountRaw=text(body.sale_amount,40),amount=amountRaw===''?null:Math.round(Number(amountRaw)*100)
    if(amountRaw!==''&&(!Number.isFinite(amount)||amount===null||amount<0))throw new Error('Sale amount must be a valid non-negative number.')
    const now=new Date().toISOString()
    const contactTouched=['attempted_contact','contacted','appointment_scheduled','appointment_completed'].includes(follow)
    const payload:any={follow_up_status:follow,sale_status:sale,appointment_at:appointment?appointment.toISOString():null,sale_amount_cents:amount,owner_notes:text(body.owner_notes,4000)||null,updated_by:userId,updated_at:now}
    if(contactTouched&&!existing.data.last_contact_at)payload.last_contact_at=now
    if((sale==='delivered'||sale==='sold')&&!existing.data.delivered_at)payload.delivered_at=now
    if(sale==='sold'&&!existing.data.sold_at)payload.sold_at=now
    const update=await s.from('estate_planning_lead_sales').update(payload).eq('tenant_id',TENANT_ID).eq('lead_id',leadId).select('*').single()
    if(update.error)throw update.error

    const currentReferral=await s.from('estate_planning_lead_referrals').select('*').eq('tenant_id',TENANT_ID).eq('lead_id',leadId).maybeSingle()
    if(currentReferral.error)throw currentReferral.error
    const referralPayload:any={tenant_id:TENANT_ID,lead_id:leadId,qualification_status:qualification,referral_status:referral,provider_name:providerName||null,provider_state:providerState||null,provider_reference:providerReference||null,qualification_notes:text(body.qualification_notes,4000)||null,referral_notes:text(body.referral_notes,4000)||null,updated_by:userId,updated_at:now}
    if(providerName&&!currentReferral.data?.assigned_at)referralPayload.assigned_at=now
    if(['referred','accepted','declined'].includes(referral)&&!currentReferral.data?.referred_at)referralPayload.referred_at=now
    if(['accepted','declined'].includes(referral)&&!currentReferral.data?.provider_responded_at)referralPayload.provider_responded_at=now
    if(currentReferral.data){
      const q=await s.from('estate_planning_lead_referrals').update(referralPayload).eq('tenant_id',TENANT_ID).eq('lead_id',leadId)
      if(q.error)throw q.error
    }else{
      referralPayload.created_by=userId
      const q=await s.from('estate_planning_lead_referrals').insert(referralPayload)
      if(q.error)throw q.error
    }

    const leadStatus=sale==='sold'?'completed':(['not_qualified','closed'].includes(follow)||['not_sold','invalid'].includes(sale))?'closed':follow==='new'?'new':'in_progress'
    const leadUpdate=await s.from('leads').update({status:leadStatus}).eq('tenant_id',TENANT_ID).eq('id',leadId).eq('source','estate_planning_nationwide')
    if(leadUpdate.error)throw leadUpdate.error
    return NextResponse.json({ok:true,message:'Estate-planning records updated. No automatic email, referral transmission, lead delivery, invoice, charge, or provider notification was performed.',automatic_referral_transmission:false,automatic_delivery:false,automatic_billing:false,automatic_buyer_message:false})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to update estate-planning lead.'},{status:400})}
}
