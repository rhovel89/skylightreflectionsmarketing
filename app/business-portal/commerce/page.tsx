import Link from'next/link'
import{getOwnerData}from'@/lib/owner'
import{OwnerCommerceManager}from'@/components/OwnerCommerceManager'

type SearchValue=string|string[]|undefined
const one=(v:SearchValue)=>Array.isArray(v)?v[0]||'':v||''
export default async function Page({searchParams}:{searchParams:Promise<Record<string,SearchValue>>}){const sp=await searchParams,{s,businesses}=await getOwnerData('/business-portal/commerce');const requested=one(sp.business),business=businesses.find((b:any)=>String(b.id)===requested)||businesses[0];if(!business)return <div className="empty empty-rich"><h2>No claimed business is connected yet</h2><p>Claim a listing before using Local Commerce tools.</p><Link className="btn btn-primary" href="/claim">Claim a Business</Link></div>;const[ent,deals,catalog,portfolio,questions,code,referrals]=await Promise.all([
 s.rpc('get_public_business_media_entitlements',{p_business_id:business.id}),
 s.from('business_deals').select('*').eq('business_id',business.id).order('created_at',{ascending:false}).limit(50),
 s.from('business_catalog_items').select('*').eq('business_id',business.id).order('sort_order').limit(100),
 s.from('business_portfolio_projects').select('*').eq('business_id',business.id).order('created_at',{ascending:false}).limit(50),
 s.from('local_pro_questions').select('*').eq('business_id',business.id).order('created_at',{ascending:false}).limit(50),
 s.from('business_referral_codes').select('code').eq('business_id',business.id).maybeSingle(),
 s.from('business_referrals').select('id,status,credit_value_cents,referred_business_id,created_at').eq('referrer_business_id',business.id).order('created_at',{ascending:false}).limit(50),
]);const access=(ent.data&&typeof ent.data==='object'?ent.data:{})as any,planSlug=String(access.plan_slug||'free');return <><div className="admin-row-actions" style={{marginBottom:14}}>{businesses.map((b:any)=><Link className={`btn btn-small ${b.id===business.id?'btn-primary':'btn-light'}`} href={`/business-portal/commerce?business=${b.id}`} key={b.id}>{b.name}</Link>)}</div><OwnerCommerceManager business={business as any} planSlug={planSlug} deals={(deals.data??[])as any[]} catalog={(catalog.data??[])as any[]} portfolio={(portfolio.data??[])as any[]} questions={(questions.data??[])as any[]} referralCode={String((code.data as any)?.code||'')} referrals={(referrals.data??[])as any[]}/></>}
