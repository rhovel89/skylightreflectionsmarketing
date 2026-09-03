alter table public.business_lead_programs
  add column if not exists agreement_started_on date,
  add column if not exists agreement_ends_on date,
  add column if not exists max_leads_per_month integer,
  add column if not exists lead_sale_mode text not null default 'exclusive',
  add column if not exists max_buyers_per_lead integer not null default 1,
  add column if not exists auto_invoice_enabled boolean not null default false,
  add column if not exists auto_invoice_cadence text not null default 'manual',
  add column if not exists last_auto_invoice_at timestamptz,
  add column if not exists stop_delivery_on_open_balance boolean not null default false,
  add column if not exists stop_delivery_on_overdue boolean not null default true,
  add column if not exists overdue_grace_days integer not null default 0,
  add column if not exists manual_delivery_hold boolean not null default false,
  add column if not exists delivery_hold_reason text,
  add column if not exists notify_on_delivery boolean not null default true,
  add column if not exists notify_on_invoice boolean not null default true;

alter table public.business_lead_programs drop constraint if exists business_lead_programs_max_leads_per_month_check;
alter table public.business_lead_programs add constraint business_lead_programs_max_leads_per_month_check check(max_leads_per_month is null or max_leads_per_month>0);
alter table public.business_lead_programs drop constraint if exists business_lead_programs_lead_sale_mode_check;
alter table public.business_lead_programs add constraint business_lead_programs_lead_sale_mode_check check(lead_sale_mode in('exclusive','shared'));
alter table public.business_lead_programs drop constraint if exists business_lead_programs_max_buyers_per_lead_check;
alter table public.business_lead_programs add constraint business_lead_programs_max_buyers_per_lead_check check(max_buyers_per_lead between 1 and 10);
alter table public.business_lead_programs drop constraint if exists business_lead_programs_auto_invoice_cadence_check;
alter table public.business_lead_programs add constraint business_lead_programs_auto_invoice_cadence_check check(auto_invoice_cadence in('manual','daily','weekly','monthly','bundle_ready'));
alter table public.business_lead_programs drop constraint if exists business_lead_programs_overdue_grace_days_check;
alter table public.business_lead_programs add constraint business_lead_programs_overdue_grace_days_check check(overdue_grace_days between 0 and 60);
alter table public.business_lead_programs drop constraint if exists business_lead_programs_agreement_dates_check;
alter table public.business_lead_programs add constraint business_lead_programs_agreement_dates_check check(agreement_ends_on is null or agreement_started_on is null or agreement_ends_on>=agreement_started_on);

alter table public.lead_invoices add column if not exists subtotal_cents integer;
alter table public.lead_invoices add column if not exists credit_applied_cents integer not null default 0;
update public.lead_invoices set subtotal_cents=amount_due_cents where subtotal_cents is null;
alter table public.lead_invoices alter column subtotal_cents set not null;
alter table public.lead_invoices drop constraint if exists lead_invoices_amount_due_cents_check;
alter table public.lead_invoices add constraint lead_invoices_amount_due_cents_check check(amount_due_cents>=0);
alter table public.lead_invoices drop constraint if exists lead_invoices_subtotal_cents_check;
alter table public.lead_invoices add constraint lead_invoices_subtotal_cents_check check(subtotal_cents>0);
alter table public.lead_invoices drop constraint if exists lead_invoices_credit_applied_cents_check;
alter table public.lead_invoices add constraint lead_invoices_credit_applied_cents_check check(credit_applied_cents>=0 and credit_applied_cents<=subtotal_cents);

create table if not exists public.lead_credit_requests(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  charge_id uuid not null references public.lead_delivery_charges(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  reason text not null check(reason in('duplicate','invalid_contact','spam_or_fraud','out_of_scope','other')),
  details text,
  requested_credit_cents integer check(requested_credit_cents is null or requested_credit_cents>0),
  status text not null default 'pending' check(status in('pending','approved','rejected','cancelled')),
  approved_credit_cents integer check(approved_credit_cents is null or approved_credit_cents>=0),
  staff_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lead_credit_requests_one_pending_per_charge_idx on public.lead_credit_requests(charge_id) where status='pending';
create index if not exists lead_credit_requests_queue_idx on public.lead_credit_requests(tenant_id,status,created_at desc);

create table if not exists public.business_lead_credits(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  request_id uuid unique references public.lead_credit_requests(id) on delete set null,
  charge_id uuid references public.lead_delivery_charges(id) on delete set null,
  original_amount_cents integer not null check(original_amount_cents>0),
  remaining_amount_cents integer not null check(remaining_amount_cents>=0),
  status text not null default 'available' check(status in('available','exhausted','void','resolved_before_invoice')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(remaining_amount_cents<=original_amount_cents)
);
create index if not exists business_lead_credits_available_idx on public.business_lead_credits(tenant_id,business_id,status,created_at) where remaining_amount_cents>0;

create table if not exists public.lead_credit_applications(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  credit_id uuid not null references public.business_lead_credits(id) on delete cascade,
  invoice_id uuid not null references public.lead_invoices(id) on delete cascade,
  amount_cents integer not null check(amount_cents>0),
  created_at timestamptz not null default now(),
  unique(credit_id,invoice_id)
);
create index if not exists lead_credit_applications_invoice_idx on public.lead_credit_applications(invoice_id,created_at);

alter table public.lead_credit_requests enable row level security;
alter table public.business_lead_credits enable row level security;
alter table public.lead_credit_applications enable row level security;

revoke all on public.lead_credit_requests from anon,authenticated;
revoke all on public.business_lead_credits from anon,authenticated;
revoke all on public.lead_credit_applications from anon,authenticated;
grant select,insert on public.lead_credit_requests to authenticated;
grant select on public.business_lead_credits to authenticated;
grant select on public.lead_credit_applications to authenticated;

drop policy if exists lead_credit_requests_owner_read on public.lead_credit_requests;
create policy lead_credit_requests_owner_read on public.lead_credit_requests for select to authenticated using(
  exists(select 1 from public.business_owners bo where bo.business_id=lead_credit_requests.business_id and bo.user_id=(select auth.uid()))
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists lead_credit_requests_owner_insert on public.lead_credit_requests;
create policy lead_credit_requests_owner_insert on public.lead_credit_requests for insert to authenticated with check(
  requested_by=(select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null and
  exists(select 1 from public.business_owners bo where bo.business_id=lead_credit_requests.business_id and bo.user_id=(select auth.uid()))
);
drop policy if exists business_lead_credits_owner_read on public.business_lead_credits;
create policy business_lead_credits_owner_read on public.business_lead_credits for select to authenticated using(
  exists(select 1 from public.business_owners bo where bo.business_id=business_lead_credits.business_id and bo.user_id=(select auth.uid()))
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists lead_credit_applications_owner_read on public.lead_credit_applications;
create policy lead_credit_applications_owner_read on public.lead_credit_applications for select to authenticated using(
  exists(select 1 from public.lead_invoices i join public.business_owners bo on bo.business_id=i.business_id where i.id=lead_credit_applications.invoice_id and bo.user_id=(select auth.uid()))
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);

create or replace function public.configure_business_lead_program_v2(
  p_business_id uuid,
  p_featured_addon_enabled boolean,
  p_billing_model text,
  p_per_lead_price_cents integer default null,
  p_bundle_lead_count integer default null,
  p_bundle_price_cents integer default null,
  p_due_days integer default 7,
  p_billing_email text default null,
  p_notes text default null,
  p_status text default 'active',
  p_agreement_started_on date default null,
  p_agreement_ends_on date default null,
  p_max_leads_per_month integer default null,
  p_lead_sale_mode text default 'exclusive',
  p_max_buyers_per_lead integer default 1,
  p_auto_invoice_enabled boolean default false,
  p_auto_invoice_cadence text default 'manual',
  p_stop_delivery_on_open_balance boolean default false,
  p_stop_delivery_on_overdue boolean default true,
  p_overdue_grace_days integer default 0,
  p_manual_delivery_hold boolean default false,
  p_delivery_hold_reason text default null,
  p_notify_on_delivery boolean default true,
  p_notify_on_invoice boolean default true
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_id uuid;
begin
  select tenant_id into v_tenant from public.businesses where id=p_business_id;
  if v_tenant is null then raise exception 'business_not_found';end if;
  if auth.uid() is null or not private.has_tenant_role(v_tenant,array['super_admin']) then raise exception 'insufficient_privilege';end if;
  if p_billing_model not in('pay_per_lead','lead_bundle') then raise exception 'invalid_billing_model';end if;
  if p_status not in('active','paused','ended') then raise exception 'invalid_status';end if;
  if p_lead_sale_mode not in('exclusive','shared') then raise exception 'invalid_lead_sale_mode';end if;
  if p_auto_invoice_cadence not in('manual','daily','weekly','monthly','bundle_ready') then raise exception 'invalid_auto_invoice_cadence';end if;
  if p_billing_model='pay_per_lead' and coalesce(p_per_lead_price_cents,0)<=0 then raise exception 'positive_per_lead_price_required';end if;
  if p_billing_model='lead_bundle' and(coalesce(p_bundle_lead_count,0)<=0 or coalesce(p_bundle_price_cents,0)<=0) then raise exception 'valid_bundle_required';end if;
  if p_agreement_started_on is not null and p_agreement_ends_on is not null and p_agreement_ends_on<p_agreement_started_on then raise exception 'invalid_agreement_dates';end if;
  insert into public.business_lead_programs(tenant_id,business_id,featured_addon_enabled,status,billing_model,per_lead_price_cents,bundle_lead_count,bundle_price_cents,due_days,billing_email,notes,agreement_started_on,agreement_ends_on,max_leads_per_month,lead_sale_mode,max_buyers_per_lead,auto_invoice_enabled,auto_invoice_cadence,stop_delivery_on_open_balance,stop_delivery_on_overdue,overdue_grace_days,manual_delivery_hold,delivery_hold_reason,notify_on_delivery,notify_on_invoice,created_by,updated_by)
  values(v_tenant,p_business_id,coalesce(p_featured_addon_enabled,false),p_status,p_billing_model,case when p_billing_model='pay_per_lead' then p_per_lead_price_cents end,case when p_billing_model='lead_bundle' then p_bundle_lead_count end,case when p_billing_model='lead_bundle' then p_bundle_price_cents end,greatest(0,least(coalesce(p_due_days,7),90)),nullif(trim(coalesce(p_billing_email,'')),''),nullif(trim(coalesce(p_notes,'')),''),p_agreement_started_on,p_agreement_ends_on,p_max_leads_per_month,p_lead_sale_mode,case when p_lead_sale_mode='exclusive' then 1 else greatest(2,least(coalesce(p_max_buyers_per_lead,2),10)) end,coalesce(p_auto_invoice_enabled,false),p_auto_invoice_cadence,coalesce(p_stop_delivery_on_open_balance,false),coalesce(p_stop_delivery_on_overdue,true),greatest(0,least(coalesce(p_overdue_grace_days,0),60)),coalesce(p_manual_delivery_hold,false),nullif(trim(coalesce(p_delivery_hold_reason,'')),''),coalesce(p_notify_on_delivery,true),coalesce(p_notify_on_invoice,true),auth.uid(),auth.uid())
  on conflict(business_id) do update set featured_addon_enabled=excluded.featured_addon_enabled,status=excluded.status,billing_model=excluded.billing_model,per_lead_price_cents=excluded.per_lead_price_cents,bundle_lead_count=excluded.bundle_lead_count,bundle_price_cents=excluded.bundle_price_cents,due_days=excluded.due_days,billing_email=excluded.billing_email,notes=excluded.notes,agreement_started_on=excluded.agreement_started_on,agreement_ends_on=excluded.agreement_ends_on,max_leads_per_month=excluded.max_leads_per_month,lead_sale_mode=excluded.lead_sale_mode,max_buyers_per_lead=excluded.max_buyers_per_lead,auto_invoice_enabled=excluded.auto_invoice_enabled,auto_invoice_cadence=excluded.auto_invoice_cadence,stop_delivery_on_open_balance=excluded.stop_delivery_on_open_balance,stop_delivery_on_overdue=excluded.stop_delivery_on_overdue,overdue_grace_days=excluded.overdue_grace_days,manual_delivery_hold=excluded.manual_delivery_hold,delivery_hold_reason=excluded.delivery_hold_reason,notify_on_delivery=excluded.notify_on_delivery,notify_on_invoice=excluded.notify_on_invoice,updated_by=auth.uid(),updated_at=now()
  returning id into v_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'lead_program_configured_v2','Updated lead agreement controls for business '||p_business_id||'.');
  return v_id;
end$$;
revoke all on function public.configure_business_lead_program_v2(uuid,boolean,text,integer,integer,integer,integer,text,text,text,date,date,integer,text,integer,boolean,text,boolean,boolean,integer,boolean,text,boolean,boolean) from public,anon;
grant execute on function public.configure_business_lead_program_v2(uuid,boolean,text,integer,integer,integer,integer,text,text,text,date,date,integer,text,integer,boolean,text,boolean,boolean,integer,boolean,text,boolean,boolean) to authenticated,service_role;

create or replace function public.get_business_lead_access(p_business_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_plan text;v_program public.business_lead_programs%rowtype;v_owner boolean;v_staff boolean;v_open_balance int:=0;v_overdue int:=0;v_month_count int:=0;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  select exists(select 1 from public.business_owners bo where bo.business_id=p_business_id and bo.user_id=auth.uid()) into v_owner;
  select exists(select 1 from public.businesses b where b.id=p_business_id and private.has_tenant_role(b.tenant_id,array['staff','admin','super_admin'])) into v_staff;
  if not v_owner and not v_staff then raise exception 'insufficient_privilege';end if;
  v_plan:=private.business_active_plan_slug(p_business_id);
  select * into v_program from public.business_lead_programs where business_id=p_business_id;
  select count(*) into v_open_balance from public.lead_invoices where business_id=p_business_id and status in('sent','overdue');
  select count(*) into v_overdue from public.lead_invoices where business_id=p_business_id and status='overdue';
  select count(*) into v_month_count from public.lead_delivery_charges where business_id=p_business_id and billing_status<>'void' and delivered_at>=date_trunc('month',now());
  return jsonb_build_object(
    'plan_slug',v_plan,'lead_inbox',private.business_has_lead_inbox_access(p_business_id),
    'access_source',case when v_plan='pro' then 'pro_included' when v_plan='featured' and coalesce(v_program.featured_addon_enabled,false) and v_program.status='active' then 'featured_addon' else 'none' end,
    'billing_configured',case when v_program.business_id is null or v_program.status<>'active' then false when v_program.billing_model='pay_per_lead' then coalesce(v_program.per_lead_price_cents,0)>0 else coalesce(v_program.bundle_lead_count,0)>0 and coalesce(v_program.bundle_price_cents,0)>0 end,
    'billing_model',v_program.billing_model,'per_lead_price_cents',v_program.per_lead_price_cents,'bundle_lead_count',v_program.bundle_lead_count,'bundle_price_cents',v_program.bundle_price_cents,'due_days',coalesce(v_program.due_days,7),'billing_email',v_program.billing_email,'program_status',coalesce(v_program.status,'not_configured'),
    'agreement_started_on',v_program.agreement_started_on,'agreement_ends_on',v_program.agreement_ends_on,'max_leads_per_month',v_program.max_leads_per_month,'month_delivered_count',v_month_count,
    'lead_sale_mode',coalesce(v_program.lead_sale_mode,'exclusive'),'max_buyers_per_lead',coalesce(v_program.max_buyers_per_lead,1),'manual_delivery_hold',coalesce(v_program.manual_delivery_hold,false),'delivery_hold_reason',v_program.delivery_hold_reason,
    'stop_delivery_on_open_balance',coalesce(v_program.stop_delivery_on_open_balance,false),'stop_delivery_on_overdue',coalesce(v_program.stop_delivery_on_overdue,true),'open_invoice_count',v_open_balance,'overdue_invoice_count',v_overdue,
    'auto_invoice_enabled',coalesce(v_program.auto_invoice_enabled,false),'auto_invoice_cadence',coalesce(v_program.auto_invoice_cadence,'manual')
  );
end$$;
revoke all on function public.get_business_lead_access(uuid) from public,anon;
grant execute on function public.get_business_lead_access(uuid) to authenticated,service_role;

create or replace function public.deliver_billable_lead(p_lead_id uuid,p_business_id uuid,p_route_reason text default 'Paid lead delivery',p_route_rank integer default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_program public.business_lead_programs%rowtype;v_recipient uuid;v_month_count int;v_other_buyers int;v_open int;v_overdue int;
begin
  select tenant_id into v_tenant from public.leads where id=p_lead_id;
  if v_tenant is null then raise exception 'lead_not_found';end if;
  if auth.uid() is null or not private.has_tenant_role(v_tenant,array['super_admin']) then raise exception 'insufficient_privilege';end if;
  if not exists(select 1 from public.businesses where id=p_business_id and tenant_id=v_tenant) then raise exception 'business_tenant_mismatch';end if;
  if not private.business_has_lead_inbox_access(p_business_id) then raise exception 'lead_inbox_not_enabled_for_business';end if;
  select * into v_program from public.business_lead_programs where business_id=p_business_id and status='active';
  if v_program.business_id is null then raise exception 'billing_program_not_configured';end if;
  if v_program.agreement_started_on is not null and current_date<v_program.agreement_started_on then raise exception 'lead_agreement_not_started';end if;
  if v_program.agreement_ends_on is not null and current_date>v_program.agreement_ends_on then raise exception 'lead_agreement_ended';end if;
  if v_program.manual_delivery_hold then raise exception 'lead_delivery_on_manual_hold';end if;
  if v_program.billing_model='pay_per_lead' and coalesce(v_program.per_lead_price_cents,0)<=0 then raise exception 'billing_program_not_configured';end if;
  if v_program.billing_model='lead_bundle' and(coalesce(v_program.bundle_lead_count,0)<=0 or coalesce(v_program.bundle_price_cents,0)<=0) then raise exception 'billing_program_not_configured';end if;
  if exists(select 1 from public.lead_recipients where lead_id=p_lead_id and business_id=p_business_id) then raise exception 'lead_already_delivered_to_business';end if;
  select count(distinct business_id) into v_other_buyers from public.lead_recipients where lead_id=p_lead_id and business_id<>p_business_id;
  if v_program.lead_sale_mode='exclusive' and v_other_buyers>0 then raise exception 'exclusive_lead_already_delivered';end if;
  if v_program.lead_sale_mode='shared' and v_other_buyers>=greatest(1,v_program.max_buyers_per_lead-1) then raise exception 'shared_lead_buyer_limit_reached';end if;
  if v_program.max_leads_per_month is not null then
    select count(*) into v_month_count from public.lead_delivery_charges where business_id=p_business_id and billing_status<>'void' and delivered_at>=date_trunc('month',now());
    if v_month_count>=v_program.max_leads_per_month then raise exception 'monthly_lead_cap_reached';end if;
  end if;
  if v_program.stop_delivery_on_open_balance then
    select count(*) into v_open from public.lead_invoices where business_id=p_business_id and status in('sent','overdue');
    if v_open>0 then raise exception 'delivery_blocked_open_balance';end if;
  end if;
  if v_program.stop_delivery_on_overdue then
    select count(*) into v_overdue from public.lead_invoices where business_id=p_business_id and status in('sent','overdue') and due_at is not null and due_at+make_interval(days=>v_program.overdue_grace_days)<now();
    if v_overdue>0 then raise exception 'delivery_blocked_overdue_balance';end if;
  end if;
  v_recipient:=public.route_directory_lead(p_lead_id,p_business_id,p_route_reason,p_route_rank);
  insert into public.lead_delivery_charges(tenant_id,business_id,lead_id,recipient_id,billing_model,per_lead_price_cents,bundle_lead_count,bundle_price_cents,billing_status,delivered_at,created_by)
  values(v_tenant,p_business_id,p_lead_id,v_recipient,v_program.billing_model,v_program.per_lead_price_cents,v_program.bundle_lead_count,v_program.bundle_price_cents,'unbilled',now(),auth.uid())
  on conflict(recipient_id) do nothing;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'billable_lead_delivered','Delivered billable lead '||p_lead_id||' to business '||p_business_id||'. Billing is based on delivery, not close outcome.');
  return v_recipient;
end$$;
revoke all on function public.deliver_billable_lead(uuid,uuid,text,integer) from public,anon;
grant execute on function public.deliver_billable_lead(uuid,uuid,text,integer) to authenticated,service_role;

create or replace function public.request_lead_credit(p_charge_id uuid,p_reason text,p_details text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_charge public.lead_delivery_charges%rowtype;v_id uuid;v_amount int;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if p_reason not in('duplicate','invalid_contact','spam_or_fraud','out_of_scope','other') then raise exception 'invalid_credit_reason';end if;
  select * into v_charge from public.lead_delivery_charges where id=p_charge_id;
  if v_charge.id is null then raise exception 'charge_not_found';end if;
  if not exists(select 1 from public.business_owners bo where bo.business_id=v_charge.business_id and bo.user_id=auth.uid()) then raise exception 'insufficient_privilege';end if;
  if v_charge.billing_status='void' then raise exception 'charge_already_void';end if;
  if exists(select 1 from public.lead_credit_requests where charge_id=p_charge_id and status='pending') then raise exception 'credit_request_already_pending';end if;
  v_amount:=case when v_charge.billing_model='pay_per_lead' then coalesce(v_charge.per_lead_price_cents,0) else round(coalesce(v_charge.bundle_price_cents,0)::numeric/nullif(v_charge.bundle_lead_count,0))::int end;
  insert into public.lead_credit_requests(tenant_id,business_id,charge_id,lead_id,requested_by,reason,details,requested_credit_cents,status)
  values(v_charge.tenant_id,v_charge.business_id,v_charge.id,v_charge.lead_id,auth.uid(),p_reason,nullif(trim(coalesce(p_details,'')),''),nullif(v_amount,0),'pending') returning id into v_id;
  return v_id;
end$$;
revoke all on function public.request_lead_credit(uuid,text,text) from public,anon;
grant execute on function public.request_lead_credit(uuid,text,text) to authenticated;

create or replace function public.review_lead_credit_request(p_request_id uuid,p_decision text,p_approved_credit_cents integer default null,p_staff_notes text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_req public.lead_credit_requests%rowtype;v_charge public.lead_delivery_charges%rowtype;v_amount int;v_credit uuid;
begin
  select * into v_req from public.lead_credit_requests where id=p_request_id for update;
  if v_req.id is null then raise exception 'credit_request_not_found';end if;
  if auth.uid() is null or not private.has_tenant_role(v_req.tenant_id,array['super_admin']) then raise exception 'insufficient_privilege';end if;
  if v_req.status<>'pending' then raise exception 'credit_request_already_reviewed';end if;
  if p_decision not in('approve','reject') then raise exception 'invalid_decision';end if;
  select * into v_charge from public.lead_delivery_charges where id=v_req.charge_id;
  if v_charge.id is null then raise exception 'charge_not_found';end if;
  if p_decision='reject' then
    update public.lead_credit_requests set status='rejected',approved_credit_cents=0,staff_notes=nullif(trim(coalesce(p_staff_notes,'')),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_request_id;
    insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_req.tenant_id,auth.uid(),'lead_credit_rejected','Rejected lead credit request '||p_request_id||'.');
    return jsonb_build_object('ok',true,'decision','rejected');
  end if;
  v_amount:=coalesce(p_approved_credit_cents,v_req.requested_credit_cents,case when v_charge.billing_model='pay_per_lead' then v_charge.per_lead_price_cents else round(v_charge.bundle_price_cents::numeric/nullif(v_charge.bundle_lead_count,0))::int end);
  if coalesce(v_amount,0)<=0 then raise exception 'positive_credit_required';end if;
  if v_charge.billing_status='unbilled' then
    update public.lead_delivery_charges set billing_status='void' where id=v_charge.id;
    insert into public.business_lead_credits(tenant_id,business_id,request_id,charge_id,original_amount_cents,remaining_amount_cents,status,created_by)
    values(v_req.tenant_id,v_req.business_id,v_req.id,v_req.charge_id,v_amount,0,'resolved_before_invoice',auth.uid()) returning id into v_credit;
  else
    insert into public.business_lead_credits(tenant_id,business_id,request_id,charge_id,original_amount_cents,remaining_amount_cents,status,created_by)
    values(v_req.tenant_id,v_req.business_id,v_req.id,v_req.charge_id,v_amount,v_amount,'available',auth.uid()) returning id into v_credit;
  end if;
  update public.lead_credit_requests set status='approved',approved_credit_cents=v_amount,staff_notes=nullif(trim(coalesce(p_staff_notes,'')),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_request_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_req.tenant_id,auth.uid(),'lead_credit_approved','Approved lead credit request '||p_request_id||' for $'||round(v_amount::numeric/100,2)||'.');
  return jsonb_build_object('ok',true,'decision','approved','credit_id',v_credit,'amount_cents',v_amount,'resolved_before_invoice',v_charge.billing_status='unbilled');
end$$;
revoke all on function public.review_lead_credit_request(uuid,text,integer,text) from public,anon;
grant execute on function public.review_lead_credit_request(uuid,text,integer,text) to authenticated,service_role;

create or replace function private.create_lead_invoice_internal(p_business_id uuid,p_notes text default null,p_actor uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_program public.business_lead_programs%rowtype;v_invoice uuid;v_count int;v_subtotal int;v_bundle_count int:=0;v_limit int;v_number text;v_credit_total int:=0;v_due int;v_remaining int;v_credit public.business_lead_credits%rowtype;v_apply int;
begin
  select tenant_id into v_tenant from public.businesses where id=p_business_id;
  if v_tenant is null then raise exception 'business_not_found';end if;
  select * into v_program from public.business_lead_programs where business_id=p_business_id and status='active';
  if v_program.business_id is null then raise exception 'billing_program_not_configured';end if;
  if v_program.billing_model='pay_per_lead' then
    select count(*),coalesce(sum(per_lead_price_cents),0) into v_count,v_subtotal from public.lead_delivery_charges where business_id=p_business_id and billing_status='unbilled' and billing_model='pay_per_lead';
    if v_count=0 or v_subtotal<=0 then raise exception 'no_unbilled_leads';end if;v_limit:=v_count;
  else
    select count(*) into v_count from public.lead_delivery_charges where business_id=p_business_id and billing_status='unbilled' and billing_model='lead_bundle' and bundle_lead_count=v_program.bundle_lead_count and bundle_price_cents=v_program.bundle_price_cents;
    v_bundle_count:=floor(v_count::numeric/v_program.bundle_lead_count)::int;
    if v_bundle_count<=0 then raise exception 'bundle_not_yet_fulfilled';end if;
    v_limit:=v_bundle_count*v_program.bundle_lead_count;v_count:=v_limit;v_subtotal:=v_bundle_count*v_program.bundle_price_cents;
  end if;
  v_number:='LP-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.lead_invoice_number_seq')::text,6,'0');
  insert into public.lead_invoices(tenant_id,business_id,invoice_number,billing_model,lead_count,bundle_count,subtotal_cents,credit_applied_cents,amount_due_cents,status,due_at,notes,created_by)
  values(v_tenant,p_business_id,v_number,v_program.billing_model,v_count,v_bundle_count,v_subtotal,0,v_subtotal,'draft',now()+make_interval(days=>v_program.due_days),nullif(trim(coalesce(p_notes,'')),''),p_actor) returning id into v_invoice;
  with picked as(select id from public.lead_delivery_charges where business_id=p_business_id and billing_status='unbilled' and billing_model=v_program.billing_model and(v_program.billing_model='pay_per_lead' or(bundle_lead_count=v_program.bundle_lead_count and bundle_price_cents=v_program.bundle_price_cents)) order by delivered_at,id limit v_limit)
  update public.lead_delivery_charges c set billing_status='invoiced',invoice_id=v_invoice from picked where c.id=picked.id;
  v_remaining:=v_subtotal;
  for v_credit in select * from public.business_lead_credits where business_id=p_business_id and status='available' and remaining_amount_cents>0 order by created_at,id for update loop
    exit when v_remaining<=0;
    v_apply:=least(v_remaining,v_credit.remaining_amount_cents);
    insert into public.lead_credit_applications(tenant_id,credit_id,invoice_id,amount_cents) values(v_tenant,v_credit.id,v_invoice,v_apply);
    update public.business_lead_credits set remaining_amount_cents=remaining_amount_cents-v_apply,status=case when remaining_amount_cents-v_apply=0 then 'exhausted' else 'available' end,updated_at=now() where id=v_credit.id;
    v_credit_total:=v_credit_total+v_apply;v_remaining:=v_remaining-v_apply;
  end loop;
  v_due:=v_subtotal-v_credit_total;
  update public.lead_invoices set credit_applied_cents=v_credit_total,amount_due_cents=v_due,status=case when v_due=0 then 'paid' else 'draft' end,paid_at=case when v_due=0 then now() end,updated_at=now() where id=v_invoice;
  if v_due=0 then update public.lead_delivery_charges set billing_status='paid' where invoice_id=v_invoice;end if;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,p_actor,'lead_invoice_created','Created lead invoice '||v_number||' for '||v_count||' delivered lead(s), subtotal $'||round(v_subtotal::numeric/100,2)||', credits $'||round(v_credit_total::numeric/100,2)||'.');
  return v_invoice;
end$$;
revoke all on function private.create_lead_invoice_internal(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.create_lead_invoice_internal(uuid,text,uuid) to service_role;

create or replace function public.create_lead_invoice(p_business_id uuid,p_notes text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.businesses where id=p_business_id;
  if v_tenant is null then raise exception 'business_not_found';end if;
  if auth.uid() is null or not private.has_tenant_role(v_tenant,array['super_admin']) then raise exception 'insufficient_privilege';end if;
  return private.create_lead_invoice_internal(p_business_id,p_notes,auth.uid());
end$$;
revoke all on function public.create_lead_invoice(uuid,text) from public,anon;
grant execute on function public.create_lead_invoice(uuid,text) to authenticated,service_role;

create or replace function private.notify_lead_delivery_owner() returns trigger language plpgsql security definer set search_path='' as $$
declare v_program public.business_lead_programs%rowtype;v_lead public.leads%rowtype;v_owner record;
begin
  select * into v_program from public.business_lead_programs where business_id=new.business_id;
  if coalesce(v_program.notify_on_delivery,true) then
    select * into v_lead from public.leads where id=new.lead_id;
    for v_owner in select user_id from public.business_owners where business_id=new.business_id loop
      insert into public.notifications(user_id,tenant_id,title,body,action_url) values(v_owner.user_id,new.tenant_id,'New lead delivered',coalesce(v_lead.service,'Local service')||' lead in '||coalesce(v_lead.city,'your service area')||' was delivered to your Lead Inbox.','/business-portal/leads?business='||new.business_id::text);
    end loop;
  end if;
  return new;
end$$;
revoke all on function private.notify_lead_delivery_owner() from public,anon,authenticated;

drop trigger if exists trg_notify_lead_delivery_owner on public.lead_delivery_charges;
create trigger trg_notify_lead_delivery_owner after insert on public.lead_delivery_charges for each row execute function private.notify_lead_delivery_owner();

create or replace function private.notify_lead_invoice_owner() returns trigger language plpgsql security definer set search_path='' as $$
declare v_program public.business_lead_programs%rowtype;v_owner record;v_title text;v_body text;
begin
  select * into v_program from public.business_lead_programs where business_id=new.business_id;
  if not coalesce(v_program.notify_on_invoice,true) then return new;end if;
  if tg_op='INSERT' then v_title:='Lead invoice created';v_body:=new.invoice_number||' was created for $'||to_char(new.amount_due_cents::numeric/100,'FM999999990.00')||'.';
  elsif new.status is distinct from old.status and new.status='overdue' then v_title:='Lead invoice overdue';v_body:=new.invoice_number||' is overdue. Lead delivery may pause based on your agreement.';
  elsif new.status is distinct from old.status and new.status='paid' then v_title:='Lead invoice paid';v_body:=new.invoice_number||' is recorded as paid.';
  elsif new.status is distinct from old.status and new.status='sent' then v_title:='Lead invoice sent';v_body:=new.invoice_number||' was sent and is due '||coalesce(to_char(new.due_at,'Mon DD, YYYY'),'per agreement')||'.';
  else return new;end if;
  for v_owner in select user_id from public.business_owners where business_id=new.business_id loop
    insert into public.notifications(user_id,tenant_id,title,body,action_url) values(v_owner.user_id,new.tenant_id,v_title,v_body,'/business-portal/billing?business='||new.business_id::text);
  end loop;
  return new;
end$$;
revoke all on function private.notify_lead_invoice_owner() from public,anon,authenticated;

drop trigger if exists trg_notify_lead_invoice_owner on public.lead_invoices;
create trigger trg_notify_lead_invoice_owner after insert or update of status on public.lead_invoices for each row execute function private.notify_lead_invoice_owner();

create or replace function private.process_lead_billing_cycle() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_program public.business_lead_programs%rowtype;v_created int:=0;v_overdue int:=0;v_invoice uuid;v_due boolean;
begin
  update public.lead_invoices set status='overdue',updated_at=now() where status='sent' and due_at is not null and due_at<now();
  get diagnostics v_overdue=row_count;
  for v_program in select * from public.business_lead_programs where status='active' and auto_invoice_enabled=true and auto_invoice_cadence<>'manual' loop
    v_due:=case v_program.auto_invoice_cadence when 'daily' then v_program.last_auto_invoice_at is null or v_program.last_auto_invoice_at<now()-interval '1 day' when 'weekly' then v_program.last_auto_invoice_at is null or v_program.last_auto_invoice_at<now()-interval '7 days' when 'monthly' then v_program.last_auto_invoice_at is null or date_trunc('month',v_program.last_auto_invoice_at)<date_trunc('month',now()) when 'bundle_ready' then true else false end;
    if not v_due or v_program.manual_delivery_hold then continue;end if;
    begin
      v_invoice:=private.create_lead_invoice_internal(v_program.business_id,'Automatically prepared draft from delivered leads.',null);
      update public.business_lead_programs set last_auto_invoice_at=now(),updated_at=now() where id=v_program.id;
      v_created:=v_created+1;
    exception when others then
      if sqlerrm not like '%no_unbilled_leads%' and sqlerrm not like '%bundle_not_yet_fulfilled%' then
        insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_program.tenant_id,null,'lead_auto_invoice_error','Auto invoice failed for business '||v_program.business_id||': '||left(sqlerrm,400));
      end if;
    end;
  end loop;
  return jsonb_build_object('overdue_marked',v_overdue,'draft_invoices_created',v_created,'processed_at',now());
end$$;
revoke all on function private.process_lead_billing_cycle() from public,anon,authenticated;
grant execute on function private.process_lead_billing_cycle() to service_role;

create extension if not exists pg_cron;
do $$declare v_job bigint;begin
  if to_regclass('cron.job') is not null then
    for v_job in select jobid from cron.job where jobname='central-il-lead-billing-daily' loop perform cron.unschedule(v_job);end loop;
    perform cron.schedule('central-il-lead-billing-daily','15 11 * * *','select private.process_lead_billing_cycle();');
  end if;
end$$;
