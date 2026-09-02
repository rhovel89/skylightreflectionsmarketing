import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireAdmin } from '@/lib/auth'

export const dynamic='force-dynamic'
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format((cents||0)/100)
function related(value:any){return Array.isArray(value)?value[0]:value}

export default async function Page(){
  await requireAdmin('/admin/revenue-stack')
  const s=await createClient()
  const [subsQ,sponsorsQ,offersQ,inventoryQ,marketingQ,wonMarketingQ]=await Promise.all([
    s.from('subscriptions').select('id,status,billing_interval,plans(monthly_price_cents,annual_price_cents)').eq('tenant_id',TENANT_ID).in('status',['active','trialing']),
    s.from('sponsorships').select('id,active,placement').eq('tenant_id',TENANT_ID).eq('active',true),
    s.from('lead_marketplace_offers').select('id,business_id,price_cents,status').eq('tenant_id',TENANT_ID).limit(1000),
    s.from('lead_marketplace_inventory').select('lead_id,marketplace_status,review_status').eq('tenant_id',TENANT_ID).limit(1000),
    s.from('marketing_leads').select('id,status,service_interest,created_at').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(500),
    s.from('business_prospects').select('id,crm_stage').eq('tenant_id',TENANT_ID).eq('crm_stage','won_marketing').limit(500),
  ])
  const subs=(subsQ.data??[]) as any[],sponsors=(sponsorsQ.data??[]) as any[],offers=(offersQ.data??[]) as any[],inventory=(inventoryQ.data??[]) as any[],marketing=(marketingQ.data??[]) as any[]
  const recurring=subs.reduce((sum,row)=>{const p=related(row.plans)||{};return sum+(row.billing_interval==='annual'?Math.round(Number(p.annual_price_cents||0)/12):Number(p.monthly_price_cents||0))},0)
  const delivered=offers.filter(x=>x.status==='delivered'),leadRevenue=delivered.reduce((sum,x)=>sum+Number(x.price_cents||0),0),openOffers=offers.filter(x=>['offered','reserved','checkout_pending'].includes(x.status)).length,available=inventory.filter(x=>x.review_status==='qualified'&&x.marketplace_status==='available').length
  const marketingOpen=marketing.filter(x=>!['closed','won','lost','do_not_contact'].includes(String(x.status||'').toLowerCase())).length
  const channels=[
    {title:'Directory Subscriptions',metric:`${subs.length} active`,sub:`${money(recurring)} monthly-equivalent recurring revenue`,href:'/admin/revenue',cta:'Open Revenue Operations',body:'Free, Verified, Featured and Pro remain the recurring directory plan ladder. Payment never grants verification automatically or changes organic relevance.'},
    {title:'Featured Advertising',metric:`${sponsors.length} active placements`,sub:'Homepage, sidebar, city, category and other clearly labeled Sponsored inventory',href:'/admin/sponsorships',cta:'Manage Sponsored Inventory',body:'Sell additional visibility separately from organic ranking. Super Admin retains editorial control over inventory and visibility.'},
    {title:'Home-Service Lead Sales',metric:`${money(leadRevenue)} realized`,sub:`${available} available leads · ${openOffers} open offers · ${delivered.length} delivered`,href:'/admin/leads',cta:'Open Lead Marketplace',body:'Qualify consumer demand first, then offer eligible home-service leads at a one-time price. Consumer details remain private until legitimate delivery.'},
    {title:'Skylight Marketing Services',metric:`${marketingOpen} open inquiries`,sub:`${wonMarketingQ.data?.length??0} CRM prospects marked won marketing`,href:'/admin/marketing-leads',cta:'Open Skylight Leads',body:'Upsell websites, SEO, Google Business Profile, social media, branding and lead generation as a separate Skylight Reflections Marketing service relationship.'},
  ]
  return <>
    <div className="admin-page-head"><div><div className="kpi">Skylight Monetization</div><h1>Revenue Stack</h1><p className="muted">Operate four complementary revenue channels without mixing payment with organic ranking, verification or editorial trust.</p></div><span className="badge sponsored">Admin only</span></div>
    <div className="grid grid-2">{channels.map(c=><div className="admin-card" key={c.title}><div className="kpi">Revenue Channel</div><h2>{c.title}</h2><strong style={{fontSize:'1.35rem'}}>{c.metric}</strong><p className="small muted">{c.sub}</p><p className="muted">{c.body}</p><Link className="btn btn-primary" href={c.href}>{c.cta}</Link></div>)}</div>
    <div className="admin-card" style={{marginTop:18}}><div className="kpi">Cross-sell model</div><h2>One business can use more than one channel.</h2><p className="muted">A business can keep a free or paid directory profile, purchase clearly labeled Featured visibility, buy qualified home-service leads when eligible, and separately hire Skylight Reflections Marketing for broader digital marketing. Each purchase is tracked independently so one product never silently changes another.</p><div className="card-actions"><Link className="btn btn-light" href="/admin/prospects">Skylight Sales CRM</Link><Link className="btn btn-light" href="/admin/marketing">Marketing Control Center</Link><Link className="btn btn-light" href="/for-businesses">View Public Business Page</Link></div></div>
    <div className="notice" style={{marginTop:18}}><strong>Category rule:</strong> per-lead sales are enabled by default for Home Services. Legal uses flat advertising/compliance review rather than automatic pay-per-lead. Restaurant and retail lead sales remain disabled unless a specific high-intent category is intentionally approved later.</div>
  </>
}
