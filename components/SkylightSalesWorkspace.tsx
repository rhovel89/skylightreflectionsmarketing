'use client'

import { useMemo, useState } from 'react'

type Row = Record<string, any>

type Props = {
  opportunities: Row[]
  campaigns: Row[]
  recruitmentRows: Row[]
  activationRows: Row[]
}

const labels: Record<string, string> = {
  'web-design': 'Web Design',
  seo: 'SEO',
  'google-business-profile-optimization': 'Google Business Profile',
  'social-media-management': 'Social Media Management',
  'social-media-marketing': 'Social Media Marketing',
  branding: 'Branding',
  'graphic-design': 'Graphic Design',
  'lead-generation': 'Lead Generation',
}

const titleCase = (value: unknown) => String(value ?? '')
  .replaceAll('_', ' ')
  .replaceAll('-', ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase())

const relation = (value: any) => Array.isArray(value) ? value[0] ?? null : value ?? null
const yes = (value: any) => value === true || value === 'true'
const number = (value: any) => Number(value || 0).toLocaleString('en-US')
const stamp = (value: any) => {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

async function post(payload: any) {
  const response = await fetch('/api/admin/skylight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(body.error || 'Request failed'))
  return body
}

function recruitmentCopy(row: Row) {
  const facts = row.source_facts ?? {}
  const business = relation(row.business) ?? {}
  const prospect = relation(row.prospect) ?? {}
  const businessName = String(business.name || prospect.business_name || 'your business')
  const service = String(facts.service || 'your service')
  const city = String(facts.city || 'your market')
  const demand = Number(facts.demand_90 || 0)
  const verifiedOwner = yes(facts.verified_owner_contact)
  const contactName = verifiedOwner && prospect.owner_contact_name ? String(prospect.owner_contact_name) : ''
  const greeting = contactName ? `Hi ${contactName},` : `Hi ${businessName} team,`
  const coverageSentence = facts.coverage_source === 'service_area'
    ? `${businessName} is listed as serving ${city}. That service area is not being represented as a physical office.`
    : `${businessName} has an active business location in ${city}.`
  const requestWord = demand === 1 ? 'request' : 'requests'

  const call = `Hi, this is Ray with Skylight Reflections Marketing and Central Illinois Local Pros. Our directory recorded ${demand} consumer ${requestWord} for ${service} in ${city} during the last 90 days. ${coverageSentence} I wanted to see whether receiving Admin-reviewed leads when they are available might be worth discussing. Historical demand is not a guarantee of future lead volume, and nothing is enrolled, routed or billed without a separate explicit agreement.`

  const email = `Subject: Local Pros lead opportunity in ${city}\n\n${greeting}\n\nCentral Illinois Local Pros recorded ${demand} consumer ${requestWord} for ${service} in ${city} during the last 90 days. ${coverageSentence}\n\nI’m reaching out to see whether you would be open to discussing receiving Admin-reviewed leads when they are available. The recent request count is historical demand only and is not a guarantee of future lead volume. Nothing is activated, routed or billed unless you separately choose to participate and the lead agreement is explicitly reviewed and activated.\n\nIf you’re interested, we can go over the service area, lead types, pricing, monthly limits and whether shared or exclusive delivery would make sense before anything is turned on.\n\nRay\nSkylight Reflections Marketing / Central Illinois Local Pros`

  return { call, email }
}

export function SkylightSalesWorkspace({ opportunities, campaigns, recruitmentRows, activationRows }: Props) {
  const [q, setQ] = useState('')
  const [service, setService] = useState('')
  const [stage, setStage] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  const filtered = useMemo(() => opportunities.filter((opportunity) => {
    const prospect = relation(opportunity.prospect) ?? {}
    const haystack = `${prospect.business_name || ''} ${prospect.city || ''} ${(opportunity.recommended_service_slugs || []).join(' ')} ${(opportunity.evidence_flags || []).join(' ')}`.toLowerCase()
    return (!q || haystack.includes(q.toLowerCase()))
      && (!service || (opportunity.recommended_service_slugs || []).includes(service))
      && (!stage || opportunity.stage === stage)
  }), [opportunities, q, service, stage])

  const recruitmentContactReady = recruitmentRows.filter((row) => yes(row.source_facts?.contact_path_available)).length
  const recruitmentResearchNeeded = recruitmentRows.length - recruitmentContactReady

  async function action(payload: any, key = 'action') {
    setBusy(key)
    setMsg('')
    try {
      const body = await post(payload)
      if (payload.action === 'create_invoice_from_opportunity' && body.public_url) {
        setMsg(`Draft invoice ${body.data?.invoice_number || ''} created. Open Clients & Invoices to finish pricing and send it.`)
      } else if (payload.action === 'refresh_opportunities') {
        setMsg('Sales and Lead Buyer recruitment intelligence refreshed.')
      } else {
        setMsg('Saved.')
      }
      location.reload()
    } catch (error: any) {
      setMsg(String(error?.message || 'Request failed'))
    } finally {
      setBusy('')
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMsg(`${label} copied. Review it before using it; nothing is sent automatically.`)
    } catch {
      setMsg('Copy failed. Select the draft text manually.')
    }
  }

  return <div style={{ display: 'grid', gap: 18 }}>
    {msg ? <div className="notice">{msg}</div> : null}

    <div className="stat-grid">
      <div className="stat">Active Skylight Opportunities<strong>{opportunities.length}</strong></div>
      <div className="stat">Hot / High<strong>{opportunities.filter((row) => ['hot', 'high'].includes(String(row.priority))).length}</strong></div>
      <div className="stat">Skylight Contact Ready<strong>{opportunities.filter((row) => ['contact_ready', 'contacted', 'qualified', 'proposal'].includes(String(row.stage))).length}</strong></div>
      <div className="stat">Lead Buyer Recruitment<strong>{recruitmentRows.length}</strong><small>historical-demand candidates</small></div>
      <div className="stat">Buyer Contact Ready<strong>{recruitmentContactReady}</strong></div>
      <div className="stat">Buyer Research Needed<strong>{recruitmentResearchNeeded}</strong></div>
      <div className="stat">Explicit Buyer Interest<strong>{activationRows.length}</strong><small>separate controlled activation flow</small></div>
    </div>

    <section className="admin-card">
      <div className="section-head">
        <div>
          <div className="kpi">Campaign Engine</div>
          <h2>Evidence-backed sales campaigns</h2>
          <p className="muted">Campaign membership is generated from first-party opportunity signals and current Lead Buyer demand coverage. Nothing is emailed, texted, enrolled or billed automatically.</p>
        </div>
        <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => action({ action: 'refresh_opportunities' }, 'refresh')}>
          {busy === 'refresh' ? 'Refreshing…' : 'Refresh Sales Intelligence'}
        </button>
      </div>
      <div className="grid grid-3">
        {campaigns.map((campaign) => <div className="card" key={campaign.id}>
          <div className="kpi">{titleCase(campaign.campaign_type)}</div>
          <h3>{campaign.name}</h3>
          <p className="muted small">{campaign.description}</p>
          <strong>{number(campaign.member_count)} current prospects</strong>
          <div className="small muted">{number(campaign.ready_count)} contact-ready / contacted / qualified</div>
        </div>)}
      </div>
    </section>

    <section className="admin-card">
      <div className="section-head">
        <div>
          <div className="kpi">Sales Command Center 3.1</div>
          <h2>What should Skylight sell next?</h2>
          <p className="muted">Filter the first-party marketing opportunity pool by business, market, service recommendation or sales stage.</p>
        </div>
      </div>
      <div className="grid grid-3" style={{ marginBottom: 14 }}>
        <label className="field"><span>Search</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Business, city, signal…" /></label>
        <label className="field"><span>Recommended Service</span><select value={service} onChange={(event) => setService(event.target.value)}><option value="">All services</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Stage</span><select value={stage} onChange={(event) => setStage(event.target.value)}><option value="">All stages</option>{['new', 'research', 'contact_ready', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'nurture'].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
      </div>
      <div className="admin-list-meta"><span className="kpi">Showing {filtered.length} opportunities</span><span className="small muted">Score is private sales priority only.</span></div>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {filtered.slice(0, 250).map((opportunity) => {
          const prospect = relation(opportunity.prospect) ?? {}
          return <div className="card" key={opportunity.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div className="kpi">Score {opportunity.score} · {opportunity.priority}</div>
                <h3>{prospect.business_name || 'Business Opportunity'}</h3>
                <div className="small muted">{[prospect.city, prospect.category].filter(Boolean).join(' · ')}</div>
                {prospect.owner_contact_name ? <div className="small">Contact: {prospect.owner_contact_name}{prospect.owner_contact_title ? ` · ${prospect.owner_contact_title}` : ''}</div> : null}
                {prospect.owner_contact_email ? <div className="small">{prospect.owner_contact_email}</div> : null}
                {prospect.owner_contact_phone ? <div className="small">{prospect.owner_contact_phone}</div> : null}
              </div>
              <span className="badge verified">{titleCase(opportunity.stage)}</span>
            </div>
            <div style={{ marginTop: 10 }}><strong>Recommended:</strong> {(opportunity.recommended_service_slugs || []).map((value: string) => <span key={value} className="badge" style={{ marginLeft: 5 }}>{labels[value] || value}</span>)}</div>
            <div className="small muted" style={{ marginTop: 8 }}><strong>Evidence:</strong> {(opportunity.evidence_flags || []).join(' · ')}</div>
            <div className="grid grid-3" style={{ alignItems: 'end', marginTop: 12 }}>
              <label className="field"><span>Sales Stage</span><select defaultValue={opportunity.stage} onChange={(event) => action({ action: 'update_opportunity', id: opportunity.id, stage: event.target.value }, String(opportunity.id))}>{['new', 'research', 'contact_ready', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'nurture'].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
              <label className="field"><span>Estimated Project Value ($)</span><input type="number" step="0.01" min="0" defaultValue={opportunity.estimated_value_cents ? Number(opportunity.estimated_value_cents) / 100 : ''} onBlur={(event) => { if (event.target.value) void action({ action: 'update_opportunity', id: opportunity.id, estimated_value: event.target.value }, String(opportunity.id)) }} /></label>
              <label className="field"><span>Next Follow-Up</span><input type="datetime-local" defaultValue={opportunity.next_follow_up_at ? String(opportunity.next_follow_up_at).slice(0, 16) : ''} onBlur={(event) => void action({ action: 'update_opportunity', id: opportunity.id, next_follow_up_at: event.target.value }, String(opportunity.id))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="button" disabled={Boolean(busy)} onClick={() => action({ action: 'create_invoice_from_opportunity', opportunity_id: opportunity.id }, `invoice-${opportunity.id}`)}>Create Draft Invoice</button>
              {opportunity.business_id ? <a className="btn btn-light" href={`/admin/businesses/${opportunity.business_id}?tab=growth`}>Open Listing</a> : null}
              {opportunity.prospect_id ? <a className="btn btn-light" href={`/admin/prospects?open=${opportunity.prospect_id}`}>Open Prospect CRM</a> : null}
            </div>
          </div>
        })}
        {!filtered.length ? <div className="notice">No Skylight service opportunities match the current filters.</div> : null}
      </div>
    </section>

    <section className="admin-card" id="lead-buyer-recruitment">
      <div className="section-head">
        <div>
          <div className="kpi">Lead Buyer Recruitment Engine</div>
          <h2>Recruit relevant businesses where Local Pros has real demand</h2>
          <p className="muted">Candidates require at least two consumer requests for the same service and market in the last 90 days plus matching published provider coverage. Historical demand is not guaranteed future volume. A service area remains a service area—not an office.</p>
        </div>
        <a className="btn btn-primary" href="/admin/lead-buyers">Open Lead Buyer CRM</a>
      </div>

      <div className="notice" style={{ marginBottom: 14 }}><strong>Controlled recruitment only:</strong> this queue cannot send outreach, release consumer contact details, activate an agreement, deliver a lead, create a charge, verify a business, create Sponsored placement or change organic ranking. Owner interest remains separate from billing authorization.</div>

      {activationRows.length ? <div style={{ marginBottom: 16 }}>
        <div className="kpi">Explicit Interest Takes Priority</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {activationRows.slice(0, 10).map((row) => <div className="info-row" key={row.id}>
            <span><strong>{row.title}</strong><small className="muted" style={{ display: 'block' }}>{row.next_action || row.detail}</small></span>
            <span><span className="badge sponsored">Score {row.score}</span></span>
          </div>)}
        </div>
      </div> : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {recruitmentRows.slice(0, 100).map((row) => {
          const facts = row.source_facts ?? {}
          const business = relation(row.business) ?? {}
          const prospect = relation(row.prospect) ?? {}
          const member = row.campaign_member ?? {}
          const draft = recruitmentCopy(row)
          const contactReady = yes(facts.contact_path_available)
          const ownerVerified = yes(facts.verified_owner_contact)
          const serviceArea = facts.coverage_source === 'service_area'
          return <article className="card" key={row.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div className="kpi">{number(facts.demand_90)} requests · last 90 days · score {row.score}</div>
                <h3>{business.name || prospect.business_name || row.title}</h3>
                <div className="small muted">{facts.service || 'Service'} · {facts.city || 'Market'} · {serviceArea ? 'Service-area coverage' : 'Physical business location'}</div>
              </div>
              <div className="admin-row-actions">
                <span className={`badge ${contactReady ? 'verified' : 'neutral'}`}>{contactReady ? ownerVerified ? 'Verified owner contact' : 'Business contact available' : 'Research needed'}</span>
                {member.status ? <span className="badge neutral">Campaign: {titleCase(member.status)}</span> : null}
              </div>
            </div>

            <p className="small" style={{ marginTop: 10 }}>{row.detail}</p>
            <div className="small muted"><strong>Next action:</strong> {row.next_action || 'Review the factual demand and contact path before outreach.'}{row.due_at ? ` · Due ${stamp(row.due_at)}` : ''}</div>

            {ownerVerified && prospect.owner_contact_name ? <div className="small" style={{ marginTop: 8 }}><strong>Sourced decision-maker:</strong> {prospect.owner_contact_name}{prospect.owner_contact_title ? ` · ${prospect.owner_contact_title}` : ''}</div> : null}
            {ownerVerified && prospect.owner_contact_email ? <div className="small">{prospect.owner_contact_email}</div> : null}
            {ownerVerified && prospect.owner_contact_phone ? <div className="small">{prospect.owner_contact_phone}</div> : null}
            {!ownerVerified && contactReady ? <div className="small muted" style={{ marginTop: 8 }}>A general business contact path is available. Do not present it as verified owner/decision-maker contact unless provenance is separately documented.</div> : null}

            <details style={{ marginTop: 12 }}>
              <summary><strong>Human-reviewed outreach drafts</strong> · nothing sends automatically</summary>
              <div className="grid grid-2" style={{ marginTop: 10 }}>
                <div className="card">
                  <div className="kpi">Call Opener</div>
                  <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{draft.call}</p>
                  <button className="btn btn-light" type="button" onClick={() => copyText(draft.call, 'Call opener')}>Copy Call Opener</button>
                </div>
                <div className="card">
                  <div className="kpi">Email Draft</div>
                  <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{draft.email}</p>
                  <button className="btn btn-light" type="button" onClick={() => copyText(draft.email, 'Email draft')}>Copy Email Draft</button>
                </div>
              </div>
            </details>

            <div className="admin-row-actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
              {row.business_id ? <a className="btn btn-light" href={`/admin/businesses/${row.business_id}?tab=growth`}>Open Business</a> : null}
              {row.prospect_id ? <a className="btn btn-light" href={`/admin/prospects?open=${row.prospect_id}`}>Open Contact Research</a> : null}
              <a className="btn btn-primary" href="/admin/lead-buyers">Lead Buyer CRM / Agreement Flow</a>
            </div>
          </article>
        })}
        {!recruitmentRows.length ? <div className="notice"><strong>No business currently meets the recruitment threshold.</strong> The engine is active and refreshes from real consumer demand. A candidate will appear only after at least two matching service/market requests exist within 90 days and a legitimate published provider matches that market.</div> : null}
      </div>
    </section>
  </div>
}
