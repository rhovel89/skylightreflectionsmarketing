import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { getAdminNotifications } from '@/lib/admin-notifications'

export async function GET() {
  const { claims } = await requireStaff('/admin/notifications')
  const s = await createClient()
  const result = await getAdminNotifications(s, String(claims.sub))
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
}

export async function POST(request: Request) {
  const { claims } = await requireStaff('/admin/notifications')
  const s = await createClient()
  const body = await request.json().catch(() => ({})) as { action?: string; keys?: unknown[] }
  const action = String(body.action || 'read')
  const keys = [...new Set((Array.isArray(body.keys) ? body.keys : []).map(value => String(value)).filter(value => value.length > 0 && value.length <= 220))].slice(0, 200)
  if (!keys.length) return Response.json({ error: 'At least one notification key is required.' }, { status: 400 })

  if (action === 'unread') {
    const { error } = await s.from('admin_notification_reads').delete().eq('tenant_id', TENANT_ID).eq('user_id', String(claims.sub)).in('notification_key', keys)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, action, count: keys.length })
  }

  const rows = keys.map(notification_key => ({ tenant_id: TENANT_ID, user_id: String(claims.sub), notification_key, read_at: new Date().toISOString() }))
  const { error } = await s.from('admin_notification_reads').upsert(rows, { onConflict: 'tenant_id,user_id,notification_key' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, action: 'read', count: keys.length })
}
