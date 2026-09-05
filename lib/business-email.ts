import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/site-url'
import { TENANT_ID } from '@/lib/constants'

const esc=(value:string)=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch))
const paragraphs=(value:string)=>value.split(/\n{2,}/).map(x=>`<p style="margin:0 0 16px;line-height:1.65;color:#39445a">${esc(x).replace(/\n/g,'<br>')}</p>`).join('')
const absolute=(path:string|null|undefined)=>{if(!path)return null;try{return new URL(path,getSiteUrl()).toString()}catch{return null}}

export type EmailProcessResult={configured:boolean;promotionalConfigured:boolean;queued:number;sent:number;failed:number;blockedPromotional:number}

export async function processBusinessEmailOutbox(limit=30):Promise<EmailProcessResult>{
  const apiKey=process.env.RESEND_API_KEY?.trim()||''
  const from=process.env.BUSINESS_NOTIFICATION_FROM_EMAIL?.trim()||process.env.LEAD_NOTIFICATION_FROM_EMAIL?.trim()||''
  const postal=process.env.MARKETING_EMAIL_POSTAL_ADDRESS?.trim()||''
  const result:EmailProcessResult={configured:Boolean(apiKey&&from),promotionalConfigured:Boolean(apiKey&&from&&postal),queued:0,sent:0,failed:0,blockedPromotional:0}
  if(!result.configured)return result
  const s=await createClient()
  const{data:rows,error}=await s.from('email_outbox').select('id,recipient_email,recipient_name,message_type,subject,body,cta_label,cta_url,enrollment_id,email_drip_enrollments(unsubscribe_token)').eq('tenant_id',TENANT_ID).eq('status','queued').lte('scheduled_for',new Date().toISOString()).order('scheduled_for').limit(Math.max(1,Math.min(100,limit)))
  if(error||!rows)return result
  result.queued=rows.length
  for(const row of rows as any[]){
    if(row.message_type==='drip'&&!postal){result.blockedPromotional++;continue}
    const cta=absolute(row.cta_url)
    const enrollment=Array.isArray(row.email_drip_enrollments)?row.email_drip_enrollments[0]:row.email_drip_enrollments
    const unsubscribe=row.message_type==='drip'&&enrollment?.unsubscribe_token?absolute(`/email/unsubscribe?token=${encodeURIComponent(enrollment.unsubscribe_token)}`):null
    const html=`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px"><div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#5478f6;text-transform:uppercase;margin-bottom:10px">Central Illinois Local Pros</div><h1 style="font-size:26px;line-height:1.2;color:#172038;margin:0 0 18px">${esc(row.subject)}</h1>${paragraphs(String(row.body||''))}${cta&&row.cta_label?`<p style="margin:24px 0"><a href="${esc(cta)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#5478f6;color:#fff;text-decoration:none;font-weight:700">${esc(row.cta_label)}</a></p>`:''}${row.message_type==='drip'?`<hr style="border:0;border-top:1px solid #e4e7ec;margin:28px 0 18px"><p style="font-size:11px;line-height:1.55;color:#7b8493">You received this optional business-growth email because you opted in during your business submission. Sponsored placement does not change organic ranking or verification. Skylight Reflections Marketing does not guarantee Google rankings or leads.</p><p style="font-size:11px;line-height:1.55;color:#7b8493">${esc(postal)}${unsubscribe?` · <a href="${esc(unsubscribe)}">Unsubscribe</a>`:''}</p>`:''}</div>`
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
