import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaims } from '@/lib/auth'
import { TENANT_ID } from '@/lib/constants'

const SITE_URL=process.env.NEXT_PUBLIC_SITE_URL||'https://central-il-local-pros.vercel.app'
export async function POST(req:Request){
 try{
  const claims=await getClaims();if(!claims?.sub)return NextResponse.json({error:'Sign in is required.'},{status:401})
  const {offer_id}=await req.json() as {offer_id?:string};if(!offer_id)return NextResponse.json({error:'Offer is required.'},{status:400})
  const s=await createClient();const uid=String(claims.sub)
  const {data:offer,error}=await s.from('lead_marketplace_offers').select('id,lead_id,business_id,price_cents,status,expires_at,leads(service,city),businesses(name)').eq('tenant_id',TENANT_ID).eq('id',offer_id).maybeSingle()
  if(error||!offer)return NextResponse.json({error:'Lead offer not found.'},{status:404})
  const {data:owner}=await s.from('business_owners').select('business_id').eq('business_id',offer.business_id).eq('user_id',uid).maybeSingle();if(!owner)return NextResponse.json({error:'You are not authorized to purchase this business lead.'},{status:403})
  if(!['offered','checkout_pending','reserved'].includes(offer.status))return NextResponse.json({error:'This lead offer is no longer available for purchase.'},{status:400})
  if(offer.expires_at&&new Date(offer.expires_at).getTime()<Date.now())return NextResponse.json({error:'This lead offer has expired.'},{status:400})
  const secret=process.env.STRIPE_SECRET_KEY
  if(!secret)return NextResponse.json({error:'Secure Stripe lead checkout is not connected yet. The offer remains available and has not been marked paid.'},{status:503})
  const lead=Array.isArray((offer as any).leads)?(offer as any).leads[0]:(offer as any).leads;const business=Array.isArray((offer as any).businesses)?(offer as any).businesses[0]:(offer as any).businesses
  const form=new URLSearchParams();form.set('mode','payment');form.set('success_url',`${SITE_URL}/business-portal/lead-marketplace?business=${encodeURIComponent(offer.business_id)}&purchase=success`);form.set('cancel_url',`${SITE_URL}/business-portal/lead-marketplace?business=${encodeURIComponent(offer.business_id)}&purchase=canceled`);form.set('line_items[0][quantity]','1');form.set('line_items[0][price_data][currency]','usd');form.set('line_items[0][price_data][unit_amount]',String(offer.price_cents));form.set('line_items[0][price_data][product_data][name]',`Central Illinois Local Pros Lead — ${lead?.service||'Local Service'} · ${lead?.city||'Central Illinois'}`);form.set('line_items[0][price_data][product_data][description]',`Lead access for ${business?.name||'your business'}. Consumer contact details are delivered only after successful payment.`);form.set('metadata[app]','central-il-local-pros');form.set('metadata[tenant_id]',TENANT_ID);form.set('metadata[checkout_kind]','lead_purchase');form.set('metadata[lead_offer_id]',offer.id);form.set('metadata[lead_id]',offer.lead_id);form.set('metadata[business_id]',offer.business_id);form.set('payment_intent_data[metadata][app]','central-il-local-pros');form.set('payment_intent_data[metadata][checkout_kind]','lead_purchase');form.set('payment_intent_data[metadata][lead_offer_id]',offer.id);form.set('payment_method_types[0]','card')
  const stripe=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded'},body:form});const session=await stripe.json() as any;if(!stripe.ok||!session?.id||!session?.url)return NextResponse.json({error:session?.error?.message||'Unable to create secure lead checkout.'},{status:502})
  const {error:updateError}=await s.from('lead_marketplace_offers').update({status:'checkout_pending',checkout_session_id:session.id,checkout_url:session.url}).eq('id',offer.id);if(updateError)return NextResponse.json({error:'Checkout was created but the offer record could not be updated. Contact support before paying.'},{status:500})
  return NextResponse.json({ok:true,url:session.url})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to start lead checkout.'},{status:400})}
}
