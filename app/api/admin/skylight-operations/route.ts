import{NextResponse}from'next/server'
import{createClient}from'@/lib/supabase/server'
import{requireAdmin}from'@/lib/auth'
import{TENANT_ID}from'@/lib/constants'

const str=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n)
const id=(v:unknown)=>{const x=str(v,40);return /^[0-9a-f-]{36}$/i.test(x)?x:null}
const num=(v:unknown,min=0,max=1_000_000)=>Math.min(max,Math.max(min,Number(v)||0))
const int=(v:unknown,min=0,max=2_000_000_000)=>Math.min(max,Math.max(min,Math.round(Number(v)||0)))
const cents=(v:unknown)=>int((Number(v)||0)*100)
const date=(v:unknown)=>{const x=str(v,40);return /^\d{4}-\d{2}-\d{2}$/.test(x)?x:null}
const intervals=['one_time','monthly','quarterly','annual','custom']
const projectStates=['pending_payment','onboarding','active','waiting_client','on_hold','review','completed','cancelled']
const healthStates=['on_track','attention','at_risk','blocked']
const taskStates=['todo','in_progress','waiting_client','review','done','cancelled']
const milestoneStates=['planned','in_progress','waiting_client','completed','skipped']
const recurringStates=['planned','active','paused','cancelled','completed']

export async function POST(req:Request){
 try{
  const{claims}=await requireAdmin('/admin/skylight-operations'),userId=String(claims.sub),body=await req.json() as Record<string,any>,action=str(body.action,60),s=await createClient()

  if(action==='create_proposal'){
   const clientId=id(body.client_id),title=str(body.title,180)
   if(!clientId||!title)return NextResponse.json({error:'Client and proposal title are required.'},{status:400})
   const rawItems=Array.isArray(body.items)?body.items.slice(0,40):[]
   if(!rawItems.length)return NextResponse.json({error:'Add at least one service or custom line item.'},{status:400})
   const serviceIds=[...new Set(rawItems.map((x:any)=>id(x.service_id)).filter(Boolean))] as string[]
   let serviceRows:any[]=[]
   if(serviceIds.length){const q=await s.from('skylight_service_catalog').select('*').eq('tenant_id',TENANT_ID).in('id',serviceIds);if(q.error)throw q.error;serviceRows=q.data??[]}
   const serviceMap=new Map(serviceRows.map(x=>[String(x.id),x]))
   const defaults=rawItems.map((x:any)=>serviceMap.get(String(id(x.service_id)||''))).filter(Boolean)
   const scope=str(body.scope_summary,6000)||[...new Set(defaults.map((x:any)=>str(x.default_scope,2000)).filter(Boolean))].join('\n\n')||null
   const terms=str(body.terms,8000)||[...new Set(defaults.map((x:any)=>str(x.default_terms,2400)).filter(Boolean))].join('\n\n')||null
   const requiresSignature=body.requires_signature===undefined?defaults.some((x:any)=>x.requires_agreement!==false):Boolean(body.requires_signature)
   const proposal=await s.from('skylight_proposals').insert({tenant_id:TENANT_ID,client_id:clientId,title,intro:str(body.intro,4000)||null,scope_summary:scope,terms,internal_note:str(body.internal_note,4000)||null,issue_date:date(body.issue_date)||new Date().toISOString().slice(0,10),expires_at:date(body.expires_at),proposed_start_date:date(body.proposed_start_date),discount_cents:cents(body.discount),requires_signature:requiresSignature,created_by:userId,updated_by:userId}).select('id,proposal_number').single()
   if(proposal.error)throw proposal.error
   const clean=rawItems.map((x:any,i:number)=>{const sid=id(x.service_id),svc=sid?serviceMap.get(sid):null;const unit=x.unit_price===''||x.unit_price==null?Number(svc?.default_price_cents||0):cents(x.unit_price);const billing=intervals.includes(str(x.billing_interval,30))?str(x.billing_interval,30):String(svc?.default_billing_interval||'one_time');return{proposal_id:proposal.data.id,service_id:sid,service_name_snapshot:svc?.name||null,description:str(x.description,260)||String(svc?.name||'Custom Service'),detail:str(x.detail,2000)||null,quantity:Math.max(.01,Math.min(10000,Number(x.quantity)||1)),unit_price_cents:unit,line_discount_cents:cents(x.line_discount),billing_interval:billing,sort_order:(i+1)*10}})
   const add=await s.from('skylight_proposal_items').insert(clean);if(add.error)throw add.error
   const totals=await s.from('skylight_proposals').select('total_cents').eq('id',proposal.data.id).single();if(totals.error)throw totals.error
   const explicitDeposit=body.deposit_required!==''&&body.deposit_required!=null
   const defaultBps=defaults.reduce((m:number,x:any)=>Math.max(m,Number(x.default_deposit_bps||0)),0)
   const bps=body.deposit_percent!==''&&body.deposit_percent!=null?int(Number(body.deposit_percent)*100,0,10000):defaultBps
   const deposit=explicitDeposit?cents(body.deposit_required):Math.round(Number(totals.data.total_cents||0)*bps/10000)
   const up=await s.from('skylight_proposals').update({deposit_required_cents:deposit,updated_by:userId,updated_at:new Date().toISOString()}).eq('id',proposal.data.id);if(up.error)throw up.error
   return NextResponse.json({ok:true,id:proposal.data.id,proposal_number:proposal.data.proposal_number})
  }

  if(action==='update_proposal'){
   const proposalId=id(body.id);if(!proposalId)return NextResponse.json({error:'Proposal is required.'},{status:400})
   const q=await s.from('skylight_proposals').select('status').eq('tenant_id',TENANT_ID).eq('id',proposalId).single();if(q.error)throw q.error
   if(!['draft','sent','viewed'].includes(String(q.data.status)))return NextResponse.json({error:'Accepted or converted proposals are locked to preserve the agreement snapshot.'},{status:409})
   const patch:any={updated_by:userId,updated_at:new Date().toISOString()}
   for(const k of ['title','intro','scope_summary','terms','internal_note'])if(body[k]!==undefined)patch[k]=str(body[k],k==='title'?180:8000)||null
   if(body.expires_at!==undefined)patch.expires_at=date(body.expires_at);if(body.proposed_start_date!==undefined)patch.proposed_start_date=date(body.proposed_start_date)
   if(body.discount!==undefined)patch.discount_cents=cents(body.discount);if(body.deposit_required!==undefined)patch.deposit_required_cents=cents(body.deposit_required);if(body.requires_signature!==undefined)patch.requires_signature=Boolean(body.requires_signature)
   const up=await s.from('skylight_proposals').update(patch).eq('tenant_id',TENANT_ID).eq('id',proposalId);if(up.error)throw up.error
   return NextResponse.json({ok:true})
  }

  if(action==='add_proposal_item'){
   const proposalId=id(body.proposal_id),serviceId=id(body.service_id);if(!proposalId)return NextResponse.json({error:'Proposal is required.'},{status:400})
   const p=await s.from('skylight_proposals').select('status').eq('tenant_id',TENANT_ID).eq('id',proposalId).single();if(p.error)throw p.error;if(!['draft','sent','viewed'].includes(String(p.data.status)))return NextResponse.json({error:'Proposal items are locked after acceptance.'},{status:409})
   let svc:any=null;if(serviceId){const q=await s.from('skylight_service_catalog').select('*').eq('tenant_id',TENANT_ID).eq('id',serviceId).maybeSingle();if(q.error)throw q.error;svc=q.data}
   const ins=await s.from('skylight_proposal_items').insert({proposal_id:proposalId,service_id:serviceId,service_name_snapshot:svc?.name||null,description:str(body.description,260)||svc?.name||'Custom Service',detail:str(body.detail,2000)||null,quantity:Math.max(.01,Math.min(10000,Number(body.quantity)||1)),unit_price_cents:body.unit_price===''||body.unit_price==null?Number(svc?.default_price_cents||0):cents(body.unit_price),line_discount_cents:cents(body.line_discount),billing_interval:intervals.includes(str(body.billing_interval,30))?str(body.billing_interval,30):svc?.default_billing_interval||'one_time',sort_order:int(body.sort_order,0,9999)}).select('id').single();if(ins.error)throw ins.error
   return NextResponse.json({ok:true,id:ins.data.id})
  }

  if(action==='delete_proposal_item'){
   const itemId=id(body.id);if(!itemId)return NextResponse.json({error:'Item is required.'},{status:400})
   const{error}=await s.from('skylight_proposal_items').delete().eq('id',itemId);if(error)throw error;return NextResponse.json({ok:true})
  }

  if(action==='send_proposal'){const proposalId=id(body.id);if(!proposalId)return NextResponse.json({error:'Proposal is required.'},{status:400});const{data,error}=await s.rpc('admin_send_skylight_proposal',{p_proposal_id:proposalId});if(error)throw error;return NextResponse.json(data)}
  if(action==='portal_invite'){const clientId=id(body.client_id);if(!clientId)return NextResponse.json({error:'Client is required.'},{status:400});const origin=new URL(req.url).origin;const{data,error}=await s.rpc('admin_create_skylight_portal_invite',{p_client_id:clientId,p_base_url:origin,p_send_email:body.send_email!==false});if(error)throw error;return NextResponse.json(data)}
  if(action==='invoice_from_proposal'){const proposalId=id(body.id);if(!proposalId)return NextResponse.json({error:'Proposal is required.'},{status:400});const{data,error}=await s.rpc('admin_create_skylight_invoice_from_proposal',{p_proposal_id:proposalId,p_deposit_only:Boolean(body.deposit_only)});if(error)throw error;return NextResponse.json(data)}

  if(action==='save_task_template'){
   const templateId=id(body.id),serviceId=id(body.service_id),title=str(body.title,220);if(!serviceId||!title)return NextResponse.json({error:'Service and task title are required.'},{status:400})
   const payload={tenant_id:TENANT_ID,service_id:serviceId,title,description:str(body.description,2000)||null,phase:str(body.phase,120)||'delivery',offset_days:int(body.offset_days,-365,3650),priority:['low','normal','high','urgent'].includes(str(body.priority,20))?str(body.priority,20):'normal',client_visible:Boolean(body.client_visible),requires_client_approval:Boolean(body.requires_client_approval),active:body.active!==false,sort_order:int(body.sort_order,0,9999),updated_by:userId,updated_at:new Date().toISOString()}
   let q;if(templateId)q=await s.from('skylight_service_task_templates').update(payload).eq('tenant_id',TENANT_ID).eq('id',templateId).select('id').single();else q=await s.from('skylight_service_task_templates').insert({...payload,created_by:userId}).select('id').single();if(q.error)throw q.error;return NextResponse.json({ok:true,id:q.data.id})
  }
  if(action==='delete_task_template'){const templateId=id(body.id);if(!templateId)return NextResponse.json({error:'Template is required.'},{status:400});const{error}=await s.from('skylight_service_task_templates').delete().eq('tenant_id',TENANT_ID).eq('id',templateId);if(error)throw error;return NextResponse.json({ok:true})}

  if(action==='save_package'){
   const packageId=id(body.id),name=str(body.name,180);if(!name)return NextResponse.json({error:'Package name is required.'},{status:400});const packageSlug=(str(body.slug,120)||name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)
   const payload={tenant_id:TENANT_ID,name,slug:packageSlug,description:str(body.description,3000)||null,package_price_cents:body.package_price===''||body.package_price==null?null:cents(body.package_price),billing_interval:intervals.includes(str(body.billing_interval,30))?str(body.billing_interval,30):'one_time',active:body.active!==false,public_visible:Boolean(body.public_visible),sort_order:int(body.sort_order,0,9999),updated_by:userId,updated_at:new Date().toISOString()}
   let q;if(packageId)q=await s.from('skylight_service_packages').update(payload).eq('tenant_id',TENANT_ID).eq('id',packageId).select('id').single();else q=await s.from('skylight_service_packages').insert({...payload,created_by:userId}).select('id').single();if(q.error)throw q.error;const pid=String(q.data.id)
   if(Array.isArray(body.items)){const del=await s.from('skylight_service_package_items').delete().eq('package_id',pid);if(del.error)throw del.error;const items=body.items.slice(0,40).map((x:any,i:number)=>({package_id:pid,service_id:id(x.service_id),quantity:Math.max(.01,Math.min(10000,Number(x.quantity)||1)),included_note:str(x.included_note,1200)||null,sort_order:(i+1)*10})).filter((x:any)=>x.service_id);if(items.length){const add=await s.from('skylight_service_package_items').insert(items);if(add.error)throw add.error}}
   return NextResponse.json({ok:true,id:pid})
  }

  if(action==='update_project'){
   const projectId=id(body.id);if(!projectId)return NextResponse.json({error:'Project is required.'},{status:400});const patch:any={updated_by:userId,updated_at:new Date().toISOString()}
   if(projectStates.includes(str(body.status,30)))patch.status=str(body.status,30);if(healthStates.includes(str(body.health,20)))patch.health=str(body.health,20);if(body.progress_pct!==undefined)patch.progress_pct=int(body.progress_pct,0,100);if(body.start_date!==undefined)patch.start_date=date(body.start_date);if(body.due_date!==undefined)patch.due_date=date(body.due_date);if(body.client_visible_update!==undefined)patch.client_visible_update=str(body.client_visible_update,5000)||null;if(body.internal_note!==undefined)patch.internal_note=str(body.internal_note,5000)||null;if(patch.status==='completed')patch.completed_at=new Date().toISOString()
   const{error}=await s.from('skylight_projects').update(patch).eq('tenant_id',TENANT_ID).eq('id',projectId);if(error)throw error;return NextResponse.json({ok:true})
  }

  if(action==='save_task'){
   const taskId=id(body.id),projectId=id(body.project_id),title=str(body.title,220);if(!projectId||!title)return NextResponse.json({error:'Project and task title are required.'},{status:400});const payload:any={project_id:projectId,milestone_id:id(body.milestone_id),service_id:id(body.service_id),title,description:str(body.description,2400)||null,status:taskStates.includes(str(body.status,30))?str(body.status,30):'todo',priority:['low','normal','high','urgent'].includes(str(body.priority,20))?str(body.priority,20):'normal',due_date:date(body.due_date),client_visible:Boolean(body.client_visible),requires_client_approval:Boolean(body.requires_client_approval),sort_order:int(body.sort_order,0,9999),updated_by:userId,updated_at:new Date().toISOString()}
   let q;if(taskId)q=await s.from('skylight_project_tasks').update(payload).eq('id',taskId).select('id').single();else q=await s.from('skylight_project_tasks').insert({...payload,created_by:userId}).select('id').single();if(q.error)throw q.error;return NextResponse.json({ok:true,id:q.data.id})
  }

  if(action==='save_milestone'){
   const milestoneId=id(body.id),projectId=id(body.project_id),title=str(body.title,220);if(!projectId||!title)return NextResponse.json({error:'Project and milestone title are required.'},{status:400});const payload:any={project_id:projectId,title,description:str(body.description,2400)||null,status:milestoneStates.includes(str(body.status,30))?str(body.status,30):'planned',target_date:date(body.target_date),client_visible:body.client_visible!==false,sort_order:int(body.sort_order,0,9999),updated_by:userId,updated_at:new Date().toISOString()};if(payload.status==='completed')payload.completed_at=new Date().toISOString()
   let q;if(milestoneId)q=await s.from('skylight_project_milestones').update(payload).eq('id',milestoneId).select('id').single();else q=await s.from('skylight_project_milestones').insert({...payload,created_by:userId}).select('id').single();if(q.error)throw q.error;return NextResponse.json({ok:true,id:q.data.id})
  }

  if(action==='update_recurring'){
   const recurringId=id(body.id);if(!recurringId)return NextResponse.json({error:'Recurring service is required.'},{status:400});const patch:any={updated_by:userId,updated_at:new Date().toISOString()};if(recurringStates.includes(str(body.status,30)))patch.status=str(body.status,30);if(body.amount!==undefined)patch.amount_cents=cents(body.amount);if(body.start_date!==undefined)patch.start_date=date(body.start_date);if(body.next_invoice_date!==undefined)patch.next_invoice_date=date(body.next_invoice_date);if(body.contract_end_date!==undefined)patch.contract_end_date=date(body.contract_end_date);if(body.auto_renew!==undefined)patch.auto_renew=Boolean(body.auto_renew);if(body.internal_note!==undefined)patch.internal_note=str(body.internal_note,3000)||null;const{error}=await s.from('skylight_recurring_services').update(patch).eq('tenant_id',TENANT_ID).eq('id',recurringId);if(error)throw error;return NextResponse.json({ok:true})
  }

  return NextResponse.json({error:'Unsupported Skylight operations action.'},{status:400})
 }catch(e:any){return NextResponse.json({error:String(e?.message||'Unable to process Skylight operations action.')},{status:400})}
}
