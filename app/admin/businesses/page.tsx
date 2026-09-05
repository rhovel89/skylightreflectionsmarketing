import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { AdminCreateForm } from '@/components/AdminCreateForm'
import { AdminEntityEditor } from '@/components/AdminEntityEditor'
import { BusinessVerificationPanel } from '@/components/BusinessVerificationPanel'

type SearchValue = string | string[] | undefined
const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const cleanSearch = (value: string) => value.replace(/[%_]/g, '').trim().slice(0, 100)
const PAGE_SIZE = 50

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  const sp = await searchParams
  const s = await createClient()
  const cfg = ADMIN_ENTITIES.businesses
  const q = cleanSearch(one(sp.q))
  const status = one(sp.status)
  const ownership = one(sp.ownership)
  const trust = one(sp.trust)
  const view = one(sp.view) || 'all'
  const sort = one(sp.sort) || (view === 'recent' ? 'newest' : 'name')
  const requestedPage = Math.max(1, Number(one(sp.page)) || 1)

  let query = s.from('businesses').select(cfg.select, { count: 'exact' }).eq('tenant_id', TENANT_ID)
  if (q) query = query.ilike('name', `%${q}%`)
  if (status) query = query.eq('status', status)
  if (ownership === 'claimed') query = query.eq('claimed', true)
  if (ownership === 'unclaimed') query = query.eq('claimed', false)
  if (trust === 'verified') query = query.eq('verified', true)
  if (trust === 'unverified') query = query.eq('verified', false)

  if (view === 'published') query = query.eq('status', 'published')
  if (view === 'unclaimed') query = query.eq('claimed', false)
  if (view === 'needs-verification') query = query.eq('status', 'published').eq('verified', false)
  if (view === 'missing-source') query = query.is('source_url', null)

  if (sort === 'newest') query = query.order('created_at', { ascending: false })
  else if (sort === 'updated') query = query.order('updated_at', { ascending: false })
  else if (sort === 'score') query = query.order('profile_score', { ascending: false }).order('name')
  else query = query.order('name', { ascending: true })

  const from = (requestedPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const [businessResult, verifyResult, publishedCount, unclaimedCount, verificationCount, sourceCount] = await Promise.all([
    query.range(from, to),
    s.from('businesses').select('id,name,status,claimed,verified,featured,phone,website,address_text,source_name,source_url,source_checked_at').eq('tenant_id', TENANT_ID).eq('status', 'published').order('verified', { ascending: true }).order('name').limit(30),
    s.from('businesses').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'published'),
    s.from('businesses').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'published').eq('claimed', false),
    s.from('businesses').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'published').eq('verified', false),
    s.from('businesses').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).is('source_url', null),
  ])

  const rows = (businessResult.data ?? []) as unknown as Record<string, unknown>[]
  const total = businessResult.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)

  const sharedParams = () => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (ownership) params.set('ownership', ownership)
    if (trust) params.set('trust', trust)
    if (view !== 'all') params.set('view', view)
    if (sort !== 'name') params.set('sort', sort)
    return params
  }
  const pageHref = (nextPage: number) => {
    const params = sharedParams()
    if (nextPage > 1) params.set('page', String(nextPage))
    const suffix = params.toString()
    return `/admin/businesses${suffix ? `?${suffix}` : ''}`
  }
  const exportParams = sharedParams()
  const exportHref = `/api/admin/business-export${exportParams.toString() ? `?${exportParams.toString()}` : ''}`

  const quickViews = [
    ['all', 'All Businesses'], ['published', 'Published'], ['unclaimed', 'Unclaimed'], ['needs-verification', 'Needs Verification'], ['missing-source', 'Missing Source'], ['recent', 'Recently Added'],
  ] as const

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Directory Operations</div>
        <h1>Business Management</h1>
        <p className="muted">Find a business, make quick listing edits, or open its full management workspace for locations, service areas, media, leads, revenue, claims, verification, growth and activity.</p>
      </div>
      <div className="admin-row-actions">
        <Link className="btn btn-primary" href="/admin/action-center">My Work Today</Link>
        <a className="btn btn-light" href={exportHref}>Export Filtered CSV</a>
        <Link className="btn btn-light" href="/admin/bulk-import">Bulk Import</Link>
        <Link className="btn btn-light" href="/admin/business-media">Media & Menus</Link>
      </div>
    </div>

    <div className="stat-grid business-list-stats">
      <Link className="stat" href="/admin/businesses?view=published"><span>Published</span><strong>{publishedCount.count ?? 0}</strong><small>Live directory listings</small></Link>
      <Link className="stat" href="/admin/businesses?view=unclaimed"><span>Unclaimed</span><strong>{unclaimedCount.count ?? 0}</strong><small>Owner acquisition pool</small></Link>
      <Link className="stat" href="/admin/businesses?view=needs-verification"><span>Needs Verification</span><strong>{verificationCount.count ?? 0}</strong><small>Published but unverified</small></Link>
      <Link className="stat" href="/admin/businesses?view=missing-source"><span>Missing Source</span><strong>{sourceCount.count ?? 0}</strong><small>Needs provenance URL</small></Link>
    </div>

    <details className="admin-create-disclosure">
      <summary><span><strong>+ Add a Business</strong><small>Create a canonical listing with conservative trust defaults.</small></span><span>Open form</span></summary>
      <div className="admin-create-disclosure-body"><AdminCreateForm section="businesses" /></div>
    </details>

    <section className="admin-card business-list-controls">
      <div className="business-quick-views" aria-label="Business quick views">{quickViews.map(([key, label]) => <Link className={view === key ? 'active' : ''} href={key === 'all' ? '/admin/businesses' : `/admin/businesses?view=${key}`} key={key}>{label}</Link>)}</div>
      <form method="get" className="business-list-filter-grid">
        {view !== 'all' ? <input type="hidden" name="view" value={view} /> : null}
        <label className="field"><span>Business Name</span><input name="q" defaultValue={q} placeholder="Search by business name…" /></label>
        <label className="field"><span>Status</span><select name="status" defaultValue={status}><option value="">Any status</option><option value="published">Published</option><option value="draft">Draft</option><option value="pending">Pending</option><option value="suspended">Suspended</option><option value="archived">Archived</option></select></label>
        <label className="field"><span>Ownership</span><select name="ownership" defaultValue={ownership}><option value="">Any ownership</option><option value="claimed">Claimed</option><option value="unclaimed">Unclaimed</option></select></label>
        <label className="field"><span>Trust</span><select name="trust" defaultValue={trust}><option value="">Any verification</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select></label>
        <label className="field"><span>Sort</span><select name="sort" defaultValue={sort}><option value="name">Name A–Z</option><option value="newest">Newest Added</option><option value="updated">Recently Updated</option><option value="score">Profile Score</option></select></label>
        <div className="admin-row-actions"><button className="btn btn-primary" type="submit">Apply Filters</button><a className="btn btn-light" href={exportHref}>Export These Results</a><Link className="btn btn-light" href="/admin/businesses">Reset</Link></div>
      </form>
    </section>

    {verifyResult.error ? <div className="notice warn">{verifyResult.error.message}</div> : <details className="business-verification-disclosure"><summary><span><strong>Verification Queue</strong><small>Open source-backed trust controls for published listings.</small></span><span>{(verifyResult.data ?? []).filter((row: any) => !row.verified).length} unverified shown</span></summary><div className="admin-create-disclosure-body"><BusinessVerificationPanel rows={(verifyResult.data ?? []) as unknown as Record<string, any>[]} /></div></details>}

    <div className="admin-list-meta"><span className="kpi">{total} matching business{total === 1 ? '' : 'es'} · page {page} of {totalPages}</span><span className="small muted">Open Manage Business for the full cross-system workspace. Quick edits remain available in the table.</span></div>
    {businessResult.error ? <div className="notice warn">{businessResult.error.message}</div> : rows.length ? <AdminEntityEditor section="businesses" cfg={cfg} rows={rows} /> : <div className="empty">No businesses match the selected filters.</div>}
    {totalPages > 1 ? <nav className="business-pagination" aria-label="Business result pages"><Link className={`btn btn-light ${page <= 1 ? 'disabled' : ''}`} aria-disabled={page <= 1} href={page <= 1 ? pageHref(1) : pageHref(page - 1)}>← Previous</Link><span>Page <strong>{page}</strong> of <strong>{totalPages}</strong></span><Link className={`btn btn-light ${page >= totalPages ? 'disabled' : ''}`} aria-disabled={page >= totalPages} href={page >= totalPages ? pageHref(totalPages) : pageHref(page + 1)}>Next →</Link></nav> : null}
  </>
}
