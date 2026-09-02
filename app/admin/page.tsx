import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const quick=[
  ['/admin/businesses','Business Listings','Edit public profiles, status, verification and source information.'],
  ['/admin/locations','Cities & Markets','Add or edit cities, towns, counties and market hierarchy.'],
  ['/admin/categories','Categories','Manage discovery and SEO categories across all four verticals.'],
  ['/admin/prospects','Skylight Sales CRM','Filter prospects by city, town, market, vertical, stage and priority.'],
  ['/admin/leads','Skylight Lead Marketplace','Review, qualify, price and offer eligible home-service leads while protecting consumer details until delivery.'],
  ['/admin/marketing','Marketing Control Center','Create, save, reuse, schedule and export branded public marketing with QR and Canva-ready workflows.'],
  ['/admin/pricing','Pricing & Plans','Edit plan pricing and customer-facing package details.'],
  ['/admin/revenue','Revenue Operations','Track paid plans, billing health and homepage Featured sponsorships.'],
  ['/admin/site-builder','Brand & Site Content','Manage Skylight branding, public messaging and site settings.'],
  ['/admin/navigation','Navigation','Edit public menus and footer navigation without code changes.'],
  ['/admin/guides','Local Guides','Create, edit and publish practical local content.'],
  ['/admin/claims','Claims Queue','Review business-owner claims before granting access.'],
] as const

export default async function Page(){
  const s=await createClient()
  const today=new Date().toISOString().slice(0,10)
  const results=await Promise.all([
    s.from('businesses').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('status','published'),
    s.from('business_claims').select('*',{count:'exact',head:true}).eq('status','pending'),
    s.from('leads').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('status','new'),
    s.from('business_edit_requests').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('status','pending'),
    s.from('subscriptions').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).in('status',['active','trialing']),
    s.from('sponsorships').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('placement','homepage_featured').eq('active',true).or(`starts_on.is.null,starts_on.lte.${today}`).or(`ends_on.is.null,ends_on.gte.${today}`),
  ])

  return <>
    <div className="admin-page-head">
      <div><div className="kpi">Private Skylight Operations</div><h1>Staff / Admin Dashboard</h1><p className="muted">Operate Central Illinois Local Pros from one control plane. Public customers never see SEO diagnostics, security lint results, CRM scores, outreach data, private lead data or deployment status.</p></div>
      <span className="badge neutral">V15.5</span>
    </div>
    <div className="stat-grid">
      <div className="stat">Published Businesses<strong>{results[0].count??0}</strong></div>
      <div className="stat">Pending Claims<strong>{results[1].count??0}</strong></div>
      <div className="stat">New Leads<strong>{results[2].count??0}</strong></div>
      <div className="stat">Pending Edits<strong>{results[3].count??0}</strong></div>
      <div className="stat">Active Subscriptions<strong>{results[4].count??0}</strong></div>
      <div className="stat">Homepage Featured<strong>{results[5].count??0}</strong></div>
    </div>
    <div className="admin-card" style={{marginTop:18}}><div className="kpi">V15.5 Canonical System</div><h2>Everything important should be operable here</h2><p className="muted">Public content, branding, navigation, plans, listings, categories, markets, guides, CRM workflows, lead revenue operations and public marketing assets are managed from protected admin tools.</p></div>
    <div className="section-head admin-quick-head"><div><h2>Common Admin Actions</h2><p className="muted">Jump directly to the areas used most often.</p></div></div>
    <div className="grid grid-4 admin-quick-grid">{quick.map(([href,title,desc])=><Link className="admin-card admin-quick-card" href={href} key={href}><strong>{title}</strong><p className="small muted">{desc}</p><span className="kpi">Open →</span></Link>)}</div>
  </>
}
