import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const journeys=[
  {eyebrow:'Directory',title:'Manage businesses',description:'Listings, approvals, claims, verification and media.',href:'/admin/businesses',cta:'Open Businesses'},
  {eyebrow:'Skylight Sales',title:'Find & win clients',description:'Prospect research, opportunities, outreach and conversions.',href:'/admin/skylight-sales',cta:'Open Sales'},
  {eyebrow:'Client Delivery',title:'Do client work',description:'Proposals, projects, intake, invoices and results.',href:'/admin/skylight-operations',cta:'Open Client Work'},
  {eyebrow:'Revenue',title:'Manage money',description:'Revenue, pricing, subscriptions, lead buyers and Sponsored.',href:'/admin/revenue-stack',cta:'Open Money'},
  {eyebrow:'Organic Growth',title:'Grow traffic & coverage',description:'SEO, markets, content, search demand and inventory growth.',href:'/admin/seo',cta:'Open Growth & SEO'},
  {eyebrow:'Public Site',title:'Manage the website',description:'Brand content, navigation, replication and launch tools.',href:'/admin/site-builder',cta:'Open Website'},
] as const

export default async function Page(){
  const s=await createClient()
  const now=new Date(),today=now.toISOString().slice(0,10),weekAgo=new Date(now.getTime()-7*86400000).toISOString()
  const q=await Promise.all([
    s.from('businesses').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('status','published'),
    s.from('business_claims').select('id,businesses!inner(id,tenant_id)',{count:'exact',head:true}).eq('businesses.tenant_id',TENANT_ID).eq('status','pending'),
    s.from('leads').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('status','new').neq('source','estate_legacy_pro_nationwide'),
    s.from('business_edit_requests').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('status','pending'),
    s.from('subscriptions').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).in('status',['active','trialing']),
    s.from('sponsorships').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('placement','homepage_featured').eq('active',true).or(`starts_on.is.null,starts_on.lte.${today}`).or(`ends_on.is.null,ends_on.gte.${today}`),
    s.from('estate_planning_lead_sales').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('follow_up_status','new'),
    s.from('skylight_proposals').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).in('status',['draft','sent','viewed','accepted']),
    s.from('skylight_invoices').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).gt('balance_due_cents',0),
    s.from('business_visibility_alerts').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('status','open'),
    s.from('leads').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('source','estate_legacy_pro_nationwide').gte('created_at',weekAgo),
    s.from('businesses').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).gte('created_at',weekAgo),
    s.from('skylight_proposals').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).gte('created_at',weekAgo),
  ])
  const count=(i:number)=>q[i].count??0
  const estateNew=count(6),consumerNew=count(2),claims=count(1),edits=count(3),invoiceAttention=count(8),visibilityAlerts=count(9)
  const priorityTotal=estateNew+consumerNew+claims+edits+invoiceAttention+visibilityAlerts
  const quick=[
    {href:'/admin/estate-planning-leads',icon:'⚖',label:'Estate Planning Leads',hint:estateNew?`${estateNew} new inquiry${estateNew===1?'':'ies'} to work`:'Open nationwide lead desk',hot:estateNew>0},
    {href:'/admin/leads',icon:'◎',label:'Consumer Leads',hint:consumerNew?`${consumerNew} new Local Pros lead${consumerNew===1?'':'s'}`:'Review lead requests',hot:consumerNew>0},
    {href:'/admin/businesses#add-business',icon:'＋',label:'Add Business',hint:'Create or edit a directory listing'},
    {href:'/admin/acquisition-research',icon:'⌕',label:'Research Prospect',hint:'Find a potential Skylight client'},
    {href:'/admin/skylight-operations?tab=new',icon:'◇',label:'Create Proposal',hint:'Build a client proposal'},
    {href:'/admin/seo',icon:'↗',label:'SEO & Visibility',hint:'Audit rankings and search opportunity'},
    {href:'/admin/revenue-stack',icon:'$',label:'Money & Revenue',hint:'Pricing, billing and monetization'},
  ]
  const attention=[
    {href:'/admin/estate-planning-leads',label:'Estate planning leads',count:estateNew,action:'Contact & qualify'},
    {href:'/admin/leads',label:'Other new leads',count:consumerNew,action:'Review leads'},
    {href:'/admin/claims',label:'Pending claims',count:claims,action:'Review claims'},
    {href:'/admin/skylight-invoices',label:'Invoices with balance',count:invoiceAttention,action:'Review invoices'},
    {href:'/admin/businesses',label:'Visibility alerts',count:visibilityAlerts,action:'Review business visibility'},
  ]

  return <>
    <section className="admin-owner-hero admin-command-hero"><div><div className="kpi">Owner Home · Today</div><h1>{priorityTotal>0?`${priorityTotal} thing${priorityTotal===1?'':'s'} need your attention.`:'You are caught up.'}</h1><p>This is your daily starting point. Work the important items here first, then open a deeper workspace only when you need it.</p></div><div className="admin-owner-mode"><strong>Owner-first by design</strong><span>No staff required. Advanced team tools stay preserved under <b>All Tools</b> for later.</span></div></section>

    <div className="admin-section-title"><div><div className="kpi">Most Used</div><h2>What do you want to do?</h2></div><p>Seven direct actions. No hunting through the system first.</p></div>
    <div className="admin-command-actions">{quick.map(item=><Link className={`admin-command-action ${item.hot?'hot':''}`} href={item.href} key={item.href}><span className="admin-command-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span><b>→</b></Link>)}</div>

    <div className="admin-section-title admin-section-title-spaced"><div><div className="kpi">Needs Attention</div><h2>Work these next</h2></div><p>Live owner queues. Zero means there is nothing waiting in that queue.</p></div>
    <div className="admin-attention-grid admin-attention-grid-five">{attention.map(item=><Link className={`admin-attention-card ${item.count>0?'has-work':''}`} href={item.href} key={item.href}><span>{item.label}</span><strong>{item.count}</strong><small>{item.count>0?item.action:'Nothing waiting'}</small></Link>)}</div>

    <div className="admin-section-title admin-section-title-spaced"><div><div className="kpi">What Changed</div><h2>Last 7 days</h2></div><p>Simple movement indicators, not another analytics dashboard.</p></div>
    <div className="admin-dashboard-snapshot"><Link href="/admin/estate-planning-leads"><span>Estate planning inquiries</span><strong>+{count(10)}</strong></Link><Link href="/admin/businesses"><span>Business records added</span><strong>+{count(11)}</strong></Link><Link href="/admin/skylight-operations?tab=proposals"><span>Proposals created</span><strong>+{count(12)}</strong></Link></div>

    <div className="admin-section-title admin-section-title-spaced"><div><div className="kpi">Workspaces</div><h2>Go deeper when you need to</h2></div><p>Every existing feature is still available. These six workspaces organize the rest of the system.</p></div>
    <div className="admin-journey-grid">{journeys.map(j=><section className="admin-journey-card" key={j.title}><div className="admin-journey-head"><span>{j.eyebrow}</span><h3>{j.title}</h3><p>{j.description}</p></div><Link className="admin-journey-primary" href={j.href}>{j.cta}<b>→</b></Link></section>)}</div>

    <div className="admin-section-title admin-section-title-spaced"><div><div className="kpi">At A Glance</div><h2>System snapshot</h2></div></div>
    <div className="admin-dashboard-snapshot"><Link href="/admin/businesses"><span>Published businesses</span><strong>{count(0)}</strong></Link><Link href="/admin/subscriptions"><span>Active subscriptions</span><strong>{count(4)}</strong></Link><Link href="/admin/sponsorships"><span>Homepage featured</span><strong>{count(5)}</strong></Link></div>

    <div className="admin-all-tools-note"><div><strong>Nothing was removed.</strong><span>Every advanced option, report, queue and management screen remains available from <b>All Tools</b> or admin search.</span></div><Link href="/admin/launch-readiness">System & launch tools →</Link></div>
  </>
}
