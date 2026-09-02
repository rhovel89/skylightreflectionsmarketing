// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

const TENANT_ID='6673621d-b359-4c17-a984-c8f50d914eb3'
const APP_ID='central-il-local-pros'
const ACTIVE_STATUSES=new Set(['active','trialing','past_due'])
const enc=new TextEncoder()

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})}
function asId(v:any){return typeof v==='string'?v:(v&&typeof v.id==='string'?v.id:null)}
function unixTs(v:any){return typeof v==='number'?new Date(v*1000).toISOString():null}
function fieldValue(fields:any[],key:string){const f=(fields||[]).find((x:any)=>x?.key===key);return f?.text?.value||f?.numeric?.value||f?.dropdown?.value||null}
function listingSlug(value:string|null){if(!value)return null;try{const u=new URL(value);const m=u.pathname.match(/^\/business\/([^/?#]+)/i);return m?decodeURIComponent(m[1]):null}catch{const m=value.match(/\/business\/([^/?#]+)/i);return m?decodeURIComponent(m[1]):null}}
function normalizeInterval(value:any){const v=String(value||'').toLowerCase();if(v==='monthly'||v==='month')return'monthly';if(v==='annual'||v==='yearly'||v==='year')return'annual';return null}
function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0}
function belongsToDirectory(obj:any){const metadata=obj?.metadata||{};return metadata.app===APP_ID||metadata.tenant_id===TENANT_ID}
async function verifyStripeSignature(raw:string,header:string|null,secret:string|null){if(!header||!secret)return false;const parts=header.split(',').map(x=>x.trim()),t=parts.find(x=>x.startsWith('t='))?.slice(2),sigs=parts.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));if(!t||!sigs.length)return false;const ts=Number(t);if(!Number.isFinite(ts)||Math.abs(Math.floor(Date.now()/1000)-ts)>300)return false;const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const expected=hex(await crypto.subtle.sign('HMAC',key,enc.encode(`${t}.${raw}`)));return sigs.some(sig=>safeEqual(sig,expected))}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({ok:true})
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
  const raw=await req.text(),secretResult=await db.rpc('get_server_integration_secret',{p_key:'stripe_directory_webhook_signing_secret'})
  if(secretResult.error||!await verifyStripeSignature(raw,req.headers.get('Stripe-Signature'),secretResult.data as string|null))return json({error:'invalid signature'},400)
  let event:any;try{event=JSON.parse(raw)}catch{return json({error:'invalid json'},400)}
  if(!event?.id||!event?.type||!event?.data?.object)return json({error:'invalid event'},400)
  const existing=await db.from('stripe_webhook_events').select('event_id,status').eq('event_id',event.id).maybeSingle();if(existing.data?.status==='processed')return json({ok:true,duplicate:true})
  await db.from('stripe_webhook_events').upsert({event_id:event.id,event_type:event.type,tenant_id:TENANT_ID,status:'received',received_at:new Date().toISOString()},{onConflict:'event_id'})
  const audit=async(action_type:string,action_text:string)=>{await db.from('audit_logs').insert({tenant_id:TENANT_ID,actor_user_id:null,action_type,action_text})}
  try{
    const obj=event.data.object
    if(event.type==='checkout.session.completed'){
      const planSlug=obj?.metadata?.plan_slug,interval=normalizeInterval(obj?.metadata?.billing_interval),subscriptionId=asId(obj.subscription),customerId=asId(obj.customer),businessName=fieldValue(obj.custom_fields,'business_name'),listingUrl=fieldValue(obj.custom_fields,'listing_url'),slug=listingSlug(listingUrl)
      if(!belongsToDirectory(obj)){await db.from('stripe_webhook_events').update({status:'processed',processed_at:new Date().toISOString(),error_message:null}).eq('event_id',event.id);return json({ok:true,ignored:true})}
      if(subscriptionId&&['verified','featured','pro'].includes(planSlug)){
        let business:any=null;if(slug){const r=await db.from('businesses').select('id,name,slug').eq('tenant_id',TENANT_ID).eq('slug',slug).eq('status','published').maybeSingle();business=r.data}if(!business&&businessName){const r=await db.from('businesses').select('id,name,slug').eq('tenant_id',TENANT_ID).ilike('name',businessName.trim()).eq('status','published').limit(2);if((r.data||[]).length===1)business=r.data![0]}
        const p=await db.from('plans').select('id,slug').eq('tenant_id',TENANT_ID).eq('slug',planSlug).maybeSingle()
        if(business&&p.data){
          const prior=await db.from('subscriptions').select('id').eq('provider','stripe').eq('provider_subscription_id',subscriptionId).maybeSingle();const row={tenant_id:TENANT_ID,business_id:business.id,plan_id:p.data.id,provider:'stripe',provider_customer_id:customerId,provider_subscription_id:subscriptionId,status:'active',billing_interval:interval,starts_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(prior.data)await db.from('subscriptions').update(row).eq('id',prior.data.id);else await db.from('subscriptions').insert(row)
          if(planSlug==='featured'||planSlug==='pro'){const existingSponsor=await db.from('sponsorships').select('id').eq('provider','stripe').eq('provider_subscription_id',subscriptionId).eq('placement','homepage_featured').maybeSingle();const sponsor={tenant_id:TENANT_ID,business_id:business.id,placement:'homepage_featured',starts_on:new Date().toISOString().slice(0,10),ends_on:null,active:true,provider:'stripe',provider_subscription_id:subscriptionId,origin:'stripe',priority:planSlug==='pro'?200:150,sort_order:100,rotation_weight:1};if(existingSponsor.data)await db.from('sponsorships').update(sponsor).eq('id',existingSponsor.data.id);else await db.from('sponsorships').insert(sponsor)}
          await audit('stripe_subscription_activated',`Stripe activated ${planSlug} (${interval||'unknown interval'}) for ${business.name} (${business.id}); subscription ${subscriptionId}. Verification status was not changed.`)
        }else{await db.from('stripe_webhook_events').update({status:'needs_review',processed_at:new Date().toISOString(),error_message:`Could not uniquely match published business or plan. plan=${planSlug}; business=${businessName||''}; listing=${listingUrl||''}; interval=${interval||''}`}).eq('event_id',event.id);return json({ok:true,needs_review:true})}
      }
    }
    if(event.type.startsWith('customer.subscription.')){
      const subscriptionId=asId(obj)
      if(subscriptionId){
        const existingSub=await db.from('subscriptions').select('id,business_id,status').eq('provider','stripe').eq('provider_subscription_id',subscriptionId).maybeSingle()
        if(existingSub.data||belongsToDirectory(obj)){
          const status=obj.status||'inactive',periodEnd=unixTs(obj.current_period_end),interval=normalizeInterval(obj?.items?.data?.[0]?.price?.recurring?.interval),update:any={status,current_period_end:periodEnd,ends_at:status==='canceled'?new Date().toISOString():null,updated_at:new Date().toISOString()};if(interval)update.billing_interval=interval
          await db.from('subscriptions').update(update).eq('provider','stripe').eq('provider_subscription_id',subscriptionId)
          const sponsoredActive=ACTIVE_STATUSES.has(status)
          await db.from('sponsorships').update({active:sponsoredActive,ends_on:sponsoredActive?null:new Date().toISOString().slice(0,10),updated_at:new Date().toISOString()}).eq('provider','stripe').eq('provider_subscription_id',subscriptionId)
          await audit('stripe_subscription_status_updated',`Stripe subscription ${subscriptionId} moved to ${status}; sponsored placement active=${sponsoredActive}.`)
        }
      }
    }
    if(event.type==='invoice.payment_failed'||event.type==='invoice.paid'){
      const subscriptionId=asId(obj.subscription)
      if(subscriptionId){
        const existingSub=await db.from('subscriptions').select('id,business_id').eq('provider','stripe').eq('provider_subscription_id',subscriptionId).maybeSingle()
        if(existingSub.data){
          if(event.type==='invoice.payment_failed'){
            await db.from('subscriptions').update({status:'past_due',updated_at:new Date().toISOString()}).eq('id',existingSub.data.id)
            await db.from('sponsorships').update({active:true,ends_on:null,updated_at:new Date().toISOString()}).eq('provider','stripe').eq('provider_subscription_id',subscriptionId)
            await audit('stripe_payment_failed',`Recurring payment failed for subscription ${subscriptionId}; status set past_due while Stripe recovery remains in progress. Sponsored access remains active during the recovery grace state.`)
          }else{
            await db.from('subscriptions').update({status:'active',ends_at:null,updated_at:new Date().toISOString()}).eq('id',existingSub.data.id)
            await db.from('sponsorships').update({active:true,ends_on:null,updated_at:new Date().toISOString()}).eq('provider','stripe').eq('provider_subscription_id',subscriptionId)
            await audit('stripe_invoice_paid',`Recurring invoice paid for subscription ${subscriptionId}; subscription and eligible sponsored access restored active.`)
          }
        }
      }
    }
    await db.from('stripe_webhook_events').update({status:'processed',processed_at:new Date().toISOString(),error_message:null}).eq('event_id',event.id);return json({ok:true})
  }catch(e){const message=e instanceof Error?e.message:String(e);await db.from('stripe_webhook_events').update({status:'error',processed_at:new Date().toISOString(),error_message:message.slice(0,1000)}).eq('event_id',event.id);return json({error:'processing failed'},500)}
})
