import{getSite}from'@/lib/data';import{saveSiteSettings}from'@/app/admin/site-settings-actions';import{TENANT_ID}from'@/lib/constants';import{BrandLogoUploader}from'@/components/BrandLogoUploader';
export async function SiteBuilder(){
  const s=await getSite();
  const f=(name:string,label:string,type='text')=><label>{label}<input name={name} type={type} defaultValue={String((s as any)[name]??'')}/></label>;
  const j=(value:unknown)=>value&&typeof value==='object'?JSON.stringify(value,null,2):'{}';
  return <>
    <h1>Site Builder / Brand & Content</h1>
    <p className="muted">Edit Skylight branding, directory identity, public copy and site-wide SEO defaults without rebuilding the application.</p>

    <BrandLogoUploader tenantId={TENANT_ID} currentUrl={s.brand_logo_url}/>

    <form action={saveSiteSettings} className="admin-card">
      <h2>Skylight Reflections Marketing Brand</h2>
      <p className="small muted">Direct upload above is preferred for the production logo. The Logo URL field remains available for an intentional durable external asset URL.</p>
      <div className="admin-form-grid">
        {f('directory_name','Directory Name')}{f('parent_brand_name','Parent Brand')}{f('brand_logo_url','Logo URL')}
        {f('brand_primary_color','Skylight Purple','color')}{f('brand_secondary_color','Electric Blue','color')}{f('brand_accent_color','Cyan Accent','color')}
        {f('brand_dark_color','Deep Black','color')}{f('brand_charcoal_color','Dark Charcoal','color')}{f('brand_light_color','Soft White','color')}{f('brand_silver_color','Metallic Silver','color')}
        {f('consumer_tagline','Consumer Tagline')}{f('business_tagline','Business Tagline')}{f('hero_eyebrow','Hero Eyebrow')}{f('hero_title','Hero Title')}
        {f('footer_text','Footer Relationship')}{f('support_email','Support Email','email')}{f('support_phone','Support Phone')}
      </div>
      <label>Hero Description<textarea name="hero_subtitle" defaultValue={s.hero_subtitle??''}/></label>
      <h2 style={{marginTop:24}}>SEO & Offer Defaults</h2>
      <div className="admin-form-grid">{f('default_seo_title','Default SEO Title')}</div>
      <label>Default Meta Description<textarea name="default_meta_description" defaultValue={s.default_meta_description??''}/></label>
      <label>Founding / Promotional Offer<textarea name="founding_offer" defaultValue={s.founding_offer??''}/></label>
      <h2 style={{marginTop:24}}>Advanced Site Controls</h2>
      <p className="small muted">These JSON fields are private configuration. Use valid JSON objects. They are never exposed as staff diagnostics on customer-facing pages.</p>
      <label>Social Links JSON<textarea name="social_links" defaultValue={j(s.social_links)}/></label>
      <label>Feature Flags JSON<textarea name="feature_flags" defaultValue={j(s.feature_flags)}/></label>
      <label>Branding Options JSON<textarea name="branding_options" defaultValue={j(s.branding_options)}/></label>
      <button className="btn btn-primary" style={{marginTop:14}}>Save All Site Settings</button>
    </form>
    <div className="admin-card"><h2>Editable Content Blocks</h2><p className="muted">Use Site Content Blocks for reusable homepage sections and CTAs, Content Hub / Guides for long-form content, Navigation Editor for menus, Pricing & Plans for public pricing, and the listing/category/location managers for marketplace data.</p></div>
  </>
}
