'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type WorkspaceItem = { href: string; label: string; hint?: string }
type Workspace = { id: string; label: string; items: WorkspaceItem[] }

const STATIC_WORKSPACES: Workspace[] = [
  {
    id: 'priorities',
    label: 'Priorities',
    items: [
      { href: '/admin/action-center', label: 'My Priorities' },
      { href: '/admin/notifications', label: 'Notifications' },
      { href: '/admin/operations-command-center', label: 'Growth Operations' },
    ],
  },
  {
    id: 'businesses',
    label: 'Businesses',
    items: [
      { href: '/admin/businesses', label: 'All Businesses' },
      { href: '/admin/submissions', label: 'Approvals' },
      { href: '/admin/claims', label: 'Claims' },
      { href: '/admin/verification', label: 'Verification' },
      { href: '/admin/edit-requests', label: 'Edit Requests' },
      { href: '/admin/business-media', label: 'Media & Menus' },
      { href: '/admin/reports', label: 'Listing Reports' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    items: [
      { href: '/admin/skylight-sales', label: 'Overview' },
      { href: '/admin/skylight-sales/daily', label: 'Daily Command' },
      { href: '/admin/skylight-sales/inbox', label: 'Inbox' },
      { href: '/admin/skylight-sales/outreach', label: 'Outreach' },
      { href: '/admin/skylight-sales/acquisition', label: 'Acquisition' },
      { href: '/admin/skylight-sales/conversions', label: 'Conversions' },
      { href: '/admin/acquisition-research', label: 'Research' },
      { href: '/admin/prospects', label: 'CRM' },
    ],
  },
  {
    id: 'client-work',
    label: 'Client Work',
    items: [
      { href: '/admin/skylight-operations', label: 'Projects & Proposals' },
      { href: '/admin/skylight-intake', label: 'Intake & Assets' },
      { href: '/admin/skylight-services', label: 'Services' },
      { href: '/admin/skylight-invoices', label: 'Invoices' },
      { href: '/admin/skylight-operations/visibility-retention', label: 'Results & Retention' },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { href: '/admin/revenue-stack', label: 'Revenue Overview' },
      { href: '/admin/revenue', label: 'Revenue Operations' },
      { href: '/admin/revenue-intelligence', label: 'Revenue Intelligence' },
      { href: '/admin/pricing', label: 'Pricing & Plans' },
      { href: '/admin/lead-buyers', label: 'Lead Buyers' },
      { href: '/admin/lead-billing', label: 'Lead Billing' },
      { href: '/admin/subscriptions', label: 'Subscriptions' },
      { href: '/admin/sponsorships', label: 'Sponsored' },
      { href: '/admin/skylight-eddm', label: 'EDDM' },
    ],
  },
  {
    id: 'growth-seo',
    label: 'Growth & SEO',
    items: [
      { href: '/admin/seo', label: 'SEO Command' },
      { href: '/admin/data-quality?state=active&type=seo_inventory&priority=high', label: 'SEO Quick Wins' },
      { href: '/admin/data-quality', label: 'Data Quality' },
      { href: '/admin/content-intelligence', label: 'Content Intelligence' },
      { href: '/admin/inventory-expansion', label: 'Inventory Growth' },
      { href: '/admin/search', label: 'Search Intelligence' },
      { href: '/admin/guides', label: 'Guides' },
      { href: '/admin/locations', label: 'Markets' },
      { href: '/admin/categories', label: 'Categories' },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    items: [
      { href: '/admin/site-builder', label: 'Site Builder' },
      { href: '/admin/navigation', label: 'Navigation' },
      { href: '/admin/network-expansion', label: 'Replication' },
      { href: '/admin/launch-readiness', label: 'Launch Readiness' },
    ],
  },
]

function pathOnly(href: string) {
  return href.split('?')[0]
}

function getBusinessDetailWorkspace(pathname: string): Workspace | null {
  const match = pathname.match(/^\/admin\/businesses\/([^/]+)/)
  if (!match) return null
  const id = match[1]
  const base = `/admin/businesses/${id}`
  return {
    id: 'business-detail',
    label: 'Business Workspace',
    items: [
      { href: base, label: 'Business Profile' },
      { href: `${base}/visibility`, label: 'Visibility' },
      { href: `${base}/visibility/monitoring`, label: 'Monitoring' },
      { href: `${base}/visibility/google`, label: 'Google Data' },
      { href: `${base}/visibility/reporting`, label: 'Reports' },
      { href: `${base}/visibility/execution`, label: 'Execution' },
      { href: `${base}/visibility/client-health`, label: 'Client Health' },
    ],
  }
}

function chooseWorkspace(pathname: string): Workspace | null {
  const business = getBusinessDetailWorkspace(pathname)
  if (business) return business

  if (pathname === '/admin') return null
  if (pathname.startsWith('/admin/skylight-sales') || ['/admin/acquisition-research', '/admin/prospects', '/admin/outreach', '/admin/outreach-templates', '/admin/marketing', '/admin/email-drips'].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return STATIC_WORKSPACES.find((w) => w.id === 'sales')!
  if (['/admin/skylight-operations', '/admin/skylight-intake', '/admin/skylight-services', '/admin/skylight-invoices'].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return STATIC_WORKSPACES.find((w) => w.id === 'client-work')!
  if (['/admin/revenue-stack', '/admin/revenue', '/admin/revenue-intelligence', '/admin/pricing', '/admin/lead-buyers', '/admin/lead-billing', '/admin/subscriptions', '/admin/sponsorships', '/admin/skylight-eddm', '/admin/leads', '/admin/local-commerce'].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return STATIC_WORKSPACES.find((w) => w.id === 'money')!
  if (['/admin/seo', '/admin/data-quality', '/admin/content-intelligence', '/admin/inventory-expansion', '/admin/search', '/admin/guides', '/admin/locations', '/admin/categories', '/admin/branches', '/admin/coverage', '/admin/content-blocks', '/admin/analytics'].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return STATIC_WORKSPACES.find((w) => w.id === 'growth-seo')!
  if (['/admin/site-builder', '/admin/navigation', '/admin/network-expansion', '/admin/launch-readiness'].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return STATIC_WORKSPACES.find((w) => w.id === 'website')!
  if (['/admin/action-center', '/admin/notifications', '/admin/operations-command-center', '/admin/growth-opportunities', '/admin/launch-growth'].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return STATIC_WORKSPACES.find((w) => w.id === 'priorities')!
  if (['/admin/businesses', '/admin/submissions', '/admin/claims', '/admin/verification', '/admin/edit-requests', '/admin/business-media', '/admin/media', '/admin/reports'].some((p) => pathname === p || pathname.startsWith(`${p}/`))) return STATIC_WORKSPACES.find((w) => w.id === 'businesses')!
  return null
}

export function AdminWorkspaceNav() {
  const pathname = usePathname()
  const workspace = chooseWorkspace(pathname)
  if (!workspace) return null

  const ranked = workspace.items
    .map((item) => ({ item, path: pathOnly(item.href) }))
    .filter(({ path }) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.path.length - a.path.length)
  const activeHref = ranked[0]?.item.href ?? ''

  return (
    <div className="admin-workspace-context">
      <div className="admin-workspace-context-inner">
        <div className="admin-workspace-context-label">
          <span>Workspace</span>
          <strong>{workspace.label}</strong>
        </div>
        <nav className="admin-workspace-context-tabs" aria-label={`${workspace.label} navigation`}>
          {workspace.items.map((item) => {
            const active = item.href === activeHref || (item.href.includes('?') && pathname === pathOnly(item.href))
            return <Link className={active ? 'active' : ''} href={item.href} key={item.href}>{item.label}</Link>
          })}
        </nav>
      </div>
    </div>
  )
}
