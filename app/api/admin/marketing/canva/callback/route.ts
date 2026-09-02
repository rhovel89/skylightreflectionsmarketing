import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getClaims,getRoles } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { canvaBasicCredentials,canvaRedirectUri } from '@/lib/canva-connect'

const site=()=>process.env.NEXT_PUBLIC_SITE_URL||'https://central-il-local-pros.vercel.app'
export async function GET(req:Request){
 const claims=await getClaims();if(!claims?.sub)return NextResponse.redirect(new URL('/login?next=/admin/marketing',site()));const roles=await getRoles(String(claims.sub));if(!roles.includes('super_admin'))return NextResponse.redirect(new URL('/admin?access=super-admin-required',site()))
 const u=new URL(req.url),code=u.searchParams.get('code'),state=u.searchParams.get('state'),error=u.searchParams.get('error'),jar=await cookies(),expected=jar.get('cilp_canva_state')?.value,verifier=jar.get('cilp_canva_verifier')?.value
 const finish=(path:string)=>{const r=NextResponse.redirect(new URL(path,site()));r.cookies.delete('cilp_canva_state');r.cookies.delete('cilp_canva_verifier');return r}
 if(error)return finish(`/admin/marketing?canva=${encodeURIComponent(error)}`)
 if(!code||!state||!expected||state!==expected||!verifier)return finish('/admin/marketing?canva=oauth-state-error')
 try{
  const{id,authorization}=canvaBasicCredentials(),body=new URLSearchParams({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:canvaRedirectUri()});const tokenRes=await fetch('https://api.canva.com/rest/v1/oauth/token',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store'});const token=await tokenRes.json() as any;if(!tokenRes.ok||!token?.access_token)return finish(`/admin/marketing?canva=${encodeURIComponent(token?.message||token?.error_description||'token-error')}`)
  const headers={Authorization:`Bearer ${token.access_token}`},[userRes,profileRes]=await Promise.all([fetch('https://api.canva.com/rest/v1/users/me',{headers,cache:'no-store'}),fetch('https://api.canva.com/rest/v1/users/me/profile',{headers,cache:'no-store'})]);const user=await userRes.json().catch(()=>({})) as any,profile=await profileRes.json().catch(()=>({})) as any
  const payload={...token,expires_at:new Date(Date.now()+Number(token.expires_in||14400)*1000).toISOString()};const s=await createClient();const saved=await s.rpc('save_marketing_integration_secret',{p_tenant:TENANT_ID,p_provider:'canva',p_token_payload:payload});if(saved.error)throw new Error(saved.error.message)
  const scopes=String(token.scope||'').split(/[ ,]+/).filter(Boolean);const account={tenant_id:TENANT_ID,provider:'canva',status:'connected',external_user_id:user?.team_user?.user_id||null,external_team_id:user?.team_user?.team_id||null,account_name:profile?.profile?.display_name||'Connected Canva account',scopes,metadata:{token_expires_at:payload.expires_at},connected_by:String(claims.sub),connected_at:new Date().toISOString()};const upsert=await s.from('marketing_integration_accounts').upsert(account,{onConflict:'tenant_id,provider'});if(upsert.error)throw new Error(upsert.error.message);await s.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(claims.sub),action_type:'canva_connected',action_text:`Connected Canva account ${account.account_name}; OAuth tokens stored only in private integration storage.`});return finish('/admin/marketing?canva=connected')
 }catch(e){return finish(`/admin/marketing?canva=${encodeURIComponent(e instanceof Error?e.message:'connection-error')}`)}
}
