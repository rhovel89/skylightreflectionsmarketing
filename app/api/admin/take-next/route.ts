import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const qualityRank: Record<string, number> = { hot: 100, high: 80, medium: 50, low: 20 }

type Candidate = {
  source: 'quality' | 'growth'
  id: string
  score: number
  dueAt?: string | null
  businessId?: string | null
}

export async function POST() {
  const { claims } = await requireStaff('/admin/action-center')
  const s = await createClient()
  const userId = String(claims.sub)

  const [qualityResult, growthResult] = await Promise.all([
    s.from('data_quality_tasks')
      .select('id,business_id,priority,due_at,task_type,updated_at')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'open')
      .is('assigned_user_id', null)
      .order('updated_at', { ascending: false })
      .limit(80),
    s.from('growth_opportunities')
      .select('id,business_id,score,due_at,opportunity_type,updated_at')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'open')
      .is('assigned_user_id', null)
      .order('score', { ascending: false })
      .limit(80),
  ])

  if (qualityResult.error || growthResult.error) {
    return NextResponse.json({ error: qualityResult.error?.message || growthResult.error?.message || 'Work queue could not be loaded.' }, { status: 500 })
  }

  const now = Date.now()
  const candidates: Candidate[] = [
    ...((qualityResult.data ?? []) as any[]).map(row => ({
      source: 'quality' as const,
      id: String(row.id),
      businessId: row.business_id ? String(row.business_id) : null,
      dueAt: row.due_at ? String(row.due_at) : null,
      score: (qualityRank[String(row.priority || '').toLowerCase()] || 30) + (row.due_at && new Date(String(row.due_at)).getTime() < now ? 35 : 0) + (row.task_type === 'seo_inventory' ? 8 : 0),
    })),
    ...((growthResult.data ?? []) as any[]).map(row => ({
      source: 'growth' as const,
      id: String(row.id),
      businessId: row.business_id ? String(row.business_id) : null,
      dueAt: row.due_at ? String(row.due_at) : null,
      score: Number(row.score || 0) + (row.due_at && new Date(String(row.due_at)).getTime() < now ? 25 : 0),
    })),
  ].sort((a, b) => b.score - a.score || dueValue(a.dueAt) - dueValue(b.dueAt))

  for (const candidate of candidates) {
    const table = candidate.source === 'quality' ? 'data_quality_tasks' : 'growth_opportunities'
    const { data, error } = await s.from(table)
      .update({ assigned_user_id: userId, status: 'in_progress' })
      .eq('tenant_id', TENANT_ID)
      .eq('id', candidate.id)
      .eq('status', 'open')
      .is('assigned_user_id', null)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if ((data ?? []).length) {
      await s.from('audit_logs').insert({
        tenant_id: TENANT_ID,
        actor_user_id: userId,
        action_type: 'admin_take_next_task',
        action_text: `Claimed next ${candidate.source} work item ${candidate.id} and set it in progress.`,
      })
      const href = candidate.source === 'quality'
        ? candidate.businessId ? `/admin/businesses/${candidate.businessId}?tab=trust` : '/admin/data-quality?state=in_progress'
        : candidate.businessId ? `/admin/businesses/${candidate.businessId}?tab=growth` : '/admin/growth-opportunities?status=in_progress'
      return NextResponse.json({ ok: true, source: candidate.source, id: candidate.id, href })
    }
  }

  return NextResponse.json({ error: 'No unassigned open work is available right now.' }, { status: 404 })
}

function dueValue(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}
