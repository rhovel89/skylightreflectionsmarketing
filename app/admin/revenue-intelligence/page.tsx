import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type JsonRecord = Record<string, any>
type Metrics = {
  lead_revenue_month_cents?: number
  lead_revenue_30_cents?: number
  lead_revenue_90_cents?: number
  open_receivables_cents?: number
  overdue_receivables_cents?: number
  active_lead_buyers?: number
  buyers_with_retention_attention?: number
  buyers_near_monthly_cap?: number
  remaining_monthly_lead_capacity?: number
  agreements_expiring_30d?: number
  evidence_backed_growth_value_cents?: number
  first_party_skylight_prospects?: number
  market_gaps_without_active_buyers?: number
}

type CommandCenter = {
  generated_at?: string
  metrics?: Metrics
  buyers?: JsonRecord[]
  market_gaps?: JsonRecord[]
  skylight_prospects?: JsonRecord[]
  today_actions?: JsonRecord[]
}

type SalesMetrics = {
  active_sales_opportunities?: number
  hot_high?: number
  contact_ready?: number
  research_needed?: number
  followups_due?: number
  qualified?: number
  proposals?: number
  won?: number
  pipeline_estimate_cents?: number
  actual_attributed_revenue_30_cents?: number
  actual_attributed_revenue_90_cents?: number
  actual_attributed_revenue_lifetime_cents?: number
  lead_buyer_recruitment_candidates?: number
  lead_buyer_recruitment_contact_ready?: number
  lead_buyer_recruitment_research_needed?: number
}

type SalesIntelligence = {
  generated_at?: string
  metrics?: SalesMetrics
  stage_counts?: Record<string, number>
  priority_counts?: Record<string, number>
  top_actions?: JsonRecord[]
}

const money = (cents: unknown) => `$${(Number(cents || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const number = (value: unknown) => Number(value || 0).toLocaleString('en-US')
const pct = (value: unknown) => value === null || value === undefined || value === '' ? '—' : `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
const date = (value: unknown) => {
  if (!value) return '—'
  const d = new Date(String(value).length === 10 ? `${value}T12:00:00` : String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const titleCase = (value: unknown) => String(value || '').replace(/^first_party:/, '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase())
const arr = (value: unknown): JsonRecord[] => Array.isArray(value) ? value as JsonRecord[] : []
const signals = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : []
const actionTone = (priority: unknown) => Number(priority || 0) >= 96 ? 'sponsored' : Number(priority || 0) >= 90 ? 'verified' : 'neutral'
const retentionTone = (score: unknown) => Number(score || 0) >= 60 ? 'sponsored' : Number(score || 0) >= 40 ? 'verified' : 'neutral'

export default async function Page() {
  await requireSuperAdmin('/admin/revenue-intelligence')
  const s = await createClient()
  const [commandResult, salesResult] = await Promise.all([
    s.rpc('get_revenue_command_center', { p_tenant_id: TENANT_ID }),
    s.rpc('get_sales_revenue_intelligence', { p_tenant_id: TENANT_ID }),
  ])

  const payload = (commandResult.data && typeof commandResult.data === 'object' && !Array.isArray(commandResult.data) ? commandResult.data : {}) as CommandCenter
  const sales = (salesResult.data && typeof salesResult.data === 'object' && !Array.isArray(salesResult.data) ? salesResult.data : {}) as SalesIntelligence
  const m = payload.metrics ?? {}
  const sm = sales.metrics ?? {}
  const buyers = arr(payload.buyers)
  const gaps = arr(payload.market_gaps)
  const prospects = arr(payload.skylight_prospects)
  const actions = arr(payload.today_actions)
  const salesActions = arr(sales.top_actions)

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Private Executive Revenue Intelligence</div>
        <h1>Executive Revenue Command Center 3.2</h1>
        <p className="muted">Protect cash flow, convert real Local Pros demand, grow Lead Buyers, and move evidence-backed Skylight opportunities from research to attributable revenue.</p>
      </div>
      <div className="admin-row-actions">
        <Link className="btn btn-primary" href="/admin/skylight-sales">Skylight Sales</Link>
        <Link className="btn btn-light" href="/admin/lead-buyers">Lead Buyer CRM</Link>
        <Link className="btn btn-light" href="/admin/action-center">My Work Today</Link>
        <span className="badge sponsored">Super Admin only</span>
      </div>
    </div>

    {commandResult.error || salesResult.error ? <div className="notice warn"><strong>Some revenue intelligence is temporarily incomplete.</strong> {[commandResult.error?.message, salesResult.error?.message].filter(Boolean).join(' · ')}</div> : null}
    <div className="notice"><strong>Decision-support only:</strong> these private metrics cannot auto-route a consumer lead, send sales outreach, activate an agreement, create a lead charge, verify a business, create Sponsored placement, or alter organic ranking.</div>

    <div className="stat-grid" style={{ marginTop: 18 }}>
      <div className="stat">Lead Revenue · This Month<strong>{money(m.lead_revenue_month_cents)}</strong></div>
      <div className="stat">Lead Revenue · 90 Days<strong>{money(m.lead_revenue_90_cents)}</strong></div>
      <div className="stat">Open Lead Receivables<strong>{money(m.open_receivables_cents)}</strong></div>
      <div className="stat">Overdue Lead Receivables<strong>{money(m.overdue_receivables_cents)}</strong></div>
      <div className="stat">Active Lead Buyers<strong>{number(m.active_lead_buyers)}</strong></div>
      <div className="stat">Remaining Lead Capacity<strong>{number(m.remaining_monthly_lead_capacity)}</strong></div>
      <div className="stat">Skylight Attributed Cash · 30d<strong>{money(sm.actual_attributed_revenue_30_cents)}</strong><span className="small muted">recorded payments less refunds</span></div>
      <div className="stat">Skylight Attributed Cash · 90d<strong>{money(sm.actual_attributed_revenue_90_cents)}</strong><span className="small muted">linked invoices only</span></div>
      <div className="stat">Skylight Active Pipeline<strong>{number(sm.active_sales_opportunities)}</strong></div>
      <div className="stat">Skylight Contact Ready<strong>{number(sm.contact_ready)}</strong><span className="small muted">sourced owner / decision-maker contact</span></div>
      <div className="stat">Skylight Research Needed<strong>{number(sm.research_needed)}</strong></div>
      <div className="stat">Sales Follow-Ups Due<strong>{number(sm.followups_due)}</strong></div>
      <div className="stat">Pipeline Estimate<strong>{money(sm.pipeline_estimate_cents)}</strong><span className="small muted">manual/private estimates only</span></div>
      <div className="stat">Buyer Recruitment Candidates<strong>{number(sm.lead_buyer_recruitment_candidates)}</strong></div>
      <div className="stat">Demand Gaps · No Active Buyer<strong>{number(m.market_gaps_without_active_buyers)}</strong></div>
    </div>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div>
          <div className="kpi">Executive Priority Queue</div>
          <h2>What should I do today to make money?</h2>
          <p className="small muted">Collections, explicit buyer follow-up, controlled agreement review, renewals and evidence-backed growth work. Dollar values appear only when supported by recorded pricing or opportunity data.</p>
        </div>
        <div className="admin-row-actions"><Link className="btn btn-light" href="/admin/growth-opportunities">Growth Queue</Link><Link className="btn btn-light" href="/admin/lead-billing">Lead Billing</Link></div>
      </div>
      {actions.length ? <div className="lead-route-list">
        {actions.slice(0, 15).map((action, index) => <div className="info-row" key={`${action.action_type || 'action'}-${action.entity_key || index}`}>
          <span><strong>{action.title || 'Revenue action'}</strong><small className="muted" style={{ display: 'block' }}>{action.detail || 'Review the underlying evidence before taking action.'}</small><small className="muted" style={{ display: 'block' }}>{titleCase(action.action_type)} · priority {Number(action.priority || 0)}{Number(action.value_cents || 0) > 0 ? ` · ${money(action.value_cents)} supported value` : ''}</small></span>
          <span className="admin-row-actions"><span className={`badge ${actionTone(action.priority)}`}>{Number(action.priority || 0) >= 96 ? 'Act now' : Number(action.priority || 0) >= 90 ? 'High' : 'Review'}</span><Link className="btn btn-light" href={String(action.href || '/admin/action-center')}>Open</Link></span>
        </div>)}
      </div> : <p className="muted">No revenue-priority actions are currently queued.</p>}
    </section>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div><div className="kpi">Skylight Sales Pipeline</div><h2>From factual signal to attributable cash</h2><p className="small muted">Contact Ready requires a sourced owner/decision-maker channel. Research Needed means outreach provenance is incomplete. Zero estimated value does not mean zero opportunity—it means a staff member has not entered a supported project estimate.</p></div>
        <Link className="btn btn-primary" href="/admin/skylight-sales">Open Sales Command Center</Link>
      </div>
      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <div className="stat">Hot / High<strong>{number(sm.hot_high)}</strong></div>
        <div className="stat">Contact Ready<strong>{number(sm.contact_ready)}</strong></div>
        <div className="stat">Qualified<strong>{number(sm.qualified)}</strong></div>
        <div className="stat">Proposal<strong>{number(sm.proposals)}</strong></div>
        <div className="stat">Won<strong>{number(sm.won)}</strong></div>
        <div className="stat">Buyer Contact Ready<strong>{number(sm.lead_buyer_recruitment_contact_ready)}</strong></div>
      </div>
      {salesActions.length ? <div className="lead-route-list">
        {salesActions.slice(0, 12).map((action, index) => <div className="info-row" key={`${action.action_type}-${action.entity_key || index}`}>
          <span><strong>{action.title || 'Sales action'}</strong><small className="muted" style={{ display: 'block' }}>{action.detail}</small><small className="muted" style={{ display: 'block' }}>{titleCase(action.action_type)} · priority {number(action.priority)}{Number(action.value_cents || 0) > 0 ? ` · ${money(action.value_cents)} ${action.value_is_estimate ? 'estimate' : 'recorded value'}` : ''}</small></span>
          <span className="admin-row-actions"><span className={`badge ${actionTone(action.priority)}`}>{Number(action.priority || 0) >= 96 ? 'Due' : Number(action.priority || 0) >= 90 ? 'High' : 'Review'}</span><Link className="btn btn-light" href={String(action.href || '/admin/skylight-sales')}>Open</Link></span>
        </div>)}
      </div> : <div className="notice"><strong>No sales action is currently due.</strong> The pipeline still contains research-stage opportunities; those remain in the Sales Command Center rather than flooding the daily executive queue.</div>}
      <div className="notice" style={{ marginTop: 14 }}><strong>Actual vs estimate:</strong> attributed cash is calculated only from recorded Skylight invoice payments linked through a Sales opportunity invoice. Pipeline estimate is separate planning data and never becomes recognized revenue automatically.</div>
    </section>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div><div className="kpi">Lead Buyer Economics & Retention</div><h2>Buyer value, capacity and retention-attention signals</h2><p className="small muted">Retention attention is an operating heuristic—not a deterministic churn prediction. It increases for factual triggers such as overdue balances, manual holds, agreements ending soon or delivery inactivity.</p></div>
        <div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/lead-buyers">Manage Buyers</Link><Link className="btn btn-light" href="/admin/lead-billing">Collections</Link></div>
      </div>
      {buyers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Business</th><th>90d Collected</th><th>Leads 90d</th><th>Owner-Reported Jobs / Value</th><th>MTD Utilization</th><th>Remaining Cap</th><th>Receivables</th><th>Retention Attention</th><th>Agreement End</th></tr></thead><tbody>
        {buyers.map(row => <tr key={String(row.business_id)}><td><strong>{row.name || row.business_id}</strong><small className="muted" style={{ display: 'block' }}>{titleCase(row.billing_model)} · {titleCase(row.lead_sale_mode)}</small></td><td>{money(row.paid_90_cents)}</td><td>{number(row.delivered_90)}</td><td>{number(row.won_jobs_90)} / {money(row.owner_reported_job_value_90_cents)}<small className="muted" style={{ display: 'block' }}>analytics only</small></td><td>{pct(row.utilization_pct)}</td><td>{row.max_leads_per_month ? number(row.remaining_cap) : 'No cap set'}</td><td>{money(row.open_cents)}<small className="muted" style={{ display: 'block' }}>{Number(row.overdue_cents || 0) > 0 ? `${money(row.overdue_cents)} overdue` : 'current'}</small></td><td><span className={`badge ${retentionTone(row.retention_attention_score)}`}>{Number(row.retention_attention_score || 0)}</span></td><td>{date(row.agreement_ends_on)}</td></tr>)}
      </tbody></table></div> : <div className="notice"><strong>No active billable Lead Buyer programs currently exist.</strong> Buyer economics will populate only after an explicitly reviewed agreement becomes active.</div>}
    </section>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div><div className="kpi">Demand → Monetizable Supply</div><h2>Where consumer demand outruns provider / buyer coverage</h2><p className="small muted">Coverage requires a matching category plus an active physical location or separately labeled service area. A service area is not treated as an office. Sponsored status and paid plans are excluded from provider coverage.</p></div>
        <Link className="btn btn-light" href="/admin/inventory-expansion">Inventory Expansion</Link>
      </div>
      {gaps.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Service</th><th>City</th><th>Leads · 90d</th><th>Published Providers</th><th>Active Buyers</th><th>Demand Pressure</th><th>Revenue Opportunity</th></tr></thead><tbody>
        {gaps.slice(0, 30).map((row, index) => <tr key={`${row.service_key || row.service}-${row.city_key || row.city}-${index}`}><td>{row.service}</td><td>{row.city}</td><td>{number(row.demand_90)}</td><td>{number(row.providers)}</td><td>{number(row.active_buyers)}</td><td>{Number(row.demand_pressure || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}×</td><td>{Number(row.active_buyers || 0) === 0 && Number(row.demand_90 || 0) >= 2 ? <span className="badge sponsored">Recruit buyer / supply</span> : Number(row.providers || 0) === 0 ? <span className="badge verified">Provider gap</span> : <span className="badge neutral">Monitor</span>}</td></tr>)}
      </tbody></table></div> : <p className="muted">No service/city demand pairs currently meet the command-center threshold.</p>}
    </section>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div><div className="kpi">Skylight Opportunity Engine</div><h2>First-party marketing opportunities inside the directory</h2><p className="small muted">Signals come from current directory facts such as missing website, low profile completion, missing catalog/portfolio, strong reviews with weak web presence, or visibility without conversion. They are private sales intelligence only.</p></div>
        <div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/skylight-sales">Sales Command Center</Link><Link className="btn btn-light" href="/admin/prospects">Prospect CRM</Link></div>
      </div>
      {prospects.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Business</th><th>Evidence Signals</th><th>Contact Record</th><th>Opportunity Score</th><th>Supported Value</th><th>Status</th></tr></thead><tbody>
        {prospects.slice(0, 30).map(row => <tr key={String(row.prospect_id)}><td><strong>{row.business_name || row.business_id}</strong></td><td><div className="admin-row-actions" style={{ flexWrap: 'wrap' }}>{signals(row.signals).slice(0, 5).map(signal => <span className="badge neutral" key={signal}>{titleCase(signal)}</span>)}</div></td><td>{row.owner_contact_email || row.owner_contact_phone ? <span className="badge neutral">Recorded</span> : <span className="badge neutral">Research needed</span>}</td><td>{row.score ? Number(row.score) : '—'}</td><td>{Number(row.estimated_monthly_value_cents || 0) > 0 ? `${money(row.estimated_monthly_value_cents)}/mo` : 'Not estimated'}</td><td>{titleCase(row.opportunity_status || 'signal only')}</td></tr>)}
      </tbody></table></div> : <p className="muted">No first-party Skylight opportunity signals are currently available.</p>}
      <div className="notice" style={{ marginTop: 14 }}><strong>Sales separation:</strong> a Skylight marketing signal or sales stage is not a directory-quality penalty and does not change public ranking, verification, claim state, Sponsored eligibility, lead routing or the customer-facing profile.</div>
    </section>

    <div className="grid grid-2" style={{ marginTop: 18 }}>
      <section className="admin-card"><div className="kpi">Revenue Guardrails</div><h2>What this system will never assume</h2><div className="lead-route-list"><div className="info-row"><span>Owner says “send me more leads”</span><strong>≠ billing authorization</strong></div><div className="info-row"><span>Agreement draft / Ready for Review</span><strong>≠ active program</strong></div><div className="info-row"><span>Paid / Sponsored placement</span><strong>≠ verification or organic rank</strong></div><div className="info-row"><span>Service area</span><strong>≠ physical office</strong></div><div className="info-row"><span>Sales pipeline estimate</span><strong>≠ actual revenue</strong></div><div className="info-row"><span>Owner-reported job value</span><strong>analytics only</strong></div><div className="info-row"><span>Consumer lead</span><strong>Admin review first</strong></div></div></section>
      <section className="admin-card"><div className="kpi">Operator Shortcuts</div><h2>Move from intelligence to controlled action</h2><div className="lead-route-list"><div className="info-row"><span>Skylight Sales Command Center</span><Link className="btn btn-light" href="/admin/skylight-sales">Open</Link></div><div className="info-row"><span>Lead Buyer conversion + agreements</span><Link className="btn btn-light" href="/admin/lead-buyers">Open</Link></div><div className="info-row"><span>Lead billing + collections</span><Link className="btn btn-light" href="/admin/lead-billing">Open</Link></div><div className="info-row"><span>Growth opportunities</span><Link className="btn btn-light" href="/admin/growth-opportunities">Open</Link></div><div className="info-row"><span>Prospect research</span><Link className="btn btn-light" href="/admin/prospects">Open</Link></div><div className="info-row"><span>General staff action center</span><Link className="btn btn-light" href="/admin/action-center">Open</Link></div></div></section>
    </div>

    {payload.generated_at || sales.generated_at ? <p className="small muted" style={{ marginTop: 18 }}>Command-center snapshots generated {new Date(String(sales.generated_at || payload.generated_at)).toLocaleString()}.</p> : null}
  </>
}
