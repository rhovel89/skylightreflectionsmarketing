export type BusinessEmailTemplateInput={
  subject:string
  preheader?:string|null
  body:string
  ctaLabel?:string|null
  ctaUrl?:string|null
  kind:'transactional'|'drip'
  postalAddress?:string|null
  unsubscribeUrl?:string|null
  trackingPixelUrl?:string|null
}

const esc=(value:string)=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch))
const paragraphs=(value:string)=>value.split(/\n{2,}/).map(x=>`<p style="margin:0 0 16px;line-height:1.65;color:#39445a;font-size:15px">${esc(x).replace(/\n/g,'<br>')}</p>`).join('')

export function renderBusinessEmailHtml(input:BusinessEmailTemplateInput){
  const preheader=String(input.preheader||'').trim()
  const cta=input.ctaUrl&&input.ctaLabel?`<p style="margin:26px 0 8px"><a href="${esc(input.ctaUrl)}" style="display:inline-block;padding:13px 19px;border-radius:9px;background:#5478f6;color:#fff;text-decoration:none;font-weight:700;font-size:14px">${esc(input.ctaLabel)}</a></p>`:''
  const compliance=input.kind==='drip'?`<hr style="border:0;border-top:1px solid #e4e7ec;margin:30px 0 18px"><p style="font-size:11px;line-height:1.55;color:#7b8493;margin:0 0 10px">You received this optional business-growth email because you opted in during your business submission. Sponsored placement does not change organic ranking or verification. Skylight Reflections Marketing does not guarantee Google rankings or leads.</p><p style="font-size:11px;line-height:1.55;color:#7b8493;margin:0">${esc(String(input.postalAddress||'Marketing postal address required before promotional delivery.'))}${input.unsubscribeUrl?` · <a href="${esc(input.unsubscribeUrl)}" style="color:#667085">Unsubscribe</a>`:''}</p>`:''
  const pixel=input.trackingPixelUrl?`<img src="${esc(input.trackingPixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`:''
  return `<!doctype html><html><head><meta charSet="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f6fb"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div><div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:32px 18px"><div style="background:#ffffff;border:1px solid #e6e9f0;border-radius:16px;padding:28px;box-shadow:0 8px 30px rgba(20,35,70,.06)"><div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#5478f6;text-transform:uppercase;margin-bottom:10px">Central Illinois Local Pros</div><h1 style="font-size:26px;line-height:1.22;color:#172038;margin:0 0 18px">${esc(input.subject)}</h1>${paragraphs(String(input.body||''))}${cta}${compliance}${pixel}</div></div></body></html>`
}
