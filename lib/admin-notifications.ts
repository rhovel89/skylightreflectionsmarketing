import { TENANT_ID } from '@/lib/constants'

export type AdminNotification = {
  key: string
  kind: string
  title: string
  detail: string
  href: string
  createdAt: string
  tone: 'info' | 'warn' | 'danger' | 'growth'
  read: boolean
}

type Row = Record<string, any>

type NotificationResult = {
  items: AdminNotification[]
  unreadCount: number
  totalCount: number
  errors: string[]
}

const openStatuses = ['pending', 'in_review', 'new']
const titleCase = (value: unknown) => String(value ?? '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase())
const iso = (value: unknown) => value ? String(value) : new Date(0).toISOString()

export async function getAdminNotifications(s: any, userId: string): Promise<NotificationResult> {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const next30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)

  const [submissionsResult, claimsResult, editsResult, reportsResult, leadsResult, qualityResult, subscriptionsResult, sponsorshipsResult, growthResult] = await Promise.all([
    s.from('business_submissions').select('id,business_name,category,city,status,created_at').eq('tenant_id', TENANT_ID).in('status', openStatuses).order('created_at', { ascending: false }).limit(30),
    s.from('business_claims').select('id,business_id,claimant_name,status,created_at,businesses!inner(id,tenant_id)').eq('businesses.tenant_id', TENANT_ID).in('status', openStatuses).order('created_at', { ascending: false }).limit(30),
    s.from('business_edit_requests').select('id,business_id,request_type,status,created_at').eq('tenant_id', TENANT_ID).in('status', openStatuses).order('created_at', { ascending: false }).limit(30),
    s.from('listing_reports').select('id,business_id,report_type,status,created_at').eq('tenant_id', TENANT_ID).in('status', openStatuses).order('created_at', { ascending: false }).limit(30),
    s.from('leads').select('id,business_id,assigned_business_id,service,city,status,created_at').eq('tenant_id', TENANT_ID).eq('status', 'new').order('created_at', { ascending: false }).limit(30),
    s.from('data_quality_tasks').select('id,business_id,task_type,priority,status,title,details,due_at,source_snapshot,updated_at').eq('tenant_id', TENANT_ID).in('status', ['open', 'in_progress']).order('updated_at', { ascending: false }).limit(120),
    s.from('subscriptions').select('id,business_id,status,current_period_end,updated_at').eq('tenant_id', TENANT_ID).in('status', ['past_due', 'incomplete', 'unpaid']).order('updated_at', { ascending: false }).limit(30),
    s.from('sponsorships').select('id,business_id,placement,ends_on,active,updated_at,created_at').eq('tenant_id', TENANT_ID).eq('active', true).gte('ends_on', today).lte('ends_on', next30).order('ends_on', { ascending: true }).limit(30),
    s.from('growth_opportunities').select('id,business_id,opportunity_type,title,score,status,next_action,updated_at').eq('tenant_id', TENANT_ID).in('status', ['open', 'in_progress']).gte('score', 70).order('score', { ascending: false }).limit(30),
  ])

  const namedResults: Array<[string, any]> = [
    ['Approval Queue', submissionsResult], ['Claims', claimsResult], ['Edit Requests', editsResult], ['Listing Reports', reportsResult],
    ['New Leads', leadsResult], ['Data Quality', qualityResult], ['Subscriptions', subscriptionsResult], ['Sponsorships', sponsorshipsResult], ['Growth Opportunities', growthResult],
  ]
  const errors = namedResults.flatMap(([name, result]) => result.error ? [`${name}: ${String(result.error.message || 'query failed')}`] : [])

  const submissions = (submissionsResult.data ?? []) as Row[]
  const claims = (claimsResult.data ?? []) as Row[]
  const edits = (editsResult.data ?? []) as Row[]
  const reports = (reportsResult.data ?? []) as Row[]
  const leads = (leadsResult.data ?? []) as Row[]
  const quality = ((qualityResult.data ?? []) as Row[]).filter(row => {
    const overdue = row.due_at && new Date(String(row.due_at)).getTime() < now.getTime()
    return overdue || ['hot', 'high'].includes(String(row.priority || '').toLowerCase()) || (row.task_type === 'seo_inventory' && Number(row.source_snapshot?.current_providers || 0) === 2)
  }).slice(0, 40)
  const subscriptions = (subscriptionsResult.data ?? []) as Row[]
  const sponsorships = (sponsorshipsResult.data ?? []) as Row[]
  const growth = (growthResult.data ?? []) as Row[]

  const businessIds = [...new Set([
    ...claims.map(row => row.business_id), ...edits.map(row => row.business_id), ...reports.map(row => row.business_id),
    ...leads.flatMap(row => [row.business_id, row.assigned_business_id]), ...quality.map(row => row.business_id),
    ...subscriptions.map(row => row.business_id), ...sponsorships.map(row => row.business_id), ...growth.map(row => row.business_id),
  ].filter(Boolean).map(String))]

  const businessesResult = businessIds.length
    ? await s.from('businesses').select('id,name').eq('tenant_id', TENANT_ID).in('id', businessIds)
    : { data: [], error: null }
  if (businessesResult.error) errors.push(`Business Names: ${String(businessesResult.error.message || 'query failed')}`)
  const businessById = new Map(((businessesResult.data ?? []) as Row[]).map(row => [String(row.id), String(row.name || 'Business')]))
  const businessName = (id: unknown) => id ? businessById.get(String(id)) || 'Business' : 'Business'

  const raw: Omit<AdminNotification, 'read'>[] = []
  for (const row of submissions) raw.push({ key: `submission:${row.id}`, kind: 'submission', title: `${row.business_name || 'Business'} submitted a listing`, detail: `${row.category || 'Category not set'} · ${row.city || 'City not set'}`, href: '/admin/submissions', createdAt: iso(row.created_at), tone: 'warn' })
  for (const row of claims) raw.push({ key: `claim:${row.id}`, kind: 'claim', title: `Ownership claim · ${businessName(row.business_id)}`, detail: `${row.claimant_name || 'Claimant'} is waiting for protected claim review.`, href: '/admin/claims', createdAt: iso(row.created_at), tone: 'warn' })
  for (const row of edits) raw.push({ key: `edit:${row.id}`, kind: 'edit', title: `Edit request · ${businessName(row.business_id)}`, detail: `${titleCase(row.request_type || 'profile change')} is waiting for staff review.`, href: '/admin/edit-requests', createdAt: iso(row.created_at), tone: 'info' })
  for (const row of reports) raw.push({ key: `report:${row.id}`, kind: 'report', title: `Listing report · ${businessName(row.business_id)}`, detail: `${titleCase(row.report_type || 'listing issue')} requires disposition.`, href: '/admin/reports', createdAt: iso(row.created_at), tone: 'warn' })
  for (const row of leads) raw.push({ key: `lead:${row.id}`, kind: 'lead', title: `New lead · ${row.service || 'Local service'}`, detail: `${row.city || 'Location not set'}${row.assigned_business_id ? ` · assigned to ${businessName(row.assigned_business_id)}` : ''}`, href: '/admin/leads', createdAt: iso(row.created_at), tone: 'info' })
  for (const row of quality) {
    const oneAway = row.task_type === 'seo_inventory' && Number(row.source_snapshot?.current_providers || 0) === 2
    raw.push({ key: `quality:${row.id}`, kind: oneAway ? 'seo' : 'quality', title: oneAway ? `SEO one-away · ${row.source_snapshot?.category || row.title || 'Inventory'}` : `Quality task · ${row.title || titleCase(row.task_type)}`, detail: oneAway ? `${row.source_snapshot?.city || 'Market'} has two legitimate providers.` : `${titleCase(row.priority || 'normal')} priority${row.due_at ? ` · due ${new Date(String(row.due_at)).toLocaleDateString('en-US')}` : ''}`, href: row.business_id ? `/admin/businesses/${row.business_id}?tab=trust` : '/admin/data-quality', createdAt: iso(row.updated_at), tone: oneAway ? 'growth' : ['hot', 'high'].includes(String(row.priority)) ? 'warn' : 'info' })
  }
  for (const row of subscriptions) raw.push({ key: `billing:${row.id}`, kind: 'billing', title: `Billing attention · ${businessName(row.business_id)}`, detail: `${titleCase(row.status)} subscription requires staff review.`, href: row.business_id ? `/admin/businesses/${row.business_id}?tab=revenue` : '/admin/subscriptions', createdAt: iso(row.updated_at), tone: 'danger' })
  for (const row of sponsorships) raw.push({ key: `sponsor:${row.id}:${row.ends_on}`, kind: 'sponsor', title: `Sponsored placement expiring · ${businessName(row.business_id)}`, detail: `${titleCase(row.placement)} ends ${row.ends_on}.`, href: row.business_id ? `/admin/businesses/${row.business_id}?tab=revenue` : '/admin/sponsorships', createdAt: iso(row.updated_at || row.created_at), tone: 'warn' })
  for (const row of growth) raw.push({ key: `growth:${row.id}`, kind: 'growth', title: `Growth opportunity · ${businessName(row.business_id)}`, detail: `${titleCase(row.opportunity_type)} · score ${Number(row.score || 0)}${row.next_action ? ` · ${row.next_action}` : ''}`, href: row.business_id ? `/admin/businesses/${row.business_id}?tab=growth` : '/admin/growth-opportunities', createdAt: iso(row.updated_at), tone: 'growth' })

  raw.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const limited = raw.slice(0, 160)
  const readsResult = await s.from('admin_notification_reads').select('notification_key,read_at').eq('tenant_id', TENANT_ID).eq('user_id', userId).in('notification_key', limited.length ? limited.map(item => item.key) : ['__none__'])
  if (readsResult.error) errors.push(`Notification State: ${String(readsResult.error.message || 'query failed')}`)
  const readKeys = new Set(((readsResult.data ?? []) as Row[]).map(row => String(row.notification_key)))
  const items = limited.map(item => ({ ...item, read: readKeys.has(item.key) }))

  return { items, unreadCount: items.filter(item => !item.read).length, totalCount: items.length, errors }
}
