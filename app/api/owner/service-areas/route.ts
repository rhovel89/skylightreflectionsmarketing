import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaims } from '@/lib/auth'
import { getBusinessPlanAccess, effectivePlanIs } from '@/lib/business-plan'
import { TENANT_ID } from '@/lib/constants'

export async function POST(req: Request) {
  try {
    const claims = await getClaims()
    if (!claims?.sub) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })

    const body = await req.json() as any
    const businessId = String(body.business_id || '')
    const ids = Array.isArray(body.location_ids)
      ? [...new Set(body.location_ids.map((x: any) => String(x)))].slice(0, 50)
      : []

    if (!businessId) return NextResponse.json({ error: 'Business is required.' }, { status: 400 })

    const s = await createClient()
    const uid = String(claims.sub)
    const { data: owner } = await s.from('business_owners').select('business_id').eq('business_id', businessId).eq('user_id', uid).maybeSingle()
    if (!owner) return NextResponse.json({ error: 'You are not authorized to edit this business.' }, { status: 403 })

    const access = await getBusinessPlanAccess(s, businessId)
    if (!effectivePlanIs(access, 'pro')) return NextResponse.json({ error: 'Pro plan access is required for the service-area editor.' }, { status: 403 })

    const { data: pending } = await s.from('business_edit_requests').select('id').eq('business_id', businessId).eq('requested_by', uid).eq('request_type', 'service_areas_update').eq('status', 'pending').limit(1)
    if (pending?.length) return NextResponse.json({ error: 'A service-area update is already pending staff review.' }, { status: 409 })

    let locationNames: string[] = []
    if (ids.length) {
      const { data: valid, error: validErr } = await s.from('locations').select('id,name,county,state').eq('tenant_id', TENANT_ID).eq('is_active', true).in('id', ids)
      const validRows = (valid ?? []) as any[]
      const byId = new Map(validRows.map((x: any) => [String(x.id), x]))
      if (validErr || byId.size !== ids.length) return NextResponse.json({ error: 'One or more selected service areas are not valid active directory markets.' }, { status: 400 })
      locationNames = ids.map((id) => {
        const row: any = byId.get(id)
        const place = String(row?.name || id)
        const state = String(row?.state || 'Illinois')
        const county = String(row?.county || '').trim()
        return county ? `${place} — ${county}, ${state}` : `${place} — ${state}`
      })
    }

    const { error } = await s.from('business_edit_requests').insert({
      tenant_id: TENANT_ID,
      business_id: businessId,
      requested_by: uid,
      request_type: 'service_areas_update',
      proposed_changes: { location_ids: ids, location_names: locationNames },
      status: 'pending',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, message: 'Service-area update submitted for staff review.' })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to submit service-area update.' }, { status: 400 })
  }
}
