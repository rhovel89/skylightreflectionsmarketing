import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

export type SearchAvailability = Record<string, Record<string, number>>

export async function getSearchAvailability(): Promise<SearchAvailability> {
  try {
    const s = await createClient()
    const [
      { data: locations, error: locationError },
      { data: branches, error: branchError },
      { data: serviceAreas, error: serviceError },
      { data: categoryRows, error: categoryError },
    ] = await Promise.all([
      s.from('locations')
        .select('id,slug')
        .eq('tenant_id', TENANT_ID)
        .eq('is_active', true)
        .order('name'),
      s.from('business_locations')
        .select('business_id,location_id,businesses!inner(status,tenant_id)')
        .eq('tenant_id', TENANT_ID)
        .eq('is_active', true)
        .eq('businesses.status', 'published')
        .eq('businesses.tenant_id', TENANT_ID)
        .not('location_id', 'is', null)
        .limit(10000),
      s.from('business_service_areas')
        .select('business_id,location_id,businesses!inner(status,tenant_id)')
        .eq('businesses.status', 'published')
        .eq('businesses.tenant_id', TENANT_ID)
        .limit(10000),
      s.from('business_categories')
        .select('business_id,categories!inner(slug,is_active,tenant_id)')
        .eq('categories.tenant_id', TENANT_ID)
        .eq('categories.is_active', true)
        .limit(20000),
    ])

    if (locationError || branchError || serviceError || categoryError) return {}

    const slugByLocation = new Map<string, string>()
    const businessesByLocation = new Map<string, Set<string>>()
    const categoriesByBusiness = new Map<string, Set<string>>()

    for (const location of locations ?? []) {
      slugByLocation.set(String(location.id), String(location.slug))
      businessesByLocation.set(String(location.id), new Set<string>())
    }

    for (const row of branches ?? []) {
      const locationId = String(row.location_id || '')
      if (!locationId || !businessesByLocation.has(locationId)) continue
      businessesByLocation.get(locationId)!.add(String(row.business_id))
    }

    for (const row of serviceAreas ?? []) {
      const locationId = String(row.location_id || '')
      if (!locationId || !businessesByLocation.has(locationId)) continue
      businessesByLocation.get(locationId)!.add(String(row.business_id))
    }

    for (const row of categoryRows ?? []) {
      const related: any = Array.isArray((row as any).categories) ? (row as any).categories[0] : (row as any).categories
      const slug = String(related?.slug || '')
      const businessId = String((row as any).business_id || '')
      if (!slug || !businessId) continue
      if (!categoriesByBusiness.has(businessId)) categoriesByBusiness.set(businessId, new Set<string>())
      categoriesByBusiness.get(businessId)!.add(slug)
    }

    const availability: SearchAvailability = {}
    for (const [locationId, businessIds] of businessesByLocation) {
      const citySlug = slugByLocation.get(locationId)
      if (!citySlug) continue
      const counts: Record<string, number> = {}
      for (const businessId of businessIds) {
        for (const categorySlug of categoriesByBusiness.get(businessId) ?? []) {
          counts[categorySlug] = (counts[categorySlug] ?? 0) + 1
        }
      }
      availability[citySlug] = counts
    }

    return availability
  } catch {
    return {}
  }
}
