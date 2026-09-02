'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireUser } from '@/lib/auth'

export type ActionState = { ok:boolean; message:string }
const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()

export async function submitLead(_:ActionState, fd:FormData):Promise<ActionState>{
  try { const s=await createClient(); const business=text(fd,'business_id')||null; const {error}=await s.rpc('submit_directory_lead',{p_tenant_id:TENANT_ID,p_business_id:business,p_service:text(fd,'service'),p_city:text(fd,'city'),p_consumer_name:text(fd,'name'),p_phone:text(fd,'phone'),p_email:text(fd,'email'),p_message:text(fd,'message')||null,p_timeline:text(fd,'timeline')||null,p_consent_to_contact:fd.get('consent')==='on'}); if(error) return {ok:false,message:error.message}; return {ok:true,message:'Your request was received and is being matched with local businesses.'} } catch(e){return {ok:false,message:e instanceof Error?e.message:'Unable to submit request.'}}
}
export async function submitClaim(_:ActionState, fd:FormData):Promise<ActionState>{
  try {const s=await createClient(),businessId=text(fd,'business_id');const {error}=await s.rpc('submit_business_claim',{p_business_id:businessId,p_claimant_name:text(fd,'name'),p_claimant_role:text(fd,'role'),p_email:text(fd,'email'),p_phone:text(fd,'phone')||null});if(error)return{ok:false,message:error.message};await s.rpc('track_growth_event',{p_tenant_id:TENANT_ID,p_event_type:'claim_submit',p_page_path:'/business-profile',p_business_id:businessId,p_city:null,p_category:null,p_plan:'free',p_source:'business-profile'});return{ok:true,message:'Claim submitted. Staff will review ownership before access is granted.'}}catch(e){return{ok:false,message:e instanceof Error?e.message:'Unable to submit claim.'}}
}
export async function submitListingReport(_:ActionState,fd:FormData):Promise<ActionState>{
  try{const s=await createClient();const{error}=await s.rpc('submit_listing_report',{p_business_id:text(fd,'business_id'),p_report_type:text(fd,'report_type'),p_details:text(fd,'details'),p_reporter_name:text(fd,'name')||null,p_reporter_email:text(fd,'email')||null});if(error)return{ok:false,message:error.message};return{ok:true,message:'Thanks. Your listing report was sent to staff for review.'}}catch(e){return{ok:false,message:e instanceof Error?e.message:'Unable to submit report.'}}
}
export async function toggleSavedBusiness(businessId:string){
  const claims=await requireUser('/account/saved'); const s=await createClient(); const uid=String(claims.sub)
  const {data}=await s.from('saved_businesses').select('business_id').eq('user_id',uid).eq('business_id',businessId).maybeSingle()
  if(data) await s.from('saved_businesses').delete().eq('user_id',uid).eq('business_id',businessId)
  else await s.from('saved_businesses').insert({user_id:uid,business_id:businessId})
  revalidatePath('/account'); revalidatePath('/account/saved')
}
export async function submitOwnerEdit(fd:FormData){
  const claims=await requireUser('/business-portal'); const s=await createClient(); const uid=String(claims.sub); const businessId=text(fd,'business_id')
  if(!businessId) throw new Error('A business is required.')
  const {data:ownership,error:ownershipError}=await s.from('business_owners').select('business_id').eq('user_id',uid).eq('business_id',businessId).maybeSingle()
  if(ownershipError||!ownership) throw new Error('You are not authorized to edit this business.')
  const proposed={description:text(fd,'description'),phone:text(fd,'phone'),website:text(fd,'website'),hours:text(fd,'hours')}
  const {error}=await s.from('business_edit_requests').insert({tenant_id:TENANT_ID,business_id:businessId,requested_by:uid,request_type:'profile_update',proposed_changes:proposed,status:'pending'})
  if(error) throw new Error('Unable to submit this change request.')
  revalidatePath('/business-portal'); revalidatePath('/business-portal/listing'); revalidatePath('/business-portal/requests')
}