import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

const USERNAME=/^[a-z0-9][a-z0-9._-]{2,29}$/
const RESERVED=new Set(['admin','administrator','support','staff','root','localpros','centralillinoislocalpros','skylight'])
function safeNext(value:string){return value.startsWith('/')&&!value.startsWith('//')?value:'/for-businesses'}

async function setBusinessUsername(fd:FormData){
  'use server'
  const next=safeNext(String(fd.get('next')||'/for-businesses'))
  const claims=await requireUser(`/account/business-access?next=${encodeURIComponent(next)}`)
  const username=String(fd.get('username')||'').trim().toLowerCase()
  if(!USERNAME.test(username)||RESERVED.has(username))redirect(`/account/business-access?next=${encodeURIComponent(next)}&error=${encodeURIComponent('Choose a username 3–30 characters long using letters, numbers, periods, underscores or hyphens.')}`)
  const s=await createClient()
  const{data:existing}=await s.from('profiles').select('username').eq('id',String(claims.sub)).maybeSingle()
  if(existing?.username)redirect(next)
  const{error}=await s.from('profiles').upsert({id:String(claims.sub),username},{onConflict:'id'})
  if(error){const msg=error.code==='23505'?'That username is already in use. Choose another username.':'Unable to save your business-account username.';redirect(`/account/business-access?next=${encodeURIComponent(next)}&error=${encodeURIComponent(msg)}`)}
  revalidatePath('/account','layout')
  redirect(next)
}

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const sp=await searchParams
  const next=safeNext(typeof sp.next==='string'?sp.next:'/for-businesses')
  const claims=await requireUser(`/account/business-access?next=${encodeURIComponent(next)}`)
  const s=await createClient()
  const[{data:profile},{data:userData}]=await Promise.all([
    s.from('profiles').select('username').eq('id',String(claims.sub)).maybeSingle(),
    s.auth.getUser(),
  ])
  const username=profile?.username||''
  return <div><div className="consumer-page-head"><div><div className="kpi">Business Account Access</div><h2>{username?'Business account ready':'Choose your username'}</h2><p className="muted">Anyone who lists or claims a business must have a signed-in Central Illinois Local Pros account with a unique username and password.</p></div></div>
    <div className="consumer-settings-grid"><section className="consumer-settings-card"><div className="kpi">Account identity</div>{username?<><h3>@{username}</h3><p className="small muted">This username is attached to your private account identity. Your email remains the secure sign-in, recovery and notification credential.</p><div className="card-actions"><Link className="btn btn-primary" href={next}>Continue</Link><Link className="btn btn-light" href="/account/settings">Account Settings</Link></div></>:<><h3>Complete one-time business access setup</h3><p className="small muted">Your username is not a business name and does not affect rankings. It helps tie business submissions and ownership claims to a real authenticated account.</p>{typeof sp.error==='string'?<div className="form-status error">{sp.error}</div>:null}<form action={setBusinessUsername}><input type="hidden" name="next" value={next}/><label>Username<input name="username" minLength={3} maxLength={30} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,29}" autoComplete="username" required placeholder="yourusername"/></label><p className="small muted">3–30 characters. Letters, numbers, periods, underscores and hyphens only. Usernames are stored lowercase.</p><button className="btn btn-primary">Save Username & Continue</button></form></>}</section><aside className="consumer-dashboard-stack"><section className="consumer-panel"><div className="kpi">Secure sign-in</div><h3>{userData.user?.email||'Authenticated account'}</h3><p className="small muted">Your password is handled by Supabase Auth and is never stored in the directory database.</p></section><section className="consumer-account-note"><div className="kpi">Required for business actions</div><h3>List or claim only after account setup.</h3><p>Business onboarding and ownership claims re-check authentication and username readiness on the server and at the database boundary.</p></section></aside></div>
  </div>
}
