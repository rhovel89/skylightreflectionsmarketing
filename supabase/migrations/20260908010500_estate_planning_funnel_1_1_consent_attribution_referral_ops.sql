create table if not exists public.estate_planning_lead_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  consent_version text not null,
  contact_consent_text text not null,
  referral_consent_text text not null,
  source_page text not null,
  landing_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  contact_snapshot jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_estate_planning_consents_tenant_recorded on public.estate_planning_lead_consents(tenant_id, recorded_at desc);
alter table public.estate_planning_lead_consents enable row level security;
revoke all on table public.estate_planning_lead_consents from anon, authenticated;
grant select on table public.estate_planning_lead_consents to authenticated;
grant all on table public.estate_planning_lead_consents to service_role;
drop policy if exists "staff read estate planning consent records" on public.estate_planning_lead_consents;
create policy "staff read estate planning consent records" on public.estate_planning_lead_consents
for select to authenticated
using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));

create table if not exists public.estate_planning_lead_referrals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  qualification_status text not null default 'new' check (qualification_status in ('new','reviewing','qualified','not_qualified')),
  referral_status text not null default 'unassigned' check (referral_status in ('unassigned','pending_review','approved_for_referral','referred','accepted','declined','closed')),
  provider_name text,
  provider_state text check (provider_state is null or provider_state ~ '^[A-Z]{2}$'),
  provider_reference text,
  qualification_notes text,
  referral_notes text,
  assigned_at timestamptz,
  referred_at timestamptz,
  provider_responded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_estate_planning_referrals_tenant_status on public.estate_planning_lead_referrals(tenant_id, qualification_status, referral_status, updated_at desc);
alter table public.estate_planning_lead_referrals enable row level security;
revoke all on table public.estate_planning_lead_referrals from anon, authenticated;
grant select,insert,update on table public.estate_planning_lead_referrals to authenticated;
grant all on table public.estate_planning_lead_referrals to service_role;
drop policy if exists "staff manage estate planning referrals" on public.estate_planning_lead_referrals;
create policy "staff manage estate planning referrals" on public.estate_planning_lead_referrals
for all to authenticated
using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));

create or replace function public.submit_estate_planning_lead_v3(
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
  p_consent_to_share boolean,
  p_attribution jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
  v_tenant constant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
  v_state text := upper(trim(coalesce(p_state,'')));
  v_attr jsonb := case when jsonb_typeof(coalesce(p_attribution,'{}'::jsonb))='object' then coalesce(p_attribution,'{}'::jsonb) else '{}'::jsonb end;
  v_consent_version constant text := 'estate-planning-provider-referral-v3-2026-09';
  v_contact_consent constant text := 'I agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me by phone, text, or email about this estate-planning consultation request. Message and data rates may apply.';
  v_referral_consent constant text := 'I agree that Skylight Reflections Marketing may share this request and my contact information with a participating estate-planning service provider for the purpose of discussing and scheduling an estate-planning consultation.';
begin
  if not coalesce(p_consent_to_contact,false) or not coalesce(p_consent_to_share,false) then raise exception 'contact and referral consent are required'; end if;
  if char_length(trim(coalesce(p_consumer_name,''))) < 2 or char_length(trim(coalesce(p_phone,''))) < 7 or position('@' in coalesce(p_email,'')) < 2 then raise exception 'valid contact information is required'; end if;
  if char_length(trim(coalesce(p_city,''))) < 2 then raise exception 'city is required'; end if;
  if v_state !~ '^[A-Z]{2}$' then raise exception 'valid state is required'; end if;
  if p_zip_code is not null and trim(p_zip_code) <> '' and trim(p_zip_code) !~ '^[0-9]{5}(-[0-9]{4})?$' then raise exception 'valid ZIP code required'; end if;
  if char_length(trim(coalesce(p_primary_need,''))) < 2 then raise exception 'planning need is required'; end if;

  insert into public.leads(tenant_id,business_id,assigned_business_id,service,city,consumer_name,phone,email,message,timeline,status,consumer_user_id,consent_to_contact,source,consent_disclosure_version,consent_recorded_at)
  values(v_tenant,null,null,'Estate Planning & Trust',trim(p_city),trim(p_consumer_name),trim(p_phone),trim(p_email),nullif(trim(coalesce(p_message,'')),''),nullif(trim(coalesce(p_timeline,'')),''),'new',v_user,true,'estate_planning_nationwide',v_consent_version,now()) returning id into v_id;

  insert into public.lead_project_details(lead_id,tenant_id,project_type,property_type,budget_range,zip_code,preferred_contact,urgency,answers)
  values(v_id,v_tenant,nullif(trim(coalesce(p_primary_need,'')),''),'Personal / legal matter',null,nullif(trim(coalesce(p_zip_code,'')),''),nullif(trim(coalesce(p_preferred_contact,'')),''),nullif(trim(coalesce(p_timeline,'')),''),jsonb_build_object('state',v_state,'primary_need',trim(coalesce(p_primary_need,'')),'existing_plan',nullif(trim(coalesce(p_existing_plan,'')),''),'family_context',nullif(trim(coalesce(p_family_context,'')),''),'business_owner',coalesce(p_business_owner,false),'real_estate_owner',coalesce(p_real_estate_owner,false),'referral_partner','Participating estate-planning service provider','lead_program','estate_planning_nationwide','consent_to_share_with_estate_planning_provider',true));

  insert into public.estate_planning_lead_sales(tenant_id,lead_id,created_by,updated_by) values(v_tenant,v_id,v_user,v_user);
  insert into public.estate_planning_lead_referrals(tenant_id,lead_id,created_by,updated_by) values(v_tenant,v_id,v_user,v_user);
  insert into public.estate_planning_lead_consents(tenant_id,lead_id,consent_version,contact_consent_text,referral_consent_text,source_page,landing_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,contact_snapshot,recorded_at)
  values(
    v_tenant,v_id,v_consent_version,v_contact_consent,v_referral_consent,'/estate-planning',
    left(nullif(trim(v_attr->>'landing_path'),''),1000),
    left(nullif(trim(v_attr->>'referrer'),''),1000),
    left(nullif(trim(v_attr->>'utm_source'),''),200),
    left(nullif(trim(v_attr->>'utm_medium'),''),200),
    left(nullif(trim(v_attr->>'utm_campaign'),''),200),
    left(nullif(trim(v_attr->>'utm_content'),''),200),
    left(nullif(trim(v_attr->>'utm_term'),''),200),
    jsonb_build_object('consumer_name',trim(p_consumer_name),'phone',trim(p_phone),'email',trim(p_email),'city',trim(p_city),'state',v_state,'zip_code',nullif(trim(coalesce(p_zip_code,'')),'')),
    now()
  );
  return v_id;
end;
$$;

revoke all on function public.submit_estate_planning_lead_v3(text,text,text,text,text,text,text,text,text,boolean,boolean,text,text,text,boolean,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.submit_estate_planning_lead_v3(text,text,text,text,text,text,text,text,text,boolean,boolean,text,text,text,boolean,boolean,jsonb) to anon, authenticated;

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
security invoker
set search_path to ''
as $$
begin
  if p_tenant_id is distinct from '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid then raise exception 'invalid tenant'; end if;
  return public.submit_estate_planning_lead_v3(
    p_consumer_name,p_phone,p_email,p_city,p_state,p_zip_code,p_primary_need,p_existing_plan,p_family_context,p_business_owner,p_real_estate_owner,p_timeline,p_preferred_contact,p_message,p_consent_to_contact,p_consent_to_share,
    jsonb_build_object('landing_path','/estate-planning')
  );
end;
$$;

revoke all on function public.submit_estate_planning_lead(uuid,text,text,text,text,text,text,text,text,text,boolean,boolean,text,text,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.submit_estate_planning_lead(uuid,text,text,text,text,text,text,text,text,text,boolean,boolean,text,text,text,boolean,boolean) to anon, authenticated;
