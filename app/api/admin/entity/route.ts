import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRoles, getClaims } from '@/lib/auth'
import { ADMIN_ENTITIES } from '@/lib/admin'
import { TENANT_ID } from '@/lib/constants'

const ADMIN_ONLY_SECTIONS=new Set(['businesses','branches','content-blocks','coverage','categories','locations','guides','seo','sponsorships','subscriptions'])
const WORKFLOW_ONLY_SECTIONS=new Set(['claims','edit-requests','submissions','reports'])
async function authState(){const claims=await getClaims();if(!claims?.sub)return null;const roles=await getRoles(String(claims.sub));return{claims,roles,isAdmin:roles.some(r=>['admin','super_admin'].includes(r)),isSuperAdmin:roles.includes('super_admin'),isStaff:roles.some(r=>['staff','admin','super_admin'].includes(r))}}
export async function PATCH(req:Request){
  const body=await req.json() as {section:string;id:string;changes:Record<string,unknown>};
  const auth=await authState();if(!auth?.isStaff)return NextResponse.json({error:'Unauthorized'},{status:401})
  if(ADMIN_ONLY_SECTIONS.has(body.section)&&!auth.isAdmin)return NextResponse.json({error:'Admin access required.'},{status:403})
  if(body.section==='sponsorships'&&!auth.isSuperAdmin)return NextResponse.json({error:'Super Admin access required for sponsored placement changes.'},{status:403})
  if(body.section==='businesses'&&Object.prototype.hasOwnProperty.call(body.changes??{},'status')&&!auth.isSuperAdmin)return NextResponse.json({error:'Super Admin access required for business visibility changes.'},{status:403})
  if(WORKFLOW_ONLY_SECTIONS.has(body.section))return NextResponse.json({error:'This section uses protected moderation actions and cannot be edited through the generic endpoint.'},{status:400})
  const cfg=ADMIN_ENTITIES[body.section]
  if(!cfg||cfg.readOnly)return NextResponse.json({error:'Section is read-only or invalid.'},{status:400})
  const changes=Object.fromEntries(Object.entries(body.changes??{}).filter(([k])=>cfg.editable.includes(k)))
  if(!Object.keys(changes).length)return NextResponse.json({error:'No editable fields supplied.'},{status:400})
  const supabase=await createClient(); let q=supabase.from(cfg.table).update(changes).eq('id',body.id)
  if(!['business_claims','sponsorships','subscriptions'].includes(cfg.table)) q=q.eq('tenant_id',TENANT_ID)
  const {error}=await q; if(error)return NextResponse.json({error:error.message},{status:400})
  const fields=Object.keys(changes).sort().join(', ')
  await supabase.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:String(auth.claims.sub),action_type:'admin_entity_update',action_text:`Updated ${body.section} record ${body.id}; fields: ${fields}`})
  return NextResponse.json({ok:true})
}
