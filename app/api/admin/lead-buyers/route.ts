import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'

const uuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')) ? String(value) : ''
const ids = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(uuid).filter(Boolean))].slice(0, 100) : []
const positiveInt = (value: unknown) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null }
const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

export async function POST(request: Request) {
  await requireAdmin('/admin/lead-buyers')
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const businessId = uuid(body.business_id)
  if (!businessId) return Response.json({ error: 'A valid business is required.' }, { status: 400 })
  const action = clean(body.action, 40) || 'save'
  if (!['save', 'mark_contacted', 'reopen'].includes(action)) return Response.json({ error: 'Unsupported CRM action.' }, { status: 400 })
  const salesStatus = ['open', 'paused', 'declined'].includes(String(body.sales_status)) ? String(body.sales_status) : 'open'
  const saleMode = ['either', 'exclusive', 'shared'].includes(String(body.preferred_sale_mode)) ? String(body.preferred_sale_mode) : 'either'
  const billingModel = ['undecided', 'pay_per_lead', 'lead_bundle'].includes(String(body.target_billing_model)) ? String(body.target_billing_model) : 'undecided'
  const followUp = body.follow_up_at ? new Date(String(body.follow_up_at)) : null
  if (followUp && Number.isNaN(followUp.getTime())) return Response.json({ error: 'Follow-up date is invalid.' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('update_lead_buyer_crm_profile', {
    p_tenant_id: TENANT_ID,
    p_business_id: businessId,
    p_sales_status: salesStatus,
    p_target_price_cents: positiveInt(body.target_price_cents),
    p_preferred_sale_mode: saleMode,
    p_target_monthly_cap: positiveInt(body.target_monthly_cap),
    p_target_billing_model: billingModel,
    p_follow_up_at: followUp ? followUp.toISOString() : null,
    p_internal_notes: clean(body.internal_notes, 8000) || null,
    p_category_ids: ids(body.category_ids),
    p_location_ids: ids(body.location_ids),
    p_mark_contacted: action === 'mark_contacted',
    p_reopen: action === 'reopen',
  })
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true, profile: data }, { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
}
