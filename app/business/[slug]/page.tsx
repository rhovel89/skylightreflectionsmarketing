import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/SiteShell'
import { FeaturedBusinessSidebar } from '@/components/FeaturedBusinessSidebar'
import { LeadForm, ClaimForm, ListingReportForm } from '@/components/ActionForms'
import { TrackedBusinessLink } from '@/components/TrackedBusinessLink'
import { GrowthTrackedLink } from '@/components/GrowthTracking'
import { getBusiness, getCategories, getLocations, getFeaturedSidebarBusinesses, recordListingEvents } from '@/lib/data'
import { toggleSavedBusiness } from '@/app/actions'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const safeUrl=(value:any)=>{try{const u=new URL(String(value||''));return ['http:','https:'].includes(u.protocol)?u.toString():''}catch{return''}}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const b = await getBusiness(slug)
  if (!b) notFound()

  await recordListingEvents([b.id], 'profile_view')
  const cats = (b.business_categories ?? []).map((x: any) => x.categories?.name).filter(Boolean)
  const branches = (b.business_locations ?? []).filter((x: any) => x.is_active !== false)
  const primary = branches.find((x: any) => x.is_primary) || branches[0]
  const [locations, categories] = await Promise.all([getLocations(), getCategories()])
  const citySlug = locations.find(x => x.name.toLowerCase() === String(primary?.city || '').toLowerCase())?.slug
  const categorySlug = categories.find(x => x.name.toLowerCase() === String(cats[0] || '').toLowerCase())?.slug
  const featured = await getFeaturedSidebarBusinesses({ city: citySlug, category: categorySlug, pagePath: `/business/${slug}`, placement: 'business_profile_sidebar', limit: 4 })

  const phone = primary?.phone || b.phone
  const address = primary?.address_text || b.address_text
  const media = (b.business_media ?? []) as any[]
  const logo = media.find((x: any) => x.media_type === 'logo')
  const cover = media.find((x: any) => x.media_type === 'cover')

  const supabase = await createClient()
  const { data: entitlementData } = await supabase.rpc('get_public_business_media_entitlements', { p_business_id: b.id })
  const mediaEntitlements = (entitlementData && typeof entitlementData === 'object' ? entitlementData : {}) as Record<string, any>
  const rawGalleryLimit = Number(mediaEntitlements.max_gallery_images ?? 0)
  const galleryLimit = Number.isFinite(rawGalleryLimit) ? Math.max(0, rawGalleryLimit) : 0
  const menuUpload = Boolean(mediaEntitlements.menu_upload)
  const isPro = String(mediaEntitlements.plan_slug || '') === 'pro'
  const gallery = media.filter((x: any) => x.media_type === 'gallery').slice(0, galleryLimit)
  const uploadedMenu = menuUpload ? media.find((x: any) => x.media_type === 'menu') : null
  const uploadedMenuIsPdf = Boolean(uploadedMenu?.storage_path && String(uploadedMenu.storage_path).toLowerCase().endsWith('.pdf'))
  const menuHref = uploadedMenu?.url || b.menu_url || null
  const rawPro = isPro && b.attributes && typeof b.attributes === 'object' ? (b.attributes as any).pro_profile : null
  const proServices = Array.isArray(rawPro?.services) ? rawPro.services.slice(0, 12).filter((x:any)=>String(x?.name||'').trim()) : []
  const proFaqs = Array.isArray(rawPro?.faqs) ? rawPro.faqs.slice(0, 8).filter((x:any)=>String(x?.question||'').trim()&&String(x?.answer||'').trim()) : []
  const socialEntries = isPro && rawPro?.social_links && typeof rawPro.social_links === 'object' ? Object.entries(rawPro.social_links).map(([k,v])=>[k,safeUrl(v)] as const).filter(([,v])=>v) : []
  const rawOffer = isPro && rawPro?.offer && typeof rawPro.offer === 'object' ? rawPro.offer : null
  const today = new Date().toISOString().slice(0,10)
  const offerActive = Boolean(rawOffer?.title && (!rawOffer?.expires_on || String(rawOffer.expires_on) >= today))
  const offerUrl = offerActive ? safeUrl(rawOffer?.cta_url) : ''
  const socialLabels:Record<string,string>={facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',tiktok:'TikTok',youtube:'YouTube',x:'X / Twitter'}

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: b.name,
    url: b.website || undefined,
    telephone: phone || undefined,
    description: b.description || undefined,
    image: cover?.url || logo?.url || gallery[0]?.url || undefined,
    sameAs: socialEntries.length ? socialEntries.map(([,v])=>v) : undefined,
    address: primary ? {
      '@type': 'PostalAddress',
      streetAddress: primary.address_text || undefined,
      addressLocality: primary.city || undefined,
      addressRegion: primary.state || undefined,
      postalCode: primary.postal_code || undefined,
    } : undefined,
  }
  if (b.rating > 0 && b.review_count > 0) schema.aggregateRating = { '@type': 'AggregateRating', ratingValue: b.rating, reviewCount: b.review_count }
  const schemaJson = JSON.stringify(schema).replace(/</g, '\\u003c')
  const growthHref = `/contact?reason=visibility-plan&plan=featured&business=${encodeURIComponent(b.slug)}${primary?.city ? `&city=${encodeURIComponent(primary.city)}` : ''}${cats[0] ? `&category=${encodeURIComponent(cats[0])}` : ''}&source=business-profile#marketing-review`

  return <SiteShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaJson }} />
    <main>
      <section className="pagehero"><div className="container">
        <div className="badges">{b.verified && <span className="badge verified">Verified</span>}{b.is_sponsored && <span className="badge sponsored">Sponsored</span>}{b.claimed && <span className="badge neutral">Claimed</span>}{isPro && <span className="badge neutral">Pro Profile</span>}</div>
        <div className="profile-identity">{logo && <img className="business-logo" src={logo.url} alt={logo.alt_text || `${b.name} logo`} />}<div><h1 className="profile-title">{b.name}</h1><p>{cats.join(' · ') || 'Local business'}{primary?.city ? ` · ${primary.city}, ${primary.state || 'IL'}` : ''}</p></div></div>
        <div className="profile-actions">
          {phone && <TrackedBusinessLink businessId={b.id} eventType="phone_click" className="btn btn-primary" href={`tel:${phone}`}>Call Business</TrackedBusinessLink>}
          {b.website && <TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={b.website} target="_blank" rel="noopener noreferrer">Visit Website</TrackedBusinessLink>}
          {menuHref && <TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={menuHref} target="_blank" rel="noopener noreferrer">View Menu</TrackedBusinessLink>}
          {b.ordering_url && <TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={b.ordering_url} target="_blank" rel="noopener noreferrer">Order Online</TrackedBusinessLink>}
        </div>
      </div></section>

      <section className="section"><div className="container profile-grid"><div>
        {cover && <div className="business-cover-card"><img src={cover.url} alt={cover.alt_text || `${b.name} cover image`} />{cover.caption && <p>{cover.caption}</p>}</div>}

        <div className="card">
          <div className="kpi">Business Profile</div><h2>About {b.name}</h2>
          <p className="muted">{b.description || 'This profile contains available public listing information for this local business.'}</p>
          {address && <div className="info-row"><span>Primary address</span><strong>{address}</strong></div>}
          <div className="info-row"><span>Phone</span><strong>{phone ? <TrackedBusinessLink businessId={b.id} eventType="phone_click" href={`tel:${phone}`}>{phone}</TrackedBusinessLink> : 'Not listed'}</strong></div>
          <div className="info-row"><span>Website</span><strong>{b.website ? <TrackedBusinessLink businessId={b.id} eventType="website_click" href={b.website} target="_blank" rel="noopener noreferrer">Visit website ↗</TrackedBusinessLink> : 'Not listed'}</strong></div>
          <div className="info-row"><span>Hours</span><strong>{typeof b.hours === 'string' ? b.hours : 'See business for current hours'}</strong></div>
          {b.price_range && <div className="info-row"><span>Price range</span><strong>{b.price_range}</strong></div>}
          {b.reservation_url && <div className="info-row"><span>Reservations</span><TrackedBusinessLink businessId={b.id} eventType="website_click" href={b.reservation_url} target="_blank" rel="noopener noreferrer">Reserve ↗</TrackedBusinessLink></div>}
          {socialEntries.length>0&&<div className="card-actions" style={{marginTop:14}}>{socialEntries.map(([k,v])=><TrackedBusinessLink key={k} businessId={b.id} eventType="website_click" href={v} target="_blank" rel="noopener noreferrer" className="btn btn-light">{socialLabels[k]||k} ↗</TrackedBusinessLink>)}</div>}
          <form action={async () => { 'use server'; await toggleSavedBusiness(b.id) }}><button className="btn btn-light" style={{ marginTop: 14 }}>Save / Unsave Business</button></form>
        </div>

        {offerActive && <div className="card" style={{marginTop:18}}><div className="badges"><span className="badge sponsored">Business Offer</span>{rawOffer.expires_on&&<span className="badge neutral">Through {String(rawOffer.expires_on)}</span>}</div><h2>{String(rawOffer.title)}</h2>{rawOffer.details&&<p className="muted">{String(rawOffer.details)}</p>}{offerUrl&&<TrackedBusinessLink businessId={b.id} eventType="website_click" href={offerUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">{String(rawOffer.cta_label||'Learn More')} ↗</TrackedBusinessLink>}<p className="small muted" style={{marginTop:10}}>Offer details are supplied by the business and may change. Confirm eligibility, availability and final terms directly with the business.</p></div>}

        {proServices.length>0&&<div className="card" style={{marginTop:18}}><div className="section-head compact-head"><div><div className="kpi">Services</div><h2>What {b.name} Offers</h2></div><span className="badge neutral">{proServices.length}</span></div><div className="grid grid-2">{proServices.map((x:any,i:number)=><div className="admin-card" key={`${String(x.name)}-${i}`}><h3>{String(x.name)}</h3>{x.description&&<p className="muted small">{String(x.description)}</p>}</div>)}</div></div>}

        {uploadedMenu && <div className="card" style={{ marginTop: 18 }}>
          <div className="section-head compact-head"><div><div className="kpi">Restaurant Menu</div><h2>Current Menu</h2></div><span className="badge sponsored">Business provided</span></div>
          {uploadedMenuIsPdf
            ? <TrackedBusinessLink businessId={b.id} eventType="website_click" href={uploadedMenu.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Menu PDF ↗</TrackedBusinessLink>
            : <figure style={{ margin: 0 }}><img src={uploadedMenu.url} alt={uploadedMenu.alt_text || `${b.name} menu`} style={{ width: '100%', height: 'auto', borderRadius: 14 }} />{uploadedMenu.caption && <figcaption className="small muted" style={{ marginTop: 8 }}>{uploadedMenu.caption}</figcaption>}</figure>}
          <p className="small muted" style={{ marginTop: 12 }}>Menu details, availability and pricing are supplied by the business and may change. Confirm current information directly with the restaurant.</p>
          {b.menu_url && b.menu_url !== uploadedMenu.url && <TrackedBusinessLink businessId={b.id} eventType="website_click" href={b.menu_url} target="_blank" rel="noopener noreferrer" className="btn btn-light">Official Menu Link ↗</TrackedBusinessLink>}
        </div>}

        {gallery.length > 0 && <div className="card" style={{ marginTop: 18 }}>
          <div className="section-head compact-head"><div><div className="kpi">Business Showcase</div><h2>Photos</h2></div><span className="badge neutral">{gallery.length}</span></div>
          <div className="business-gallery">{gallery.map((m: any) => <figure key={m.id}><img src={m.url} alt={m.alt_text || `${b.name} business photo`} />{m.caption && <figcaption>{m.caption}</figcaption>}</figure>)}</div>
        </div>}

        {proFaqs.length>0&&<div className="card" style={{marginTop:18}}><div className="kpi">Frequently Asked Questions</div><h2>Questions About {b.name}</h2>{proFaqs.map((x:any,i:number)=><details key={`${String(x.question)}-${i}`} className="admin-card" style={{marginTop:10}}><summary><strong>{String(x.question)}</strong></summary><p className="muted small">{String(x.answer)}</p></details>)}<p className="small muted" style={{marginTop:12}}>These answers are supplied by the business. Contact the business to confirm details for your specific needs.</p></div>}

        <div className="card" style={{ marginTop: 18 }}>
          <div className="section-head compact-head"><div><div className="kpi">Branches</div><h2>Physical Locations</h2></div><span className="badge neutral">{branches.length} location{branches.length === 1 ? '' : 's'}</span></div>
          {branches.length ? <div className="location-list">{branches.map((x: any) => <div className="location-card" key={x.id}><strong>{x.label || x.city || x.location_type || 'Location'}</strong><p>{[x.address_text, x.city, x.state, x.postal_code].filter(Boolean).join(', ')}</p>{x.phone && <TrackedBusinessLink businessId={b.id} eventType="phone_click" href={`tel:${x.phone}`}>{x.phone}</TrackedBusinessLink>}{x.is_primary && <span className="badge neutral">Primary</span>}</div>)}</div> : <p className="muted">No branch details are published.</p>}
          <p className="small muted">Service areas are kept separate from physical locations so serving a city is not presented as having an office there.</p>
        </div>

        <div className="card" style={{ marginTop: 18 }}><h2>Listing Information</h2><p className="small muted">{b.source_name || 'Directory listing source on file'}{b.source_url && <> · <a href={b.source_url} target="_blank" rel="noopener noreferrer">View source ↗</a></>}</p>{b.rating > 0 && b.review_count > 0 ? <p><strong>{b.rating}</strong> from {b.review_count} sourced reviews</p> : <p className="small muted">No independently sourced rating/review block is displayed for this listing.</p>}{b.is_sponsored && <p className="small muted"><strong>Sponsored disclosure:</strong> this business currently has an active paid directory placement. Sponsorship does not replace organic relevance or verification.</p>}</div>
        <div className="card" style={{ marginTop: 18 }}><h2>Report or Suggest an Edit</h2><p className="small muted">Help keep the directory accurate. Submitted changes are reviewed before protected listing data is updated.</p><ListingReportForm businessId={b.id} /></div>
      </div>

      <aside>
        <div className="card sticky-card"><div className="kpi">Direct Connection</div><h2>Contact This Business</h2><p className="small muted">Your request goes through the directory contact workflow. Organic listing relevance is not affected by paid placement.</p><LeadForm businessId={b.id} service={cats[0] || ''} city={primary?.city || ''} /></div>
        {!b.claimed && <div className="card" style={{ marginTop: 18 }}><h3>Is this your business?</h3><p className="muted small">Claiming establishes owner access after staff review. It does not automatically create a verified badge, and claiming does not require a paid plan.</p><ClaimForm businessId={b.id} /></div>}
        <div style={{ marginTop: 18 }}><FeaturedBusinessSidebar businesses={featured as any[]} contextLabel={primary?.city && cats[0] ? `${cats[0]} in ${primary.city}` : primary?.city || cats[0] || 'local businesses'} /></div>
        <div className="card" style={{ marginTop: 18 }}><div className="kpi">For Business Owners</div><h3>Show customers more of your business.</h3><p className="muted small">Featured includes up to 5 showcase photos and optional Lead Inbox access. Pro includes up to 10 showcase photos, Lead Inbox, and a richer mini-site with services, FAQs, an offer and social links. Restaurant listings on Featured or Pro can also publish a moderated menu file. Paid tools never buy verification or organic rank.</p><GrowthTrackedLink eventType="business_visibility_click" businessId={b.id} city={primary?.city || undefined} category={cats[0] || undefined} plan="featured" source="business-profile" href={growthHref} className="btn btn-light full">Explore Visibility Options</GrowthTrackedLink></div>
      </aside>
      </div></section>
    </main>
  </SiteShell>
}
