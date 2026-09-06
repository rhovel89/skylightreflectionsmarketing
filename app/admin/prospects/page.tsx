import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { AdminEntityEditor } from '@/components/AdminEntityEditor'

export const dynamic = 'force-dynamic'

type SearchValue = string | string[] | undefined
const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const titleCase = (value: string) => value.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const locationTypeLabel: Record<string,string> = { city: 'City', town: 'Town', village: 'Village', county: 'County', township: 'Township', community: 'Community' }
const strictContactReady = (row: Record<string, unknown>) => Boolean(
  (String(row.owner_contact_email ?? '').trim() || String(row.owner_contact_phone ?? '').trim())
  && String(row.owner_contact_source_url ?? '').trim()
  && row.owner_contact_checked_at,
)
const potentialContact = (row: Record<string, unknown>) => Boolean(String(row.owner_contact_email ?? '').trim() || String(row.owner_contact_phone ?? '').trim())

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  const sp = await searchParams
  const locationType = one(sp.location_type)
  const city = one(sp.city)
  const vertical = one(sp.vertical)
  const stage = one(sp.stage)
  const priority = one(sp.priority)
  const status = one(sp.status)

  const cfg = ADMIN_ENTITIES.prospects
  const s = await createClient()
  const { data: locationRows, error: locationError } = await s
    .from('locations')
    .select('id,name,slug,type,county,state')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('type')
    .order('name')

  const locations = (locationRows ?? []) as {id:string;name:string;slug:string;type:string;county?:string|null;state?:string|null}[]
  const knownTypes = Array.from(new Set(locations.map(l => l.type).filter(Boolean))).sort()
  const marketNamesForType = locationType ? locations.filter(l => l.type === locationType).map(l => l.name) : []

  let query = s
    .from('business_prospects')
    .select(`${cfg.select},notes`)
    .eq('tenant_id', TENANT_ID)

  if (city) query = query.eq('city', city)
  else if (locationType) query = marketNamesForType.length ? query.in('city', marketNamesForType) : query.eq('city', '__no_matching_market__')
  if (vertical) query = query.eq('vertical', vertical)
  if (stage) query = query.eq('crm_stage', stage)
  if (priority) query = query.eq('priority', priority)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('updated_at', { ascending: false }).limit(500)
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  const unique = (field: string) => Array.from(new Set(rows.map((r:any) => String(r[field] ?? '')).filter(Boolean))).sort()
  const verticalOptions = unique('vertical')
  const stageOptions = unique('crm_stage')
  const priorityOptions = unique('priority')
  const statusOptions = unique('status')
  const filteredLocations = locationType ? locations.filter(l => l.type === locationType) : locations
  const hasFilters = Boolean(locationType || city || vertical || stage || priority || status)
  const readyCount = rows.filter(strictContactReady).length
  const provenanceIncomplete = rows.filter(row => potentialContact(row) && !strictContactReady(row)).length

  return <>
    <div className="admin-page-head">
      <div>
        <div className="kpi">Private Sales Intelligence</div>
        <h1>Skylight Sales CRM</h1>
        <p className="muted">Filter researched prospects by market and pipeline state without changing canonical business listings. Contact Ready is evidence-based: a generic business contact or a Published prospect status does not qualify by itself.</p>
      </div>
      <div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/acquisition-research">Research Workbench 3.3</Link><span className="badge verified">Editable</span></div>
    </div>

    <div className="notice"><strong>Sales 3.3 contact standard:</strong> Contact Ready requires a sourced owner/decision-maker email or phone, a source URL and a checked timestamp. This is a private sales workflow standard only and has no effect on public ranking, verification or Sponsored placement.</div>

    <div className="admin-card" style={{marginBottom:18,marginTop:18}}>
      <div className="section-head" style={{marginBottom:12}}>
        <div><div className="kpi">Territory & Pipeline Filters</div><h2>Work a specific market</h2></div>
        {hasFilters && <Link href="/admin/prospects" className="btn btn-light">Clear Filters</Link>}
      </div>
      <form method="get" className="grid grid-3" style={{alignItems:'end'}}>
        <label className="field"><span>Location Type</span><select name="location_type" defaultValue={locationType}><option value="">All cities / towns / markets</option>{knownTypes.map(type => <option key={type} value={type}>{locationTypeLabel[type] ?? titleCase(type)}</option>)}</select></label>
        <label className="field"><span>Specific City / Town / Market</span><select name="city" defaultValue={city}><option value="">All matching markets</option>{filteredLocations.map(l => <option key={l.id} value={l.name}>{l.name}{l.county ? ` · ${l.county} County` : ''} · {locationTypeLabel[l.type] ?? titleCase(l.type)}</option>)}</select></label>
        <label className="field"><span>Vertical</span><select name="vertical" defaultValue={vertical}><option value="">All verticals</option>{verticalOptions.map(v => <option key={v} value={v}>{titleCase(v)}</option>)}</select></label>
        <label className="field"><span>CRM Stage</span><select name="stage" defaultValue={stage}><option value="">All stages</option>{stageOptions.map(v => <option key={v} value={v}>{titleCase(v)}</option>)}</select></label>
        <label className="field"><span>Priority</span><select name="priority" defaultValue={priority}><option value="">All priorities</option>{priorityOptions.map(v => <option key={v} value={v}>{titleCase(v)}</option>)}</select></label>
        <label className="field"><span>Prospect Status</span><select name="status" defaultValue={status}><option value="">All statuses</option>{statusOptions.map(v => <option key={v} value={v}>{titleCase(v)}</option>)}</select></label>
        <div><button className="btn btn-primary" type="submit">Apply Filters</button></div>
      </form>
      {locationError && <div className="notice warn" style={{marginTop:12}}>Location filter data could not be fully loaded: {locationError.message}</div>}
    </div>

    <div className="stat-grid">
      <div className="stat">Matching Prospects<strong>{rows.length}</strong></div>
      <div className="stat">Cities / Towns in Filter<strong>{city ? 1 : locationType ? marketNamesForType.length : locations.length}</strong></div>
      <div className="stat">Hot / High Priority<strong>{rows.filter((r:any) => ['hot','high'].includes(String(r.priority))).length}</strong></div>
      <div className="stat">Strict Contact Ready<strong>{readyCount}</strong><small>{provenanceIncomplete} contact path{provenanceIncomplete===1?'':'s'} still need provenance</small></div>
    </div>

    <div className="admin-list-meta" style={{marginTop:18}}>
      <span className="kpi">Showing {rows.length} matching prospect{rows.length === 1 ? '' : 's'}</span>
      <span className="small muted">Up to 500 records per filtered view. Market filters use the canonical active location list.</span>
    </div>
    {error ? <div className="notice warn">{error.message}</div> : <AdminEntityEditor section="prospects" cfg={cfg} rows={rows} />}
  </>
}
