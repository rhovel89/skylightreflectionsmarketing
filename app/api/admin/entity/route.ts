import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRoles, getClaims } from '@/lib/auth'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { TENANT_ID } from '@/lib/constants'

async function authorize(){ const claims=await getClaims(); if(!claims?.sub)return null; const roles=await getRoles(String(claims.sub)); return roles.some(r=>['staff','admin','super_admin'].includes(r))?claims:null }
export async function PATCH(req:Request){
  const claims=await authorize(); if(!claims)return NextResponse.json({error:'Unauthorized'},{status:401})
  const body=await req.json() as {section:string;id:string;changes:Record<string,unknown>}; const cfg=ADMIN_ENTITIES[body.section]
  if(!cfg||cfg.readOnly)return NextResponse.json({error:'Section is read-only or invalid.'},{status:400})
  const changes=Object.fromEntries(Object.entries(body.changes??{}).filter(([k])=>cfg.editable.includes(k)))
  if(!Object.keys(changes).length)return NextResponse.json({error:'No editable fields supplied.'},{status:400})
  const supabase=await createClient(); let q=supabase.from(cfg.table).update(changes).eq('id',body.id)
  if(!['business_claims','sponsorships','subscriptions'].includes(cfg.table)) q=q.eq('tenant_id',TENANT_ID)
  const {error}=await q; if(error)return NextResponse.json({error:error.message},{status:400})
  return NextResponse.json({ok:true})
}
