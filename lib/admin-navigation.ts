export type AdminNavItem = {
  href: string
  label: string
  keywords?: string
  hint?: string
  icon?: string
}

export type AdminNavGroup = {
  id: string
  label: string
  description: string
  items: AdminNavItem[]
}

export const ADMIN_PRIMARY_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Home', hint: 'Start here', icon: '⌂' },
  { href: '/admin/action-center', label: 'Priorities', hint: 'What needs attention', icon: '✓' },
  { href: '/admin/businesses', label: 'Businesses', hint: 'Listings & customers', icon: '▦' },
  { href: '/admin/skylight-sales', label: 'Sales', hint: 'Find & win clients', icon: '↗' },
  { href: '/admin/skylight-operations', label: 'Client Work', hint: 'Projects & delivery', icon: '◇' },
  { href: '/admin/revenue-stack', label: 'Money', hint: 'Pricing & revenue', icon: '$' },
  { href: '/admin/seo', label: 'Growth & SEO', hint: 'Traffic & markets', icon: '◎' },
  { href: '/admin/site-builder', label: 'Website', hint: 'Brand & public site', icon: '✦' },
]

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'directory',
    label: 'Directory & Listings',
    description: 'Business records, approvals, claims, verification and public listing data.',
    items: [
      { href: '/admin/businesses', label: 'Businesses', keywords: 'listings profiles management workspace' },
      { href: '/admin/business-media', label: 'Business Media & Menus', keywords: 'photos menu media' },
      { href: '/admin/submissions', label: 'Profile Approval Queue', keywords: 'submissions onboarding moderation profile approval' },
      { href: '/admin/claims', label: 'Ownership Claims', keywords: 'owners ownership evidence claims' },
      { href: '/admin/verification', label: 'Verification & Publication', keywords: 'verify publish final gate trust' },
      { href: '/admin/edit-requests', label: 'Business Edit Requests', keywords: 'changes updates' },
      { href: '/admin/media', label: 'Owner Media Review', keywords: 'photos uploads moderation' },
      { href: '/admin/reports', label: 'Listing Reports', keywords: 'reports issues' },
    ],
  },
  {
    id: 'seo-content',
    label: 'Growth, SEO & Content',
    description: 'Markets, categories, search visibility, content quality and inventory growth.',
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
    id: 'clients-revenue',
    label: 'Clients, Services & Revenue',
    description: 'Client work, proposals, invoices, services, pricing, leads and monetization.',
    items: [
      { href: '/admin/skylight-operations', label: 'Skylight Proposals & Projects', keywords: 'proposals contracts agreements electronic acceptance projects tasks milestones recurring services retainers client portal custom services' },
      { href: '/admin/skylight-invoices', label: 'Skylight Service Invoices', keywords: 'marketing service invoices clients payments web design seo social branding graphic lead generation eddm direct mail' },
      { href: '/admin/skylight-services', label: 'Skylight Services & Pricing', keywords: 'service catalog custom pricing website seo social media gbp branding graphic design lead generation eddm direct mail' },
      { href: '/admin/skylight-intake', label: 'Skylight Intake & Client Assets', keywords: 'onboarding questions questionnaire client files uploads asset requirements project intake custom services' },
      { href: '/admin/skylight-eddm', label: 'EDDM & Community Mailers', keywords: 'eddm direct mail coop co-op mailer postcard route town city market slots smart coupon advertising' },
      { href: '/admin/local-commerce', label: 'Local Commerce Control Center', keywords: 'deals recommendations local faves q&a catalog portfolio referrals marketplace approvals' },
      { href: '/admin/leads', label: 'Skylight Lead Marketplace', keywords: 'leads marketplace admin review intro lead' },
      { href: '/admin/estate-planning-leads', label: 'Estate Planning Appointment Desk', keywords: 'estate planning trust wills attorney nationwide qualifying questions qualification appointment booking scheduling follow up no show' },
      { href: '/admin/estate-planning-performance', label: 'Estate Planning Appointment Funnel', keywords: 'estate planning appointment setting qualification booking confirmed completed no show canceled conversion reporting' },
      { href: '/admin/lead-buyers', label: 'Lead Buyer Revenue & Agreements', keywords: 'buyer conversion crm intro interested follow up sla agreement draft consent activation pay per lead funnel revenue intelligence' },
      { href: '/admin/lead-billing', label: 'Active Lead Billing', keywords: 'lead billing active agreements collections invoices' },
      { href: '/admin/revenue-intelligence', label: 'Revenue Intelligence', keywords: 'revenue metrics insights' },
      { href: '/admin/lead-notifications', label: 'Lead Email & SMS Alerts', keywords: 'notifications alerts' },
      { href: '/admin/pricing', label: 'Pricing & Plans', keywords: 'packages pricing' },
      { href: '/admin/revenue-stack', label: 'Revenue Stack', keywords: 'monetization overview' },
      { href: '/admin/revenue', label: 'Revenue Operations', keywords: 'billing revenue' },
      { href: '/admin/subscriptions', label: 'Subscription Manager', keywords: 'plans recurring' },
      { href: '/admin/plan-grants', label: 'Complimentary Plan Access', keywords: 'trial free pro featured admin grant complimentary access' },
      { href: '/admin/sponsorships', label: 'Featured / Sponsored Placement', keywords: 'ads featured sponsored' },
      { href: '/admin/routing', label: 'Lead Routing', keywords: 'assignment delivery' },
    ],
  },
  {
    id: 'sales-marketing',
    label: 'Sales & Marketing',
    description: 'Prospecting, acquisition, outreach, marketing campaigns and growth operations.',
    items: [
      { href: '/admin/skylight-sales', label: 'Skylight Sales Command Center', keywords: 'skylight services sales opportunities campaigns website seo social branding lead generation invoice prospect eddm direct mail' },
      { href: '/admin/action-center', label: 'My Priorities', keywords: 'action center priorities today tasks' },
      { href: '/admin/notifications', label: 'Notification Center', keywords: 'alerts unread notifications inbox' },
      { href: '/admin/operations-command-center', label: 'Growth Operations Command Center', keywords: 'operations priorities' },
      { href: '/admin/acquisition-research', label: 'Acquisition Research Workbench', keywords: 'owner contact provenance' },
      { href: '/admin/launch-growth', label: 'Launch + Growth Command Center', keywords: 'launch growth' },
      { href: '/admin/growth-opportunities', label: 'Growth Opportunity Queue', keywords: 'opportunities priorities commerce activation' },
      { href: '/admin/growth', label: 'Acquisition Funnel', keywords: 'sales funnel acquisition' },
      { href: '/admin/prospects', label: 'Skylight Sales CRM', keywords: 'prospects sales crm' },
      { href: '/admin/outreach', label: 'Outreach Task Workbench', keywords: 'tasks calls email' },
      { href: '/admin/outreach-templates', label: 'Outreach Template Library', keywords: 'email sms templates' },
      { href: '/admin/marketing-leads', label: 'Skylight Leads', keywords: 'marketing prospects leads' },
      { href: '/admin/marketing', label: 'Marketing Control Center', keywords: 'campaigns social marketing' },
      { href: '/admin/email-drips', label: 'Email Drip Campaigns', keywords: 'business owner lifecycle sponsored seo google marketing email nurture' },
      { href: '/admin/performance', label: 'What’s Working', keywords: 'performance analytics conversions page views deal banner clicks forms leads claims submissions top pages searches' },
      { href: '/admin/analytics', label: 'Listing Analytics', keywords: 'traffic performance analytics' },
    ],
  },
  {
    id: 'site-network',
    label: 'Website & Network',
    description: 'Brand, public navigation, site settings and Local Pros replication.',
    items: [
      { href: '/admin/site-builder', label: 'Site Builder / Brand & Content', keywords: 'brand settings public site' },
      { href: '/admin/navigation', label: 'Navigation Editor', keywords: 'menus footer links' },
      { href: '/admin/network-expansion', label: 'Local Pros Replication Center', keywords: 'network expansion cities directories' },
    ],
  },
  {
    id: 'system',
    label: 'System & Advanced',
    description: 'Launch checks, imports, future team access and audit history.',
    items: [
      { href: '/admin/launch-readiness', label: 'Launch Readiness', keywords: 'health launch checks' },
      { href: '/admin/bulk-import', label: 'Bulk Import', keywords: 'csv import businesses' },
      { href: '/admin/team', label: 'Team / Roles', keywords: 'staff permissions users future team' },
      { href: '/admin/audit', label: 'Audit Log', keywords: 'history changes activity' },
    ],
  },
]

export const ADMIN_TOOL_COUNT = ADMIN_NAV_GROUPS.reduce((sum, group) => sum + group.items.length, 0)

export function adminPathOnly(href: string) {
  return href.split('?')[0]
}

export function isAdminHrefActive(pathname: string, href: string) {
  if (href.includes('?')) return false
  const path = adminPathOnly(href)
  return path === '/admin' ? pathname === '/admin' : pathname === path || pathname.startsWith(`${path}/`)
}

export function findAdminLocation(pathname: string) {
  const candidates = ADMIN_NAV_GROUPS.flatMap((group) =>
    group.items
      .filter((item) => !item.href.includes('?'))
      .map((item) => ({ group, item, path: adminPathOnly(item.href) })),
  ).sort((a, b) => b.path.length - a.path.length)

  const found = candidates.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))
  return found ?? null
}
