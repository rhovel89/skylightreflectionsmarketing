create table if not exists public.lead_buyer_crm_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  sales_status text not null default 'open' check (sales_status in ('open','paused','declined')),
  target_price_cents integer check (target_price_cents is null or target_price_cents > 0),
  preferred_sale_mode text not null default 'either' check (preferred_sale_mode in ('either','exclusive','shared')),
  target_monthly_cap integer check (target_monthly_cap is null or target_monthly_cap > 0),
  target_billing_model text not null default 'undecided' check (target_billing_model in ('undecided','pay_per_lead','lead_bundle')),
  follow_up_at timestamptz,
  last_contact_at timestamptz,
  reopened_at timestamptz,
  internal_notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, business_id)
);
create table if not exists public.lead_buyer_crm_categories (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  primary key (business_id, category_id)
);
create table if not exists public.lead_buyer_crm_service_areas (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  primary key (business_id, location_id)
);
create index if not exists lead_buyer_crm_profiles_queue_idx on public.lead_buyer_crm_profiles (tenant_id,sales_status,follow_up_at,updated_at desc);
create index if not exists lead_buyer_crm_categories_tenant_idx on public.lead_buyer_crm_categories (tenant_id,business_id);
create index if not exists lead_buyer_crm_categories_category_idx on public.lead_buyer_crm_categories (category_id);
create index if not exists lead_buyer_crm_service_areas_tenant_idx on public.lead_buyer_crm_service_areas (tenant_id,business_id);
create index if not exists lead_buyer_crm_service_areas_location_idx on public.lead_buyer_crm_service_areas (location_id);
alter table public.lead_buyer_crm_profiles enable row level security;
alter table public.lead_buyer_crm_categories enable row level security;
alter table public.lead_buyer_crm_service_areas enable row level security;
revoke all on public.lead_buyer_crm_profiles from anon;
revoke all on public.lead_buyer_crm_categories from anon;
revoke all on public.lead_buyer_crm_service_areas from anon;
grant select,insert,update,delete on public.lead_buyer_crm_profiles to authenticated;
grant select,insert,update,delete on public.lead_buyer_crm_categories to authenticated;
grant select,insert,update,delete on public.lead_buyer_crm_service_areas to authenticated;
drop policy if exists lead_buyer_crm_profiles_staff_read on public.lead_buyer_crm_profiles;
create policy lead_buyer_crm_profiles_staff_read on public.lead_buyer_crm_profiles for select to authenticated using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
drop policy if exists lead_buyer_crm_profiles_admin_manage on public.lead_buyer_crm_profiles;
create policy lead_buyer_crm_profiles_admin_manage on public.lead_buyer_crm_profiles for all to authenticated using(private.has_tenant_role(tenant_id,array['admin','super_admin'])) with check(private.has_tenant_role(tenant_id,array['admin','super_admin']) and exists(select 1 from public.businesses b where b.id=lead_buyer_crm_profiles.business_id and b.tenant_id=lead_buyer_crm_profiles.tenant_id));
drop policy if exists lead_buyer_crm_categories_staff_read on public.lead_buyer_crm_categories;
create policy lead_buyer_crm_categories_staff_read on public.lead_buyer_crm_categories for select to authenticated using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
drop policy if exists lead_buyer_crm_categories_admin_manage on public.lead_buyer_crm_categories;
create policy lead_buyer_crm_categories_admin_manage on public.lead_buyer_crm_categories for all to authenticated using(private.has_tenant_role(tenant_id,array['admin','super_admin'])) with check(private.has_tenant_role(tenant_id,array['admin','super_admin']) and exists(select 1 from public.businesses b where b.id=lead_buyer_crm_categories.business_id and b.tenant_id=lead_buyer_crm_categories.tenant_id) and exists(select 1 from public.categories c where c.id=lead_buyer_crm_categories.category_id and c.tenant_id=lead_buyer_crm_categories.tenant_id and c.is_active));
drop policy if exists lead_buyer_crm_service_areas_staff_read on public.lead_buyer_crm_service_areas;
create policy lead_buyer_crm_service_areas_staff_read on public.lead_buyer_crm_service_areas for select to authenticated using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
drop policy if exists lead_buyer_crm_service_areas_admin_manage on public.lead_buyer_crm_service_areas;
create policy lead_buyer_crm_service_areas_admin_manage on public.lead_buyer_crm_service_areas for all to authenticated using(private.has_tenant_role(tenant_id,array['admin','super_admin'])) with check(private.has_tenant_role(tenant_id,array['admin','super_admin']) and exists(select 1 from public.businesses b where b.id=lead_buyer_crm_service_areas.business_id and b.tenant_id=lead_buyer_crm_service_areas.tenant_id) and exists(select 1 from public.locations l where l.id=lead_buyer_crm_service_areas.location_id and l.tenant_id=lead_buyer_crm_service_areas.tenant_id and l.is_active));
create or replace function public.update_lead_buyer_crm_profile(p_tenant_id uuid,p_business_id uuid,p_sales_status text default 'open',p_target_price_cents integer default null,p_preferred_sale_mode text default 'either',p_target_monthly_cap integer default null,p_target_billing_model text default 'undecided',p_follow_up_at timestamptz default null,p_internal_notes text default null,p_category_ids uuid[] default '{}'::uuid[],p_location_ids uuid[] default '{}'::uuid[],p_mark_contacted boolean default false,p_reopen boolean default false) returns public.lead_buyer_crm_profiles language plpgsql security invoker set search_path='' as $$
declare v_profile public.lead_buyer_crm_profiles%rowtype;v_category_count integer;v_location_count integer;v_distinct_category_count integer;v_distinct_location_count integer;v_status text:=lower(trim(coalesce(p_sales_status,'open')));v_sale_mode text:=lower(trim(coalesce(p_preferred_sale_mode,'either')));v_billing_model text:=lower(trim(coalesce(p_target_billing_model,'undecided')));
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 if not private.has_tenant_role(p_tenant_id,array['admin','super_admin']) then raise exception 'insufficient_privilege';end if;
 if v_status not in('open','paused','declined') then raise exception 'invalid_sales_status';end if;
 if v_sale_mode not in('either','exclusive','shared') then raise exception 'invalid_preferred_sale_mode';end if;
 if v_billing_model not in('undecided','pay_per_lead','lead_bundle') then raise exception 'invalid_target_billing_model';end if;
 if p_target_price_cents is not null and p_target_price_cents<=0 then raise exception 'invalid_target_price';end if;
 if p_target_monthly_cap is not null and p_target_monthly_cap<=0 then raise exception 'invalid_target_monthly_cap';end if;
 if cardinality(coalesce(p_category_ids,'{}'::uuid[]))>100 or cardinality(coalesce(p_location_ids,'{}'::uuid[]))>100 then raise exception 'too_many_preferences';end if;
 if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='published') then raise exception 'published_business_required';end if;
 select count(*),count(distinct x) into v_category_count,v_distinct_category_count from unnest(coalesce(p_category_ids,'{}'::uuid[])) x;
 if v_category_count<>v_distinct_category_count then raise exception 'duplicate_category_preference';end if;
 if v_category_count>0 and (select count(*) from public.categories c where c.id=any(p_category_ids) and c.tenant_id=p_tenant_id and c.is_active)<>v_category_count then raise exception 'invalid_category_preference';end if;
 select count(*),count(distinct x) into v_location_count,v_distinct_location_count from unnest(coalesce(p_location_ids,'{}'::uuid[])) x;
 if v_location_count<>v_distinct_location_count then raise exception 'duplicate_location_preference';end if;
 if v_location_count>0 and (select count(*) from public.locations l where l.id=any(p_location_ids) and l.tenant_id=p_tenant_id and l.is_active)<>v_location_count then raise exception 'invalid_location_preference';end if;
 insert into public.lead_buyer_crm_profiles(tenant_id,business_id,sales_status,target_price_cents,preferred_sale_mode,target_monthly_cap,target_billing_model,follow_up_at,last_contact_at,reopened_at,internal_notes,created_by,updated_by,updated_at) values(p_tenant_id,p_business_id,case when p_reopen then 'open' else v_status end,p_target_price_cents,v_sale_mode,p_target_monthly_cap,v_billing_model,p_follow_up_at,case when p_mark_contacted then now() else null end,case when p_reopen then now() else null end,nullif(trim(coalesce(p_internal_notes,'')),''),auth.uid(),auth.uid(),now()) on conflict(tenant_id,business_id) do update set sales_status=case when p_reopen then 'open' else excluded.sales_status end,target_price_cents=excluded.target_price_cents,preferred_sale_mode=excluded.preferred_sale_mode,target_monthly_cap=excluded.target_monthly_cap,target_billing_model=excluded.target_billing_model,follow_up_at=excluded.follow_up_at,last_contact_at=case when p_mark_contacted then now() else public.lead_buyer_crm_profiles.last_contact_at end,reopened_at=case when p_reopen then now() else public.lead_buyer_crm_profiles.reopened_at end,internal_notes=excluded.internal_notes,updated_by=auth.uid(),updated_at=now() returning * into v_profile;
 delete from public.lead_buyer_crm_categories where tenant_id=p_tenant_id and business_id=p_business_id;
 insert into public.lead_buyer_crm_categories(tenant_id,business_id,category_id,created_by) select p_tenant_id,p_business_id,x,auth.uid() from unnest(coalesce(p_category_ids,'{}'::uuid[])) x;
 delete from public.lead_buyer_crm_service_areas where tenant_id=p_tenant_id and business_id=p_business_id;
 insert into public.lead_buyer_crm_service_areas(tenant_id,business_id,location_id,created_by) select p_tenant_id,p_business_id,x,auth.uid() from unnest(coalesce(p_location_ids,'{}'::uuid[])) x;
 insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(p_tenant_id,auth.uid(),case when p_reopen then 'lead_buyer_crm_reopened' when p_mark_contacted then 'lead_buyer_crm_contacted' else 'lead_buyer_crm_updated' end,'Updated lead buyer CRM for business '||p_business_id::text||'. Sales status: '||v_profile.sales_status||'. No billing or future routing was activated by this CRM update.');
 return v_profile;
end $$;
revoke all on function public.update_lead_buyer_crm_profile(uuid,uuid,text,integer,text,integer,text,timestamptz,text,uuid[],uuid[],boolean,boolean) from public,anon;
grant execute on function public.update_lead_buyer_crm_profile(uuid,uuid,text,integer,text,integer,text,timestamptz,text,uuid[],uuid[],boolean,boolean) to authenticated,service_role;
comment on table public.lead_buyer_crm_profiles is 'Admin-only pre-agreement lead buyer conversion metadata. Final billable terms remain in business_lead_programs.';
comment on column public.lead_buyer_crm_profiles.target_price_cents is 'Negotiation target only; does not activate billing.';
comment on column public.lead_buyer_crm_profiles.internal_notes is 'Internal Admin sales notes; intentionally not exposed to business owners.';
