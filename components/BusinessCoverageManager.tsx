'use client'

import { useMemo, useState } from 'react'
import { updateBusinessCoverage } from '@/app/admin/business-workspace-actions'

type Category = { id: string; name: string; vertical?: string | null }
type Location = { id: string; name: string; county?: string | null; state?: string | null }

export function BusinessCoverageManager({
  businessId,
  categories,
  selectedCategoryIds,
  primaryCategoryId,
  locations,
  selectedServiceAreaIds,
}: {
  businessId: string
  categories: Category[]
  selectedCategoryIds: string[]
  primaryCategoryId: string
  locations: Location[]
  selectedServiceAreaIds: string[]
}) {
  const [categoryIds, setCategoryIds] = useState(selectedCategoryIds)
  const [primaryId, setPrimaryId] = useState(primaryCategoryId || selectedCategoryIds[0] || '')
  const [serviceAreaIds, setServiceAreaIds] = useState(selectedServiceAreaIds)
  const [categoryQuery, setCategoryQuery] = useState('')
  const [locationQuery, setLocationQuery] = useState('')

  const shownCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase()
    return categories.filter((category) => !q || `${category.name} ${category.vertical ?? ''}`.toLowerCase().includes(q))
  }, [categories, categoryQuery])

  const shownLocations = useMemo(() => {
    const q = locationQuery.trim().toLowerCase()
    return locations.filter((location) => !q || `${location.name} ${location.county ?? ''} ${location.state ?? ''}`.toLowerCase().includes(q)).slice(0, 180)
  }, [locations, locationQuery])

  function toggleCategory(id: string) {
    setCategoryIds((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current
        const next = current.filter((value) => value !== id)
        if (primaryId === id) setPrimaryId(next[0] || '')
        return next
      }
      return [...current, id]
    })
  }

  function toggleServiceArea(id: string) {
    setServiceAreaIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : current.length < 50 ? [...current, id] : current)
  }

  return (
    <form action={updateBusinessCoverage} className="business-workspace-coverage">
      <input type="hidden" name="business_id" value={businessId} />
      {categoryIds.map((id) => <input key={`category-${id}`} type="hidden" name="category_ids" value={id} />)}
      {serviceAreaIds.map((id) => <input key={`area-${id}`} type="hidden" name="service_area_ids" value={id} />)}

      <section className="admin-card workspace-settings-card">
        <div className="section-head compact-head">
          <div>
            <div className="kpi">Directory Taxonomy</div>
            <h2>Categories</h2>
            <p className="small muted">Keep only categories that genuinely describe the business. One selected category must remain primary.</p>
          </div>
          <span className="badge neutral">{categoryIds.length} selected</span>
        </div>
        <label className="admin-filter-search workspace-inline-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="Find a category…" />
        </label>
        <div className="workspace-choice-grid">
          {shownCategories.map((category) => {
            const checked = categoryIds.includes(category.id)
            return (
              <label className={`workspace-choice ${checked ? 'selected' : ''}`} key={category.id}>
                <input type="checkbox" checked={checked} onChange={() => toggleCategory(category.id)} />
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.vertical || 'Directory category'}</small>
                </span>
                {checked ? <input type="radio" name="primary_category_id" value={category.id} checked={primaryId === category.id} onChange={() => setPrimaryId(category.id)} aria-label={`Make ${category.name} primary`} /> : null}
              </label>
            )
          })}
        </div>
      </section>

      <section className="admin-card workspace-settings-card">
        <div className="section-head compact-head">
          <div>
            <div className="kpi">Service Coverage</div>
            <h2>Service Areas</h2>
            <p className="small muted">These are places the business legitimately serves. They never create a physical office, storefront, restaurant, or branch.</p>
          </div>
          <span className="badge neutral">{serviceAreaIds.length} selected</span>
        </div>
        <div className="notice"><strong>Integrity rule:</strong> service areas remain service areas. Add a location under Physical Locations only when a real source-backed office or storefront exists.</div>
        <label className="admin-filter-search workspace-inline-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="Find a city or town…" />
        </label>
        <div className="workspace-choice-grid workspace-location-choices">
          {shownLocations.map((location) => {
            const checked = serviceAreaIds.includes(location.id)
            return (
              <label className={`workspace-choice ${checked ? 'selected' : ''}`} key={location.id}>
                <input type="checkbox" checked={checked} onChange={() => toggleServiceArea(location.id)} />
                <span>
                  <strong>{location.name}</strong>
                  <small>{[location.county, location.state].filter(Boolean).join(', ') || 'Active market'}</small>
                </span>
              </label>
            )
          })}
        </div>
      </section>

      <div className="workspace-save-bar">
        <div>
          <strong>Coverage changes are staff-controlled.</strong>
          <span>Saving updates categories and service areas only; it does not claim, verify, sponsor, or create a branch.</span>
        </div>
        <button className="btn btn-primary" type="submit">Save Categories & Service Areas</button>
      </div>
    </form>
  )
}
