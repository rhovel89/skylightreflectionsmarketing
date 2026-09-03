'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const slugify=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)
const safeStatus=(value:string)=>['draft','pending','published'].includes(value)?value:'draft'
const safeLocationType=(value:string)=>['office','storefront','restaurant','shop','service_center'].includes(value)?value:'office'

export async function createBusiness(fd:FormData){
  const {claims}=await requireAdmin('/admin/businesses')
  const s=await createClient()
  const name=text(fd,'name').slice(0,180)
  if(!name)throw new Error('Business name is required.')
  const slug=slugify(text(fd,'slug')||name)
  if(!slug)throw new Error('A valid URL slug is required.')
  const primaryCategoryId=text(fd,'primary_category_id')
  const categoryIds=[...new Set([primaryCategoryId,...fd.getAll('category_ids').map(v=>String(v).trim())].filter(Boolean))]
  if(!categoryIds.length)throw new Error('Choose at least one category.')
  const {data:categoryRows,error:categoryError}=await s.from('categories').select('id,vertical').eq('tenant_id',TENANT_ID).eq('is_active',true).in('id',categoryIds)
  if(categoryError||!categoryRows||categoryRows.length!==categoryIds.length)throw new Error('One or more selected categories are invalid.')

  const hasPhysical=fd.get('has_physical_location')==='on'
  const locationId=text(fd,'location_id')
  let location:any=null
  if(hasPhysical){
    if(!locationId)throw new Error('Choose the market that contains the real physical location.')
    const {data,error}=await s.from('locations').select('id,name,state').eq('tenant_id',TENANT_ID).eq('id',locationId).eq('is_active',true).maybeSingle()
    if(error||!data)throw new Error('The selected physical-location market is invalid.')
    location=data
    if(!text(fd,'address_text'))throw new Error('A real street address is required when adding a physical location.')
  }

  const status=safeStatus(text(fd,'status'))
  const sourceName=text(fd,'source_name').slice(0,160)||null
  const sourceUrl=text(fd,'source_url').slice(0,600)||null
  const now=new Date().toISOString()
  const record={
    tenant_id:TENANT_ID,
    slug,
    name,
    abbr:name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase().slice(0,3)||null,
    primary_location_id:hasPhysical?location.id:null,
    phone:text(fd,'phone').slice(0,60)||null,
    email:text(fd,'email').slice(0,180)||null,
    website:text(fd,'website').slice(0,600)||null,
    description:text(fd,'description').slice(0,2400)||null,
    hours:text(fd,'hours').slice(0,500)||null,
    price_range:text(fd,'price_range').slice(0,80)||null,
    menu_url:text(fd,'menu_url').slice(0,600)||null,
    ordering_url:text(fd,'ordering_url').slice(0,600)||null,
    reservation_url:text(fd,'reservation_url').slice(0,600)||null,
    address_text:hasPhysical?text(fd,'address_text').slice(0,500):null,
    source_name:sourceName,
    source_url:sourceUrl,
    source_checked_at:sourceName||sourceUrl?now:null,
    rating:0,
    review_count:0,
    verified:false,
    featured:false,
    claimed:false,
    profile_score:0,
    status,
    published_at:status==='published'?now:null,
    attributes:{},
  }
  const {data:business,error:businessError}=await s.from('businesses').insert(record).select('id,slug').single()
  if(businessError||!business)throw new Error(businessError?.message||'Unable to create business.')

  const cleanup=async()=>{await s.from('businesses').delete().eq('tenant_id',TENANT_ID).eq('id',business.id)}
  const {error:linkError}=await s.from('business_categories').insert(categoryIds.map(id=>({business_id:business.id,category_id:id,is_primary:id===primaryCategoryId})))
  if(linkError){await cleanup();throw new Error(`Business category setup failed: ${linkError.message}`)}

  if(hasPhysical){
    const city=text(fd,'physical_city').slice(0,120)||String(location.name)
    const {error:branchError}=await s.from('business_locations').insert({
      tenant_id:TENANT_ID,
      business_id:business.id,
      location_id:location.id,
      label:text(fd,'location_label').slice(0,120)||'Primary Location',
      location_type:safeLocationType(text(fd,'location_type')),
      is_primary:true,
      is_active:true,
      verified:false,
      address_text:text(fd,'address_text').slice(0,500),
      city,
      state:text(fd,'state').slice(0,30)||location.state||'IL',
      postal_code:text(fd,'postal_code').slice(0,20)||null,
      phone:text(fd,'phone').slice(0,60)||null,
      email:text(fd,'email').slice(0,180)||null,
      source_name:sourceName,
      source_url:sourceUrl,
      source_checked_at:sourceName||sourceUrl?now:null,
    })
    if(branchError){await cleanup();throw new Error(`Physical location setup failed: ${branchError.message}`)}
  }

  await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'admin_business_created',action_text:`Created ${status} business ${business.id} (${name}); claimed=false; verified=false; sponsored=false`})
  revalidatePath('/admin/businesses')
  revalidatePath('/')
  revalidatePath('/search')
  if(status==='published')revalidatePath(`/business/${business.slug}`)
  redirect(`/admin/business-media?business=${business.id}&created=1`)
}
