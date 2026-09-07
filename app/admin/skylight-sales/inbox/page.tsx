import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { SalesInboxWorkbench } from '@/components/SalesInboxWorkbench'

export const dynamic='force-dynamic'
type Row=Record<string,any>

export default async function Page(){
  await requireStaff('/admin/skylight-sales/inbox')
  const s=await createClient(),since=new Date(Date.now()-120*86400000).toISOString()
  const [opportunitiesResult,threadsResult,repliesResult,outreachResult,responseResult,meetingsResult,handoffsResult,unmatchedResult,proposalsResult,projectsResult,invoicesResult,revenueResult]=await Promise.all([
    s.from('skylight_sales_opportunities').select('id,prospect_id,business_id,client_id,proposal_id,invoice_id,project_id,primary_service_slug,recommended_service_slugs,stage,active,estimated_value_cents,attributed_revenue_cents,revenue_attributed_at,last_reply_at,updated_at,prospect:business_prospects(id,business_name,city,status,owner_contact_name,owner_contact_email,owner_contact_phone)').eq('tenant_id',TENANT_ID).order('updated_at',{ascending:false}).limit(1800),
    s.from('skylight_sales_thread_state').select('*').eq('tenant_id',TENANT_ID).order('last_activity_at',{ascending:false}).limit(1800),
    s.from('skylight_sales_replies').select('*').eq('tenant_id',TENANT_ID).gte('received_at',since).order('received_at',{ascending:false}).limit(4000),
    s.from('skylight_sales_outreach_drafts').select('id,opportunity_id,prospect_id,campaign_id,campaign_member_id,channel,subject,body,status,provider,provider_message_id,provider_message_header,sent_at').eq('tenant_id',TENANT_ID).eq('status','sent').gte('sent_at',since).order('sent_at',{ascending:false}).limit(4000),
    s.from('skylight_sales_response_drafts').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(4000),
    s.from('skylight_sales_meetings').select('*').eq('tenant_id',TENANT_ID).gte('scheduled_at',new Date(Date.now()-30*86400000).toISOString()).order('scheduled_at',{ascending:true}).limit(1200),
    s.from('skylight_sales_proposal_handoffs').select('*').eq('tenant_id',TENANT_ID).in('status',['draft','ready']).order('created_at',{ascending:false}).limit(1200),
    s.from('skylight_sales_unmatched_inbound').select('*').eq('tenant_id',TENANT_ID).eq('status','unmatched').order('received_at',{ascending:false}).limit(500),
    s.from('skylight_proposals').select('id,client_id,proposal_number,public_token,title,status,total_cents,sent_at,viewed_at,accepted_at,declined_at,converted_at,created_at').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(1800),
    s.from('skylight_projects').select('id,client_id,proposal_id,project_number,name,status,health,progress_pct,start_date,due_date,created_at').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(1800),
    s.from('skylight_invoices').select('id,client_id,invoice_number,public_token,status,total_cents,amount_paid_cents,balance_due_cents,sent_at,paid_at,created_at').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(1800),
    s.from('skylight_sales_revenue_links').select('*').eq('tenant_id',TENANT_ID).order('created_at',{ascending:false}).limit(5000),
  ])
  const opportunities=(opportunitiesResult.data||[]) as Row[],threads=(threadsResult.data||[]) as Row[],replies=(repliesResult.data||[]) as Row[],outreach=(outreachResult.data||[]) as Row[],responseDrafts=(responseResult.data||[]) as Row[],meetings=(meetingsResult.data||[]) as Row[],handoffs=(handoffsResult.data||[]) as Row[],unmatched=(unmatchedResult.data||[]) as Row[],proposals=(proposalsResult.data||[]) as Row[],projects=(projectsResult.data||[]) as Row[],invoices=(invoicesResult.data||[]) as Row[],revenueLinks=(revenueResult.data||[]) as Row[]
  const errors=[opportunitiesResult.error,threadsResult.error,repliesResult.error,outreachResult.error,responseResult.error,meetingsResult.error,handoffsResult.error,unmatchedResult.error,proposalsResult.error,projectsResult.error,invoicesResult.error,revenueResult.error].filter(Boolean)
  const waiting=threads.filter(t=>t.status==='waiting_on_us').length,unread=threads.reduce((n,t)=>n+Number(t.unread_count||0),0),draftCount=responseDrafts.filter(d=>d.status==='draft').length,approved=responseDrafts.filter(d=>d.status==='approved').length
  const attributed=opportunities.reduce((n,o)=>n+Number(o.attributed_revenue_cents||0),0),proposalValue=proposals.filter(p=>!['declined','expired'].includes(String(p.status))).reduce((n,p)=>n+Number(p.total_cents||0),0)
  const inboundConfigured=Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_WEBHOOK_SECRET&&process.env.SUPABASE_SERVICE_ROLE_KEY)
  const replyToConfigured=Boolean(process.env.SALES_INBOUND_REPLY_TO_EMAIL)
  return <>
    <div className="admin-page-head"><div><div className="kpi">Skylight Reflections Marketing · Private Revenue Operations</div><h1>Sales Inbox & Revenue Operations 3.6</h1><p className="muted">One staff workspace for inbound conversations, human-approved replies, meetings, proposal handoffs, lifecycle linkage and paid-revenue attribution. Automated ingestion may capture and suggest; it never authorizes a send, proposal commitment, invoice, ranking change or Sponsored activation.</p></div><div className="admin-row-actions"><Link className="btn btn-light" href="/admin/skylight-sales/conversions">Conversion 3.5</Link><Link className="btn btn-light" href="/admin/skylight-sales/outreach">Outreach 3.4</Link></div></div>
    {errors.length?<div className="notice warn"><strong>Some 3.6 source queries are incomplete.</strong> Do not treat affected totals as authoritative until the source query recovers.</div>:null}
    <div className={inboundConfigured?'notice':'notice warn'}><strong>Inbound email: {inboundConfigured?'runtime prerequisites detected':'not fully configured in runtime'}.</strong> Webhook endpoint: <code>/api/webhooks/resend-sales</code>. {replyToConfigured?'A dedicated Sales reply-to address is configured.':'No dedicated SALES_INBOUND_REPLY_TO_EMAIL is detected; existing sender behavior remains unchanged.'} Signed webhook verification and server-only Supabase access are required before inbound messages are accepted.</div>
    <div className="stat-grid" style={{marginTop:18}}>
      <div className="stat">Waiting on Us<strong>{waiting}</strong><small>{unread} unread messages</small></div>
      <div className="stat">Reply Drafts<strong>{draftCount}</strong><small>{approved} separately approved</small></div>
      <div className="stat">Unmatched Inbound<strong>{unmatched.length}</strong><small>quarantined, never dropped</small></div>
      <div className="stat">Upcoming Meetings<strong>{meetings.filter(m=>m.status==='scheduled'&&new Date(m.scheduled_at).getTime()>=Date.now()).length}</strong></div>
      <div className="stat">Open Handoffs<strong>{handoffs.length}</strong></div>
      <div className="stat">Proposal Value<strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(proposalValue/100)}</strong><small>proposal value, not revenue</small></div>
      <div className="stat">Attributed Paid Revenue<strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(attributed/100)}</strong><small>explicitly linked invoice payments only</small></div>
    </div>
    <SalesInboxWorkbench opportunities={opportunities} threads={threads} replies={replies} outreach={outreach} responseDrafts={responseDrafts} meetings={meetings} handoffs={handoffs} unmatched={unmatched} proposals={proposals} projects={projects} invoices={invoices} revenueLinks={revenueLinks} inboundConfigured={inboundConfigured}/>
  </>
}
