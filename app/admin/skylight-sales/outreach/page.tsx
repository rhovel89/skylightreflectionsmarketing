import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { SalesOutreachWorkbench } from '@/components/SalesOutreachWorkbench'

export const dynamic='force-dynamic'
type Row=Record<string,any>

export default async function Page(){
  await requireStaff('/admin/skylight-sales/outreach')
  const s=await createClient()
  const weekAgo=new Date(Date.now()-7*86400000).toISOString()
  const [opportunitiesResult,templatesResult,draftsResult,eventsResult,followupsResult,suppressionsResult,campaignsResult,membersResult]=await Promise.all([
    s.from('skylight_sales_opportunities').select('id,prospect_id,business_id,primary_service_slug,recommended_service_slugs,evidence_flags,score,priority,stage,assigned_user_id,last_contact_at,next_follow_up_at,updated_at,prospect:business_prospects(id,business_name,vertical,category,city,status,owner_contact_name,owner_contact_title,owner_contact_email,owner_contact_phone,owner_contact_source_url,owner_contact_checked_at,last_contacted_at,next_follow_up_at)').eq('tenant_id',TENANT_ID).eq('active',true).order('score',{ascending:false}).limit(1500),
    s.from('skylight_sales_outreach_templates').select('*').eq('tenant_id',TENANT_ID).order('sort_order').limit(500),
    s.from('skylight_sales_outreach_drafts').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(1200),
    s.from('skylight_sales_outreach_events').select('*').eq('tenant_id',TENANT_ID).gte('created_at',weekAgo).order('created_at',{ascending:false}).limit(3000),
    s.from('skylight_sales_followups').select('*').eq('tenant_id',TENANT_ID).eq('status','open').order('due_at',{ascending:true}).limit(1500),
    s.from('skylight_sales_suppressions').select('*').eq('tenant_id',TENANT_ID).eq('active',true).order('created_at',{ascending:false}).limit(1500),
    s.from('skylight_sales_campaigns').select('id,name,slug,campaign_type,service_slug,description,status').eq('tenant_id',TENANT_ID).order('name'),
    s.from('skylight_sales_campaign_members').select('id,campaign_id,opportunity_id,prospect_id,status,priority,assigned_user_id,last_action_at,next_action_at').limit(10000),
  ])
  const opportunities=(opportunitiesResult.data??[]) as Row[],templates=(templatesResult.data??[]) as Row[],drafts=(draftsResult.data??[]) as Row[],events=(eventsResult.data??[]) as Row[],followups=(followupsResult.data??[]) as Row[],suppressions=(suppressionsResult.data??[]) as Row[],campaigns=(campaignsResult.data??[]) as Row[],members=(membersResult.data??[]) as Row[]
  const errors=[opportunitiesResult.error,templatesResult.error,draftsResult.error,eventsResult.error,followupsResult.error,suppressionsResult.error,campaignsResult.error,membersResult.error].filter(Boolean)
  const ready=opportunities.filter(o=>o.stage==='contact_ready').length,contacted=events.filter(e=>e.event_type==='sent'||e.event_type==='call_attempted'||e.event_type==='connected').length,replies=events.filter(e=>String(e.event_type).startsWith('reply_')).length,positive=events.filter(e=>['reply_positive','interested'].includes(String(e.event_type))).length,meetings=events.filter(e=>e.event_type==='appointment_booked').length,bounces=events.filter(e=>e.event_type==='bounced').length,overdue=followups.filter(f=>new Date(String(f.due_at)).getTime()<Date.now()).length,dnc=suppressions.filter(x=>x.channel==='all'||x.source==='opt_out').length
  return <>
    <div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing · Private Sales Operations</div><h1>Sales Outreach Workbench 3.4</h1><p className="muted">Move sourced Contact Ready prospects into deliberate, reviewable outreach. Drafting, approval, sending, calls, outcomes and follow-ups are logged separately. Nothing is automatically sent, billed, routed, verified, Sponsored, or used to alter public ranking.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/acquisition-research">Prospect Research</Link><Link className="btn btn-light" href="/admin/skylight-sales">Sales Command Center</Link></div></div>
    {errors.length?<div className="notice warn"><strong>Some Sales 3.4 data is temporarily incomplete.</strong> Do not treat affected totals as authoritative until the source query recovers.</div>:null}
    <div className="notice"><strong>Human gate:</strong> a draft can only be prepared from a sourced owner/decision-maker contact and documented marketing signal. Email requires a separate approval click before the Send button is enabled. DNC, opt-out, bounce and wrong-person suppressions are checked again at action time.</div>
    <div className="stat-grid" style={{marginTop:18}}>
      <div className="stat">Contact Ready<strong>{ready}</strong><small>verified provenance</small></div><div className="stat">Drafts<strong>{drafts.filter(d=>d.status==='draft').length}</strong></div><div className="stat">Approved<strong>{drafts.filter(d=>d.status==='approved').length}</strong><small>still not sent</small></div><div className="stat">Contacted 7d<strong>{contacted}</strong></div><div className="stat">Replies 7d<strong>{replies}</strong><small>{positive} positive / interested</small></div><div className="stat">Meetings 7d<strong>{meetings}</strong></div><div className="stat">Overdue Follow-Ups<strong>{overdue}</strong></div><div className="stat">Bounces 7d<strong>{bounces}</strong></div><div className="stat">Active Suppressions<strong>{suppressions.length}</strong><small>{dnc} full/opt-out signals</small></div>
    </div>
    <SalesOutreachWorkbench opportunities={opportunities} templates={templates} drafts={drafts} events={events} followups={followups} suppressions={suppressions} campaigns={campaigns} members={members}/>
  </>
}
