import type { Metadata } from 'next'
import { SiteShell } from '@/components/SiteShell'
import { createClient } from '@/lib/supabase/server'

export const dynamic='force-dynamic'
export const metadata:Metadata={title:'Email Preferences',robots:{index:false,follow:false}}

async function unsubscribe(fd:FormData){'use server';const token=String(fd.get('token')??'').trim();if(!token)return;const s=await createClient();await s.rpc('unsubscribe_business_email',{p_token:token})}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const sp=await searchParams;const token=typeof sp.token==='string'?sp.token:'';return <SiteShell><main><section className="pagehero"><div className="container"><div className="eyebrow">Email Preferences</div><h1>Business growth email preferences</h1><p>Transactional messages about submissions, ownership and verification are separate from optional marketing education.</p></div></section><section className="section"><div className="container"><div className="card" style={{maxWidth:680,margin:'auto'}}><h2>Unsubscribe from optional business-growth emails</h2><p className="muted">This stops the promotional drip sequence tied to this enrollment. It does not remove your business listing, ownership access or essential account/workflow notices.</p>{token?<form action={unsubscribe}><input type="hidden" name="token" value={token}/><button className="btn btn-primary">Unsubscribe Me</button></form>:<div className="notice warn">This unsubscribe link is incomplete.</div>}</div></div></section></main></SiteShell>}
