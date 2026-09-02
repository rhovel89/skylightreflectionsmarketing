import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const allowedPlacements=new Set(['homepage_featured','global_sidebar','city_sidebar','category_sidebar','market_sidebar','page_sidebar','guide_sidebar','business_profile_sidebar','restaurant_sidebar','home_services_sidebar','attorney_sidebar','local_stores_sidebar'])
const text=(v:unknown)=>typeof v==='string'?v.trim():''
function normalized(body:any){
  const placement=text(body.placement)
  if(!allowedPlacements.has(placement))throw new Error('Invalid placement type.')
  const origin=['manual','promotional'].includes(text(body.origin))?text(body.origin):'manual'
  return {
    business_id:text(body.business_id),placement,
    market_location_id:text(body.market_location_id)||null,category_id:text(body.category_id)||null,page_path:text(body.page_path)||null,
    starts_on:text(body.starts_on)||null,ends_on:text(body.ends_on)||null,active:body.active!==false,
    priority:Math.max(0,Math.min(1000,Number(body.priority??100)||100)),sort_order:Math.max(0,Math.min(100000,Number(body.sort_order??100)||100)),
    rotation_weight:Math.max(1,Math.min(100,Number(body.rotation_weight??1)||1)),origin,
  }
}
function refresh(){revalidatePath('/','layout');revalidatePath('/admin/sponsorships');revalidatePath('/admin/revenue')}

export async function POST(req:Request){try{const{claims}=await requireSuperAdmin('/admin/sponsorships');const body=normalized(await req.json());if(!body.business_id)return NextResponse.json({error:'Business is required.'},{status:400});const s=await createClient();const{data,error}=await s.from('sponsorships').insert({...body,tenant_id:TENANT_ID,provider:'manual'}).select('id').single();if(error)return NextResponse.json({error:error.message},{status:400});await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'featured_placement_created',action_text:`Created ${body.placement} placement ${data.id} for business ${body.business_id}`});refresh();return NextResponse.json({ok:true,id:data.id})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to create sponsorship.'},{status:400})}}

export async function PATCH(req:Request){try{const{claims}=await requireSuperAdmin('/admin/sponsorships');const raw=await req.json() as any;const id=text(raw.id);if(!id)return NextResponse.json({error:'Placement id is required.'},{status:400});const s=await createClient();if(raw.toggleOnly===true){const{data:current}=await s.from('sponsorships').select('active').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle();if(!current)return NextResponse.json({error:'Placement not found.'},{status:404});const active=!current.active;const{error}=await s.from('sponsorships').update({active}).eq('tenant_id',TENANT_ID).eq('id',id);if(error)return NextResponse.json({error:error.message},{status:400});await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:active?'sponsorship_activated':'sponsorship_paused',action_text:`${active?'Activated':'Paused'} sponsorship ${id}`});refresh();return NextResponse.json({ok:true,active})}
  const body=normalized(raw);if(!body.business_id)return NextResponse.json({error:'Business is required.'},{status:400});const{error}=await s.from('sponsorships').update(body).eq('tenant_id',TENANT_ID).eq('id',id);if(error)return NextResponse.json({error:error.message},{status:400});await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'featured_placement_reassigned',action_text:`Updated sponsorship ${id} to ${body.placement} for business ${body.business_id}`});refresh();return NextResponse.json({ok:true})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to update sponsorship.'},{status:400})}}

export async function DELETE(req:Request){try{const{claims}=await requireSuperAdmin('/admin/sponsorships');const raw=await req.json() as any;const id=text(raw.id);if(!id)return NextResponse.json({error:'Placement id is required.'},{status:400});const s=await createClient();const{error}=await s.from('sponsorships').delete().eq('tenant_id',TENANT_ID).eq('id',id);if(error)return NextResponse.json({error:error.message},{status:400});await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'sponsorship_removed',action_text:`Removed sponsorship ${id}`});refresh();return NextResponse.json({ok:true})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to remove sponsorship.'},{status:400})}}
