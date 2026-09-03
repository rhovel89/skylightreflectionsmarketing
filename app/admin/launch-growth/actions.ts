'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export async function refreshGrowthOpportunities(){
  const s=await createClient(); const {error}=await s.rpc('refresh_growth_opportunities',{p_tenant_id:TENANT_ID});
  if(error) redirect(`/admin/launch-growth?refresh=error&message=${encodeURIComponent(error.message.slice(0,180))}`)
  revalidatePath('/admin/launch-growth'); revalidatePath('/admin/growth-opportunities');
  redirect('/admin/launch-growth?refresh=ok')
}
