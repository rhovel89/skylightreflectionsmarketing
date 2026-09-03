import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

export const dynamic='force-dynamic'
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp'])
const MENU_TYPES=new Set([...IMAGE_TYPES,'application/pdf'])
const mediaTypes=['logo','cover','gallery','menu'] as const
const text=(fd:FormData,key:string)=>String(fd.get(key)??'').trim()
const related=(v:any)=>Array.isArray(v)?v[0]:v

async function uploadAdminMedia(fd:FormData){
  'use server'
  const {claims}=await requireAdmin('/admin/business-media')
  const s=await createClient()
  const businessId=text(fd,'business_id')
  const mediaType=text(fd,'media_type')
  const file=fd.get('file')
  if(!mediaTypes.includes(mediaType as any))throw new Error('Choose a valid media type.')
  if(!(file instanceof File)||!file.size)throw new Error('Choose a file to upload.')
  const {data:business,error:businessError}=await s.from('businesses').select('id,slug,name,business_categories(categories(vertical))').eq('tenant_id',TENANT_ID).eq('id',businessId).maybeSingle()
  if(businessError||!business)throw new Error('Business not found.')
  const restaurant=(business.business_categories??[]).some((row:any)=>related(row.categories)?.vertical==='restaurant')
  if(mediaType==='menu'&&!restaurant)throw new Error('Menu files can only be attached to restaurant listings.')
  if(mediaType==='menu'){
    if(!MENU_TYPES.has(file.type))throw new Error('Menus must be PDF, JPEG, PNG or WebP.')
    if(file.size>12*1024*1024)throw new Error('Menu files must be 12 MB or smaller.')
  }else{
    if(!IMAGE_TYPES.has(file.type))throw new Error('Images must be JPEG, PNG or WebP.')
    if(file.size>8*1024*1024)throw new Error('Images must be 8 MB or smaller.')
  }
  const ext=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'
  const storagePath=`${businessId}/admin-${crypto.randomUUID()}.${ext}`
  const {error:uploadError}=await s.storage.from('business-media').upload(storagePath,file,{contentType:file.type,upsert:false})
  if(uploadError)throw new Error(`Unable to upload file: ${uploadError.message}`)
  const now=new Date().toISOString()
  const {data:created,error:insertError}=await s.from('business_media').insert({tenant_id:TENANT_ID,business_id:businessId,storage_path:storagePath,media_type:mediaType,mime_type:file.type,original_filename:file.name||null,alt_text:text(fd,'alt_text').slice(0,240)||null,caption:text(fd,'caption').slice(0,500)||null,sort_order:Number(text(fd,'sort_order')||0),status:'active',approval_status:'approved',submitted_by:String(claims.sub),reviewed_by:String(claims.sub),reviewed_at:now,review_notes:'Added directly by directory staff.'}).select('id').single()
  if(insertError||!created){await s.storage.from('business-media').remove([storagePath]);throw new Error(insertError?.message||'Unable to save media record.')}
  if(fd.get('replace_existing')==='on'&&['logo','cover','menu'].includes(mediaType)){
    await s.from('business_media').update({status:'archived',updated_at:now}).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('media_type',mediaType).eq('status','active').neq('id',created.id)
  }
  await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'admin_business_media_added',action_text:`Added approved ${mediaType} media ${created.id} to business ${businessId}`})
  revalidatePath('/admin/business-media')
  revalidatePath('/')
  revalidatePath(`/business/${business.slug}`)
}

async function archiveAdminMedia(fd:FormData){
  'use server'
  const {claims}=await requireAdmin('/admin/business-media')
  const s=await createClient()
  const id=text(fd,'id')
  const {data:row}=await s.from('business_media').select('id,business_id,businesses!inner(slug,tenant_id)').eq('tenant_id',TENANT_ID).eq('id',id).eq('businesses.tenant_id',TENANT_ID).maybeSingle()
  if(!row)throw new Error('Media record not found.')
  const {error}=await s.from('business_media').update({status:'archived',updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',id)
  if(error)throw new Error(error.message)
  await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'admin_business_media_archived',action_text:`Archived business media ${id}`})
  const business:any=related((row as any).businesses)
  revalidatePath('/admin/business-media')
  revalidatePath('/')
  if(business?.slug)revalidatePath(`/business/${business.slug}`)
}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  await requireAdmin('/admin/business-media')
  const sp=await searchParams
  const s=await createClient()
  const {data:businessRows}=await s.from('businesses').select('id,name,slug,status').eq('tenant_id',TENANT_ID).neq('status','archived').order('name').limit(3000)
  const businesses=(businessRows??[]) as any[]
  if(!businesses.length)return <><div className="admin-page-head"><div><div className="kpi">Staff Media Control</div><h1>Business Media & Menus</h1></div></div><div className="empty">Add a business first.</div></>
  const requested=typeof sp.business==='string'?sp.business:''
  const business=businesses.find(x=>x.id===requested)??businesses[0]
  const [{data:mediaRows},{data:categoryRows},{data:entitlementData}]=await Promise.all([
    s.from('business_media').select('id,storage_path,media_type,mime_type,original_filename,alt_text,caption,sort_order,status,approval_status,created_at,reviewed_at').eq('tenant_id',TENANT_ID).eq('business_id',business.id).order('created_at',{ascending:false}).limit(100),
    s.from('business_categories').select('categories(vertical,name)').eq('business_id',business.id),
    s.rpc('get_public_business_media_entitlements',{p_business_id:business.id}),
  ])
  const restaurant=(categoryRows??[]).some((row:any)=>related(row.categories)?.vertical==='restaurant')
  const entitlements=(entitlementData&&typeof entitlementData==='object'?entitlementData:{}) as Record<string,any>
  const rows=(mediaRows??[]).map((row:any)=>({...row,url:s.storage.from('business-media').getPublicUrl(row.storage_path).data.publicUrl}))
  const created=sp.created==='1'
  return <>
    <div className="admin-page-head"><div><div className="kpi">Staff Media Control</div><h1>Business Media & Menus</h1><p className="muted">Upload and manage logos, cover images, gallery media and restaurant menus for any directory business. Staff uploads are approved immediately and recorded in the audit log.</p></div><span className="badge verified">Admin controlled</span></div>
    {created&&<div className="notice success"><strong>Business created.</strong> Add its logo, cover image, gallery photos or restaurant menu below. Claimed and Verified remain off until their protected workflows are completed.</div>}
    <div className="notice"><strong>Display rules:</strong> approved logos can display on every plan and are used in Featured/Sponsored placements. Cover images can display on the business profile. Showcase-gallery and uploaded-menu visibility follows the business plan entitlements; admin can still stage and manage the assets here.</div>
    <form method="get" className="admin-card"><label>Manage business<select name="business" defaultValue={business.id}>{businesses.map(x=><option key={x.id} value={x.id}>{x.name} · {x.status}</option>)}</select></label><button className="btn btn-light">Switch Business</button></form>
    <div className="grid grid-2" style={{marginTop:18}}><div className="admin-card"><div className="kpi">Selected business</div><h2>{business.name}</h2><p className="small muted">Status: {business.status} · Plan: {String(entitlements.plan_name||entitlements.plan_slug||'Free')}</p><div className="card-actions"><Link className="btn btn-light" href={`/business/${business.slug}`} target="_blank">View Public Profile</Link><Link className="btn btn-light" href="/admin/sponsorships">Featured / Sponsored Control</Link></div></div><div className="admin-card"><div className="kpi">Current public entitlement</div><h2>{Number(entitlements.max_gallery_images||0)} gallery images</h2><p className="small muted">Menu upload display: {entitlements.menu_upload?'Enabled':'Not enabled by current plan'}{restaurant?' · Restaurant listing':' · Not a restaurant listing'}</p></div></div>
    <form action={uploadAdminMedia} className="admin-card" encType="multipart/form-data" style={{marginTop:18}}><input type="hidden" name="business_id" value={business.id}/><div className="section-head compact-head"><div><div className="kpi">Upload approved media</div><h2>Add Media to {business.name}</h2></div></div><div className="admin-form-grid"><label>Media Type<select name="media_type" defaultValue="logo"><option value="logo">Business Logo</option><option value="cover">Cover Image</option><option value="gallery">Showcase / Gallery Image</option>{restaurant&&<option value="menu">Restaurant Menu</option>}</select></label><label>File<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" required/></label><label>Alt Text<input name="alt_text" placeholder="Business logo or image description"/></label><label>Caption<input name="caption" placeholder="Optional public caption"/></label><label>Sort Order<input type="number" name="sort_order" defaultValue="0"/></label><label className="check-row"><input type="checkbox" name="replace_existing" defaultChecked/> Replace existing logo / cover / menu of same type</label></div><button className="btn btn-primary">Upload & Approve</button><p className="small muted">Images: JPEG, PNG or WebP up to 8 MB. Menus: PDF/JPEG/PNG/WebP up to 12 MB. Uploaded menu display remains subject to the current plan entitlement.</p></form>
    <div className="section-head" style={{marginTop:24}}><div><div className="kpi">Media library</div><h2>{rows.length} Media Record{rows.length===1?'':'s'}</h2></div></div>
    <div className="grid grid-3">{rows.map((m:any)=><article className="admin-card" key={m.id}><div className="badges"><span className={`badge ${m.status==='active'?'verified':'neutral'}`}>{m.status}</span><span className="badge neutral">{m.media_type}</span><span className="badge neutral">{m.approval_status}</span></div>{m.mime_type?.startsWith('image/')&&m.url?<img src={m.url} alt={m.alt_text||m.original_filename||m.media_type} style={{width:'100%',height:150,objectFit:'contain',borderRadius:12,marginTop:12,background:'#fff'}}/>:<p style={{marginTop:12}}><a href={m.url} target="_blank" rel="noreferrer">Open {m.media_type} file ↗</a></p>}<h3>{m.original_filename||m.media_type}</h3>{m.caption&&<p className="small muted">{m.caption}</p>}<p className="small muted">Sort: {m.sort_order} · Added {new Date(m.created_at).toLocaleDateString()}</p>{m.status==='active'&&<form action={archiveAdminMedia}><input type="hidden" name="id" value={m.id}/><button className="btn btn-light">Archive</button></form>}</article>)}</div>
    {!rows.length&&<div className="empty">No media has been attached to this business yet.</div>}
  </>
}
