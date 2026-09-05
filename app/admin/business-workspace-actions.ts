'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim()
const values = (fd: FormData, key: string) => [...new Set(fd.getAll(key).map((value) => String(value).trim()).filter(Boolean))]

export async function updateBusinessCoverage(fd: FormData) {
  const { claims } = await requireAdmin('/admin/businesses')
  const s = await createClient()
  const businessId = text(fd, 'business_id')
  const categoryIds = values(fd, 'category_ids')
  const primaryCategoryId = text(fd, 'primary_category_id')
  const serviceAreaIds = values(fd, 'service_area_ids')

  if (!businessId) throw new Error('Business ID is required.')
  if (!categoryIds.length) throw new Error('Every business must keep at least one legitimate category.')
  if (!primaryCategoryId || !categoryIds.includes(primaryCategoryId)) throw new Error('Choose one selected category as the primary category.')
  if (serviceAreaIds.length > 50) throw new Error('A business can have no more than 50 service areas.')

  const [{ data: business, error: businessError }, { data: categoryRows, error: categoryError }, { data: locationRows, error: locationError }] = await Promise.all([
    s.from('businesses').select('id,name,slug').eq('tenant_id', TENANT_ID).eq('id', businessId).maybeSingle(),
    s.from('categories').select('id').eq('tenant_id', TENANT_ID).eq('is_active', true).in('id', categoryIds),
    serviceAreaIds.length
      ? s.from('locations').select('id').eq('tenant_id', TENANT_ID).eq('is_active', true).in('id', serviceAreaIds)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
  ])

  if (businessError || !business) throw new Error(businessError?.message || 'Business not found.')
  if (categoryError || (categoryRows ?? []).length !== categoryIds.length) throw new Error('One or more categories are invalid or inactive.')
  if (locationError || (locationRows ?? []).length !== serviceAreaIds.length) throw new Error('One or more service areas are invalid or inactive.')

  const [{ data: existingCategoryRows, error: existingCategoryError }, { data: existingAreaRows, error: existingAreaError }] = await Promise.all([
    s.from('business_categories').select('category_id').eq('business_id', businessId),
    s.from('business_service_areas').select('location_id').eq('business_id', businessId),
  ])
  if (existingCategoryError) throw new Error(existingCategoryError.message)
  if (existingAreaError) throw new Error(existingAreaError.message)

  const existingCategories = new Set((existingCategoryRows ?? []).map((row: any) => String(row.category_id)))
  const existingAreas = new Set((existingAreaRows ?? []).map((row: any) => String(row.location_id)))
  const removedCategories = [...existingCategories].filter((id) => !categoryIds.includes(id))
  const addedAreas = serviceAreaIds.filter((id) => !existingAreas.has(id))
  const removedAreas = [...existingAreas].filter((id) => !serviceAreaIds.includes(id))

  const { error: categoryUpsertError } = await s.from('business_categories').upsert(
    categoryIds.map((categoryId) => ({
      business_id: businessId,
      category_id: categoryId,
      is_primary: categoryId === primaryCategoryId,
    })),
    { onConflict: 'business_id,category_id' },
  )
  if (categoryUpsertError) throw new Error(`Category update failed: ${categoryUpsertError.message}`)

  if (removedCategories.length) {
    const { error } = await s.from('business_categories').delete().eq('business_id', businessId).in('category_id', removedCategories)
    if (error) throw new Error(`Unable to remove old categories: ${error.message}`)
  }

  if (addedAreas.length) {
    const { error } = await s.from('business_service_areas').insert(addedAreas.map((locationId) => ({ business_id: businessId, location_id: locationId })))
    if (error) throw new Error(`Unable to add service areas: ${error.message}`)
  }
  if (removedAreas.length) {
    const { error } = await s.from('business_service_areas').delete().eq('business_id', businessId).in('location_id', removedAreas)
    if (error) throw new Error(`Unable to remove service areas: ${error.message}`)
  }

  await s.from('audit_logs').insert({
    tenant_id: TENANT_ID,
    actor_user_id: String(claims.sub),
    action_type: 'admin_business_coverage_update',
    action_text: `Updated business ${businessId} (${business.name}) coverage; categories=${categoryIds.length}; primary_category=${primaryCategoryId}; service_areas=${serviceAreaIds.length}. Service areas remain separate from physical branches.`,
  })

  revalidatePath(`/admin/businesses/${businessId}`)
  revalidatePath('/admin/businesses')
  revalidatePath(`/business/${business.slug}`)
  revalidatePath('/search')
}
