import Link from 'next/link'
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
const related=(v:any)=>Array.isArray(v)?v[0]:v

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const b = await getBusiness(slug)
  if (!b) notFound()

  await recordListingEvents([b.id], 'profile_view')
  const cats = (b.business_categories ?? []).map((x: any) => x.categories?.name).filter(Boolean)
  const branches = (b.business_locations ?? []).filter((x: any) => x.is_active !== false)
  const primary = branches.find((x: any) => x.is_primary) || branches[0]
  const [locations, categories] = await Promise.all([getLocations(), getCategories()])
  const cityRecord = locations.find(x => x.name.toLowerCase() === String(primary?.city || '').toLowerCase())
  const categoryRecord = categories.find(x => x.name.toLowerCase() === String(cats[0] || '').toLowerCase())
  const citySlug = cityRecord?.slug
  const categorySlug = categoryRecord?.slug
  const featured = await getFeaturedSidebarBusinesses({ city: citySlug, category: categorySlug, pagePath: `/business/${slug}`, placement: 'business_profile_sidebar', limit: 4 })

  const phone = primary?.phone || b.phone
  const address = primary?.address_text || b.address_text
  const media = (b.business_media ?? []) as any[]
  const logo = media.find((x: any) => x.media_type === 'logo')
  const cover = media.find((x: any) => x.media_type === 'cover')

  const supabase = await createClient()
  const [{ data: entitlementData },{data:serviceAreaRows}] = await Promise.all([
    supabase.rpc('get_public_business_media_entitlements', { p_business_id: b.id }),
    supabase.from('business_service_areas').select('locations(name,slug)').eq('business_id',b.id)
  ])
  const mediaEntitlements = (entitlementData && typeof entitlementData === 'object' ? entitlementData : {}) as Record<string, any>
  const rawGalleryLimit = Number(mediaEntitlements.max_gallery_images ?? 0)
  const galleryLimit = Number.isFinite(rawGalleryLimit) ? Math.max(0, rawGalleryLimit) : 0
  const menuUpload = Boolean(mediaEntitlements.menu_upload)
  const isPro = String(mediaEntitlements.plan_slug || '') === 'pro'
  const gallery = media.filter((x: any) => x.media_type === 'gallery').slice(0, galleryLimit)
  const uploadedMenu = menuUpload ? media.find((x: any) => x.media_type === 'menu') : null
  const uploadedMenuIsPdf = Boolean(uploadedMenu?.storage_path && String(uploadedMenu.storage_path).toLowerCase().endsWith('.pdf'))
  const menuHref = uploadedMenu?.url || b.menu_url || null
  const serviceAreas=(serviceAreaRows??[]).map((x:any)=>related(x.locations)).filter((x:any)=>x?.name)
  const rawPro = isPro && b.attributes && typeof b.attributes === 'object' ? (b.attributes as any).pro_profile : null
  const proServices = Array.isArray(rawPro?.services) ? rawPro.services.slice(0, 12).filter((x:any)=>String(x?.name||'').trim()) : []
  const proFaqs = Array.isArray(rawPro?.faqs) ? rawPro.faqs.slice(0, 8).filter((x:any)=>String(x?.question||'').trim()&&String(x?.answer||'').trim()) : []
  const proPackages = Array.isArray(rawPro?.packages) ? rawPro.packages.slice(0, 8).filter((x:any)=>String(x?.name||'').trim()) : []
  const socialEntries = isPro && rawPro?.social_links && typeof rawPro.social_links === 'object' ? Object.entries(rawPro.social_links).map(([k,v])=>[k,safeUrl(v)] as const).filter(([,v])=>v) : []
  const rawOffer = isPro && rawPro?.offer && typeof rawPro.offer === 'object' ? rawPro.offer : null
  const today = new Date().toISOString().slice(0,10)
  const offerActive = Boolean(rawOffer?.title && (!rawOffer?.expires_on || String(rawOffer.expires_on) >= today))
  const offerUrl = offerActive ? safeUrl(rawOffer?.cta_url) : ''
  const proAnnouncements = Array.isArray(rawPro?.announcements) ? rawPro.announcements.slice(0,3).filter((x:any)=>String(x?.title||'').trim()&&String(x?.body||'').trim()&&(!x.starts_on||String(x.starts_on)<=today)&&(!x.ends_on||String(x.ends_on)>=today)) : []
  const proHolidayHours = Array.isArray(rawPro?.holiday_hours) ? rawPro.holiday_hours.slice(0,20).filter((x:any)=>String(x?.date||'')>=today).sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date))).slice(0,10) : []
  const rawCta=isPro&&rawPro?.cta&&typeof rawPro.cta==='object'?rawPro.cta:{}
  const primaryCtaUrl=safeUrl(rawCta.primary_url),secondaryCtaUrl=safeUrl(rawCta.secondary_url)
  const socialLabels:Record<string,string>={facebook:'Facebook',instagram:'Instagram',linkedin:'LinkedIn',tiktok:'TikTok',youtube:'YouTube',x:'X / Twitter'}
  const hasRating = Number(b.rating) > 0 && Number(b.review_count) > 0
  const locationQuery=[address,primary?.city,primary?.state,primary?.postal_code].filter(Boolean).join(', ')
  const directionsHref=locationQuery?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`:''
  const locationLabel=primary?.city?`${primary.city}, ${primary.state||'IL'}`:'Central Illinois'
  const hoursLabel=typeof b.hours==='string'&&b.hours.trim()?b.hours:'Confirm current hours with the business'

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: b.name,
    url: b.website || undefined,
    telephone: phone || undefined,
    description: b.description || undefined,
    image: cover?.url || logo?.url || gallery[0]?.url || undefined,
    sameAs: socialEntries.length ? socialEntries.map(([,v])=>v) : undefined,
    areaServed: serviceAreas.length ? serviceAreas.map((x:any)=>x.name) : undefined,
    address: primary ? {
      '@type': 'PostalAddress',
      streetAddress: primary.address_text || undefined,
      addressLocality: primary.city || undefined,
      addressRegion: primary.state || undefined,
      postalCode: primary.postal_code || undefined,
    } : undefined,
  }
  if (hasRating) schema.aggregateRating = { '@type': 'AggregateRating', ratingValue: b.rating, reviewCount: b.review_count }
  const schemaJson = JSON.stringify(schema).replace(/</g, '\\u003c')
  const faqSchema=proFaqs.length?JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:proFaqs.map((x:any)=>({'@type':'Question',name:String(x.question),acceptedAnswer:{'@type':'Answer',text:String(x.answer)}}))}).replace(/</g,'\\u003c'):''
  const growthHref = `/contact?reason=visibility-plan&plan=featured&business=${encodeURIComponent(b.slug)}${primary?.city ? `&city=${encodeURIComponent(primary.city)}` : ''}${cats[0] ? `&category=${encodeURIComponent(cats[0])}` : ''}&source=business-profile#marketing-review`

  return <SiteShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaJson }} />
    {faqSchema&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:faqSchema}}/>}
    <main className="business-profile-page">
      <section className="profile-hero"><div className="container">
        <div className="profile-breadcrumbs"><Link href="/search">Businesses</Link>{citySlug&&<><span>›</span><Link href={`/illinois/${citySlug}`}>{primary?.city}</Link></>}{citySlug&&categorySlug&&<><span>›</span><Link href={`/illinois/${citySlug}/${categorySlug}`}>{cats[0]}</Link></>}<span>›</span><span>{b.name}</span></div>
        <div className="profile-hero-grid">
          <div className="profile-hero-main">
            <div className="badges">{b.verified && <span className="badge verified">Verified</span>}{b.is_sponsored && <span className="badge sponsored">Sponsored</span>}{b.claimed && <span className="badge neutral">Claimed</span>}{isPro && <span className="badge neutral">Pro Profile</span>}</div>
            <div className="profile-identity">{logo && <img className="business-logo" src={logo.url} alt={logo.alt_text || `${b.name} logo`} loading="eager" />}<div><h1 className="profile-title">{b.name}</h1><p className="profile-hero-subtitle">{cats.join(' · ') || 'Local business'}{primary?.city ? ` · ${primary.city}, ${primary.state || 'IL'}` : ''}</p>{hasRating&&<div className="profile-hero-rating"><span><strong>{b.rating}</strong> sourced rating</span><span>{b.review_count} sourced review{Number(b.review_count)===1?'':'s'}</span></div>}</div></div>
            <div className="profile-hero-actions">
              {phone&&<TrackedBusinessLink businessId={b.id} eventType="phone_click" className="btn btn-primary" href={`tel:${phone}`}>Call {b.name}</TrackedBusinessLink>}
              <a className="btn btn-primary" href="#contact-business">Request Information</a>
              {b.ordering_url&&<TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={b.ordering_url} target="_blank" rel="noopener noreferrer">Order Online</TrackedBusinessLink>}
              {b.reservation_url&&<TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={b.reservation_url} target="_blank" rel="noopener noreferrer">Reserve</TrackedBusinessLink>}
              {b.website&&<TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={b.website} target="_blank" rel="noopener noreferrer">Visit Website</TrackedBusinessLink>}
            </div>
          </div>
          <div className="profile-hero-panel" aria-label="Business profile summary"><span className="profile-hero-panel-label">At a glance</span><div className="profile-hero-panel-list">
            <div><span>Category</span><strong>{cats[0]||'Local business'}</strong></div>
            <div><span>Primary location</span><strong>{locationLabel}</strong></div>
            <div><span>Physical locations</span><strong>{branches.length} published location{branches.length===1?'':'s'}</strong></div>
            <div><span>Service areas</span><strong>{serviceAreas.length?`${serviceAreas.length} disclosed separately`:'None published'}</strong></div>
          </div></div>
        </div>
      </div></section>

      <div className="profile-action-ribbon"><div className="container profile-action-ribbon-inner"><div className="profile-action-ribbon-copy"><strong>Choose the action that fits what you need.</strong><span>Business-provided actions and Sponsored placement remain separate from organic directory relevance.</span></div><div className="profile-action-ribbon-links">
        {directionsHref&&<TrackedBusinessLink businessId={b.id} eventType="directions_click" className="btn btn-light" href={directionsHref} target="_blank" rel="noopener noreferrer">Directions</TrackedBusinessLink>}
        {menuHref&&<TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={menuHref} target="_blank" rel="noopener noreferrer">View Menu</TrackedBusinessLink>}
        {primaryCtaUrl&&<TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={primaryCtaUrl} target="_blank" rel="noopener noreferrer">{String(rawCta.primary_label||'Learn More')}</TrackedBusinessLink>}
        {secondaryCtaUrl&&<TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={secondaryCtaUrl} target="_blank" rel="noopener noreferrer">{String(rawCta.secondary_label||'Book Online')}</TrackedBusinessLink>}
      </div></div></div>

      <section className="section profile-main-section"><div className="container profile-grid"><div>
        <div className="card profile-context-card"><div><span>Primary location</span><strong>{address||locationLabel}</strong><small>Physical location information only</small></div><div><span>Hours</span><strong>{hoursLabel}</strong><small>Confirm time-sensitive hours directly</small></div><div><span>Customer contact</span><strong>{phone||'Phone not listed'}</strong><small>{b.website?'Website also available':'Use the request form when available'}</small></div><div><span>Directory trust</span><strong>{b.verified?'Verified status published':b.claimed?'Claimed owner access':'Published directory profile'}</strong><small>{b.is_sponsored?'Sponsored placement is labeled':'Organic relevance is independent of payment'}</small></div></div>

        {cover && <div className="business-cover-card"><img src={cover.url} alt={cover.alt_text || `${b.name} cover image`} loading="eager" />{cover.caption && <p>{cover.caption}</p>}</div>}

        <div className="card profile-section-card" id="about-business" style={{marginTop:cover?18:0}}>
          <div className="section-head compact-head"><div><div className="kpi">Business Profile</div><h2>About {b.name}</h2></div>{categorySlug&&citySlug&&<Link href={`/illinois/${citySlug}/${categorySlug}`}>Compare nearby →</Link>}</div>
          <div className="profile-about-grid"><div><p className="muted">{b.description || 'This profile contains available public listing information for this local business.'}</p><div className="profile-about-actions">{phone&&<TrackedBusinessLink businessId={b.id} eventType="phone_click" className="btn btn-primary" href={`tel:${phone}`}>Call Business</TrackedBusinessLink>}{directionsHref&&<TrackedBusinessLink businessId={b.id} eventType="directions_click" className="btn btn-light" href={directionsHref} target="_blank" rel="noopener noreferrer">Get Directions</TrackedBusinessLink>}{b.website&&<TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={b.website} target="_blank" rel="noopener noreferrer">Website ↗</TrackedBusinessLink>}</div>
            <div className="profile-trust-grid"><div className="profile-trust-item"><strong>Published profile</strong><span>Directory information is shown from reviewed or sourced listing data on file.</span></div>{b.claimed&&<div className="profile-trust-item"><strong>Claimed</strong><span>Reviewed owner access has been connected. Claiming does not automatically create verification.</span></div>}{b.verified&&<div className="profile-trust-item verified"><strong>Verified</strong><span>Verification is a separate approved trust state. Payment alone does not grant this status.</span></div>}{b.is_sponsored&&<div className="profile-trust-item sponsored"><strong>Sponsored</strong><span>This profile has active paid placement that is labeled separately from organic relevance.</span></div>}{isPro&&<div className="profile-trust-item"><strong>Pro Profile</strong><span>Optional enhanced profile tools are active. Pro status does not alter organic rank or verification.</span></div>}</div>
          </div><div className="profile-about-details">{address&&<div className="info-row"><span>Primary address</span><strong>{address}</strong></div>}<div className="info-row"><span>Phone</span><strong>{phone?<TrackedBusinessLink businessId={b.id} eventType="phone_click" href={`tel:${phone}`}>{phone}</TrackedBusinessLink>:'Not listed'}</strong></div><div className="info-row"><span>Website</span><strong>{b.website?<TrackedBusinessLink businessId={b.id} eventType="website_click" href={b.website} target="_blank" rel="noopener noreferrer">Visit website ↗</TrackedBusinessLink>:'Not listed'}</strong></div><div className="info-row"><span>Hours</span><strong>{hoursLabel}</strong></div>{b.price_range&&<div className="info-row"><span>Price range</span><strong>{b.price_range}</strong></div>}{b.reservation_url&&<div className="info-row"><span>Reservations</span><TrackedBusinessLink businessId={b.id} eventType="website_click" href={b.reservation_url} target="_blank" rel="noopener noreferrer">Reserve ↗</TrackedBusinessLink></div>}</div></div>
          {socialEntries.length>0&&<div className="card-actions" style={{marginTop:14}}>{socialEntries.map(([k,v])=><TrackedBusinessLink key={k} businessId={b.id} eventType="website_click" href={v} target="_blank" rel="noopener noreferrer" className="btn btn-light">{socialLabels[k]||k} ↗</TrackedBusinessLink>)}</div>}
          <form action={async () => { 'use server'; await toggleSavedBusiness(b.id) }}><button className="btn btn-light" style={{ marginTop: 14 }}>Save / Unsave Business</button></form>
        </div>

        {proAnnouncements.length>0&&<div className="card profile-section-card" style={{marginTop:18}}><div className="kpi">Business Updates</div><h2>Latest from {b.name}</h2>{proAnnouncements.map((x:any,i:number)=><div className="admin-card" style={{marginTop:10}} key={`${String(x.title)}-${i}`}><div className="badges"><span className="badge sponsored">Announcement</span>{x.ends_on&&<span className="badge neutral">Through {String(x.ends_on)}</span>}</div><h3>{String(x.title)}</h3><p className="muted small">{String(x.body)}</p></div>)}</div>}

        {offerActive && <div className="card profile-section-card" style={{marginTop:18}}><div className="badges"><span className="badge sponsored">Business Offer</span>{rawOffer.expires_on&&<span className="badge neutral">Through {String(rawOffer.expires_on)}</span>}</div><h2>{String(rawOffer.title)}</h2>{rawOffer.code&&<p><strong>Promo code: {String(rawOffer.code)}</strong></p>}{rawOffer.details&&<p className="muted">{String(rawOffer.details)}</p>}{offerUrl&&<TrackedBusinessLink businessId={b.id} eventType="website_click" href={offerUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">{String(rawOffer.cta_label||'Learn More')} ↗</TrackedBusinessLink>}<p className="small muted" style={{marginTop:10}}>Offer details are supplied by the business and may change. Confirm eligibility, availability and final terms directly with the business.</p></div>}

        {proServices.length>0&&<div className="card profile-section-card" id="services" style={{marginTop:18}}><div className="section-head compact-head"><div><div className="kpi">Services</div><h2>What {b.name} Offers</h2></div><span className="badge neutral">{proServices.length}</span></div><div className="grid grid-2">{proServices.map((x:any,i:number)=><div className="admin-card" key={`${String(x.name)}-${i}`}><h3>{String(x.name)}</h3>{x.description&&<p className="muted small">{String(x.description)}</p>}</div>)}</div></div>}

        {proPackages.length>0&&<div className="card profile-section-card" style={{marginTop:18}}><div className="section-head compact-head"><div><div className="kpi">Packages & Offers</div><h2>Ways to Work With {b.name}</h2></div><span className="badge neutral">{proPackages.length}</span></div><div className="grid grid-2">{proPackages.map((x:any,i:number)=>{const u=safeUrl(x.cta_url);return <div className="admin-card" key={`${String(x.name)}-${i}`}><h3>{String(x.name)}</h3>{x.price_label&&<p><strong>{String(x.price_label)}</strong></p>}{x.description&&<p className="muted small">{String(x.description)}</p>}{u&&<TrackedBusinessLink businessId={b.id} eventType="website_click" href={u} target="_blank" rel="noopener noreferrer" className="btn btn-light">{String(x.cta_label||'Learn More')} ↗</TrackedBusinessLink>}</div>})}</div><p className="small muted" style={{marginTop:12}}>Package descriptions and price language are supplied by the business. Confirm current scope, availability and final pricing directly with the business.</p></div>}

        {uploadedMenu && <div className="card profile-section-card" id="menu" style={{ marginTop: 18 }}>
          <div className="section-head compact-head"><div><div className="kpi">Restaurant Menu</div><h2>Current Menu</h2></div><span className="badge sponsored">Business provided</span></div>
          {uploadedMenuIsPdf
            ? <TrackedBusinessLink businessId={b.id} eventType="website_click" href={uploadedMenu.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Menu PDF ↗</TrackedBusinessLink>
            : <figure style={{ margin: 0 }}><img src={uploadedMenu.url} alt={uploadedMenu.alt_text || `${b.name} menu`} style={{ width: '100%', height: 'auto', borderRadius: 14 }} loading="lazy" />{uploadedMenu.caption && <figcaption className="small muted" style={{ marginTop: 8 }}>{uploadedMenu.caption}</figcaption>}</figure>}
          <p className="small muted" style={{ marginTop: 12 }}>Menu details, availability and pricing are supplied by the business and may change. Confirm current information directly with the restaurant.</p>
          {b.menu_url && b.menu_url !== uploadedMenu.url && <TrackedBusinessLink businessId={b.id} eventType="website_click" href={b.menu_url} target="_blank" rel="noopener noreferrer" className="btn btn-light">Official Menu Link ↗</TrackedBusinessLink>}
        </div>}

        {gallery.length > 0 && <div className="card profile-section-card" id="photos" style={{ marginTop: 18 }}>
          <div className="section-head compact-head"><div><div className="kpi">Business Showcase</div><h2>Photos</h2><p className="muted small">Business imagery available on this profile.</p></div><span className="badge neutral">{gallery.length}</span></div>
          <div className="business-gallery profile-gallery-premium">{gallery.map((m: any) => <figure key={m.id}><img src={m.url} alt={m.alt_text || `${b.name} business photo`} loading="lazy" />{m.caption && <figcaption>{m.caption}</figcaption>}</figure>)}</div>
        </div>}

        {proFaqs.length>0&&<div className="card profile-section-card" style={{marginTop:18}}><div className="kpi">Frequently Asked Questions</div><h2>Questions About {b.name}</h2>{proFaqs.map((x:any,i:number)=><details key={`${String(x.question)}-${i}`} className="admin-card" style={{marginTop:10}}><summary><strong>{String(x.question)}</strong></summary><p className="muted small">{String(x.answer)}</p></details>)}<p className="small muted" style={{marginTop:12}}>These answers are supplied by the business. Contact the business to confirm details for your specific needs.</p></div>}

        {proHolidayHours.length>0&&<div className="card profile-section-card" style={{marginTop:18}}><div className="kpi">Special Hours</div><h2>Upcoming Holiday / Date-Specific Hours</h2>{proHolidayHours.map((x:any)=><div className="info-row" key={`${String(x.date)}-${String(x.label||'')}`}><span>{String(x.label||x.date)} · {String(x.date)}</span><strong>{x.closed?'Closed':String(x.hours||'Special hours')}</strong></div>)}<p className="small muted">Special hours are supplied by the business. Confirm current hours before making a time-sensitive trip.</p></div>}

        <div className="card profile-section-card" id="locations" style={{ marginTop: 18 }}>
          <div className="section-head compact-head"><div><div className="kpi">Branches</div><h2>Physical Locations</h2></div><span className="badge neutral">{branches.length} location{branches.length === 1 ? '' : 's'}</span></div>
          {branches.length ? <div className="location-list">{branches.map((x: any) => {const branchQuery=[x.address_text,x.city,x.state,x.postal_code].filter(Boolean).join(', '),branchDirections=branchQuery?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branchQuery)}`:'';return <div className="location-card" key={x.id}><strong>{x.label || x.city || x.location_type || 'Location'}</strong><p>{[x.address_text, x.city, x.state, x.postal_code].filter(Boolean).join(', ')}</p><div className="profile-location-actions">{x.phone && <TrackedBusinessLink businessId={b.id} eventType="phone_click" className="btn btn-light" href={`tel:${x.phone}`}>Call {x.phone}</TrackedBusinessLink>}{branchDirections&&<TrackedBusinessLink businessId={b.id} eventType="directions_click" className="btn btn-light" href={branchDirections} target="_blank" rel="noopener noreferrer">Directions</TrackedBusinessLink>}{x.is_primary && <span className="badge neutral">Primary</span>}</div></div>})}</div> : <p className="muted">No branch details are published.</p>}
          <p className="small muted">Service areas are kept separate from physical locations so serving a city is not presented as having an office there.</p>
        </div>

        {serviceAreas.length>0&&<div className="card profile-section-card" style={{marginTop:18}}><div className="section-head compact-head"><div><div className="kpi">Areas Served</div><h2>Service Areas</h2></div><span className="badge neutral">{serviceAreas.length}</span></div><div className="badges">{serviceAreas.map((x:any)=><span className="badge neutral" key={x.slug||x.name}>{x.name}</span>)}</div><p className="small muted" style={{marginTop:12}}>These are areas the business reports serving. A service area is not represented as a physical office or storefront.</p></div>}

        <div className="card profile-section-card profile-transparency" style={{ marginTop: 18 }}><div className="kpi">Directory Transparency</div><h2>Listing Information & Trust Signals</h2><p className="small muted">Public listing signals are intentionally kept separate so customers can understand what each one means.</p><div className="profile-transparency-list"><div><strong>Source on file</strong><span>{b.source_name || 'Directory listing source on file'}{b.source_url && <> · <a href={b.source_url} target="_blank" rel="noopener noreferrer">View source ↗</a></>}</span></div><div><strong>Rating display</strong><span>{hasRating?<><b>{b.rating}</b> from {b.review_count} sourced review{Number(b.review_count)===1?'':'s'}.</>:'No independently sourced rating/review block is displayed for this listing.'}</span></div><div><strong>Claim status</strong><span>{b.claimed?'This listing has reviewed owner access connected.':'No public claimed-owner state is displayed.'} Claiming does not automatically create verification.</span></div><div><strong>Verification</strong><span>{b.verified?'Verified status is currently published for this listing.':'No verified badge is currently displayed.'} Payment alone does not grant verification.</span></div><div><strong>Sponsored placement</strong><span>{b.is_sponsored?'This business currently has active paid directory placement, shown with a Sponsored label.':'No active Sponsored label is displayed on this profile.'} Sponsorship does not replace organic relevance.</span></div></div></div>
        <div className="card profile-section-card" style={{ marginTop: 18 }}><h2>Report or Suggest an Edit</h2><p className="small muted">Help keep the directory accurate. Submitted changes are reviewed before protected listing data is updated.</p><ListingReportForm businessId={b.id} /></div>
      </div>

      <aside><div className="profile-sidebar-stack">
        <div id="contact-business" className="card sticky-card profile-contact-card"><div className="kpi">Direct Connection</div><h2>Contact {b.name}</h2><p className="small muted">Send a request connected to this specific business profile. Organic listing relevance is not affected by paid placement.</p><div className="request-assurance"><span>Direct business request</span><span>Consent required</span><span>No ranking effect</span></div><div className="request-next-step"><strong>What happens next?</strong><span>Your request stays associated with this business through the directory workflow. The business may contact you about this request using the details you provide.</span></div><LeadForm businessId={b.id} service={cats[0] || ''} city={primary?.city || ''} /></div>
        {!b.claimed && <div id="claim-business" className="card profile-claim-card"><h3>Is this your business?</h3><p className="muted small">Claiming establishes owner access after staff review. It does not automatically create a verified badge, and claiming does not require a paid plan.</p><div className="claim-next-steps"><div><b>1</b><span><strong>Submit</strong><small>Provide ownership details.</small></span></div><div><b>2</b><span><strong>Review</strong><small>Staff reviews the claim.</small></span></div><div><b>3</b><span><strong>Manage</strong><small>Approved owners get portal access.</small></span></div></div><ClaimForm businessId={b.id} /></div>}
        <FeaturedBusinessSidebar businesses={featured as any[]} contextLabel={primary?.city && cats[0] ? `${cats[0]} in ${primary.city}` : primary?.city || cats[0] || 'local businesses'} />
        <div className="card profile-owner-card"><div className="kpi">For Business Owners</div><h3>Show customers more of your business.</h3><p className="muted small">Featured includes up to 5 showcase photos and optional Lead Inbox access. Pro includes up to 10 showcase photos, Lead Inbox, service packages, announcements, FAQs, custom CTAs, holiday hours, service-area controls and advanced reporting. Restaurant listings on Featured or Pro can also publish a moderated menu file.</p><p className="small muted"><strong>Important:</strong> paid tools never buy verification or organic rank.</p><GrowthTrackedLink eventType="business_visibility_click" businessId={b.id} city={primary?.city || undefined} category={cats[0] || undefined} plan="featured" source="business-profile" href={growthHref} className="btn btn-light full">Explore Visibility Options</GrowthTrackedLink></div>
      </div></aside>
      </div></section>

      <div className={`profile-mobile-actions${phone?'':' two-actions'}`} aria-label="Quick business actions">{phone&&<TrackedBusinessLink businessId={b.id} eventType="phone_click" className="btn btn-primary" href={`tel:${phone}`}>Call</TrackedBusinessLink>}<a className="btn btn-primary" href="#contact-business">Request Info</a>{b.website?<TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={b.website} target="_blank" rel="noopener noreferrer">Website</TrackedBusinessLink>:directionsHref?<TrackedBusinessLink businessId={b.id} eventType="directions_click" className="btn btn-light" href={directionsHref} target="_blank" rel="noopener noreferrer">Directions</TrackedBusinessLink>:null}</div>
    </main>
  </SiteShell>
}
