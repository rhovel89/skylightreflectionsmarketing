import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { applyPlaceholders,evidenceSummary,OUTREACH_CHANNELS,relation,renderSkylightOutreachEmail,suppressionValue,templateValues,text,validHttpUrl,verifiedContact,outreachUnsubscribeUrl } from '@/lib/skylight-sales-outreach'

type Row=Record<string,any>
const channelOk=(v:string)=>OUTREACH_CHANNELS.includes(v as any)
const emailOk=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

async function context(s:any,opportunityId:string){
  const {data,error}=await s.from('skylight_sales_opportunities').select('id,tenant_id,prospect_id,business_id,primary_service_slug,recommended_service_slugs,evidence_flags,score,priority,stage,active,assigned_user_id,next_follow_up_at,prospect:business_prospects(id,business_name,vertical,category,city,status,owner_contact_name,owner_contact_title,owner_contact_email,owner_contact_phone,owner_contact_source_url,owner_contact_checked_at,assigned_user_id)').eq('tenant_id',TENANT_ID).eq('id',opportunityId).single()
  if(error)throw error
  const prospect=relation(data.prospect) as Row
  if(!data.active||['won','lost'].includes(String(data.stage)))throw new Error('This sales opportunity is not active.')
  if(!prospect||prospect.status==='do_not_contact')throw new Error('This prospect is Do Not Contact.')
  if(!verifiedContact(prospect))throw new Error('Outreach requires a sourced owner/decision-maker email or phone, a valid source URL, and a checked timestamp.')
  if(!evidenceSummary(data.evidence_flags))throw new Error('A documented marketing evidence signal is required before outreach copy can be prepared.')
  return {opportunity:data as Row,prospect}
}
async function blocked(s:any,prospectId:string,channel:string,value:string){
  const {data,error}=await s.from('skylight_sales_suppressions').select('id,channel,contact_value,reason').eq('tenant_id',TENANT_ID).eq('prospect_id',prospectId).eq('active',true).in('channel',['all',channel])
  if(error)throw error
  return (data??[]).find((r:any)=>r.channel==='all'||!r.contact_value||String(r.contact_value).toLowerCase()===value.toLowerCase())||null
}
async function chooseTemplate(s:any,{templateId,serviceSlug,vertical,channel,stage}:{templateId?:string;serviceSlug:string;vertical:string;channel:string;stage:string}){
  let q=s.from('skylight_sales_outreach_templates').select('*').eq('tenant_id',TENANT_ID).eq('active',true).eq('channel',channel).eq('sequence_stage',stage)
  if(templateId)q=q.eq('id',templateId)
  const {data,error}=await q.order('sort_order').limit(100)
  if(error)throw error
  const rows=(data??[]) as Row[]
  if(templateId)return rows[0]||null
  return rows.sort((a,b)=>Number(Boolean(b.service_slug&&b.service_slug===serviceSlug))-Number(Boolean(a.service_slug&&a.service_slug===serviceSlug))||Number(Boolean(b.vertical&&b.vertical===vertical))-Number(Boolean(a.vertical&&a.vertical===vertical))||Number(a.sort_order||100)-Number(b.sort_order||100)).find(r=>(!r.service_slug||r.service_slug===serviceSlug)&&(!r.vertical||r.vertical===vertical))||null
}
async function createDraft(s:any,userId:string,body:Row){
  const opportunityId=text(body.opportunity_id,40),channel=text(body.channel||'email',20),stage=text(body.sequence_stage||'first_touch',40)
  if(!opportunityId||!channelOk(channel))throw new Error('Valid opportunity and outreach channel are required.')
  const {opportunity,prospect}=await context(s,opportunityId)
  const value=suppressionValue(channel,prospect)
  if(channel==='email'&&!emailOk(text(prospect.owner_contact_email,240)))throw new Error('A verified owner/decision-maker email is required for email outreach.')
  if((channel==='phone'||channel==='sms')&&!text(prospect.owner_contact_phone,80))throw new Error('A verified owner/decision-maker phone is required for this channel.')
  const suppression=await blocked(s,String(prospect.id),channel,value)
  if(suppression)throw new Error(`Outreach is suppressed${suppression.reason?`: ${suppression.reason}`:''}`)
  const template=await chooseTemplate(s,{templateId:text(body.template_id,40)||undefined,serviceSlug:String(opportunity.primary_service_slug||''),vertical:String(prospect.vertical||''),channel,stage})
  if(!template)throw new Error('No active matching outreach template is available.')
  const values=templateValues(opportunity,prospect)
  const subject=channel==='email'?applyPlaceholders(String(template.subject_template||''),values).trim():null
  const draftBody=applyPlaceholders(String(template.body_template||''),values).trim()
  if(channel==='email'&&!subject)throw new Error('Email draft template requires a subject.')
  if(!draftBody)throw new Error('Outreach draft body cannot be empty.')
  const {data:membership}=await s.from('skylight_sales_campaign_members').select('id,campaign_id').eq('opportunity_id',opportunity.id).in('status',['ready','contacted','replied','qualified']).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  const {data,error}=await s.from('skylight_sales_outreach_drafts').insert({tenant_id:TENANT_ID,opportunity_id:opportunity.id,prospect_id:prospect.id,campaign_id:body.campaign_id||membership?.campaign_id||null,campaign_member_id:body.campaign_member_id||membership?.id||null,template_id:template.id,channel,sequence_stage:stage,recipient_name:prospect.owner_contact_name||null,recipient_title:prospect.owner_contact_title||null,recipient_email:prospect.owner_contact_email||null,recipient_phone:prospect.owner_contact_phone||null,subject,body:draftBody,evidence_snapshot:{evidence_flags:opportunity.evidence_flags||[],recommended_services:opportunity.recommended_service_slugs||[],score:opportunity.score,priority:opportunity.priority,service:opportunity.primary_service_slug},source_url:prospect.owner_contact_source_url,contact_checked_at:prospect.owner_contact_checked_at,status:'draft',created_by:userId,updated_by:userId}).select('*').single()
  if(error)throw error
  const logged=await s.from('skylight_sales_outreach_events').insert({tenant_id:TENANT_ID,opportunity_id:opportunity.id,prospect_id:prospect.id,draft_id:data.id,campaign_id:data.campaign_id,campaign_member_id:data.campaign_member_id,actor_user_id:userId,channel,event_type:'draft_created',notes:'Human-review outreach draft created from verified contact provenance and documented marketing evidence.',metadata:{automatic_outreach:false,billing_authorization:false,public_ranking_effect:false}})
  if(logged.error)throw logged.error
  return data
}
async function recheckDraft(s:any,draftId:string){
  const {data,error}=await s.from('skylight_sales_outreach_drafts').select('*,opportunity:skylight_sales_opportunities(id,stage,active,evidence_flags),prospect:business_prospects(id,status,owner_contact_email,owner_contact_phone,owner_contact_source_url,owner_contact_checked_at)').eq('tenant_id',TENANT_ID).eq('id',draftId).single()
  if(error)throw error
  const p=relation(data.prospect),o=relation(data.opportunity)
  if(!o?.active||p?.status==='do_not_contact'||!verifiedContact(p))throw new Error('This draft is no longer eligible for outreach. Re-verify the contact and suppression state.')
  const current=data.channel==='email'?text(p.owner_contact_email,240).toLowerCase():data.channel==='phone'||data.channel==='sms'?text(p.owner_contact_phone,80):''
  const snap=data.channel==='email'?text(data.recipient_email,240).toLowerCase():data.channel==='phone'||data.channel==='sms'?text(data.recipient_phone,80):''
  if(current!==snap)throw new Error('The verified contact changed after this draft was created. Create a fresh draft.')
  if(!validHttpUrl(data.source_url)||String(data.source_url)!==String(p.owner_contact_source_url)||String(data.contact_checked_at)!==String(p.owner_contact_checked_at))throw new Error('Contact provenance changed after this draft was created. Create a fresh draft.')
  const suppression=await blocked(s,String(data.prospect_id),String(data.channel),current)
  if(suppression)throw new Error(`Outreach is suppressed${suppression.reason?`: ${suppression.reason}`:''}`)
  return {draft:data as Row,prospect:p as Row,opportunity:o as Row}
}
async function scheduleFollowups(s:any,userId:string,draft:Row){
  const {data:templates,error}=await s.from('skylight_sales_outreach_templates').select('id,sequence_stage,day_offset').eq('tenant_id',TENANT_ID).eq('active',true).eq('channel',draft.channel).in('sequence_stage',['follow_up_1','follow_up_2','last_check_in']).order('day_offset')
  if(error)throw error
  const now=Date.now(),rows=(templates??[]).map((t:any)=>({tenant_id:TENANT_ID,opportunity_id:draft.opportunity_id,prospect_id:draft.prospect_id,campaign_id:draft.campaign_id||null,campaign_member_id:draft.campaign_member_id||null,prior_draft_id:draft.id,template_id:t.id,channel:draft.channel,sequence_stage:t.sequence_stage,due_at:new Date(now+Number(t.day_offset||0)*86400000).toISOString(),status:'open',assigned_user_id:draft.assigned_user_id||null,created_by:userId,notes:'Human follow-up task generated after deliberate outreach. This task never sends automatically.'}))
  let created=0
  for(const row of rows){
    const existing=await s.from('skylight_sales_followups').select('id').eq('opportunity_id',row.opportunity_id).eq('channel',row.channel).eq('sequence_stage',row.sequence_stage).eq('status','open').limit(1)
    if(existing.error)throw existing.error
    if(existing.data?.length)continue
    const inserted=await s.from('skylight_sales_followups').insert(row)
    if(inserted.error)throw inserted.error
    created++
  }
  return created
}

export async function POST(req:Request){
  try{
    const {claims}=await requireStaff('/admin/skylight-sales/outreach'),userId=String(claims.sub),body=await req.json() as Row,action=text(body.action,80),s=await createClient()
    if(action==='create_draft'){const data=await createDraft(s,userId,body);return NextResponse.json({ok:true,data,automatic_outreach:false,billing_authorization:false,public_ranking_effect:false})}
    if(action==='save_draft'){
      const id=text(body.id,40);const {draft}=await recheckDraft(s,id);if(!['draft','approved'].includes(String(draft.status)))throw new Error('Only draft or approved copy can be edited.')
      const patch:any={updated_by:userId,updated_at:new Date().toISOString(),status:'draft',approved_by:null,approved_at:null};if(body.subject!==undefined)patch.subject=text(body.subject,300)||null;if(body.body!==undefined)patch.body=text(body.body,8000);if(!patch.body&&body.body!==undefined)throw new Error('Draft body is required.')
      const {error}=await s.from('skylight_sales_outreach_drafts').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error;return NextResponse.json({ok:true})
    }
    if(action==='approve_draft'){
      const id=text(body.id,40);const {draft}=await recheckDraft(s,id);if(draft.status!=='draft')throw new Error('Only a draft can be approved.')
      const now=new Date().toISOString();const approved=await s.from('skylight_sales_outreach_drafts').update({status:'approved',approved_by:userId,approved_at:now,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',id).eq('status','draft').select('id').single();if(approved.error)throw approved.error
      const logged=await s.from('skylight_sales_outreach_events').insert({tenant_id:TENANT_ID,opportunity_id:draft.opportunity_id,prospect_id:draft.prospect_id,draft_id:id,campaign_id:draft.campaign_id,campaign_member_id:draft.campaign_member_id,actor_user_id:userId,channel:draft.channel,event_type:'draft_approved',notes:'Staff explicitly approved this draft after review.',metadata:{automatic_outreach:false}});if(logged.error)throw logged.error;return NextResponse.json({ok:true})
    }
    if(action==='send_email'){
      const id=text(body.id,40);const {draft,prospect,opportunity}=await recheckDraft(s,id);if(draft.channel!=='email')throw new Error('This send action is only available for email drafts.');if(draft.status!=='approved')throw new Error('Approve this draft explicitly before sending it.')
      const apiKey=process.env.RESEND_API_KEY?.trim()||'',from=process.env.BUSINESS_NOTIFICATION_FROM_EMAIL?.trim()||process.env.LEAD_NOTIFICATION_FROM_EMAIL?.trim()||'',postal=process.env.MARKETING_EMAIL_POSTAL_ADDRESS?.trim()||'';if(!apiKey||!from||!postal)throw new Error('Email delivery is not fully configured. RESEND_API_KEY, sender email, and marketing postal address are required.')
      const to=text(draft.recipient_email,240);if(!emailOk(to))throw new Error('Verified recipient email is invalid.');const unsubscribe=outreachUnsubscribeUrl(String(draft.unsubscribe_token))
      const claimAt=new Date().toISOString();const claim=await s.from('skylight_sales_outreach_drafts').update({status:'sent',sent_by:userId,sent_at:claimAt,provider:'pending',provider_message_id:null,updated_by:userId,updated_at:claimAt}).eq('tenant_id',TENANT_ID).eq('id',id).eq('status','approved').select('id').single();if(claim.error)throw new Error('This approved draft was already claimed for sending or its state changed. Refresh before trying again.')
      let provider:any={}
      try{
        const suppression=await blocked(s,String(draft.prospect_id),'email',to.toLowerCase());if(suppression)throw new Error(`Outreach is suppressed${suppression.reason?`: ${suppression.reason}`:''}`)
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:text(draft.subject,300),html:renderSkylightOutreachEmail({subject:text(draft.subject,300),body:String(draft.body||''),postalAddress:postal,unsubscribeUrl:unsubscribe})})});provider=await response.json().catch(()=>({}));if(!response.ok)throw new Error(String(provider?.message||`Email provider returned ${response.status}.`))
      }catch(e){await s.from('skylight_sales_outreach_drafts').update({status:'approved',sent_by:null,sent_at:null,provider:null,provider_message_id:null,updated_by:userId,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',id).eq('provider','pending');throw e}
      const now=new Date().toISOString(),next=new Date(Date.now()+3*86400000).toISOString();const finalized=await s.from('skylight_sales_outreach_drafts').update({provider:'resend',provider_message_id:text(provider?.id,240)||null,updated_by:userId,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',id).eq('status','sent').eq('provider','pending');if(finalized.error)throw finalized.error
      const [oppUpdate,prospectUpdate]=await Promise.all([s.from('skylight_sales_opportunities').update({stage:'contacted',last_contact_at:now,next_follow_up_at:next,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',draft.opportunity_id),s.from('business_prospects').update({status:prospect.status==='contact_ready'?'contacted':prospect.status,last_contacted_at:now,next_follow_up_at:next,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',draft.prospect_id)]);if(oppUpdate.error)throw oppUpdate.error;if(prospectUpdate.error)throw prospectUpdate.error
      if(draft.campaign_member_id){const memberUpdate=await s.from('skylight_sales_campaign_members').update({status:'contacted',last_action_at:now,next_action_at:next,updated_at:now}).eq('id',draft.campaign_member_id);if(memberUpdate.error)throw memberUpdate.error}
      const followups=await scheduleFollowups(s,userId,{...draft,assigned_user_id:opportunity.assigned_user_id});const logged=await s.from('skylight_sales_outreach_events').insert({tenant_id:TENANT_ID,opportunity_id:draft.opportunity_id,prospect_id:draft.prospect_id,draft_id:id,campaign_id:draft.campaign_id,campaign_member_id:draft.campaign_member_id,actor_user_id:userId,channel:'email',event_type:'sent',notes:'Staff explicitly sent the approved email draft.',metadata:{provider:'resend',provider_message_id:text(provider?.id,240)||null,followups_created:followups,automatic_outreach:false,billing_authorization:false,public_ranking_effect:false}});if(logged.error)throw logged.error;return NextResponse.json({ok:true,sent:true,followups_created:followups})
    }
    if(action==='record_event'){
      const opportunityId=text(body.opportunity_id,40),eventType=text(body.event_type,50),channel=text(body.channel,20);const allowed=['call_attempted','voicemail','connected','reply_positive','reply_neutral','reply_negative','interested','not_interested','do_not_contact','wrong_person','bounced','appointment_booked','note'];if(!allowed.includes(eventType))throw new Error('Unsupported outreach outcome.');const {opportunity,prospect}=await context(s,opportunityId);const now=new Date().toISOString()
      if(eventType==='do_not_contact'){const {error}=await s.from('business_prospects').update({status:'do_not_contact',updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',prospect.id);if(error)throw error}
      else if(eventType==='bounced'||eventType==='wrong_person'){
        const ch=channelOk(channel)?channel:'email',value=suppressionValue(ch,prospect),source=eventType==='bounced'?'bounce':'wrong_person',already=await blocked(s,String(prospect.id),ch,value)
        if(!already){const added=await s.from('skylight_sales_suppressions').insert({tenant_id:TENANT_ID,prospect_id:prospect.id,opportunity_id:opportunity.id,channel:ch,contact_value:value||null,reason:eventType==='bounced'?'Contact channel bounced.':'Contact identified as the wrong person.',source,active:true,created_by:userId});if(added.error)throw added.error}
        if(ch==='email'&&value===text(prospect.owner_contact_email,240).toLowerCase()){const r=await s.from('business_prospects').update({owner_contact_email:null,status:text(prospect.owner_contact_phone,80)?'contact_ready':'research',updated_at:now}).eq('id',prospect.id);if(r.error)throw r.error}
        if((ch==='phone'||ch==='sms')&&value===text(prospect.owner_contact_phone,80)){const r=await s.from('business_prospects').update({owner_contact_phone:null,status:text(prospect.owner_contact_email,240)?'contact_ready':'research',updated_at:now}).eq('id',prospect.id);if(r.error)throw r.error}
        const r=await s.from('skylight_sales_opportunities').update({stage:'research',updated_at:now}).eq('id',opportunity.id);if(r.error)throw r.error
      }else{
        let stage=String(opportunity.stage);if(['call_attempted','voicemail','connected','reply_neutral','reply_negative'].includes(eventType))stage='contacted';if(['reply_positive','interested','appointment_booked'].includes(eventType))stage='qualified';if(eventType==='not_interested')stage='nurture';const patch:any={stage,updated_at:now};if(stage==='contacted')patch.last_contact_at=now;if(eventType==='not_interested')patch.next_follow_up_at=new Date(Date.now()+60*86400000).toISOString();const r=await s.from('skylight_sales_opportunities').update(patch).eq('id',opportunity.id);if(r.error)throw r.error
      }
      const logged=await s.from('skylight_sales_outreach_events').insert({tenant_id:TENANT_ID,opportunity_id:opportunity.id,prospect_id:prospect.id,actor_user_id:userId,channel:channelOk(channel)?channel:null,event_type:eventType,notes:text(body.notes,2400)||null,metadata:{automatic_outreach:false,billing_authorization:false,public_ranking_effect:false}});if(logged.error)throw logged.error;return NextResponse.json({ok:true})
    }
    if(action==='complete_followup'){
      const id=text(body.id,40),now=new Date().toISOString();const {data,error}=await s.from('skylight_sales_followups').update({status:'completed',completed_by:userId,completed_at:now,updated_at:now}).eq('tenant_id',TENANT_ID).eq('id',id).eq('status','open').select('opportunity_id,prospect_id,channel').single();if(error)throw error;const logged=await s.from('skylight_sales_outreach_events').insert({tenant_id:TENANT_ID,opportunity_id:data.opportunity_id,prospect_id:data.prospect_id,actor_user_id:userId,channel:data.channel,event_type:'follow_up_completed',notes:'Staff completed the follow-up task.',metadata:{automatic_outreach:false}});if(logged.error)throw logged.error;return NextResponse.json({ok:true})
    }
    if(action==='save_template'){
      const id=text(body.id,40),name=text(body.name,160),channel=text(body.channel,20),sequence=text(body.sequence_stage,40);if(!name||!channelOk(channel)||!sequence)throw new Error('Template name, channel, and sequence stage are required.');const payload={tenant_id:TENANT_ID,name,service_slug:text(body.service_slug,120)||null,vertical:text(body.vertical,80)||null,channel,sequence_stage:sequence,day_offset:Math.max(0,Math.min(3650,Math.round(Number(body.day_offset)||0))),subject_template:text(body.subject_template,1000)||null,body_template:text(body.body_template,8000),active:body.active!==false,sort_order:Math.max(0,Math.min(9999,Math.round(Number(body.sort_order)||100))),updated_by:userId,updated_at:new Date().toISOString()};if(!payload.body_template)throw new Error('Template body is required.');const q=id?await s.from('skylight_sales_outreach_templates').update(payload).eq('tenant_id',TENANT_ID).eq('id',id).select('*').single():await s.from('skylight_sales_outreach_templates').insert({...payload,created_by:userId}).select('*').single();if(q.error)throw q.error;return NextResponse.json({ok:true,data:q.data})
    }
    if(action==='bulk_prepare_campaign'){
      const campaignId=text(body.campaign_id,40);const {data:members,error}=await s.from('skylight_sales_campaign_members').select('id,opportunity_id,campaign_id,status').eq('campaign_id',campaignId).in('status',['ready','contacted']).not('opportunity_id','is',null).limit(100);if(error)throw error;let created=0,blockedCount=0;for(const m of members??[]){const existing=await s.from('skylight_sales_outreach_drafts').select('id').eq('campaign_member_id',m.id).eq('sequence_stage','first_touch').in('status',['draft','approved','sent']).limit(1);if(existing.error)throw existing.error;if(existing.data?.length)continue;try{await createDraft(s,userId,{opportunity_id:m.opportunity_id,campaign_id:campaignId,campaign_member_id:m.id,channel:'email',sequence_stage:'first_touch'});created++}catch{blockedCount++}}return NextResponse.json({ok:true,drafts_created:created,blocked_or_ineligible:blockedCount,automatic_outreach:false})
    }
    return NextResponse.json({error:'Unsupported Sales 3.4 action.'},{status:400})
  }catch(e:any){return NextResponse.json({error:String(e?.message||'Unable to process Sales 3.4 action.')},{status:400})}
}
