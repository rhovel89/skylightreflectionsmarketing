import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const providerTypes=new Set(['law_firm','attorney','estate_planning_service','other'])
const onboardingStatuses=new Set(['prospect','reviewing','approved','declined'])
const operatingStatuses=new Set(['active','paused','inactive'])
const providerVerificationStatuses=new Set(['unverified','documents_pending','reviewed'])
const coverageStatuses=new Set(['not_configured','eligible_for_review','approved','paused'])
const stateVerificationStatuses=new Set(['unverified','pending','reviewed'])
const text=(v:any,n=4000)=>String(v??'').trim().slice(0,n)
const uuid=(v:any)=>{const x=text(v,50);return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)?x:null}
const capacity=(v:any)=>{const raw=text(v,20);if(raw==='')return null;const n=Number(raw);return Number.isInteger(n)&&n>=0?n:NaN}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/estate-planning-providers')
    const userId=String(claims.sub),s=await createClient(),body=await req.json() as Record<string,any>,action=text(body.action,50)
    const now=new Date().toISOString()

    if(action==='create_provider'){
      const displayName=text(body.display_name,240),providerType=text(body.provider_type,50)||'law_firm',limit=capacity(body.capacity_limit)
      if(displayName.length<2)throw new Error('Provider name is required.')
      if(!providerTypes.has(providerType))throw new Error('Provider type is invalid.')
      if(Number.isNaN(limit))throw new Error('Capacity must be a whole number of referrals or blank.')
      const q=await s.from('estate_planning_providers').insert({
        tenant_id:TENANT_ID,display_name:displayName,provider_type:providerType,
        onboarding_status:'prospect',operating_status:'paused',verification_status:'unverified',
        primary_contact_name:text(body.primary_contact_name,160)||null,primary_contact_email:text(body.primary_contact_email,240)||null,
        primary_contact_phone:text(body.primary_contact_phone,80)||null,website:text(body.website,500)||null,
        external_reference:text(body.external_reference,500)||null,capacity_limit:limit,
        capacity_notes:text(body.capacity_notes,2000)||null,internal_notes:text(body.internal_notes,4000)||null,
        created_by:userId,updated_by:userId,created_at:now,updated_at:now
      }).select('id').single()
      if(q.error)throw q.error
      return NextResponse.json({ok:true,id:q.data.id,message:'Provider created in paused prospect status. No referrals were assigned or transmitted.'})
    }

    if(action==='update_provider'){
      const providerId=uuid(body.provider_id);if(!providerId)throw new Error('Valid provider is required.')
      const displayName=text(body.display_name,240),providerType=text(body.provider_type,50),onboarding=text(body.onboarding_status,50),operating=text(body.operating_status,50),verification=text(body.verification_status,50),limit=capacity(body.capacity_limit)
      if(displayName.length<2||!providerTypes.has(providerType)||!onboardingStatuses.has(onboarding)||!operatingStatuses.has(operating)||!providerVerificationStatuses.has(verification))throw new Error('Provider settings are invalid.')
      if(Number.isNaN(limit))throw new Error('Capacity must be a whole number of referrals or blank.')
      if(operating==='active'&&onboarding!=='approved')throw new Error('A provider must be approved before it can be active.')
      const existing=await s.from('estate_planning_providers').select('approved_at,verified_at').eq('tenant_id',TENANT_ID).eq('id',providerId).maybeSingle();if(existing.error)throw existing.error;if(!existing.data)throw new Error('Provider was not found.')
      const payload:any={display_name:displayName,provider_type:providerType,onboarding_status:onboarding,operating_status:operating,verification_status:verification,primary_contact_name:text(body.primary_contact_name,160)||null,primary_contact_email:text(body.primary_contact_email,240)||null,primary_contact_phone:text(body.primary_contact_phone,80)||null,website:text(body.website,500)||null,external_reference:text(body.external_reference,500)||null,capacity_limit:limit,capacity_notes:text(body.capacity_notes,2000)||null,internal_notes:text(body.internal_notes,4000)||null,updated_by:userId,updated_at:now}
      if(onboarding==='approved'&&!existing.data.approved_at)payload.approved_at=now
      if(verification==='reviewed'&&!existing.data.verified_at)payload.verified_at=now
      const q=await s.from('estate_planning_providers').update(payload).eq('tenant_id',TENANT_ID).eq('id',providerId);if(q.error)throw q.error
      return NextResponse.json({ok:true,message:'Provider settings updated. No lead assignment or transmission occurred.'})
    }

    if(action==='upsert_state'){
      const providerId=uuid(body.provider_id),stateCode=text(body.state_code,2).toUpperCase(),coverage=text(body.coverage_status,50),verification=text(body.verification_status,50),limit=capacity(body.referral_capacity),reference=text(body.verification_reference,1000)
      if(!providerId)throw new Error('Valid provider is required.')
      if(!/^[A-Z]{2}$/.test(stateCode))throw new Error('State must be a two-letter code.')
      if(!coverageStatuses.has(coverage)||!stateVerificationStatuses.has(verification))throw new Error('Coverage or verification status is invalid.')
      if(Number.isNaN(limit))throw new Error('State capacity must be a whole number or blank.')
      if(verification==='reviewed'&&!reference)throw new Error('A verification evidence reference is required before marking state verification reviewed.')
      if(coverage==='approved'&&(verification!=='reviewed'||!reference))throw new Error('Approved configured coverage requires reviewed state evidence and a verification reference.')
      const provider=await s.from('estate_planning_providers').select('id').eq('tenant_id',TENANT_ID).eq('id',providerId).maybeSingle();if(provider.error)throw provider.error;if(!provider.data)throw new Error('Provider was not found.')
      const payload:any={tenant_id:TENANT_ID,provider_id:providerId,state_code:stateCode,coverage_status:coverage,verification_status:verification,verification_reference:reference||null,referral_capacity:limit,notes:text(body.notes,3000)||null,updated_by:userId,updated_at:now}
      if(verification==='reviewed'){payload.reviewed_at=now;payload.reviewed_by=userId}
      const existing=await s.from('estate_planning_provider_states').select('id,created_by').eq('tenant_id',TENANT_ID).eq('provider_id',providerId).eq('state_code',stateCode).maybeSingle();if(existing.error)throw existing.error
      let q
      if(existing.data)q=await s.from('estate_planning_provider_states').update(payload).eq('id',existing.data.id)
      else {payload.created_by=userId;payload.created_at=now;q=await s.from('estate_planning_provider_states').insert(payload)}
      if(q.error)throw q.error
      return NextResponse.json({ok:true,message:'State coverage record saved. This is an internal configuration and does not itself represent licensure or send a referral.'})
    }

    throw new Error('Unsupported provider-network action.')
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Unable to update Estate Planning provider network.'},{status:400})
  }
}
