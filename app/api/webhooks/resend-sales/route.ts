import { createHmac,timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { TENANT_ID } from '@/lib/constants'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic='force-dynamic'
export const runtime='nodejs'
type Row=Record<string,any>
const text=(v:any,n=16000)=>String(v??'').trim().slice(0,n)
const emailOk=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const relation=(v:any)=>Array.isArray(v)?v[0]||null:v||null

function verifySvix(raw:string,headers:Headers){
  const secretRaw=process.env.RESEND_WEBHOOK_SECRET?.trim()||''
  const id=headers.get('svix-id')||'',stamp=headers.get('svix-timestamp')||'',signature=headers.get('svix-signature')||''
  if(!secretRaw)throw new Error('RESEND_WEBHOOK_SECRET is not configured.')
  if(!id||!stamp||!signature)return false
  const ts=Number(stamp)
  if(!Number.isFinite(ts)||Math.abs(Math.floor(Date.now()/1000)-ts)>300)return false
  const secret=Buffer.from(secretRaw.startsWith('whsec_')?secretRaw.slice(6):secretRaw,'base64')
  const expected=createHmac('sha256',secret).update(`${id}.${stamp}.${raw}`).digest()
  return signature.split(/\s+/).some(part=>{
    const [version,value]=part.split(',',2)
    if(version!=='v1'||!value)return false
    try{const got=Buffer.from(value,'base64');return got.length===expected.length&&timingSafeEqual(got,expected)}catch{return false}
  })
}
function headerMap(v:any){
  const out:Record<string,string>={}
  if(Array.isArray(v))for(const h of v){const k=text(h?.name||h?.key,160).toLowerCase(),val=text(h?.value,4000);if(k)out[k]=val}
  else if(v&&typeof v==='object')for(const [k,val] of Object.entries(v))out[String(k).toLowerCase()]=text(val,4000)
  return out
}
function parseAddress(v:any){
  const raw=Array.isArray(v)?text(v[0],500):text(v,500)
  const m=raw.match(/^(.*?)\s*<([^>]+)>$/)
  const email=text(m?.[2]||raw,320).toLowerCase()
  return {name:text(m?.[1]?.replace(/^["']|["']$/g,''),240)||null,email:emailOk(email)?email:null}
}
function stripHtml(html:string){return html.replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim()}
function suggest(subject:string,body:string){
  const v=`${subject}\n${body}`.toLowerCase(),hit=(xs:string[])=>xs.some(x=>v.includes(x))
  if(hit(['unsubscribe','opt out','remove me','stop emailing','stop contacting','do not contact',"don't contact"]))return {classification:'do_not_contact',confidence:98,reason:'Explicit stop-contact or opt-out language detected.'}
  if(hit(['wrong person','not the right person','contact someone else','no longer with the company','no longer at']))return {classification:'wrong_person',confidence:94,reason:'Reply indicates this may not be the correct contact.'}
  if(hit(['out of office','automatic reply','auto reply','away from the office','on vacation']))return {classification:'out_of_office',confidence:96,reason:'Automatic/out-of-office language detected.'}
  if(hit(['mailbox unavailable','undeliverable','delivery status notification','address not found','recipient address rejected']))return {classification:'bounce',confidence:98,reason:'Delivery failure language detected.'}
  if(hit(['not interested','no thanks','not a fit','we will pass','we’ll pass','please pass']))return {classification:'negative',confidence:90,reason:'Clear negative-interest language detected.'}
  if(hit(['interested','sounds good',"let's talk",'lets talk','schedule','book a','call me','send more','tell me more']))return {classification:'positive',confidence:84,reason:'Positive intent or meeting-interest language detected.'}
  if(v.includes('?')||hit(['how much','pricing','what does','can you','could you','how does']))return {classification:'question',confidence:72,reason:'Question or request-for-information language detected.'}
  return {classification:'ambiguous',confidence:35,reason:'No high-confidence pattern detected; staff review is required.'}
}
async function markReceipt(s:any,webhookId:string,patch:Row){await s.from('skylight_sales_webhook_receipts').update({...patch,processed_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('provider','resend').eq('webhook_id',webhookId)}
async function matchConversation(s:any,inReplyTo:string,senderEmail:string){
  if(inReplyTo){
    const a=await s.from('skylight_sales_outreach_drafts').select('id,opportunity_id,prospect_id,campaign_id,campaign_member_id').eq('tenant_id',TENANT_ID).eq('provider_message_header',inReplyTo).order('sent_at',{ascending:false}).limit(1).maybeSingle()
    if(a.error)throw a.error
    if(a.data)return {...a.data,source:'outreach_draft'}
    const b=await s.from('skylight_sales_response_drafts').select('id,opportunity_id,prospect_id,campaign_id,campaign_member_id').eq('tenant_id',TENANT_ID).eq('provider_message_header',inReplyTo).order('sent_at',{ascending:false}).limit(1).maybeSingle()
    if(b.error)throw b.error
    if(b.data)return {...b.data,source:'response_draft'}
  }
  if(senderEmail){
    const p=await s.from('business_prospects').select('id').eq('tenant_id',TENANT_ID).ilike('owner_contact_email',senderEmail).order('updated_at',{ascending:false}).limit(1).maybeSingle()
    if(p.error)throw p.error
    if(p.data){
      const o=await s.from('skylight_sales_opportunities').select('id,prospect_id').eq('tenant_id',TENANT_ID).eq('prospect_id',p.data.id).order('active',{ascending:false}).order('updated_at',{ascending:false}).limit(1).maybeSingle()
      if(o.error)throw o.error
      if(o.data){
        const m=await s.from('skylight_sales_campaign_members').select('id,campaign_id').eq('opportunity_id',o.data.id).order('updated_at',{ascending:false}).limit(1).maybeSingle()
        if(m.error)throw m.error
        return {opportunity_id:o.data.id,prospect_id:p.data.id,campaign_id:m.data?.campaign_id||null,campaign_member_id:m.data?.id||null,id:null,source:'sender_fallback'}
      }
    }
  }
  return null
}

export async function POST(req:Request){
  const raw=await req.text(),webhookId=req.headers.get('svix-id')||''
  if(!process.env.RESEND_WEBHOOK_SECRET)return NextResponse.json({ok:false,error:'Inbound email webhook is not configured.'},{status:503})
  if(!verifySvix(raw,req.headers))return NextResponse.json({ok:false,error:'Invalid webhook signature.'},{status:401})
  let event:Row
  try{event=JSON.parse(raw)}catch{return NextResponse.json({ok:false,error:'Invalid JSON.'},{status:400})}
  const s=createServiceClient(),eventType=text(event.type,100),emailId=text(event?.data?.email_id||event?.data?.id,240)
  const receipt=await s.from('skylight_sales_webhook_receipts').insert({tenant_id:TENANT_ID,provider:'resend',webhook_id:webhookId,event_type:eventType,provider_email_id:emailId||null,status:'received'})
  if(receipt.error){
    if(String(receipt.error.code)==='23505')return NextResponse.json({ok:true,duplicate:true})
    throw receipt.error
  }
  try{
    if(eventType==='email.sent'){
      const messageId=text(event?.data?.message_id,500)
      if(messageId&&emailId){
        const [a,b]=await Promise.all([
          s.from('skylight_sales_outreach_drafts').update({provider_message_header:messageId,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('provider','resend').eq('provider_message_id',emailId),
          s.from('skylight_sales_response_drafts').update({provider_message_header:messageId,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('provider','resend').eq('provider_email_id',emailId)
        ])
        if(a.error)throw a.error;if(b.error)throw b.error
      }
      await markReceipt(s,webhookId,{status:'processed'})
      return NextResponse.json({ok:true,event:eventType})
    }
    if(eventType!=='email.received'){
      await markReceipt(s,webhookId,{status:'ignored'})
      return NextResponse.json({ok:true,ignored:true})
    }
    if(!emailId)throw new Error('Resend inbound event did not include an email id.')
    const apiKey=process.env.RESEND_API_KEY?.trim()||''
    if(!apiKey)throw new Error('RESEND_API_KEY is not configured.')
    const r=await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,{headers:{Authorization:`Bearer ${apiKey}`},cache:'no-store'})
    const full=await r.json().catch(()=>({}))
    if(!r.ok)throw new Error(text(full?.message,1000)||`Unable to retrieve inbound email (${r.status}).`)
    const headers=headerMap(full.headers),from=parseAddress(full.from||event?.data?.from),senderEmail=from.email||''
    const subject=text(full.subject||event?.data?.subject,500),messageId=text(full.message_id||headers['message-id'],500)
    const inReplyTo=text(headers['in-reply-to'],1000),references=text(headers['references'],3000)
    const recipients=(Array.isArray(full.to)?full.to:Array.isArray(event?.data?.to)?event.data.to:[]).map((x:any)=>parseAddress(x).email).filter(Boolean)
    const body=text(full.text,24000)||text(stripHtml(text(full.html,50000)),24000)||'[No readable message body supplied]'
    const attachments=Array.isArray(full.attachments)?full.attachments.slice(0,50):[]
    const matched=await matchConversation(s,inReplyTo,senderEmail)
    if(!matched){
      const q=await s.from('skylight_sales_unmatched_inbound').insert({tenant_id:TENANT_ID,provider:'resend',provider_email_id:emailId,provider_message_id:messageId||null,in_reply_to_header:inReplyTo||null,references_header:references||null,sender_name:from.name,sender_email:senderEmail||null,recipient_emails:recipients,subject:subject||null,body,headers,attachments,received_at:new Date().toISOString(),status:'unmatched'})
      if(q.error&&String(q.error.code)!=='23505')throw q.error
      await markReceipt(s,webhookId,{status:'processed'})
      return NextResponse.json({ok:true,matched:false,quarantined:true})
    }
    const sg=suggest(subject,body),receivedAt=new Date().toISOString()
    const ins=await s.from('skylight_sales_replies').insert({tenant_id:TENANT_ID,opportunity_id:matched.opportunity_id,prospect_id:matched.prospect_id,draft_id:matched.source==='outreach_draft'?matched.id:null,campaign_id:matched.campaign_id||null,campaign_member_id:matched.campaign_member_id||null,channel:'email',provider:'resend',provider_email_id:emailId,provider_message_id:messageId||null,in_reply_to_header:inReplyTo||null,references_header:references||null,sender_name:from.name,sender_email:senderEmail||null,subject:subject||null,body,received_at:receivedAt,classification_suggestion:sg.classification,classification_confidence:sg.confidence,suggestion_reason:sg.reason,review_status:'pending',headers,attachments,metadata:{ingress:'resend_webhook',classification_advisory:true,automatic_stage_change:false}}).select('id').single()
    if(ins.error){if(String(ins.error.code)==='23505'){await markReceipt(s,webhookId,{status:'processed'});return NextResponse.json({ok:true,duplicate_email:true})}throw ins.error}
    const opp=await s.from('skylight_sales_opportunities').select('first_reply_at').eq('tenant_id',TENANT_ID).eq('id',matched.opportunity_id).single()
    if(opp.error)throw opp.error
    const opPatch:Row={last_reply_at:receivedAt,updated_at:receivedAt};if(!opp.data?.first_reply_at)opPatch.first_reply_at=receivedAt
    const ou=await s.from('skylight_sales_opportunities').update(opPatch).eq('tenant_id',TENANT_ID).eq('id',matched.opportunity_id);if(ou.error)throw ou.error
    const old=await s.from('skylight_sales_thread_state').select('unread_count').eq('opportunity_id',matched.opportunity_id).maybeSingle();if(old.error)throw old.error
    const tu=await s.from('skylight_sales_thread_state').upsert({opportunity_id:matched.opportunity_id,tenant_id:TENANT_ID,prospect_id:matched.prospect_id,status:'waiting_on_us',unread_count:Number(old.data?.unread_count||0)+1,last_inbound_at:receivedAt,last_activity_at:receivedAt,last_subject:subject||null,updated_at:receivedAt},{onConflict:'opportunity_id'});if(tu.error)throw tu.error
    const ce=await s.from('skylight_sales_conversion_events').insert({tenant_id:TENANT_ID,opportunity_id:matched.opportunity_id,prospect_id:matched.prospect_id,campaign_id:matched.campaign_id||null,campaign_member_id:matched.campaign_member_id||null,reply_id:ins.data.id,event_type:'reply_recorded',metadata:{ingress:'resend_webhook',staff_confirmation_required:true}});if(ce.error)throw ce.error
    await markReceipt(s,webhookId,{status:'processed'})
    return NextResponse.json({ok:true,matched:true,pending_review:true})
  }catch(e:any){
    await markReceipt(s,webhookId,{status:'failed',error_message:text(e?.message,2000)}).catch(()=>{})
    return NextResponse.json({ok:false,error:'Inbound email processing failed.'},{status:500})
  }
}
