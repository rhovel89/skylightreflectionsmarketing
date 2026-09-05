import { AdminLeadBuyerCRM } from '@/components/AdminLeadBuyerCRM'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'

type SearchValue = string | string[] | undefined
const one = (value: SearchValue) => Array.isArray(value) ? value[0] ?? '' : value ?? ''
const ms = (value: unknown) => value ? new Date(String(value)).getTime() : 0
const moneyState = (items: any[]) => {
  const open = items.filter((x) => ['sent', 'overdue'].includes(x.status))
  const overdue = open.some((x) => x.status === 'overdue')
  const owed = open.reduce((sum, x) => sum + Number(x.amount_due_cents || 0), 0)
  if (overdue) return { amountOwed: owed, paymentStatus: 'Overdue' }
  if (open.length) return { amountOwed: owed, paymentStatus: 'Open' }
  if (items.some((x) => x.status === 'paid')) return { amountOwed: 0, paymentStatus: 'Paid / Current' }
  return { amountOwed: 0, paymentStatus: 'Not billed' }
}
const monthlyValue = (terms: any) => {
  const cap = Number(terms?.max_leads_per_month || terms?.target_monthly_cap || 0)
  if (!cap) return 0
  const model = terms?.billing_model || terms?.target_billing_model
  if (model === 'pay_per_lead') return Math.max(0, Number(terms?.per_lead_price_cents || terms?.target_price_cents || 0)) * cap
  const count = Number(terms?.bundle_lead_count || 0), price = Number(terms?.bundle_price_cents || 0)
  return count > 0 && price > 0 ? Math.round((cap / count) * price) : 0
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, SearchValue>> }) {
  const sp = await searchParams
  const { roles } = await requireAdmin('/admin/lead-buyers')
  const isSuperAdmin = roles.includes('super_admin')
  const s = await createClient()
  const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0)
  const monthIso = month.toISOString(), now = Date.now(), ninetyIso = new Date(now - 90 * 86400000).toISOString()
  const [
    { data: businesses }, { data: profiles }, { data: categoryPrefs }, { data: areaPrefs }, { data: drafts },
    { data: programs }, { data: recipients }, { data: charges }, { data: invoices }, { data: categories }, { data: locations },
  ] = await Promise.all([
    s.from('businesses').select('id,name,slug,claimed,phone,email').eq('tenant_id', TENANT_ID).eq('status', 'published').order('name').limit(1500),
    s.from('lead_buyer_crm_profiles').select('*').eq('tenant_id', TENANT_ID),
    s.from('lead_buyer_crm_categories').select('business_id,category_id').eq('tenant_id', TENANT_ID),
    s.from('lead_buyer_crm_service_areas').select('business_id,location_id').eq('tenant_id', TENANT_ID),
    s.from('lead_buyer_agreement_drafts').select('*').eq('tenant_id', TENANT_ID),
    s.from('business_lead_programs').select('*').eq('tenant_id', TENANT_ID),
    s.from('lead_recipients').select('id,business_id,lead_id,delivery_type,status,routed_at,viewed_at,lead_program_interest,interest_updated_at').eq('tenant_id', TENANT_ID).order('routed_at', { ascending: false }).limit(5000),
    s.from('lead_delivery_charges').select('business_id,billing_status,delivered_at').eq('tenant_id', TENANT_ID).gte('delivered_at', monthIso).limit(5000),
    s.from('lead_invoices').select('business_id,status,amount_due_cents,paid_at,created_at').eq('tenant_id', TENANT_ID).order('created_at', { ascending: false }).limit(5000),
    s.from('categories').select('id,name,vertical').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name').limit(1000),
    s.from('locations').select('id,name,county,state,type').eq('tenant_id', TENANT_ID).eq('is_active', true).order('name').limit(1500),
  ])

  const profileMap = new Map((profiles ?? []).map((x: any) => [x.business_id, x]))
  const draftMap = new Map((drafts ?? []).map((x: any) => [x.business_id, x]))
  const programMap = new Map((programs ?? []).map((x: any) => [x.business_id, x]))
  const catMap = new Map<string, string[]>(), areaMap = new Map<string, string[]>()
  for (const x of categoryPrefs ?? []) catMap.set((x as any).business_id, [...(catMap.get((x as any).business_id) ?? []), (x as any).category_id])
  for (const x of areaPrefs ?? []) areaMap.set((x as any).business_id, [...(areaMap.get((x as any).business_id) ?? []), (x as any).location_id])
  const recipientMap = new Map<string, any[]>(), invoiceMap = new Map<string, any[]>()
  for (const x of recipients ?? []) recipientMap.set((x as any).business_id, [...(recipientMap.get((x as any).business_id) ?? []), x])
  for (const x of invoices ?? []) invoiceMap.set((x as any).business_id, [...(invoiceMap.get((x as any).business_id) ?? []), x])
  const deliveredMonth = new Map<string, number>()
  for (const x of charges ?? []) if ((x as any).billing_status !== 'void') deliveredMonth.set((x as any).business_id, (deliveredMonth.get((x as any).business_id) ?? 0) + 1)

  const rows = (businesses ?? []).map((business: any) => {
    const crm = profileMap.get(business.id) ?? null, draft = draftMap.get(business.id) ?? null, program = programMap.get(business.id) ?? null
    const allRecipients = recipientMap.get(business.id) ?? [], intro = allRecipients.filter((x) => x.delivery_type === 'intro'), lastIntro = intro[0] ?? null
    const decisions = intro.filter((x) => x.lead_program_interest && x.lead_program_interest !== 'undecided').sort((a, b) => ms(b.interest_updated_at) - ms(a.interest_updated_at))
    const decision = decisions[0] ?? null, wantsMore = decision?.lead_program_interest ?? 'undecided'
    const reopenedAfterDecision = ms(crm?.reopened_at) > ms(decision?.interest_updated_at), lastContact = ms(crm?.last_contact_at), interestAt = ms(decision?.interest_updated_at)
    const contactedAfterInterest = Boolean(interestAt && lastContact >= interestAt)
    const eligibleForFollowup = wantsMore === 'interested' && program?.status !== 'active' && !['paused', 'declined'].includes(String(crm?.sales_status || 'open'))
    const slaDueMs = eligibleForFollowup ? (contactedAfterInterest ? ms(crm?.follow_up_at) : interestAt + 24 * 3600000) : 0
    const slaOverdue = Boolean(slaDueMs && slaDueMs <= now)
    const followUpNeeded = eligibleForFollowup && (!contactedAfterInterest || Boolean(ms(crm?.follow_up_at) && ms(crm.follow_up_at) <= now))
    const activeProgram = program?.status === 'active'
    let stage = 'No Intro Sent'
    if (activeProgram) stage = 'Pay-Per-Lead Active'
    else if (crm?.sales_status === 'paused' || program?.status === 'paused') stage = 'Paused'
    else if (crm?.sales_status === 'declined' || (wantsMore === 'not_interested' && !reopenedAfterDecision)) stage = 'Declined'
    else if (slaOverdue) stage = 'Follow-Up Overdue'
    else if (draft?.status === 'ready_for_review') stage = 'Agreement Ready'
    else if (draft?.status === 'draft') stage = 'Agreement Draft'
    else if (wantsMore === 'interested' && contactedAfterInterest) stage = 'Contacted'
    else if (wantsMore === 'interested') stage = 'Follow-Up Needed'
    else if (intro.some((x) => x.viewed_at)) stage = 'Viewed'
    else if (intro.length) stage = 'Intro Sent'
    const financial = moneyState(invoiceMap.get(business.id) ?? [])
    const paidRevenue90d = (invoiceMap.get(business.id) ?? []).filter((x) => x.status === 'paid' && ms(x.paid_at) >= ms(ninetyIso)).reduce((sum, x) => sum + Number(x.amount_due_cents || 0), 0)
    return {
      id: business.id, name: business.name, slug: business.slug, claimed: Boolean(business.claimed), phone: business.phone, email: business.email,
      stage, introSent: intro.length, lastIntroAt: lastIntro?.routed_at ?? null,
      lastViewedAt: intro.map((x) => x.viewed_at).filter(Boolean).sort((a, b) => ms(b) - ms(a))[0] ?? null,
      wantsMore, interestUpdatedAt: decision?.interest_updated_at ?? null, contactedAfterInterest, followUpNeeded, slaOverdue, slaDueAt: slaDueMs ? new Date(slaDueMs).toISOString() : null,
      lastLeadAt: allRecipients[0]?.routed_at ?? null, deliveredThisMonth: deliveredMonth.get(business.id) ?? 0,
      amountOwed: financial.amountOwed, paymentStatus: financial.paymentStatus, paidRevenue90d,
      targetMonthlyValue: draft ? monthlyValue(draft) : monthlyValue(crm), activeMonthlyValue: activeProgram ? monthlyValue(program) : 0,
      crm: crm ? { sales_status: crm.sales_status, target_price_cents: crm.target_price_cents, preferred_sale_mode: crm.preferred_sale_mode, target_monthly_cap: crm.target_monthly_cap, target_billing_model: crm.target_billing_model, follow_up_at: crm.follow_up_at, last_contact_at: crm.last_contact_at, internal_notes: crm.internal_notes } : null,
      draft: draft ? { id: draft.id, status: draft.status, featured_addon_enabled: draft.featured_addon_enabled, billing_model: draft.billing_model, per_lead_price_cents: draft.per_lead_price_cents, bundle_lead_count: draft.bundle_lead_count, bundle_price_cents: draft.bundle_price_cents, due_days: draft.due_days, billing_email: draft.billing_email, agreement_started_on: draft.agreement_started_on, agreement_ends_on: draft.agreement_ends_on, max_leads_per_month: draft.max_leads_per_month, lead_sale_mode: draft.lead_sale_mode, max_buyers_per_lead: draft.max_buyers_per_lead, consent_recorded_at: draft.consent_recorded_at, consent_source: draft.consent_source, consent_reference: draft.consent_reference, owner_summary: draft.owner_summary, internal_notes: draft.internal_notes, ready_for_review_at: draft.ready_for_review_at, activated_at: draft.activated_at, resulting_program_id: draft.resulting_program_id } : null,
      categoryIds: catMap.get(business.id) ?? [], locationIds: areaMap.get(business.id) ?? [],
      program: program ? { id: program.id, status: program.status, billing_model: program.billing_model, per_lead_price_cents: program.per_lead_price_cents, bundle_lead_count: program.bundle_lead_count, bundle_price_cents: program.bundle_price_cents, lead_sale_mode: program.lead_sale_mode, max_buyers_per_lead: program.max_buyers_per_lead, max_leads_per_month: program.max_leads_per_month, agreement_started_on: program.agreement_started_on, agreement_ends_on: program.agreement_ends_on, manual_delivery_hold: program.manual_delivery_hold, delivery_hold_reason: program.delivery_hold_reason } : null,
    }
  })
  const priority: Record<string, number> = { 'Follow-Up Overdue': 0, 'Agreement Ready': 1, 'Follow-Up Needed': 2, Contacted: 3, 'Agreement Draft': 4, 'Pay-Per-Lead Active': 5, Viewed: 6, 'Intro Sent': 7, 'No Intro Sent': 8, Paused: 9, Declined: 10 }
  rows.sort((a: any, b: any) => (priority[a.stage] ?? 99) - (priority[b.stage] ?? 99) || ms(b.interestUpdatedAt) - ms(a.interestUpdatedAt) || a.name.localeCompare(b.name))
  const portfolio = {
    introBusinesses: rows.filter((r: any) => r.introSent > 0).length,
    viewedBusinesses: rows.filter((r: any) => Boolean(r.lastViewedAt)).length,
    interestedBusinesses: rows.filter((r: any) => r.wantsMore === 'interested').length,
    contactedBusinesses: rows.filter((r: any) => r.contactedAfterInterest).length,
    agreementReady: rows.filter((r: any) => r.draft?.status === 'ready_for_review').length,
    activeBuyers: rows.filter((r: any) => r.program?.status === 'active').length,
    overdueFollowups: rows.filter((r: any) => r.slaOverdue).length,
    targetMonthlyCents: rows.reduce((sum: number, r: any) => sum + Number(r.activeMonthlyValue || r.targetMonthlyValue || 0), 0),
    collected90dCents: rows.reduce((sum: number, r: any) => sum + Number(r.paidRevenue90d || 0), 0),
  }

  return <>
    <div className="admin-page-head"><div><div className="kpi">Lead Buyer Revenue Intelligence</div><h1>Lead Buyer Conversion, SLA & Agreement Control</h1><p className="muted">Move explicit owner interest through Admin follow-up, documented terms and Super Admin activation while keeping Intro Leads free and all future paid lead delivery manual and agreement-controlled.</p></div><span className="badge sponsored">Admin-only revenue workflow</span></div>
    <AdminLeadBuyerCRM rows={rows as any} categories={(categories ?? []) as any[]} locations={(locations ?? []) as any[]} portfolio={portfolio} isSuperAdmin={isSuperAdmin} initialBusinessId={one(sp.business)} initialStage={one(sp.stage)} />
  </>
}
