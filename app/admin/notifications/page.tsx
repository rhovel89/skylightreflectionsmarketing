import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAdminNotifications } from '@/lib/admin-notifications'
import { AdminNotificationCenter } from '@/components/AdminNotificationCenter'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { claims } = await requireStaff('/admin/notifications')
  const s = await createClient()
  const result = await getAdminNotifications(s, String(claims.sub))

  return <>
    <div className="admin-page-head notification-page-head">
      <div>
        <div className="kpi">Private Staff Alerts</div>
        <h1>Notification Center</h1>
        <p className="muted">Current staff-only signals for moderation, leads, billing, listing integrity, SEO inventory, Sponsored renewals and high-value growth work. Read state is personal to your staff account.</p>
      </div>
      <div className="admin-row-actions"><Link className="btn btn-primary" href="/admin/action-center">My Work Today</Link><Link className="btn btn-light" href="/admin/businesses">Manage Businesses</Link></div>
    </div>

    {result.errors.length ? <div className="notice warn"><strong>Some notification sources are incomplete:</strong> {result.errors.join(' · ')}</div> : null}

    <div className="stat-grid notification-stats">
      <div className="stat"><span>Unread</span><strong>{result.unreadCount}</strong><small>Current items you have not reviewed</small></div>
      <div className="stat"><span>Current Signals</span><strong>{result.totalCount}</strong><small>Active actionable notifications</small></div>
      <div className="stat"><span>Personal State</span><strong>On</strong><small>Read/unread follows your staff account</small></div>
    </div>

    <div className="notice"><strong>Notification ≠ automatic action.</strong> Opening or reading an alert never approves a claim, verifies a listing, changes organic rank, sends outreach, bills a customer, or modifies a Sponsored placement.</div>
    <AdminNotificationCenter initialItems={result.items} />
  </>
}
