'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim()
const dateValue = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
const target = (businessId: string, params: Record<string, string>) => {
  const qs = new URLSearchParams({ business: businessId, ...params })
  return `/admin/plan-grants?${qs.toString()}`
}

export async function grantBusinessPlanAccess(fd: FormData) {
  await requireAdmin('/admin/plan-grants')
  const s = await createClient()
  const businessId = text(fd, 'business_id')
  const planSlug = text(fd, 'plan_slug').toLowerCase()
  const grantKind = text(fd, 'grant_kind').toLowerCase()
  const startsOn = dateValue(text(fd, 'starts_on'))
  const endsOn = dateValue(text(fd, 'ends_on'))
  const note = text(fd, 'admin_note').slice(0, 1000)

  if (!businessId || !['featured', 'pro'].includes(planSlug) || !['trial', 'permanent'].includes(grantKind) || !startsOn) {
    redirect(target(businessId, { error: 'Choose Featured or Pro, an access type, and a valid start date.' }))
  }
  if (grantKind === 'trial' && (!endsOn || endsOn < startsOn)) {
    redirect(target(businessId, { error: 'A trial requires an end date on or after the start date.' }))
  }

  const { error } = await s.rpc('admin_set_business_plan_grant', {
    p_business_id: businessId,
    p_plan_slug: planSlug,
    p_grant_kind: grantKind,
    p_starts_on: startsOn,
    p_ends_on: grantKind === 'trial' ? endsOn : null,
    p_note: note || null,
  })
  if (error) redirect(target(businessId, { error: error.message }))

  revalidatePath('/admin/plan-grants')
  revalidatePath(`/admin/businesses/${businessId}`)
  revalidatePath('/business-portal/subscription')
  revalidatePath('/business-portal/media')
  revalidatePath('/business-portal/pro-profile')
  revalidatePath('/business-portal/service-areas')
  revalidatePath('/business-portal/performance')
  redirect(target(businessId, { saved: '1' }))
}

export async function revokeBusinessPlanAccess(fd: FormData) {
  await requireAdmin('/admin/plan-grants')
  const s = await createClient()
  const grantId = text(fd, 'grant_id')
  const businessId = text(fd, 'business_id')
  const note = text(fd, 'revoke_note').slice(0, 1000)
  if (!grantId || !businessId) redirect(target(businessId, { error: 'Grant and business are required.' }))

  const { error } = await s.rpc('admin_revoke_business_plan_grant', {
    p_grant_id: grantId,
    p_note: note || null,
  })
  if (error) redirect(target(businessId, { error: error.message }))

  revalidatePath('/admin/plan-grants')
  revalidatePath(`/admin/businesses/${businessId}`)
  revalidatePath('/business-portal/subscription')
  revalidatePath('/business-portal/media')
  revalidatePath('/business-portal/pro-profile')
  revalidatePath('/business-portal/service-areas')
  revalidatePath('/business-portal/performance')
  redirect(target(businessId, { revoked: '1' }))
}
