import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { AdminEntityEditor } from '@/components/AdminEntityEditor'
import { AdminSavedViews } from '@/components/AdminSavedViews'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined
type Opportunity = {
  id: string
  opportunity_type?: string | null
  business_id?: string | null
  prospect_id?: string | null
  title?: string | null
  detail?: string | null
  score?: number | null
  estimated_monthly_value_cents?: number | null
  status?: string | null
  next_action?: string | null
  due_at?: string | null
  assigned_user_id?: string | null
  source_facts?: Record<string, unknown> | null
  last_refreshed_at?: string | null
  updated_at?: string | null
}

const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const titleCase = (value: string) => value.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
const priorityOf = (row: Opportunity) => String(row.source_facts?.priority || '').trim().toLowerCase()
const isInventoryResearch = (row: Opportunity) => row.opportunity_type === 'inventory_research'
const contactable = (row: Opportunity) => Boolean(row.source_facts?.contactable || row.source_facts?.has_owner_email || row.source_facts?.has_owner_phone)
const amount = (cents: number | null | undefined) => Number(cents || 0) > 0 ? `$${(Number(cents)/100).toLocaleString('en-US',{maximumFractionDigits:0})}/mo est.` : 'No value estimate'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  const sp = await searchParams
  const statusFilter = one(sp.status) || 'open'
  const typeFilter = one(sp.type)
  const priorityFilter = one(sp.priority)
  const dueFilter = one(sp.due)
  const contactFilter = one(sp.contact)
  const scoreFilter = Number(one(sp.min_score) || 0)
  const cfg = ADMIN_ENTITIES['growth-opportunities']
  const s = await createClient()
  const savedViewParams = Object.fromEntries([
    statusFilter !== 'open' ? ['status', statusFilter] : null,
    typeFilter ? ['type', typeFilter] : null,
    priorityFilter ? ['priority', priorityFilter] : null,
    dueFilter ? ['due', dueFilter] : null,
    contactFilter ? ['contact', contactFilter] : null,
    scoreFilter ? ['min_score', String(scoreFilter)] : null,
  ].filter(Boolean) as string[][])

  const { data, error } = await s
    .from('growth_opportunities')
    .select('id,opportunity_type,business_id,prospect_id,title,detail,score,estimated_monthly_value_cents,status,next_action,due_at,assigned_user_id,source_facts,last_refreshed_at,updated_at')
    .eq('tenant_id', TENANT_ID)
    .order('score',{ascending:false})
    .order('updated_at',{ascending:false})
    .limit(2500)

  const rows = (data ?? []) as unknown as Opportunity[]
  const now = Date.now()
  const open = rows.filter(row => row.status === 'open')
  const highScore = open.filter(row => Number(row.score || 0) >= 90)
  const unscheduled = open.filter(row => !row.due_at)
  const scheduled = open.filter(row => Boolean(row.due_at))
  const overdue = open.filter(row => Boolean(row.due_at) && new Date(String(row.due_at)).getTime() < now)
  const valued = open.filter(row => Number(row.estimated_monthly_value_cents || 0) > 0)
  const resolved = rows.filter(row => row.status === 'resolved')
  const openByType = (type:string) => open.filter(row => row.opportunity_type === type).length
  const inventoryOpen = openByType('inventory_research')
  const inventoryImmediate = open.filter(row => isInventoryResearch(row) && ['critical','immediate'].includes(priorityOf(row))).length
  const types = Array.from(new Set(rows.map(row => String(row.opportunity_type || '')).filter(Boolean))).sort()
  const statuses = Array.from(new Set(rows.map(row => String(row.status || '')).filter(Boolean))).sort()
  const priorities = Array.from(new Set(rows.map(priorityOf).filter(Boolean))).sort()

  let filtered = rows.filter(row => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false
    if (typeFilter && row.opportunity_type !== typeFilter) return false
    if (priorityFilter && priorityOf(row) !== priorityFilter) return false
    if (Number(row.score || 0) < scoreFilter) return false
    if (contactFilter && isInventoryResearch(row)) return false
    if (contactFilter === 'ready' && !contactable(row)) return false
    if (contactFilter === 'missing' && contactable(row)) return false
    const dueTime = row.due_at ? new Date(row.due_at).getTime() : null
    if (dueFilter === 'unscheduled' && dueTime !== null) return false
    if (dueFilter === 'scheduled' && dueTime === null) return false
    if (dueFilter === 'overdue' && !(dueTime !== null && dueTime < now && row.status === 'open')) return false
    return true
  })

  filtered = filtered.sort((a,b) => Number(b.score || 0)-Number(a.score || 0) || (a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY) - (b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY))
  const shown = filtered.slice(0,180)
  const editorRows = shown.map(row => ({
    id: row.id,
    opportunity_type: titleCase(String(row.opportunity_type || '')),
    title: row.title || '',
    score: Number(row.score || 0),
    source_priority: priorityOf(row) || '—',
    contact_path: isInventoryResearch(row) ? 'Not applicable' : contactable(row) ? 'Available' : 'Research needed',
    value_signal: amount(row.estimated_monthly_value_cents),
    next_action: row.next_action || '',
    due_at: row.due_at || '',
    status: row.status || '',
    assigned_user_id: row.assigned_user_id || '',
    source_facts: row.source_facts || {},
    last_refreshed_at: row.last_refreshed_at || '',
  }))
  const hasFilters = statusFilter !== 'open' || Boolean(typeFilter || priorityFilter || dueFilter || contactFilter || scoreFilter)

  return <>
    <div className="admin-page-head"><div><div className="kpi">Private Growth Operations</div><h1>Growth Opportunity Workbench</h1><p className="muted">Prioritize inventory research, claim activation, contact enrichment and separate Skylight marketing opportunities using generated source facts and staff-controlled workflow state. Opportunity scores are internal workflow signals and never affect public organic ranking.</p></div><span className="badge neutral">Internal only</span></div>
    {error && <div className="notice warn">Growth opportunities could not be fully loaded: {error.message}</div>}
    <div className="notice"><strong>Evidence rules:</strong> opportunity rows are signals, not proof of outreach, revenue, ownership, verification or provider eligibility. Inventory research requires current source evidence before a business or service area is added. Current records with no evidence-backed monetary estimate remain at $0 instead of being assigned invented revenue values.</div>

    <div className="stat-grid" style={{marginTop:18}}>
      <div className="stat">Open Opportunities<strong>{open.length}</strong></div>
      <div className="stat">Score 90+<strong>{highScore.length}</strong></div>
      <div className="stat">Inventory Research<strong>{inventoryOpen}</strong><span className="small muted">{inventoryImmediate} critical / immediate</span></div>
      <div className="stat">Claim Activation<strong>{openByType('claim_activation')}</strong></div>
      <div className="stat">Contact Enrichment<strong>{openByType('contact_enrichment')}</strong></div>
      <div className="stat">Skylight Marketing<strong>{openByType('skylight_marketing')}</strong></div>
      <div className="stat">Unscheduled Open<strong>{unscheduled.length}</strong></div>
      <div className="stat">Scheduled / Overdue<strong>{scheduled.length} / {overdue.length}</strong></div>
      <div className="stat">Evidence-Backed Value Estimates<strong>{valued.length}</strong></div>
      <div className="stat">Resolved<strong>{resolved.length}</strong></div>
    </div>

    <AdminSavedViews scope="growth-opportunities" basePath="/admin/growth-opportunities" queryParams={savedViewParams} />

    {inventoryOpen > 0 && <div className="admin-card" style={{marginTop:18}}>
      <div className="section-head compact-head"><div><div className="kpi">Inventory → Acquisition Loop</div><h2>Coverage gaps are now persistent staff work</h2><p className="small muted">One-provider-away and evidence-backed zero-provider demand gaps can be assigned, scheduled and resolved here. Use the coverage command center for live counts, then research the exact provider without fabricating a local office.</p></div><div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/growth-opportunities?type=inventory_research">Open Inventory Tasks</Link><Link className="btn btn-light" href="/admin/inventory-expansion">Market Coverage Command Center</Link></div></div>
    </div>}

    <div className="admin-card" style={{marginTop:18}}>
      <div className="section-head compact-head"><div><div className="kpi">Opportunity Filters</div><h2>Focus the next action</h2><p className="small muted">Default view shows open opportunities ordered by score. Use source priority to separate immediate coverage work from longer-term research. Contact readiness applies to business acquisition opportunities, not inventory-gap research.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/inventory-expansion">Coverage Command Center</Link><Link className="btn btn-light" href="/admin/outreach">Open Outreach Workbench</Link><Link className="btn btn-light" href="/admin/prospects">Open Sales CRM</Link>{hasFilters&&<Link className="btn btn-light" href="/admin/growth-opportunities">Reset</Link>}</div></div>
      <form method="get" className="grid grid-3" style={{alignItems:'end'}}>
        <label className="field"><span>Status</span><select name="status" defaultValue={statusFilter}><option value="all">All statuses</option>{statuses.map(value=><option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
        <label className="field"><span>Opportunity Type</span><select name="type" defaultValue={typeFilter}><option value="">All types</option>{types.map(value=><option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
        <label className="field"><span>Source Priority</span><select name="priority" defaultValue={priorityFilter}><option value="">All priorities</option>{priorities.map(value=><option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
        <label className="field"><span>Minimum Score</span><select name="min_score" defaultValue={String(scoreFilter||'')}><option value="">Any score</option><option value="90">90+</option><option value="80">80+</option><option value="70">70+</option><option value="50">50+</option></select></label>
        <label className="field"><span>Due State</span><select name="due" defaultValue={dueFilter}><option value="">Any due state</option><option value="unscheduled">Unscheduled</option><option value="scheduled">Scheduled</option><option value="overdue">Overdue</option></select></label>
        <label className="field"><span>Contact Path</span><select name="contact" defaultValue={contactFilter}><option value="">All acquisition opportunities</option><option value="ready">Contact path available</option><option value="missing">Contact research needed</option></select></label>
        <div><button className="btn btn-primary" type="submit">Apply Filters</button></div>
      </form>
    </div>

    <div className="admin-list-meta" style={{marginTop:18}}><span className="kpi">{filtered.length} matching opportunit{filtered.length===1?'y':'ies'} · showing {shown.length}</span><span className="small muted">Select records for safe staff assignment/due-date workflow actions. Status, due date and assignee remain staff-editable; source facts, score and next action remain generated context.</span></div>
    {editorRows.length ? <AdminEntityEditor section="growth-opportunities" cfg={cfg} rows={editorRows} /> : <div className="notice">No growth opportunities match the selected filters.</div>}
  </>
}
