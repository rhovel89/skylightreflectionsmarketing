import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()
  try {
    const s = await createClient()
    const { error } = await s.from('tenants').select('id').eq('id', TENANT_ID).maybeSingle()
    if (error) {
      return NextResponse.json(
        { ok: false, service: 'central-il-local-pros', version: '15.5.0', database: 'unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return NextResponse.json(
      { ok: true, service: 'central-il-local-pros', version: '15.5.0', database: 'ok', response_ms: Date.now() - started },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      { ok: false, service: 'central-il-local-pros', version: '15.5.0', database: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
