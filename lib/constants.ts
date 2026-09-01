export const TENANT_SLUG = 'central-illinois-local-pros'
export const TENANT_ID = '6673621d-b359-4c17-a984-c8f50d914eb3'
export const LAUNCH_CITIES = [
  'Bloomington','Normal','Peoria','Springfield','Champaign','Urbana',
  'Pontiac','Decatur','Lincoln','Ottawa','Streator','Morris',
] as const
export const VERTICALS = [
  { key: 'home', label: 'Home Services', href: '/home-services' },
  { key: 'legal', label: 'Attorneys', href: '/legal-services' },
  { key: 'restaurant', label: 'Restaurants', href: '/restaurants' },
  { key: 'retail', label: 'Local Stores', href: '/local-stores' },
] as const
export const STAFF_ROLES = ['staff','admin','super_admin'] as const
export const ADMIN_ROLES = ['admin','super_admin'] as const
export const DEFAULT_BRAND = {
  directory_name: 'Central Illinois Local Pros',
  parent_brand_name: 'Skylight Reflections Marketing',
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
  hero_eyebrow: 'Central Illinois Business Directory',
  hero_title: 'Find the Right Local Pro.',
  hero_subtitle: 'Find home-service professionals, attorneys, restaurants and local stores across Central Illinois. Compare local profiles and connect directly.',
  footer_text: 'Powered by Skylight Reflections Marketing',
}
