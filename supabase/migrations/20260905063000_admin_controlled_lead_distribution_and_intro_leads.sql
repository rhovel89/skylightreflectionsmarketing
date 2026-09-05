-- Admin-controlled lead distribution: no consumer lead is delivered to a business automatically.
drop trigger if exists trg_route_direct_business_lead on public.leads;
drop trigger if exists trg_route_new_directory_lead on public.leads;

alter table public.lead_recipients add column if not exists delivery_type text not null default 'manual';
alter table public.lead_recipients add column if not exists admin_message text;
alter table public.lead_recipients add column if not exists lead_program_interest text not null default 'undecided';
alter table public.lead_recipients add column if not exists interest_updated_at timestamptz;
alter table public.lead_recipients add column if not exists delivered_by uuid;
do $$ begin alter table public.lead_recipients add constraint lead_recipients_delivery_type_check check(delivery_type in('intro','complimentary','manual','paid')); exception when duplicate_object then null; end $$;
do $$ begin alter table public.lead_recipients add constraint lead_recipients_program_interest_check check(lead_program_interest in('undecided','interested','not_interested')); exception when duplicate_object then null; end $$;
update public.lead_recipients lr set delivery_type='paid' where exists(select 1 from public.lead_delivery_charges ldc where ldc.recipient_id=lr.id) and lr.delivery_type='manual';

create or replace function private.record_lead_admin_review_submission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.lead_status_events(lead_id,actor_user_id,from_status,to_status,note,business_id,event_type,public_message,internal_message)
 values(new.id,null,null,'new','Lead received for staff review before any business delivery.',new.business_id,'submitted','Your request was received by Central Illinois Local Pros for review.',case when new.business_id is not null then 'Consumer selected a specific business. Keep delivery tied to that business.' else 'General request. Staff may choose an appropriate business after review.' end);
 return new;
end $$;
drop trigger if exists trg_record_lead_admin_review_submission on public.leads;
create trigger trg_record_lead_admin_review_submission after insert on public.leads for each row execute function private.record_lead_admin_review_submission();

create or replace function public.deliver_reviewed_lead(p_lead_id uuid,p_business_id uuid,p_delivery_type text default 'intro',p_admin_message text default null,p_route_reason text default 'Staff-reviewed lead delivery',p_route_rank integer default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_context_business uuid;v_recipient uuid;v_business_name text;v_business_slug text;v_owner record;v_kind text:=lower(trim(coalesce(p_delivery_type,'intro')));v_message text:=nullif(trim(coalesce(p_admin_message,'')),'');
begin
 select tenant_id,business_id into v_tenant,v_context_business from public.leads where id=p_lead_id for update;if v_tenant is null then raise exception 'lead_not_found';end if;
 if auth.uid() is null or not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'insufficient_privilege';end if;
 if v_kind not in('intro','complimentary','manual') then raise exception 'invalid_reviewed_delivery_type';end if;
 if v_context_business is not null and v_context_business is distinct from p_business_id then raise exception 'business_specific_lead_requires_target_business';end if;
 select name,slug into v_business_name,v_business_slug from public.businesses where id=p_business_id and tenant_id=v_tenant and status='published';if v_business_name is null then raise exception 'published_business_required';end if;
 if not exists(select 1 from public.business_owners bo where bo.business_id=p_business_id) then raise exception 'business_owner_account_required';end if;
 insert into public.lead_recipients(tenant_id,lead_id,business_id,route_reason,route_rank,status,routed_at,updated_at,delivery_type,admin_message,delivered_by,lead_program_interest)
 values(v_tenant,p_lead_id,p_business_id,nullif(trim(coalesce(p_route_reason,'')),''),greatest(coalesce(p_route_rank,0),0),'new',now(),now(),v_kind,v_message,auth.uid(),'undecided') on conflict(lead_id,business_id) do nothing returning id into v_recipient;
 if v_recipient is null then raise exception 'lead_already_delivered_to_business';end if;
 update public.leads set assigned_business_id=coalesce(assigned_business_id,p_business_id),status=case when status='new' then 'routed' else status end where id=p_lead_id;
 for v_owner in select bo.user_id from public.business_owners bo where bo.business_id=p_business_id loop
  insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key) values(v_owner.user_id,v_tenant,case when v_kind='intro' then 'Free intro lead from Central Illinois Local Pros' else 'New lead delivered by Central Illinois Local Pros' end,coalesce(v_message,case when v_kind='intro' then 'A complimentary sample lead was sent to your business. Sign in to review it and tell us whether you want more opportunities like this.' else 'A staff-reviewed lead was sent to your business.' end),'/business-portal/leads?business='||p_business_id::text,'reviewed_lead_delivered:'||v_recipient::text||':'||v_owner.user_id::text) on conflict do nothing;
 end loop;
 select c.email,c.claimant_name into v_owner from public.business_claims c where c.business_id=p_business_id and c.status='approved' and nullif(trim(coalesce(c.email,'')),'') is not null order by c.reviewed_at desc nulls last,c.created_at desc limit 1;
 if v_owner.email is not null then insert into public.email_outbox(tenant_id,business_id,recipient_email,recipient_name,message_type,template_key,subject,body,cta_label,cta_url,status,scheduled_for) values(v_tenant,p_business_id,lower(v_owner.email),v_owner.claimant_name,'transactional','reviewed_lead_delivered',case when v_kind='intro' then 'A free sample lead is waiting for '||v_business_name else 'A new lead is waiting for '||v_business_name end,case when v_kind='intro' then 'Central Illinois Local Pros sent your business a complimentary sample lead. Sign in to securely review the customer details. After reviewing it, tell us whether you would like to continue receiving opportunities like this on a pay-per-lead basis.' else 'Central Illinois Local Pros sent your business a staff-reviewed lead. Sign in to securely review the customer details.' end,'Review Lead','/business-portal/leads?business='||p_business_id::text,'queued',now());end if;
 insert into public.lead_status_events(lead_id,actor_user_id,from_status,to_status,note,business_id,event_type,public_message,internal_message) values(p_lead_id,auth.uid(),'new','routed','Staff deliberately delivered the lead after review.',p_business_id,'staff_delivered',null,'Delivery type: '||v_kind||case when v_message is not null then '. Admin message: '||v_message else '' end);
 insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'reviewed_lead_delivered','Delivered '||v_kind||' lead '||p_lead_id||' to business '||p_business_id||' after staff review.');return v_recipient;
end $$;
revoke all on function public.deliver_reviewed_lead(uuid,uuid,text,text,text,integer) from public,anon;grant execute on function public.deliver_reviewed_lead(uuid,uuid,text,text,text,integer) to authenticated,service_role;

create or replace function public.update_owner_lead_interest(p_recipient_id uuid,p_interest text) returns void language plpgsql security definer set search_path='' as $$
declare v_business uuid;v_tenant uuid;v_type text;v_interest text:=lower(trim(coalesce(p_interest,'')));
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;if v_interest not in('undecided','interested','not_interested') then raise exception 'invalid_lead_program_interest';end if;
 select business_id,tenant_id,delivery_type into v_business,v_tenant,v_type from public.lead_recipients where id=p_recipient_id for update;if v_business is null then raise exception 'lead_recipient_not_found';end if;
 if not exists(select 1 from public.business_owners bo where bo.business_id=v_business and bo.user_id=auth.uid()) then raise exception 'insufficient_privilege';end if;
 if not private.business_has_lead_inbox_access(v_business) and v_type<>'intro' then raise exception 'lead_inbox_not_enabled_for_business';end if;
 update public.lead_recipients set lead_program_interest=v_interest,interest_updated_at=now(),updated_at=now() where id=p_recipient_id;
 insert into public.lead_status_events(lead_id,actor_user_id,from_status,to_status,note,business_id,event_type,public_message,internal_message) select lr.lead_id,auth.uid(),lr.status,lr.status,'Business owner updated interest in ongoing lead delivery.',v_business,'lead_program_interest',null,'Lead program interest: '||v_interest from public.lead_recipients lr where lr.id=p_recipient_id;
 insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'lead_program_interest_updated','Business '||v_business||' set lead-program interest to '||v_interest||' for recipient '||p_recipient_id||'.');
end $$;
revoke all on function public.update_owner_lead_interest(uuid,text) from public,anon;grant execute on function public.update_owner_lead_interest(uuid,text) to authenticated,service_role;

drop policy if exists "owner read routed lead recipients" on public.lead_recipients;
create policy "owner read routed lead recipients" on public.lead_recipients for select to authenticated using((private.business_has_lead_inbox_access(business_id) or delivery_type='intro') and exists(select 1 from public.business_owners bo where bo.business_id=lead_recipients.business_id and bo.user_id=(select auth.uid())));
drop policy if exists "owner update own routed lead status" on public.lead_recipients;
create policy "owner update own routed lead status" on public.lead_recipients for update to authenticated using((private.business_has_lead_inbox_access(business_id) or delivery_type='intro') and exists(select 1 from public.business_owners bo where bo.business_id=lead_recipients.business_id and bo.user_id=(select auth.uid()))) with check((private.business_has_lead_inbox_access(business_id) or delivery_type='intro') and exists(select 1 from public.business_owners bo where bo.business_id=lead_recipients.business_id and bo.user_id=(select auth.uid())));

-- Paid delivery uses the same recipient record but is labeled paid for reporting.
create or replace function public.deliver_billable_lead(p_lead_id uuid,p_business_id uuid,p_route_reason text default 'Paid lead delivery',p_route_rank integer default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_program public.business_lead_programs%rowtype;v_recipient uuid;v_month_count integer:=0;v_other_buyers integer:=0;v_open integer:=0;v_overdue integer:=0;
begin
 select tenant_id into v_tenant from public.leads where id=p_lead_id;if v_tenant is null then raise exception 'lead_not_found';end if;if auth.uid() is null or not private.has_tenant_role(v_tenant,array['super_admin']) then raise exception 'insufficient_privilege';end if;if not exists(select 1 from public.businesses where id=p_business_id and tenant_id=v_tenant) then raise exception 'business_tenant_mismatch';end if;if not private.business_has_lead_inbox_access(p_business_id) then raise exception 'lead_inbox_not_enabled_for_business';end if;
 select * into v_program from public.business_lead_programs where business_id=p_business_id and status='active' for update;if v_program.business_id is null then raise exception 'billing_program_not_configured';end if;if v_program.agreement_started_on is not null and current_date<v_program.agreement_started_on then raise exception 'lead_agreement_not_started';end if;if v_program.agreement_ends_on is not null and current_date>v_program.agreement_ends_on then raise exception 'lead_agreement_ended';end if;if v_program.manual_delivery_hold then raise exception 'lead_delivery_on_manual_hold';end if;if v_program.billing_model='pay_per_lead' and coalesce(v_program.per_lead_price_cents,0)<=0 then raise exception 'billing_program_not_configured';end if;if v_program.billing_model='lead_bundle' and(coalesce(v_program.bundle_lead_count,0)<=0 or coalesce(v_program.bundle_price_cents,0)<=0) then raise exception 'billing_program_not_configured';end if;
 if exists(select 1 from public.lead_recipients where lead_id=p_lead_id and business_id=p_business_id) then raise exception 'lead_already_delivered_to_business';end if;select count(distinct business_id) into v_other_buyers from public.lead_recipients where lead_id=p_lead_id and business_id<>p_business_id;if v_program.lead_sale_mode='exclusive' and v_other_buyers>0 then raise exception 'exclusive_lead_already_delivered';end if;if v_program.lead_sale_mode='shared' and v_other_buyers>=greatest(2,v_program.max_buyers_per_lead) then raise exception 'shared_lead_buyer_limit_reached';end if;
 if v_program.max_leads_per_month is not null then select count(*) into v_month_count from public.lead_delivery_charges where business_id=p_business_id and billing_status<>'void' and delivered_at>=date_trunc('month',now());if v_month_count>=v_program.max_leads_per_month then raise exception 'monthly_lead_cap_reached';end if;end if;
 if v_program.stop_delivery_on_open_balance then select count(*) into v_open from public.lead_invoices where business_id=p_business_id and status in('sent','overdue');if v_open>0 then raise exception 'delivery_blocked_open_balance';end if;end if;
 if v_program.stop_delivery_on_overdue then select count(*) into v_overdue from public.lead_invoices where business_id=p_business_id and status in('sent','overdue') and due_at is not null and due_at+make_interval(days=>v_program.overdue_grace_days)<now();if v_overdue>0 then raise exception 'delivery_blocked_overdue_balance';end if;end if;
 v_recipient:=public.route_directory_lead(p_lead_id,p_business_id,p_route_reason,p_route_rank);update public.lead_recipients set delivery_type='paid',delivered_by=auth.uid() where id=v_recipient;
 insert into public.lead_delivery_charges(tenant_id,business_id,lead_id,recipient_id,billing_model,per_lead_price_cents,bundle_lead_count,bundle_price_cents,billing_status,delivered_at,created_by) values(v_tenant,p_business_id,p_lead_id,v_recipient,v_program.billing_model,v_program.per_lead_price_cents,v_program.bundle_lead_count,v_program.bundle_price_cents,'unbilled',now(),auth.uid()) on conflict(recipient_id) do nothing;
 insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'billable_lead_delivered','Delivered billable lead '||p_lead_id||' to business '||p_business_id||'. Billing is based on delivery, not close outcome.');return v_recipient;
end $$;
