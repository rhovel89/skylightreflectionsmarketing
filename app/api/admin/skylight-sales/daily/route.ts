import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

type Row=Record<string,any>
const text=(v:any,n=12000)=>String(v??'').trim().slice(0,n)
const relation=(v:any)=>Array.isArray(v)?v[0]||null:v||null
const bounded=(v:any,min:number,max:number,fallback:number)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback}
const emailOk=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const canonicalBase=()=>String(process.env.NEXT_PUBLIC_SITE_URL||'https://central-il-local-pros.vercel.app').replace(/\/$/,'')

async function googleAccessToken(){
  const clientId=process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim()||'',clientSecret=process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim()||'',refreshToken=process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim()||''
  if(!clientId||!clientSecret||!refreshToken)throw new Error('Google Calendar is not fully configured. Client ID, client secret and refresh token are required.')
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store'})
  const j=await r.json().catch(()=>({}))
  if(!r.ok||!j?.access_token)throw new Error(text(j?.error_description||j?.error||'Unable to authorize Google Calendar.',1200))
  return String(j.access_token)
}

async function createGoogleEvent(s:any,userId:string,meetingId:string,sendInvite:boolean){
  const q=await s.from('skylight_sales_meetings').select('*,opportunity:skylight_sales_opportunities(id,prospect_id,stage,primary_service_slug,prospect:business_prospects(id,business_name,owner_contact_name,owner_contact_email,owner_contact_phone))').eq('tenant_id',TENANT_ID).eq('id',meetingId).single()
  if(q.error)throw q.error
  const meeting=q.data as Row,opp=relation(meeting.opportunity),prospect=relation(opp?.prospect)
  if(meeting.status!=='scheduled')throw new Error('Only a scheduled meeting can be added to Google Calendar.')
  if(meeting.calendar_sync_status==='linked'&&meeting.external_calendar_id)return {already_linked:true,event_id:meeting.external_calendar_id,event_url:meeting.external_calendar_url||null}
  const start=new Date(meeting.scheduled_at);if(Number.isNaN(start.getTime()))throw new Error('Meeting start time is invalid.')
  const end=new Date(start.getTime()+bounded(meeting.duration_minutes,5,480,30)*60000)
  const email=text(prospect?.owner_contact_email,320).toLowerCase()
  if(sendInvite&&!emailOk(email))throw new Error('A valid decision-maker email is required before sending a calendar invitation.')
  const creating=await s.from('skylight_sales_meetings').update({calendar_sync_status:'creating',calendar_last_error:null,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',meetingId)
  if(creating.error)throw creating.error
  try{
    const accessToken=await googleAccessToken(),calendarId=process.env.GOOGLE_CALENDAR_ID?.trim()||'primary',business=text(prospect?.business_name,180)||'Sales Prospect',contact=text(prospect?.owner_contact_name,140)||'Decision Maker'
    const event:Row={summary:`${meeting.meeting_type==='discovery'?'Discovery Call':'Sales Meeting'} — ${business}`,description:[`Skylight Reflections Marketing sales meeting`,`Business: ${business}`,`Contact: ${contact}`,`Opportunity: ${opp?.id||meeting.opportunity_id}`,meeting.notes?`Staff notes: ${text(meeting.notes,2400)}`:'','Created from Sales Command Center 3.7 by explicit staff action.'].filter(Boolean).join('\n\n'),start:{dateTime:start.toISOString()},end:{dateTime:end.toISOString()}}
    if(meeting.location_detail)event.location=text(meeting.location_detail,500)
    if(sendInvite)event.attendees=[{email}]
    const r=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=${sendInvite?'all':'none'}`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(event),cache:'no-store'})
    const j=await r.json().catch(()=>({}));if(!r.ok||!j?.id)throw new Error(text(j?.error?.message||'Google Calendar event creation failed.',1600))
    const now=new Date().toISOString(),u=await s.from('skylight_sales_meetings').update({external_calendar_id:String(j.id),external_calendar_provider:'google',external_calendar_url:text(j.htmlLink,1000)||null,calendar_sync_status:'linked',calendar_created_at:now,calendar_last_error:null,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',meetingId);if(u.error)throw u.error
    await s.from('skylight_sales_conversion_events').insert({tenant_id:TENANT_ID,opportunity_id:meeting.opportunity_id,prospect_id:meeting.prospect_id,campaign_id:meeting.campaign_id||null,campaign_member_id:meeting.campaign_member_id||null,meeting_id:meeting.id,event_type:'note',actor_user_id:userId,metadata:{calendar_provider:'google',calendar_event_created:true,invite_sent:sendInvite,automatic_outreach:false}})
    return {event_id:String(j.id),event_url:text(j.htmlLink,1000)||null,invite_sent:sendInvite}
  }catch(e:any){await s.from('skylight_sales_meetings').update({calendar_sync_status:'failed',calendar_last_error:text(e?.message,1600),updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',meetingId);throw e}
}

async function activateResendInbound(userId:string){
  const apiKey=process.env.RESEND_API_KEY?.trim()||'';if(!apiKey)throw new Error('RESEND_API_KEY is not configured in production.')
  const service=createServiceClient(),endpoint=`${canonicalBase()}/api/webhooks/resend-sales`,headers={Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'}
  const stored=await service.from('skylight_sales_provider_secrets').select('id,secret_value,metadata').eq('tenant_id',TENANT_ID).eq('provider','resend').eq('secret_key','sales_webhook_signing_secret').maybeSingle();if(stored.error)throw stored.error
  const listed=await fetch('https://api.resend.com/webhooks',{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'}),listJson=await listed.json().catch(()=>({}));if(!listed.ok)throw new Error(text(listJson?.message||'Unable to list Resend webhooks.',1200))
  const webhooks=Array.isArray(listJson?.data)?listJson.data:[],matches=webhooks.filter((w:any)=>String(w?.endpoint||'')===endpoint),required=['email.received','email.sent']
  if(stored.data?.secret_value&&matches.length){const target=matches.find((w:any)=>String(w?.id||'')===String(stored.data?.metadata?.webhook_id||''))||matches[0],events=Array.from(new Set([...(Array.isArray(target.events)?target.events:[]),...required])),patch=await fetch(`https://api.resend.com/webhooks/${encodeURIComponent(String(target.id))}`,{method:'PATCH',headers,body:JSON.stringify({endpoint,events,status:'enabled'}),cache:'no-store'}),patchJson=await patch.json().catch(()=>({}));if(!patch.ok)throw new Error(text(patchJson?.message||'Unable to enable the existing Resend Sales webhook.',1200));await service.from('skylight_sales_provider_secrets').update({metadata:{webhook_id:String(target.id),endpoint,events,activated_by:userId},updated_at:new Date().toISOString()}).eq('id',stored.data.id);return {configured:true,webhook_id:String(target.id),endpoint,reused:true}}
  for(const w of matches){await fetch(`https://api.resend.com/webhooks/${encodeURIComponent(String(w.id))}`,{method:'PATCH',headers,body:JSON.stringify({status:'disabled'}),cache:'no-store'}).catch(()=>null)}
  const created=await fetch('https://api.resend.com/webhooks',{method:'POST',headers,body:JSON.stringify({endpoint,events:required}),cache:'no-store'}),createdJson=await created.json().catch(()=>({}));if(!created.ok||!createdJson?.id||!createdJson?.signing_secret)throw new Error(text(createdJson?.message||'Unable to create the Resend inbound Sales webhook.',1600))
  const saved=await service.from('skylight_sales_provider_secrets').upsert({tenant_id:TENANT_ID,provider:'resend',secret_key:'sales_webhook_signing_secret',secret_value:String(createdJson.signing_secret),metadata:{webhook_id:String(createdJson.id),endpoint,events:required,activated_by:userId},updated_at:new Date().toISOString()},{onConflict:'tenant_id,provider,secret_key'});if(saved.error)throw saved.error
  return {configured:true,webhook_id:String(createdJson.id),endpoint,reused:false}
}

async function integrationProbe(){
  const status:Row={resend_api_key:Boolean(process.env.RESEND_API_KEY),supabase_service_role:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),resend_env_webhook_secret:Boolean(process.env.RESEND_WEBHOOK_SECRET),sales_reply_to:Boolean(process.env.SALES_INBOUND_REPLY_TO_EMAIL),google_calendar_credentials:Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID&&process.env.GOOGLE_CALENDAR_CLIENT_SECRET&&process.env.GOOGLE_CALENDAR_REFRESH_TOKEN),google_calendar_id:Boolean(process.env.GOOGLE_CALENDAR_ID)}
  if(process.env.SUPABASE_SERVICE_ROLE_KEY){try{const ss=createServiceClient(),q=await ss.from('skylight_sales_provider_secrets').select('id,metadata').eq('tenant_id',TENANT_ID).eq('provider','resend').eq('secret_key','sales_webhook_signing_secret').maybeSingle();status.resend_stored_webhook_secret=Boolean(q.data?.id);status.resend_stored_webhook_id=q.data?.metadata?.webhook_id||null}catch{status.resend_stored_webhook_secret=false}}
  if(process.env.RESEND_API_KEY){try{const r=await fetch('https://api.resend.com/webhooks',{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`},cache:'no-store'}),j=await r.json().catch(()=>({})),endpoint=`${canonicalBase()}/api/webhooks/resend-sales`,rows=Array.isArray(j?.data)?j.data:[];status.resend_webhook_registered=Boolean(r.ok&&rows.some((w:any)=>String(w.endpoint||'')===endpoint&&String(w.status||'')!=='disabled'&&Array.isArray(w.events)&&w.events.includes('email.received')))}catch{status.resend_webhook_registered=false}}
  status.inbound_email_ready=Boolean(status.resend_api_key&&status.supabase_service_role&&(status.resend_env_webhook_secret||status.resend_stored_webhook_secret)&&status.resend_webhook_registered)
  return status
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/skylight-sales/daily'),userId=String(claims.sub),s=await createClient(),body=await req.json() as Row,action=text(body.action,80),now=new Date().toISOString()
    if(action==='refresh_operating_system'){const q=await s.rpc('refresh_skylight_sales_operating_system_staff',{p_tenant_id:TENANT_ID});if(q.error)throw q.error;return NextResponse.json({ok:true,data:q.data,automatic_outreach:false,billing_authorization:false,public_ranking_effect:false})}
    if(action==='save_settings'){
      const patch:Row={updated_by:userId,updated_at:now},ints:Record<string,[number,number,number]>={stale_opportunity_days:[1,180,14],proposal_sent_followup_days:[1,60,3],proposal_viewed_followup_days:[1,60,2],proposal_expiring_days:[0,30,3],meeting_reminder_hours:[1,168,24],invoice_due_soon_days:[0,30,3],hot_score_threshold:[1,100,80],weight_new_bps:[0,10000,500],weight_research_bps:[0,10000,500],weight_contact_ready_bps:[0,10000,1500],weight_contacted_bps:[0,10000,2500],weight_qualified_bps:[0,10000,5000],weight_proposal_bps:[0,10000,7500],weight_nurture_bps:[0,10000,1000]}
      for(const [k,[min,max,fallback]] of Object.entries(ints))if(body[k]!==undefined)patch[k]=bounded(body[k],min,max,fallback)
      for(const k of ['action_queue_enabled','auto_create_tasks','daily_snapshot_enabled'])if(body[k]!==undefined)patch[k]=Boolean(body[k])
      const existing=await s.from('skylight_sales_action_settings').select('id').eq('tenant_id',TENANT_ID).maybeSingle();if(existing.error)throw existing.error
      const q=existing.data?await s.from('skylight_sales_action_settings').update(patch).eq('id',existing.data.id):await s.from('skylight_sales_action_settings').insert({tenant_id:TENANT_ID,...patch});if(q.error)throw q.error;return NextResponse.json({ok:true})
    }
    if(action==='set_action_status'){
      const id=text(body.id,40),status=text(body.status,30);if(!id||!['open','in_progress','completed','dismissed'].includes(status))throw new Error('Valid action item and status are required.')
      const patch:Row={status,updated_by:userId,updated_at:now};if(status==='completed')Object.assign(patch,{completed_by:userId,completed_at:now,dismissed_by:null,dismissed_at:null});else if(status==='dismissed')Object.assign(patch,{dismissed_by:userId,dismissed_at:now,completed_by:null,completed_at:null});else Object.assign(patch,{completed_by:null,completed_at:null,dismissed_by:null,dismissed_at:null})
      const q=await s.from('skylight_sales_action_items').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);if(q.error)throw q.error;return NextResponse.json({ok:true})
    }
    if(action==='snooze_action'){
      const id=text(body.id,40),raw=text(body.until,100),d=new Date(raw);if(!id||Number.isNaN(d.getTime())||d.getTime()<=Date.now())throw new Error('Choose a future snooze time.')
      const q=await s.from('skylight_sales_action_items').update({snoozed_until:d.toISOString(),updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',id);if(q.error)throw q.error;return NextResponse.json({ok:true})
    }
    if(action==='update_forecast'){
      const id=text(body.opportunity_id,40);if(!id)throw new Error('Opportunity is required.')
      let estimated:number|null=null
      if(body.estimated_value!==''&&body.estimated_value!=null){const n=Number(body.estimated_value);if(!Number.isFinite(n)||n<0||n>20000000)throw new Error('Estimated value must be a valid non-negative amount.');estimated=Math.round(n*100)}
      const close=text(body.expected_close_date,20);if(close&&!/^\d{4}-\d{2}-\d{2}$/.test(close))throw new Error('Expected close date must be a valid date.')
      const q=await s.from('skylight_sales_opportunities').update({estimated_value_cents:estimated,expected_close_date:close||null,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',id).eq('active',true);if(q.error)throw q.error
      return NextResponse.json({ok:true,forecast_is_staff_entered:true})
    }
    if(action==='create_google_calendar_event'){const meetingId=text(body.meeting_id,40);if(!meetingId)throw new Error('Meeting is required.');const data=await createGoogleEvent(s,userId,meetingId,body.send_invite===true);return NextResponse.json({ok:true,data,automatic_invite:false})}
    if(action==='activate_resend_inbound'){const data=await activateResendInbound(userId);return NextResponse.json({ok:true,data,automatic_outreach:false})}
    if(action==='probe_integrations')return NextResponse.json({ok:true,data:await integrationProbe()})
    return NextResponse.json({error:'Unsupported Sales 3.7 action.'},{status:400})
  }catch(e:any){return NextResponse.json({error:text(e?.message||'Unable to process Sales 3.7 action.',2000)},{status:400})}
}
