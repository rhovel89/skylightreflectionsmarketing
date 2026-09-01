import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const countOf = (r: { count: number | null }) => Number(r.count || 0)

export default async function Page() {
  await requireAdmin('/admin/launch-readiness')
  const s = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

  const [
    siteResult,
    published,
    activeLocations,
    verifiedBusinesses,
    verifiedLocations,
    pendingClaims,
    pendingSubmissions,
    pendingEdits,
    pendingReports,
    leads,
    activeSponsorships,
    pendingMedia,
    listingEvents,
    superAdmins,
  ] = await Promise.all([
    s.from('site_settings').select('directory_name,brand_logo_url').eq('tenant_id', TENANT_ID).maybeSingle(),
    s.from('businesses').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'published'),
    s.from('business_locations').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('is_active', true),
    s.from('businesses').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('verified', true),
    s.from('business_locations').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('verified', true),
    s.from('business_claims').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    s.from('business_submissions').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    s.from('business_edit_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    s.from('listing_reports').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'pending'),
    s.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    s.from('sponsorships').select('id,businesses!inner(tenant_id)', { count: 'exact', head: true }).eq('businesses.tenant_id', TENANT_ID).eq('active', true),
    s.from('business_media').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('approval_status', 'pending'),
    s.from('listing_events').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    s.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('role', 'super_admin'),
  ])

  const logoReady = Boolean(siteResult.data?.brand_logo_url)
  const urlReady = /^https:\/\//.test(siteUrl) && !siteUrl.includes('REPLACE_') && !siteUrl.includes('example.com')
  const adminReady = countOf(superAdmins) > 0
  const moderationOpen = countOf(pendingClaims) + countOf(pendingSubmissions) + countOf(pendingEdits) + countOf(pendingReports) + countOf(pendingMedia)
  const blockers = [!adminReady && 'Create and bootstrap the first Super Admin account.', !urlReady && 'Set NEXT_PUBLIC_SITE_URL to the verified production domain.', !logoReady && 'Upload the final Skylight Reflections Marketing logo in Site Builder.'].filter(Boolean) as string[]

  return <>
    <div className="admin-page-head"><div><div className="kpi">Production Control Center</div><h1>Launch Readiness</h1><p className="muted">A live operational checkpoint for the directory. This page reports real configuration and production data; it does not create fake activity to make metrics appear complete.</p></div><span className={`badge ${blockers.length ? 'neutral' : 'verified'}`}>{blockers.length ? `${blockers.length} launch gate${blockers.length === 1 ? '' : 's'}` : 'Core gates ready'}</span></div>

    {blockers.length ? <div className="notice warn"><strong>Remaining launch gates</strong><ol>{blockers.map(x => <li key={x}>{x}</li>)}</ol></div> : <div className="notice success"><strong>Core application launch gates are configured.</strong> Complete the external production-domain and live-browser smoke test before announcing the site.</div>}

    <div className="stat-grid" style={{ marginTop: 18 }}>
      <div className="stat">Published Businesses<strong>{countOf(published)}</strong></div>
      <div className="stat">Active Locations<strong>{countOf(activeLocations)}</strong></div>
      <div className="stat">Verified Businesses<strong>{countOf(verifiedBusinesses)}</strong></div>
      <div className="stat">Verified Locations<strong>{countOf(verifiedLocations)}</strong></div>
      <div className="stat">Consumer Leads<strong>{countOf(leads)}</strong></div>
      <div className="stat">Listing Events<strong>{countOf(listingEvents)}</strong></div>
    </div>

    <div className="grid grid-3" style={{ marginTop: 18 }}>
      <div className="card"><div className="kpi">Identity & Access</div><h3>{adminReady ? 'Super Admin bootstrapped' : 'Super Admin required'}</h3><p className="muted">Super Admin role assignments: <strong>{countOf(superAdmins)}</strong>. Staff/Admin access requires both Supabase authentication and an authorized tenant role.</p><Link className="btn btn-light" href="/admin/team">Team / Roles</Link></div>
      <div className="card"><div className="kpi">Production URL</div><h3>{urlReady ? 'Site URL configured' : 'Production URL required'}</h3><p className="muted">{siteUrl || 'NEXT_PUBLIC_SITE_URL is not set.'}</p></div>
      <div className="card"><div className="kpi">Branding</div><h3>{logoReady ? 'Brand logo configured' : 'Final logo required'}</h3><p className="muted">{siteResult.data?.directory_name || 'Central Illinois Local Pros'} should use the durable Skylight Reflections Marketing logo export before final public launch.</p><Link className="btn btn-light" href="/admin/site-builder">Open Site Builder</Link></div>
    </div>

    <div className="grid grid-3" style={{ marginTop: 18 }}>
      <div className="card"><div className="kpi">Moderation</div><h3>{moderationOpen} open item{moderationOpen === 1 ? '' : 's'}</h3><div className="info-row"><span>Claims</span><b>{countOf(pendingClaims)}</b></div><div className="info-row"><span>Submissions</span><b>{countOf(pendingSubmissions)}</b></div><div className="info-row"><span>Owner edits</span><b>{countOf(pendingEdits)}</b></div><div className="info-row"><span>Listing reports</span><b>{countOf(pendingReports)}</b></div><div className="info-row"><span>Media</span><b>{countOf(pendingMedia)}</b></div></div>
      <div className="card"><div className="kpi">Monetization</div><h3>{countOf(activeSponsorships)} active sponsorship{countOf(activeSponsorships) === 1 ? '' : 's'}</h3><p className="muted">Paid placement is kept separate from organic relevance, verification, SEO coverage and lead routing.</p><Link className="btn btn-light" href="/admin/sponsorships">Sponsored Placement</Link></div>
      <div className="card"><div className="kpi">Traffic Measurement</div><h3>{countOf(listingEvents) ? 'Analytics receiving activity' : 'Awaiting real traffic'}</h3><p className="muted">Impressions, profile views, contact clicks and lead submissions begin accumulating from real public traffic after deployment.</p><Link className="btn btn-light" href="/admin/analytics">Listing Analytics</Link></div>
    </div>

    <div className="card" style={{ marginTop: 18 }}><div className="kpi">Final External Gate</div><h2>Production deployment + live browser smoke test</h2><p className="muted">After the persistent Vercel project is linked, verify the final domain, environment variables, Supabase Auth redirect URLs, homepage/search/profile flows, account creation, owner claim flow, staff moderation, lead routing, media moderation, analytics capture, robots.txt and sitemap.xml.</p></div>
  </>
}
