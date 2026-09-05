create table public.lead_buyer_agreement_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','ready_for_review','activated','declined','expired')),
  featured_addon_enabled boolean not null default false,
  billing_model text not null default 'pay_per_lead' check (billing_model in ('pay_per_lead','lead_bundle')),
  per_lead_price_cents integer check (per_lead_price_cents is null or per_lead_price_cents > 0),
  bundle_lead_count integer check (bundle_lead_count is null or bundle_lead_count > 0),
  bundle_price_cents integer check (bundle_price_cents is null or bundle_price_cents > 0),
  due_days integer not null default 7 check (due_days between 0 and 90),
  billing_email text,
  agreement_started_on date,
  agreement_ends_on date,
  max_leads_per_month integer check (max_leads_per_month is null or max_leads_per_month > 0),
  lead_sale_mode text not null default 'exclusive' check (lead_sale_mode in ('exclusive','shared')),
  max_buyers_per_lead integer not null default 1 check (max_buyers_per_lead between 1 and 10),
  consent_recorded_at timestamptz,
  consent_source text check (consent_source is null or consent_source in ('email','phone','signed_agreement','in_person','other')),
  consent_reference text,
  owner_summary text,
  internal_notes text,
  ready_for_review_at timestamptz,
  ready_by uuid,
  activated_at timestamptz,
  activated_by uuid,
  resulting_program_id uuid references public.business_lead_programs(id) on delete set null,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_buyer_agreement_drafts_tenant_business_key unique (tenant_id,business_id),
  constraint lead_buyer_agreement_drafts_dates_check check (agreement_ends_on is null or agreement_started_on is null or agreement_ends_on >= agreement_started_on),
  constraint lead_buyer_agreement_drafts_sale_mode_buyers_check check ((lead_sale_mode='exclusive' and max_buyers_per_lead=1) or (lead_sale_mode='shared' and max_buyers_per_lead between 2 and 10))
);
create index lead_buyer_agreement_drafts_status_idx on public.lead_buyer_agreement_drafts(tenant_id,status,updated_at desc);
create index lead_buyer_agreement_drafts_business_idx on public.lead_buyer_agreement_drafts(business_id);
alter table public.lead_buyer_agreement_drafts enable row level security;
revoke all on table public.lead_buyer_agreement_drafts from public, anon, authenticated;
grant select, insert, update, delete on table public.lead_buyer_agreement_drafts to authenticated;
create policy lead_buyer_agreement_drafts_admin_read on public.lead_buyer_agreement_drafts for select to authenticated using (private.has_tenant_role(tenant_id,array['admin','super_admin']));
create policy lead_buyer_agreement_drafts_admin_manage on public.lead_buyer_agreement_drafts for all to authenticated using (private.has_tenant_role(tenant_id,array['admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['admin','super_admin']) and exists(select 1 from public.businesses b where b.id=business_id and b.tenant_id=tenant_id));
comment on table public.lead_buyer_agreement_drafts is 'Private pre-activation Lead Buyer agreement workspace. Draft/ready states never authorize billing or routing. business_lead_programs remains the authoritative active agreement.';
comment on column public.lead_buyer_agreement_drafts.internal_notes is 'Admin-only negotiation notes. Never copied into owner-readable business_lead_programs.';
comment on column public.lead_buyer_agreement_drafts.owner_summary is 'Owner-facing agreement summary that may be copied into the authoritative program notes at activation.';

create or replace function public.upsert_lead_buyer_agreement_draft(p_tenant_id uuid,p_business_id uuid,p_status text default 'draft',p_featured_addon_enabled boolean default false,p_billing_model text default 'pay_per_lead',p_per_lead_price_cents integer default null,p_bundle_lead_count integer default null,p_bundle_price_cents integer default null,p_due_days integer default 7,p_billing_email text default null,p_agreement_started_on date default null,p_agreement_ends_on date default null,p_max_leads_per_month integer default null,p_lead_sale_mode text default 'exclusive',p_max_buyers_per_lead integer default 1,p_consent_recorded_at timestamptz default null,p_consent_source text default null,p_consent_reference text default null,p_owner_summary text default null,p_internal_notes text default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;v_existing_status text;
begin
 if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['admin','super_admin']) then raise exception 'insufficient_privilege';end if;
 if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'business_not_found';end if;
 select status into v_existing_status from public.lead_buyer_agreement_drafts where tenant_id=p_tenant_id and business_id=p_business_id;
 if v_existing_status='activated' then raise exception 'activated_draft_is_locked';end if;
 if p_status not in ('draft','ready_for_review','declined','expired') then raise exception 'invalid_draft_status';end if;
 if p_billing_model not in ('pay_per_lead','lead_bundle') then raise exception 'invalid_billing_model';end if;
 if p_lead_sale_mode not in ('exclusive','shared') then raise exception 'invalid_lead_sale_mode';end if;
 if p_consent_source is not null and p_consent_source not in ('email','phone','signed_agreement','in_person','other') then raise exception 'invalid_consent_source';end if;
 if p_agreement_started_on is not null and p_agreement_ends_on is not null and p_agreement_ends_on<p_agreement_started_on then raise exception 'invalid_agreement_dates';end if;
 if p_status='ready_for_review' then
  if p_agreement_started_on is null then raise exception 'agreement_start_required';end if;
  if p_consent_recorded_at is null or nullif(trim(coalesce(p_consent_source,'')),'') is null or nullif(trim(coalesce(p_consent_reference,'')),'') is null then raise exception 'documented_consent_required';end if;
  if nullif(trim(coalesce(p_owner_summary,'')),'') is null then raise exception 'owner_summary_required';end if;
  if p_billing_model='pay_per_lead' and coalesce(p_per_lead_price_cents,0)<=0 then raise exception 'positive_per_lead_price_required';end if;
  if p_billing_model='lead_bundle' and(coalesce(p_bundle_lead_count,0)<=0 or coalesce(p_bundle_price_cents,0)<=0) then raise exception 'valid_bundle_required';end if;
  if p_lead_sale_mode='shared' and coalesce(p_max_buyers_per_lead,0)<2 then raise exception 'shared_buyer_limit_required';end if;
 end if;
 insert into public.lead_buyer_agreement_drafts(tenant_id,business_id,status,featured_addon_enabled,billing_model,per_lead_price_cents,bundle_lead_count,bundle_price_cents,due_days,billing_email,agreement_started_on,agreement_ends_on,max_leads_per_month,lead_sale_mode,max_buyers_per_lead,consent_recorded_at,consent_source,consent_reference,owner_summary,internal_notes,ready_for_review_at,ready_by,created_by,updated_by,updated_at)
 values(p_tenant_id,p_business_id,p_status,coalesce(p_featured_addon_enabled,false),p_billing_model,case when p_billing_model='pay_per_lead' then p_per_lead_price_cents end,case when p_billing_model='lead_bundle' then p_bundle_lead_count end,case when p_billing_model='lead_bundle' then p_bundle_price_cents end,greatest(0,least(coalesce(p_due_days,7),90)),nullif(trim(coalesce(p_billing_email,'')),''),p_agreement_started_on,p_agreement_ends_on,p_max_leads_per_month,p_lead_sale_mode,case when p_lead_sale_mode='exclusive' then 1 else greatest(2,least(coalesce(p_max_buyers_per_lead,2),10)) end,p_consent_recorded_at,nullif(trim(coalesce(p_consent_source,'')),''),nullif(trim(coalesce(p_consent_reference,'')),''),nullif(trim(coalesce(p_owner_summary,'')),''),nullif(trim(coalesce(p_internal_notes,'')),''),case when p_status='ready_for_review' then now() end,case when p_status='ready_for_review' then auth.uid() end,auth.uid(),auth.uid(),now())
 on conflict(tenant_id,business_id) do update set status=excluded.status,featured_addon_enabled=excluded.featured_addon_enabled,billing_model=excluded.billing_model,per_lead_price_cents=excluded.per_lead_price_cents,bundle_lead_count=excluded.bundle_lead_count,bundle_price_cents=excluded.bundle_price_cents,due_days=excluded.due_days,billing_email=excluded.billing_email,agreement_started_on=excluded.agreement_started_on,agreement_ends_on=excluded.agreement_ends_on,max_leads_per_month=excluded.max_leads_per_month,lead_sale_mode=excluded.lead_sale_mode,max_buyers_per_lead=excluded.max_buyers_per_lead,consent_recorded_at=excluded.consent_recorded_at,consent_source=excluded.consent_source,consent_reference=excluded.consent_reference,owner_summary=excluded.owner_summary,internal_notes=excluded.internal_notes,ready_for_review_at=case when excluded.status='ready_for_review' then coalesce(public.lead_buyer_agreement_drafts.ready_for_review_at,now()) else null end,ready_by=case when excluded.status='ready_for_review' then coalesce(public.lead_buyer_agreement_drafts.ready_by,auth.uid()) else null end,updated_by=auth.uid(),updated_at=now() returning id into v_id;
 insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(p_tenant_id,auth.uid(),'lead_buyer_agreement_draft_'||p_status,'Lead Buyer agreement draft '||v_id||' set to '||p_status||' for business '||p_business_id||'. No billing or lead routing was activated.');return v_id;
end;$$;
revoke all on function public.upsert_lead_buyer_agreement_draft(uuid,uuid,text,boolean,text,integer,integer,integer,integer,text,date,date,integer,text,integer,timestamptz,text,text,text,text) from public,anon;
grant execute on function public.upsert_lead_buyer_agreement_draft(uuid,uuid,text,boolean,text,integer,integer,integer,integer,text,date,date,integer,text,integer,timestamptz,text,text,text,text) to authenticated;

create or replace function private.notify_lead_buyer_agreement_ready() returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;begin
 if new.status='ready_for_review' and old.status is distinct from new.status then
  select name into v_name from public.businesses where id=new.business_id;
  insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key) select ur.user_id,new.tenant_id,'Lead buyer agreement ready for review',coalesce(v_name,'A Lead Buyer')||' has a documented agreement draft ready for Super Admin review. No billing, paid lead delivery, verification, Sponsored placement, subscription, or ranking change has been activated.','/admin/lead-buyers?business='||new.business_id,'lead_buyer_agreement_ready:'||new.id from public.user_roles ur where ur.tenant_id=new.tenant_id and ur.role='super_admin' on conflict(user_id,event_key) where event_key is not null do update set read_at=null,created_at=now(),body=excluded.body,action_url=excluded.action_url;
 end if;return new;end;$$;
revoke all on function private.notify_lead_buyer_agreement_ready() from public,anon,authenticated;grant execute on function private.notify_lead_buyer_agreement_ready() to postgres;
create trigger lead_buyer_agreement_ready_notification after update of status on public.lead_buyer_agreement_drafts for each row execute function private.notify_lead_buyer_agreement_ready();

create or replace function public.activate_lead_buyer_agreement_draft(p_draft_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.lead_buyer_agreement_drafts%rowtype;v_program_id uuid;begin
 select * into v from public.lead_buyer_agreement_drafts where id=p_draft_id for update;if v.id is null then raise exception 'agreement_draft_not_found';end if;
 if auth.uid() is null or not private.has_tenant_role(v.tenant_id,array['super_admin']) then raise exception 'insufficient_privilege';end if;
 if v.status<>'ready_for_review' then raise exception 'agreement_not_ready_for_activation';end if;
 if v.consent_recorded_at is null or nullif(trim(coalesce(v.consent_source,'')),'') is null or nullif(trim(coalesce(v.consent_reference,'')),'') is null then raise exception 'documented_consent_required';end if;
 if nullif(trim(coalesce(v.owner_summary,'')),'') is null then raise exception 'owner_summary_required';end if;if v.agreement_started_on is null then raise exception 'agreement_start_required';end if;
 select public.configure_business_lead_program_v2(v.business_id,v.featured_addon_enabled,v.billing_model,v.per_lead_price_cents,v.bundle_lead_count,v.bundle_price_cents,v.due_days,v.billing_email,v.owner_summary,'active',v.agreement_started_on,v.agreement_ends_on,v.max_leads_per_month,v.lead_sale_mode,v.max_buyers_per_lead,false,'manual',false,true,0,false,null,true,true) into v_program_id;
 update public.lead_buyer_agreement_drafts set status='activated',activated_at=now(),activated_by=auth.uid(),resulting_program_id=v_program_id,updated_by=auth.uid(),updated_at=now() where id=v.id;
 update public.notifications set read_at=coalesce(read_at,now()) where tenant_id=v.tenant_id and event_key='lead_buyer_agreement_ready:'||v.id;
 insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v.tenant_id,auth.uid(),'lead_buyer_agreement_activated','Activated reviewed Lead Buyer agreement draft '||v.id||' as authoritative program '||v_program_id||'. Activation created no lead delivery or charge.');return v_program_id;end;$$;
revoke all on function public.activate_lead_buyer_agreement_draft(uuid) from public,anon;grant execute on function public.activate_lead_buyer_agreement_draft(uuid) to authenticated;

create or replace function private.refresh_lead_buyer_followup_alerts() returns integer language plpgsql security definer set search_path='' as $$
declare v record;v_user record;v_count integer:=0;v_day text:=to_char(current_date,'YYYYMMDD');v_key text;begin
 update public.notifications set read_at=coalesce(read_at,now()) where event_key like 'lead_buyer_sla:%' and event_key not like '%:'||v_day;
 for v in with latest_decision as(select distinct on(lr.tenant_id,lr.business_id) lr.tenant_id,lr.business_id,lr.lead_program_interest,lr.interest_updated_at from public.lead_recipients lr where lr.delivery_type='intro' and lr.interest_updated_at is not null order by lr.tenant_id,lr.business_id,lr.interest_updated_at desc),due_buyers as(select d.tenant_id,d.business_id,b.name,d.interest_updated_at,c.last_contact_at,c.follow_up_at,case when c.last_contact_at is null or c.last_contact_at<d.interest_updated_at then d.interest_updated_at+interval '24 hours' else c.follow_up_at end as due_at from latest_decision d join public.businesses b on b.id=d.business_id and b.tenant_id=d.tenant_id left join public.lead_buyer_crm_profiles c on c.tenant_id=d.tenant_id and c.business_id=d.business_id left join public.business_lead_programs p on p.tenant_id=d.tenant_id and p.business_id=d.business_id and p.status='active' where d.lead_program_interest='interested' and p.id is null and coalesce(c.sales_status,'open') not in('paused','declined')) select * from due_buyers where due_at is not null and due_at<=now()
 loop v_key:='lead_buyer_sla:'||v.business_id||':'||v_day;for v_user in select user_id from public.user_roles where tenant_id=v.tenant_id and role in('admin','super_admin') loop insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key) values(v_user.user_id,v.tenant_id,'Lead Buyer follow-up overdue',v.name||' needs Lead Buyer follow-up. The 24-hour first-contact SLA or scheduled follow-up is overdue. Review the private CRM; this alert does not authorize billing or future lead routing.','/admin/lead-buyers?business='||v.business_id,v_key) on conflict(user_id,event_key) where event_key is not null do nothing;if found then v_count:=v_count+1;end if;end loop;end loop;return v_count;end;$$;
revoke all on function private.refresh_lead_buyer_followup_alerts() from public,anon,authenticated;grant execute on function private.refresh_lead_buyer_followup_alerts() to postgres,service_role;
select cron.schedule('local-pros-lead-buyer-sla-refresh','5 14 * * *','select private.refresh_lead_buyer_followup_alerts();');
