import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { AdminEntityEditor } from '@/components/AdminEntityEditor'
import { AdminModerationQueue } from '@/components/AdminModerationQueue'
import { BranchVerificationPanel } from '@/components/BranchVerificationPanel'
import { BusinessVerificationPanel } from '@/components/BusinessVerificationPanel'
import { GuideCoveragePanel } from '@/components/GuideCoveragePanel'
import { SeoCoveragePanel } from '@/components/SeoCoveragePanel'
import { InventoryExpansionPanel } from '@/components/InventoryExpansionPanel'
import { SiteBuilder } from '@/components/SiteBuilder'
import { PricingEditor } from '@/components/PricingEditor'
import { NavigationEditor } from '@/components/NavigationEditor'
import { TeamRoles } from '@/components/TeamRoles'
import { AdminCreateForm } from '@/components/AdminCreateForm'
import { BulkImport } from '@/components/BulkImport'

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (section === 'site-builder') return <SiteBuilder />
  if (section === 'pricing') return <PricingEditor />
  if (section === 'navigation') return <NavigationEditor />
  if (section === 'team') return <TeamRoles />
  if (section === 'bulk-import') return <BulkImport />

  const cfg = ADMIN_ENTITIES[section]
  if (!cfg) notFound()
  const s = await createClient()

  if (section === 'inventory-expansion') {
    const ninetyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString()
    const [
      { data: locationRows, error: locationError },
      { data: branchRows, error: branchError },
      { data: serviceAreaRows, error: serviceAreaError },
      { data: categoryRows, error: categoryError },
      { data: searchRows, error: searchError },
    ] = await Promise.all([
      s.from('locations').select('id,name,slug').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
      s.from('business_locations').select('city,location_id,business_id,businesses!inner(status,tenant_id)').eq('tenant_id', TENANT_ID).eq('is_active', true).eq('businesses.status', 'published').eq('businesses.tenant_id', TENANT_ID).limit(8000),
      s.from('business_service_areas').select('business_id,location_id,businesses!inner(status,tenant_id)').eq('businesses.status', 'published').eq('businesses.tenant_id', TENANT_ID).limit(15000),
      s.from('business_categories').select('business_id,categories!inner(name,slug,vertical,tenant_id)').eq('categories.tenant_id', TENANT_ID).limit(15000),
      s.from('search_events').select('service,location,result_count,created_at').eq('tenant_id', TENANT_ID).gte('created_at', ninetyDaysAgo).order('created_at', { ascending: false }).limit(2000),
    ])
    return <>
      <AdminHead cfg={cfg} />
      {locationError && <div className="notice warn">{locationError.message}</div>}
      {branchError && <div className="notice warn">{branchError.message}</div>}
      {serviceAreaError && <div className="notice warn">{serviceAreaError.message}</div>}
      {categoryError && <div className="notice warn">{categoryError.message}</div>}
      {searchError && <div className="notice warn">{searchError.message}</div>}
      <InventoryExpansionPanel
        locations={(locationRows ?? []) as any[]}
        branches={(branchRows ?? []) as any[]}
        serviceAreas={(serviceAreaRows ?? []) as any[]}
        businessCategories={(categoryRows ?? []) as any[]}
        searchEvents={(searchRows ?? []) as any[]}
      />
    </>
  }

  if (section === 'claims') {
    const { data, error } = await s.from('business_claims').select('id,business_id,claimant_user_id,claimant_name,claimant_role,email,phone,status,created_at,reviewed_by,reviewed_at,review_notes,businesses!inner(id,name,slug,tenant_id,claimed,verified)').eq('businesses.tenant_id', TENANT_ID).order('created_at', { ascending: false }).limit(100)
    const rows = (data ?? []) as unknown as Record<string, any>[]
    return <><AdminHead cfg={cfg} workflow /><QueueMeta rows={rows} />{error ? <div className="notice warn">{error.message}</div> : <AdminModerationQueue kind="claims" rows={rows} />}</>
  }

  if (section === 'submissions') {
    const { data, error } = await s.from('business_submissions').select('id,business_name,category,city,phone,website,description,status,contact_name,email,created_at,reviewed_by,reviewed_at,review_notes,source').eq('tenant_id', TENANT_ID).order('created_at', { ascending: false }).limit(100)
    const rows = (data ?? []) as unknown as Record<string, any>[]
    return <><AdminHead cfg={cfg} workflow /><QueueMeta rows={rows} />{error ? <div className="notice warn">{error.message}</div> : <AdminModerationQueue kind="submissions" rows={rows} />}</>
  }

  if (section === 'edit-requests') {
    const { data, error } = await s.from('business_edit_requests').select('id,business_id,requested_by,request_type,proposed_changes,status,staff_notes,created_at,reviewed_by,reviewed_at,businesses!inner(id,name,slug,tenant_id)').eq('tenant_id', TENANT_ID).order('created_at', { ascending: false }).limit(100)
    const rows = (data ?? []) as unknown as Record<string, any>[]
    return <><AdminHead cfg={cfg} workflow /><QueueMeta rows={rows} />{error ? <div className="notice warn">{error.message}</div> : <AdminModerationQueue kind="edit-requests" rows={rows} />}</>
  }

  if (section === 'reports') {
    const { data, error } = await s.from('listing_reports').select('id,business_id,reporter_name,reporter_email,report_type,details,status,staff_notes,created_at,reviewed_by,reviewed_at,businesses(id,name,slug,tenant_id)').eq('tenant_id', TENANT_ID).order('created_at', { ascending: false }).limit(100)
    const rows = (data ?? []) as unknown as Record<string, any>[]
    return <><AdminHead cfg={cfg} workflow /><QueueMeta rows={rows} />{error ? <div className="notice warn">{error.message}</div> : <AdminModerationQueue kind="reports" rows={rows} />}</>
  }

  if (section === 'businesses') {
    const [{ data, error }, { data: verifyRows, error: verifyError }] = await Promise.all([
      s.from('businesses').select(cfg.select).eq('tenant_id', TENANT_ID).order('name').limit(100),
      s.from('businesses').select('id,name,status,claimed,verified,featured,phone,website,address_text,source_name,source_url,source_checked_at').eq('tenant_id', TENANT_ID).eq('status', 'published').order('verified', { ascending: true }).order('name').limit(50),
    ])
    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    return <><AdminHead cfg={cfg} /><AdminCreateForm section={section} />{verifyError ? <div className="notice warn">{verifyError.message}</div> : <BusinessVerificationPanel rows={(verifyRows ?? []) as unknown as Record<string, any>[]} />}<div className="admin-list-meta"><span className="kpi">Business data editor · {rows.length} records shown</span><span className="small muted">Claimed and Verified are controlled by protected workflows, not editable cells.</span></div>{error ? <div className="notice warn">{error.message}</div> : <AdminEntityEditor section={section} cfg={cfg} rows={rows} />}</>
  }

  if (section === 'branches') {
    const [{ data, error }, { data: verifyRows, error: verifyError }] = await Promise.all([
      s.from('business_locations').select(cfg.select).eq('tenant_id', TENANT_ID).order('city').limit(100),
      s.from('business_locations').select('id,business_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,source_name,source_url,source_checked_at,businesses!inner(name,tenant_id)').eq('tenant_id', TENANT_ID).eq('businesses.tenant_id', TENANT_ID).order('verified', { ascending: true }).order('city').limit(50),
    ])
    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    return <><AdminHead cfg={cfg} />{verifyError ? <div className="notice warn">{verifyError.message}</div> : <BranchVerificationPanel rows={(verifyRows ?? []) as unknown as Record<string, any>[]} />}<div className="admin-list-meta"><span className="kpi">Branch data editor · {rows.length} records shown</span><span className="small muted">The verified trust signal is controlled only from the verification panel above.</span></div>{error ? <div className="notice warn">{error.message}</div> : <AdminEntityEditor section={section} cfg={cfg} rows={rows} />}</>
  }

  if (section === 'guides') {
    const [{ data, error }, { data: locationRows, error: locationError }, { data: branchRows, error: branchError }] = await Promise.all([
      s.from('guides').select(cfg.select).eq('tenant_id', TENANT_ID).order('updated_at', { ascending: false }).limit(100),
      s.from('locations').select('name,slug').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
      s.from('business_locations').select('city,business_id,businesses!inner(status,tenant_id)').eq('tenant_id', TENANT_ID).eq('is_active', true).eq('businesses.status', 'published').eq('businesses.tenant_id', TENANT_ID).limit(1000),
    ])
    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    return <><AdminHead cfg={cfg} /><AdminCreateForm section={section} />{locationError && <div className="notice warn">{locationError.message}</div>}{branchError && <div className="notice warn">{branchError.message}</div>}<GuideCoveragePanel rows={(data ?? []) as any[]} locations={(locationRows ?? []) as any[]} branches={(branchRows ?? []) as any[]} /><div className="admin-list-meta"><span className="kpi">Guide editor · {rows.length} records shown</span><span className="small muted">Create drafts first, publish only substantive useful content, and upgrade thin articles instead of duplicating search intent.</span></div>{error ? <div className="notice warn">{error.message}</div> : <AdminEntityEditor section={section} cfg={cfg} rows={rows} />}</>
  }

  if (section === 'seo') {
    const [{ data, error }, { data: locationRows, error: locationError }, { data: branchRows, error: branchError }, { data: serviceAreaRows, error: serviceAreaError }, { data: categoryRows, error: categoryError }] = await Promise.all([
      s.from('seo_pages').select(cfg.select).eq('tenant_id', TENANT_ID).order('updated_at', { ascending: false }).limit(500),
      s.from('locations').select('id,name,slug').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name'),
      s.from('business_locations').select('city,location_id,business_id,businesses!inner(status,tenant_id)').eq('tenant_id', TENANT_ID).eq('is_active', true).eq('businesses.status', 'published').eq('businesses.tenant_id', TENANT_ID).limit(8000),
      s.from('business_service_areas').select('business_id,location_id,businesses!inner(status,tenant_id)').eq('businesses.status', 'published').eq('businesses.tenant_id', TENANT_ID).limit(15000),
      s.from('business_categories').select('business_id,categories!inner(name,slug,vertical,tenant_id)').eq('categories.tenant_id', TENANT_ID).limit(15000),
    ])
    const rows = (data ?? []).slice(0, 100) as unknown as Record<string, unknown>[]
    return <><AdminHead cfg={cfg} /><AdminCreateForm section={section} />{locationError && <div className="notice warn">{locationError.message}</div>}{branchError && <div className="notice warn">{branchError.message}</div>}{serviceAreaError && <div className="notice warn">{serviceAreaError.message}</div>}{categoryError && <div className="notice warn">{categoryError.message}</div>}<SeoCoveragePanel rows={(data ?? []) as any[]} locations={(locationRows ?? []) as any[]} branches={(branchRows ?? []) as any[]} serviceAreas={(serviceAreaRows ?? []) as any[]} businessCategories={(categoryRows ?? []) as any[]} /><div className="admin-list-meta"><span className="kpi">SEO editor · {rows.length} records shown</span><span className="small muted">Reviewed content does not override the live 3-provider indexing threshold. Physical locations and clearly labeled service areas both count as legitimate market coverage, but service areas never become offices.</span></div>{error ? <div className="notice warn">{error.message}</div> : <AdminEntityEditor section={section} cfg={cfg} rows={rows} />}</>
  }

  let q = s.from(cfg.table).select(cfg.select).limit(100)
  if (!['business_claims', 'sponsorships', 'subscriptions', 'listing_daily_stats'].includes(cfg.table)) q = q.eq('tenant_id', TENANT_ID)
  if (cfg.order) q = q.order(cfg.order, { ascending: false })
  const { data, error } = await q
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return <><AdminHead cfg={cfg} />{!cfg.readOnly && <AdminCreateForm section={section} />} {error ? <div className="notice warn">{error.message}</div> : <><div className="admin-list-meta"><span className="kpi">Showing {rows.length} record{rows.length === 1 ? '' : 's'}</span>{rows.length === 100 && <span className="small muted">First 100 records shown. Use focused admin tools for larger operations.</span>}</div><AdminEntityEditor section={section} cfg={cfg} rows={rows} /></>}</>
}

function AdminHead({ cfg, workflow = false }: { cfg: any; workflow?: boolean }) {
  return <div className="admin-page-head"><div><div className="kpi">{workflow ? 'Protected Moderation' : 'Staff Management'}</div><h1>{cfg.title}</h1><p className="muted">{cfg.description}</p></div><span className={`badge ${workflow ? 'sponsored' : cfg.readOnly ? 'neutral' : 'verified'}`}>{workflow ? 'Workflow controlled' : cfg.readOnly ? 'Read only' : 'Editable'}</span></div>
}

function QueueMeta({ rows }: { rows: Record<string, any>[] }) {
  const pending = rows.filter(r => ['pending', 'in_review', 'new'].includes(r.status)).length
  return <div className="admin-list-meta"><span className="kpi">{pending} awaiting review · {rows.length} shown</span>{rows.length === 100 && <span className="small muted">First 100 records shown.</span>}</div>
}
