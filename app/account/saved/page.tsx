import Link from'next/link'
import{createClient}from'@/lib/supabase/server'
import{requireUser}from'@/lib/auth'
import{BusinessCard}from'@/components/BusinessCard'
import{SavedCompare}from'@/components/SavedCompare'
import{toggleSavedBusiness}from'@/app/actions'

const related=(v:any)=>Array.isArray(v)?v[0]:v
export default async function Page(){
 const c=await requireUser('/account/saved'),s=await createClient()
 const{data}=await s.from('saved_businesses').select('business_id,businesses(*)').eq('user_id',String(c.sub))
 const businesses=(data??[]).map((x:any)=>related(x.businesses)).filter(Boolean)
 const ids=businesses.map((b:any)=>String(b.id))
 if(!ids.length)return <div><div className="consumer-page-head"><div><div className="kpi">Your Shortlist</div><h2>Saved & Compare</h2><p className="muted">Keep useful local businesses in one private list and compare factual profile signals when you are ready.</p></div><Link className="btn btn-primary" href="/search">Find Businesses</Link></div><div className="empty empty-rich"><h3>No saved businesses yet</h3><p>Browse the directory, open a business profile and use Save / Unsave Business to build a private shortlist.</p><div className="card-actions"><Link className="btn btn-primary" href="/search">Search Local Businesses</Link><Link className="btn btn-light" href="/illinois">Browse by Location</Link></div></div></div>
 const[cats,availability,faves,deals,branches]=await Promise.all([
  s.from('business_categories').select('business_id,categories(name)').in('business_id',ids),
  s.from('business_availability').select('business_id,availability_status,expires_at').in('business_id',ids),
  s.from('business_local_fave_stats').select('business_id,recommendation_count').in('business_id',ids),
  s.from('business_deals').select('id,business_id,status').in('business_id',ids).eq('status','approved'),
  s.from('business_locations').select('business_id,city,is_primary,is_active').in('business_id',ids).eq('is_active',true)
 ])
 const categories=new Map<string,string[]>();for(const row of cats.data??[]){const id=String((row as any).business_id),cat=related((row as any).categories)?.name;if(!cat)continue;categories.set(id,[...(categories.get(id)??[]),String(cat)])}
 const availabilityById=new Map((availability.data??[]).filter((x:any)=>!x.expires_at||new Date(x.expires_at).getTime()>=Date.now()).map((x:any)=>[String(x.business_id),x.availability_status]))
 const faveById=new Map((faves.data??[]).map((x:any)=>[String(x.business_id),Number(x.recommendation_count||0)]))
 const dealById=new Map<string,number>();for(const row of deals.data??[]){const id=String((row as any).business_id);dealById.set(id,(dealById.get(id)??0)+1)}
 const cityById=new Map<string,string>();for(const row of branches.data??[]){const id=String((row as any).business_id);if((row as any).is_primary||!cityById.has(id))cityById.set(id,String((row as any).city||''))}
 const enhanced=businesses.map((b:any)=>({...b,categories:categories.get(String(b.id))??[],availability_status:availabilityById.get(String(b.id))||'',local_faves:faveById.get(String(b.id))||0,active_deals:dealById.get(String(b.id))||0,primary_city:cityById.get(String(b.id))||''}))
 return <div><div className="consumer-page-head"><div><div className="kpi">Your Shortlist</div><h2>Saved & Compare</h2><p className="muted">Compare up to three saved businesses using sourced ratings, Local Faves, current availability, deals and trust states.</p></div><Link className="btn btn-primary" href="/search">Find More Businesses</Link></div><div className="notice"><strong>{enhanced.length} saved business{enhanced.length===1?'':'es'}.</strong> Saving and comparing are private account actions and never affect organic directory order, verification or Sponsored placement.</div><SavedCompare businesses={enhanced}/><div className="consumer-saved-grid">{enhanced.map((b:any)=>{const remove=toggleSavedBusiness.bind(null,String(b.id));return <div key={b.id}><BusinessCard business={b}/><form action={remove} style={{marginTop:6}}><button className="btn btn-light" type="submit">Remove from Saved</button></form></div>})}</div></div>
}
