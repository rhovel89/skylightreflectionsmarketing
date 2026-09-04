'use client'

import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { DEFAULT_BRAND } from '@/lib/constants'

type NavItem = {
  href: string
  label: string
  keywords?: string
}

type NavGroup = {
  id: string
  label: string
  description: string
  items: NavItem[]
}

const shortcuts: NavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/businesses', label: 'Listings' },
  { href: '/admin/data-quality?state=active&type=seo_inventory&priority=high', label: 'SEO Queue' },
  { href: '/admin/operations-command-center', label: 'Growth' },
]

const groups: NavGroup[] = [
  {
    id: 'directory',
    label: 'Directory Operations',
    description: 'Listings, approvals, claims and customer-facing business data',
    items: [
      { href: '/admin/businesses', label: 'Businesses', keywords: 'listings profiles' },
      { href: '/admin/business-media', label: 'Business Media & Menus', keywords: 'photos menu media' },
      { href: '/admin/submissions', label: 'Approval Queue', keywords: 'submissions moderation' },
      { href: '/admin/claims', label: 'Claims', keywords: 'owners verification' },
      { href: '/admin/edit-requests', label: 'Business Edit Requests', keywords: 'changes updates' },
      { href: '/admin/media', label: 'Owner Media Review', keywords: 'photos uploads moderation' },
      { href: '/admin/reports', label: 'Listing Reports', keywords: 'reports issues' },
    ],
  },
  {
    id: 'seo-content',
    label: 'SEO & Content',
    description: 'Markets, categories, content quality and organic eligibility',
    items: [
      { href: '/admin/locations', label: 'Markets & Locations', keywords: 'cities towns counties' },
      { href: '/admin/categories', label: 'Category Manager', keywords: 'taxonomy verticals' },
      { href: '/admin/branches', label: 'Locations & Branches', keywords: 'offices storefronts' },
      { href: '/admin/coverage', label: 'Page Coverage Manager', keywords: 'markets categories pages' },
      { href: '/admin/content-blocks', label: 'Site Content Blocks', keywords: 'copy content' },
      { href: '/admin/guides', label: 'Content Hub / Guides', keywords: 'articles local guides' },
      { href: '/admin/seo', label: 'SEO Command Center', keywords: 'organic indexing search' },
      { href: '/admin/data-quality', label: 'Data Quality & Reverification', keywords: 'provenance source review' },
      { href: '/admin/data-quality?state=active&type=seo_inventory&priority=high', label: 'SEO 2-Provider Quick Wins', keywords: 'inventory eligibility gap' },
      { href: '/admin/data-quality?state=resolved&type=seo_inventory', label: 'SEO Eligibility Wins', keywords: 'resolved inventory eligibility' },
      { href: '/admin/content-intelligence', label: 'Content & Market Intelligence', keywords: 'insights opportunity' },
      { href: '/admin/inventory-expansion', label: 'Inventory Expansion', keywords: 'providers research listings' },
      { href: '/admin/search', label: 'Search Intelligence', keywords: 'queries demand zero results' },
    ],
  },
  {
    id: 'revenue',
    label: 'Revenue & Monetization',
    description: 'Leads, plans, sponsorships, subscriptions and revenue operations',
    items: [
      { href: '/admin/leads', label: 'Skylight Lead Marketplace', keywords: 'leads marketplace' },
      { href: '/admin/lead-billing', label: 'Lead Revenue CRM', keywords: 'lead billing sales' },
      { href: '/admin/revenue-intelligence', label: 'Revenue Intelligence', keywords: 'revenue metrics insights' },
      { href: '/admin/lead-notifications', label: 'Lead Email & SMS Alerts', keywords: 'notifications alerts' },
      { href: '/admin/pricing', label: 'Pricing & Plans', keywords: 'packages pricing' },
      { href: '/admin/revenue-stack', label: 'Revenue Stack', keywords: 'monetization overview' },
      { href: '/admin/revenue', label: 'Revenue Operations', keywords: 'billing revenue' },
      { href: '/admin/subscriptions', label: 'Subscription Manager', keywords: 'plans recurring' },
      { href: '/admin/sponsorships', label: 'Featured / Sponsored Placement', keywords: 'ads featured sponsored' },
      { href: '/admin/routing', label: 'Lead Routing', keywords: 'assignment delivery' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth & Sales',
    description: 'Acquisition research, outreach, CRM and marketing execution',
    items: [
      { href: '/admin/operations-command-center', label: 'Growth Operations Command Center', keywords: 'operations priorities' },
      { href: '/admin/acquisition-research', label: 'Acquisition Research Workbench', keywords: 'owner contact provenance' },
      { href: '/admin/launch-growth', label: 'Launch + Growth Command Center', keywords: 'launch growth' },
      { href: '/admin/growth-opportunities', label: 'Growth Opportunity Queue', keywords: 'opportunities priorities' },
      { href: '/admin/growth', label: 'Acquisition Funnel', keywords: 'sales funnel acquisition' },
      { href: '/admin/prospects', label: 'Skylight Sales CRM', keywords: 'prospects sales crm' },
      { href: '/admin/outreach', label: 'Outreach Task Workbench', keywords: 'tasks calls email' },
      { href: '/admin/outreach-templates', label: 'Outreach Template Library', keywords: 'email sms templates' },
      { href: '/admin/marketing-leads', label: 'Skylight Leads', keywords: 'marketing prospects leads' },
      { href: '/admin/marketing', label: 'Marketing Control Center', keywords: 'campaigns social marketing' },
      { href: '/admin/analytics', label: 'Listing Analytics', keywords: 'traffic performance analytics' },
    ],
  },
  {
    id: 'site-network',
    label: 'Site & Network',
    description: 'Brand, public navigation, site settings and directory replication',
    items: [
      { href: '/admin/site-builder', label: 'Site Builder / Brand & Content', keywords: 'brand settings public site' },
      { href: '/admin/navigation', label: 'Navigation Editor', keywords: 'menus footer links' },
      { href: '/admin/network-expansion', label: 'Local Pros Replication Center', keywords: 'network expansion cities directories' },
    ],
  },
  {
    id: 'system',
    label: 'System & Administration',
    description: 'Readiness, imports, staff access and audit history',
    items: [
      { href: '/admin/launch-readiness', label: 'Launch Readiness', keywords: 'health launch checks' },
      { href: '/admin/bulk-import', label: 'Bulk Import', keywords: 'csv import businesses' },
      { href: '/admin/team', label: 'Team / Roles', keywords: 'staff permissions users' },
      { href: '/admin/audit', label: 'Audit Log', keywords: 'history changes activity' },
    ],
  },
]

const totalTools = groups.reduce((sum, group) => sum + group.items.length, 0)

function pathOnly(href: string) {
  return href.split('?')[0]
}

export function AdminSidebar() {
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {}
    for (const group of groups) {
      state[group.id] = group.items.some((item) => {
        const path = pathOnly(item.href)
        return !item.href.includes('?') && (pathname === path || pathname.startsWith(`${path}/`))
      })
    }
    if (!Object.values(state).some(Boolean)) state.directory = true
    return state
  })

  const normalizedQuery = query.trim().toLowerCase()
  const visibleGroups = useMemo(() => {
    if (!normalizedQuery) return groups
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label} ${item.keywords ?? ''} ${group.label}`.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [normalizedQuery])

  const isActive = (href: string) => {
    if (href.includes('?')) return false
    const path = pathOnly(href)
    if (path === '/admin') return pathname === '/admin'
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  const toggleGroup = (id: string) => {
    setOpenGroups((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <aside className="admin-side">
      <div className="admin-side-inner">
        <div className="admin-brand-panel">
          <div className="admin-brand-mark" aria-hidden="true">CLP</div>
          <div className="admin-brand-copy">
            <strong>{DEFAULT_BRAND.directory_name}</strong>
            <span>Private Staff Console</span>
          </div>
        </div>

        <div className="admin-shortcuts" aria-label="Admin quick access">
          {shortcuts.map((item) => (
            <a className={isActive(item.href) ? 'active' : ''} href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <label className="admin-nav-search">
          <span className="admin-nav-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Find among ${totalTools} admin tools…`}
            aria-label="Search admin navigation"
          />
          {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear navigation search">×</button> : null}
        </label>

        <nav className="admin-nav" aria-label="Admin navigation">
          {visibleGroups.map((group) => {
            const expanded = normalizedQuery ? true : Boolean(openGroups[group.id])
            return (
              <section className="admin-nav-group" key={group.id}>
                <button
                  type="button"
                  className="admin-nav-group-toggle"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={expanded}
                  disabled={Boolean(normalizedQuery)}
                >
                  <span>
                    <strong>{group.label}</strong>
                    <small>{group.items.length} tools</small>
                  </span>
                  <span className={`admin-nav-chevron ${expanded ? 'open' : ''}`} aria-hidden="true">⌄</span>
                </button>
                {expanded ? (
                  <div className="admin-nav-items">
                    {group.items.map((item) => (
                      <a className={isActive(item.href) ? 'active' : ''} href={item.href} key={item.href}>
                        <span>{item.label}</span>
                        <span className="admin-nav-arrow" aria-hidden="true">›</span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </section>
            )
          })}
          {visibleGroups.length === 0 ? (
            <div className="admin-nav-empty">
              <strong>No matching tools</strong>
              <span>Try a broader search term.</span>
            </div>
          ) : null}
        </nav>

        <div className="admin-side-footer">
          <div className="admin-side-footer-meta">
            <span>{totalTools} tools available</span>
            <span>Powered by {DEFAULT_BRAND.parent_brand_name}</span>
          </div>
          <a className="admin-public-link" href="/">← View Public Site</a>
          <form action="/auth/signout" method="post">
            <button className="admin-logout" type="submit">Log Out</button>
          </form>
        </div>
      </div>
    </aside>
  )
}
