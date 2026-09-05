import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const clean = (value: string | null) => String(value ?? '').replace(/[%_]/g, '').trim().slice(0, 100)
const safeCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: Request) {
  await requireStaff('/admin/businesses')
  const url = new URL(request.url)
  const q = clean(url.searchParams.get('q'))
  const status = clean(url.searchParams.get('status'))
  const ownership = clean(url.searchParams.get('ownership'))
  const trust = clean(url.searchParams.get('trust'))
  const view = clean(url.searchParams.get('view')) || 'all'
  const s = await createClient()

  const fields = 'id,name,slug,status,claimed,verified,featured,phone,email,website,address_text,source_name,source_url,source_checked_at,profile_score,created_at,updated_at'
  let query = s.from('businesses').select(fields).eq('tenant_id', TENANT_ID)
  if (q) query = query.ilike('name', `%${q}%`)
  if (status) query = query.eq('status', status)
  if (ownership === 'claimed') query = query.eq('claimed', true)
  if (ownership === 'unclaimed') query = query.eq('claimed', false)
  if (trust === 'verified') query = query.eq('verified', true)
  if (trust === 'unverified') query = query.eq('verified', false)
  if (view === 'published') query = query.eq('status', 'published')
  if (view === 'unclaimed') query = query.eq('claimed', false)
  if (view === 'needs-verification') query = query.eq('status', 'published').eq('verified', false)
  if (view === 'missing-source') query = query.is('source_url', null)
  query = view === 'recent' ? query.order('created_at', { ascending: false }) : query.order('name').limit(5000)

  const { data, error } = await query.limit(5000)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const columns = fields.split(',')
  const rows = [columns.map(safeCell).join(','), ...(data ?? []).map((row: any) => columns.map((column) => safeCell(row[column])).join(','))]
  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(`\uFEFF${rows.join('\r\n')}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="central-il-local-pros-businesses-${stamp}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}
