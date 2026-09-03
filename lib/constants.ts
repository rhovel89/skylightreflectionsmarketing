export const TENANT_SLUG = process.env.NEXT_PUBLIC_DIRECTORY_TENANT_SLUG?.trim() || 'central-illinois-local-pros'
export const TENANT_ID = process.env.NEXT_PUBLIC_DIRECTORY_TENANT_ID?.trim() || '6673621d-b359-4c17-a984-c8f50d914eb3'
const DIRECTORY_NAME = process.env.NEXT_PUBLIC_DIRECTORY_NAME?.trim() || 'Central Illinois Local Pros'
const DIRECTORY_REGION = process.env.NEXT_PUBLIC_DIRECTORY_REGION?.trim() || 'Central Illinois'
const PARENT_BRAND = process.env.NEXT_PUBLIC_PARENT_BRAND_NAME?.trim() || 'Skylight Reflections Marketing'
export const LAUNCH_CITIES = [
  'Bloomington','Normal','Peoria','Springfield','Champaign','Urbana',
  'Pontiac','Decatur','Lincoln','Ottawa','Streator','Morris',
] as const
export const VERTICALS = [
  { key: 'home', label: 'Home Services', href: '/home-services' },
  { key: 'legal', label: 'Attorneys', href: '/legal-services' },
  { key: 'restaurant', label: 'Restaurants', href: '/restaurants' },
  { key: 'retail', label: 'Local Stores', href: '/local-stores' },
  { key: 'other', label: 'Local Services', href: '/local-services' },
] as const
export const STAFF_ROLES = ['staff','admin','super_admin'] as const
export const ADMIN_ROLES = ['admin','super_admin'] as const
export const DEFAULT_BRAND = {
  directory_name: DIRECTORY_NAME,
  parent_brand_name: PARENT_BRAND,
  brand_logo_url: '',
  brand_primary_color: '#4A00E0',
  brand_secondary_color: '#5478F6',
  brand_accent_color: '#00CFEA',
  brand_dark_color: '#000000',
  brand_charcoal_color: '#1C1C22',
  brand_light_color: '#F5F5F5',
  brand_silver_color: '#BFC3CC',
  consumer_tagline: 'Find the Right Local Pro.',
  business_tagline: 'Get Found by More Local Customers.',
  hero_eyebrow: process.env.NEXT_PUBLIC_DIRECTORY_HERO_EYEBROW?.trim() || `${DIRECTORY_REGION} Business Directory`,
  hero_title: 'Find the Right Local Pro.',
  hero_subtitle: process.env.NEXT_PUBLIC_DIRECTORY_HERO_SUBTITLE?.trim() || `Find home-service professionals, attorneys, restaurants, local stores and independent local service providers across ${DIRECTORY_REGION}. Compare local profiles and connect directly.`,
  footer_text: `Powered by ${PARENT_BRAND}`,
}
