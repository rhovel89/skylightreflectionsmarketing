import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { requireAdmin } from '@/lib/auth'
import { SkylightSalesWorkspace } from '@/components/SkylightSalesWorkspace'

export const dynamic = 'force-dynamic'
type Row = Record<string, any>

export default async function Page() {
  await requireAdmin('/admin/skylight-sales')
  const s = await createClient()
  const campaignsResult = await s.from('skylight_sales_campaigns').select('*').eq('tenant_id', TENANT_ID).order('name')
  const campaigns = (campaignsResult.data ?? []) as Row[]
  const campaignIds = campaigns.map((row) => String(row.id))
  const [opportunitiesResult, membersResult, recruitmentResult, activationResult] = await Promise.all([
    s.from('skylight_sales_opportunities').select('*,prospect:business_prospects(id,business_name,category,city,owner_contact_name,owner_contact_title,owner_contact_email,owner_contact_phone,owner_contact_source_url,owner_contact_checked_at)').eq('tenant_id', TENANT_ID).eq('active', true).order('score', { ascending: false }).limit(1000),
    campaignIds.length?s.from('skylight_sales_campaign_members').select('id,campaign_id,opportunity_id,growth_opportunity_id,prospect_id,business_id,status,priority,assigned_user_id,last_action_at,next_action_at,notes,updated_at').in('campaign_id', campaignIds).limit(10000):Promise.resolve({ data: [], error: null } as any),
    s.from('growth_opportunities').select('id,business_id,prospect_id,title,detail,score,status,next_action,due_at,assigned_user_id,source_facts,updated_at,business:businesses(id,name,slug,email,phone,claimed,verified),prospect:business_prospects(id,business_name,owner_contact_name,owner_contact_title,owner_contact_email,owner_contact_phone,owner_contact_source_url,owner_contact_checked_at)').eq('tenant_id', TENANT_ID).eq('opportunity_type', 'lead_buyer_recruitment').in('status', ['open', 'in_progress', 'snoozed']).order('score', { ascending: false }).limit(500),
    s.from('growth_opportunities').select('id,business_id,title,detail,score,next_action,opportunity_type,status,due_at,source_facts').eq('tenant_id', TENANT_ID).eq('opportunity_type', 'lead_buyer_activation').in('status', ['open', 'in_progress', 'snoozed']).order('score', { ascending: false }).limit(100),
  ])
  const opportunities = (opportunitiesResult.data ?? []) as Row[]
  const members = (membersResult.data ?? []) as Row[]
  const recruitment = (recruitmentResult.data ?? []) as Row[]
  const activations = (activationResult.data ?? []) as Row[]
  const activeSalesOpportunityIds = new Set(opportunities.map((row) => String(row.id)))
  const activeRecruitmentIds = new Set(recruitment.map((row) => String(row.id)))
  const activeMembers = members.filter((row) => row.opportunity_id ? activeSalesOpportunityIds.has(String(row.opportunity_id)) : row.growth_opportunity_id ? activeRecruitmentIds.has(String(row.growth_opportunity_id)) : false)
  const campaignCounts = new Map<string, { all: number; ready: number }>()
  for (const member of activeMembers) {const key = String(member.campaign_id),value = campaignCounts.get(key) ?? { all: 0, ready: 0 };value.all += 1;if (['ready', 'contacted', 'replied', 'qualified', 'won'].includes(String(member.status))) value.ready += 1;campaignCounts.set(key, value)}
  const campaignRows = campaigns.map((campaign) => ({...campaign,member_count: campaignCounts.get(String(campaign.id))?.all ?? 0,ready_count: campaignCounts.get(String(campaign.id))?.ready ?? 0}))
  const memberByGrowthId = new Map(members.filter((row) => row.growth_opportunity_id).map((row) => [String(row.growth_opportunity_id), row]))
  const recruitmentRows = recruitment.map((row) => ({...row,campaign_member: memberByGrowthId.get(String(row.id)) ?? null}))
  const sourceErrors = [campaignsResult.error,opportunitiesResult.error,membersResult.error,recruitmentResult.error,activationResult.error].filter(Boolean)
  const stageCount=(stage:string)=>opportunities.filter(row=>String(row.stage||'')===stage).length
  const contactReady=stageCount('contact_ready')
  const researchNeeded=stageCount('research')
  const qualified=opportunities.filter(row=>['qualified','proposal'].includes(String(row.stage||''))).length

  return <>
    <div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing · Private Sales Engine</div><h1>Sales Command Center 3.8</h1><p className="muted">Use this page for the big picture. The workspace bar and Owner Guide now keep daily work, research, inbox, outreach, acquisition and conversions in one clear flow.</p></div><span className="badge verified">Human-Controlled</span></div>
    {sourceErrors.length ? <div className="notice warn"><strong>Some sales intelligence is temporarily incomplete.</strong> Refresh after the underlying data source is available.</div> : null}
    <div className="admin-focus-strip" aria-label="Sales owner snapshot">
      <Link className={`admin-focus-card ${contactReady ? 'good' : ''}`} href="/admin/skylight-sales/daily"><span>Contact Ready</span><strong>{contactReady}</strong><small>Real opportunities ready for the next human-controlled action.</small></Link>
      <Link className={`admin-focus-card ${researchNeeded ? 'attention' : ''}`} href="/admin/acquisition-research"><span>Needs Research</span><strong>{researchNeeded}</strong><small>Prospects that still need stronger contact or source evidence.</small></Link>
      <Link className="admin-focus-card" href="/admin/skylight-sales/conversions"><span>Qualified / Proposal</span><strong>{qualified}</strong><small>Opportunities far enough along to watch conversion progress.</small></Link>
      <Link className="admin-focus-card" href="/admin/skylight-sales/acquisition"><span>Campaigns</span><strong>{campaignRows.length}</strong><small>Configured acquisition campaigns and their measured funnel activity.</small></Link>
    </div>
    <SkylightSalesWorkspace opportunities={opportunities} campaigns={campaignRows} recruitmentRows={recruitmentRows} activationRows={activations}/>
  </>
}
