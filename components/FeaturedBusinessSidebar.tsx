import Link from 'next/link'
import { GrowthTrackedLink } from '@/components/GrowthTracking'

type FeaturedBusiness = {
  id:string
  slug:string
  name:string
  abbr?:string|null
  phone?:string|null
  website?:string|null
  description?:string|null
  logo_url?:string|null
  sponsored_category?:string|null
  sponsored_city?:string|null
  sponsorship_placement?:string|null
}

export function FeaturedBusinessSidebar({businesses,contextLabel='this page'}:{businesses:FeaturedBusiness[];contextLabel?:string}){
  return <aside className="featured-business-sidebar" aria-label="Sponsored local businesses">
    <div className="featured-sidebar-head">
      <div><div className="kpi">Paid local visibility</div><h2>Featured Businesses</h2></div>
      <Link className="small" href="/advertising-disclosure">Ad disclosure</Link>
    </div>
    {businesses.length>0?<div className="featured-sidebar-list">{businesses.map(b=><article className="featured-sidebar-card" key={b.id}>
      <div className="featured-sidebar-top"><div className="business-icon featured-icon">{b.logo_url?<img src={b.logo_url} alt={`${b.name} logo`} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:12}}/>:b.abbr||b.name.slice(0,2).toUpperCase()}</div><span className="badge sponsored">Sponsored</span></div>
      <h3><Link href={`/business/${b.slug}`}>{b.name}</Link></h3>
      {(b.sponsored_category||b.sponsored_city)&&<p className="small muted">{[b.sponsored_category,b.sponsored_city].filter(Boolean).join(' · ')}</p>}
      <p className="small muted">{b.description||'Explore this featured local business profile for current listing and contact information.'}</p>
      <div className="featured-sidebar-actions"><Link className="btn btn-primary btn-small" href={`/business/${b.slug}`}>View Business</Link>{b.phone&&<a className="btn btn-light btn-small" href={`tel:${b.phone}`}>Call</a>}{b.website&&<a className="btn btn-light btn-small" href={b.website} target="_blank" rel="noopener noreferrer">Website</a>}</div>
    </article>)}</div>:<div className="featured-sidebar-card featured-sidebar-sales"><span className="badge sponsored">Advertising</span><h3>Feature your business here</h3><p className="small muted">Reach people already browsing {contextLabel}. Paid placement is clearly labeled and never changes organic rankings or verification.</p><GrowthTrackedLink eventType="visibility_plan_click" plan="featured" source="featured-sidebar" href="/contact?reason=visibility-plan&plan=featured&source=featured-sidebar#marketing-review" className="btn btn-light full">Ask About Featured Placement</GrowthTrackedLink></div>}
  </aside>
}
