import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { BusinessVisibilityWorkbench } from '@/components/BusinessVisibilityWorkbench'

export const dynamic='force-dynamic'
export const metadata={title:'Business Visibility Intelligence | Central Illinois Local Pros',robots:{index:false,follow:false}}
type Row=Record<string,any>

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params,s=await createClient()
  const businessResult=await s.from('businesses').select('id,name,website,rating,review_count,address_text,source_name,source_url,source_checked_at').eq('tenant_id',TENANT_ID).eq('id',id).maybeSingle()
  if(businessResult.error||!businessResult.data)notFound()
  const business=businessResult.data as Row

  const [auditsResult,targetsResult,rankingsResult,prospectResult,categoryLinksResult,branchesResult]=await Promise.all([
    s.from('business_visibility_audits').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('checked_at',{ascending:false}).limit(50),
    s.from('business_visibility_keyword_targets').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).eq('active',true).order('updated_at',{ascending:false}).limit(100),
    s.from('business_visibility_rankings').select('*').eq('tenant_id',TENANT_ID).eq('business_id',id).order('checked_at',{ascending:false}).limit(300),
    s.from('business_prospects').select('id,category,city').eq('tenant_id',TENANT_ID).eq('business_id',id).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    s.from('business_categories').select('category_id,is_primary').eq('business_id',id),
    s.from('business_locations').select('city,state,is_primary,is_active').eq('tenant_id',TENANT_ID).eq('business_id',id).eq('is_active',true).order('is_primary',{ascending:false}).limit(25),
  ])
  const errors=[auditsResult.error,targetsResult.error,rankingsResult.error,prospectResult.error,categoryLinksResult.error,branchesResult.error].filter(Boolean)
  const categoryIds=(categoryLinksResult.data||[]).map((r:any)=>String(r.category_id)).filter(Boolean)
  const categoriesResult=categoryIds.length?await s.from('categories').select('id,name').eq('tenant_id',TENANT_ID).in('id',categoryIds):{data:[],error:null}
  if(categoriesResult.error)errors.push(categoriesResult.error)
  const categories=(categoriesResult.data||[]) as Row[],branches=(branchesResult.data||[]) as Row[],prospect=(prospectResult.data||null) as Row|null
  const primaryBranch=branches.find(r=>r.is_primary)||branches[0]
  const location=primaryBranch?.city?`${primaryBranch.city}${primaryBranch.state?`, ${primaryBranch.state}`:''}`:(prospect?.city?`${prospect.city}, IL`:'Central Illinois')
  const categoryNames=[...new Set([...categories.map(r=>String(r.name||'').trim()),String(prospect?.category||'').trim()].filter(Boolean))]
  const suggested=[...new Set(categoryNames.flatMap(name=>[name,`${name} near me`,location!=='Central Illinois'?`${name} ${location}`:'']).filter(Boolean))].slice(0,24)

  return <>
    {errors.length?<div className="notice warn">Some visibility records could not be loaded completely. Missing values are shown as “Not measured” rather than zero.</div>:null}
    <BusinessVisibilityWorkbench
      business={{id:String(business.id),name:String(business.name),website:business.website||null,rating:business.rating??null,review_count:business.review_count??null,source_name:business.source_name||null,source_url:business.source_url||null,source_checked_at:business.source_checked_at||null}}
      audits={(auditsResult.data||[]) as Row[]}
      targets={(targetsResult.data||[]) as Row[]}
      rankings={(rankingsResult.data||[]) as Row[]}
      suggestedKeywords={suggested}
      defaultLocation={location}
      brightLocalConfigured={Boolean(process.env.BRIGHTLOCAL_API_KEY)}
      pageSpeedConfigured={Boolean(process.env.GOOGLE_PAGESPEED_API_KEY)}
    />
  </>
}
