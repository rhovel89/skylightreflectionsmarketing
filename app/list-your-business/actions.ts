'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'

const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp'])
const MENU_TYPES=new Set([...IMAGE_TYPES,'application/pdf'])
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function safeUrl(value:string){if(!value)return null;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.toString():null}catch{return null}}
function fileExt(file:File){return file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'}

export async function submitBusinessOnboarding(fd:FormData){
  if(text(fd,'cilp_form_guard'))redirect('/list-your-business?blocked=1')
  const s=await createClient()
  const submissionId=crypto.randomUUID()
  if(!uuid.test(submissionId))throw new Error('Unable to initialize the business submission.')

  const businessName=text(fd,'business_name').slice(0,200)
  const phone=text(fd,'phone').slice(0,40)
  const email=text(fd,'email').toLowerCase().slice(0,180)
  const operatingModel=text(fd,'operating_model')
  const consent=fd.get('consent')==='on'
  if(businessName.length<2||phone.length<7||!email.includes('@'))throw new Error('Business name, phone number and email are required.')
  if(!['online','storefront','both'].includes(operatingModel))throw new Error('Choose whether the business is online, storefront, or both.')
  if(!consent)throw new Error('Please confirm that we may contact you about this submission.')

  const category=text(fd,'category').slice(0,120)
  const city=text(fd,'city').slice(0,120)
  let categoryRow:any=null
  if(category){const{data,error}=await s.from('categories').select('id,name,vertical').eq('tenant_id',TENANT_ID).eq('is_active',true).eq('name',category).maybeSingle();if(error||!data)throw new Error('Please choose a valid directory category.');categoryRow=data}
  if(city){const{data,error}=await s.from('locations').select('id,name').eq('tenant_id',TENANT_ID).eq('is_active',true).in('type',['city','town']).eq('name',city).maybeSingle();if(error||!data)throw new Error('Please choose a valid directory city or town.')}

  const website=safeUrl(text(fd,'website'))
  const menuUrl=safeUrl(text(fd,'menu_url'))
  const orderingUrl=safeUrl(text(fd,'ordering_url'))
  const reservationUrl=safeUrl(text(fd,'reservation_url'))
  const description=text(fd,'description').slice(0,2400)
  const serviceAreas=text(fd,'service_areas').split(',').map(x=>x.trim()).filter(Boolean).slice(0,30)
  const socialLinks={facebook:safeUrl(text(fd,'facebook')),instagram:safeUrl(text(fd,'instagram')),linkedin:safeUrl(text(fd,'linkedin')),youtube:safeUrl(text(fd,'youtube')),tiktok:safeUrl(text(fd,'tiktok'))}
  const services=text(fd,'services').split(/\n|,/).map(x=>x.trim()).filter(Boolean).slice(0,30)
  const profileData={social_links:socialLinks,services,online_only:operatingModel==='online'}
  const payload={id:submissionId,tenant_id:TENANT_ID,business_name:businessName,category:category||null,city:city||null,phone,email,contact_name:text(fd,'contact_name').slice(0,120)||null,website,description:description||null,status:'pending',service_areas:serviceAreas,consent_to_contact:true,source:'public_site',operating_model:operatingModel,address_text:operatingModel==='online'?null:text(fd,'address_text').slice(0,500)||null,state:operatingModel==='online'?null:text(fd,'state').slice(0,30)||'IL',postal_code:operatingModel==='online'?null:text(fd,'postal_code').slice(0,20)||null,hours:text(fd,'hours').slice(0,500)||null,price_range:text(fd,'price_range').slice(0,80)||null,menu_url:menuUrl,ordering_url:orderingUrl,reservation_url:reservationUrl,profile_data:profileData,marketing_opt_in:fd.get('marketing_opt_in')==='on',completed_at:new Date().toISOString()}
  const{error:insertError}=await s.from('business_submissions').insert(payload)
  if(insertError){if(insertError.code==='23505')throw new Error('A matching business submission is already waiting for review.');throw new Error(insertError.message)}

  const restaurant=categoryRow?.vertical==='restaurant'
  const staged:Array<{file:File;mediaType:'logo'|'cover'|'gallery'|'menu';sort:number}> = []
  const logo=fd.get('logo');if(logo instanceof File&&logo.size)staged.push({file:logo,mediaType:'logo',sort:0})
  const cover=fd.get('cover');if(cover instanceof File&&cover.size)staged.push({file:cover,mediaType:'cover',sort:0})
  for(const [i,file] of fd.getAll('gallery_images').entries())if(file instanceof File&&file.size)staged.push({file,mediaType:'gallery',sort:i})
  const menu=fd.get('menu');if(menu instanceof File&&menu.size){if(!restaurant)throw new Error('Menu uploads are available only when a restaurant category is selected.');staged.push({file:menu,mediaType:'menu',sort:0})}

  for(const item of staged){
    const allowed=item.mediaType==='menu'?MENU_TYPES:IMAGE_TYPES
    const limit=item.mediaType==='menu'?12*1024*1024:8*1024*1024
    if(!allowed.has(item.file.type)||item.file.size>limit)throw new Error(item.mediaType==='menu'?'Menu must be PDF, JPEG, PNG or WebP and 12 MB or smaller.':'Images must be JPEG, PNG or WebP and 8 MB or smaller.')
    const path=`${TENANT_ID}/${submissionId}/${crypto.randomUUID()}.${fileExt(item.file)}`
    const{error:uploadError}=await s.storage.from('business-submission-media').upload(path,item.file,{contentType:item.file.type,upsert:false})
    if(uploadError)throw new Error(`Unable to stage ${item.mediaType}: ${uploadError.message}`)
    const{error:mediaError}=await s.from('business_submission_media').insert({tenant_id:TENANT_ID,submission_id:submissionId,storage_path:path,media_type:item.mediaType,mime_type:item.file.type,original_filename:item.file.name||null,alt_text:item.mediaType==='logo'?`${businessName} logo`:item.mediaType==='menu'?`${businessName} menu`:`${businessName} business image`,sort_order:item.sort,file_size_bytes:item.file.size,status:'pending'})
    if(mediaError)throw new Error(`Unable to save ${item.mediaType} details: ${mediaError.message}`)
  }

  await s.rpc('track_growth_event',{p_tenant_id:TENANT_ID,p_event_type:'listing_submit',p_page_path:'/list-your-business',p_business_id:null,p_city:city||null,p_category:category||null,p_plan:'free',p_source:'business-onboarding'})
  redirect('/list-your-business?submitted=1')
}
