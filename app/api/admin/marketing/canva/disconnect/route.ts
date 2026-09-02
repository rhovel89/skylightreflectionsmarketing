import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaims,getRoles } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { canvaBasicCredentials } from '@/lib/canva-connect'

export async function POST(){
 const claims=await getClaims();if(!claims?.sub)return NextResponse.json({error:'Unauthorized'},{status:401});const roles=await getRoles(String(claims.sub));if(!roles.includes('super_admin'))return NextResponse.json({error:'Super Admin access required.'},{status:403});const s=await createClient();const{data}=await s.rpc('get_marketing_integration_secret',{p_tenant:TENANT_ID,p_provider:'canva'});try{if(data?.refresh_token&&process.env.CANVA_CLIENT_ID&&process.env.CANVA_CLIENT_SECRET){const{authorization}=canvaBasicCredentials();await fetch('https://api.canva.com/rest/v1/oauth/revoke',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:String(data.refresh_token)}),cache:'no-store'})}}catch{}
 const removed=await s.rpc('delete_marketing_integration_secret',{p_tenant:TENANT_ID,p_provider:'canva'});if(removed.error)return NextResponse.json({error:removed.error.message},{status:400});await s.from('marketing_integration_accounts').upsert({tenant_id:TENANT_ID,provider:'canva',status:'disconnected',external_user_id:null,external_team_id:null,account_name:null,scopes:[],metadata:{},connected_by:null,connected_at:null},{onConflict:'tenant_id,provider'});await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'canva_disconnected',action_text:'Disconnected Canva from the Marketing Control Center and removed the stored OAuth token payload.'});return NextResponse.json({ok:true})
}
