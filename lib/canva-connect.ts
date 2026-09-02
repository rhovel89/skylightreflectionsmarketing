import { TENANT_ID } from '@/lib/constants'

const tokenUrl='https://api.canva.com/rest/v1/oauth/token'
const clientCredentials=()=>{const id=process.env.CANVA_CLIENT_ID,secret=process.env.CANVA_CLIENT_SECRET;if(!id||!secret)throw new Error('Canva developer credentials are not configured.');return{id,secret}}
const basic=(id:string,secret:string)=>Buffer.from(`${id}:${secret}`).toString('base64')

export async function getCanvaAccessToken(s:any){
 const {data,error}=await s.rpc('get_marketing_integration_secret',{p_tenant:TENANT_ID,p_provider:'canva'});if(error||!data?.access_token)throw new Error('Canva is not connected to this Super Admin account.')
 const payload={...data};const expires=payload.expires_at?new Date(payload.expires_at).getTime():0;if(expires>Date.now()+120000)return String(payload.access_token)
 if(!payload.refresh_token)throw new Error('The Canva connection expired and has no refresh token. Reconnect Canva.')
 const{id,secret}=clientCredentials(),body=new URLSearchParams({grant_type:'refresh_token',refresh_token:String(payload.refresh_token)})
 const r=await fetch(tokenUrl,{method:'POST',headers:{Authorization:`Basic ${basic(id,secret)}`,'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store'});const refreshed=await r.json() as any;if(!r.ok||!refreshed?.access_token)throw new Error(refreshed?.message||refreshed?.error_description||'Unable to refresh Canva access.')
 const next={...payload,...refreshed,refresh_token:refreshed.refresh_token||payload.refresh_token,expires_at:new Date(Date.now()+Number(refreshed.expires_in||14400)*1000).toISOString()};const saved=await s.rpc('save_marketing_integration_secret',{p_tenant:TENANT_ID,p_provider:'canva',p_token_payload:next});if(saved.error)throw new Error('Canva token refreshed but could not be securely stored.')
 return String(next.access_token)
}

export function canvaRedirectUri(){const site=(process.env.NEXT_PUBLIC_SITE_URL||'https://central-il-local-pros.vercel.app').replace(/\/$/,'');return process.env.CANVA_REDIRECT_URI||`${site}/api/admin/marketing/canva/callback`}
export function canvaBasicCredentials(){const{id,secret}=clientCredentials();return{id,secret,authorization:`Basic ${basic(id,secret)}`}}
