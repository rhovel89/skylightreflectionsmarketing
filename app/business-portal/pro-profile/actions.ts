'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { getBusinessPlanAccess,effectivePlanIs } from '@/lib/business-plan'
import { TENANT_ID } from '@/lib/constants'

const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const related=(v:any)=>Array.isArray(v)?v[0]:v

export async function submitPremiumDescription(fd:FormData){
  const claims=await requireUser('/business-portal/pro-profile')
  const uid=String(claims.sub)
  const businessId=text(fd,'business_id')
  const description=text(fd,'description').slice(0,2400)
  if(!businessId||!description)throw new Error('Business and profile description are required.')
  const s=await createClient()
  const {data:ownership}=await s.from('business_owners').select('business_id,businesses!inner(slug,tenant_id)').eq('business_id',businessId).eq('user_id',uid).eq('businesses.tenant_id',TENANT_ID).maybeSingle()
  if(!ownership)throw new Error('You are not authorized to edit this business.')
  const [access,{data:sponsors}]=await Promise.all([
    getBusinessPlanAccess(s,businessId),
    s.from('sponsorships').select('id,active,starts_on,ends_on').eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('active',true).limit(50),
  ])
  const today=new Date().toISOString().slice(0,10)
  const premiumPlan=effectivePlanIs(access,'featured','pro')
  const sponsored=(sponsors??[]).some((row:any)=>(!row.starts_on||String(row.starts_on)<=today)&&(!row.ends_on||String(row.ends_on)>=today))
  if(!premiumPlan&&!sponsored)throw new Error('Featured, Sponsored or Pro access is required for the Premium Profile description editor.')
  const {data:pending}=await s.from('business_edit_requests').select('id').eq('business_id',businessId).eq('requested_by',uid).eq('request_type','profile_update').eq('status','pending').limit(1)
  if(pending?.length)throw new Error('A listing description update is already pending staff review.')
  const {error}=await s.from('business_edit_requests').insert({tenant_id:TENANT_ID,business_id:businessId,requested_by:uid,request_type:'profile_update',proposed_changes:{description},status:'pending'})
  if(error)throw new Error(error.message)
  const business:any=related((ownership as any).businesses)
  revalidatePath('/business-portal/pro-profile')
  revalidatePath('/business-portal/listing')
  revalidatePath('/business-portal/requests')
  if(business?.slug)revalidatePath(`/business/${business.slug}`)
}