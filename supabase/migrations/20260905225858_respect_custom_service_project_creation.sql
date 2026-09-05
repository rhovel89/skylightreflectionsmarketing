alter table public.skylight_proposals add column if not exists create_project boolean not null default true;

create or replace function private.ensure_skylight_project(p_proposal_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.skylight_proposals%rowtype; a public.skylight_agreements%rowtype; v_project uuid; pi record; tt record; v_service_name text; v_due date;
begin
  select * into p from public.skylight_proposals where id=p_proposal_id;
  if p.id is null or not p.create_project then return null; end if;
  select * into a from public.skylight_agreements where proposal_id=p.id;
  select id into v_project from public.skylight_projects where proposal_id=p.id;
  if v_project is not null then return v_project; end if;
  v_due:=coalesce(p.proposed_start_date,current_date)+coalesce((select max(coalesce(s.default_duration_days,30)) from public.skylight_proposal_items x join public.skylight_service_catalog s on s.id=x.service_id where x.proposal_id=p.id),30);
  insert into public.skylight_projects(tenant_id,client_id,proposal_id,agreement_id,name,status,start_date,due_date,created_by,updated_by)
  values(p.tenant_id,p.client_id,p.id,a.id,p.title,case when p.deposit_required_cents>0 then 'pending_payment' else 'onboarding' end,p.proposed_start_date,v_due,auth.uid(),auth.uid()) returning id into v_project;
  for pi in select * from public.skylight_proposal_items where proposal_id=p.id order by sort_order,created_at loop
    v_service_name:=coalesce(pi.service_name_snapshot,pi.description);
    insert into public.skylight_project_services(project_id,service_id,proposal_item_id,name,billing_interval,agreed_amount_cents)
    values(v_project,pi.service_id,pi.id,v_service_name,pi.billing_interval,pi.line_total_cents);
    if pi.billing_interval in('monthly','quarterly','annual','custom') then
      insert into public.skylight_recurring_services(tenant_id,client_id,project_id,service_id,proposal_item_id,name,status,billing_interval,amount_cents,start_date,created_by,updated_by)
      values(p.tenant_id,p.client_id,v_project,pi.service_id,pi.id,v_service_name,'planned',pi.billing_interval,pi.line_total_cents,p.proposed_start_date,auth.uid(),auth.uid());
    end if;
    for tt in select * from public.skylight_service_task_templates where service_id=pi.service_id and active=true order by sort_order,created_at loop
      insert into public.skylight_project_tasks(project_id,service_id,title,description,status,priority,due_date,client_visible,requires_client_approval,sort_order,created_by,updated_by)
      values(v_project,pi.service_id,tt.title,tt.description,'todo',tt.priority,coalesce(p.proposed_start_date,current_date)+tt.offset_days,tt.client_visible,tt.requires_client_approval,tt.sort_order,auth.uid(),auth.uid());
    end loop;
  end loop;
  insert into public.skylight_project_milestones(project_id,title,description,status,target_date,client_visible,sort_order,created_by,updated_by) values
    (v_project,'Onboarding','Confirm access, assets, goals and kickoff requirements.','planned',coalesce(p.proposed_start_date,current_date),true,10,auth.uid(),auth.uid()),
    (v_project,'Delivery','Primary service production and implementation.','planned',v_due,true,20,auth.uid(),auth.uid()),
    (v_project,'Client Review','Client review, approvals and requested revisions where included.','planned',v_due,true,30,auth.uid(),auth.uid()),
    (v_project,'Completion','Final handoff, reporting or recurring-service transition.','planned',v_due,true,40,auth.uid(),auth.uid());
  update public.skylight_proposals set status='converted',converted_at=now(),updated_at=now() where id=p.id;
  insert into public.skylight_project_activity(tenant_id,client_id,proposal_id,agreement_id,project_id,event_type,message,metadata,actor_user_id)
  values(p.tenant_id,p.client_id,p.id,a.id,v_project,'project_created','Project workspace created from accepted proposal.',jsonb_build_object('project_status',case when p.deposit_required_cents>0 then 'pending_payment' else 'onboarding' end),auth.uid());
  return v_project;
end$$;
revoke all on function private.ensure_skylight_project(uuid) from public,anon,authenticated;

create or replace function public.customer_accept_skylight_proposal(p_proposal_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.skylight_proposals%rowtype; v_agreement uuid; v_project uuid;
begin
  select * into p from public.skylight_proposals where id=p_proposal_id for update;
  if p.id is null or not private.user_has_skylight_client_access(p.client_id,auth.uid()) then raise exception 'Proposal not available.'; end if;
  if p.status not in('sent','viewed') then raise exception 'This proposal is not awaiting acceptance.'; end if;
  if p.expires_at is not null and p.expires_at<current_date then update public.skylight_proposals set status='expired',updated_at=now() where id=p.id; raise exception 'This proposal has expired.'; end if;
  update public.skylight_proposals set status='accepted',accepted_at=now(),viewed_at=coalesce(viewed_at,now()),updated_at=now() where id=p.id;
  if p.requires_signature then v_agreement:=private.ensure_skylight_agreement(p.id); elsif p.create_project then v_project:=private.ensure_skylight_project(p.id); end if;
  perform private.notify_skylight_admins(p.tenant_id,'Skylight proposal accepted','A client accepted proposal '||p.proposal_number||'.','/admin/skylight-operations','skylight_proposal_accepted:'||p.id::text);
  insert into public.skylight_project_activity(tenant_id,client_id,proposal_id,agreement_id,project_id,event_type,message,actor_user_id) values(p.tenant_id,p.client_id,p.id,v_agreement,v_project,'proposal_accepted','Client accepted the proposal in the secure workspace.',auth.uid());
  return jsonb_build_object('ok',true,'agreement_id',v_agreement,'project_id',v_project,'requires_signature',p.requires_signature,'create_project',p.create_project);
end$$;
revoke all on function public.customer_accept_skylight_proposal(uuid) from public,anon;
grant execute on function public.customer_accept_skylight_proposal(uuid) to authenticated;

create or replace function public.customer_sign_skylight_agreement(p_agreement_id uuid,p_signer_name text,p_signer_title text default null,p_signer_ip text default null,p_user_agent text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.skylight_agreements%rowtype; p public.skylight_proposals%rowtype; v_project uuid; v_email text;
begin
  select * into a from public.skylight_agreements where id=p_agreement_id for update;
  if a.id is null or not private.user_has_skylight_client_access(a.client_id,auth.uid()) then raise exception 'Agreement not available.'; end if;
  if a.status<>'pending_signature' then raise exception 'This agreement is not awaiting signature.'; end if;
  if char_length(btrim(coalesce(p_signer_name,'')))<2 then raise exception 'Enter the authorized signer name.'; end if;
  select email into v_email from auth.users where id=auth.uid();
  update public.skylight_agreements set status='signed',signer_name=left(btrim(p_signer_name),180),signer_title=nullif(left(btrim(coalesce(p_signer_title,'')),180),''),signer_email=v_email,signer_user_id=auth.uid(),signer_ip=nullif(left(coalesce(p_signer_ip,''),120),''),signer_user_agent=nullif(left(coalesce(p_user_agent,''),1000),''),signed_at=now(),updated_at=now() where id=a.id;
  select * into p from public.skylight_proposals where id=a.proposal_id;
  if p.create_project then v_project:=private.ensure_skylight_project(a.proposal_id); end if;
  perform private.notify_skylight_admins(a.tenant_id,'Skylight agreement signed','A client electronically accepted agreement '||a.agreement_number||'.','/admin/skylight-operations','skylight_agreement_signed:'||a.id::text);
  perform private.notify_skylight_client_users(a.client_id,'Agreement signed','Your Skylight service agreement has been recorded. Any required invoice or deposit remains a separate billing step.','/account/skylight','skylight_agreement_signed_client:'||a.id::text);
  insert into public.skylight_project_activity(tenant_id,client_id,proposal_id,agreement_id,project_id,event_type,message,actor_user_id) values(a.tenant_id,a.client_id,a.proposal_id,a.id,v_project,'agreement_signed','Client electronically accepted the service agreement.',auth.uid());
  return jsonb_build_object('ok',true,'project_id',v_project,'agreement_id',a.id,'create_project',p.create_project);
end$$;
revoke all on function public.customer_sign_skylight_agreement(uuid,text,text,text,text) from public,anon;
grant execute on function public.customer_sign_skylight_agreement(uuid,text,text,text,text) to authenticated;

create or replace function public.get_my_skylight_workspace() returns jsonb language plpgsql security definer set search_path='' as $$ declare v_uid uuid:=auth.uid(); begin if v_uid is null then raise exception 'Sign in required.'; end if; return jsonb_build_object('clients',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'company_name',c.company_name,'contact_name',c.contact_name,'email',c.email,'status',c.status) order by c.company_name) from public.skylight_client_portal_access a join public.skylight_clients c on c.id=a.client_id where a.user_id=v_uid and a.status='active'),'[]'::jsonb),'proposals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'client_id',p.client_id,'proposal_number',p.proposal_number,'title',p.title,'status',p.status,'intro',p.intro,'scope_summary',p.scope_summary,'terms',p.terms,'issue_date',p.issue_date,'expires_at',p.expires_at,'proposed_start_date',p.proposed_start_date,'subtotal_cents',p.subtotal_cents,'discount_cents',p.discount_cents,'total_cents',p.total_cents,'deposit_required_cents',p.deposit_required_cents,'requires_signature',p.requires_signature,'create_project',p.create_project,'sent_at',p.sent_at,'viewed_at',p.viewed_at,'accepted_at',p.accepted_at,'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'service_id',i.service_id,'description',i.description,'detail',i.detail,'quantity',i.quantity,'unit_price_cents',i.unit_price_cents,'line_discount_cents',i.line_discount_cents,'line_total_cents',i.line_total_cents,'billing_interval',i.billing_interval) order by i.sort_order,i.created_at) from public.skylight_proposal_items i where i.proposal_id=p.id),'[]'::jsonb)) order by p.created_at desc) from public.skylight_proposals p where p.client_id in(select a.client_id from public.skylight_client_portal_access a where a.user_id=v_uid and a.status='active') and p.status<>'draft' and p.status<>'cancelled'),'[]'::jsonb),'agreements',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'client_id',a.client_id,'proposal_id',a.proposal_id,'agreement_number',a.agreement_number,'title',a.title,'status',a.status,'body_snapshot',a.body_snapshot,'signer_name',a.signer_name,'signer_title',a.signer_title,'signer_email',a.signer_email,'signed_at',a.signed_at,'created_at',a.created_at) order by a.created_at desc) from public.skylight_agreements a where a.client_id in(select x.client_id from public.skylight_client_portal_access x where x.user_id=v_uid and x.status='active')),'[]'::jsonb),'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'client_id',p.client_id,'project_number',p.project_number,'name',p.name,'status',p.status,'health',p.health,'progress_pct',p.progress_pct,'start_date',p.start_date,'due_date',p.due_date,'completed_at',p.completed_at,'client_visible_update',p.client_visible_update,'milestones',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'description',m.description,'status',m.status,'target_date',m.target_date,'completed_at',m.completed_at,'sort_order',m.sort_order) order by m.sort_order,m.created_at) from public.skylight_project_milestones m where m.project_id=p.id and m.client_visible=true),'[]'::jsonb),'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'status',t.status,'priority',t.priority,'due_date',t.due_date,'requires_client_approval',t.requires_client_approval,'client_approved_at',t.client_approved_at,'client_approval_note',t.client_approval_note,'sort_order',t.sort_order) order by t.sort_order,t.created_at) from public.skylight_project_tasks t where t.project_id=p.id and t.client_visible=true),'[]'::jsonb),'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'sender_type',m.sender_type,'body',m.body,'created_at',m.created_at) order by m.created_at) from public.skylight_project_messages m where m.project_id=p.id and m.customer_visible=true),'[]'::jsonb)) order by p.created_at desc) from public.skylight_projects p where p.client_id in(select a.client_id from public.skylight_client_portal_access a where a.user_id=v_uid and a.status='active')),'[]'::jsonb),'recurring_services',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'client_id',r.client_id,'project_id',r.project_id,'name',r.name,'status',r.status,'billing_interval',r.billing_interval,'amount_cents',r.amount_cents,'start_date',r.start_date,'next_invoice_date',r.next_invoice_date,'contract_end_date',r.contract_end_date,'auto_renew',r.auto_renew) order by r.created_at desc) from public.skylight_recurring_services r where r.client_id in(select a.client_id from public.skylight_client_portal_access a where a.user_id=v_uid and a.status='active')),'[]'::jsonb),'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'client_id',i.client_id,'invoice_number',i.invoice_number,'status',i.status,'issue_date',i.issue_date,'due_date',i.due_date,'total_cents',i.total_cents,'amount_paid_cents',i.amount_paid_cents,'balance_due_cents',i.balance_due_cents,'deposit_required_cents',i.deposit_required_cents,'public_token',i.public_token,'hosted_invoice_url',i.hosted_invoice_url) order by i.created_at desc) from public.skylight_invoices i where i.client_id in(select a.client_id from public.skylight_client_portal_access a where a.user_id=v_uid and a.status='active')),'[]'::jsonb)); end$$;
revoke all on function public.get_my_skylight_workspace() from public,anon;
grant execute on function public.get_my_skylight_workspace() to authenticated;
