import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const journeys = [
  {
    eyebrow: 'Directory',
    title: 'Manage businesses',
    description: 'Edit listings, review submissions, claims, verification and business media.',
    href: '/admin/businesses',
    cta: 'Open Businesses',
    links: [
      ['/admin/submissions', 'Approval Queue'],
      ['/admin/claims', 'Ownership Claims'],
      ['/admin/business-media', 'Media & Menus'],
    ],
  },
  {
    eyebrow: 'Skylight Sales',
    title: 'Find & win clients',
    description: 'Research prospects, work opportunities, review outreach and move qualified businesses forward.',
    href: '/admin/skylight-sales',
    cta: 'Open Sales',
    links: [
      ['/admin/acquisition-research', 'Research'],
      ['/admin/prospects', 'CRM'],
      ['/admin/outreach', 'Outreach'],
    ],
  },
  {
    eyebrow: 'Client Delivery',
    title: 'Do client work',
    description: 'Manage proposals, projects, intake, visibility work and service delivery from one path.',
    href: '/admin/skylight-operations',
    cta: 'Open Client Work',
    links: [
      ['/admin/skylight-intake', 'Client Intake'],
      ['/admin/skylight-invoices', 'Invoices'],
      ['/admin/skylight-services', 'Services'],
    ],
  },
  {
    eyebrow: 'Revenue',
    title: 'Manage money & pricing',
    description: 'See monetization, edit pricing, manage invoices, lead buyers, subscriptions and Sponsored placement.',
    href: '/admin/revenue-stack',
    cta: 'Open Money',
    links: [
      ['/admin/pricing', 'Plans & Pricing'],
      ['/admin/revenue', 'Revenue Ops'],
      ['/admin/lead-buyers', 'Lead Buyers'],
    ],
  },
  {
    eyebrow: 'Organic Growth',
    title: 'Grow traffic & coverage',
    description: 'Work SEO, markets, categories, content, inventory expansion and search-demand opportunities.',
    href: '/admin/seo',
    cta: 'Open Growth & SEO',
    links: [
      ['/admin/locations', 'Markets'],
      ['/admin/content-intelligence', 'Content Intelligence'],
      ['/admin/inventory-expansion', 'Inventory Expansion'],
    ],
  },
  {
    eyebrow: 'Public Site',
    title: 'Manage the website',
    description: 'Edit brand content, navigation, Local Pros replication and launch readiness without touching code.',
    href: '/admin/site-builder',
    cta: 'Open Website',
    links: [
      ['/admin/navigation', 'Navigation'],
      ['/admin/network-expansion', 'Replication'],
      ['/admin/launch-readiness', 'Launch Readiness'],
    ],
  },
] as const

export default async function Page() {
  const s = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const results = await Promise.all([
    s.from('businesses').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'published'),
    s.from('business_claims').select('id,businesses!inner(id,tenant_id)', { count: 'exact', head: true }).eq('businesses.tenant_id', TENANT_ID).eq('status', 'pending'),
    s.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'new'),
    s.from('business_edit_requests').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    s.from('subscriptions').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).in('status', ['active', 'trialing']),
    s.from('sponsorships').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('placement', 'homepage_featured').eq('active', true).or(`starts_on.is.null,starts_on.lte.${today}`).or(`ends_on.is.null,ends_on.gte.${today}`),
  ])

  const attention = [
    { href: '/admin/claims', label: 'Pending claims', count: results[1].count ?? 0, action: 'Review claims' },
    { href: '/admin/leads', label: 'New leads', count: results[2].count ?? 0, action: 'Open leads' },
    { href: '/admin/edit-requests', label: 'Pending edits', count: results[3].count ?? 0, action: 'Review edits' },
  ]

  return <>
    <section className="admin-owner-hero">
      <div>
        <div className="kpi">Owner Control Center</div>
        <h1>What do you want to work on?</h1>
        <p>Start with the job you are trying to accomplish. The system will take you into the deeper workflow only when you need it.</p>
      </div>
      <div className="admin-owner-mode">
        <strong>Built for you right now</strong>
        <span>No staff required. Team and role tools are still preserved under <b>All Tools</b> for later.</span>
      </div>
    </section>

    <section className="admin-start-strip">
      <div>
        <span className="admin-start-number">1</span>
        <span><strong>Check priorities</strong><small>See what actually needs attention first.</small></span>
      </div>
      <Link href="/admin/action-center">Open Priorities →</Link>
      <Link href="/admin/notifications">Notifications →</Link>
    </section>

    <div className="admin-section-title">
      <div>
        <div className="kpi">Start Here</div>
        <h2>Choose a workflow</h2>
      </div>
      <p>These six paths cover the everyday work. Specialized tools stay searchable in the sidebar.</p>
    </div>

    <div className="admin-journey-grid">
      {journeys.map((journey) => (
        <section className="admin-journey-card" key={journey.title}>
          <div className="admin-journey-head">
            <span>{journey.eyebrow}</span>
            <h3>{journey.title}</h3>
            <p>{journey.description}</p>
          </div>
          <Link className="admin-journey-primary" href={journey.href}>{journey.cta} <b aria-hidden="true">→</b></Link>
          <div className="admin-journey-links">
            {journey.links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
          </div>
        </section>
      ))}
    </div>

    <div className="admin-section-title admin-section-title-spaced">
      <div>
        <div className="kpi">Needs Attention</div>
        <h2>Actionable right now</h2>
      </div>
      <p>These are live counts from the system, not another menu.</p>
    </div>

    <div className="admin-attention-grid">
      {attention.map((item) => (
        <Link className={`admin-attention-card ${item.count > 0 ? 'has-work' : ''}`} href={item.href} key={item.href}>
          <span>{item.label}</span>
          <strong>{item.count}</strong>
          <small>{item.count > 0 ? item.action : 'Nothing waiting'}</small>
        </Link>
      ))}
    </div>

    <div className="admin-section-title admin-section-title-spaced">
      <div>
        <div className="kpi">At A Glance</div>
        <h2>Business snapshot</h2>
      </div>
    </div>

    <div className="admin-dashboard-snapshot">
      <Link href="/admin/businesses"><span>Published businesses</span><strong>{results[0].count ?? 0}</strong></Link>
      <Link href="/admin/subscriptions"><span>Active subscriptions</span><strong>{results[4].count ?? 0}</strong></Link>
      <Link href="/admin/sponsorships"><span>Homepage featured</span><strong>{results[5].count ?? 0}</strong></Link>
    </div>

    <div className="admin-all-tools-note">
      <div>
        <strong>Nothing was removed.</strong>
        <span>Every advanced option, report, queue and management screen is still available from <b>All Tools</b> or the admin search.</span>
      </div>
      <Link href="/admin/launch-readiness">System & launch tools →</Link>
    </div>
  </>
}
