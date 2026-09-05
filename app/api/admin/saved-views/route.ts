import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const cleanScope = (value: unknown) => String(value || '').trim().slice(0, 80)
const cleanName = (value: unknown) => String(value || '').trim().slice(0, 120)
const cleanParams = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string,string>
  return Object.fromEntries(Object.entries(value as Record<string,unknown>)
    .filter(([key]) => /^[a-zA-Z0-9_-]{1,40}$/.test(key))
    .map(([key,val]) => [key, String(val ?? '').slice(0, 200)]))
}

export async function GET(request: Request) {
  const { claims } = await requireStaff('/admin')
  const s = await createClient()
  const scope = cleanScope(new URL(request.url).searchParams.get('scope'))
  if (!scope) return Response.json({ error: 'Scope is required.' }, { status: 400 })
  const { data, error } = await s.from('admin_saved_views')
    .select('id,scope,name,query_params,is_default,created_at,updated_at')
    .eq('tenant_id', TENANT_ID)
    .eq('user_id', String(claims.sub))
    .eq('scope', scope)
    .order('is_default', { ascending: false })
    .order('name')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ views: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
}

export async function POST(request: Request) {
  const { claims } = await requireStaff('/admin')
  const s = await createClient()
  const body = await request.json().catch(() => ({})) as Record<string,unknown>
  const scope = cleanScope(body.scope)
  const name = cleanName(body.name)
  const queryParams = cleanParams(body.query_params)
  const isDefault = Boolean(body.is_default)
  if (!scope || !name) return Response.json({ error: 'Scope and view name are required.' }, { status: 400 })

  if (isDefault) {
    const { error: clearError } = await s.from('admin_saved_views').update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', TENANT_ID).eq('user_id', String(claims.sub)).eq('scope', scope)
    if (clearError) return Response.json({ error: clearError.message }, { status: 500 })
  }

  const row = { tenant_id: TENANT_ID, user_id: String(claims.sub), scope, name, query_params: queryParams, is_default: isDefault, updated_at: new Date().toISOString() }
  const { data, error } = await s.from('admin_saved_views').upsert(row, { onConflict: 'tenant_id,user_id,scope,name' }).select('id,scope,name,query_params,is_default,created_at,updated_at').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, view: data })
}

export async function PATCH(request: Request) {
  const { claims } = await requireStaff('/admin')
  const s = await createClient()
  const body = await request.json().catch(() => ({})) as Record<string,unknown>
  const id = String(body.id || '')
  const scope = cleanScope(body.scope)
  if (!id || !scope) return Response.json({ error: 'View id and scope are required.' }, { status: 400 })
  const { error: clearError } = await s.from('admin_saved_views').update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', TENANT_ID).eq('user_id', String(claims.sub)).eq('scope', scope)
  if (clearError) return Response.json({ error: clearError.message }, { status: 500 })
  const { error } = await s.from('admin_saved_views').update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('tenant_id', TENANT_ID).eq('user_id', String(claims.sub)).eq('scope', scope).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { claims } = await requireStaff('/admin')
  const s = await createClient()
  const body = await request.json().catch(() => ({})) as Record<string,unknown>
  const id = String(body.id || '')
  if (!id) return Response.json({ error: 'View id is required.' }, { status: 400 })
  const { error } = await s.from('admin_saved_views').delete().eq('tenant_id', TENANT_ID).eq('user_id', String(claims.sub)).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
