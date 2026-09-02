import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaims,getRoles } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const allowedFormats=new Set(['square','portrait','story','flyer','print_letter'])
const allowedAudiences=new Set(['consumer','business_owner','mixed'])
const allowedStatuses=new Set(['draft','ready','scheduled','published','archived'])
const allowedRecordTypes=new Set(['campaign','template'])
const allowedPlatforms=new Set(['facebook','instagram','linkedin','x','canva','print','download'])
const text=(v:any,max=4000)=>String(v??'').trim().slice(0,max)
async function auth(){const claims=await getClaims();if(!claims?.sub)return null;const roles=await getRoles(String(claims.sub));return roles.includes('super_admin')?claims:null}
function validUrl(v:string){if(!v)return null;try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.toString():null}catch{return null}}

export async function POST(req:Request){
 try{
  const claims=await auth();if(!claims)return NextResponse.json({error:'Super Admin access required.'},{status:403})
  const body=await req.json() as any;const action=text(body.action,40);const s=await createClient()
  if(action==='save'){
   const c=body.campaign??{},recordType=allowedRecordTypes.has(c.record_type)?c.record_type:'campaign',status=allowedStatuses.has(c.status)?c.status:'draft',format=allowedFormats.has(c.format)?c.format:'portrait',audience=allowedAudiences.has(c.audience)?c.audience:'consumer',headline=text(c.headline,240),name=text(c.name,160)||headline||'Untitled Campaign';if(!headline)return NextResponse.json({error:'Headline is required.'},{status:400})
   const row={tenant_id:TENANT_ID,created_by:String(claims.sub),name,record_type:recordType,campaign_type:text(c.campaign_type,80)||'directory_awareness',audience,status,market_location_id:c.market_location_id||null,category_id:c.category_id||null,market_name:text(c.market_name,160)||null,category_name:text(c.category_name,160)||null,format,eyebrow:text(c.eyebrow,160)||null,headline,subheadline:text(c.subheadline,700)||null,cta_label:text(c.cta_label,120)||null,destination_url:validUrl(text(c.destination_url,1000)),phone:text(c.phone,80)||null,caption:text(c.caption,5000)||null,creative_brief:text(c.creative_brief,6000)||null,qr_enabled:Boolean(c.qr_enabled),design_config:typeof c.design_config==='object'&&c.design_config?c.design_config:{},scheduled_for:c.scheduled_for?new Date(c.scheduled_for).toISOString():null}
   let data:any,error:any
   if(c.id){const r=await s.from('marketing_campaigns').update(row).eq('tenant_id',TENANT_ID).eq('id',String(c.id)).select('*').single();data=r.data;error=r.error}else{const r=await s.from('marketing_campaigns').insert(row).select('*').single();data=r.data;error=r.error}
   if(error)return NextResponse.json({error:error.message},{status:400})
   await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:recordType==='template'?'marketing_template_saved':'marketing_campaign_saved',action_text:`Saved ${recordType} ${data.id}: ${name}.`})
   return NextResponse.json({ok:true,campaign:data})
  }
  if(action==='archive'){
   const id=text(body.id,80);if(!id)return NextResponse.json({error:'Campaign is required.'},{status:400});const{error}=await s.from('marketing_campaigns').update({status:'archived'}).eq('tenant_id',TENANT_ID).eq('id',id);if(error)return NextResponse.json({error:error.message},{status:400});await s.from('marketing_publications').update({status:'canceled'}).eq('tenant_id',TENANT_ID).eq('campaign_id',id).in('status',['planned','queued']);await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'marketing_campaign_archived',action_text:`Archived marketing campaign ${id} and canceled its unpublished schedule rows.`});return NextResponse.json({ok:true})
  }
  if(action==='publication'){
   const campaignId=text(body.campaign_id,80),platform=text(body.platform,30);if(!campaignId||!allowedPlatforms.has(platform))return NextResponse.json({error:'Valid campaign and platform are required.'},{status:400});const scheduledFor=body.scheduled_for?new Date(body.scheduled_for).toISOString():null;const status=scheduledFor?'queued':'planned';const{data,error}=await s.from('marketing_publications').insert({tenant_id:TENANT_ID,campaign_id:campaignId,platform,status,scheduled_for:scheduledFor,created_by:String(claims.sub),metadata:{note:text(body.note,1000)||null}}).select('*').single();if(error)return NextResponse.json({error:error.message},{status:400});if(scheduledFor)await s.from('marketing_campaigns').update({status:'scheduled',scheduled_for:scheduledFor}).eq('tenant_id',TENANT_ID).eq('id',campaignId);await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'marketing_publication_planned',action_text:`Created ${platform} publication plan ${data.id} for campaign ${campaignId}${scheduledFor?` scheduled ${scheduledFor}`:''}. No external post was published.`});return NextResponse.json({ok:true,publication:data})
  }
  if(action==='mark_published'){
   const publicationId=text(body.publication_id,80),externalUrl=validUrl(text(body.external_url,1000));if(!publicationId)return NextResponse.json({error:'Publication is required.'},{status:400});const now=new Date().toISOString();const{data,error}=await s.from('marketing_publications').update({status:'published',published_at:now,external_url:externalUrl}).eq('tenant_id',TENANT_ID).eq('id',publicationId).select('campaign_id,platform').single();if(error)return NextResponse.json({error:error.message},{status:400});await s.from('marketing_campaigns').update({status:'published',published_at:now}).eq('tenant_id',TENANT_ID).eq('id',data.campaign_id);await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'marketing_publication_confirmed',action_text:`Manually confirmed ${data.platform} publication ${publicationId} as published. This action records status only and does not itself post externally.`});return NextResponse.json({ok:true})
  }
  return NextResponse.json({error:'Unsupported marketing action.'},{status:400})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to update Marketing Control Center.'},{status:400})}
}
