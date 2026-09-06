'use client'

import { useMemo, useState } from 'react'

type Row = Record<string, any>

type Props = {
  rows: Row[]
}

const serviceLabels: Record<string, string> = {
  'web-design': 'Web Design',
  seo: 'Local SEO',
  'google-business-profile-optimization': 'Google Business Profile Optimization',
  'social-media-management': 'Social Media Management',
  'social-media-marketing': 'Social Media Marketing',
  branding: 'Branding',
  'graphic-design': 'Graphic Design',
  'lead-generation': 'Lead Generation',
}

const signalLabels: Record<string, string> = {
  'first_party:missing_website': 'the directory currently has no website on file',
  'first_party:low_profile_completion': 'the Local Pros profile has room for more complete business information',
  'first_party:missing_catalog': 'no business catalog is currently on file',
  'first_party:missing_portfolio': 'no portfolio is currently on file',
  'first_party:strong_reviews_weak_web': 'strong customer-review signals are paired with a limited web presence',
  'first_party:high_visibility_low_conversion': 'recent Local Pros visibility has not produced recorded conversion actions',
  'first_party:claimed_underutilized_profile': 'the claimed Local Pros profile appears underused',
  'first_party:restaurant_missing_web_menu': 'no web menu is currently on file',
}

const titleCase = (value: unknown) => String(value ?? '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const text = (value: unknown) => String(value ?? '').trim()
const localDateTime = (value?: string | null) => {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}
const nextWeek = () => localDateTime(new Date(Date.now() + 7 * 86400000).toISOString())
const formatDate = (value: unknown) => {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

async function post(payload: Record<string, unknown>) {
  const response = await fetch('/api/admin/prospect-research', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(body.error || 'Request failed'))
  return body
}

function salesDrafts(row: Row) {
  const service = serviceLabels[String(row.primary_service_slug || '')] || serviceLabels[String((row.recommended_service_slugs || [])[0] || '')] || 'digital marketing'
  const evidence = (row.evidence_flags || []).map((flag: string) => signalLabels[flag]).filter(Boolean)
  const factualSignal = evidence[0] || 'there may be an opportunity to strengthen your online presence'
  const contactName = text(row.owner_contact_name)
  const greeting = contactName ? `Hi ${contactName},` : `Hi ${row.business_name || 'there'},`
  const email = `Subject: Quick idea for ${row.business_name || 'your business'}\n\n${greeting}\n\nI’m Ray with Skylight Reflections Marketing. While reviewing ${row.business_name || 'your business'} for our Central Illinois Local Pros research, I noticed ${factualSignal}.\n\nWe help local businesses with ${service}. If it would be useful, I can show you what I found and walk through a practical improvement plan.\n\nThis is separate from Local Pros organic ranking, verification, or Sponsored placement.\n\nRay\nSkylight Reflections Marketing`
  const call = `Hi, this is Ray with Skylight Reflections Marketing. I was reviewing ${row.business_name || 'your business'} and noticed ${factualSignal}. We help local businesses with ${service}, and I wanted to see whether you’d be open to a quick conversation about what I found. This is separate from Local Pros organic ranking, verification, or Sponsored placement.`
  return { email, call }
}

export function ProspectResearchWorkbench({ rows }: Props) {
  const [q, setQ] = useState('')
  const [priority, setPriority] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')

  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = `${row.business_name || ''} ${row.city || ''} ${row.category || ''} ${row.owner_contact_name || ''} ${row.owner_contact_title || ''} ${(row.recommended_service_slugs || []).join(' ')} ${(row.evidence_flags || []).join(' ')}`.toLowerCase()
    return (!q || haystack.includes(q.toLowerCase())) && (!priority || String(row.sales_priority || row.priority) === priority)
  }), [rows, q, priority])

  async function refresh() {
    setBusy('refresh')
    setMessage('')
    try {
      await post({ action: 'refresh_queue' })
      setMessage('Research queue refreshed. Priorities and contact-readiness were reconciled; no outreach was sent.')
      location.reload()
    } catch (error: any) {
      setMessage(String(error?.message || 'Unable to refresh research queue.'))
    } finally {
      setBusy('')
    }
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    {message ? <div className="notice">{message}</div> : null}
    <section className="admin-card">
      <div className="section-head compact-head">
        <div>
          <div className="kpi">Sales Research 3.3</div>
          <h2>High-value prospect research queue</h2>
          <p className="muted">Hot and High opportunities should be worked first. Contact Ready is granted only after a staff member records a sourced owner/decision-maker email or phone, source URL and checked timestamp.</p>
        </div>
        <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={refresh}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh Research Queue'}</button>
      </div>
      <div className="grid grid-3" style={{ alignItems: 'end' }}>
        <label className="field"><span>Search Current View</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Business, city, service, signal…" /></label>
        <label className="field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option><option value="hot">Hot</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <div className="small muted">Showing {filtered.length} of {rows.length} records loaded in this view.</div>
      </div>
    </section>

    <div style={{ display: 'grid', gap: 14 }}>
      {filtered.map((row) => <ResearchCard key={row.id} row={row} />)}
      {!filtered.length ? <div className="notice">No prospect research records match this view.</div> : null}
    </div>
  </div>
}

function ResearchCard({ row }: { row: Row }) {
  const [contactName, setContactName] = useState(text(row.owner_contact_name))
  const [contactTitle, setContactTitle] = useState(text(row.owner_contact_title))
  const [contactEmail, setContactEmail] = useState(text(row.owner_contact_email))
  const [contactPhone, setContactPhone] = useState(text(row.owner_contact_phone))
  const [sourceUrl, setSourceUrl] = useState(text(row.owner_contact_source_url))
  const [checkedAt, setCheckedAt] = useState(localDateTime(row.owner_contact_checked_at))
  const [verifyNotes, setVerifyNotes] = useState('')
  const [attemptSource, setAttemptSource] = useState('')
  const [attemptNotes, setAttemptNotes] = useState('')
  const [nextReview, setNextReview] = useState(nextWeek())
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const [showAttempt, setShowAttempt] = useState(false)
  const [showDrafts, setShowDrafts] = useState(false)
  const ready = String(row.sales_stage || '') === 'contact_ready' && Boolean((text(row.owner_contact_email) || text(row.owner_contact_phone)) && text(row.owner_contact_source_url) && row.owner_contact_checked_at)
  const potentialContact = Boolean(contactEmail || contactPhone)
  const drafts = salesDrafts(row)

  async function verify() {
    if (!contactEmail && !contactPhone) return setMessage('Add the sourced owner/decision-maker email or phone before marking Contact Ready.')
    if (!/^https?:\/\//i.test(sourceUrl)) return setMessage('Add the public source URL that supports the owner/decision-maker association.')
    setBusy('verify')
    setMessage('')
    try {
      await post({
        action: 'verify_contact', prospect_id: row.id, contact_name: contactName, contact_title: contactTitle,
        contact_email: contactEmail, contact_phone: contactPhone, source_url: sourceUrl, checked_at: checkedAt, notes: verifyNotes,
      })
      setMessage('Verified. The private sales opportunity is Contact Ready and the research task is complete. Nothing was sent automatically.')
      location.reload()
    } catch (error: any) {
      setMessage(String(error?.message || 'Unable to verify contact.'))
    } finally {
      setBusy('')
    }
  }

  async function recordAttempt() {
    if (!/^https?:\/\//i.test(attemptSource)) return setMessage('Add the public source URL you reviewed before recording the research attempt.')
    setBusy('attempt')
    setMessage('')
    try {
      await post({ action: 'record_attempt', prospect_id: row.id, research_source_url: attemptSource, notes: attemptNotes, next_review_at: nextReview })
      setMessage('Research attempt saved. No contact data was fabricated; the prospect remains in Research and the next review is scheduled.')
      location.reload()
    } catch (error: any) {
      setMessage(String(error?.message || 'Unable to save research attempt.'))
    } finally {
      setBusy('')
    }
  }

  async function copyDraft(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setMessage(`${label} copied. Review it before use; nothing is sent automatically.`)
    } catch {
      setMessage('Copy failed. Select the draft manually.')
    }
  }

  return <section className="admin-card">
    <div className="section-head compact-head">
      <div>
        <div className="kpi">{titleCase(row.sales_priority || row.priority)} · score {Number(row.sales_score || row.opportunity_score || 0)}</div>
        <h3>{row.business_name}</h3>
        <p className="small muted">{[row.city, row.category].filter(Boolean).join(' · ') || 'Market/category not recorded'}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span className={`badge ${ready ? 'verified' : 'neutral'}`}>{ready ? 'Contact Ready' : titleCase(row.sales_stage || 'research')}</span>
        {row.task_status ? <span className="badge">Research Task: {titleCase(row.task_status)}</span> : null}
      </div>
    </div>

    <div className="notice" style={{ marginBottom: 12 }}><strong>Listing research aids only:</strong> {row.website ? <a href={row.website} target="_blank" rel="noreferrer">Business website</a> : 'No website on file'}{row.phone ? ` · Main listing phone ${row.phone}` : ''}. These fields do not become owner-contact evidence unless a public source supports the decision-maker association.</div>

    <div className="grid grid-3">
      <div><div className="kpi">Recommended Services</div><p className="small">{(row.recommended_service_slugs || []).length ? (row.recommended_service_slugs || []).map((slug: string) => serviceLabels[slug] || titleCase(slug)).join(' · ') : 'No mapped service recommendation'}</p></div>
      <div><div className="kpi">Evidence Signals</div><p className="small">{(row.evidence_flags || []).length ? (row.evidence_flags || []).map((flag: string) => signalLabels[flag] || titleCase(flag)).join(' · ') : 'No signal detail loaded'}</p></div>
      <div><div className="kpi">Research Task</div><p className="small">{row.task_due_at ? `Due ${formatDate(row.task_due_at)}` : 'No active due date'}{row.task_notes ? ` · ${row.task_notes}` : ''}</p></div>
    </div>

    {row.recent_research_summary ? <div className="small muted" style={{ marginTop: 8 }}><strong>Latest research activity:</strong> {row.recent_research_summary} · {formatDate(row.recent_research_at)}</div> : null}

    <div className="grid grid-3" style={{ marginTop: 14 }}>
      <label className="field"><span>Owner / Decision Maker</span><input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Name from public source" /></label>
      <label className="field"><span>Title / Role</span><input value={contactTitle} onChange={(event) => setContactTitle(event.target.value)} placeholder="Owner, founder, manager…" /></label>
      <label className="field"><span>Email</span><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="Sourced decision-maker email" /></label>
      <label className="field"><span>Phone</span><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Sourced decision-maker phone" /></label>
      <label className="field"><span>Provenance Source URL</span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://public-source.example/…" /></label>
      <label className="field"><span>Source Checked At</span><input type="datetime-local" value={checkedAt} onChange={(event) => setCheckedAt(event.target.value)} /></label>
    </div>
    <label className="field" style={{ marginTop: 10 }}><span>Verification Note (private)</span><textarea value={verifyNotes} onChange={(event) => setVerifyNotes(event.target.value)} rows={2} placeholder="Why this source supports the contact association…" /></label>

    {message ? <div className="notice" style={{ marginTop: 10 }}>{message}</div> : null}

    <div className="admin-row-actions" style={{ marginTop: 10 }}>
      <button type="button" className="btn btn-primary" disabled={Boolean(busy) || ready} onClick={verify}>{busy === 'verify' ? 'Verifying…' : ready ? 'Contact Ready' : potentialContact ? 'Verify Provenance & Mark Ready' : 'Verify Contact & Mark Ready'}</button>
      {!ready ? <button type="button" className="btn btn-light" onClick={() => setShowAttempt((value) => !value)}>{showAttempt ? 'Hide Research Attempt' : 'No Verified Contact Found'}</button> : null}
      {ready ? <button type="button" className="btn btn-light" onClick={() => setShowDrafts((value) => !value)}>{showDrafts ? 'Hide Outreach Drafts' : 'Prepare Human-Reviewed Outreach'}</button> : null}
      {row.business_id ? <a className="btn btn-light" href={`/admin/businesses/${row.business_id}?tab=growth`}>Open Listing</a> : null}
      <a className="btn btn-light" href={`/admin/prospects?open=${row.id}`}>Open Full CRM</a>
    </div>

    {showAttempt ? <div className="admin-card" style={{ marginTop: 12 }}>
      <div className="kpi">Record a real research attempt</div>
      <p className="small muted">Use this when you reviewed a legitimate public source but could not verify an owner/decision-maker contact. No owner-contact fields are filled automatically.</p>
      <div className="grid grid-3">
        <label className="field"><span>Source Reviewed</span><input type="url" value={attemptSource} onChange={(event) => setAttemptSource(event.target.value)} placeholder="https://source-you-reviewed.example/…" /></label>
        <label className="field"><span>Next Review</span><input type="datetime-local" value={nextReview} onChange={(event) => setNextReview(event.target.value)} /></label>
        <label className="field"><span>Research Notes</span><input value={attemptNotes} onChange={(event) => setAttemptNotes(event.target.value)} placeholder="What you checked / why no contact was verified" /></label>
      </div>
      <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={recordAttempt}>{busy === 'attempt' ? 'Saving…' : 'Save Research Attempt'}</button>
    </div> : null}

    {showDrafts ? <div className="admin-card" style={{ marginTop: 12 }}>
      <div className="kpi">Human-Approved Outreach Preparation</div>
      <p className="small muted">These drafts use the private evidence currently attached to this opportunity. Review every claim before use. Copying does not send anything.</p>
      <label className="field"><span>Call Opener</span><textarea readOnly value={drafts.call} rows={5} /></label>
      <button type="button" className="btn btn-light" onClick={() => copyDraft(drafts.call, 'Call opener')}>Copy Call Opener</button>
      <label className="field" style={{ marginTop: 10 }}><span>Email Draft</span><textarea readOnly value={drafts.email} rows={10} /></label>
      <button type="button" className="btn btn-light" onClick={() => copyDraft(drafts.email, 'Email draft')}>Copy Email Draft</button>
    </div> : null}
  </section>
}
