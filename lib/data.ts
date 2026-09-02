import { createClient } from '@/lib/supabase/server'
import { DEFAULT_BRAND, TENANT_ID, TENANT_SLUG } from '@/lib/constants'
import type { Business, Category, Location, PublicConfig, SiteSettings } from '@/lib/types'

const today=()=>new Date().toISOString().slice(0,10)
async function activeSponsorships(s:any,businessIds:string[]){if(!businessIds.length)return[];const d=today();const{data}=await s.from('sponsorships').select('business_id,market_location_id,category_id,placement,page_path,priority,sort_order,origin,starts_on,ends_on').in('business_id',businessIds).eq('active',true).or(`starts_on.is.null,starts_on.lte.${d}`).or(`ends_on.is.null,ends_on.gte.${d}`);return data??[]}

export async function getPublicConfig(): Promise<PublicConfig> { try { const supabase=await createClient(); const { data, error }=await supabase.rpc('get_directory_public_config',{p_tenant_slug:TENANT_SLUG}); if(error||!data)throw error; return data as PublicConfig } catch { return { site: DEFAULT_BRAND } } }
export async function getSite(): Promise<SiteSettings> { const c=await getPublicConfig(); return { ...DEFAULT_BRAND, ...(c.site ?? {}) } }
export async function getCategories(vertical?: string): Promise<Category[]> { try { const s=await createClient(); let q=s.from('categories').select('id,vertical,slug,name,is_active').eq('tenant_id',TENANT_ID).eq('is_active',true).order('name'); if(vertical)q=q.eq('vertical',vertical); const {data}=await q; return (data??[]) as Category[] } catch { return [] } }
export async function getLocations(): Promise<Location[]> { try { const s=await createClient(); const {data}=await s.from('locations').select('id,slug,name,county,state,region,is_active').eq('tenant_id',TENANT_ID).eq('is_active',true).order('name'); return (data??[]) as Location[] } catch { return [] } }
export async function getBusinesses(opts:{vertical?:string;city?:string;category?:string;q?:string;limit?:number}={}):Promise<Business[]> {
  try {
    const s=await createClient(); const limit=opts.limit??100
    let cityBusinessIds:string[]|undefined
    const matchedBranches=new Map<string,{address_text?:string|null;city?:string|null;state?:string|null;postal_code?:string|null;phone?:string|null;is_primary?:boolean|null}>()
    if(opts.city){const{data:loc}=await s.from('locations').select('id').eq('tenant_id',TENANT_ID).eq('slug',opts.city).eq('is_active',true).maybeSingle();if(!loc)return[];const{data:branchRows,error:branchError}=await s.from('business_locations').select('business_id,address_text,city,state,postal_code,phone,is_primary').eq('tenant_id',TENANT_ID).eq('location_id',loc.id).eq('is_active',true);if(branchError)return[];for(const row of branchRows??[]){if(!matchedBranches.has(row.business_id)||row.is_primary)matchedBranches.set(row.business_id,row)}cityBusinessIds=[...matchedBranches.keys()];if(!cityBusinessIds.length)return[]}
    if(opts.category){const{data:cat}=await s.from('categories').select('id').eq('tenant_id',TENANT_ID).eq('slug',opts.category).eq('is_active',true).maybeSingle();if(!cat)return[]}
    let query=s.from('businesses').select('id,slug,name,abbr,phone,email,website,description,hours,rating,review_count,verified,claimed,profile_score,status,price_range,menu_url,ordering_url,reservation_url,attributes,address_text,source_name,source_url,primary_location_id,business_categories!inner(categories!inner(vertical,slug,name)),locations!businesses_primary_location_id_fkey(name,slug)').eq('tenant_id',TENANT_ID).eq('status','published').limit(limit)
    if(opts.vertical)query=query.eq('business_categories.categories.vertical',opts.vertical);if(opts.category)query=query.eq('business_categories.categories.slug',opts.category);if(cityBusinessIds)query=query.in('id',cityBusinessIds);if(opts.q?.trim())query=query.ilike('name',`%${opts.q.trim()}%`)
    const{data,error}=await query.order('verified',{ascending:false}).order('profile_score',{ascending:false}).order('name');if(error)return[]
    const rows=(data??[]) as unknown as Business[]
    return rows.map(b=>Object.assign({},b,opts.city?{matched_location:matchedBranches.get(b.id)}:{}))
  } catch { return [] }
}

export async function getFeaturedSidebarBusinesses(opts:{city?:string;category?:string;pagePath?:string;placement?:string;limit?:number}={}):Promise<any[]>{
  try{
    const s=await createClient(),d=today(),limit=Math.max(1,Math.min(4,opts.limit??4))
    let locationId:string|undefined,categoryId:string|undefined
    if(opts.city){const{data}=await s.from('locations').select('id').eq('tenant_id',TENANT_ID).eq('slug',opts.city).eq('is_active',true).maybeSingle();locationId=data?.id}
    if(opts.category){const{data}=await s.from('categories').select('id').eq('tenant_id',TENANT_ID).eq('slug',opts.category).eq('is_active',true).maybeSingle();categoryId=data?.id}
    const{data:placements,error}=await s.from('sponsorships').select('id,business_id,market_location_id,category_id,placement,page_path,priority,sort_order,origin,rotation_weight,created_at').eq('tenant_id',TENANT_ID).eq('active',true).or(`starts_on.is.null,starts_on.lte.${d}`).or(`ends_on.is.null,ends_on.gte.${d}`).limit(250)
    if(error||!placements?.length)return[]
    const matches=(placements as any[]).filter(p=>{
      if(p.placement==='page_sidebar')return Boolean(opts.pagePath&&p.page_path===opts.pagePath)
      if(p.placement==='market_sidebar')return Boolean(locationId&&categoryId&&p.market_location_id===locationId&&p.category_id===categoryId)
      if(p.placement==='city_sidebar'||p.placement==='city')return Boolean(locationId&&p.market_location_id===locationId)
      if(p.placement==='category_sidebar'||p.placement==='category')return Boolean(categoryId&&p.category_id===categoryId)
      if(p.placement==='global_sidebar'||p.placement==='sitewide')return true
      if(p.placement==='search')return opts.pagePath==='/search'
      return Boolean(opts.placement&&p.placement===opts.placement)
    })
    if(!matches.length)return[]
    const byPriority=new Map<number,any[]>();for(const p of matches){const priority=Number(p.priority??100);if(!byPriority.has(priority))byPriority.set(priority,[]);byPriority.get(priority)!.push(p)}
    const day=Math.floor(Date.now()/86400000),ordered:any[]=[]
    for(const priority of [...byPriority.keys()].sort((a,b)=>b-a)){const group=byPriority.get(priority)!.sort((a,b)=>Number(a.sort_order??100)-Number(b.sort_order??100)||String(a.id).localeCompare(String(b.id)));if(group.length>1){const offset=day%group.length;ordered.push(...group.slice(offset),...group.slice(0,offset))}else ordered.push(...group)}
    const chosen:any[]=[];const seen=new Set<string>();for(const p of ordered){if(seen.has(p.business_id))continue;seen.add(p.business_id);chosen.push(p);if(chosen.length>=limit)break}
    const ids=chosen.map(x=>x.business_id);if(!ids.length)return[]
    const{data:rows,error:businessError}=await s.from('businesses').select('id,slug,name,abbr,phone,website,description,status,business_categories(categories(name,slug)),locations!businesses_primary_location_id_fkey(name,slug)').eq('tenant_id',TENANT_ID).eq('status','published').in('id',ids)
    if(businessError)return[]
    const byId=new Map((rows??[]).map((b:any)=>[b.id,b]))
    return chosen.map(p=>{const b:any=byId.get(p.business_id);if(!b)return null;const cats=(b.business_categories??[]).map((x:any)=>x.categories?.name).filter(Boolean);const loc=Array.isArray(b.locations)?b.locations[0]:b.locations;return {...b,is_sponsored:true,sponsored_category:cats[0]||null,sponsored_city:loc?.name||null,sponsorship_placement:p.placement,sponsorship_id:p.id}}).filter(Boolean)
  }catch{return[]}
}

export async function getHomepageFeaturedBusinesses(limit=6):Promise<Business[]>{try{const s=await createClient(),d=today();const{data:placements,error}=await s.from('sponsorships').select('business_id,priority,sort_order,created_at').eq('tenant_id',TENANT_ID).eq('placement','homepage_featured').eq('active',true).or(`starts_on.is.null,starts_on.lte.${d}`).or(`ends_on.is.null,ends_on.gte.${d}`).order('priority',{ascending:false}).order('sort_order',{ascending:true}).order('created_at',{ascending:false}).limit(Math.max(1,Math.min(12,limit)));if(error||!placements?.length)return[];const ids=placements.map((x:any)=>x.business_id);const{data:rows,error:businessError}=await s.from('businesses').select('id,slug,name,abbr,phone,email,website,description,hours,rating,review_count,verified,claimed,profile_score,status,price_range,menu_url,ordering_url,reservation_url,attributes,address_text,source_name,source_url,primary_location_id,business_categories(categories(vertical,slug,name)),locations!businesses_primary_location_id_fkey(name,slug)').eq('tenant_id',TENANT_ID).eq('status','published').in('id',ids);if(businessError)return[];const byId=new Map((rows??[]).map((b:any)=>[b.id,b]));return ids.map(id=>byId.get(id)).filter(Boolean).map((b:any)=>Object.assign({},b,{is_sponsored:true})) as Business[]}catch{return[]}}
export async function getBusiness(slug:string) { try { const s=await createClient(); const {data}=await s.from('businesses').select('*,business_categories(categories(id,vertical,slug,name)),business_locations(*),business_service_areas(locations(id,name,slug,county,state))').eq('tenant_id',TENANT_ID).eq('slug',slug).eq('status','published').maybeSingle();if(!data)return null;const[sponsors,mediaResult]=await Promise.all([activeSponsorships(s,[data.id]),s.from('business_media').select('id,storage_path,media_type,alt_text,caption,sort_order').eq('tenant_id',TENANT_ID).eq('business_id',data.id).eq('status','active').eq('approval_status','approved').order('sort_order').order('created_at')]);const media=(mediaResult.data??[]).map((m:any)=>({...m,url:s.storage.from('business-media').getPublicUrl(m.storage_path).data.publicUrl}));return Object.assign({},data,{is_sponsored:sponsors.some((x:any)=>x.placement==='business_profile_sidebar'||x.placement==='page_sidebar'),business_media:media}) } catch { return null } }
export async function getGuide(slug:string) { try { const s=await createClient(); const {data}=await s.from('guides').select('*').eq('tenant_id',TENANT_ID).eq('slug',slug).eq('status','published').maybeSingle(); return data } catch{return null} }
export async function getGuides(limit=30) { try {const s=await createClient();const{data}=await s.from('guides').select('id,slug,title,type,city,category,summary,published_at').eq('tenant_id',TENANT_ID).eq('status','published').order('published_at',{ascending:false}).limit(limit);return data??[]}catch{return[]} }
export async function getSeoPage(city:string,category?:string) { try { const s=await createClient(); let q=s.from('seo_pages').select('*').eq('tenant_id',TENANT_ID).eq('city',city).eq('reviewed',true); q=category?q.eq('category',category):q.is('category',null); const {data}=await q.maybeSingle(); return data } catch{return null} }
export async function recordListingEvents(businessIds:string[],eventType:'impression'|'profile_view'|'phone_click'|'website_click'|'directions_click'){try{const ids=[...new Set(businessIds.filter(Boolean))].slice(0,150);if(!ids.length)return;const s=await createClient();await s.from('listing_events').insert(ids.map(business_id=>({tenant_id:TENANT_ID,business_id,event_type:eventType,source:'directory_public'})))}catch{}}
export async function recordSearchEvent(service:string|undefined,location:string|undefined,resultCount:number){try{if(!service&&!location)return;const s=await createClient();await s.from('search_events').insert({tenant_id:TENANT_ID,service:(service||'').slice(0,200)||null,location:(location||'').slice(0,200)||null,result_count:Math.max(0,Math.min(1000,resultCount)),source:'directory_search'})}catch{}}
