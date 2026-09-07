import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { SalesConversionWorkbench } from '@/components/SalesConversionWorkbench'

export const dynamic='force-dynamic'
type Row=Record<string,any>

export default async function Page(){
  await requireStaff('/admin/skylight-sales/conversions')
  const s=await createClient(),since=new Date(Date.now()-90*86400000).toISOString()
  const [opportunitiesResult,repliesResult,meetingsResult,handoffsResult,conversionResult,draftsResult,campaignsResult,membersResult,proposalsResult]=await Promise.all([
    s.from('skylight_sales_opportunities').select('id,prospect_id,business_id,client_id,proposal_id,primary_service_slug,recommended_service_slugs,stage,active,score,priority,estimated_value_cents,last_contact_at,first_reply_at,last_reply_at,won_at,lost_at,lost_reason,outcome_reason_code,updated_at,prospect:business_prospects(id,business_name,vertical,category,city,status,owner_contact_name,owner_contact_title,owner_contact_email,owner_contact_phone)').eq('tenant_id',TENANT_ID).order('updated_at',{ascending:false}).limit(2000),
    s.from('skylight_sales_replies').select('*').eq('tenant_id',TENANT_ID).gte('received_at',since).order('received_at',{ascending:false}).limit(3000),
    s.from('skylight_sales_meetings').select('*').eq('tenant_id',TENANT_ID).gte('created_at',since).order('scheduled_at',{ascending:false}).limit(2000),
    s.from('skylight_sales_proposal_handoffs').select('*').eq('tenant_id',TENANT_ID).gte('created_at',since).order('created_at',{ascending:false}).limit(2000),
    s.from('skylight_sales_conversion_events').select('*').eq('tenant_id',TENANT_ID).gte('created_at',since).order('created_at',{ascending:false}).limit(5000),
    s.from('skylight_sales_outreach_drafts').select('id,opportunity_id,campaign_id,campaign_member_id,channel,status,sent_at').eq('tenant_id',TENANT_ID).eq('status','sent').gte('sent_at',since).order('sent_at',{ascending:false}).limit(5000),
    s.from('skylight_sales_campaigns').select('id,name,slug,campaign_type,service_slug,status').eq('tenant_id',TENANT_ID).order('name'),
    s.from('skylight_sales_campaign_members').select('id,campaign_id,opportunity_id,prospect_id,status').limit(15000),
    s.from('skylight_proposals').select('id,client_id,proposal_number,title,status,total_cents,sent_at,accepted_at,declined_at,updated_at').eq('tenant_id',TENANT_ID).order('updated_at',{ascending:false}).limit(2000),
  ])
  const opportunities=(opportunitiesResult.data??[]) as Row[],replies=(repliesResult.data??[]) as Row[],meetings=(meetingsResult.data??[]) as Row[],handoffs=(handoffsResult.data??[]) as Row[],conversionEvents=(conversionResult.data??[]) as Row[],drafts=(draftsResult.data??[]) as Row[],campaigns=(campaignsResult.data??[]) as Row[],members=(membersResult.data??[]) as Row[],proposals=(proposalsResult.data??[]) as Row[]
  const errors=[opportunitiesResult.error,repliesResult.error,meetingsResult.error,handoffsResult.error,conversionResult.error,draftsResult.error,campaignsResult.error,membersResult.error,proposalsResult.error].filter(Boolean)
  const sent=drafts.length,confirmed=replies.filter(r=>r.review_status==='confirmed'),positive=confirmed.filter(r=>r.confirmed_classification==='positive').length,wins=conversionEvents.filter(e=>e.event_type==='won').length,losses=conversionEvents.filter(e=>e.event_type==='lost').length
  const pct=(a:number,b:number)=>b?`${((a/b)*100).toFixed(1)}%`:'0.0%'
  return <>
    <div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing · Private Sales Intelligence</div><h1>Reply & Conversion Intelligence 3.5</h1><p className="muted">Close the loop from deliberate outreach to reviewed replies, meetings, proposal handoffs and explicit win/loss outcomes. Classification is advisory until staff confirms it. Forecast values use only staff-entered/configured opportunity values.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/skylight-sales/outreach">Outreach 3.4</Link><Link className="btn btn-light" href="/admin/skylight-sales">Sales Command Center</Link></div></div>
    {errors.length?<div className="notice warn"><strong>Some Sales 3.5 data is temporarily incomplete.</strong> Do not treat affected analytics as authoritative until the source query recovers.</div>:null}
    <div className="notice"><strong>Human authority:</strong> reply suggestions never apply DNC, qualification, meetings, proposal linkage, billing, or won/lost state on their own. Staff must confirm every consequential conversion action.</div>
    <div className="stat-grid" style={{marginTop:18}}>
      <div className="stat">Sent 90d<strong>{sent}</strong></div><div className="stat">Replies 90d<strong>{replies.length}</strong><small>{pct(replies.length,sent)} reply rate</small></div><div className="stat">Confirmed Positive<strong>{positive}</strong><small>{pct(positive,confirmed.length)} of reviewed replies</small></div><div className="stat">Meetings<strong>{meetings.length}</strong><small>{meetings.filter(m=>m.status==='scheduled').length} scheduled</small></div><div className="stat">Proposal Handoffs<strong>{handoffs.length}</strong><small>{handoffs.filter(h=>h.status==='ready').length} ready</small></div><div className="stat">Won 90d<strong>{wins}</strong></div><div className="stat">Lost 90d<strong>{losses}</strong></div><div className="stat">Pending Reply Review<strong>{replies.filter(r=>r.review_status==='pending').length}</strong></div>
    </div>
    <SalesConversionWorkbench opportunities={opportunities} replies={replies} meetings={meetings} handoffs={handoffs} conversionEvents={conversionEvents} drafts={drafts} campaigns={campaigns} members={members} proposals={proposals}/>
  </>
}
