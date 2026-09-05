import { createClient } from '@/lib/supabase/server'
import { TENANT_ID } from '@/lib/constants'
import { BusinessVerificationPanel } from '@/components/BusinessVerificationPanel'

export const dynamic='force-dynamic'
export default async function Page(){const s=await createClient();const{data,error}=await s.from('businesses').select('id,name,status,claimed,verified,featured,phone,website,address_text,source_name,source_url,source_checked_at').eq('tenant_id',TENANT_ID).in('status',['pending','published']).order('status',{ascending:true}).order('verified',{ascending:true}).order('name').limit(250);return <><div className="admin-page-head"><div><div className="kpi">Final Publication Gate</div><h1>Verification & Publication</h1><p className="muted">Pending onboarding profiles must have approved ownership before final verification can publish them. Existing published businesses can still be independently verified using documented source evidence.</p></div><span className="badge verified">Admin only</span></div>{error?<div className="notice warn">{error.message}</div>:<BusinessVerificationPanel rows={(data??[]) as any[]}/>}</>}
