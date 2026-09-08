create table if not exists public.estate_planning_lead_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  buyer_name text not null default 'Estate Legacy Pro',
  buyer_url text not null default 'https://estatelegacypro.com/',
  follow_up_status text not null default 'new' check (follow_up_status in ('new','attempted_contact','contacted','appointment_scheduled','appointment_completed','not_reached','not_qualified','closed')),
  sale_status text not null default 'not_delivered' check (sale_status in ('not_delivered','delivered','sold','not_sold','invalid')),
  appointment_at timestamptz,
  delivered_at timestamptz,
  sold_at timestamptz,
  sale_amount_cents integer check (sale_amount_cents is null or sale_amount_cents >= 0),
  owner_notes text,
  last_contact_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_estate_planning_lead_sales_tenant_status on public.estate_planning_lead_sales(tenant_id, follow_up_status, created_at desc);
create index if not exists idx_estate_planning_lead_sales_tenant_sale on public.estate_planning_lead_sales(tenant_id, sale_status, created_at desc);
create index if not exists idx_estate_planning_lead_sales_lead on public.estate_planning_lead_sales(lead_id);

alter table public.estate_planning_lead_sales enable row level security;
revoke all on table public.estate_planning_lead_sales from anon;
grant select,insert,update on table public.estate_planning_lead_sales to authenticated;
grant all on table public.estate_planning_lead_sales to service_role;

drop policy if exists "staff manage estate planning lead sales" on public.estate_planning_lead_sales;
create policy "staff manage estate planning lead sales" on public.estate_planning_lead_sales
for all to authenticated
using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));

create or replace function public.submit_estate_planning_lead(
  p_tenant_id uuid,
  p_consumer_name text,
  p_phone text,
  p_email text,
  p_city text,
  p_state text,
  p_zip_code text,
  p_primary_need text,
  p_existing_plan text,
  p_family_context text,
  p_business_owner boolean,
  p_real_estate_owner boolean,
  p_timeline text,
  p_preferred_contact text,
  p_message text,
  p_consent_to_contact boolean,
  p_consent_to_share boolean
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
  v_state text := upper(trim(coalesce(p_state,'')));
begin
  if not p_consent_to_contact or not p_consent_to_share then raise exception 'contact and referral consent are required'; end if;
  if char_length(trim(coalesce(p_consumer_name,''))) < 2 or char_length(trim(coalesce(p_phone,''))) < 7 or position('@' in coalesce(p_email,'')) < 2 then raise exception 'valid contact information is required'; end if;
  if char_length(trim(coalesce(p_city,''))) < 2 then raise exception 'city is required'; end if;
  if v_state !~ '^[A-Z]{2}$' then raise exception 'valid state is required'; end if;
  if p_zip_code is not null and trim(p_zip_code) <> '' and trim(p_zip_code) !~ '^[0-9]{5}(-[0-9]{4})?$' then raise exception 'valid ZIP code required'; end if;
  if char_length(trim(coalesce(p_primary_need,''))) < 2 then raise exception 'planning need is required'; end if;

  insert into public.leads(tenant_id,business_id,assigned_business_id,service,city,consumer_name,phone,email,message,timeline,status,consumer_user_id,consent_to_contact,source,consent_disclosure_version,consent_recorded_at)
  values(p_tenant_id,null,null,'Estate Planning & Trust',trim(p_city),trim(p_consumer_name),trim(p_phone),trim(p_email),nullif(trim(coalesce(p_message,'')),''),nullif(trim(coalesce(p_timeline,'')),''),'new',v_user,true,'estate_legacy_pro_nationwide','estate-legacy-pro-referral-v1-2026-09',now()) returning id into v_id;

  insert into public.lead_project_details(lead_id,tenant_id,project_type,property_type,budget_range,zip_code,preferred_contact,urgency,answers)
  values(v_id,p_tenant_id,nullif(trim(coalesce(p_primary_need,'')),''),'Personal / legal matter',null,nullif(trim(coalesce(p_zip_code,'')),''),nullif(trim(coalesce(p_preferred_contact,'')),''),nullif(trim(coalesce(p_timeline,'')),''),jsonb_build_object('state',v_state,'primary_need',trim(coalesce(p_primary_need,'')),'existing_plan',nullif(trim(coalesce(p_existing_plan,'')),''),'family_context',nullif(trim(coalesce(p_family_context,'')),''),'business_owner',coalesce(p_business_owner,false),'real_estate_owner',coalesce(p_real_estate_owner,false),'referral_partner','Estate Legacy Pro','referral_partner_url','https://estatelegacypro.com/','lead_program','estate_legacy_pro_nationwide','consent_to_share_with_estate_legacy_pro',true));

  insert into public.estate_planning_lead_sales(tenant_id,lead_id,created_by,updated_by) values(p_tenant_id,v_id,v_user,v_user);
  return v_id;
end;
$$;

revoke all on function public.submit_estate_planning_lead(uuid,text,text,text,text,text,text,text,text,text,boolean,boolean,text,text,text,boolean,boolean) from public;
grant execute on function public.submit_estate_planning_lead(uuid,text,text,text,text,text,text,text,text,text,boolean,boolean,text,text,text,boolean,boolean) to anon, authenticated;
