'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { AdminEntityConfig } from '@/lib/admin'

export function AdminEntityEditor({
  section,
  cfg,
  rows,
}: {
  section: string
  cfg: AdminEntityConfig
  rows: Record<string, unknown>[]
}) {
  const [data, setData] = useState(rows)
  const [status, setStatus] = useState('')
  const [statusKind, setStatusKind] = useState<'idle' | 'success' | 'error'>('idle')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const editable = section === 'businesses' ? cfg.editable.filter((key) => key !== 'status') : cfg.editable
  const normalizedQuery = query.trim().toLowerCase()
  const columns = Object.keys(data[0] ?? {})
  const bulkWorkflowEnabled = section === 'data-quality' || section === 'growth-opportunities'
  const filtered = useMemo(() => {
    if (!normalizedQuery) return data
    return data.filter((row) =>
      Object.values(row).some((value) => stringifyValue(value).toLowerCase().includes(normalizedQuery)),
    )
  }, [data, normalizedQuery])
  const visibleKeys = filtered.map((row, index) => rowKey(row, index))
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(key => selected.has(key))
  const selectedRows = data.filter((row, index) => selected.has(rowKey(row, index)))

  async function save(id: string, changes: Record<string, unknown>) {
    setStatus('Saving changes…')
    setStatusKind('idle')
    const response = await fetch('/api/admin/entity', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, id, changes }),
    })
    const body = await response.json().catch(() => ({}))
    setStatus(response.ok ? 'Changes saved.' : String(body.error || 'Save failed.'))
    setStatusKind(response.ok ? 'success' : 'error')
  }

  async function lifecycle(row: Record<string, unknown>, action: string) {
    setStatus('Updating business visibility…')
    setStatusKind('idle')
    const response = await fetch('/api/admin/business-visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: String(row.id), action }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(String(body.error || 'Visibility update failed.'))
      setStatusKind('error')
      return
    }
    if (action !== 'remove_featured') {
      setData((current) => current.map((item) => (item.id === row.id ? { ...item, status: body.status } : item)))
    }
    setStatus(action === 'remove_featured' ? 'Removed from all Featured placements.' : 'Business visibility updated.')
    setStatusKind('success')
  }

  async function applyBulk() {
    if (!bulkWorkflowEnabled || !bulkAction) return
    const ids = selectedRows.map(row => String(row.id || '')).filter(Boolean)
    if (!ids.length) return
    setStatus(`Applying ${bulkAction.replaceAll('_', ' ')} to ${ids.length} records…`)
    setStatusKind('idle')
    const response = await fetch('/api/admin/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, action: bulkAction, ids, value: bulkValue }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(String(body.error || 'Bulk update failed.'))
      setStatusKind('error')
      return
    }
    setData(current => current.map(row => {
      if (!ids.includes(String(row.id || ''))) return row
      if (bulkAction === 'start') return { ...row, status: 'in_progress' }
      if (bulkAction === 'reopen') return { ...row, status: 'open' }
      if (bulkAction === 'assign') return { ...row, assigned_user_id: bulkValue || null }
      if (bulkAction === 'due') return { ...row, due_at: bulkValue || null }
      return row
    }))
    setSelected(new Set())
    setBulkAction('')
    setBulkValue('')
    setStatus(`${Number(body.updated || ids.length)} records updated.`)
    setStatusKind('success')
  }

  function exportSelected() {
    if (!selectedRows.length) return
    const exportColumns = Object.keys(selectedRows[0] || {})
    const lines = [exportColumns.map(csvCell).join(','), ...selectedRows.map(row => exportColumns.map(column => csvCell(row[column])).join(','))]
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${section}-selected-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function copyIds() {
    const ids = selectedRows.map(row => String(row.id || row.business_id || '')).filter(Boolean)
    if (!ids.length) return
    await navigator.clipboard.writeText(ids.join('\n'))
    setStatus(`${ids.length} record ID${ids.length === 1 ? '' : 's'} copied.`)
    setStatusKind('success')
  }

  if (!data.length) return <div className="empty">No records in this section yet.</div>

  return (
    <div className="admin-entity-editor">
      <div className="admin-filter-bar">
        <label className="admin-filter-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter the records shown below…"
            aria-label={`Filter ${cfg.title} records`}
          />
        </label>
        <div className="admin-filter-summary">
          <span>{filtered.length} of {data.length} shown</span>
          <span>·</span>
          <span>{selected.size} selected</span>
          <span>·</span>
          <span>{cfg.readOnly ? 'Read only' : `${editable.length} editable fields`}</span>
        </div>
      </div>

      {selectedRows.length > 0 ? <div className="admin-bulk-toolbar">
        <div><strong>{selectedRows.length} selected</strong><span>Selection tools only affect the records you checked.</span></div>
        <div className="admin-bulk-actions">
          <button className="btn btn-small btn-light" type="button" onClick={exportSelected}>Export Selected</button>
          <button className="btn btn-small btn-light" type="button" onClick={() => void copyIds()}>Copy IDs</button>
          {bulkWorkflowEnabled ? <>
            <select value={bulkAction} onChange={event => { setBulkAction(event.target.value); setBulkValue('') }} aria-label="Bulk workflow action">
              <option value="">Safe workflow action…</option>
              <option value="start">Start Work</option>
              <option value="reopen">Reopen</option>
              <option value="assign">Assign Staff User</option>
              <option value="due">Set Due Date</option>
            </select>
            {bulkAction === 'assign' ? <input value={bulkValue} onChange={event => setBulkValue(event.target.value)} placeholder="Staff user UUID (blank clears)" aria-label="Bulk assignee user ID" /> : null}
            {bulkAction === 'due' ? <input type="date" value={bulkValue} onChange={event => setBulkValue(event.target.value)} aria-label="Bulk due date" /> : null}
            <button className="btn btn-small btn-primary" type="button" disabled={!bulkAction} onClick={() => void applyBulk()}>Apply to {selectedRows.length}</button>
          </> : null}
          <button className="btn btn-small btn-light" type="button" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      </div> : null}

      {section === 'businesses' && (
        <div className="notice">
          <strong>Business workspace:</strong> use <b>Manage Business</b> for the complete cross-system view. Super Admin lifecycle controls remain here: Hide uses the existing <code>suspended</code> state, Unpublish uses <code>draft</code>, and Archive retains history. Any non-published state automatically removes active paid placements and public/SEO eligibility. Generic bulk tools intentionally cannot verify, claim, publish or alter organic ranking.
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-select-cell"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(current => {
                const next = new Set(current)
                if (allVisibleSelected) visibleKeys.forEach(key => next.delete(key)); else visibleKeys.forEach(key => next.add(key))
                return next
              })} aria-label="Select all visible records" /></th>
              {columns.map((key) => <th key={key}>{friendlyLabel(key)}</th>)}
              {!cfg.readOnly && <th>Save</th>}
              {section === 'businesses' && <th>Business Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => {
              const key = rowKey(row, index)
              return <EditableRow
                key={key}
                section={section}
                row={row}
                editable={editable}
                readOnly={cfg.readOnly}
                selected={selected.has(key)}
                onSelected={(checked) => setSelected(current => {
                  const next = new Set(current)
                  if (checked) next.add(key); else next.delete(key)
                  return next
                })}
                onSave={(changes) => save(String(row.id), changes)}
                onLifecycle={(action) => lifecycle(row, action)}
                onChange={(field, value) => setData((current) => current.map((item) => (
                  item.id === row.id ? { ...item, [field]: value } : item
                )))}
              />
            })}
          </tbody>
        </table>
      </div>

      {query && !filtered.length ? <div className="empty">No records match “{query}”.</div> : null}
      <div className={`admin-editor-status ${statusKind === 'success' ? 'success' : statusKind === 'error' ? 'error' : ''}`} role="status">
        {status}
      </div>
    </div>
  )
}

function EditableRow({
  section,
  row,
  editable,
  readOnly,
  selected,
  onSelected,
  onSave,
  onChange,
  onLifecycle,
}: {
  section: string
  row: Record<string, unknown>
  editable: string[]
  readOnly?: boolean
  selected: boolean
  onSelected: (checked: boolean) => void
  onSave: (changes: Record<string, unknown>) => void
  onChange: (key: string, value: unknown) => void
  onLifecycle: (action: string) => void
}) {
  const [dirty, setDirty] = useState<Record<string, unknown>>({})
  const state = String(row.status || '')
  const set = (key: string, value: unknown) => {
    onChange(key, value)
    setDirty((current) => ({ ...current, [key]: value }))
  }

  return (
    <tr className={selected ? 'selected' : ''}>
      <td className="admin-select-cell"><input type="checkbox" checked={selected} onChange={event => onSelected(event.target.checked)} aria-label={`Select ${String(row.name || row.title || row.id || 'record')}`} /></td>
      {Object.entries(row).map(([key, value]) => (
        <td key={key}>
          {editable.includes(key)
            ? <Editor value={value} onChange={(next) => set(key, next)} />
            : <DisplayValue field={key} value={value} />}
        </td>
      ))}
      {!readOnly && (
        <td>
          <button
            className={`btn btn-small ${Object.keys(dirty).length ? 'btn-primary' : 'btn-light'}`}
            disabled={!Object.keys(dirty).length}
            onClick={() => {
              onSave(dirty)
              setDirty({})
            }}
          >
            {Object.keys(dirty).length ? `Save ${Object.keys(dirty).length}` : 'Saved'}
          </button>
        </td>
      )}
      {section === 'businesses' && (
        <td>
          <div className="admin-row-actions">
            <Link className="btn btn-small btn-primary" href={`/admin/businesses/${String(row.id)}`}>Manage Business</Link>
            {state === 'published' && <>
              <Link className="btn btn-small btn-light" href={`/business/${String(row.slug)}`} target="_blank">View Public</Link>
              <button className="btn btn-small btn-light" onClick={() => onLifecycle('hide')}>Hide</button>
              <button className="btn btn-small btn-light" onClick={() => onLifecycle('unpublish')}>Unpublish</button>
            </>}
            {state === 'suspended' && <button className="btn btn-small btn-light" onClick={() => onLifecycle('unhide')}>Unhide</button>}
            {['draft', 'pending', 'archived'].includes(state) && <button className="btn btn-small btn-light" onClick={() => onLifecycle('republish')}>Republish</button>}
            {state !== 'archived' && <button className="btn btn-small btn-light" onClick={() => onLifecycle('archive')}>Archive</button>}
            <button className="btn btn-small btn-light" onClick={() => onLifecycle('remove_featured')}>Remove Featured</button>
            <Link className="btn btn-small btn-light" href={`/admin/sponsorships?business=${String(row.id)}`}>Sponsorships</Link>
            <Link className="btn btn-small btn-light" href={`/admin/subscriptions?business=${String(row.id)}`}>Subscription</Link>
          </div>
        </td>
      )}
    </tr>
  )
}

function DisplayValue({ field, value }: { field: string; value: unknown }) {
  if (typeof value === 'boolean') return <span className={`admin-bool ${value ? 'yes' : 'no'}`}>{value ? 'Yes' : 'No'}</span>
  if (value === null || value === undefined || value === '') return <span className="muted">—</span>
  if (field === 'status' || field === 'priority' || field === 'index_mode') {
    const raw = String(value)
    const tone = ['published', 'approved', 'resolved', 'active', 'verified', 'high'].includes(raw)
      ? 'verified'
      : ['pending', 'in_progress', 'hot', 'sponsored'].includes(raw)
        ? 'sponsored'
        : 'neutral'
    return <span className={`badge ${tone}`}>{friendlyLabel(raw)}</span>
  }
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    return <a className="admin-cell-link" href={value} target="_blank" rel="noreferrer" title={value}>{shortUrl(value)}</a>
  }
  if (field === 'id' || field.endsWith('_id') || field.endsWith('_key')) {
    return <code className="admin-cell-code" title={String(value)}>{String(value)}</code>
  }
  const text = stringifyValue(value)
  return <span title={text}>{text}</span>
}

function Editor({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  if (typeof value === 'boolean') return <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
  if (typeof value === 'number') return <input className="table-input" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
  if (value !== null && typeof value === 'object') {
    return <textarea className="table-input" value={JSON.stringify(value)} onChange={(event) => {
      try { onChange(JSON.parse(event.target.value)) } catch { onChange(event.target.value) }
    }} />
  }
  return <input className="table-input" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
}

function rowKey(row: Record<string, unknown>, index: number) {
  return String(row.id ?? `${row.business_id ?? 'row'}:${row.stat_date ?? row.updated_at ?? index}`)
}

function csvCell(value: unknown) {
  let text = stringifyValue(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function friendlyLabel(value: string) {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function shortUrl(value: string) {
  try {
    const url = new URL(value)
    return `${url.hostname.replace(/^www\./, '')}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return value
  }
}
