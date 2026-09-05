import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SECTIONS = {
  'data-quality': { table: 'data_quality_tasks', allowed: new Set(['start', 'reopen', 'assign', 'due']) },
  'growth-opportunities': { table: 'growth_opportunities', allowed: new Set(['start', 'reopen', 'assign', 'due']) },
} as const

export async function POST(request: Request) {
  const { claims } = await requireStaff('/admin')
  const body = await request.json().catch(() => ({})) as { section?: string; action?: string; ids?: unknown[]; value?: unknown }
  const section = String(body.section || '') as keyof typeof SECTIONS
  const action = String(body.action || '')
  const config = SECTIONS[section]
  if (!config || !config.allowed.has(action)) return NextResponse.json({ error: 'This bulk action is not allowed.' }, { status: 400 })

  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String).filter(id => UUID.test(id)))].slice(0, 200)
  if (!ids.length) return NextResponse.json({ error: 'Select at least one valid record.' }, { status: 400 })

  let changes: Record<string, unknown> = {}
  if (action === 'start') changes = { status: 'in_progress' }
  if (action === 'reopen') changes = { status: 'open' }
  if (action === 'assign') {
    const value = String(body.value || '').trim()
    if (value && !UUID.test(value)) return NextResponse.json({ error: 'Assignee must be a valid user ID or blank.' }, { status: 400 })
    changes = { assigned_user_id: value || null }
  }
  if (action === 'due') {
    const value = String(body.value || '').trim()
    if (value && Number.isNaN(new Date(value).getTime())) return NextResponse.json({ error: 'Due date is invalid.' }, { status: 400 })
    changes = { due_at: value ? new Date(value).toISOString() : null }
  }

  const s = await createClient()
  const { data, error } = await s.from(config.table).update(changes).eq('tenant_id', TENANT_ID).in('id', ids).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const updated = (data ?? []).length
  await s.from('audit_logs').insert({
    tenant_id: TENANT_ID,
    actor_user_id: String(claims.sub),
    action_type: 'admin_bulk_work_update',
    action_text: `Bulk ${action} on ${section}: ${updated} record(s); ids=${ids.join(',')}`,
  })
  return NextResponse.json({ ok: true, updated })
}
