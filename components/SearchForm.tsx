import type { Category, Location } from '@/lib/types'
import { getSearchAvailability, type SearchAvailability } from '@/lib/search-availability'
import { SearchFormClient } from '@/components/SearchFormClient'

type SearchDefaults = { category?: string; city?: string; q?: string }

export async function SearchForm({
  categories = [],
  locations = [],
  defaults = {},
  availability,
}: {
  categories?: Category[]
  locations?: Location[]
  defaults?: SearchDefaults
  availability?: SearchAvailability
}) {
  const resolvedAvailability = availability ?? await getSearchAvailability()
  return <SearchFormClient categories={categories} locations={locations} defaults={defaults} availability={resolvedAvailability} />
}
