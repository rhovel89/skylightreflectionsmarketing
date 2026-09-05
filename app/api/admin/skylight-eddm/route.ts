import{NextResponse}from'next/server'
import{createClient}from'@/lib/supabase/server'
import{requireAdmin}from'@/lib/auth'
import{TENANT_ID}from'@/lib/constants'

const str=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n)
const intOrNull=(v:unknown,min=0,max=100000000)=>{if(v===''||v==null)return null;const n=Math.round(Number(v));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):null}
const numOrNull=(v:unknown,min=0,max=100000)=>{if(v===''||v==null)return null;const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):null}
const centsOrNull=(v:unknown)=>{if(v===''||v==null)return null;const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.round(n*100)):null}
const dateOrNull=(v:unknown)=>{const x=str(v,40);return /^\d{4}-\d{2}-\d{2}$/.test(x)?x:null}
const states=['gathering_interest','threshold_met','quoting','scheduled','active','completed','cancelled']
const interestStates=['new','contacted','qualified','waitlist','quoted','committed','won','lost','cancelled']
const productionStates=['interest','selling','filled','artwork','payment','ready_to_print','printing','usps_drop','mailed','completed','on_hold','cancelled']
const spotStates=['held','reserved','artwork','approved','paid','print_ready','cancelled','retired']
const artworkStates=['not_received','received','needs_changes','proof_ready','approved','print_ready']
const assetTypes=['customer_artwork','proof','approved_proof','print_ready','usps_document','other']
const assetStates=['uploaded','needs_changes','approved','superseded']

type Db=Awaited<ReturnType<typeof createClient>>
async function logActivity(s:Db,userId:string,p:{market_id?:string|null;interest_id?:string|null;spot_id?:string|null;event_type:string;message:string;metadata?:Record<string,unknown>}){
  await s.from('skylight_eddm_activity').insert({tenant_id:TENANT_ID,market_id:p.market_id||null,interest_id:p.interest_id||null,spot_id:p.spot_id||null,event_type:p.event_type,message:p.message,metadata:p.metadata||{},actor_user_id:userId})
}

export async function POST(req:Request){
  try{
    const{claims}=await requireAdmin('/admin/skylight-eddm'),userId=String(claims.sub),body=await req.json() as Record<string,any>,action=str(body.action,60),s=await createClient()

    if(action==='save_settings'){
      const payload={tenant_id:TENANT_ID,coop_enabled:body.coop_enabled!==false,single_business_enabled:body.single_business_enabled!==false,default_piece_count:intOrNull(body.default_piece_count,1,10000000)||10000,default_coop_required_businesses:intOrNull(body.default_coop_required_businesses,2,50),public_note:str(body.public_note,1600)||null,internal_note:str(body.internal_note,2400)||null,updated_by:userId,updated_at:new Date().toISOString()}
      const{error}=await s.from('skylight_eddm_settings').upsert(payload,{onConflict:'tenant_id'});if(error)throw error
      return NextResponse.json({ok:true})
    }

    if(action==='save_package'){
      const id=str(body.id,40),key=str(body.package_key,80),name=str(body.name,180)
      if(!id||!key||!name)return NextResponse.json({error:'Package, key and name are required.'},{status:400})
      const mode=['coop','single_business','both'].includes(str(body.mode,30))?str(body.mode,30):'coop',billing=['one_time','monthly','custom'].includes(str(body.billing_period,30))?str(body.billing_period,30):'custom'
      const patch:any={package_key:key,name,mode,billing_period:billing,price_cents:centsOrNull(body.price),ad_width_in:numOrNull(body.ad_width_in,0,100),ad_height_in:numOrNull(body.ad_height_in,0,100),slot_count:intOrNull(body.slot_count,1,100),default_piece_count:intOrNull(body.default_piece_count,1,10000000),description:str(body.description,2400)||null,sort_order:intOrNull(body.sort_order,0,9999)||0,active:body.active!==false,public_visible:body.public_visible!==false,updated_by:userId,updated_at:new Date().toISOString()}
      if(body.slot_prefix!==undefined)patch.slot_prefix=str(body.slot_prefix,8).toUpperCase()||null
      const{error}=await s.from('skylight_eddm_packages').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error
      return NextResponse.json({ok:true})
    }

    if(action==='save_slot_template'){
      const id=str(body.id,40),prefix=str(body.slot_prefix,8).toUpperCase(),slots=intOrNull(body.slot_count,1,100)
      if(!id||!prefix||!slots)return NextResponse.json({error:'Slot prefix and slot count are required.'},{status:400})
      const{error}=await s.from('skylight_eddm_packages').update({slot_prefix:prefix,slot_count:slots,updated_by:userId,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error
      return NextResponse.json({ok:true})
    }

    if(action==='save_market'){
      const id=str(body.id,40),name=str(body.name,180)
      if(!name)return NextResponse.json({error:'Market name is required.'},{status:400})
      const status=states.includes(str(body.status,40))?str(body.status,40):'gathering_interest',zips=str(body.postal_codes,600).split(',').map(x=>x.trim()).filter(Boolean).slice(0,50)
      const payload:any={tenant_id:TENANT_ID,name,city:str(body.city,120)||null,state:str(body.state,20).toUpperCase()||null,county:str(body.county,120)||null,postal_codes:zips,area_description:str(body.area_description,1000)||null,status,public_interest_open:body.public_interest_open!==false,required_businesses:intOrNull(body.required_businesses,2,50),target_piece_count:intOrNull(body.target_piece_count,1,10000000),target_mail_date:dateOrNull(body.target_mail_date),updated_by:userId,updated_at:new Date().toISOString()}
      if(!id){payload.campaign_mode='coop';payload.production_status='interest'}
      let marketId=id
      if(id){const q=await s.from('skylight_eddm_markets').update(payload).eq('tenant_id',TENANT_ID).eq('id',id).select('id').single();if(q.error)throw q.error}
      else{const q=await s.from('skylight_eddm_markets').insert({...payload,created_by:userId}).select('id').single();if(q.error)throw q.error;marketId=String(q.data.id);await logActivity(s,userId,{market_id:marketId,event_type:'market_created',message:`Co-op market ${name} created.`})}
      if(marketId&&payload.status==='gathering_interest'&&payload.required_businesses){const{count,error}=await s.from('skylight_eddm_interests').select('id',{count:'exact',head:true}).eq('market_id',marketId).neq('status','lost').neq('status','cancelled');if(error)throw error;if(Number(count||0)>=Number(payload.required_businesses))await s.from('skylight_eddm_markets').update({status:'threshold_met',updated_at:new Date().toISOString()}).eq('id',marketId)}
      return NextResponse.json({ok:true,id:marketId})
    }

    if(action==='save_market_production'){
      const id=str(body.id,40),stage=str(body.production_status,40)
      if(!id||!productionStates.includes(stage))return NextResponse.json({error:'Valid production job and stage are required.'},{status:400})
      const before=await s.from('skylight_eddm_markets').select('id,name,production_status,campaign_mode').eq('tenant_id',TENANT_ID).eq('id',id).single();if(before.error)throw before.error
      const now=new Date(),today=now.toISOString().slice(0,10)
      const patch:any={production_status:stage,target_piece_count:intOrNull(body.target_piece_count,1,10000000),target_mail_date:dateOrNull(body.target_mail_date),actual_mail_date:dateOrNull(body.actual_mail_date),artwork_due_date:dateOrNull(body.artwork_due_date),print_due_date:dateOrNull(body.print_due_date),target_revenue_cents:centsOrNull(body.target_revenue),print_vendor:str(body.print_vendor,240)||null,usps_drop_location:str(body.usps_drop_location,300)||null,usps_confirmation:str(body.usps_confirmation,300)||null,print_cost_estimate_cents:centsOrNull(body.print_cost_estimate)??0,postage_cost_estimate_cents:centsOrNull(body.postage_cost_estimate)??0,design_cost_estimate_cents:centsOrNull(body.design_cost_estimate)??0,other_cost_estimate_cents:centsOrNull(body.other_cost_estimate)??0,print_cost_actual_cents:centsOrNull(body.print_cost_actual)??0,postage_cost_actual_cents:centsOrNull(body.postage_cost_actual)??0,design_cost_actual_cents:centsOrNull(body.design_cost_actual)??0,other_cost_actual_cents:centsOrNull(body.other_cost_actual)??0,production_notes:str(body.production_notes,5000)||null,updated_by:userId,updated_at:now.toISOString()}
      if(stage==='mailed'){patch.mailed_at=now.toISOString();if(!patch.actual_mail_date)patch.actual_mail_date=today}
      if(stage==='completed'){patch.completed_at=now.toISOString();patch.status='completed';patch.public_interest_open=false}
      if(stage==='cancelled'){patch.status='cancelled';patch.public_interest_open=false}
      const{error}=await s.from('skylight_eddm_markets').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error
      if(before.data.production_status!==stage)await logActivity(s,userId,{market_id:id,event_type:'production_stage_changed',message:`${before.data.name} moved from ${str(before.data.production_status,60).replaceAll('_',' ')} to ${stage.replaceAll('_',' ')}.`,metadata:{from:before.data.production_status,to:stage}})
      return NextResponse.json({ok:true})
    }

    if(action==='start_single_job'){
      const id=str(body.id,40),q=await s.from('skylight_eddm_interests').select('*').eq('tenant_id',TENANT_ID).eq('id',id).single();if(q.error)throw q.error
      const i=q.data;if(i.mode!=='single_business')return NextResponse.json({error:'Only dedicated EDDM requests can use this action.'},{status:400});if(i.market_id)return NextResponse.json({ok:true,id:i.market_id})
      let targetRevenue=i.commitment_amount_cents??null
      if(i.invoice_id){const inv=await s.from('skylight_invoices').select('total_cents').eq('tenant_id',TENANT_ID).eq('id',i.invoice_id).maybeSingle();if(inv.error)throw inv.error;if(inv.data)targetRevenue=inv.data.total_cents}
      const job=await s.from('skylight_eddm_markets').insert({tenant_id:TENANT_ID,name:`${String(i.business_name)} — Dedicated EDDM`,city:i.city||null,state:i.state||null,postal_codes:i.postal_code?[String(i.postal_code)]:[],area_description:i.area_description||null,campaign_mode:'single_business',status:'scheduled',production_status:['committed','won'].includes(String(i.status))?'artwork':'selling',public_interest_open:false,target_piece_count:i.desired_piece_count||null,target_revenue_cents:targetRevenue,created_by:userId,updated_by:userId}).select('id').single();if(job.error)throw job.error
      const{error}=await s.from('skylight_eddm_interests').update({market_id:job.data.id,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error
      await logActivity(s,userId,{market_id:String(job.data.id),interest_id:id,event_type:'production_job_created',message:`Dedicated EDDM production job created for ${i.business_name}.`})
      return NextResponse.json({ok:true,id:job.data.id})
    }

    if(action==='sync_spots'){
      const marketId=str(body.market_id,40);const{data,error}=await s.rpc('admin_sync_eddm_market_spots',{p_market_id:marketId});if(error)throw error
      return NextResponse.json({ok:true,inserted:data})
    }

    if(action==='reserve_spot'){
      const spotId=str(body.spot_id,40),interestId=str(body.interest_id,40),mode=str(body.reservation_mode,20)==='hold'?'hold':'reserve'
      const{data,error}=await s.rpc('admin_reserve_eddm_spot',{p_spot_id:spotId,p_interest_id:interestId,p_mode:mode,p_agreed_price_cents:centsOrNull(body.price),p_hold_minutes:30});if(error)throw error
      return NextResponse.json({ok:true,data})
    }

    if(action==='release_spot'){
      const{data,error}=await s.rpc('admin_release_eddm_spot',{p_spot_id:str(body.spot_id,40),p_reason:str(body.reason,1200)||null});if(error)throw error
      return NextResponse.json({ok:true,data})
    }

    if(action==='update_spot'){
      const id=str(body.id,40),status=str(body.status,30);if(!spotStates.includes(status))return NextResponse.json({error:'Invalid spot status.'},{status:400})
      const q=await s.from('skylight_eddm_spots').select('id,market_id,interest_id,slot_code,status').eq('tenant_id',TENANT_ID).eq('id',id).single();if(q.error)throw q.error
      if(status==='retired'&&q.data.interest_id)return NextResponse.json({error:'Release the advertiser before retiring this spot.'},{status:400})
      const{error}=await s.from('skylight_eddm_spots').update({status,agreed_price_cents:centsOrNull(body.price),notes:str(body.notes,1800)||null,updated_by:userId,updated_at:new Date().toISOString()}).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error
      if(q.data.status!==status)await logActivity(s,userId,{market_id:q.data.market_id,interest_id:q.data.interest_id,spot_id:id,event_type:'spot_status_changed',message:`Spot ${q.data.slot_code} moved to ${status.replaceAll('_',' ')}.`,metadata:{from:q.data.status,to:status}})
      return NextResponse.json({ok:true})
    }

    if(action==='update_interest'){
      const id=str(body.id,40),patch:any={updated_at:new Date().toISOString()}
      if(body.status!==undefined){const status=str(body.status,30);if(!interestStates.includes(status))return NextResponse.json({error:'Invalid interest status.'},{status:400});patch.status=status;if(status==='committed')patch.committed_at=new Date().toISOString()}
      if(body.admin_notes!==undefined)patch.admin_notes=str(body.admin_notes,2400)||null
      if(body.artwork_status!==undefined){const a=str(body.artwork_status,30);if(!artworkStates.includes(a))return NextResponse.json({error:'Invalid artwork status.'},{status:400});patch.artwork_status=a;if(['approved','print_ready'].includes(a))patch.artwork_approved_at=new Date().toISOString()}
      if(body.artwork_due_date!==undefined)patch.artwork_due_date=dateOrNull(body.artwork_due_date)
      if(body.commitment_amount!==undefined)patch.commitment_amount_cents=centsOrNull(body.commitment_amount)
      if(body.production_notes!==undefined)patch.production_notes=str(body.production_notes,3000)||null
      const{error}=await s.from('skylight_eddm_interests').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error
      return NextResponse.json({ok:true})
    }

    if(action==='register_asset'){
      const interestId=str(body.interest_id,40),marketId=str(body.market_id,40)||null,spotId=str(body.spot_id,40)||null,assetType=str(body.asset_type,40),path=str(body.storage_path,1000),fileName=str(body.file_name,300)
      if(!interestId||!assetTypes.includes(assetType)||!fileName||!path.startsWith(`${TENANT_ID}/`))return NextResponse.json({error:'Valid private EDDM artwork metadata is required.'},{status:400})
      const iq=await s.from('skylight_eddm_interests').select('id,market_id,business_name').eq('tenant_id',TENANT_ID).eq('id',interestId).single();if(iq.error)throw iq.error
      if(marketId&&String(iq.data.market_id||'')!==marketId)return NextResponse.json({error:'Artwork campaign does not match advertiser.'},{status:400})
      const approved=['approved_proof','print_ready'].includes(assetType),assetStatus=approved?'approved':'uploaded'
      const ins=await s.from('skylight_eddm_artwork_assets').insert({tenant_id:TENANT_ID,market_id:marketId,interest_id:interestId,spot_id:spotId,asset_type:assetType,status:assetStatus,file_name:fileName,storage_path:path,mime_type:str(body.mime_type,120)||null,file_size_bytes:intOrNull(body.file_size_bytes,0,26214400),notes:str(body.notes,1800)||null,uploaded_by:userId,approved_by:approved?userId:null,approved_at:approved?new Date().toISOString():null}).select('id').single();if(ins.error)throw ins.error
      const artworkStatus=assetType==='customer_artwork'?'received':assetType==='proof'?'proof_ready':assetType==='approved_proof'?'approved':assetType==='print_ready'?'print_ready':null
      if(artworkStatus)await s.from('skylight_eddm_interests').update({artwork_status:artworkStatus,artwork_approved_at:approved?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',interestId)
      await logActivity(s,userId,{market_id:marketId,interest_id:interestId,spot_id:spotId,event_type:'artwork_uploaded',message:`${fileName} uploaded for ${iq.data.business_name}.`,metadata:{asset_type:assetType,asset_id:ins.data.id}})
      return NextResponse.json({ok:true,id:ins.data.id})
    }

    if(action==='update_asset'){
      const id=str(body.id,40),status=str(body.status,30);if(!assetStates.includes(status))return NextResponse.json({error:'Invalid artwork file status.'},{status:400})
      const q=await s.from('skylight_eddm_artwork_assets').select('*').eq('tenant_id',TENANT_ID).eq('id',id).single();if(q.error)throw q.error
      const patch:any={status,updated_at:new Date().toISOString()};if(body.notes!==undefined)patch.notes=str(body.notes,1800)||null;if(status==='approved'){patch.approved_by=userId;patch.approved_at=new Date().toISOString()}
      const{error}=await s.from('skylight_eddm_artwork_assets').update(patch).eq('tenant_id',TENANT_ID).eq('id',id);if(error)throw error
      if(q.data.interest_id){let a:string|null=null;if(status==='needs_changes')a='needs_changes';if(status==='approved')a=q.data.asset_type==='print_ready'?'print_ready':'approved';if(a)await s.from('skylight_eddm_interests').update({artwork_status:a,artwork_approved_at:status==='approved'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',q.data.interest_id)}
      await logActivity(s,userId,{market_id:q.data.market_id,interest_id:q.data.interest_id,spot_id:q.data.spot_id,event_type:'artwork_status_changed',message:`${q.data.file_name} marked ${status.replaceAll('_',' ')}.`,metadata:{asset_id:id,status}})
      return NextResponse.json({ok:true})
    }

    if(action==='delete_asset'){
      const id=str(body.id,40),q=await s.from('skylight_eddm_artwork_assets').select('*').eq('tenant_id',TENANT_ID).eq('id',id).single();if(q.error)throw q.error
      const rem=await s.storage.from('eddm-assets').remove([String(q.data.storage_path)]);if(rem.error)throw rem.error
      const del=await s.from('skylight_eddm_artwork_assets').delete().eq('tenant_id',TENANT_ID).eq('id',id);if(del.error)throw del.error
      await logActivity(s,userId,{market_id:q.data.market_id,interest_id:q.data.interest_id,spot_id:q.data.spot_id,event_type:'artwork_deleted',message:`${q.data.file_name} removed from private EDDM storage.`,metadata:{asset_id:id}})
      return NextResponse.json({ok:true})
    }

    if(action==='create_invoice'){
      const id=str(body.id,40),q=await s.from('skylight_eddm_interests').select('*').eq('tenant_id',TENANT_ID).eq('id',id).single();if(q.error)throw q.error
      const i=q.data;if(i.invoice_id)return NextResponse.json({error:'An invoice already exists for this EDDM request.'},{status:400})
      let clientId=i.client_id?String(i.client_id):''
      if(!clientId&&i.email){const c=await s.from('skylight_clients').select('id').eq('tenant_id',TENANT_ID).eq('email',String(i.email)).limit(1).maybeSingle();if(c.error)throw c.error;if(c.data)clientId=String(c.data.id)}
      if(!clientId){const c=await s.from('skylight_clients').insert({tenant_id:TENANT_ID,company_name:String(i.business_name),contact_name:i.contact_name||null,email:i.email||null,phone:i.phone||null,city:i.city||null,state:i.state||null,postal_code:i.postal_code||null,status:'prospect',internal_notes:`EDDM ${i.mode==='coop'?'co-op':'single-business'} request`,created_by:userId,updated_by:userId}).select('id').single();if(c.error)throw c.error;clientId=String(c.data.id)}
      const pkg=i.package_key?await s.from('skylight_eddm_packages').select('*').eq('tenant_id',TENANT_ID).eq('package_key',String(i.package_key)).maybeSingle():{data:null,error:null};if(pkg.error)throw pkg.error
      const inv=await s.from('skylight_invoices').insert({tenant_id:TENANT_ID,client_id:clientId,status:'draft',issue_date:new Date().toISOString().slice(0,10),client_note:`EDDM ${i.mode==='coop'?'Co-op Community Mailer':'Single-Business Campaign'} — ${[i.city,i.state,i.postal_code].filter(Boolean).join(' ')||'market to be confirmed'}. ${i.desired_piece_count?`${Number(i.desired_piece_count).toLocaleString()} requested pieces.`:''}`,internal_note:`Created from EDDM interest ${i.id}. Co-op interest/threshold does not authorize billing or scheduling.`,created_by:userId,updated_by:userId}).select('id,invoice_number,public_token').single();if(inv.error)throw inv.error
      const items:any[]=[{invoice_id:inv.data.id,description:pkg.data?.name||'EDDM & Direct Mail',detail:i.mode==='coop'?'Co-op mailer participation — final market, routes and mail date require Skylight confirmation.':'Dedicated single-business EDDM campaign — final routes, print and postage scope to be confirmed.',quantity:1,unit_price_cents:Number(pkg.data?.price_cents||i.commitment_amount_cents||0),line_discount_cents:0,sort_order:10}]
      if(i.smart_coupon){const add=await s.from('skylight_eddm_packages').select('name,price_cents,billing_period').eq('tenant_id',TENANT_ID).eq('package_key','smart-coupon').maybeSingle();if(add.error)throw add.error;if(add.data)items.push({invoice_id:inv.data.id,description:add.data.name,detail:add.data.billing_period==='monthly'?'Initial month shown; recurring billing terms must be confirmed separately.':null,quantity:1,unit_price_cents:Number(add.data.price_cents||0),line_discount_cents:0,sort_order:20})}
      const itemRes=await s.from('skylight_invoice_items').insert(items);if(itemRes.error)throw itemRes.error
      const nextStatus=['committed','won'].includes(String(i.status))?i.status:'quoted'
      const upd=await s.from('skylight_eddm_interests').update({client_id:clientId,invoice_id:inv.data.id,status:nextStatus,updated_at:new Date().toISOString()}).eq('id',i.id);if(upd.error)throw upd.error
      await logActivity(s,userId,{market_id:i.market_id,interest_id:i.id,event_type:'invoice_created',message:`Draft invoice ${inv.data.invoice_number} created for ${i.business_name}.`,metadata:{invoice_id:inv.data.id}})
      return NextResponse.json({ok:true,data:inv.data,public_url:`/invoice/${inv.data.public_token}`})
    }

    return NextResponse.json({error:'Unsupported EDDM admin action.'},{status:400})
  }catch(e:any){return NextResponse.json({error:String(e?.message||'Unable to process EDDM admin action.')},{status:400})}
}
