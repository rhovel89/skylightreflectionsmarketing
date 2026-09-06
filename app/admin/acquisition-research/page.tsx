import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireStaff } from '@/lib/auth'
import { ProspectResearchWorkbench } from '@/components/ProspectResearchWorkbench'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined
type Row = Record<string, any>

const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const text = (value: unknown) => String(value ?? '').trim()
const titleCase = (value: string) => value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const contactable = (row: Row) => Boolean(text(row.owner_contact_email) || text(row.owner_contact_phone))
const sourcedContact = (row: Row) => Boolean(contactable(row) && text(row.owner_contact_source_url) && row.owner_contact_checked_at)
const priorityRank: Record<string, number> = { hot: 4, high: 3, medium: 2, low: 1 }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  await requireStaff('/admin/acquisition-research')
  const sp = await searchParams
  const state = one(sp.state) || 'research'
  const city = one(sp.city)
  const vertical = one(sp.vertical)
  const service = one(sp.service)
  const q = one(sp.q).trim().toLowerCase()
  const s = await createClient()

  const [prospectsResult, salesResult, tasksResult, activitiesResult, publishedResult] = await Promise.all([
    s.from('business_prospects')
      .select('id,business_id,business_name,vertical,category,city,phone,website,status,opportunity_score,marketing_flags,crm_stage,priority,owner_contact_name,owner_contact_title,owner_contact_email,owner_contact_phone,owner_contact_source_url,owner_contact_checked_at,next_follow_up_at,last_contacted_at,assigned_user_id,notes,updated_at')
      .eq('tenant_id', TENANT_ID)
      .limit(2500),
    s.from('skylight_sales_opportunities')
      .select('id,prospect_id,business_id,primary_service_slug,recommended_service_slugs,evidence_flags,score,priority,stage,estimated_value_cents,assigned_user_id,next_follow_up_at,updated_at')
      .eq('tenant_id', TENANT_ID)
      .eq('active', true)
      .order('score', { ascending: false })
      .limit(1500),
    s.from('outreach_tasks')
      .select('id,prospect_id,assigned_user_id,task_type,due_at,status,notes,created_at,completed_at')
      .eq('tenant_id', TENANT_ID)
      .eq('task_type', 'contact_research')
      .in('status', ['open', 'in_progress'])
      .order('due_at', { ascending: true })
      .limit(2500),
    s.from('prospect_activities')
      .select('id,prospect_id,activity_type,summary,metadata,created_at')
      .eq('tenant_id', TENANT_ID)
      .eq('activity_type', 'research')
      .order('created_at', { ascending: false })
      .limit(5000),
    s.from('businesses').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'published'),
  ])

  const errors = [prospectsResult.error, salesResult.error, tasksResult.error, activitiesResult.error, publishedResult.error].filter(Boolean)
  const prospects = (prospectsResult.data ?? []) as Row[]
  const sales = (salesResult.data ?? []) as Row[]
  const tasks = (tasksResult.data ?? []) as Row[]
  const activities = (activitiesResult.data ?? []) as Row[]

  const prospectById = new Map<string, Row>(prospects.map((row) => [String(row.id), row]))
  const taskByProspect = new Map<string, Row>()
  for (const task of tasks) if (!taskByProspect.has(String(task.prospect_id))) taskByProspect.set(String(task.prospect_id), task)
  const latestResearchByProspect = new Map<string, Row>()
  for (const activity of activities) if (!latestResearchByProspect.has(String(activity.prospect_id))) latestResearchByProspect.set(String(activity.prospect_id), activity)

  const allRows: Row[] = sales.flatMap<Row>((opportunity): Row[] => {
    const prospect = prospectById.get(String(opportunity.prospect_id))
    if (!prospect) return []
    const task = taskByProspect.get(String(prospect.id))
    const activity = latestResearchByProspect.get(String(prospect.id))
    return [{
      ...prospect,
      sales_opportunity_id: opportunity.id,
      sales_stage: opportunity.stage,
      sales_priority: opportunity.priority,
      sales_score: opportunity.score,
      primary_service_slug: opportunity.primary_service_slug,
      recommended_service_slugs: opportunity.recommended_service_slugs ?? [],
      evidence_flags: opportunity.evidence_flags ?? [],
      estimated_value_cents: opportunity.estimated_value_cents,
      sales_assigned_user_id: opportunity.assigned_user_id,
      sales_next_follow_up_at: opportunity.next_follow_up_at,
      task_id: task?.id ?? null,
      task_status: task?.status ?? null,
      task_due_at: task?.due_at ?? null,
      task_notes: task?.notes ?? null,
      recent_research_summary: activity?.summary ?? null,
      recent_research_at: activity?.created_at ?? null,
      recent_research_metadata: activity?.metadata ?? null,
    } as Row]
  })

  const researchRows = allRows.filter((row) => ['new', 'research'].includes(String(row.sales_stage)))
  const strictReadyRows = allRows.filter((row) => row.sales_stage === 'contact_ready' && sourcedContact(row))
  const incompleteRows = researchRows.filter((row) => contactable(row) && !sourcedContact(row))
  const noContactRows = researchRows.filter((row) => !contactable(row))
  const hotHighResearch = researchRows.filter((row) => ['hot', 'high'].includes(String(row.sales_priority)))
  const overdueTasks = tasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now())
  const cities = Array.from(new Set(allRows.map((row) => text(row.city)).filter(Boolean))).sort()
  const verticals = Array.from(new Set(allRows.map((row) => text(row.vertical)).filter(Boolean))).sort()
  const services = Array.from(new Set(allRows.flatMap((row) => (row.recommended_service_slugs ?? []).map(String)).filter(Boolean))).sort()

  let filtered = allRows.filter((row) => {
    if (q && !`${row.business_name || ''} ${row.city || ''} ${row.category || ''} ${row.owner_contact_name || ''} ${row.owner_contact_title || ''} ${(row.recommended_service_slugs || []).join(' ')} ${(row.evidence_flags || []).join(' ')}`.toLowerCase().includes(q)) return false
    if (city && row.city !== city) return false
    if (vertical && row.vertical !== vertical) return false
    if (service && !(row.recommended_service_slugs || []).includes(service)) return false
    if (state === 'research' && !(['new', 'research'].includes(String(row.sales_stage)) && !contactable(row))) return false
    if (state === 'provenance' && !(['new', 'research'].includes(String(row.sales_stage)) && contactable(row) && !sourcedContact(row))) return false
    if (state === 'ready' && !(row.sales_stage === 'contact_ready' && sourcedContact(row))) return false
    if (state === 'high' && !(['new', 'research'].includes(String(row.sales_stage)) && ['hot', 'high'].includes(String(row.sales_priority)))) return false
    if (state === 'task' && !row.task_id) return false
    return true
  })

  filtered = filtered.sort((a, b) =>
    (priorityRank[String(b.sales_priority)] || 0) - (priorityRank[String(a.sales_priority)] || 0)
      || Number(b.sales_score || 0) - Number(a.sales_score || 0)
      || new Date(String(a.task_due_at || '9999-12-31')).getTime() - new Date(String(b.task_due_at || '9999-12-31')).getTime()
      || String(a.business_name).localeCompare(String(b.business_name)),
  )

  const shown = filtered.slice(0, 180)
  const hasFilters = Boolean(q || city || vertical || service || state !== 'research')

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Skylight Reflections Marketing · Private Sales Research</div>
        <h1>Prospect Research Workbench 3.3</h1>
        <p className="muted">Turn evidence-backed Local Pros opportunities into sourced owner/decision-maker contact paths. Research work is prioritized by private sales value, but contact research never changes public ranking, verification, Sponsored placement, lead routing or billing.</p>
      </div>
      <div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/skylight-sales">Sales Command Center</Link><Link className="btn btn-light" href="/admin/prospects">Full CRM</Link></div>
    </div>

    {errors.length ? <div className="notice warn"><strong>Some research data is temporarily incomplete.</strong> Do not treat affected totals as authoritative until the underlying query recovers.</div> : null}
    <div className="notice"><strong>Contact Ready standard:</strong> a staff member must document a legitimate owner/decision-maker email or phone, the public source URL that supports the association, and when that source was checked. Generic listing contact information remains a research aid only. Nothing is sent automatically.</div>

    <div className="stat-grid" style={{ marginTop: 18 }}>
      <div className="stat">Published Businesses<strong>{publishedResult.count ?? 0}</strong></div>
      <div className="stat">Active Sales Opportunities<strong>{allRows.length}</strong></div>
      <div className="stat">Research Needed<strong>{researchRows.length}</strong><small>{noContactRows.length} with no sourced contact channel yet</small></div>
      <div className="stat">Hot / High Research<strong>{hotHighResearch.length}</strong><small>work these first</small></div>
      <div className="stat">Provenance Incomplete<strong>{incompleteRows.length}</strong><small>contact exists; source/check incomplete</small></div>
      <div className="stat">Strict Contact Ready<strong>{strictReadyRows.length}</strong><small>sourced owner / decision-maker channel</small></div>
      <div className="stat">Open Research Tasks<strong>{tasks.length}</strong><small>{overdueTasks.length} currently overdue</small></div>
      <div className="stat">Research Attempts Logged<strong>{activities.length}</strong><small>recent activity records loaded</small></div>
    </div>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div><div className="kpi">Research Filters</div><h2>Work the highest-value slice</h2><p className="small muted">Default view shows prospects with no owner/decision-maker contact channel. Use Hot / High to focus the strongest current private sales opportunities.</p></div>
        {hasFilters ? <Link className="btn btn-light" href="/admin/acquisition-research">Reset</Link> : null}
      </div>
      <form method="get" className="grid grid-4" style={{ alignItems: 'end' }}>
        <label className="field"><span>Work State</span><select name="state" defaultValue={state}><option value="research">No sourced contact yet</option><option value="provenance">Contact found / provenance incomplete</option><option value="high">Hot / High research</option><option value="ready">Strict Contact Ready</option><option value="task">Open research task</option><option value="all">All active sales prospects</option></select></label>
        <label className="field"><span>City / Market</span><select name="city" defaultValue={city}><option value="">All markets</option>{cities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="field"><span>Vertical</span><select name="vertical" defaultValue={vertical}><option value="">All verticals</option>{verticals.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
        <label className="field"><span>Recommended Service</span><select name="service" defaultValue={service}><option value="">All services</option>{services.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
        <label className="field"><span>Search</span><input name="q" defaultValue={one(sp.q)} placeholder="Business, city, contact, signal…" /></label>
        <div><button className="btn btn-primary" type="submit">Apply Filters</button></div>
      </form>
    </section>

    <div className="grid grid-3" style={{ marginTop: 18 }}>
      <div className="admin-card"><div className="kpi">Provenance Gate</div><h3>Generic ≠ decision maker</h3><p className="small muted">A website, main business phone or general inbox may help research the company, but cannot be represented as a private/direct owner contact without a source that supports the association.</p></div>
      <div className="admin-card"><div className="kpi">Human Control</div><h3>Research ≠ outreach</h3><p className="small muted">Saving a source, creating a task or preparing a draft never marks an email, text or call as sent. Actual outreach remains a deliberate staff action.</p></div>
      <div className="admin-card"><div className="kpi">Marketplace Separation</div><h3>Sales ≠ ranking</h3><p className="small muted">Skylight sales signals, Lead Buyer interest and contact research are private. They cannot change verification, organic relevance or Sponsored disclosure.</p></div>
    </div>

    <div className="admin-list-meta" style={{ marginTop: 18 }}><span className="kpi">{filtered.length} matching prospect{filtered.length === 1 ? '' : 's'} · showing {shown.length}</span><span className="small muted">Priority order: Hot → High → Medium → Low, then private sales score and research due date.</span></div>
    <div style={{ marginTop: 12 }}><ProspectResearchWorkbench rows={shown} /></div>

    <div className="admin-row-actions" style={{ marginTop: 18 }}><Link className="btn btn-light" href="/admin/action-center">My Work Today</Link><Link className="btn btn-light" href="/admin/outreach">Outreach Tasks</Link><Link className="btn btn-light" href="/admin/growth-opportunities?type=contact_enrichment">Contact Enrichment Opportunities</Link></div>
  </>
}
