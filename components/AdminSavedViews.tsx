'use client'

import { useEffect, useMemo, useState } from 'react'

type SavedView = {
  id: string
  scope: string
  name: string
  query_params: Record<string,string>
  is_default: boolean
}

export function AdminSavedViews({ scope, basePath, queryParams }: { scope: string; basePath: string; queryParams: Record<string,string> }) {
  const [views, setViews] = useState<SavedView[]>([])
  const [name, setName] = useState('')
  const [makeDefault, setMakeDefault] = useState(false)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const signature = useMemo(() => new URLSearchParams(queryParams).toString(), [queryParams])

  async function load() {
    setLoading(true)
    const response = await fetch(`/api/admin/saved-views?scope=${encodeURIComponent(scope)}`, { cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    if (response.ok) setViews(Array.isArray(body.views) ? body.views : [])
    else setStatus(String(body.error || 'Saved views could not be loaded.'))
    setLoading(false)
  }

  useEffect(() => { void load() }, [scope])

  useEffect(() => {
    if (loading || signature || typeof window === 'undefined') return
    const defaultView = views.find(view => view.is_default)
    if (!defaultView) return
    const target = new URLSearchParams(defaultView.query_params || {}).toString()
    if (target) window.location.replace(`${basePath}?${target}`)
  }, [loading, views, signature, basePath])

  async function saveView() {
    if (!name.trim()) return
    setStatus('Saving view…')
    const response = await fetch('/api/admin/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, name: name.trim(), query_params: queryParams, is_default: makeDefault }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setStatus(String(body.error || 'Could not save this view.'))
    setName('')
    setMakeDefault(false)
    setStatus('Saved.')
    await load()
  }

  async function setDefault(view: SavedView) {
    setStatus('Updating default view…')
    const response = await fetch('/api/admin/saved-views', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: view.id, scope }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setStatus(String(body.error || 'Could not update the default view.'))
    setStatus(`${view.name} is now your default.`)
    await load()
  }

  async function remove(view: SavedView) {
    setStatus('Removing view…')
    const response = await fetch('/api/admin/saved-views', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: view.id }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setStatus(String(body.error || 'Could not remove the view.'))
    setStatus('Saved view removed.')
    await load()
  }

  const openView = (view: SavedView) => {
    const params = new URLSearchParams(view.query_params || {}).toString()
    window.location.href = `${basePath}${params ? `?${params}` : ''}`
  }

  return <section className="admin-saved-views" aria-label="Saved admin views">
    <div className="admin-saved-views-head">
      <div><div className="kpi">Personal Workspace</div><strong>Saved Views</strong><span>Keep useful filter and sort combinations for this section.</span></div>
      <div className="admin-saved-view-create">
        <input value={name} onChange={event => setName(event.target.value)} placeholder="Name this view…" maxLength={120} aria-label="Saved view name" />
        <label><input type="checkbox" checked={makeDefault} onChange={event => setMakeDefault(event.target.checked)} /> Default</label>
        <button className="btn btn-small btn-primary" type="button" disabled={!name.trim()} onClick={() => void saveView()}>Save Current View</button>
      </div>
    </div>
    <div className="admin-saved-view-list">
      {loading ? <span className="muted small">Loading your saved views…</span> : null}
      {!loading && !views.length ? <span className="muted small">No saved views yet.</span> : null}
      {views.map(view => <div className={`admin-saved-view-chip ${view.is_default ? 'default' : ''}`} key={view.id}>
        <button type="button" onClick={() => openView(view)}><span>{view.is_default ? '★ ' : ''}{view.name}</span><small>{new URLSearchParams(view.query_params || {}).toString() || 'Default section view'}</small></button>
        {!view.is_default ? <button className="icon-action" type="button" onClick={() => void setDefault(view)} title="Make default">☆</button> : null}
        <button className="icon-action danger" type="button" onClick={() => void remove(view)} title="Delete saved view">×</button>
      </div>)}
    </div>
    {status ? <div className="admin-saved-view-status" role="status">{status}</div> : null}
  </section>
}
