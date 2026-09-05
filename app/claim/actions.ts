'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireBusinessAccount } from '@/lib/auth'

export type ClaimState={ok:boolean;message:string}
const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()

export async function submitOwnershipClaim(_:ClaimState,fd:FormData):Promise<ClaimState>{
  try{
    const businessId=text(fd,'business_id')
    await requireBusinessAccount(`/claim?business=${encodeURIComponent(businessId)}`)
    const s=await createClient()
    const{data:userData}=await s.auth.getUser()
    if(!userData.user?.email)return{ok:false,message:'Your signed-in account needs an email address before ownership can be reviewed.'}
    const method=text(fd,'verification_method')
    const details=text(fd,'verification_details').slice(0,1800)
    if(!businessId||!text(fd,'name')||!text(fd,'role')||!method||details.length<10)return{ok:false,message:'Complete your name, role, ownership verification method and evidence details.'}
    const{error}=await s.rpc('submit_business_ownership_claim',{p_business_id:businessId,p_claimant_name:text(fd,'name').slice(0,120),p_claimant_role:text(fd,'role').slice(0,120),p_verification_method:method,p_verification_details:details,p_verification_url:text(fd,'verification_url').slice(0,600)||null,p_phone:text(fd,'phone').slice(0,40)||null})
    if(error){const m=error.message;return{ok:false,message:m.includes('business_username_required')?'Complete your business-account username before submitting an ownership claim.':m.includes('claim_invitation_account_mismatch')||m.includes('claim_invitation_email_mismatch')?'This pending profile is connected to a different originating account. Sign in with the account that submitted the business or contact staff.':m.includes('claim_already_submitted')?'You already have an ownership claim under review for this business.':m.includes('business_already_claimed')?'This business is already claimed.':m}}
    revalidatePath('/account')
    return{ok:true,message:'Ownership evidence submitted. Staff will review it before owner access, verification or publication is granted.'}
  }catch(e){return{ok:false,message:e instanceof Error?e.message:'Unable to submit ownership evidence.'}}
}
