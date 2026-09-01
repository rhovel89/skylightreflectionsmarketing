'use server'
import{revalidatePath}from'next/cache';
import{createClient}from'@/lib/supabase/server';
import{requireAdmin}from'@/lib/auth';
import{TENANT_ID}from'@/lib/constants';

const txt=(f:FormData,k:string)=>String(f.get(k)||'').trim();
function jsonObject(f:FormData,k:string){
  const raw=txt(f,k); if(!raw)return {};
  try{const parsed=JSON.parse(raw);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}
  catch{return {}}
}

export async function saveSiteSettings(fd:FormData){
  await requireAdmin('/admin/site-builder');
  const s=await createClient();
  const patch={
    directory_name:txt(fd,'directory_name'),
    parent_brand_name:txt(fd,'parent_brand_name'),
    brand_logo_url:txt(fd,'brand_logo_url')||null,
    brand_primary_color:txt(fd,'brand_primary_color'),
    brand_secondary_color:txt(fd,'brand_secondary_color'),
    brand_accent_color:txt(fd,'brand_accent_color'),
    brand_dark_color:txt(fd,'brand_dark_color'),
    brand_charcoal_color:txt(fd,'brand_charcoal_color'),
    brand_light_color:txt(fd,'brand_light_color'),
    brand_silver_color:txt(fd,'brand_silver_color'),
    consumer_tagline:txt(fd,'consumer_tagline'),
    business_tagline:txt(fd,'business_tagline'),
    hero_eyebrow:txt(fd,'hero_eyebrow'),
    hero_title:txt(fd,'hero_title'),
    hero_subtitle:txt(fd,'hero_subtitle'),
    footer_text:txt(fd,'footer_text'),
    support_email:txt(fd,'support_email')||null,
    support_phone:txt(fd,'support_phone')||null,
    default_seo_title:txt(fd,'default_seo_title')||null,
    default_meta_description:txt(fd,'default_meta_description')||null,
    founding_offer:txt(fd,'founding_offer')||null,
    social_links:jsonObject(fd,'social_links'),
    feature_flags:jsonObject(fd,'feature_flags'),
    branding_options:jsonObject(fd,'branding_options'),
    updated_at:new Date().toISOString()
  };
  const{error}=await s.from('site_settings').update(patch).eq('tenant_id',TENANT_ID);
  if(error)throw new Error(error.message);
  revalidatePath('/','layout');
  revalidatePath('/admin/site-builder');
}
