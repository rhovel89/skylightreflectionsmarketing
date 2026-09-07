import { getSiteUrl } from '@/lib/site-url'

export const OUTREACH_CHANNELS=['email','phone','sms','linkedin','social'] as const
export type OutreachChannel=(typeof OUTREACH_CHANNELS)[number]
export const OUTREACH_STAGES=['first_touch','follow_up_1','follow_up_2','last_check_in','nurture','call','custom'] as const

const serviceLabels:Record<string,string>={
  'web-design':'Web Design',seo:'SEO','google-business-profile-optimization':'Google Business Profile Optimization',
  'lead-generation':'Lead Generation','social-media-management':'Social Media Management','social-media-marketing':'Social Media Marketing',
  branding:'Branding','graphic-design':'Graphic Design','eddm-direct-mail':'EDDM & Direct Mail',
}
export const titleCase=(value:unknown)=>String(value??'').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
export const serviceLabel=(slug:unknown)=>serviceLabels[String(slug??'')]||titleCase(slug)||'Marketing Services'
export const text=(value:unknown,max=2400)=>String(value??'').trim().slice(0,max)
export const relation=(value:any)=>Array.isArray(value)?value[0]??null:value??null
export const validHttpUrl=(value:unknown)=>{const x=text(value,1000);try{const u=new URL(x);return u.protocol==='http:'||u.protocol==='https:'}catch{return false}}
export const verifiedContact=(p:any)=>Boolean(
  p&&p.status!=='do_not_contact'&&(text(p.owner_contact_email,240)||text(p.owner_contact_phone,80))&&validHttpUrl(p.owner_contact_source_url)&&p.owner_contact_checked_at,
)
export const evidenceSummary=(flags:unknown)=>{
  const values=Array.isArray(flags)?flags.map(v=>titleCase(v)).filter(Boolean):[]
  return values.length?values.slice(0,5).join(', '):''
}
export function applyPlaceholders(template:string,values:Record<string,string>){
  return String(template||'').replace(/\{\{([a-z0-9_]+)\}\}/gi,(_,key)=>values[key]??'')
}
export function templateValues(opportunity:any,prospect:any){
  const evidence=evidenceSummary(opportunity?.evidence_flags)
  return {
    business_name:text(prospect?.business_name,160)||'your business',
    contact_name:text(prospect?.owner_contact_name,120),
    contact_name_or_team:text(prospect?.owner_contact_name,120)||`${text(prospect?.business_name,160)||'your business'} team`,
    contact_title:text(prospect?.owner_contact_title,120),
    city:text(prospect?.city,120),
    service_name:serviceLabel(opportunity?.primary_service_slug||(opportunity?.recommended_service_slugs||[])[0]),
    evidence_summary:evidence,
    source_url:text(prospect?.owner_contact_source_url,1000),
  }
}
export function suppressionValue(channel:string,prospect:any){
  if(channel==='email')return text(prospect?.owner_contact_email,240).toLowerCase()
  if(channel==='phone'||channel==='sms')return text(prospect?.owner_contact_phone,80)
  return ''
}
export function outreachUnsubscribeUrl(token:string){return `${getSiteUrl()}/skylight-outreach/unsubscribe?token=${encodeURIComponent(token)}`}
const esc=(value:string)=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch))
export function renderSkylightOutreachEmail(input:{subject:string;body:string;postalAddress:string;unsubscribeUrl:string}){
  const paragraphs=esc(input.body).split(/\n{2,}/).map(x=>`<p style="margin:0 0 16px;line-height:1.65;color:#39445a;font-size:15px">${x.replace(/\n/g,'<br>')}</p>`).join('')
  return `<!doctype html><html><head><meta charSet="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f6fb"><div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e6e9f0;border-radius:16px;padding:28px"><div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#5478f6;text-transform:uppercase;margin-bottom:10px">Skylight Reflections Marketing</div><h1 style="font-size:24px;line-height:1.25;color:#172038;margin:0 0 18px">${esc(input.subject)}</h1>${paragraphs}<hr style="border:0;border-top:1px solid #e4e7ec;margin:30px 0 18px"><p style="font-size:11px;line-height:1.55;color:#7b8493;margin:0">${esc(input.postalAddress)} · <a href="${esc(input.unsubscribeUrl)}" style="color:#667085">Stop outreach on this email address</a></p></div></div></body></html>`
}
