import { requireAdmin, requireSuperAdmin } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'

const uuid=(value:unknown)=>{const s=String(value??'').trim();return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)?s:''}
const text=(value:unknown,max=4000)=>String(value??'').trim().slice(0,max)||null
const int=(value:unknown)=>{if(value===null||value===undefined||value==='')return null;const n=Math.round(Number(value));return Number.isFinite(n)?n:null}
const friendly=(raw:string)=>{const messages:Record<string,string>={insufficient_privilege:'You do not have permission to perform this agreement action.',business_not_found:'Business not found.',activated_draft_is_locked:'This agreement is already activated and locked. Use Lead Revenue CRM for authorized changes to the active program.',invalid_draft_status:'Invalid agreement draft status.',agreement_start_required:'Add the agreement start date before review.',documented_consent_required:'Record the buyer consent date, consent source and reference before review.',owner_summary_required:'Add the owner-facing agreement summary before review.',positive_per_lead_price_required:'Add a positive per-lead price before review.',valid_bundle_required:'Add both the bundle lead count and bundle price before review.',shared_buyer_limit_required:'Shared leads require a maximum buyer count of at least 2.',agreement_not_ready_for_activation:'Only a Ready for Review agreement can be activated.',agreement_draft_not_found:'Agreement draft not found.'};const key=Object.keys(messages).find(k=>raw.includes(k));return key?messages[key]:raw}

export async function POST(request:Request){
  try{
    const body=await request.json() as any,action=String(body.action||'')
    const s=await createClient()
    if(action==='activate_agreement'){
      await requireSuperAdmin('/admin/lead-buyers')
      const draftId=uuid(body.draft_id);if(!draftId)return Response.json({error:'Valid agreement draft is required.'},{status:400})
      const{data,error}=await s.rpc('activate_lead_buyer_agreement_draft',{p_draft_id:draftId});if(error)throw error
      return Response.json({ok:true,program_id:data},{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}})
    }
    await requireAdmin('/admin/lead-buyers')
    if(!['save_agreement_draft','ready_agreement','decline_agreement'].includes(action))return Response.json({error:'Unknown agreement action.'},{status:400})
    const businessId=uuid(body.business_id);if(!businessId)return Response.json({error:'Valid business is required.'},{status:400})
    const model=String(body.billing_model||'pay_per_lead'),saleMode=String(body.lead_sale_mode||'exclusive')
    const status=action==='ready_agreement'?'ready_for_review':action==='decline_agreement'?'declined':'draft'
    const{data,error}=await s.rpc('upsert_lead_buyer_agreement_draft',{p_tenant_id:TENANT_ID,p_business_id:businessId,p_status:status,p_featured_addon_enabled:Boolean(body.featured_addon_enabled),p_billing_model:model,p_per_lead_price_cents:int(body.per_lead_price_cents),p_bundle_lead_count:int(body.bundle_lead_count),p_bundle_price_cents:int(body.bundle_price_cents),p_due_days:int(body.due_days)??7,p_billing_email:text(body.billing_email,320),p_agreement_started_on:text(body.agreement_started_on,10),p_agreement_ends_on:text(body.agreement_ends_on,10),p_max_leads_per_month:int(body.max_leads_per_month),p_lead_sale_mode:saleMode,p_max_buyers_per_lead:int(body.max_buyers_per_lead)??1,p_consent_recorded_at:text(body.consent_recorded_at,40),p_consent_source:text(body.consent_source,40),p_consent_reference:text(body.consent_reference,1000),p_owner_summary:text(body.owner_summary,5000),p_internal_notes:text(body.internal_notes,10000)})
    if(error)throw error
    return Response.json({ok:true,draft_id:data,status},{headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}})
  }catch(e:any){const raw=String(e?.message||'Unable to complete agreement action.');return Response.json({error:friendly(raw)},{status:raw.includes('insufficient_privilege')?403:400,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}})}
}
