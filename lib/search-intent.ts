export type SearchIntent = { slug: string; phrase: string }

const normalize = (value: unknown) => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9\s-]/g, ' ')
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const aliases: Record<string, string> = {
  'plumber': 'plumbing', 'plumbers': 'plumbing',
  'electrician': 'electrical', 'electricians': 'electrical',
  'ac repair': 'hvac', 'air conditioning': 'hvac', 'heating and cooling': 'hvac', 'heating cooling': 'hvac',
  'handyman': 'handyman', 'handy man': 'handyman',
  'lawn mowing': 'lawn-care', 'grass cutting': 'lawn-care', 'lawn service': 'lawn-care',
  'landscaper': 'landscaping', 'landscapers': 'landscaping', 'landscape contractor': 'landscaping',
  'power washing': 'pressure-washing', 'pressure washer': 'pressure-washing',
  'roofer': 'roofing', 'roofers': 'roofing', 'roofing contractor': 'roofing',
  'tree removal': 'tree-services', 'tree trimming': 'tree-services', 'arborist': 'tree-services',
  'junk hauling': 'junk-removal', 'junk hauler': 'junk-removal',
  'exterminator': 'pest-control', 'pest exterminator': 'pest-control',
  'house cleaning': 'cleaning', 'cleaning service': 'cleaning',
  'carpet cleaner': 'carpet-cleaning', 'carpet cleaners': 'carpet-cleaning',
  'garage door repair': 'garage-doors', 'fence contractor': 'fencing', 'window contractor': 'windows',

  'dui lawyer': 'dui', 'dui attorney': 'dui',
  'criminal lawyer': 'criminal-defense', 'criminal attorney': 'criminal-defense',
  'injury lawyer': 'personal-injury', 'injury attorney': 'personal-injury', 'personal injury lawyer': 'personal-injury',
  'divorce lawyer': 'divorce', 'divorce attorney': 'divorce',
  'family lawyer': 'family-law', 'family attorney': 'family-law',
  'estate lawyer': 'estate-planning', 'estate planning lawyer': 'estate-planning',
  'probate lawyer': 'probate', 'probate attorney': 'probate',
  'bankruptcy lawyer': 'bankruptcy', 'bankruptcy attorney': 'bankruptcy',
  'workers comp lawyer': 'workers-compensation', 'workers compensation lawyer': 'workers-compensation',
  'disability lawyer': 'social-security-disability', 'social security lawyer': 'social-security-disability',
  'real estate attorney': 'real-estate-law', 'real estate lawyer': 'real-estate-law',
  'traffic lawyer': 'traffic-law', 'traffic attorney': 'traffic-law',
  'wills and trusts': 'wills-trusts', 'will lawyer': 'wills-trusts',

  'taco': 'mexican-restaurants', 'tacos': 'mexican-restaurants', 'mexican food': 'mexican-restaurants', 'taco restaurant': 'mexican-restaurants',
  'sushi': 'japanese-sushi', 'sushi restaurant': 'japanese-sushi', 'japanese food': 'japanese-sushi',
  'coffee': 'cafes-coffee', 'coffee shop': 'cafes-coffee', 'cafe': 'cafes-coffee',
  'bakery': 'bakeries-desserts', 'dessert': 'bakeries-desserts', 'desserts': 'bakeries-desserts',
  'bbq': 'barbecue', 'barbeque': 'barbecue', 'barbecue restaurant': 'barbecue',
  'burger': 'burgers', 'burger restaurant': 'burgers',
  'pizza place': 'pizza', 'pizza restaurant': 'pizza',
  'breakfast': 'breakfast-brunch', 'brunch': 'breakfast-brunch',
  'italian food': 'italian-restaurants', 'thai food': 'thai-restaurants',
  'steakhouse': 'steakhouses', 'steak house': 'steakhouses',
  'bar': 'bars-pubs', 'pub': 'bars-pubs', 'sports bar': 'bars-pubs',
  'sandwich shop': 'delis-sandwiches', 'deli': 'delis-sandwiches',

  'pet groomer': 'pet-grooming', 'pet groomers': 'pet-grooming',
  'dog groomer': 'dog-grooming', 'dog groomers': 'dog-grooming',
  'cat groomer': 'cat-grooming', 'cat groomers': 'cat-grooming',
  'mobile groomer': 'mobile-pet-grooming', 'mobile dog groomer': 'mobile-pet-grooming',
  'dog walker': 'dog-walking', 'pet sitter': 'pet-sitting',
  'dog boarding': 'pet-boarding', 'pet hotel': 'pet-boarding',
  'dog trainer': 'pet-training', 'pet trainer': 'pet-training',
  'pooper scooper': 'pet-waste-removal', 'pet waste cleanup': 'pet-waste-removal',
  'mobile nail trim': 'mobile-nail-trimming',
  'car detailer': 'auto-detailing', 'car detailing': 'auto-detailing', 'auto detailer': 'auto-detailing',

  'florist': 'florists', 'flower shop': 'florists',
  'thrift store': 'thrift-consignment', 'consignment shop': 'thrift-consignment',
  'antique store': 'antiques', 'craft store': 'art-craft-stores',
  'toy store': 'toys-games', 'sporting goods store': 'sporting-goods',
  'pet store': 'pet-stores', 'bridal shop': 'bridal-formalwear',
  'grocery store': 'grocery-specialty-foods', 'gift shop': 'gift-shops',
  'furniture store': 'furniture-home-decor', 'hardware store': 'hardware',
}

const stripIntentNoise = (value: string) => value
  .replace(/^(find|show me|search for|looking for)\s+/, '')
  .replace(/^(best|top|local)\s+/, '')
  .replace(/\s+(near me|nearby)$/, '')
  .trim()

export function resolveCategoryIntent(value: unknown): SearchIntent | null {
  const phrase = stripIntentNoise(normalize(value))
  if (!phrase) return null
  const slug = aliases[phrase]
  return slug ? { slug, phrase } : null
}

export function normalizeSearchIntent(value: unknown) {
  return stripIntentNoise(normalize(value))
}
