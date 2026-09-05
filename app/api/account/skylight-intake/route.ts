import{NextResponse}from'next/server'
import{createClient}from'@/lib/supabase/server'
import{requireUser}from'@/lib/auth'

const str=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n)
const uuid=(v:unknown)=>{const x=str(v,40);return /^[0-9a-f-]{36}$/i.test(x)?x:null}
const privateHeaders={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}
export async function POST(req:Request){
 try{
  await requireUser('/account/skylight/intake');const body=await req.json() as Record<string,any>,action=str(body.action,60),s=await createClient()
  if(action==='save_responses'){
   const rows=Array.isArray(body.responses)?body.responses.slice(0,100):[];if(!rows.length)return NextResponse.json({error:'No intake responses were provided.'},{status:400,headers:privateHeaders})
   for(const row of rows){const id=uuid(row?.id);if(!id)continue;const{error}=await s.rpc('customer_save_skylight_intake_response',{p_field_id:id,p_response:row.response??null});if(error)throw error}
   return NextResponse.json({ok:true,count:rows.length},{headers:privateHeaders})
  }
  if(action==='register_asset'){
   const projectId=uuid(body.project_id),requirementId=uuid(body.requirement_id),path=str(body.storage_path,900),name=str(body.file_name,260),mime=str(body.mime_type,180),size=Math.round(Number(body.file_size_bytes)||0)
   if(!projectId||!requirementId||!path||!name)return NextResponse.json({error:'Project, file requirement and uploaded file are required.'},{status:400,headers:privateHeaders})
   const{data,error}=await s.rpc('customer_register_skylight_project_asset',{p_project_id:projectId,p_requirement_id:requirementId,p_storage_path:path,p_file_name:name,p_mime_type:mime,p_file_size_bytes:size,p_description:str(body.description,2000)||null});if(error)throw error;return NextResponse.json(data,{headers:privateHeaders})
  }
  if(action==='remove_asset'){
   const assetId=uuid(body.asset_id);if(!assetId)return NextResponse.json({error:'File is required.'},{status:400,headers:privateHeaders});const{data,error}=await s.rpc('customer_remove_skylight_project_asset',{p_asset_id:assetId});if(error)throw error;return NextResponse.json(data,{headers:privateHeaders})
  }
  if(action==='submit'){
   const projectId=uuid(body.project_id);if(!projectId)return NextResponse.json({error:'Project is required.'},{status:400,headers:privateHeaders});const{data,error}=await s.rpc('customer_submit_skylight_intake',{p_project_id:projectId});if(error)throw error;return NextResponse.json(data,{headers:privateHeaders})
  }
  return NextResponse.json({error:'Unsupported intake action.'},{status:400,headers:privateHeaders})
 }catch(e:any){return NextResponse.json({error:String(e?.message||'Unable to update your Skylight onboarding.')},{status:400,headers:privateHeaders})}
}
