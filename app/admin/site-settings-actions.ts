'use server'
import{revalidatePath}from'next/cache';
import{createClient}from'@/lib/supabase/server';
import{requireAdmin}from'@/lib/auth';
import{TENANT_ID}from'@/lib/constants';

const txt=(f:FormData,k:string)=>String(f.get(k)||'').trim();
const LOGO_TYPES=new Set(['image/jpeg','image/png','image/webp']);
function jsonObject(f:FormData,k:string){
  const raw=txt(f,k); if(!raw)return {};
  try{const parsed=JSON.parse(raw);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}
  catch{return {}}
}
function managedSiteAssetPath(value:string|null|undefined){
  if(!value)return null;
  try{
    const url=new URL(value);
    const marker='/storage/v1/object/public/site-assets/';
    const index=url.pathname.indexOf(marker);
    if(index<0)return null;
    const path=decodeURIComponent(url.pathname.slice(index+marker.length));
    return path.startsWith(`${TENANT_ID}/branding/`)?path:null;
  }catch{return null}
}
function revalidateBranding(){
  revalidatePath('/','layout');
  revalidatePath('/admin/site-builder');
  revalidatePath('/admin/launch-readiness');
}

export async function uploadBrandLogo(fd:FormData){
  const{claims}=await requireAdmin('/admin/site-builder');
  const file=fd.get('logo_file');
  if(!(file instanceof File)||!file.size)throw new Error('Choose a logo image to upload.');
  if(file.size>5*1024*1024)throw new Error('Logo image must be 5 MB or smaller.');
  if(!LOGO_TYPES.has(file.type))throw new Error('Use a PNG, JPEG or WebP logo image.');

  const s=await createClient();
  const{data:current,error:currentError}=await s.from('site_settings').select('brand_logo_url').eq('tenant_id',TENANT_ID).maybeSingle();
  if(currentError)throw new Error(currentError.message);

  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const path=`${TENANT_ID}/branding/${crypto.randomUUID()}.${ext}`;
  const{error:uploadError}=await s.storage.from('site-assets').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
  if(uploadError)throw new Error(`Unable to upload logo: ${uploadError.message}`);

  const{data:publicUrlData}=s.storage.from('site-assets').getPublicUrl(path);
  const publicUrl=publicUrlData.publicUrl;
  const{error:updateError}=await s.from('site_settings').update({brand_logo_url:publicUrl,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID);
  if(updateError){
    await s.storage.from('site-assets').remove([path]);
    throw new Error(updateError.message);
  }

  const oldPath=managedSiteAssetPath(current?.brand_logo_url);
  if(oldPath&&oldPath!==path)await s.storage.from('site-assets').remove([oldPath]);

  await s.from('audit_log').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'site_brand_logo_update',action_text:'Updated the durable site brand logo asset.'});
  revalidateBranding();
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
  revalidateBranding();
}
