import { getSite } from '@/lib/data'
import { saveSiteSettings } from '@/app/admin/site-settings-actions'
import { TENANT_ID } from '@/lib/constants'
import { BrandLogoUploader } from '@/components/BrandLogoUploader'

export async function SiteBuilder() {
  const site = await getSite()
  const field = (name: string, label: string, type = 'text') => (
    <label>{label}<input name={name} type={type} defaultValue={String((site as any)[name] ?? '')} /></label>
  )
  const json = (value: unknown) => value && typeof value === 'object' ? JSON.stringify(value, null, 2) : '{}'

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Public Site Configuration</div>
        <h1>Site Builder / Brand & Content</h1>
        <p className="muted">Edit Skylight branding, directory identity, public copy and site-wide SEO defaults without rebuilding the application.</p>
      </div>
      <span className="badge verified">Editable</span>
    </div>

    <div className="admin-settings-grid admin-settings-grid-top">
      <div className="admin-card">
        <div className="kpi">Brand Asset</div>
        <h2>Primary Logo</h2>
        <p className="small muted">Upload the production logo here. The saved logo URL below remains available for an intentional durable external asset.</p>
        <BrandLogoUploader tenantId={TENANT_ID} currentUrl={site.brand_logo_url} />
      </div>
      <div className="admin-card admin-settings-help">
        <div className="kpi">How this area works</div>
        <h2>One place for public identity</h2>
        <p className="small muted">Changes here affect the shared brand, hero messaging, contact information and default SEO copy. Reusable page sections, menus and pricing are managed in their dedicated tools.</p>
        <div className="admin-row-actions">
          <a className="btn btn-light" href="/admin/content-blocks">Content Blocks</a>
          <a className="btn btn-light" href="/admin/navigation">Navigation</a>
          <a className="btn btn-light" href="/admin/pricing">Pricing</a>
        </div>
      </div>
    </div>

    <form action={saveSiteSettings} className="admin-card admin-settings-form">
      <section className="admin-settings-section">
        <div className="admin-settings-section-head"><div><div className="kpi">Identity</div><h2>Directory & Skylight Brand</h2></div></div>
        <div className="admin-form-grid">
          {field('directory_name', 'Directory Name')}
          {field('parent_brand_name', 'Parent Brand')}
          {field('brand_logo_url', 'Logo URL')}
        </div>
      </section>

      <section className="admin-settings-section">
        <div className="admin-settings-section-head"><div><div className="kpi">Visual System</div><h2>Brand Colors</h2><p className="small muted">These values drive the shared public brand palette.</p></div></div>
        <div className="admin-form-grid admin-color-grid">
          {field('brand_primary_color', 'Skylight Purple', 'color')}
          {field('brand_secondary_color', 'Electric Blue', 'color')}
          {field('brand_accent_color', 'Cyan Accent', 'color')}
          {field('brand_dark_color', 'Deep Black', 'color')}
          {field('brand_charcoal_color', 'Dark Charcoal', 'color')}
          {field('brand_light_color', 'Soft White', 'color')}
          {field('brand_silver_color', 'Metallic Silver', 'color')}
        </div>
      </section>

      <section className="admin-settings-section">
        <div className="admin-settings-section-head"><div><div className="kpi">Public Messaging</div><h2>Hero, Taglines & Contact</h2></div></div>
        <div className="admin-form-grid">
          {field('consumer_tagline', 'Consumer Tagline')}
          {field('business_tagline', 'Business Tagline')}
          {field('hero_eyebrow', 'Hero Eyebrow')}
          {field('hero_title', 'Hero Title')}
          {field('footer_text', 'Footer Relationship')}
          {field('support_email', 'Support Email', 'email')}
          {field('support_phone', 'Support Phone')}
          <label className="full-row">Hero Description<textarea name="hero_subtitle" defaultValue={site.hero_subtitle ?? ''} /></label>
        </div>
      </section>

      <section className="admin-settings-section">
        <div className="admin-settings-section-head"><div><div className="kpi">Search & Offer</div><h2>SEO & Offer Defaults</h2></div></div>
        <div className="admin-form-grid">
          {field('default_seo_title', 'Default SEO Title')}
          <label className="full-row">Default Meta Description<textarea name="default_meta_description" defaultValue={site.default_meta_description ?? ''} /></label>
          <label className="full-row">Founding / Promotional Offer<textarea name="founding_offer" defaultValue={site.founding_offer ?? ''} /></label>
        </div>
      </section>

      <details className="admin-inner-disclosure">
        <summary><span><strong>Advanced Site Controls</strong><small>Private JSON configuration for social links, feature flags and branding options.</small></span></summary>
        <div className="admin-inner-disclosure-body">
          <div className="notice">These JSON fields are private configuration. Use valid JSON objects. They are never exposed as staff diagnostics on customer-facing pages.</div>
          <label>Social Links JSON<textarea name="social_links" defaultValue={json(site.social_links)} /></label>
          <label>Feature Flags JSON<textarea name="feature_flags" defaultValue={json(site.feature_flags)} /></label>
          <label>Branding Options JSON<textarea name="branding_options" defaultValue={json(site.branding_options)} /></label>
        </div>
      </details>

      <div className="admin-form-savebar">
        <div><strong>Site-wide settings</strong><span>Review changes before saving because these values can affect multiple public pages.</span></div>
        <button className="btn btn-primary">Save All Site Settings</button>
      </div>
    </form>
  </>
}
