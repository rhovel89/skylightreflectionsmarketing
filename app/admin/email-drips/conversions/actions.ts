'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const GOALS=new Set(['any_inquiry','sponsored_inquiry','skylight_inquiry'])

export async function saveConversionGoal(fd:FormData){
  await requireAdmin('/admin/email-drips/conversions')
  const id=text(fd,'campaign_id'),goal=text(fd,'conversion_goal')
  if(!GOALS.has(goal))throw new Error('Choose a valid conversion goal.')
  const s=await createClient()
  const{error}=await s.from('email_drip_campaigns').update({conversion_goal:goal,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',id)
  if(error)throw new Error(error.message)
  revalidatePath('/admin/email-drips/conversions')
}
