import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const workspaceGroups = [
  {
    title: 'Directory & Customers',
    description: 'Manage the public directory and the business-owner workflows around it.',
    items: [
      ['/admin/businesses', 'Business Listings', 'Edit public profiles, status, verification and source information.'],
      ['/admin/leads', 'Skylight Lead Marketplace', 'Review, qualify, price and offer eligible home-service leads.'],
      ['/admin/claims', 'Claims Queue', 'Review business-owner claims before granting access.'],
    ],
  },
  {
    title: 'Markets & Content',
    description: 'Control where the directory operates and what customers see publicly.',
    items: [
      ['/admin/locations', 'Cities & Markets', 'Add or edit cities, towns, counties and market hierarchy.'],
      ['/admin/categories', 'Categories', 'Manage discovery and SEO categories across all verticals.'],
      ['/admin/guides', 'Local Guides', 'Create, edit and publish practical local content.'],
    ],
  },
  {
    title: 'Revenue & Growth',
    description: 'Operate monetization, sales and customer acquisition from one area.',
    items: [
      ['/admin/revenue-stack', 'Revenue Stack', 'See subscriptions, Sponsored ads, paid leads and marketing services.'],
      ['/admin/pricing', 'Pricing & Plans', 'Edit plan pricing and customer-facing package details.'],
      ['/admin/revenue', 'Revenue Operations', 'Track plans, billing health, lead revenue and sponsorships.'],
      ['/admin/prospects', 'Skylight Sales CRM', 'Filter and work prospects by market, stage and priority.'],
      ['/admin/marketing', 'Marketing Control Center', 'Create, schedule and export branded public marketing.'],
    ],
  },
  {
    title: 'Site Management',
    description: 'Manage the brand, public site structure and customer-facing navigation.',
    items: [
      ['/admin/site-builder', 'Brand & Site Content', 'Manage Skylight branding, public messaging and site settings.'],
      ['/admin/navigation', 'Navigation', 'Edit public menus and footer navigation without code changes.'],
    ],
  },
] as const

export default async function Page() {
  const s = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const results = await Promise.all([
    s.from('businesses').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'published'),
    s.from('business_claims').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    s.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'new'),
    s.from('business_edit_requests').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    s.from('subscriptions').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).in('status', ['active', 'trialing']),
    s.from('sponsorships').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('placement', 'homepage_featured').eq('active', true).or(`starts_on.is.null,starts_on.lte.${today}`).or(`ends_on.is.null,ends_on.gte.${today}`),
  ])

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Private Skylight Operations</div>
        <h1>Admin Workspace</h1>
        <p className="muted">Run Central Illinois Local Pros from one protected workspace. Use the navigation search to reach any specialized tool without hunting through long menus.</p>
      </div>
      <span className="badge neutral">V15.5</span>
    </div>

    <div className="stat-grid admin-dashboard-stats">
      <Link className="stat admin-stat-link" href="/admin/businesses">Published Businesses<strong>{results[0].count ?? 0}</strong><span>View listings →</span></Link>
      <Link className="stat admin-stat-link" href="/admin/claims">Pending Claims<strong>{results[1].count ?? 0}</strong><span>Review claims →</span></Link>
      <Link className="stat admin-stat-link" href="/admin/leads">New Leads<strong>{results[2].count ?? 0}</strong><span>Open leads →</span></Link>
      <Link className="stat admin-stat-link" href="/admin/edit-requests">Pending Edits<strong>{results[3].count ?? 0}</strong><span>Review edits →</span></Link>
      <Link className="stat admin-stat-link" href="/admin/subscriptions">Active Subscriptions<strong>{results[4].count ?? 0}</strong><span>Manage plans →</span></Link>
      <Link className="stat admin-stat-link" href="/admin/sponsorships">Homepage Featured<strong>{results[5].count ?? 0}</strong><span>Manage placements →</span></Link>
    </div>

    <div className="admin-dashboard-priority">
      <div className="admin-card admin-dashboard-focus">
        <div className="kpi">Fastest Path</div>
        <h2>Start with what needs attention</h2>
        <p className="muted">The most operationally important queues are available directly from the workspace without changing any underlying workflow.</p>
        <div className="admin-focus-links">
          <Link href="/admin/submissions">Approval Queue</Link>
          <Link href="/admin/data-quality?state=active&type=seo_inventory&priority=high">SEO Quick Wins</Link>
          <Link href="/admin/operations-command-center">Growth Operations</Link>
          <Link href="/admin/acquisition-research">Acquisition Research</Link>
        </div>
      </div>
      <div className="admin-card admin-dashboard-system">
        <div className="kpi">Protected System</div>
        <h2>Private by design</h2>
        <p className="muted">SEO diagnostics, CRM scores, outreach data, private lead data, audit information and deployment operations remain staff-only and noindex.</p>
      </div>
    </div>

    <div className="admin-workspace-heading">
      <div>
        <div className="kpi">Workspaces</div>
        <h2>Manage by job, not by menu size</h2>
      </div>
      <p className="muted">Every shortcut that was on this dashboard is still here, now grouped by the work you are trying to accomplish.</p>
    </div>

    <div className="admin-workspace-grid">
      {workspaceGroups.map((group) => (
        <section className="admin-workspace-card" key={group.title}>
          <div className="admin-workspace-card-head">
            <h3>{group.title}</h3>
            <p>{group.description}</p>
          </div>
          <div className="admin-workspace-links">
            {group.items.map(([href, title, desc]) => (
              <Link href={href} key={href}>
                <span>
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
                <b aria-hidden="true">›</b>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  </>
}
