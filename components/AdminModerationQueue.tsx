'use client'

import { useMemo, useState } from 'react'

type Row = Record<string, any>
type Kind = 'claims' | 'edit-requests' | 'submissions' | 'reports'
type Decision = 'approve' | 'reject' | 'resolve' | 'dismiss'
type QueueView = 'pending' | 'reviewed' | 'all'

const isOpen = (row: Row) => ['pending', 'in_review', 'new'].includes(row.status)

export function AdminModerationQueue({ kind, rows }: { kind: Kind; rows: Row[] }) {
  const [data, setData] = useState(rows)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [view, setView] = useState<QueueView>('pending')
  const [query, setQuery] = useState('')

  const pending = useMemo(() => data.filter(isOpen), [data])
  const reviewed = useMemo(() => data.filter((row) => !isOpen(row)), [data])
  const normalizedQuery = query.trim().toLowerCase()
  const visible = useMemo(() => {
    const base = view === 'pending' ? pending : view === 'reviewed' ? reviewed : data
    if (!normalizedQuery) return base
    return base.filter((row) => JSON.stringify(row).toLowerCase().includes(normalizedQuery))
  }, [data, pending, reviewed, view, normalizedQuery])

  async function review(id: string, decision: Decision) {
    setBusy(id + decision)
    setMessage('')
    const response = await fetch('/api/admin/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, decision, notes: notes[id] || '' }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const raw = String(body.error || 'Review failed.')
      const friendly = raw.includes('claimant_account_required')
        ? 'Approval blocked: the claimant must first create an account using the same email address as the claim.'
        : raw.includes('possible_duplicate_business')
          ? 'Approval blocked: a possible duplicate business already exists. Review the canonical listings before approving.'
          : raw.includes('category_not_found')
            ? 'Approval blocked: the submitted category does not match an active directory category.'
            : raw.includes('location_not_found')
              ? 'Approval blocked: the submitted city does not match an active city market.'
              : raw.includes('pro_plan_required_for_pro_profile')
                ? 'Approval blocked: this premium profile can only be published while the business has an active Pro plan.'
                : raw
      setMessage(friendly)
      setBusy(null)
      return
    }

    const nextStatus = decision === 'approve'
      ? 'approved'
      : decision === 'reject'
        ? 'rejected'
        : decision === 'resolve'
          ? 'resolved'
          : 'dismissed'

    setData((current) => current.map((item) => String(item.id) === id
      ? {
          ...item,
          status: nextStatus,
          review_notes: notes[id] || item.review_notes,
          staff_notes: notes[id] || item.staff_notes,
          reviewed_at: new Date().toISOString(),
        }
      : item))

    setMessage(
      decision === 'approve'
        ? 'Approved and applied through the protected workflow.'
        : decision === 'reject'
          ? 'Rejected and recorded in the audit trail.'
          : decision === 'resolve'
            ? 'Report resolved and recorded in the audit trail.'
            : 'Report dismissed and recorded in the audit trail.',
    )
    setBusy(null)
  }

  return (
    <div className="moderation-shell">
      <div className="admin-workflow-toolbar">
        <div className="admin-segmented" role="group" aria-label="Moderation queue view">
          <button type="button" className={view === 'pending' ? 'active' : ''} onClick={() => setView('pending')}>
            Awaiting <span>{pending.length}</span>
          </button>
          <button type="button" className={view === 'reviewed' ? 'active' : ''} onClick={() => setView('reviewed')}>
            Reviewed <span>{reviewed.length}</span>
          </button>
          <button type="button" className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>
            All <span>{data.length}</span>
          </button>
        </div>
        <label className="admin-filter-search admin-workflow-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find business, person, email, city or status…"
            aria-label="Search moderation queue"
          />
        </label>
      </div>

      <div className="admin-list-meta">
        <span className="kpi">{visible.length} shown · {pending.length} awaiting review</span>
        <span className="small muted">Protected workflow actions cannot be bypassed through the generic table editor.</span>
      </div>

      {message && <div className={`notice ${message.startsWith('Approval blocked') ? 'warn' : 'success'}`}>{message}</div>}

      <div className="moderation-list">
        {visible.map((row) => (
          <article className="admin-card moderation-card" key={String(row.id)}>
            <div className="moderation-head">
              <div>
                <div className="badges">
                  <span className={`badge ${['approved', 'resolved'].includes(row.status) ? 'verified' : ['rejected', 'dismissed'].includes(row.status) ? 'neutral' : 'sponsored'}`}>
                    {label(row.status)}
                  </span>
                  {kind === 'claims' && row.businesses?.claimed && <span className="badge neutral">Business already claimed</span>}
                </div>
                <h3>{kind === 'submissions' ? row.business_name : row.businesses?.name || 'Business record'}</h3>
                <p className="small muted">
                  {kind === 'claims'
                    ? `${row.claimant_name} · ${row.claimant_role || 'Role not supplied'} · ${row.email}`
                    : kind === 'submissions'
                      ? `${row.category} · ${row.city} · submitted ${formatDate(row.created_at)}`
                      : kind === 'reports'
                        ? `${label(row.report_type)} · reported ${formatDate(row.created_at)}`
                        : `${label(row.request_type)} · submitted ${formatDate(row.created_at)}`}
                </p>
              </div>
              {row.businesses?.slug && (
                <a className="btn btn-light" href={`/business/${row.businesses.slug}`} target="_blank" rel="noreferrer">
                  View Public Profile
                </a>
              )}
            </div>

            {kind === 'claims'
              ? <ClaimDetails row={row} />
              : kind === 'submissions'
                ? <SubmissionDetails row={row} />
                : kind === 'reports'
                  ? <ReportDetails row={row} />
                  : <EditDetails row={row} />}

            <label className="moderation-notes">
              Staff notes
              <textarea
                value={notes[String(row.id)] ?? String(row.review_notes ?? row.staff_notes ?? '')}
                onChange={(event) => setNotes((current) => ({ ...current, [String(row.id)]: event.target.value }))}
                placeholder="Document verification evidence, action taken, or reason for the decision."
              />
            </label>

            {isOpen(row)
              ? kind === 'reports'
                ? <div className="moderation-actions">
                    <button className="btn btn-primary" disabled={busy !== null} onClick={() => review(String(row.id), 'resolve')}>
                      {busy === String(row.id) + 'resolve' ? 'Resolving…' : 'Resolve Report'}
                    </button>
                    <button className="btn btn-light" disabled={busy !== null} onClick={() => review(String(row.id), 'dismiss')}>
                      {busy === String(row.id) + 'dismiss' ? 'Dismissing…' : 'Dismiss'}
                    </button>
                  </div>
                : <div className="moderation-actions">
                    <button className="btn btn-primary" disabled={busy !== null} onClick={() => review(String(row.id), 'approve')}>
                      {busy === String(row.id) + 'approve' ? 'Approving…' : 'Approve'}
                    </button>
                    <button className="btn btn-danger" disabled={busy !== null} onClick={() => review(String(row.id), 'reject')}>
                      {busy === String(row.id) + 'reject' ? 'Rejecting…' : 'Reject'}
                    </button>
                  </div>
              : <p className="small muted">Reviewed {formatDate(row.reviewed_at)}.</p>}
          </article>
        ))}
      </div>

      {!visible.length && <div className="empty">No moderation records match this view.</div>}
    </div>
  )
}

function ClaimDetails({ row: r }: { row: Row }) {
  return <div className="moderation-details">
    <div><span>Claimant</span><strong>{r.claimant_name}</strong></div>
    <div><span>Email</span><strong>{r.email}</strong></div>
    <div><span>Phone</span><strong>{r.phone || 'Not supplied'}</strong></div>
    <div><span>Submitted</span><strong>{formatDate(r.created_at)}</strong></div>
    <p className="small muted full-row">Approval connects the matching account as an owner and marks the listing claimed. It does not automatically mark the listing verified.</p>
  </div>
}

function SubmissionDetails({ row: r }: { row: Row }) {
  return <div>
    <div className="moderation-details">
      <div><span>Category</span><strong>{r.category}</strong></div>
      <div><span>City</span><strong>{r.city}</strong></div>
      <div><span>Phone</span><strong>{r.phone || 'Not supplied'}</strong></div>
      <div><span>Website</span><strong>{r.website || 'Not supplied'}</strong></div>
    </div>
    {r.description && <div className="change-preview">
      <div><span>Description</span><strong>{r.description}</strong></div>
      <div><span>Contact</span><strong>{[r.contact_name, r.email].filter(Boolean).join(' · ') || 'Not supplied'}</strong></div>
    </div>}
    <p className="small muted">Approval creates one canonical published business with claimed, verified, featured, rating and review defaults left conservative. No physical branch is invented because the current submission form does not collect a street address.</p>
  </div>
}

function ReportDetails({ row: r }: { row: Row }) {
  return <div>
    <div className="moderation-details">
      <div><span>Report Type</span><strong>{label(r.report_type)}</strong></div>
      <div><span>Reporter</span><strong>{r.reporter_name || 'Anonymous'}</strong></div>
      <div><span>Email</span><strong>{r.reporter_email || 'Not supplied'}</strong></div>
      <div><span>Submitted</span><strong>{formatDate(r.created_at)}</strong></div>
    </div>
    <div className="change-preview">
      <div><span>Report Details</span><strong>{r.details}</strong></div>
      <div><span>Workflow Rule</span><strong>Resolving this report records review completion only. It does not automatically close, merge, verify, or otherwise change the public business.</strong></div>
    </div>
  </div>
}

function EditDetails({ row: r }: { row: Row }) {
  const changes = r.proposed_changes && typeof r.proposed_changes === 'object' ? r.proposed_changes : {}
  const supported = ['profile_update', 'pro_profile_update'].includes(String(r.request_type))
  return <div>
    <div className="moderation-details">
      <div><span>Request type</span><strong>{label(r.request_type)}</strong></div>
      <div><span>Submitted</span><strong>{formatDate(r.created_at)}</strong></div>
    </div>
    <div className="change-preview">
      {Object.entries(changes).map(([key, value]) => <div key={key}>
        <span>{label(key)}</span>
        <strong style={{ whiteSpace: 'pre-wrap' }}>{value && typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '')}</strong>
      </div>)}
      {!Object.keys(changes).length && <p className="small muted">No proposed fields supplied.</p>}
    </div>
    {r.request_type === 'pro_profile_update' && <div className="notice"><strong>Pro profile review:</strong> approval replaces the currently approved Pro services, FAQs, offer and social-link block. It publishes only while the business has an active Pro plan.</div>}
    {!supported && <div className="notice warn">This request type requires manual staff handling. The protected auto-apply workflow currently approves standard profile updates and Pro mini-site updates.</div>}
  </div>
}

function formatDate(value: any) {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function label(value: string) {
  return String(value || '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}
