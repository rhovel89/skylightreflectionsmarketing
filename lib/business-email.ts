import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'
import { TENANT_ID } from '@/lib/constants'
import { renderBusinessEmailHtml } from '@/lib/business-email-template'

const absolute=(path:string|null|undefined)=>{if(!path)return null;try{return new URL(path,getSiteUrl()).toString()}catch{return null}}

export type EmailProcessResult={configured:boolean;promotionalConfigured:boolean;queued:number;sent:number;failed:number;blockedPromotional:number}

export async function processBusinessEmailOutbox(limit=30):Promise<EmailProcessResult>{
  const apiKey=process.env.RESEND_API_KEY?.trim()||''
  const from=process.env.BUSINESS_NOTIFICATION_FROM_EMAIL?.trim()||process.env.LEAD_NOTIFICATION_FROM_EMAIL?.trim()||''
  const postal=process.env.MARKETING_EMAIL_POSTAL_ADDRESS?.trim()||''
  const result:EmailProcessResult={configured:Boolean(apiKey&&from),promotionalConfigured:Boolean(apiKey&&from&&postal),queued:0,sent:0,failed:0,blockedPromotional:0}
  if(!result.configured)return result
  const s=await createClient()
  const{data:rows,error}=await s.from('email_outbox').select('id,recipient_email,recipient_name,message_type,subject,preheader,body,cta_label,cta_url,enrollment_id,tracking_token,email_drip_enrollments(unsubscribe_token)').eq('tenant_id',TENANT_ID).eq('status','queued').lte('scheduled_for',new Date().toISOString()).order('scheduled_for').limit(Math.max(1,Math.min(100,limit)))
  if(error||!rows)return result
  result.queued=rows.length
  for(const row of rows as any[]){
    if(row.message_type==='drip'&&!postal){result.blockedPromotional++;continue}
    const directCta=absolute(row.cta_url)
    const trackedCta=row.message_type==='drip'&&row.tracking_token&&directCta?absolute(`/email/click?token=${encodeURIComponent(row.tracking_token)}`):directCta
    const trackingPixel=row.message_type==='drip'&&row.tracking_token?absolute(`/email/open?token=${encodeURIComponent(row.tracking_token)}`):null
    const enrollment=Array.isArray(row.email_drip_enrollments)?row.email_drip_enrollments[0]:row.email_drip_enrollments
    const unsubscribe=row.message_type==='drip'&&enrollment?.unsubscribe_token?absolute(`/email/unsubscribe?token=${encodeURIComponent(enrollment.unsubscribe_token)}`):null
    const html=renderBusinessEmailHtml({subject:row.subject,preheader:row.preheader,body:String(row.body||''),ctaLabel:row.cta_label,ctaUrl:trackedCta,kind:row.message_type==='drip'?'drip':'transactional',postalAddress:postal,unsubscribeUrl:unsubscribe,trackingPixelUrl:trackingPixel})
    await s.from('email_outbox').update({status:'sending',updated_at:new Date().toISOString(),error_message:null}).eq('tenant_id',TENANT_ID).eq('id',row.id).eq('status','queued')
    try{
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[row.recipient_email],subject:row.subject,html})})
      const body=await response.json().catch(()=>({})) as any
      if(!response.ok)throw new Error(String(body?.message||`Email provider returned ${response.status}.`))
      await s.from('email_outbox').update({status:'sent',sent_at:new Date().toISOString(),provider_message_id:String(body?.id||'')||null,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',row.id)
      result.sent++
    }catch(e){
      await s.from('email_outbox').update({status:'failed',error_message:e instanceof Error?e.message:'Email delivery failed.',updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',row.id)
      result.failed++
    }
  }
  return result
}
