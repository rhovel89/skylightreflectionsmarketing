import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const followStatuses=new Set(['new','attempted_contact','contacted','appointment_scheduled','appointment_confirmed','appointment_completed','no_show','canceled','not_reached','not_qualified','closed'])
const qualificationStatuses=new Set(['new','reviewing','qualified','not_qualified'])
const text=(v:any,n=4000)=>String(v??'').trim().slice(0,n)
const uuid=(v:any)=>{const x=text(v,50);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/estate-planning-leads')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Record<string,any>
    const action=text(body.action,50)||'save',leadId=uuid(body.lead_id)
    if(!leadId)throw new Error('A valid Estate Planning inquiry is required.')
    if(action!=='save')throw new Error('Unsupported Estate Planning appointment action.')

    const follow=text(body.follow_up_status,40),qualification=text(body.qualification_status,40)
    if(!followStatuses.has(follow)||!qualificationStatuses.has(qualification))throw new Error('Valid qualification and appointment statuses are required.')

    const existing=await s.from('estate_planning_lead_sales').select('*').eq('tenant_id',TENANT_ID).eq('lead_id',leadId).maybeSingle()
    if(existing.error)throw existing.error
    if(!existing.data)throw new Error('Estate Planning appointment tracking record was not found.')

    const appointmentRaw=text(body.appointment_at,40),appointment=appointmentRaw?new Date(appointmentRaw):null
    if(appointmentRaw&&(!appointment||Number.isNaN(appointment.getTime())))throw new Error('Appointment date/time is invalid.')
    if(['appointment_scheduled','appointment_confirmed','appointment_completed'].includes(follow)&&!appointment)throw new Error('Appointment date/time is required for a scheduled, confirmed, or completed appointment.')

    const now=new Date().toISOString(),contactTouched=['attempted_contact','contacted','appointment_scheduled','appointment_confirmed','appointment_completed','no_show','canceled'].includes(follow)
    const payload:any={follow_up_status:follow,appointment_at:appointment?appointment.toISOString():null,owner_notes:text(body.owner_notes,4000)||null,updated_by:userId,updated_at:now}
    if(contactTouched&&!existing.data.last_contact_at)payload.last_contact_at=now
    const update=await s.from('estate_planning_lead_sales').update(payload).eq('tenant_id',TENANT_ID).eq('lead_id',leadId).select('*').single()
    if(update.error)throw update.error

    const currentQualification=await s.from('estate_planning_lead_referrals').select('id').eq('tenant_id',TENANT_ID).eq('lead_id',leadId).maybeSingle()
    if(currentQualification.error)throw currentQualification.error
    const qualificationPayload:any={qualification_status:qualification,qualification_notes:text(body.qualification_notes,4000)||null,updated_by:userId,updated_at:now}
    if(currentQualification.data){const q=await s.from('estate_planning_lead_referrals').update(qualificationPayload).eq('tenant_id',TENANT_ID).eq('lead_id',leadId);if(q.error)throw q.error}
    else {const q=await s.from('estate_planning_lead_referrals').insert({tenant_id:TENANT_ID,lead_id:leadId,...qualificationPayload,created_by:userId});if(q.error)throw q.error}

    const leadStatus=(qualification==='not_qualified'||['not_qualified','closed','canceled'].includes(follow))?'closed':follow==='new'?'new':follow==='appointment_completed'?'completed':'in_progress'
    const leadUpdate=await s.from('leads').update({status:leadStatus}).eq('tenant_id',TENANT_ID).eq('id',leadId).eq('source','estate_planning_nationwide')
    if(leadUpdate.error)throw leadUpdate.error

    return NextResponse.json({ok:true,message:'Qualification and appointment tracking updated. No lawyer onboarding, provider routing, lead sale, invoice, billing, or automatic outreach was performed.',automatic_provider_routing:false,automatic_billing:false,automatic_outreach:false})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to update Estate Planning appointment.'},{status:400})}
}
