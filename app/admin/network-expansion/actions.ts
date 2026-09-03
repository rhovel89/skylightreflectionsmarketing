'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export async function provisionNetworkTenant(formData:FormData){
  const name=String(formData.get('directory_name')||'').trim(),slug=String(formData.get('tenant_slug')||'').trim().toLowerCase(),region=String(formData.get('region_label')||'').trim();
  if(name.length<3||slug.length<3) redirect('/admin/network-expansion?result=error&message=Directory+name+and+slug+are+required')
  const s=await createClient(); const {data,error}=await s.rpc('provision_local_pros_tenant',{p_parent_tenant_id:TENANT_ID,p_directory_name:name,p_tenant_slug:slug,p_region_label:region||null});
  if(error) redirect(`/admin/network-expansion?result=error&message=${encodeURIComponent(error.message.slice(0,180))}`)
  revalidatePath('/admin/network-expansion');
  redirect(`/admin/network-expansion?result=created&tenant=${encodeURIComponent(String(data||''))}`)
}
