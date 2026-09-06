import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const text = (value: unknown, max = 1200) => String(value ?? '').trim().slice(0, max)
const isoOrNull = (value: unknown) => {
  const raw = text(value, 80)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export async function POST(request: Request) {
  try {
    await requireStaff('/admin/acquisition-research')
    const body = await request.json() as Record<string, unknown>
    const action = text(body.action, 80)
    const s = await createClient()

    if (action === 'refresh_queue') {
      const { data, error } = await s.rpc('refresh_prospect_research_queue', { p_tenant_id: TENANT_ID })
      if (error) throw error
      return NextResponse.json({ ok: true, data })
    }

    if (action === 'verify_contact') {
      const prospectId = text(body.prospect_id, 80)
      if (!prospectId) return NextResponse.json({ error: 'Prospect is required.' }, { status: 400 })
      const { data, error } = await s.rpc('verify_prospect_owner_contact', {
        p_tenant_id: TENANT_ID,
        p_prospect_id: prospectId,
        p_contact_name: text(body.contact_name, 160) || null,
        p_contact_title: text(body.contact_title, 160) || null,
        p_contact_email: text(body.contact_email, 240) || null,
        p_contact_phone: text(body.contact_phone, 80) || null,
        p_source_url: text(body.source_url, 1000) || null,
        p_checked_at: isoOrNull(body.checked_at),
        p_notes: text(body.notes, 2400) || null,
      })
      if (error) throw error
      return NextResponse.json({ ok: true, data })
    }

    if (action === 'record_attempt') {
      const prospectId = text(body.prospect_id, 80)
      if (!prospectId) return NextResponse.json({ error: 'Prospect is required.' }, { status: 400 })
      const { data, error } = await s.rpc('record_prospect_research_attempt', {
        p_tenant_id: TENANT_ID,
        p_prospect_id: prospectId,
        p_research_source_url: text(body.research_source_url, 1000) || null,
        p_notes: text(body.notes, 2400) || null,
        p_next_review_at: isoOrNull(body.next_review_at),
      })
      if (error) throw error
      return NextResponse.json({ ok: true, data })
    }

    return NextResponse.json({ error: 'Unsupported prospect research action.' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || 'Unable to process prospect research action.') }, { status: 400 })
  }
}
