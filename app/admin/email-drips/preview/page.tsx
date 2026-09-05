import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { getSiteUrl } from '@/lib/site-url'
import { renderBusinessEmailHtml } from '@/lib/business-email-template'
import { sendTestDripEmail } from './actions'

export const dynamic='force-dynamic'

function withUtm(value:string|null,campaign:any){if(!value)return null;try{const url=new URL(value,getSiteUrl());if(campaign?.utm_source)url.searchParams.set('utm_source',campaign.utm_source);if(campaign?.utm_medium)url.searchParams.set('utm_medium',campaign.utm_medium);if(campaign?.utm_campaign||campaign?.slug)url.searchParams.set('utm_campaign',campaign.utm_campaign||campaign.slug);return url.toString()}catch{return value}}
const testMessage=(value:string)=>value==='sent'?'Test email sent to your signed-in admin email.':value==='blocked'?'Test send is blocked until Resend and a sender email are configured.':value==='failed'?'The provider rejected the test send. Check sender/domain configuration.':value==='invalid'?'Choose a valid campaign and email step.':''

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const{claims}=await requireAdmin('/admin/email-drips/preview')
  const sp=await searchParams
  const s=await createClient()
  const{data:campaignRows,error}=await s.from('email_drip_campaigns').select('id,name,slug,status,campaign_goal,conversion_goal,utm_source,utm_medium,utm_campaign,email_drip_steps(id,step_order,delay_days,subject,preheader,body,cta_label,cta_url,is_active)').eq('tenant_id',TENANT_ID).neq('status','archived').order('created_at')
  const campaigns=(campaignRows??[]) as any[]
  const requestedCampaign=typeof sp.campaign==='string'?sp.campaign:''
  const campaign=campaigns.find(c=>c.id===requestedCampaign)||campaigns[0]||null
  const steps=campaign?[...(campaign.email_drip_steps??[])].sort((a:any,b:any)=>a.step_order-b.step_order):[]
  const requestedStep=typeof sp.step==='string'?sp.step:''
  const step=steps.find((x:any)=>x.id===requestedStep)||steps.find((x:any)=>x.is_active)||steps[0]||null
  const device=sp.device==='mobile'?'mobile':'desktop'
  const test=typeof sp.test==='string'?sp.test:''
  const postal=process.env.MARKETING_EMAIL_POSTAL_ADDRESS?.trim()||''
  const provider=Boolean(process.env.RESEND_API_KEY&&(process.env.BUSINESS_NOTIFICATION_FROM_EMAIL||process.env.LEAD_NOTIFICATION_FROM_EMAIL))
  const cta=campaign&&step?withUtm(step.cta_url,campaign):null
  const html=step?renderBusinessEmailHtml({subject:step.subject,preheader:step.preheader,body:step.body,ctaLabel:step.cta_label,ctaUrl:cta,kind:'drip',postalAddress:postal||'Marketing postal address required before promotional delivery.',unsubscribeUrl:'#unsubscribe-preview'}):''
  const adminEmail=typeof claims.email==='string'?claims.email:'your signed-in admin email'
  return <>
    <div className="email-preview-head"><div><div className="kpi">Quality Assurance</div><h1>Preview & Test Lab</h1><p className="muted">Preview the saved production template on desktop or mobile, inspect compliance details, and send a private test to your own admin account before approval.</p></div><a className="btn btn-light" href="/admin/email-drips">← Campaign Studio</a></div>
    {error&&<div className="notice warn">{error.message}</div>}
    {test&&testMessage(test)&&<div className={`notice ${test==='sent'?'success':'warn'}`}><strong>Test send:</strong> {testMessage(test)}</div>}
    {!campaign?<div className="admin-card"><h2>No campaigns yet</h2><p className="muted">Create a campaign in Campaign Studio, then return here to preview it.</p></div>:<div className="email-preview-grid">
      <aside className="email-preview-sidebar">
        <div className="kpi">Saved Campaign</div><h2>{campaign.name}</h2><p className="small muted">Status: {campaign.status}</p>
        <form method="get" action="/admin/email-drips/preview"><label>Campaign<select name="campaign" defaultValue={campaign.id}>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Email Step<select name="step" defaultValue={step?.id||''}>{steps.map((x:any)=><option key={x.id} value={x.id}>Step {x.step_order} · Day +{x.delay_days} · {x.subject}</option>)}</select></label><input type="hidden" name="device" value={device}/><button className="btn btn-light">Load Preview</button></form>
        {step&&<><div className="preview-device-switch"><a className={device==='desktop'?'active':''} href={`/admin/email-drips/preview?campaign=${campaign.id}&step=${step.id}&device=desktop`}>Desktop</a><a className={device==='mobile'?'active':''} href={`/admin/email-drips/preview?campaign=${campaign.id}&step=${step.id}&device=mobile`}>Mobile</a></div><div className="preview-meta"><div><b>Subject</b>{step.subject}</div><div><b>Preheader</b>{step.preheader||'No preheader set'}</div><div><b>CTA Destination</b>{cta||'No CTA'}</div></div><div className="preview-checks"><div className={`preview-check ${step.subject.length<=60?'ok':'warn'}`}><strong>Subject length:</strong> {step.subject.length} characters {step.subject.length<=60?'· good for most inboxes':'· consider shortening'}</div><div className={`preview-check ${step.preheader?'ok':'warn'}`}><strong>Preheader:</strong> {step.preheader?'Configured':'Missing'}</div><div className={`preview-check ${postal?'ok':'warn'}`}><strong>Marketing footer:</strong> {postal?'Postal address configured':'Postal address still required before live promotional delivery'}</div><div className={`preview-check ${provider?'ok':'warn'}`}><strong>Test sender:</strong> {provider?'Provider configured':'Provider not configured yet'}</div></div><div className="test-send-box"><strong>Send Test Email to Myself</strong><p className="small muted">Sends only to {adminEmail}. It does not enroll a business, advance a sequence or count toward campaign analytics.</p><form action={sendTestDripEmail}><input type="hidden" name="campaign_id" value={campaign.id}/><input type="hidden" name="step_id" value={step.id}/><input type="hidden" name="device" value={device}/><button className="btn btn-primary" disabled={!provider}>Send Test to Myself</button></form></div></>}
      </aside>
      <section className="email-preview-stage"><div className="section-head compact-head"><div><div className="kpi">Production HTML</div><h2>{device==='mobile'?'Mobile inbox preview':'Desktop inbox preview'}</h2><p className="small muted">The visible email uses the same renderer as live delivery. Customer-specific tracking pixels and real unsubscribe tokens are intentionally not activated in preview/test mode.</p></div></div>{step?<div className={`preview-frame-shell ${device}`}><iframe title={`Email preview: ${step.subject}`} srcDoc={html}/></div>:<div className="empty-cell">This campaign has no email steps yet.</div>}</section>
    </div>}
  </>
}
