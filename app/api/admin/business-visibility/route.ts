import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const actions=new Set(['hide','unhide','unpublish','republish','archive','remove_featured'])
const statusFor:Record<string,string>={hide:'suspended',unhide:'published',unpublish:'draft',republish:'published',archive:'archived'}

export async function POST(req:Request){
  try{
    const{claims}=await requireSuperAdmin('/admin/businesses')
    const body=await req.json() as {business_id?:string;action?:string}
    const businessId=String(body.business_id||'').trim(),action=String(body.action||'').trim()
    if(!businessId||!actions.has(action))return NextResponse.json({error:'Valid business and action are required.'},{status:400})
    const s=await createClient()
    const{data:business,error:readError}=await s.from('businesses').select('id,name,slug,status').eq('tenant_id',TENANT_ID).eq('id',businessId).maybeSingle()
    if(readError||!business)return NextResponse.json({error:'Business not found.'},{status:404})
    if(action==='remove_featured'){
      const{error}=await s.from('sponsorships').update({active:false}).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('active',true)
      if(error)return NextResponse.json({error:error.message},{status:400})
      await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'business_removed_from_featured',action_text:`Removed ${business.name} (${businessId}) from every active sponsored placement.`})
    }else{
      const next=statusFor[action]
      const patch:any={status:next,updated_at:new Date().toISOString()}
      if(next!=='published')patch.featured=false
      if(next==='published'&&!business.status) return NextResponse.json({error:'Unable to determine current business state.'},{status:400})
      const{error}=await s.from('businesses').update(patch).eq('tenant_id',TENANT_ID).eq('id',businessId)
      if(error)return NextResponse.json({error:error.message},{status:400})
      if(next!=='published')await s.from('sponsorships').update({active:false}).eq('tenant_id',TENANT_ID).eq('business_id',businessId).eq('active',true)
      await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:`business_${action}`,action_text:`${action.replace('_',' ')} ${business.name} (${businessId}); status ${business.status} → ${next}.`})
      await s.rpc('refresh_seo_market_gaps',{p_tenant_id:TENANT_ID})
    }
    revalidatePath('/','layout');revalidatePath('/search');revalidatePath('/admin/businesses');revalidatePath('/admin/sponsorships');revalidatePath('/admin/revenue')
    return NextResponse.json({ok:true,status:statusFor[action]||business.status})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to change business visibility.'},{status:400})}
}
