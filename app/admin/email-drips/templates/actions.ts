'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const slugify=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)
const refresh=()=>{revalidatePath('/admin/email-drips/templates');revalidatePath('/admin/email-drips')}
const validCta=(value:string)=>!value||value.startsWith('/')||/^https?:\/\//i.test(value)

export async function createCampaignFromTemplate(fd:FormData){
  const{claims}=await requireAdmin('/admin/email-drips/templates')
  const templateId=text(fd,'template_id')
  if(!uuid.test(templateId))throw new Error('Choose a valid email template.')
  const s=await createClient()
  const{data:template,error}=await s.from('email_template_library').select('id,slug,name,delivery_class,audience,trigger_event,campaign_goal,conversion_goal,audience_rules,purpose,send_hour,utm_source,utm_medium,utm_campaign,steps,can_create_campaign,is_active,updated_at').eq('tenant_id',TENANT_ID).eq('id',templateId).maybeSingle()
  if(error||!template)throw new Error(error?.message||'Email template not found.')
  if(template.delivery_class!=='promotional'||!template.can_create_campaign)throw new Error('This lifecycle template is not installed through the promotional drip engine.')
  if(!template.is_active)throw new Error('Activate this template before creating a campaign from it.')
  const rawSteps=Array.isArray(template.steps)?template.steps:[]
  const steps=rawSteps.filter((step:any)=>step&&Number(step.step_order)>0&&String(step.subject||'').trim()&&String(step.body||'').trim())
  if(!steps.length)throw new Error('This template needs at least one valid email step.')

  const baseSlug=slugify(String(template.utm_campaign||template.slug).replace(/-template$/,''))||`campaign-${Date.now()}`
  const{data:existing}=await s.from('email_drip_campaigns').select('id').eq('tenant_id',TENANT_ID).eq('slug',baseSlug).maybeSingle()
  const slug=existing?`${baseSlug}-${Date.now().toString().slice(-6)}`:baseSlug
  const name=existing?`${template.name} Copy`:template.name
  const{data:campaign,error:campaignError}=await s.from('email_drip_campaigns').insert({
    tenant_id:TENANT_ID,
    name,
    slug,
    audience:template.audience,
    audience_rules:template.audience_rules||{},
    trigger_event:template.trigger_event,
    status:'draft',
    purpose:template.purpose,
    created_by:String(claims.sub),
    start_at:null,
    send_timezone:'America/Chicago',
    send_hour:Number(template.send_hour||10),
    campaign_goal:template.campaign_goal,
    conversion_goal:template.conversion_goal,
    utm_source:template.utm_source||'central_il_local_pros',
    utm_medium:template.utm_medium||'email',
    utm_campaign:template.utm_campaign||baseSlug,
    source_template_id:template.id,
    source_template_version_at:template.updated_at,
  }).select('id').single()
  if(campaignError||!campaign)throw new Error(campaignError?.message||'Unable to create the draft campaign.')

  const rows=steps.map((step:any)=>({
    campaign_id:campaign.id,
    step_order:Math.max(1,Number(step.step_order)),
    delay_days:Math.max(0,Number(step.delay_days||0)),
    subject:String(step.subject).trim().slice(0,220),
    preheader:String(step.preheader||'').trim().slice(0,260)||null,
    body:String(step.body).trim().slice(0,8000),
    cta_label:String(step.cta_label||'').trim().slice(0,120)||null,
    cta_url:String(step.cta_url||'').trim().slice(0,600)||null,
    is_active:step.is_active!==false,
  }))
  const{error:stepError}=await s.from('email_drip_steps').insert(rows)
  if(stepError){await s.from('email_drip_campaigns').delete().eq('tenant_id',TENANT_ID).eq('id',campaign.id);throw new Error(stepError.message)}
  refresh()
  redirect(`/admin/email-drips?template=created&campaign=${encodeURIComponent(campaign.id)}`)
}

export async function saveTemplateMeta(fd:FormData){
  await requireAdmin('/admin/email-drips/templates')
  const id=text(fd,'template_id')
  if(!uuid.test(id))throw new Error('Invalid template.')
  const name=text(fd,'name').slice(0,180)
  if(!name)throw new Error('Template name is required.')
  const s=await createClient()
  const{error}=await s.from('email_template_library').update({
    name,
    purpose:text(fd,'purpose').slice(0,1600)||null,
    compliance_note:text(fd,'compliance_note').slice(0,1600)||null,
    is_active:fd.get('is_active')==='on',
    updated_at:new Date().toISOString(),
  }).eq('tenant_id',TENANT_ID).eq('id',id)
  if(error)throw new Error(error.message)
  refresh()
}

export async function saveTemplateStep(fd:FormData){
  await requireAdmin('/admin/email-drips/templates')
  const templateId=text(fd,'template_id')
  const stepOrder=Math.max(1,Number(text(fd,'step_order')||1))
  if(!uuid.test(templateId)||!Number.isFinite(stepOrder))throw new Error('Invalid template step.')
  const subject=text(fd,'subject').slice(0,220),body=text(fd,'body').slice(0,8000),ctaUrl=text(fd,'cta_url').slice(0,600)
  if(!subject||!body)throw new Error('Subject and email body are required.')
  if(!validCta(ctaUrl))throw new Error('CTA URL must be a site path or an http/https URL.')
  const s=await createClient()
  const{data:template,error}=await s.from('email_template_library').select('steps').eq('tenant_id',TENANT_ID).eq('id',templateId).maybeSingle()
  if(error||!template)throw new Error(error?.message||'Email template not found.')
  const steps=Array.isArray(template.steps)?[...template.steps]:[]
  const index=steps.findIndex((step:any)=>Number(step?.step_order)===stepOrder)
  if(index<0)throw new Error('Template step not found.')
  steps[index]={
    ...steps[index],
    step_order:stepOrder,
    delay_days:Math.max(0,Number(text(fd,'delay_days')||0)),
    subject,
    preheader:text(fd,'preheader').slice(0,260)||null,
    body,
    cta_label:text(fd,'cta_label').slice(0,120)||null,
    cta_url:ctaUrl||null,
    is_active:fd.get('is_active')==='on',
  }
  const{error:updateError}=await s.from('email_template_library').update({steps,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',templateId)
  if(updateError)throw new Error(updateError.message)
  refresh()
}
