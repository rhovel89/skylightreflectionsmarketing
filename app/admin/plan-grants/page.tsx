import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { grantBusinessPlanAccess, revokeBusinessPlanAccess } from './actions'

export const dynamic = 'force-dynamic'
type SearchValue = string | string[] | undefined
type Row = Record<string, any>
const one = (v: SearchValue) => Array.isArray(v) ? v[0] ?? '' : v ?? ''
const titleCase = (v: unknown) => String(v ?? '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase())
const dateOnly = (v: unknown) => {
  if (!v) return '—'
  const d = new Date(`${String(v).slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const sourceLabel = (source: string) => ({ admin_trial: 'Admin Trial', admin_complimentary: 'Permanent Complimentary', paid_subscription: 'Paid Subscription', free: 'Free' } as Record<string, string>)[source] || titleCase(source)
const related = (v: any) => Array.isArray(v) ? v[0] : v
const chicagoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  await requireAdmin('/admin/plan-grants')
  const sp = await searchParams
  const q = one(sp.q).trim().slice(0, 100)
  const selectedId = one(sp.business).trim()
  const s = await createClient()

  let searchQuery = s.from('businesses').select('id,name,slug,status,claimed,verified').eq('tenant_id', TENANT_ID).order('name').limit(40)
  if (q) searchQuery = searchQuery.ilike('name', `%${q}%`)
  const { data: searchRows, error: searchError } = await searchQuery

  let selected: Row | null = null
  if (selectedId) {
    const { data } = await s.from('businesses').select('id,name,slug,status,claimed,verified').eq('tenant_id', TENANT_ID).eq('id', selectedId).maybeSingle()
    selected = data as Row | null
  }

  let access: Row = {}
  let history: Row[] = []
  let grantError: string | null = null
  if (selected) {
    const [{ data: accessData, error: accessError }, { data: grantRows, error: historyError }] = await Promise.all([
      s.rpc('get_business_plan_access', { p_business_id: selected.id }),
      s.from('business_plan_grants').select('id,business_id,plan_id,grant_kind,starts_on,ends_on,status,admin_note,granted_by,revoked_at,revoked_by,created_at,plans(name,slug)').eq('business_id', selected.id).order('created_at', { ascending: false }).limit(30),
    ])
    access = (accessData ?? {}) as Row
    history = (grantRows ?? []) as Row[]
    grantError = accessError?.message || historyError?.message || null
  }

  const currentGrant = history.find(row => row.status === 'active')
  const grantState = String(access.grant_state || 'none')
  const effectivePlan = String(access.effective_plan_name || 'Free')
  const basePlan = String(access.base_plan_name || 'Free')
  const effectiveSource = sourceLabel(String(access.access_source || 'free'))
  const grantPlan = String(access.grant_plan_name || related(currentGrant?.plans)?.name || '')
  const today = chicagoToday()
  const flashError = one(sp.error)

  return <>
    <div className="admin-page-head"><div><div className="kpi">Revenue & Monetization</div><h1>Complimentary Plan Access</h1><p className="muted">Give a business Featured or Pro features as a dated trial or permanent complimentary grant without creating a fake payment or Stripe subscription.</p></div><span className="badge sponsored">Admin only</span></div>

    <div className="notice"><strong>Plan access is not verification.</strong> These grants unlock product entitlements only. They never create a Verified badge, change organic rank, record revenue, or pretend the customer paid. When a dated trial expires, effective access automatically falls back to the underlying paid plan or Free.</div>
    {one(sp.saved) === '1' ? <div className="notice success"><strong>Plan access saved.</strong> The effective entitlement engine has been updated for this business.</div> : null}
    {one(sp.revoked) === '1' ? <div className="notice success"><strong>Complimentary access ended.</strong> The business is now using its underlying plan.</div> : null}
    {flashError ? <div className="notice warn"><strong>Unable to save plan access:</strong> {flashError}</div> : null}
    {searchError ? <div className="notice warn">Business search could not be loaded: {searchError.message}</div> : null}

    <section className="admin-card" style={{ marginBottom: 18 }}>
      <div className="section-head compact-head"><div><div className="kpi">Find customer</div><h2>Select a business</h2><p className="small muted">Search by business name, then open its complimentary-access controls.</p></div></div>
      <form method="get" action="/admin/plan-grants" className="admin-filter-search" style={{ marginBottom: 14 }}><span aria-hidden="true">⌕</span><input name="q" defaultValue={q} placeholder="Search business name…"/><button className="btn btn-light" type="submit">Search</button></form>
      <div className="request-list">{(searchRows ?? []).map((row: any) => <div className="card" key={row.id}><div className="section-head compact-head"><div><div className="badges"><span className={`badge ${row.claimed ? 'verified' : 'neutral'}`}>{row.claimed ? 'Claimed' : 'Unclaimed'}</span><span className="badge neutral">{titleCase(row.status)}</span></div><h3>{row.name}</h3></div><Link className="btn btn-primary" href={`/admin/plan-grants?business=${row.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}>Manage Access</Link></div></div>)}</div>
      {!searchRows?.length ? <div className="empty">No businesses match this search.</div> : null}
    </section>

    {selected ? <>
      <div className="portal-section-head"><div><div className="kpi">Customer access</div><h2>{selected.name}</h2><p className="muted">Manage complimentary plan entitlements independently from billing and trust status.</p></div><div className="card-actions"><Link className="btn btn-light" href={`/admin/businesses/${selected.id}?tab=revenue`}>Business Workspace</Link>{selected.status === 'published' ? <Link className="btn btn-light" href={`/business/${selected.slug}`} target="_blank">Public Profile</Link> : null}</div></div>
      {grantError ? <div className="notice warn">Plan access details could not be loaded completely: {grantError}</div> : null}

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <section className="admin-card"><div className="kpi">Effective Plan</div><h2>{effectivePlan}</h2><div className="badges"><span className="badge sponsored">{effectiveSource}</span>{grantState !== 'none' ? <span className="badge neutral">Grant: {titleCase(grantState)}</span> : null}</div><p className="muted">Underlying plan: <strong>{basePlan}</strong>.</p>{grantState === 'active' && access.grant_applied ? <div className="notice success"><strong>{grantPlan} complimentary access is active.</strong> {access.grant_kind === 'trial' ? `It runs through ${dateOnly(access.grant_ends_on)} and then automatically returns to ${basePlan}.` : 'It has no scheduled end date and remains until an admin revokes or replaces it.'}</div> : null}{grantState === 'scheduled' ? <div className="notice"><strong>{grantPlan} access is scheduled.</strong> It starts {dateOnly(access.grant_starts_on)}. Until then, the business remains on {basePlan}.</div> : null}{grantState === 'expired' ? <div className="notice warn"><strong>The complimentary trial has expired.</strong> Effective access has already returned to {basePlan}. You can replace or revoke the old grant below.</div> : null}{grantState === 'active' && !access.grant_applied ? <div className="notice"><strong>The grant is recorded but is not lowering the customer’s access.</strong> Their underlying {basePlan} plan is equal to or higher than the granted plan.</div> : null}</section>
        <section className="admin-card"><div className="kpi">Trust separation</div><h2>Billing and verification stay independent</h2><p className="muted">Claimed: <strong>{selected.claimed ? 'Yes' : 'No'}</strong> · Verified: <strong>{selected.verified ? 'Yes' : 'No'}</strong></p><p className="small muted">Granting Pro or Featured never changes either trust state. Any paid subscription continues in the background and becomes effective again automatically when a higher temporary grant ends.</p></section>
      </div>

      <section className="admin-card" style={{ marginBottom: 18 }}>
        <div className="section-head compact-head"><div><div className="kpi">Grant / replace access</div><h2>Featured or Pro</h2><p className="small muted">Submitting a new grant automatically closes the previous open grant for this business, preserving its history.</p></div></div>
        <form action={grantBusinessPlanAccess} className="form-card">
          <input type="hidden" name="business_id" value={selected.id}/>
          <div className="form-grid">
            <label>Plan<select name="plan_slug" defaultValue={String(access.grant_plan_slug || 'pro')} required><option value="featured">Featured</option><option value="pro">Pro</option></select></label>
            <label>Access Type<select name="grant_kind" defaultValue={String(access.grant_kind || 'trial')} required><option value="trial">Free Trial / Temporary</option><option value="permanent">Permanent Complimentary</option></select></label>
            <label>Start Date<input type="date" name="starts_on" defaultValue={String(access.grant_starts_on || today).slice(0,10)} required/></label>
            <label>Trial End Date<input type="date" name="ends_on" defaultValue={String(access.grant_ends_on || '').slice(0,10)}/><small>Required for a trial. Ignored for Permanent Complimentary.</small></label>
          </div>
          <label>Internal Admin Note<textarea name="admin_note" defaultValue={String(access.grant_note || '')} maxLength={1000} placeholder="Example: 30-day Pro trial after onboarding call, or permanent partner access."/></label>
          <button className="btn btn-primary" type="submit">Grant / Replace Access</button>
        </form>
      </section>

      {currentGrant ? <section className="admin-card" style={{ marginBottom: 18 }}><div className="section-head compact-head"><div><div className="kpi">Current grant record</div><h2>{related(currentGrant.plans)?.name || 'Complimentary Plan'} · {titleCase(currentGrant.grant_kind)}</h2><p className="small muted">{dateOnly(currentGrant.starts_on)} → {currentGrant.ends_on ? dateOnly(currentGrant.ends_on) : 'No end date'}</p></div><span className="badge sponsored">{titleCase(grantState)}</span></div><form action={revokeBusinessPlanAccess} className="form-card"><input type="hidden" name="grant_id" value={currentGrant.id}/><input type="hidden" name="business_id" value={selected.id}/><label>Revocation Note<input name="revoke_note" placeholder="Optional internal reason for ending complimentary access"/></label><button className="btn btn-danger" type="submit">Revoke Complimentary Access</button></form></section> : null}

      <section className="admin-card"><div className="section-head compact-head"><div><div className="kpi">Audit-friendly history</div><h2>Complimentary Access History</h2><p className="small muted">These records are not subscription revenue.</p></div></div>{history.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Plan</th><th>Type</th><th>Start</th><th>End</th><th>Status</th><th>Note</th><th>Created</th></tr></thead><tbody>{history.map(row => <tr key={row.id}><td>{related(row.plans)?.name || '—'}</td><td>{titleCase(row.grant_kind)}</td><td>{dateOnly(row.starts_on)}</td><td>{row.ends_on ? dateOnly(row.ends_on) : 'Permanent'}</td><td>{titleCase(row.status)}</td><td>{row.admin_note || '—'}</td><td>{dateOnly(row.created_at)}</td></tr>)}</tbody></table></div> : <div className="empty">No complimentary access has been granted to this business.</div>}</section>
    </> : null}
  </>
}
