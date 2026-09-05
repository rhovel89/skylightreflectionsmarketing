import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireStaff } from '@/lib/auth'
import { AdminTakeNextTask } from '@/components/AdminTakeNextTask'

export const dynamic = 'force-dynamic'

type Row = Record<string, any>
type SourceError = { source: string; message: string }
type SearchValue = string | string[] | undefined
type WorkItem = {
  id: string
  source: 'quality' | 'growth'
  title: string
  detail: string
  meta: string
  href: string
  assignedUserId: string
  dueAt: string
  score: number
  isHigh: boolean
}

const openStatuses = ['pending', 'in_review', 'new']
const today = () => new Date().toISOString().slice(0, 10)
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const titleCase = (value: unknown) => String(value ?? '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const formatDate = (value: unknown) => {
  if (!value) return '—'
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  const sp = await searchParams
  const focus = ['mine', 'unassigned', 'due-today', 'overdue', 'high', 'all'].includes(one(sp.focus)) ? one(sp.focus) : 'mine'
  const { claims: staffClaims } = await requireStaff('/admin/action-center')
  const userId = String(staffClaims.sub)
  const s = await createClient()
  const now = today()
  const next30 = inDays(30)
  const todayStart = `${now}T00:00:00.000Z`

  const [submissionsResult, claimsResult, editsResult, reportsResult, leadsResult, qualityResult, subscriptionsResult, sponsorshipsResult, growthResult, qualityCompletedResult, growthCompletedResult] = await Promise.all([
    s.from('business_submissions').select('id,business_name,category,city,status,created_at').eq('tenant_id', TENANT_ID).in('status', openStatuses).order('created_at', { ascending: false }).limit(100),
    s.from('business_claims').select('id,business_id,claimant_name,email,status,created_at,businesses!inner(id,name,tenant_id)').eq('businesses.tenant_id', TENANT_ID).in('status', openStatuses).order('created_at', { ascending: false }).limit(100),
    s.from('business_edit_requests').select('id,business_id,request_type,status,created_at').eq('tenant_id', TENANT_ID).in('status', openStatuses).order('created_at', { ascending: false }).limit(100),
    s.from('listing_reports').select('id,business_id,report_type,status,created_at').eq('tenant_id', TENANT_ID).in('status', openStatuses).order('created_at', { ascending: false }).limit(100),
    s.from('leads').select('id,business_id,assigned_business_id,service,city,status,created_at').eq('tenant_id', TENANT_ID).eq('status', 'new').order('created_at', { ascending: false }).limit(100),
    s.from('data_quality_tasks').select('id,business_id,task_type,priority,status,title,details,due_at,assigned_user_id,source_snapshot,updated_at').eq('tenant_id', TENANT_ID).in('status', ['open', 'in_progress']).order('updated_at', { ascending: false }).limit(2500),
    s.from('subscriptions').select('id,business_id,status,current_period_end,updated_at').eq('tenant_id', TENANT_ID).in('status', ['past_due', 'incomplete', 'unpaid']).order('updated_at', { ascending: false }).limit(100),
    s.from('sponsorships').select('id,business_id,placement,ends_on,active,created_at').eq('tenant_id', TENANT_ID).eq('active', true).gte('ends_on', now).lte('ends_on', next30).order('ends_on', { ascending: true }).limit(100),
    s.from('growth_opportunities').select('id,business_id,opportunity_type,status,score,next_action,due_at,assigned_user_id,source_facts,updated_at').eq('tenant_id', TENANT_ID).in('status', ['open', 'in_progress']).order('score', { ascending: false }).limit(2500),
    s.from('data_quality_tasks').select('id,assigned_user_id,resolved_at').eq('tenant_id', TENANT_ID).eq('status', 'resolved').gte('resolved_at', todayStart).limit(1000),
    s.from('growth_opportunities').select('id,assigned_user_id,updated_at').eq('tenant_id', TENANT_ID).eq('status', 'resolved').gte('updated_at', todayStart).limit(1000),
  ])

  const sourceErrors: SourceError[] = [
    ['Approval Queue', submissionsResult.error], ['Claims', claimsResult.error], ['Edit Requests', editsResult.error], ['Listing Reports', reportsResult.error],
    ['New Leads', leadsResult.error], ['Data Quality', qualityResult.error], ['Subscriptions', subscriptionsResult.error], ['Sponsorships', sponsorshipsResult.error],
    ['Growth Opportunities', growthResult.error], ['Completed Quality', qualityCompletedResult.error], ['Completed Growth', growthCompletedResult.error],
  ].flatMap(([source, error]) => error ? [{ source: String(source), message: String((error as any).message || 'Query failed') }] : [])

  const submissions = (submissionsResult.data ?? []) as Row[]
  const claims = (claimsResult.data ?? []) as Row[]
  const edits = (editsResult.data ?? []) as Row[]
  const reports = (reportsResult.data ?? []) as Row[]
  const leads = (leadsResult.data ?? []) as Row[]
  const quality = (qualityResult.data ?? []) as Row[]
  const billing = (subscriptionsResult.data ?? []) as Row[]
  const sponsorships = (sponsorshipsResult.data ?? []) as Row[]
  const growth = (growthResult.data ?? []) as Row[]
  const completedToday = [...((qualityCompletedResult.data ?? []) as Row[]), ...((growthCompletedResult.data ?? []) as Row[])]
  const completedByMe = completedToday.filter(row => String(row.assigned_user_id || '') === userId)

  const overdueQuality = quality.filter((row) => row.due_at && String(row.due_at).slice(0, 10) < now)
  const urgentQuality = quality.filter((row) => ['hot', 'high'].includes(String(row.priority)))
  const seoOneAway = quality.filter((row) => row.task_type === 'seo_inventory' && Number(row.source_snapshot?.current_providers || 0) === 2)
  const highGrowth = growth.filter((row) => Number(row.score || 0) >= 70)
  const moderationTotal = submissions.length + claims.length + edits.length + reports.length
  const immediateTotal = moderationTotal + leads.length + billing.length + overdueQuality.length

  const queueCards = [
    { label: 'Approval Queue', count: submissions.length, detail: 'New business submissions awaiting protected review.', href: '/admin/submissions', tone: submissions.length ? 'warn' : 'good' },
    { label: 'Claims', count: claims.length, detail: 'Ownership claims waiting for account/evidence review.', href: '/admin/claims', tone: claims.length ? 'warn' : 'good' },
    { label: 'Edit Requests', count: edits.length, detail: 'Owner-requested profile changes awaiting review.', href: '/admin/edit-requests', tone: edits.length ? 'warn' : 'good' },
    { label: 'Listing Reports', count: reports.length, detail: 'Public listing issues waiting for staff disposition.', href: '/admin/reports', tone: reports.length ? 'warn' : 'good' },
    { label: 'New Leads', count: leads.length, detail: 'Fresh lead records that have not advanced from New.', href: '/admin/leads', tone: leads.length ? 'action' : 'good' },
    { label: 'Billing Attention', count: billing.length, detail: 'Past-due, incomplete or unpaid subscriptions.', href: '/admin/subscriptions', tone: billing.length ? 'danger' : 'good' },
  ]

  const businessIds = [...new Set([
    ...claims.map((row) => row.business_id), ...edits.map((row) => row.business_id), ...reports.map((row) => row.business_id),
    ...leads.flatMap((row) => [row.business_id, row.assigned_business_id]), ...quality.map((row) => row.business_id),
    ...billing.map((row) => row.business_id), ...sponsorships.map((row) => row.business_id), ...growth.map((row) => row.business_id),
  ].filter(Boolean).map(String))]

  const businessesResult = businessIds.length
    ? await s.from('businesses').select('id,name,slug').eq('tenant_id', TENANT_ID).in('id', businessIds)
    : { data: [], error: null }
  if (businessesResult.error) sourceErrors.push({ source: 'Business lookup', message: businessesResult.error.message })
  const businessById = new Map(((businessesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]))
  const businessName = (id: unknown) => String(businessById.get(String(id || ''))?.name || 'Business')

  const workItems: WorkItem[] = [
    ...quality.map(row => ({
      id: String(row.id), source: 'quality' as const,
      title: row.title || titleCase(row.task_type),
      detail: String(row.details || 'Persistent listing-integrity task.'),
      meta: `${titleCase(row.priority || 'normal')} · ${row.due_at ? `due ${formatDate(row.due_at)}` : 'no due date'} · ${row.assigned_user_id ? 'assigned' : 'unassigned'}`,
      href: row.business_id ? `/admin/businesses/${row.business_id}?tab=trust` : '/admin/data-quality',
      assignedUserId: String(row.assigned_user_id || ''), dueAt: String(row.due_at || ''),
      score: ({ hot: 100, high: 80, medium: 50, low: 20 } as Record<string,number>)[String(row.priority || '').toLowerCase()] || 30,
      isHigh: ['hot', 'high'].includes(String(row.priority || '').toLowerCase()),
    })),
    ...growth.map(row => ({
      id: String(row.id), source: 'growth' as const,
      title: businessName(row.business_id),
      detail: String(row.next_action || 'Review the opportunity and source facts before taking action.'),
      meta: `${titleCase(row.opportunity_type)} · score ${Number(row.score || 0)} · ${row.due_at ? `due ${formatDate(row.due_at)}` : 'no due date'} · ${row.assigned_user_id ? 'assigned' : 'unassigned'}`,
      href: row.business_id ? `/admin/businesses/${row.business_id}?tab=growth` : '/admin/growth-opportunities',
      assignedUserId: String(row.assigned_user_id || ''), dueAt: String(row.due_at || ''), score: Number(row.score || 0), isHigh: Number(row.score || 0) >= 90,
    })),
  ]

  const focusCounts = {
    mine: workItems.filter(item => item.assignedUserId === userId).length,
    unassigned: workItems.filter(item => !item.assignedUserId).length,
    'due-today': workItems.filter(item => item.dueAt && item.dueAt.slice(0, 10) === now).length,
    overdue: workItems.filter(item => item.dueAt && item.dueAt.slice(0, 10) < now).length,
    high: workItems.filter(item => item.isHigh).length,
    all: workItems.length,
  }
  const focusedWork = workItems.filter(item => {
    if (focus === 'mine') return item.assignedUserId === userId
    if (focus === 'unassigned') return !item.assignedUserId
    if (focus === 'due-today') return Boolean(item.dueAt && item.dueAt.slice(0, 10) === now)
    if (focus === 'overdue') return Boolean(item.dueAt && item.dueAt.slice(0, 10) < now)
    if (focus === 'high') return item.isHigh
    return true
  }).sort((a,b) => Number(Boolean(b.dueAt && b.dueAt.slice(0,10) < now)) - Number(Boolean(a.dueAt && a.dueAt.slice(0,10) < now)) || aDue(a.dueAt) - aDue(b.dueAt) || b.score - a.score)

  const focusTabs = [
    ['mine','Assigned to Me'], ['unassigned','Unassigned'], ['due-today','Due Today'], ['overdue','Overdue'], ['high','High Priority'], ['all','All Work'],
  ] as const

  return <>
    <div className="admin-page-head action-center-head">
      <div>
        <div className="kpi">Private Staff Priorities</div>
        <h1>My Work Today</h1>
        <p className="muted">One operating view for personal assignments, moderation, fresh leads, billing exceptions, listing integrity, SEO quick wins and high-value growth work. Counts are private workflow signals and never affect organic ranking.</p>
      </div>
      <div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/notifications">Notifications</Link><Link className="btn btn-light" href="/admin/businesses">Manage Businesses</Link><Link className="btn btn-light" href="/admin/operations-command-center">Growth Operations</Link></div>
    </div>

    {sourceErrors.length ? <div className="notice warn"><strong>Some Action Center data is temporarily incomplete.</strong> Unavailable source{sourceErrors.length === 1 ? '' : 's'}: {sourceErrors.map((item) => item.source).join(', ')}. Other queues below are still usable.</div> : null}

    <div className="action-center-summary">
      <div className={immediateTotal ? 'attention' : 'clear'}><span>Needs Attention</span><strong>{immediateTotal}</strong><small>moderation + new leads + billing + overdue quality</small></div>
      <div><span>My Assigned Work</span><strong>{focusCounts.mine}</strong><small>{completedByMe.length} completed by you today</small></div>
      <div><span>Unassigned Work</span><strong>{focusCounts.unassigned}</strong><small>quality + growth tasks available to claim</small></div>
      <div><span>Overdue Work</span><strong>{focusCounts.overdue}</strong><small>assigned or unassigned internal tasks</small></div>
      <div><span>SEO One Away</span><strong>{seoOneAway.length}</strong><small>2 legitimate providers; one more needed</small></div>
      <div><span>Sponsors Expiring</span><strong>{sponsorships.length}</strong><small>active placements ending within 30 days</small></div>
    </div>

    <section className="admin-card personal-work-section">
      <div className="section-head compact-head"><div><div className="kpi">Personal Work Queue</div><h2>Choose what you want to work next</h2><p className="muted">Assignments and due dates apply only to internal quality/growth workflow records. Claiming a task does not change any public listing, verification, SEO eligibility, billing or outreach state.</p></div><AdminTakeNextTask /></div>
      <nav className="personal-focus-tabs" aria-label="Personal work filters">{focusTabs.map(([key,label]) => <Link className={focus === key ? 'active' : ''} href={`/admin/action-center?focus=${key}`} key={key}><span>{label}</span><strong>{focusCounts[key]}</strong></Link>)}</nav>
      <div className="action-center-list personal-work-list">
        {focusedWork.slice(0,18).map(item => <ActionRow key={`${item.source}-${item.id}`} title={item.title} meta={`${titleCase(item.source)} · ${item.meta}`} detail={item.detail} href={item.href} />)}
        {!focusedWork.length ? <ClearState text={focus === 'mine' ? 'Nothing is assigned to you right now. Use Take Next Task to claim the highest-priority unassigned item.' : 'No current work matches this focus.'} /> : null}
      </div>
      <div className="personal-work-footer"><span>{focusedWork.length} matching work item{focusedWork.length===1?'':'s'} · showing {Math.min(18,focusedWork.length)}</span><span>{completedToday.length} total internal tasks completed today · {completedByMe.length} by you</span></div>
    </section>

    <section className="action-center-section">
      <div className="section-head"><div><div className="kpi">Start Here</div><h2>Operational queues</h2><p className="muted">Open the focused workflow when a queue needs action. Protected decisions remain inside their existing review tools.</p></div></div>
      <div className="action-queue-grid">{queueCards.map((card) => <Link href={card.href} className={`action-queue-card ${card.tone}`} key={card.label}><span>{card.label}</span><strong>{card.count}</strong><p>{card.detail}</p><b>Open queue →</b></Link>)}</div>
    </section>

    <div className="action-center-columns">
      <section className="admin-card action-center-panel">
        <div className="section-head compact-head"><div><div className="kpi">Listing Integrity</div><h2>Quality work</h2></div><Link className="btn btn-small btn-light" href="/admin/data-quality">Full Queue</Link></div>
        <div className="action-center-list">{[...overdueQuality, ...urgentQuality.filter((row) => !overdueQuality.some((item) => item.id === row.id))].slice(0, 12).map((row) => <ActionRow key={row.id} title={row.title || titleCase(row.task_type)} meta={`${titleCase(row.priority)} · ${row.due_at ? `due ${formatDate(row.due_at)}` : 'no due date'}`} detail={row.details || 'Persistent listing-integrity task.'} href={row.business_id ? `/admin/businesses/${row.business_id}?tab=trust` : '/admin/data-quality'} business={businessById.get(String(row.business_id || ''))?.name} />)}{!overdueQuality.length && !urgentQuality.length ? <ClearState text="No overdue or high-priority quality tasks." /> : null}</div>
      </section>

      <section className="admin-card action-center-panel">
        <div className="section-head compact-head"><div><div className="kpi">Organic Expansion</div><h2>SEO one-away markets</h2></div><Link className="btn btn-small btn-light" href="/admin/data-quality?state=active&type=seo_inventory&priority=high">Quick Wins</Link></div>
        <div className="action-center-list">{seoOneAway.slice(0, 12).map((row) => <ActionRow key={row.id} title={String(row.source_snapshot?.category || row.title || 'SEO inventory')} meta={`${row.source_snapshot?.city || 'Market'} · ${row.source_snapshot?.current_providers || 2} current providers`} detail="Research only a legitimate source-backed third provider; never pad a market with a fake office." href="/admin/inventory-expansion" />)}{!seoOneAway.length ? <ClearState text="No active two-provider SEO inventory tasks." /> : null}</div>
      </section>

      <section className="admin-card action-center-panel">
        <div className="section-head compact-head"><div><div className="kpi">Revenue Protection</div><h2>Billing & sponsor renewals</h2></div><Link className="btn btn-small btn-light" href="/admin/revenue">Revenue Ops</Link></div>
        <div className="action-center-list">{billing.slice(0, 8).map((row) => <ActionRow key={`billing-${row.id}`} title={String(businessById.get(String(row.business_id))?.name || 'Business subscription')} meta={titleCase(row.status)} detail={`Subscription requires attention${row.current_period_end ? ` · period end ${formatDate(row.current_period_end)}` : ''}.`} href={row.business_id ? `/admin/businesses/${row.business_id}?tab=revenue` : '/admin/subscriptions'} />)}{sponsorships.slice(0, 8).map((row) => <ActionRow key={`sponsor-${row.id}`} title={String(businessById.get(String(row.business_id))?.name || 'Sponsored placement')} meta={`${titleCase(row.placement)} · ends ${formatDate(row.ends_on)}`} detail="Active Sponsored placement approaching its configured end date." href={row.business_id ? `/admin/businesses/${row.business_id}?tab=revenue` : '/admin/sponsorships'} />)}{!billing.length && !sponsorships.length ? <ClearState text="No billing exceptions or sponsors expiring in the next 30 days." /> : null}</div>
      </section>

      <section className="admin-card action-center-panel">
        <div className="section-head compact-head"><div><div className="kpi">Commercial Growth</div><h2>High-value opportunities</h2></div><Link className="btn btn-small btn-light" href="/admin/growth-opportunities">Growth Queue</Link></div>
        <div className="action-center-list">{highGrowth.slice(0, 12).map((row) => <ActionRow key={row.id} title={String(businessById.get(String(row.business_id))?.name || titleCase(row.opportunity_type))} meta={`${titleCase(row.opportunity_type)} · score ${Number(row.score || 0)}`} detail={String(row.next_action || 'Review the opportunity and source facts before taking action.')} href={row.business_id ? `/admin/businesses/${row.business_id}?tab=growth` : '/admin/growth-opportunities'} />)}{!highGrowth.length ? <ClearState text="No open growth opportunities currently score 70 or higher." /> : null}</div>
      </section>
    </div>

    <section className="admin-card action-center-footer-card">
      <div><div className="kpi">Guardrails</div><h2>Fast does not mean loose</h2><p className="muted">The Action Center only prioritizes existing private work. It cannot approve a claim, create verification, manufacture a branch, alter the three-provider indexing threshold, turn a task into sent outreach, or make a paid placement organic.</p></div>
      <div className="admin-row-actions"><Link className="btn btn-light" href="/admin/data-quality">Data Quality</Link><Link className="btn btn-light" href="/admin/acquisition-research">Acquisition Research</Link><Link className="btn btn-light" href="/admin/audit">Audit Log</Link></div>
    </section>
  </>
}

function ActionRow({ title, meta, detail, href, business }: { title: string; meta: string; detail: string; href: string; business?: string }) {
  return <Link className="action-center-row" href={href}><div><strong>{title}</strong>{business ? <span>{business}</span> : null}<small>{meta}</small><p>{detail}</p></div><b>›</b></Link>
}

function ClearState({ text }: { text: string }) {
  return <div className="action-center-clear"><strong>All clear</strong><span>{text}</span></div>
}

function aDue(value: string) {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}
