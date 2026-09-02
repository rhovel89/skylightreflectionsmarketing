import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { getSiteUrl } from '@/lib/site-url'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const s = await createClient()
  const [
    { data: biz }, { data: seo }, { data: guides }, { data: locations }, { data: categories }, { data: branches }, { data: businessCategories },
  ] = await Promise.all([
    s.from('businesses').select('slug,updated_at').eq('tenant_id', TENANT_ID).eq('status', 'published'),
    s.from('seo_pages').select('city,category,updated_at').eq('tenant_id', TENANT_ID).eq('reviewed', true).eq('index_mode', 'auto'),
    s.from('guides').select('slug,updated_at').eq('tenant_id', TENANT_ID).eq('status', 'published'),
    s.from('locations').select('name,slug').eq('tenant_id', TENANT_ID).eq('is_active', true),
    s.from('categories').select('name,slug').eq('tenant_id', TENANT_ID).eq('is_active', true),
    s.from('business_locations').select('business_id,city,businesses!inner(status,tenant_id)').eq('tenant_id', TENANT_ID).eq('is_active', true).eq('businesses.status', 'published').eq('businesses.tenant_id', TENANT_ID).limit(10000),
    s.from('business_categories').select('business_id,categories!inner(name,tenant_id)').eq('categories.tenant_id', TENANT_ID).limit(20000),
  ])

  const citySlug = new Map((locations ?? []).map(x => [String(x.name).toLowerCase(), x.slug]))
  const categorySlug = new Map((categories ?? []).map(x => [String(x.name).toLowerCase(), x.slug]))
  const categoriesByBusiness = new Map<string, Set<string>>()
  for (const row of businessCategories ?? []) {
    const businessId = String((row as any).business_id || '')
    const joined = (row as any).categories
    const category = Array.isArray(joined) ? joined[0] : joined
    const name = String(category?.name || '').trim().toLowerCase()
    if (!businessId || !name) continue
    const set = categoriesByBusiness.get(businessId) ?? new Set<string>()
    set.add(name); categoriesByBusiness.set(businessId, set)
  }

  const cityCoverage = new Map<string, Set<string>>()
  const categoryCoverage = new Map<string, Set<string>>()
  for (const row of branches ?? []) {
    const id = String((row as any).business_id || '')
    const city = String((row as any).city || '').trim().toLowerCase()
    if (!id || !city) continue
    add(cityCoverage, city, id)
    for (const category of categoriesByBusiness.get(id) ?? []) add(categoryCoverage, `${city}|${category}`, id)
  }

  const fixed: [string, MetadataRoute.Sitemap[number]['changeFrequency'], number][] = [
    ['', 'weekly', 1],
    ['/home-services', 'weekly', .85],
    ['/legal-services', 'weekly', .85],
    ['/restaurants', 'weekly', .85],
    ['/local-stores', 'weekly', .85],
    ['/local-services', 'weekly', .85],
    ['/lawn-care', 'weekly', .8],
    ['/childcare', 'monthly', .7],
    ['/illinois', 'weekly', .8],
    ['/guides', 'weekly', .8],
    ['/for-businesses', 'monthly', .65],
    ['/about', 'monthly', .5],
    ['/contact', 'yearly', .4],
    ['/terms', 'yearly', .2],
    ['/listing-policy', 'yearly', .3],
    ['/privacy', 'yearly', .2],
    ['/advertising-disclosure', 'yearly', .3],
  ]

  const seoMap = new Map<string, MetadataRoute.Sitemap[number]>()
  for (const x of seo ?? []) {
    const rawCity = String((x as any).city || '').trim(); const cityKey = rawCity.toLowerCase(); const city = citySlug.get(cityKey)
    if (!city || ((cityCoverage.get(cityKey)?.size ?? 0) < 3)) continue
    const rawCategory = String((x as any).category || '').trim(); let url = `${base}/illinois/${city}`; let priority = .75
    if (rawCategory) {
      const categoryKey = rawCategory.toLowerCase(); const category = categorySlug.get(categoryKey)
      if (!category || ((categoryCoverage.get(`${cityKey}|${categoryKey}`)?.size ?? 0) < 3)) continue
      url += `/${category}`; priority = .8
    }
    const current = seoMap.get(url); const updated = (x as any).updated_at
    if (!current || (!current.lastModified && updated)) seoMap.set(url, { url, lastModified: updated || undefined, changeFrequency: 'weekly', priority })
  }

  return [
    ...fixed.map(([path, changeFrequency, priority]) => ({ url: base + path, changeFrequency, priority })),
    ...(biz ?? []).map(x => ({ url: `${base}/business/${x.slug}`, lastModified: x.updated_at || undefined, changeFrequency: 'monthly' as const, priority: .7 })),
    ...seoMap.values(),
    ...(guides ?? []).map(x => ({ url: `${base}/guides/${x.slug}`, lastModified: x.updated_at || undefined, changeFrequency: 'monthly' as const, priority: .7 })),
  ]
}

function add(map: Map<string, Set<string>>, key: string, id: string) { const set = map.get(key) ?? new Set<string>(); set.add(id); map.set(key, set) }
