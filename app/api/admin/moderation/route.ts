import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { processBusinessEmailOutbox } from '@/lib/business-email'

type Body={kind:'claims'|'edit-requests'|'submissions'|'reports'|'media';id:string;decision:'approve'|'reject'|'resolve'|'dismiss';notes?:string}

async function promoteSubmissionMedia(s:any,submissionId:string,businessId:string){
  const{data:user}=await s.auth.getUser();const uid=user.user?.id||null
  const{data:rows,error}=await s.from('business_submission_media').select('id,storage_path,media_type,mime_type,original_filename,alt_text,caption,sort_order').eq('tenant_id',TENANT_ID).eq('submission_id',submissionId).eq('status','pending').order('sort_order');if(error)throw new Error(error.message)
  let promoted=0
  for(const row of rows??[]){
    const{data:file,error:downloadError}=await s.storage.from('business-submission-media').download(row.storage_path);if(downloadError||!file)throw new Error(downloadError?.message||'Unable to read staged business media.')
    const ext=String(row.storage_path).split('.').pop()?.replace(/[^a-z0-9]/gi,'')||'bin';const publicPath=`${businessId}/submission-${crypto.randomUUID()}.${ext}`
    const{error:uploadError}=await s.storage.from('business-media').upload(publicPath,file,{contentType:row.mime_type,upsert:false});if(uploadError)throw new Error(uploadError.message)
    const now=new Date().toISOString();const{data:created,error:insertError}=await s.from('business_media').insert({tenant_id:TENANT_ID,business_id:businessId,storage_path:publicPath,media_type:row.media_type,mime_type:row.mime_type,original_filename:row.original_filename,alt_text:row.alt_text,caption:row.caption,sort_order:row.sort_order,status:'active',approval_status:'approved',submitted_by:uid,reviewed_by:uid,reviewed_at:now,review_notes:'Promoted from an admin-approved business onboarding submission.'}).select('id').single();if(insertError||!created){await s.storage.from('business-media').remove([publicPath]);throw new Error(insertError?.message||'Unable to create approved media record.')}
    if(['logo','cover','menu'].includes(row.media_type))await s.from('business_media').update({status:'archived',updated_at:now}).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('media_type',row.media_type).eq('status','active').neq('id',created.id)
    await s.from('business_submission_media').update({status:'promoted',promoted_at:now,promoted_business_media_id:created.id}).eq('tenant_id',TENANT_ID).eq('id',row.id)
    await s.storage.from('business-submission-media').remove([row.storage_path])
    promoted++
  }
  return promoted
}

export async function POST(req:Request){
  try{
    const body=await req.json() as Body
    const allowedKinds=['claims','edit-requests','submissions','reports','media']
    const allowedDecisions=body.kind==='reports'?['resolve','dismiss']:['approve','reject']
    if(!body?.id||!allowedKinds.includes(body.kind)||!allowedDecisions.includes(body.decision))return NextResponse.json({error:'Invalid moderation request.'},{status:400})
    const s=await createClient()
    const rpc=body.kind==='claims'?'review_business_claim':body.kind==='submissions'?'review_business_submission':body.kind==='reports'?'review_listing_report':body.kind==='media'?'review_business_media':'review_business_edit_request'
    const args=body.kind==='claims'?{p_claim_id:body.id,p_decision:body.decision,p_notes:body.notes||null}:body.kind==='submissions'?{p_submission_id:body.id,p_decision:body.decision,p_notes:body.notes||null}:body.kind==='reports'?{p_report_id:body.id,p_decision:body.decision,p_notes:body.notes||null}:body.kind==='media'?{p_media_id:body.id,p_decision:body.decision,p_notes:body.notes||null}:{p_request_id:body.id,p_decision:body.decision,p_notes:body.notes||null}
    const{data,error}=await s.rpc(rpc,args)
    if(error)return NextResponse.json({error:error.message},{status:error.message.includes('insufficient_privilege')||error.message.includes('authentication_required')?403:400})
    let promotedMedia=0,mediaWarning:string|null=null
    if(body.kind==='submissions'&&body.decision==='approve'&&data?.business_id){try{promotedMedia=await promoteSubmissionMedia(s,body.id,String(data.business_id))}catch(e){mediaWarning=e instanceof Error?e.message:'Some staged media could not be promoted.'}}
    const email=await processBusinessEmailOutbox(20)
    return NextResponse.json({ok:true,result:data,promotedMedia,mediaWarning,email})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to review moderation item.'},{status:400})}
}
