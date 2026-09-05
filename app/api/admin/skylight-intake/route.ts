import{NextResponse}from'next/server'
import{createClient}from'@/lib/supabase/server'
import{requireAdmin}from'@/lib/auth'
import{TENANT_ID}from'@/lib/constants'

const str=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n)
const uuid=(v:unknown)=>{const x=str(v,40);return /^[0-9a-f-]{36}$/i.test(x)?x:null}
const integer=(v:unknown,min=0,max=9999)=>Math.min(max,Math.max(min,Math.round(Number(v)||0)))
const questionTypes=['short_text','long_text','number','url','email','phone','date','single_select','multi_select','checkbox']
const allowedMimes=['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
const stringArray=(v:unknown,max=30)=>Array.isArray(v)?v.map(x=>str(x,180)).filter(Boolean).slice(0,max):str(v,4000).split(/[,\n]/).map(x=>x.trim()).filter(Boolean).slice(0,max)

export async function POST(req:Request){
 try{
  const{claims}=await requireAdmin('/admin/skylight-intake'),userId=String(claims.sub),body=await req.json() as Record<string,any>,action=str(body.action,60),s=await createClient()
  if(action==='save_question'){
   const id=uuid(body.id),serviceId=uuid(body.service_id),label=str(body.label,220),type=questionTypes.includes(str(body.question_type,40))?str(body.question_type,40):'short_text'
   if(!serviceId||!label)return NextResponse.json({error:'Service and question label are required.'},{status:400})
   const options=['single_select','multi_select'].includes(type)?stringArray(body.options,50):[]
   if(['single_select','multi_select'].includes(type)&&!options.length)return NextResponse.json({error:'Select questions need at least one option.'},{status:400})
   const payload={tenant_id:TENANT_ID,service_id:serviceId,label,help_text:str(body.help_text,1800)||null,question_type:type,required:Boolean(body.required),options,placeholder:str(body.placeholder,300)||null,sort_order:integer(body.sort_order),active:body.active!==false,updated_by:userId,updated_at:new Date().toISOString()}
   let q;if(id)q=await s.from('skylight_service_intake_questions').update(payload).eq('tenant_id',TENANT_ID).eq('id',id).select('id').single();else q=await s.from('skylight_service_intake_questions').insert({...payload,created_by:userId}).select('id').single();if(q.error)throw q.error
   return NextResponse.json({ok:true,id:q.data.id})
  }
  if(action==='archive_question'){
   const id=uuid(body.id);if(!id)return NextResponse.json({error:'Question is required.'},{status:400});const{error}=await s.from('skylight_service_intake_questions').update({active:false,updated_by:userId,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error;return NextResponse.json({ok:true})
  }
  if(action==='save_asset_requirement'){
   const id=uuid(body.id),serviceId=uuid(body.service_id),label=str(body.label,220);if(!serviceId||!label)return NextResponse.json({error:'Service and file requirement label are required.'},{status:400})
   const requested=stringArray(body.allowed_mime_types,30),mimes=[...new Set(requested.filter(x=>allowedMimes.includes(x)))];if(!mimes.length)mimes.push('image/jpeg','image/png','image/webp','application/pdf')
   const payload={tenant_id:TENANT_ID,service_id:serviceId,label,description:str(body.description,1800)||null,required:Boolean(body.required),category:str(body.category,100)||'general',allowed_mime_types:mimes,max_files:integer(body.max_files,1,25)||1,sort_order:integer(body.sort_order),active:body.active!==false,updated_by:userId,updated_at:new Date().toISOString()}
   let q;if(id)q=await s.from('skylight_service_asset_requirements').update(payload).eq('tenant_id',TENANT_ID).eq('id',id).select('id').single();else q=await s.from('skylight_service_asset_requirements').insert({...payload,created_by:userId}).select('id').single();if(q.error)throw q.error
   return NextResponse.json({ok:true,id:q.data.id})
  }
  if(action==='archive_asset_requirement'){
   const id=uuid(body.id);if(!id)return NextResponse.json({error:'File requirement is required.'},{status:400});const{error}=await s.from('skylight_service_asset_requirements').update({active:false,updated_by:userId,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error;return NextResponse.json({ok:true})
  }
  if(action==='review_intake'){
   const projectId=uuid(body.project_id),decision=str(body.decision,40);if(!projectId)return NextResponse.json({error:'Project is required.'},{status:400});const{data,error}=await s.rpc('admin_review_skylight_intake',{p_project_id:projectId,p_decision:decision,p_note:str(body.note,5000)||null});if(error)throw error;return NextResponse.json(data)
  }
  return NextResponse.json({error:'Unsupported intake action.'},{status:400})
 }catch(e:any){return NextResponse.json({error:String(e?.message||'Unable to update Skylight intake.')},{status:400,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}})}
}
