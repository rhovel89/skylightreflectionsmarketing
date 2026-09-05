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
  const { data, error } = await s.rpc('get_revenue_command_center', { p_tenant_id: TENANT_ID })
  const payload = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as CommandCenter
  const m = payload.metrics ?? {}
  const buyers = arr(payload.buyers)
  const gaps = arr(payload.market_gaps)
  const prospects = arr(payload.skylight_prospects)
  const actions = arr(payload.today_actions)

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Private Executive Revenue Intelligence</div>
        <h1>Executive Revenue Command Center</h1>
        <p className="muted">Where should we focus today to protect cash flow, convert real demand, grow Lead Buyers, and create evidence-backed Skylight revenue opportunities?</p>
      </div>
      <div className="admin-row-actions">
        <Link className="btn btn-primary" href="/admin/lead-buyers">Lead Buyer CRM</Link>
        <Link className="btn btn-light" href="/admin/action-center">My Work Today</Link>
        <span className="badge sponsored">Super Admin only</span>
      </div>
    </div>

    {error ? <div className="notice warn"><strong>Revenue intelligence is temporarily incomplete.</strong> {error.message}</div> : null}
    <div className="notice"><strong>Decision-support only:</strong> this command center reads protected operating data and prioritizes work. It cannot auto-route a consumer lead, activate an agreement, create a lead charge, verify a business, create Sponsored placement, or alter organic ranking.</div>

    <div className="stat-grid" style={{ marginTop: 18 }}>
      <div className="stat">Lead Revenue · This Month<strong>{money(m.lead_revenue_month_cents)}</strong></div>
      <div className="stat">Collected · 30 Days<strong>{money(m.lead_revenue_30_cents)}</strong></div>
      <div className="stat">Collected · 90 Days<strong>{money(m.lead_revenue_90_cents)}</strong></div>
      <div className="stat">Open Receivables<strong>{money(m.open_receivables_cents)}</strong></div>
      <div className="stat">Overdue Receivables<strong>{money(m.overdue_receivables_cents)}</strong></div>
      <div className="stat">Active Lead Buyers<strong>{number(m.active_lead_buyers)}</strong></div>
      <div className="stat">Retention Attention<strong>{number(m.buyers_with_retention_attention)}</strong><span className="small muted">buyers with factual risk triggers</span></div>
      <div className="stat">Near Monthly Cap<strong>{number(m.buyers_near_monthly_cap)}</strong></div>
      <div className="stat">Remaining Lead Capacity<strong>{number(m.remaining_monthly_lead_capacity)}</strong></div>
      <div className="stat">Agreements Expiring ≤30d<strong>{number(m.agreements_expiring_30d)}</strong></div>
      <div className="stat">Evidence-Backed Growth Value<strong>{money(m.evidence_backed_growth_value_cents)}</strong><span className="small muted">monthly estimates only where supported</span></div>
      <div className="stat">Skylight First-Party Prospects<strong>{number(m.first_party_skylight_prospects)}</strong></div>
      <div className="stat">Demand Gaps · No Active Buyer<strong>{number(m.market_gaps_without_active_buyers)}</strong></div>
    </div>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div>
          <div className="kpi">Executive Priority Queue</div>
          <h2>What should I do today to make money?</h2>
          <p className="small muted">Highest-priority collections, explicit buyer follow-up, agreement review, renewals, market recruitment and evidence-backed growth work. Monetary values appear only when supported by actual agreement, CRM or opportunity data.</p>
        </div>
        <div className="admin-row-actions"><Link className="btn btn-light" href="/admin/growth-opportunities">Growth Queue</Link><Link className="btn btn-light" href="/admin/lead-billing">Lead Billing</Link></div>
      </div>
      {actions.length ? <div className="lead-route-list">
        {actions.slice(0, 15).map((action, index) => <div className="info-row" key={`${action.action_type || 'action'}-${action.entity_key || index}`}>
          <span>
            <strong>{action.title || 'Revenue action'}</strong>
            <small className="muted" style={{ display: 'block' }}>{action.detail || 'Review the underlying evidence before taking action.'}</small>
            <small className="muted" style={{ display: 'block' }}>{titleCase(action.action_type)} · priority {Number(action.priority || 0)}{Number(action.value_cents || 0) > 0 ? ` · ${money(action.value_cents)} supported value` : ''}</small>
          </span>
          <span className="admin-row-actions"><span className={`badge ${actionTone(action.priority)}`}>{Number(action.priority || 0) >= 96 ? 'Act now' : Number(action.priority || 0) >= 90 ? 'High' : 'Review'}</span><Link className="btn btn-light" href={String(action.href || '/admin/action-center')}>Open</Link></span>
        </div>)}
      </div> : <p className="muted">No revenue-priority actions are currently queued. As buyer, invoice, demand and growth data changes, this list will reprioritize automatically.</p>}
    </section>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div><div className="kpi">Lead Buyer Economics & Retention</div><h2>Buyer value, capacity and retention-attention signals</h2><p className="small muted">Retention attention is a factual operating signal—not a deterministic churn prediction. It increases for overdue balances, manual holds, agreements ending soon, or long delivery inactivity.</p></div>
        <div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/lead-buyers">Manage Buyers</Link><Link className="btn btn-light" href="/admin/lead-billing">Collections</Link></div>
      </div>
      {buyers.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Business</th><th>90d Collected</th><th>Leads 90d</th><th>Owner-Reported Jobs / Value</th><th>MTD Utilization</th><th>Remaining Cap</th><th>Receivables</th><th>Retention Attention</th><th>Agreement End</th></tr></thead><tbody>
        {buyers.map(row => <tr key={String(row.business_id)}><td><strong>{row.name || row.business_id}</strong><small className="muted" style={{ display: 'block' }}>{titleCase(row.billing_model)} · {titleCase(row.lead_sale_mode)}</small></td><td>{money(row.paid_90_cents)}</td><td>{number(row.delivered_90)}</td><td>{number(row.won_jobs_90)} / {money(row.owner_reported_job_value_90_cents)}<small className="muted" style={{ display: 'block' }}>analytics only</small></td><td>{pct(row.utilization_pct)}</td><td>{row.max_leads_per_month ? number(row.remaining_cap) : 'No cap set'}</td><td>{money(row.open_cents)}<small className="muted" style={{ display: 'block' }}>{Number(row.overdue_cents || 0) > 0 ? `${money(row.overdue_cents)} overdue` : 'current'}</small></td><td><span className={`badge ${retentionTone(row.retention_attention_score)}`}>{Number(row.retention_attention_score || 0)}</span></td><td>{date(row.agreement_ends_on)}</td></tr>)}
      </tbody></table></div> : <div className="notice"><strong>No active billable Lead Buyer programs currently exist.</strong> The command center is ready; buyer economics, capacity and retention metrics will populate only after an explicitly reviewed agreement becomes active.</div>}
    </section>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div><div className="kpi">Demand → Monetizable Supply</div><h2>Where consumer demand outruns qualified provider / buyer coverage</h2><p className="small muted">Coverage requires a matching category plus an active physical location or separately labeled service area. A service area is not treated as an office. Sponsored status and paid plans are excluded from provider coverage.</p></div>
        <Link className="btn btn-light" href="/admin/inventory-expansion">Inventory Expansion</Link>
      </div>
      {gaps.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Service</th><th>City</th><th>Leads · 90d</th><th>Published Providers</th><th>Active Buyers</th><th>Demand Pressure</th><th>Revenue Opportunity</th></tr></thead><tbody>
        {gaps.slice(0, 30).map((row, index) => <tr key={`${row.service_key || row.service}-${row.city_key || row.city}-${index}`}><td>{row.service}</td><td>{row.city}</td><td>{number(row.demand_90)}</td><td>{number(row.providers)}</td><td>{number(row.active_buyers)}</td><td>{Number(row.demand_pressure || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}×</td><td>{Number(row.active_buyers || 0) === 0 && Number(row.demand_90 || 0) >= 2 ? <span className="badge sponsored">Recruit buyer / supply</span> : Number(row.providers || 0) === 0 ? <span className="badge verified">Provider gap</span> : <span className="badge neutral">Monitor</span>}</td></tr>)}
      </tbody></table></div> : <p className="muted">No service/city demand pairs currently meet the command-center threshold. This does not mean the network is complete; it means the recent lead data does not yet identify a qualifying gap.</p>}
    </section>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="section-head compact-head">
        <div><div className="kpi">Skylight Opportunity Engine 2.0</div><h2>First-party marketing opportunities already inside the directory</h2><p className="small muted">Signals come from current directory facts—missing website, low profile completion, missing catalog/portfolio, strong reviews with weak web presence, or visibility without conversion. They are internal Skylight sales intelligence only.</p></div>
        <div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/prospects">Skylight Sales CRM</Link><Link className="btn btn-light" href="/admin/growth-opportunities?type=skylight_marketing">Marketing Opportunities</Link></div>
      </div>
      {prospects.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Business</th><th>Evidence Signals</th><th>Contact Path</th><th>Opportunity Score</th><th>Supported Value</th><th>Status</th></tr></thead><tbody>
        {prospects.slice(0, 30).map(row => <tr key={String(row.prospect_id)}><td><strong>{row.business_name || row.business_id}</strong></td><td><div className="admin-row-actions" style={{ flexWrap: 'wrap' }}>{signals(row.signals).slice(0, 5).map(signal => <span className="badge neutral" key={signal}>{titleCase(signal)}</span>)}</div></td><td>{row.owner_contact_email || row.owner_contact_phone ? <span className="badge verified">Available</span> : <span className="badge neutral">Research needed</span>}</td><td>{row.score ? Number(row.score) : '—'}</td><td>{Number(row.estimated_monthly_value_cents || 0) > 0 ? `${money(row.estimated_monthly_value_cents)}/mo` : 'Not estimated'}</td><td>{titleCase(row.opportunity_status || 'signal only')}</td></tr>)}
      </tbody></table></div> : <p className="muted">No first-party Skylight opportunity signals are currently available.</p>}
      <div className="notice" style={{ marginTop: 14 }}><strong>Sales separation:</strong> a Skylight marketing signal is not a directory-quality penalty and does not change the business's public ranking, verification, claim state, Sponsored eligibility, lead routing or customer-facing profile.</div>
    </section>

    <div className="grid grid-2" style={{ marginTop: 18 }}>
      <section className="admin-card"><div className="kpi">Revenue Guardrails</div><h2>What this system will never assume</h2><div className="lead-route-list"><div className="info-row"><span>Owner says “send me more leads”</span><strong>≠ billing authorization</strong></div><div className="info-row"><span>Agreement draft / Ready for Review</span><strong>≠ active program</strong></div><div className="info-row"><span>Paid / Sponsored placement</span><strong>≠ verification or organic rank</strong></div><div className="info-row"><span>Service area</span><strong>≠ physical office</strong></div><div className="info-row"><span>Owner-reported job value</span><strong>analytics only</strong></div><div className="info-row"><span>Consumer lead</span><strong>Admin review first</strong></div></div></section>
      <section className="admin-card"><div className="kpi">Operator Shortcuts</div><h2>Move from intelligence to controlled action</h2><div className="lead-route-list"><div className="info-row"><span>Lead Buyer conversion + agreements</span><Link className="btn btn-light" href="/admin/lead-buyers">Open</Link></div><div className="info-row"><span>Lead billing + collections</span><Link className="btn btn-light" href="/admin/lead-billing">Open</Link></div><div className="info-row"><span>Skylight growth opportunities</span><Link className="btn btn-light" href="/admin/growth-opportunities">Open</Link></div><div className="info-row"><span>Sales CRM / prospect research</span><Link className="btn btn-light" href="/admin/prospects">Open</Link></div><div className="info-row"><span>Provider inventory expansion</span><Link className="btn btn-light" href="/admin/inventory-expansion">Open</Link></div><div className="info-row"><span>General staff action center</span><Link className="btn btn-light" href="/admin/action-center">Open</Link></div></div></section>
    </div>

    {payload.generated_at ? <p className="small muted" style={{ marginTop: 18 }}>Command-center snapshot generated {new Date(payload.generated_at).toLocaleString()}.</p> : null}
  </>
}
