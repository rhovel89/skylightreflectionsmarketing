import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import styles from './HomepagePromoTicker.module.css'

type Promo={id:string;promo_text:string;promo_cta_label?:string|null;promo_url?:string|null;businesses?:{name?:string|null;slug?:string|null}|{name?:string|null;slug?:string|null}[]|null}
const today=()=>new Date().toISOString().slice(0,10)
const businessOf=(p:Promo)=>Array.isArray(p.businesses)?p.businesses[0]:p.businesses
const safeHref=(value?:string|null)=>{const v=String(value??'').trim();if(!v)return'';if(v.startsWith('/'))return v;try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.toString():''}catch{return''}}

export async function HomepagePromoTicker(){
  try{
    const s=await createClient(),d=today()
    const{data,error}=await s.from('sponsorships').select('id,promo_text,promo_cta_label,promo_url,priority,sort_order,businesses!inner(name,slug,status)').eq('tenant_id',TENANT_ID).eq('placement','homepage_ticker').eq('active',true).eq('businesses.status','published').not('promo_text','is',null).or(`starts_on.is.null,starts_on.lte.${d}`).or(`ends_on.is.null,ends_on.gte.${d}`).order('priority',{ascending:false}).order('sort_order',{ascending:true}).limit(20)
    if(error||!data?.length)return null
    const promos=(data as unknown as Promo[]).filter(p=>String(p.promo_text||'').trim())
    if(!promos.length)return null
    const render=(p:Promo,duplicate=false)=>{const b=businessOf(p),href=safeHref(p.promo_url)||(`/business/${b?.slug||''}`),external=/^https?:\/\//i.test(href);const content=<><span className={styles.disclosure}>Sponsored</span><span className={styles.business}>{b?.name||'Local Business'}</span><span className={styles.dot}>◆</span><span className={styles.deal}>{p.promo_text}</span><span className={styles.cta}>{p.promo_cta_label||'View Deal'} →</span></>;return external?<a className={styles.item} href={href} target="_blank" rel="noopener sponsored" key={`${p.id}-${duplicate?'b':'a'}`} data-duplicate={duplicate?'true':undefined}>{content}</a>:<Link className={styles.item} href={href} key={`${p.id}-${duplicate?'b':'a'}`} data-duplicate={duplicate?'true':undefined}>{content}</Link>}
    return <aside className={styles.bar} aria-label="Sponsored local deals and promotions"><div className={styles.inner}><div className={styles.label}>Local Deals</div><div className={styles.viewport}><div className={styles.track}>{promos.map(p=>render(p))}{promos.map(p=>render(p,true))}</div></div></div></aside>
  }catch{return null}
}
