import { NextResponse } from 'next/server'
import { createHash,randomBytes } from 'node:crypto'
import { getClaims,getRoles } from '@/lib/auth'
import { canvaRedirectUri } from '@/lib/canva-connect'

const b64url=(b:Buffer)=>b.toString('base64url')
export async function GET(){
 const claims=await getClaims();if(!claims?.sub)return NextResponse.redirect(new URL('/login?next=/admin/marketing',process.env.NEXT_PUBLIC_SITE_URL||'https://central-il-local-pros.vercel.app'));const roles=await getRoles(String(claims.sub));if(!roles.includes('super_admin'))return NextResponse.redirect(new URL('/admin?access=super-admin-required',process.env.NEXT_PUBLIC_SITE_URL||'https://central-il-local-pros.vercel.app'))
 const clientId=process.env.CANVA_CLIENT_ID;if(!clientId)return NextResponse.redirect(new URL('/admin/marketing?canva=credentials-required',process.env.NEXT_PUBLIC_SITE_URL||'https://central-il-local-pros.vercel.app'))
 const verifier=b64url(randomBytes(64)),challenge=b64url(createHash('sha256').update(verifier).digest()),state=b64url(randomBytes(32)),auth=new URL('https://www.canva.com/api/oauth/authorize');auth.searchParams.set('response_type','code');auth.searchParams.set('client_id',clientId);auth.searchParams.set('redirect_uri',canvaRedirectUri());auth.searchParams.set('scope',['asset:read','asset:write','design:content:write','design:meta:read','profile:read'].join(' '));auth.searchParams.set('state',state);auth.searchParams.set('code_challenge',challenge);auth.searchParams.set('code_challenge_method','S256')
 const res=NextResponse.redirect(auth);const options={httpOnly:true,secure:true,sameSite:'lax' as const,path:'/',maxAge:600};res.cookies.set('cilp_canva_state',state,options);res.cookies.set('cilp_canva_verifier',verifier,options);return res
}
