import Link from 'next/link'
import type { Business } from '@/lib/types'
import { TrackedBusinessLink } from '@/components/TrackedBusinessLink'

type MatchedLocation={address_text?:string|null;city?:string|null;state?:string|null;postal_code?:string|null;phone?:string|null}
type PublicBusiness=Business&{matched_location?:MatchedLocation;matched_service_area?:boolean;is_sponsored?:boolean;logo_url?:string|null}

export function BusinessCard({business,claimMode=false}:{business:Business;claimMode?:boolean}){
  const b=business as PublicBusiness
  const matched=b.matched_location
  const serviceAreaOnly=Boolean(b.matched_service_area&&!matched)
  const address=matched?.address_text||(serviceAreaOnly?null:b.address_text)
  const phone=matched?.phone||b.phone
  const rating=Number((b as any).rating||0)
  const reviewCount=Number((b as any).review_count||0)
  const profileHref=`/business/${b.slug}${claimMode&&!b.claimed?'#claim-listing':''}`
  const profileLabel=claimMode&&!b.claimed?'Open & Claim':'View Full Profile'
  const locationLabel=serviceAreaOnly?'Serves this market':address||matched?.city||'Local business profile'
  return <article className={`business-card public-business-card${claimMode?' claim-mode-card':''}`}>
    <div className="business-icon">{b.logo_url?<img src={b.logo_url} alt={`${b.name} logo`} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:12}}/>:b.abbr||b.name.slice(0,2).toUpperCase()}</div>
    <div className="business-main">
      <div className="business-card-topline"><div className="badges">{b.verified&&<span className="badge verified">Verified</span>}{b.is_sponsored&&<span className="badge sponsored">Sponsored</span>}{b.claimed&&<span className="badge neutral">Claimed</span>}{serviceAreaOnly&&<span className="badge neutral">Service Area</span>}</div>{b.price_range&&<span className="business-price-range">{b.price_range}</span>}</div>
      <h3><Link href={profileHref}>{b.name}</Link></h3>
      <div className="business-card-facts" aria-label={`${b.name} listing facts`}>
        <div><span>Location</span><strong>{locationLabel}</strong>{serviceAreaOnly&&<small>Service area only — not a local office</small>}</div>
        <div><span>Reviews</span><strong>{rating>0&&reviewCount>0?`${rating.toFixed(1)} · ${reviewCount} sourced`:'No sourced rating shown'}</strong></div>
        <div><span>Contact</span><strong>{phone&&b.website?'Phone + website':phone?'Phone available':b.website?'Website available':'Profile details only'}</strong></div>
      </div>
      <p className="muted business-summary">{b.description||'View this local business profile for current contact details, services and listing information.'}</p>
      {claimMode&&<div className={`claim-card-note ${b.claimed?'already-claimed':''}`}>{b.claimed?'This listing already has a reviewed owner connection.':'Own or manage this business? Open the profile and submit the free claim form for staff review.'}</div>}
      <div className="card-actions business-card-actions">
        <Link className="btn btn-primary" href={profileHref}>{profileLabel}</Link>
        {phone&&<TrackedBusinessLink businessId={b.id} eventType="phone_click" className="btn btn-light" href={`tel:${phone}`}>Call</TrackedBusinessLink>}
        {b.website&&<TrackedBusinessLink businessId={b.id} eventType="website_click" className="btn btn-light" href={b.website} target="_blank" rel="noopener noreferrer">Website</TrackedBusinessLink>}
      </div>
      <div className="business-card-trust"><span>{b.verified?'Verified is a reviewed trust state.':b.claimed?'Claimed ownership is reviewed separately from verification.':'Published directory profile.'}</span>{b.is_sponsored&&<span>Sponsored placement is labeled and does not control organic order.</span>}</div>
    </div>
  </article>
}
