import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { AdminEntityEditor } from '@/components/AdminEntityEditor'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined
type Prospect = {
  id?: string | null
  business_id?: string | null
  business_name?: string | null
  category?: string | null
  city?: string | null
  priority?: string | null
  crm_stage?: string | null
  status?: string | null
  owner_contact_name?: string | null
  owner_contact_title?: string | null
  owner_contact_email?: string | null
  owner_contact_phone?: string | null
  last_contacted_at?: string | null
  claim_invite_sent_at?: string | null
  marketing_pitch_sent_at?: string | null
}
type Task = {
  id: string
  prospect_id?: string | null
  task_type?: string | null
  due_at?: string | null
  status?: string | null
  notes?: string | null
  created_at?: string | null
  completed_at?: string | null
  business_prospects?: Prospect | Prospect[] | null
}

const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const titleCase = (value: string) => value.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const asProspect = (value: Task['business_prospects']): Prospect => Array.isArray(value) ? value[0] ?? {} : value ?? {}
const isActionable = (status: string | null | undefined) => ['open','in_progress'].includes(String(status || ''))
const stamp = (value: string | null | undefined) => value ? new Date(value).getTime() : Number.POSITIVE_INFINITY
const fmt = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not scheduled'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  const sp = await searchParams
  const statusFilter = one(sp.status) || 'actionable'
  const typeFilter = one(sp.type)
  const priorityFilter = one(sp.priority)
  const cityFilter = one(sp.city)
  const contactFilter = one(sp.contact)
  const cfg = ADMIN_ENTITIES.outreach
  const s = await createClient()

  const { data, error } = await s
    .from('outreach_tasks')
    .select('id,prospect_id,task_type,due_at,status,notes,created_at,completed_at,business_prospects!inner(id,business_id,business_name,category,city,priority,crm_stage,status,owner_contact_name,owner_contact_title,owner_contact_email,owner_contact_phone,last_contacted_at,claim_invite_sent_at,marketing_pitch_sent_at)')
    .eq('tenant_id', TENANT_ID)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(2000)

  const tasks = (data ?? []) as unknown as Task[]
  const now = Date.now()
  const sevenDays = now + 7 * 86400000
  const prospectFor = (task: Task) => asProspect(task.business_prospects)
  const hasContact = (prospect: Prospect) => Boolean(String(prospect.owner_contact_email || '').trim() || String(prospect.owner_contact_phone || '').trim())

  const openTasks = tasks.filter(task => isActionable(task.status))
  const overdue = openTasks.filter(task => Boolean(task.due_at) && stamp(task.due_at) < now)
  const dueSoon = openTasks.filter(task => Boolean(task.due_at) && stamp(task.due_at) >= now && stamp(task.due_at) <= sevenDays)
  const unscheduled = openTasks.filter(task => !task.due_at)
  const contactResearch = openTasks.filter(task => task.task_type === 'contact_research')
  const claimInvites = openTasks.filter(task => task.task_type === 'claim_invite')
  const marketingOutreach = openTasks.filter(task => task.task_type === 'marketing_outreach')
  const contactReady = openTasks.filter(task => hasContact(prospectFor(task)))

  const taskTypes = Array.from(new Set(tasks.map(task => String(task.task_type || '')).filter(Boolean))).sort()
  const statuses = Array.from(new Set(tasks.map(task => String(task.status || '')).filter(Boolean))).sort()
  const priorities = Array.from(new Set(tasks.map(task => String(prospectFor(task).priority || '')).filter(Boolean))).sort()
  const cities = Array.from(new Set(tasks.map(task => String(prospectFor(task).city || '')).filter(Boolean))).sort()

  let filtered = tasks.filter(task => {
    const prospect = prospectFor(task)
    if (statusFilter === 'actionable' && !isActionable(task.status)) return false
    if (statusFilter && statusFilter !== 'actionable' && statusFilter !== 'all' && task.status !== statusFilter) return false
    if (typeFilter && task.task_type !== typeFilter) return false
    if (priorityFilter && prospect.priority !== priorityFilter) return false
    if (cityFilter && prospect.city !== cityFilter) return false
    if (contactFilter === 'ready' && !hasContact(prospect)) return false
    if (contactFilter === 'missing' && hasContact(prospect)) return false
    return true
  })

  // Actionable work is ordered by overdue first, then scheduled work, then unscheduled tasks.
  filtered = filtered.sort((a,b) => {
    const aAction = isActionable(a.status) ? 0 : 1
    const bAction = isActionable(b.status) ? 0 : 1
    if (aAction !== bAction) return aAction - bAction
    const aDue = stamp(a.due_at)
    const bDue = stamp(b.due_at)
    if (aDue !== bDue) return aDue - bDue
    return stamp(a.created_at) - stamp(b.created_at)
  })

  const shown = filtered.slice(0,150)
  const editorRows = shown.map(task => {
    const prospect = prospectFor(task)
    const contact = [prospect.owner_contact_name,prospect.owner_contact_title,prospect.owner_contact_email,prospect.owner_contact_phone].filter(Boolean).join(' · ') || 'Contact research needed'
    const sentEvidence = [
      prospect.claim_invite_sent_at ? `Claim invite: ${fmt(prospect.claim_invite_sent_at)}` : '',
      prospect.marketing_pitch_sent_at ? `Marketing: ${fmt(prospect.marketing_pitch_sent_at)}` : '',
    ].filter(Boolean).join(' · ') || 'No sent timestamp recorded'
    const urgency = isActionable(task.status)
      ? !task.due_at ? 'Unscheduled' : stamp(task.due_at) < now ? 'OVERDUE' : stamp(task.due_at) <= sevenDays ? 'Due ≤ 7 days' : 'Scheduled'
      : titleCase(String(task.status || 'closed'))
    return {
      id: task.id,
      business: prospect.business_name || 'Unknown prospect',
      city: prospect.city || '',
      category: prospect.category || '',
      priority: prospect.priority || '',
      crm_stage: prospect.crm_stage || '',
      contact,
      sent_evidence: sentEvidence,
      urgency,
      task_type: task.task_type || '',
      due_at: task.due_at || '',
      status: task.status || '',
      notes: task.notes || '',
      created_at: task.created_at || '',
      completed_at: task.completed_at || '',
    }
  })

  const hasFilters = statusFilter !== 'actionable' || Boolean(typeFilter || priorityFilter || cityFilter || contactFilter)

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Private Sales Operations</div>
        <h1>Actionable Outreach Workbench</h1>
        <p className="muted">Work contact research, claim invitations and Skylight marketing follow-up with prospect context beside each task. A task is planned work—not evidence that a message or call occurred.</p>
      </div>
      <span className="badge sponsored">Manual outreach only</span>
    </div>

    {error && <div className="notice warn">Outreach data could not be fully loaded: {error.message}</div>}
    <div className="notice"><strong>No automatic sending:</strong> this workbench does not email, text or call prospects. Claim-invite and marketing sent timestamps remain evidence fields and should only be populated by workflows that actually performed the outreach.</div>

    <div className="stat-grid" style={{marginTop:18}}>
      <div className="stat">Actionable Tasks<strong>{openTasks.length}</strong></div>
      <div className="stat">Overdue<strong>{overdue.length}</strong></div>
      <div className="stat">Due ≤ 7 Days<strong>{dueSoon.length}</strong></div>
      <div className="stat">Unscheduled<strong>{unscheduled.length}</strong></div>
      <div className="stat">Contact Research<strong>{contactResearch.length}</strong></div>
      <div className="stat">Claim Invites<strong>{claimInvites.length}</strong></div>
      <div className="stat">Marketing Outreach<strong>{marketingOutreach.length}</strong></div>
      <div className="stat">Tasks With Contact Path<strong>{contactReady.length}</strong></div>
    </div>

    <div className="admin-card" style={{marginTop:18}}>
      <div className="section-head compact-head">
        <div><div className="kpi">Queue Filters</div><h2>Choose the work to perform</h2><p className="small muted">Default view shows open and in-progress tasks. Filtering changes the staff workbench only; it does not alter public listings, organic ranking or outreach evidence.</p></div>
        <div className="admin-row-actions"><Link className="btn btn-light" href="/admin/prospects">Open Sales CRM</Link>{hasFilters&&<Link className="btn btn-light" href="/admin/outreach">Reset</Link>}</div>
      </div>
      <form method="get" className="grid grid-3" style={{alignItems:'end'}}>
        <label className="field"><span>Status</span><select name="status" defaultValue={statusFilter}><option value="actionable">Actionable (Open + In Progress)</option><option value="all">All statuses</option>{statuses.map(value=><option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
        <label className="field"><span>Task Type</span><select name="type" defaultValue={typeFilter}><option value="">All task types</option>{taskTypes.map(value=><option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
        <label className="field"><span>Priority</span><select name="priority" defaultValue={priorityFilter}><option value="">All priorities</option>{priorities.map(value=><option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
        <label className="field"><span>City / Market</span><select name="city" defaultValue={cityFilter}><option value="">All markets</option>{cities.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label className="field"><span>Contact Path</span><select name="contact" defaultValue={contactFilter}><option value="">All</option><option value="ready">Email or phone available</option><option value="missing">Contact research still needed</option></select></label>
        <div><button className="btn btn-primary" type="submit">Apply Filters</button></div>
      </form>
    </div>

    <div className="admin-list-meta" style={{marginTop:18}}>
      <span className="kpi">{filtered.length} matching task{filtered.length===1?'':'s'} · showing {shown.length}</span>
      <span className="small muted">Overdue and nearest scheduled work sorts first. Edit due date, status and notes directly below.</span>
    </div>

    {editorRows.length
      ? <AdminEntityEditor section="outreach" cfg={cfg} rows={editorRows} />
      : <div className="notice">No outreach tasks match the selected filters.</div>}
  </>
}
