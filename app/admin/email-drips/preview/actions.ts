'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { getSiteUrl } from '@/lib/site-url'
import { renderBusinessEmailHtml } from '@/lib/business-email-template'

const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function withUtm(value:string|null,campaign:any){if(!value)return null;try{const url=new URL(value,getSiteUrl());if(campaign?.utm_source)url.searchParams.set('utm_source',campaign.utm_source);if(campaign?.utm_medium)url.searchParams.set('utm_medium',campaign.utm_medium);if(campaign?.utm_campaign||campaign?.slug)url.searchParams.set('utm_campaign',campaign.utm_campaign||campaign.slug);return url.toString()}catch{return value}}
function back(campaignId:string,stepId:string,device:string,statusKey:string,status:string){return `/admin/email-drips/preview?campaign=${encodeURIComponent(campaignId)}&step=${encodeURIComponent(stepId)}&device=${device==='mobile'?'mobile':'desktop'}&${statusKey}=${encodeURIComponent(status)}`}

export async function savePreviewDripStep(fd:FormData){
  await requireAdmin('/admin/email-drips/preview')
  const campaignId=text(fd,'campaign_id'),stepId=text(fd,'step_id'),device=text(fd,'device')==='mobile'?'mobile':'desktop'
  if(!uuid.test(campaignId)||!uuid.test(stepId))redirect('/admin/email-drips/preview?edit=invalid')
  const s=await createClient()
  const{data:campaign}=await s.from('email_drip_campaigns').select('id,status').eq('tenant_id',TENANT_ID).eq('id',campaignId).maybeSingle()
  if(!campaign)redirect(back(campaignId,stepId,device,'edit','missing'))
  if(campaign.status==='live')redirect(back(campaignId,stepId,device,'edit','live'))
  const subject=text(fd,'subject').slice(0,220),body=text(fd,'body').slice(0,8000)
  if(!subject||!body)redirect(back(campaignId,stepId,device,'edit','required'))
  const{error}=await s.from('email_drip_steps').update({delay_days:Math.max(0,Number(text(fd,'delay_days')||0)),subject,preheader:text(fd,'preheader').slice(0,260)||null,body,cta_label:text(fd,'cta_label').slice(0,120)||null,cta_url:text(fd,'cta_url').slice(0,600)||null,is_active:fd.get('is_active')==='on',updated_at:new Date().toISOString()}).eq('campaign_id',campaignId).eq('id',stepId)
  if(error)redirect(back(campaignId,stepId,device,'edit','failed'))
  if(campaign.status==='approved'||campaign.status==='paused')await s.from('email_drip_campaigns').update({status:'draft',approved_by:null,approved_at:null,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',campaignId)
  redirect(back(campaignId,stepId,device,'edit','saved'))
}

export async function sendTestDripEmail(fd:FormData){
  await requireAdmin('/admin/email-drips/preview')
  const campaignId=text(fd,'campaign_id'),stepId=text(fd,'step_id'),device=text(fd,'device')==='mobile'?'mobile':'desktop'
  if(!uuid.test(campaignId)||!uuid.test(stepId))redirect('/admin/email-drips/preview?test=invalid')
  const s=await createClient()
  const[{data:campaign},{data:step},{data:userData}]=await Promise.all([
    s.from('email_drip_campaigns').select('id,name,slug,utm_source,utm_medium,utm_campaign').eq('tenant_id',TENANT_ID).eq('id',campaignId).maybeSingle(),
    s.from('email_drip_steps').select('id,campaign_id,step_order,subject,preheader,body,cta_label,cta_url').eq('campaign_id',campaignId).eq('id',stepId).maybeSingle(),
    s.auth.getUser(),
  ])
  const to=userData?.user?.email?.trim()||''
  if(!campaign||!step||!to)redirect(back(campaignId,stepId,device,'test','invalid'))
  const apiKey=process.env.RESEND_API_KEY?.trim()||''
  const from=process.env.BUSINESS_NOTIFICATION_FROM_EMAIL?.trim()||process.env.LEAD_NOTIFICATION_FROM_EMAIL?.trim()||''
  if(!apiKey||!from)redirect(back(campaignId,stepId,device,'test','blocked'))
  const postal=process.env.MARKETING_EMAIL_POSTAL_ADDRESS?.trim()||'Marketing postal address is not configured yet.'
  const cta=withUtm(step.cta_url,campaign)
  const html=renderBusinessEmailHtml({subject:step.subject,preheader:step.preheader,body:step.body,ctaLabel:step.cta_label,ctaUrl:cta,kind:'drip',postalAddress:postal,unsubscribeUrl:'#unsubscribe-preview'})
  let sent=false
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:`[TEST] ${step.subject}`,html})})
    const result=await response.json().catch(()=>({})) as any
    if(!response.ok)throw new Error(String(result?.message||response.status))
    sent=true
  }catch{sent=false}
  redirect(back(campaignId,stepId,device,'test',sent?'sent':'failed'))
}
