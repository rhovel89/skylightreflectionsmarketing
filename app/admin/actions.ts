'use server'
import{revalidatePath}from'next/cache';import{createClient}from'@/lib/supabase/server';import{requireAdmin,requireStaff,requireSuperAdmin}from'@/lib/auth';import{TENANT_ID}from'@/lib/constants'
const txt=(f:FormData,k:string)=>String(f.get(k)||'').trim(), bool=(f:FormData,k:string)=>f.get(k)==='on'
export async function saveEntity(fd:FormData){const table=txt(fd,'table'),id=txt(fd,'id');const adminOnly=['businesses','categories','locations','seo_pages','page_coverage','sponsorships','business_locations','business_service_areas','site_content_blocks','guides','site_settings','plans','navigation_items','user_roles'];if(adminOnly.includes(table))await requireAdmin('/admin');else await requireStaff('/admin');const allowed:Record<string,string[]>={businesses:['name','phone','email','website','description','hours','status','claimed','verified','featured','profile_score','source_name','source_url','address_text'],business_claims:['status','verification_method','review_notes'],business_submissions:['status','review_notes'],listing_reports:['status','resolution_notes'],business_edit_requests:['status','review_notes'],categories:['name','slug','vertical','is_active'],locations:['name','slug','county','state','region','type','is_active'],seo_pages:['title','description','h1','intro','content','focus_topic','index_mode','reviewed'],seo_market_gaps:['target_providers','status','priority','reason'],business_prospects:['status','crm_stage','priority','opportunity_score','notes'],outreach_tasks:['status','outcome','notes','due_at'],sponsorships:['placement','active','starts_on','ends_on'],leads:['status','assigned_business_id','notes'],lead_recipients:['status','response_note','contacted_at','responded_at'],business_locations:['label','location_type','is_primary','is_active','verified','address_text','city','state','postal_code','phone','source_name','source_url'],business_service_areas:[],site_content_blocks:['page_key','section_key','content_key','title','body','button_label','button_url','media_url','sort_order','is_published'],guides:['title','type','city','category','summary','body','status'],listing_daily_stats:['impressions','profile_views','phone_clicks','website_clicks','directions_clicks','lead_submissions'],subscriptions:['status','current_period_start','current_period_end','cancel_at_period_end','sponsorship_label'],marketing_leads:['status','service_interest','message'],notifications:['read_at'],plans:['name','monthly_price_cents','annual_price_cents','badge','description','is_active','sort_order'],navigation_items:['menu_key','label','href','sort_order','is_visible']};if(!allowed[table])return;const patch:Record<string,unknown>={};for(const k of allowed[table]){if(!fd.has(k))continue;const v=fd.get(k);if(['claimed','verified','featured','is_active','reviewed','active','is_primary','is_published','cancel_at_period_end','is_visible'].includes(k))patch[k]=v==='on';else if(['profile_score','target_providers','opportunity_score','sort_order','monthly_price_cents','annual_price_cents','impressions','profile_views','phone_clicks','website_clicks','directions_clicks','lead_submissions'].includes(k))patch[k]=Number(v||0);else patch[k]=String(v||'')||null}const s=await createClient();let q=s.from(table as any).update(patch).eq('id',id);if(['businesses','categories','locations','seo_pages','seo_market_gaps','business_prospects','outreach_tasks','business_locations','site_content_blocks','guides','subscriptions','marketing_leads','navigation_items','plans'].includes(table))q=q.eq('tenant_id',TENANT_ID);await q;revalidatePath('/admin','layout')}
export async function saveSiteSettings(fd:FormData){ await requireAdmin('/admin/site-builder');const s=await createClient();const patch={directory_name:txt(fd,'directory_name'),parent_brand_name:txt(fd,'parent_brand_name'),brand_logo_url:txt(fd,'brand_logo_url')||null,brand_primary_color:txt(fd,'brand_primary_color'),brand_secondary_color:txt(fd,'brand_secondary_color'),brand_accent_color:txt(fd,'brand_accent_color'),consumer_tagline:txt(fd,'consumer_tagline'),business_tagline:txt(fd,'business_tagline'),hero_eyebrow:txt(fd,'hero_eyebrow'),hero_heading:txt(fd,'hero_heading'),hero_body:txt(fd,'hero_body'),footer_text:txt(fd,'footer_text'),updated_at:new Date().toISOString()};await s.from('site_settings').update(patch).eq('tenant_id',TENANT_ID);revalidatePath('/','layout') }
export async function savePlan(fd:FormData){ await requireAdmin('/admin/pricing');const s=await createClient();const id=txt(fd,'id');const features=txt(fd,'features').split('\n').map(x=>x.trim()).filter(Boolean);const patch={name:txt(fd,'name'),monthly_price_cents:Math.round(Number(txt(fd,'monthly_price')||0)*100),annual_price_cents:Math.round(Number(txt(fd,'annual_price')||0)*100),badge:txt(fd,'badge')||null,description:txt(fd,'description')||null,features,is_active:bool(fd,'is_active'),sort_order:Number(txt(fd,'sort_order')||0),updated_at:new Date().toISOString()};await s.from('plans').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);revalidatePath('/for-businesses');revalidatePath('/admin/pricing') }
export async function saveNavItem(fd:FormData){ await requireAdmin('/admin/navigation');const s=await createClient();const id=txt(fd,'id');const patch={menu_key:txt(fd,'menu_key'),label:txt(fd,'label'),href:txt(fd,'href'),sort_order:Number(txt(fd,'sort_order')||0),is_visible:bool(fd,'is_visible'),updated_at:new Date().toISOString()};await s.from('navigation_items').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);revalidatePath('/','layout') }
export async function approveEditRequest(fd:FormData){ const {claims}=await requireStaff('/admin/edit-requests');const s=await createClient();const id=txt(fd,'id');const {data:req}=await s.from('business_edit_requests').select('business_id,proposed_changes,status').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle();if(!req||req.status!=='pending')return;const allowed=['description','phone','website','hours','email','menu_url','ordering_url','reservation_url','price_range','attributes'];const proposed=(req.proposed_changes??{}) as Record<string,unknown>;const patch=Object.fromEntries(Object.entries(proposed).filter(([k])=>allowed.includes(k)));if(Object.keys(patch).length)await s.from('businesses').update(patch).eq('tenant_id',TENANT_ID).eq('id',req.business_id);await s.from('business_edit_requests').update({status:'approved',reviewed_by:String(claims.sub),reviewed_at:new Date().toISOString()}).eq('id',id);revalidatePath('/admin/edit-requests') }

export async function createLocation(fd:FormData){
  await requireAdmin('/admin/locations'); const s=await createClient();
  const record={tenant_id:TENANT_ID,type:txt(fd,'type')||'city',slug:txt(fd,'slug'),name:txt(fd,'name'),county:txt(fd,'county')||null,state:txt(fd,'state')||'IL',region:txt(fd,'region')||'Central Illinois',nearby:[],is_active:true};
  await s.from('locations').insert(record); revalidatePath('/admin/locations'); revalidatePath('/illinois');
}
export async function createCategory(fd:FormData){
  await requireAdmin('/admin/categories'); const s=await createClient();
  await s.from('categories').insert({tenant_id:TENANT_ID,vertical:txt(fd,'vertical'),slug:txt(fd,'slug'),name:txt(fd,'name'),is_active:true});
  revalidatePath('/admin/categories'); revalidatePath('/','layout');
}
export async function createContentBlock(fd:FormData){
  await requireAdmin('/admin/content-blocks'); const s=await createClient();
  await s.from('site_content_blocks').insert({tenant_id:TENANT_ID,page_key:txt(fd,'page_key'),section_key:txt(fd,'section_key'),content_key:txt(fd,'content_key'),title:txt(fd,'title')||null,body:txt(fd,'body')||null,button_label:txt(fd,'button_label')||null,button_url:txt(fd,'button_url')||null,sort_order:Number(txt(fd,'sort_order')||0),is_published:true});
  revalidatePath('/admin/content-blocks'); revalidatePath('/','layout');
}
export async function createGuide(fd:FormData){
  await requireAdmin('/admin/guides'); const s=await createClient();
  await s.from('guides').insert({tenant_id:TENANT_ID,slug:txt(fd,'slug'),title:txt(fd,'title'),type:txt(fd,'type')||'local_guide',city:txt(fd,'city')||null,category:txt(fd,'category')||null,summary:txt(fd,'summary'),body:txt(fd,'body'),status:'draft',updated_at:new Date().toISOString()});
  revalidatePath('/admin/guides');
}
export async function createBranch(fd:FormData){
  await requireAdmin('/admin/branches'); const s=await createClient();
  const businessId=txt(fd,'business_id');
  const {data:b}=await s.from('businesses').select('tenant_id').eq('id',businessId).eq('tenant_id',TENANT_ID).maybeSingle(); if(!b)return;
  await s.from('business_locations').insert({tenant_id:TENANT_ID,business_id:businessId,label:txt(fd,'label')||'Additional Location',location_type:txt(fd,'location_type')||'office',is_primary:false,is_active:true,verified:false,address_text:txt(fd,'address_text')||null,city:txt(fd,'city'),state:txt(fd,'state')||'IL',postal_code:txt(fd,'postal_code')||null,phone:txt(fd,'phone')||null,source_name:txt(fd,'source_name')||null,source_url:txt(fd,'source_url')||null,source_checked_at:new Date().toISOString()});
  revalidatePath('/admin/branches');
}
export async function createPlan(fd:FormData){
  await requireAdmin('/admin/pricing'); const s=await createClient();
  await s.from('plans').insert({tenant_id:TENANT_ID,slug:txt(fd,'slug'),name:txt(fd,'name'),monthly_price_cents:Math.round(Number(txt(fd,'monthly_price')||0)*100),annual_price_cents:Math.round(Number(txt(fd,'annual_price')||0)*100),is_active:true,features:[],description:txt(fd,'description')||null,badge:txt(fd,'badge')||null,entitlements:{},sort_order:Number(txt(fd,'sort_order')||100),updated_at:new Date().toISOString()});
  revalidatePath('/admin/pricing'); revalidatePath('/for-businesses');
}
export async function createNavItem(fd:FormData){
  await requireAdmin('/admin/navigation'); const s=await createClient();
  await s.from('navigation_items').insert({tenant_id:TENANT_ID,menu_key:txt(fd,'menu_key'),label:txt(fd,'label'),href:txt(fd,'href'),sort_order:Number(txt(fd,'sort_order')||100),is_visible:true,metadata:{}});
  revalidatePath('/admin/navigation'); revalidatePath('/','layout');
}
export async function addUserRole(fd:FormData){
  await requireSuperAdmin('/admin/team'); const s=await createClient();
  const role=txt(fd,'role'); if(!['staff','admin','super_admin'].includes(role))return;
  await s.from('user_roles').upsert({tenant_id:TENANT_ID,user_id:txt(fd,'user_id'),role}); revalidatePath('/admin/team');
}
export async function deleteUserRole(fd:FormData){
  await requireSuperAdmin('/admin/team'); const s=await createClient();
  await s.from('user_roles').delete().eq('tenant_id',TENANT_ID).eq('user_id',txt(fd,'user_id')).eq('role',txt(fd,'role')); revalidatePath('/admin/team');
}
