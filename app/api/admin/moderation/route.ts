import{NextResponse}from'next/server';import{createClient}from'@/lib/supabase/server'

type Body={kind:'claims'|'edit-requests';id:string;decision:'approve'|'reject';notes?:string}
export async function POST(req:Request){
 try{
  const body=await req.json() as Body
  if(!body?.id||!['claims','edit-requests'].includes(body.kind)||!['approve','reject'].includes(body.decision))return NextResponse.json({error:'Invalid moderation request.'},{status:400})
  const s=await createClient()
  const rpc=body.kind==='claims'?'review_business_claim':'review_business_edit_request'
  const args=body.kind==='claims'?{p_claim_id:body.id,p_decision:body.decision,p_notes:body.notes||null}:{p_request_id:body.id,p_decision:body.decision,p_notes:body.notes||null}
  const{data,error}=await s.rpc(rpc,args)
  if(error)return NextResponse.json({error:error.message},{status:error.message.includes('insufficient_privilege')||error.message.includes('authentication_required')?403:400})
  return NextResponse.json({ok:true,result:data})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to review moderation item.'},{status:400})}
}
