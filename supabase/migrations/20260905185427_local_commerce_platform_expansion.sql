-- Central Illinois Local Pros: Local Commerce platform expansion
-- Adds project matching, ROI outcomes, community recommendations, deals,
-- availability, appointments, catalogs, portfolios, Q&A, local alerts,
-- referral tracking, and request-first marketplace controls.
-- Paid products remain separate from verification and organic ranking.

alter table public.lead_recipients
  add column if not exists appointment_at timestamptz,
  add column if not exists quote_amount_cents integer,
  add column if not exists outcome_value_cents integer,
  add column if not exists loss_reason text,
  add column if not exists outcome_updated_at timestamptz,
  add column if not exists won_at timestamptz,
  add column if not exists lost_at timestamptz;

alter table public.lead_recipients drop constraint if exists lead_recipients_quote_amount_nonnegative;
alter table public.lead_recipients add constraint lead_recipients_quote_amount_nonnegative check (quote_amount_cents is null or quote_amount_cents >= 0);
alter table public.lead_recipients drop constraint if exists lead_recipients_outcome_value_nonnegative;
alter table public.lead_recipients add constraint lead_recipients_outcome_value_nonnegative check (outcome_value_cents is null or outcome_value_cents >= 0);

alter table public.lead_marketplace_offers
  add column if not exists access_mode text not null default 'prepaid',
  add column if not exists checkout_enabled boolean not null default true;
alter table public.lead_marketplace_offers drop constraint if exists lead_marketplace_offers_access_mode_check;
alter table public.lead_marketplace_offers add constraint lead_marketplace_offers_access_mode_check check (access_mode in ('prepaid','admin_request'));

create table if not exists public.lead_project_details (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_type text,
  property_type text,
  budget_range text,
  zip_code text,
  preferred_contact text,
  urgency text,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lead_project_details_tenant_idx on public.lead_project_details(tenant_id,created_at desc);

create table if not exists public.business_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  service text,
  city text,
  body text,
  service_date date,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,business_id)
);
create index if not exists business_recommendations_public_idx on public.business_recommendations(business_id,status,created_at desc);
create index if not exists business_recommendations_staff_idx on public.business_recommendations(tenant_id,status,created_at desc);

create table if not exists public.business_deals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  details text,
  promo_code text,
  cta_label text,
  cta_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_deals_public_idx on public.business_deals(status,starts_at,ends_at,business_id);
create index if not exists business_deals_owner_idx on public.business_deals(business_id,created_at desc);

create table if not exists public.business_availability (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  availability_status text not null default 'taking_new_customers' check (availability_status in ('available_today','taking_new_customers','emergency_24_7','limited','unavailable')),
  message text,
  expires_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists business_availability_public_idx on public.business_availability(tenant_id,availability_status,expires_at);

create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  consumer_user_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null,
  alternate_at timestamptz,
  request_type text,
  consumer_name text not null,
  phone text not null,
  email text not null,
  message text,
  status text not null default 'pending_admin' check (status in ('pending_admin','released_to_business','accepted','declined','reschedule_requested','completed','cancelled')),
  owner_response text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointment_requests_business_idx on public.appointment_requests(business_id,status,requested_at);
create index if not exists appointment_requests_consumer_idx on public.appointment_requests(consumer_user_id,created_at desc);

create table if not exists public.business_catalog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_type text not null default 'service' check (item_type in ('service','menu_item','product')),
  category_label text,
  name text not null,
  description text,
  price_label text,
  item_url text,
  sort_order integer not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_catalog_public_idx on public.business_catalog_items(business_id,status,item_type,sort_order);

create table if not exists public.business_portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  summary text,
  project_type text,
  city text,
  completed_on date,
  before_media_id uuid references public.business_media(id) on delete set null,
  after_media_id uuid references public.business_media(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_portfolio_public_idx on public.business_portfolio_projects(business_id,status,completed_on desc nulls last,created_at desc);

create table if not exists public.local_pro_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text,
  status text not null default 'pending' check (status in ('pending','awaiting_review','published','rejected')),
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists local_pro_questions_public_idx on public.local_pro_questions(business_id,status,created_at desc);
create index if not exists local_pro_questions_staff_idx on public.local_pro_questions(tenant_id,status,updated_at desc);

create table if not exists public.consumer_local_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  alert_type text not null check (alert_type in ('deals','new_businesses','local_updates')),
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,location_id,category_id,alert_type)
);
create index if not exists consumer_local_alerts_user_idx on public.consumer_local_alert_preferences(user_id,active);

create table if not exists public.business_referral_codes (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_referrals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  referrer_business_id uuid not null references public.businesses(id) on delete cascade,
  referred_business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','qualified','credited','rejected')),
  credit_value_cents integer not null default 0 check (credit_value_cents >= 0),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  credited_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text,
  unique(referred_business_id),
  check (referrer_business_id <> referred_business_id)
);
create index if not exists business_referrals_referrer_idx on public.business_referrals(referrer_business_id,status,created_at desc);

create table if not exists public.lead_marketplace_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offer_id uuid not null references public.lead_marketplace_offers(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn')),
  owner_message text,
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(offer_id,business_id)
);
create index if not exists lead_marketplace_requests_admin_idx on public.lead_marketplace_requests(tenant_id,status,requested_at desc);
create index if not exists lead_marketplace_requests_business_idx on public.lead_marketplace_requests(business_id,status,requested_at desc);

-- RLS
alter table public.lead_project_details enable row level security;
alter table public.business_recommendations enable row level security;
alter table public.business_deals enable row level security;
alter table public.business_availability enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.business_catalog_items enable row level security;
alter table public.business_portfolio_projects enable row level security;
alter table public.local_pro_questions enable row level security;
alter table public.consumer_local_alert_preferences enable row level security;
alter table public.business_referral_codes enable row level security;
alter table public.business_referrals enable row level security;
alter table public.lead_marketplace_requests enable row level security;

-- Lead project details: consumer, delivered business owner, or staff only.
drop policy if exists "lead project details access" on public.lead_project_details;
create policy "lead project details access" on public.lead_project_details for select to authenticated using (
  exists(select 1 from public.leads l where l.id=lead_id and l.consumer_user_id=auth.uid())
  or exists(select 1 from public.lead_recipients lr join public.business_owners bo on bo.business_id=lr.business_id where lr.lead_id=lead_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);

-- Recommendations: approved rows public; submitter and staff can see pending/rejected.
drop policy if exists "recommendations public approved" on public.business_recommendations;
create policy "recommendations public approved" on public.business_recommendations for select to anon,authenticated using (
  status='approved' or user_id=auth.uid() or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists "recommendations staff manage" on public.business_recommendations;
create policy "recommendations staff manage" on public.business_recommendations for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

-- Deals: public only approved/current; owners see own; staff sees all.
drop policy if exists "deals visible" on public.business_deals;
create policy "deals visible" on public.business_deals for select to anon,authenticated using (
  (status='approved' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()))
  or exists(select 1 from public.business_owners bo where bo.business_id=business_deals.business_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists "deals staff manage" on public.business_deals;
create policy "deals staff manage" on public.business_deals for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

-- Availability: owner-reported status is public while current; owner/staff can always see.
drop policy if exists "availability visible" on public.business_availability;
create policy "availability visible" on public.business_availability for select to anon,authenticated using (
  (expires_at is null or expires_at>=now())
  or exists(select 1 from public.business_owners bo where bo.business_id=business_availability.business_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists "availability staff manage" on public.business_availability;
create policy "availability staff manage" on public.business_availability for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

-- Appointment requests remain private until staff deliberately delivers the linked lead.
drop policy if exists "appointments private access" on public.appointment_requests;
create policy "appointments private access" on public.appointment_requests for select to authenticated using (
  consumer_user_id=auth.uid()
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
  or exists(select 1 from public.lead_recipients lr join public.business_owners bo on bo.business_id=lr.business_id where lr.lead_id=appointment_requests.lead_id and lr.business_id=appointment_requests.business_id and bo.user_id=auth.uid())
);
drop policy if exists "appointments staff manage" on public.appointment_requests;
create policy "appointments staff manage" on public.appointment_requests for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

-- Catalog / portfolio public only when approved; owners see drafts; staff manages.
drop policy if exists "catalog visible" on public.business_catalog_items;
create policy "catalog visible" on public.business_catalog_items for select to anon,authenticated using (
  status='approved' or exists(select 1 from public.business_owners bo where bo.business_id=business_catalog_items.business_id and bo.user_id=auth.uid()) or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists "catalog staff manage" on public.business_catalog_items;
create policy "catalog staff manage" on public.business_catalog_items for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

drop policy if exists "portfolio visible" on public.business_portfolio_projects;
create policy "portfolio visible" on public.business_portfolio_projects for select to anon,authenticated using (
  status='approved' or exists(select 1 from public.business_owners bo where bo.business_id=business_portfolio_projects.business_id and bo.user_id=auth.uid()) or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists "portfolio staff manage" on public.business_portfolio_projects;
create policy "portfolio staff manage" on public.business_portfolio_projects for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

-- Questions public only after answer moderation.
drop policy if exists "questions visible" on public.local_pro_questions;
create policy "questions visible" on public.local_pro_questions for select to anon,authenticated using (
  status='published' or user_id=auth.uid()
  or exists(select 1 from public.business_owners bo where bo.business_id=local_pro_questions.business_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists "questions staff manage" on public.local_pro_questions;
create policy "questions staff manage" on public.local_pro_questions for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

-- Consumer alert preferences are private to the user/staff.
drop policy if exists "alerts owner access" on public.consumer_local_alert_preferences;
create policy "alerts owner access" on public.consumer_local_alert_preferences for select to authenticated using (user_id=auth.uid() or private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
drop policy if exists "alerts staff manage" on public.consumer_local_alert_preferences;
create policy "alerts staff manage" on public.consumer_local_alert_preferences for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

-- Referral data private to involved owners and staff.
drop policy if exists "referral codes owner access" on public.business_referral_codes;
create policy "referral codes owner access" on public.business_referral_codes for select to authenticated using (
  exists(select 1 from public.business_owners bo where bo.business_id=business_referral_codes.business_id and bo.user_id=auth.uid()) or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists "referral codes staff manage" on public.business_referral_codes;
create policy "referral codes staff manage" on public.business_referral_codes for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

drop policy if exists "referrals owner access" on public.business_referrals;
create policy "referrals owner access" on public.business_referrals for select to authenticated using (
  exists(select 1 from public.business_owners bo where bo.user_id=auth.uid() and bo.business_id in (business_referrals.referrer_business_id,business_referrals.referred_business_id))
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists "referrals staff manage" on public.business_referrals;
create policy "referrals staff manage" on public.business_referrals for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

-- Marketplace requests private to the requesting business and staff.
drop policy if exists "marketplace requests owner access" on public.lead_marketplace_requests;
create policy "marketplace requests owner access" on public.lead_marketplace_requests for select to authenticated using (
  exists(select 1 from public.business_owners bo where bo.business_id=lead_marketplace_requests.business_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
drop policy if exists "marketplace requests staff manage" on public.lead_marketplace_requests;
create policy "marketplace requests staff manage" on public.lead_marketplace_requests for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

-- Explicit table grants. Writes are intentionally routed through controlled RPCs.
grant select on public.business_recommendations,public.business_deals,public.business_availability,public.business_catalog_items,public.business_portfolio_projects,public.local_pro_questions to anon,authenticated;
grant select on public.lead_project_details,public.appointment_requests,public.consumer_local_alert_preferences,public.business_referral_codes,public.business_referrals,public.lead_marketplace_requests to authenticated;
revoke insert,update,delete on public.lead_project_details,public.business_recommendations,public.business_deals,public.business_availability,public.appointment_requests,public.business_catalog_items,public.business_portfolio_projects,public.local_pro_questions,public.consumer_local_alert_preferences,public.business_referral_codes,public.business_referrals,public.lead_marketplace_requests from anon,authenticated;

-- Private helper: resolve a business the current user owns.
create or replace function private.owner_business_tenant(p_business_id uuid)
returns uuid language sql stable security definer set search_path='' as $$
  select b.tenant_id
  from public.businesses b
  join public.business_owners bo on bo.business_id=b.id
  where b.id=p_business_id and bo.user_id=auth.uid()
  limit 1;
$$;
revoke all on function private.owner_business_tenant(uuid) from public,anon,authenticated;
grant execute on function private.owner_business_tenant(uuid) to service_role;

create or replace function private.require_plan(p_business_id uuid,p_allowed text[])
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(private.business_active_plan_slug(p_business_id)=any(p_allowed),false);
$$;
revoke all on function private.require_plan(uuid,text[]) from public,anon,authenticated;
grant execute on function private.require_plan(uuid,text[]) to service_role;

-- Project Match: high-intent structured request, always stops in Admin first.
create or replace function public.submit_project_match(
  p_tenant_id uuid,p_business_id uuid,p_service text,p_city text,p_zip_code text,
  p_consumer_name text,p_phone text,p_email text,p_message text,p_timeline text,
  p_project_type text,p_property_type text,p_budget_range text,p_preferred_contact text,
  p_answers jsonb default '{}'::jsonb,p_consent_to_contact boolean default false
) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_user uuid:=auth.uid();
begin
  if lower(trim(coalesce(p_service,''))) in ('childcare','child care','childcare providers','daycare','day care','babysitting','babysitter','nanny') then raise exception 'Central Illinois Local Pros does not collect childcare requests.'; end if;
  if not p_consent_to_contact then raise exception 'contact consent is required'; end if;
  if char_length(trim(coalesce(p_service,'')))<2 or char_length(trim(coalesce(p_city,'')))<2 then raise exception 'service and city are required'; end if;
  if char_length(trim(coalesce(p_consumer_name,'')))<2 or char_length(trim(coalesce(p_phone,'')))<7 or position('@' in coalesce(p_email,''))<2 then raise exception 'valid contact information is required'; end if;
  if p_zip_code is not null and trim(p_zip_code)<>'' and trim(p_zip_code) !~ '^[0-9]{5}(-[0-9]{4})?$' then raise exception 'valid ZIP code required'; end if;
  if p_business_id is not null and not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='published') then raise exception 'selected business is not available'; end if;
  insert into public.leads(tenant_id,business_id,assigned_business_id,service,city,consumer_name,phone,email,message,timeline,status,consumer_user_id,consent_to_contact,source,consent_disclosure_version,consent_recorded_at)
  values(p_tenant_id,p_business_id,null,trim(p_service),trim(p_city),trim(p_consumer_name),trim(p_phone),trim(p_email),nullif(trim(coalesce(p_message,'')),''),nullif(trim(coalesce(p_timeline,'')),''),'new',v_user,true,'project_match','lead-sharing-v1-2026-09',now()) returning id into v_id;
  insert into public.lead_project_details(lead_id,tenant_id,project_type,property_type,budget_range,zip_code,preferred_contact,urgency,answers)
  values(v_id,p_tenant_id,nullif(trim(coalesce(p_project_type,'')),''),nullif(trim(coalesce(p_property_type,'')),''),nullif(trim(coalesce(p_budget_range,'')),''),nullif(trim(coalesce(p_zip_code,'')),''),nullif(trim(coalesce(p_preferred_contact,'')),''),nullif(trim(coalesce(p_timeline,'')),''),coalesce(p_answers,'{}'::jsonb));
  return v_id;
end $$;
revoke all on function public.submit_project_match(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,boolean) from public;
grant execute on function public.submit_project_match(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,boolean) to anon,authenticated;

-- Pro appointment request: still creates a private lead and remains pending Admin delivery.
create or replace function public.submit_directory_appointment_request(
  p_tenant_id uuid,p_business_id uuid,p_service text,p_city text,p_consumer_name text,p_phone text,p_email text,
  p_requested_at timestamptz,p_alternate_at timestamptz,p_message text,p_consent_to_contact boolean default false
) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_appointment uuid;
begin
  if not p_consent_to_contact then raise exception 'contact consent is required'; end if;
  if p_requested_at is null or p_requested_at < now() - interval '10 minutes' then raise exception 'a future appointment time is required'; end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='published') then raise exception 'selected business is not available'; end if;
  if not private.require_plan(p_business_id,array['pro']) then raise exception 'appointment requests are available on Pro profiles'; end if;
  if char_length(trim(coalesce(p_consumer_name,'')))<2 or char_length(trim(coalesce(p_phone,'')))<7 or position('@' in coalesce(p_email,''))<2 then raise exception 'valid contact information is required'; end if;
  insert into public.leads(tenant_id,business_id,assigned_business_id,service,city,consumer_name,phone,email,message,timeline,status,consumer_user_id,consent_to_contact,source,consent_disclosure_version,consent_recorded_at)
  values(p_tenant_id,p_business_id,null,trim(p_service),trim(p_city),trim(p_consumer_name),trim(p_phone),trim(p_email),nullif(trim(coalesce(p_message,'')),''),'Appointment requested','new',auth.uid(),true,'appointment_request','lead-sharing-v1-2026-09',now()) returning id into v_id;
  insert into public.appointment_requests(tenant_id,lead_id,business_id,consumer_user_id,requested_at,alternate_at,request_type,consumer_name,phone,email,message,status)
  values(p_tenant_id,v_id,p_business_id,auth.uid(),p_requested_at,p_alternate_at,trim(p_service),trim(p_consumer_name),trim(p_phone),trim(p_email),nullif(trim(coalesce(p_message,'')),''),'pending_admin') returning id into v_appointment;
  return v_id;
end $$;
revoke all on function public.submit_directory_appointment_request(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,text,boolean) from public;
grant execute on function public.submit_directory_appointment_request(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,text,boolean) to anon,authenticated;

-- Community recommendation. It never changes verification or paid placement.
create or replace function public.submit_business_recommendation(p_business_id uuid,p_service text,p_city text,p_body text,p_service_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select tenant_id into v_tenant from public.businesses where id=p_business_id and status='published';
  if v_tenant is null then raise exception 'business_not_found'; end if;
  if char_length(trim(coalesce(p_body,'')))<10 then raise exception 'recommendation must include at least 10 characters'; end if;
  insert into public.business_recommendations(tenant_id,business_id,user_id,service,city,body,service_date,status,reviewed_by,reviewed_at,review_notes,updated_at)
  values(v_tenant,p_business_id,auth.uid(),nullif(trim(coalesce(p_service,'')),''),nullif(trim(coalesce(p_city,'')),''),left(trim(p_body),1200),p_service_date,'pending',null,null,null,now())
  on conflict(user_id,business_id) do update set service=excluded.service,city=excluded.city,body=excluded.body,service_date=excluded.service_date,status='pending',reviewed_by=null,reviewed_at=null,review_notes=null,updated_at=now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.submit_business_recommendation(uuid,text,text,text,date) from public;
grant execute on function public.submit_business_recommendation(uuid,text,text,text,date) to authenticated;

-- Local alert preferences. Preference creation does not imply an email was sent.
create or replace function public.upsert_consumer_local_alert(p_location_id uuid,p_category_id uuid,p_alert_type text,p_email boolean,p_in_app boolean,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_alert_type not in ('deals','new_businesses','local_updates') then raise exception 'invalid_alert_type'; end if;
  select coalesce((select tenant_id from public.locations where id=p_location_id),(select tenant_id from public.categories where id=p_category_id)) into v_tenant;
  if v_tenant is null then raise exception 'a valid market or category is required'; end if;
  if p_location_id is not null and not exists(select 1 from public.locations where id=p_location_id and tenant_id=v_tenant and is_active) then raise exception 'invalid_location'; end if;
  if p_category_id is not null and not exists(select 1 from public.categories where id=p_category_id and tenant_id=v_tenant and is_active) then raise exception 'invalid_category'; end if;
  insert into public.consumer_local_alert_preferences(tenant_id,user_id,location_id,category_id,alert_type,email_enabled,in_app_enabled,active,updated_at)
  values(v_tenant,auth.uid(),p_location_id,p_category_id,p_alert_type,coalesce(p_email,true),coalesce(p_in_app,true),coalesce(p_active,true),now())
  on conflict(user_id,location_id,category_id,alert_type) do update set email_enabled=excluded.email_enabled,in_app_enabled=excluded.in_app_enabled,active=excluded.active,updated_at=now()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.upsert_consumer_local_alert(uuid,uuid,text,boolean,boolean,boolean) from public;
grant execute on function public.upsert_consumer_local_alert(uuid,uuid,text,boolean,boolean,boolean) to authenticated;

-- Owner lead outcome / ROI metadata. This never creates or changes billing.
create or replace function public.update_owner_lead_outcome(
  p_recipient_id uuid,p_status text,p_owner_notes text,p_appointment_at timestamptz,p_quote_amount_cents integer,p_outcome_value_cents integer,p_loss_reason text
) returns void language plpgsql security definer set search_path='' as $$
declare v_business uuid;v_tenant uuid;v_lead uuid;v_old text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_status not in ('viewed','contacted','appointment_set','quoted','won','lost','declined','spam') then raise exception 'invalid_lead_status'; end if;
  if coalesce(p_quote_amount_cents,0)<0 or coalesce(p_outcome_value_cents,0)<0 then raise exception 'amounts_must_be_nonnegative'; end if;
  select business_id,tenant_id,lead_id,status into v_business,v_tenant,v_lead,v_old from public.lead_recipients where id=p_recipient_id for update;
  if v_business is null then raise exception 'lead_recipient_not_found'; end if;
  if not exists(select 1 from public.business_owners bo where bo.business_id=v_business and bo.user_id=auth.uid()) then raise exception 'insufficient_privilege'; end if;
  update public.lead_recipients set status=p_status,owner_notes=nullif(left(trim(coalesce(p_owner_notes,'')),2000),''),appointment_at=p_appointment_at,quote_amount_cents=p_quote_amount_cents,outcome_value_cents=case when p_status='won' then p_outcome_value_cents else outcome_value_cents end,loss_reason=case when p_status='lost' then nullif(left(trim(coalesce(p_loss_reason,'')),300),'') else null end,outcome_updated_at=now(),won_at=case when p_status='won' then coalesce(won_at,now()) else won_at end,lost_at=case when p_status='lost' then coalesce(lost_at,now()) else lost_at end,viewed_at=coalesce(viewed_at,now()),contacted_at=case when p_status in ('contacted','appointment_set','quoted','won','lost') then coalesce(contacted_at,now()) else contacted_at end,updated_at=now() where id=p_recipient_id;
  insert into public.lead_status_events(lead_id,actor_user_id,from_status,to_status,note,business_id,event_type,public_message,internal_message)
  values(v_lead,auth.uid(),v_old,p_status,'Business owner updated lead outcome and ROI metadata.',v_business,'owner_lead_outcome',null,concat('Quote cents: ',coalesce(p_quote_amount_cents,0),'; outcome cents: ',coalesce(p_outcome_value_cents,0),'; loss reason: ',coalesce(p_loss_reason,'')));
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'owner_lead_outcome_updated','Business owner updated outcome metadata for recipient '||p_recipient_id||'. Billing was not changed.');
end $$;
revoke all on function public.update_owner_lead_outcome(uuid,text,text,timestamptz,integer,integer,text) from public;
grant execute on function public.update_owner_lead_outcome(uuid,text,text,timestamptz,integer,integer,text) to authenticated;

-- Owner commerce tools.
create or replace function public.owner_upsert_business_deal(p_id uuid,p_business_id uuid,p_title text,p_details text,p_promo_code text,p_cta_label text,p_cta_url text,p_starts_at timestamptz,p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  v_tenant:=private.owner_business_tenant(p_business_id); if v_tenant is null then raise exception 'insufficient_privilege'; end if;
  if not private.require_plan(p_business_id,array['featured','pro']) then raise exception 'deals_require_featured_or_pro'; end if;
  if char_length(trim(coalesce(p_title,'')))<3 then raise exception 'deal_title_required'; end if;
  if p_ends_at is not null and p_starts_at is not null and p_ends_at<=p_starts_at then raise exception 'deal_end_must_follow_start'; end if;
  if p_id is null then
    insert into public.business_deals(tenant_id,business_id,title,details,promo_code,cta_label,cta_url,starts_at,ends_at,status,created_by) values(v_tenant,p_business_id,left(trim(p_title),160),nullif(left(trim(coalesce(p_details,'')),2000),''),nullif(left(trim(coalesce(p_promo_code,'')),80),''),nullif(left(trim(coalesce(p_cta_label,'')),80),''),nullif(left(trim(coalesce(p_cta_url,'')),600),''),p_starts_at,p_ends_at,'pending',auth.uid()) returning id into v_id;
  else
    update public.business_deals set title=left(trim(p_title),160),details=nullif(left(trim(coalesce(p_details,'')),2000),''),promo_code=nullif(left(trim(coalesce(p_promo_code,'')),80),''),cta_label=nullif(left(trim(coalesce(p_cta_label,'')),80),''),cta_url=nullif(left(trim(coalesce(p_cta_url,'')),600),''),starts_at=p_starts_at,ends_at=p_ends_at,status='pending',reviewed_by=null,reviewed_at=null,review_notes=null,updated_at=now() where id=p_id and business_id=p_business_id returning id into v_id;
    if v_id is null then raise exception 'deal_not_found'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.owner_upsert_business_deal(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) from public;
grant execute on function public.owner_upsert_business_deal(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) to authenticated;

create or replace function public.owner_set_business_availability(p_business_id uuid,p_status text,p_message text,p_expires_at timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  v_tenant:=private.owner_business_tenant(p_business_id); if v_tenant is null then raise exception 'insufficient_privilege'; end if;
  if not private.require_plan(p_business_id,array['pro']) then raise exception 'availability_requires_pro'; end if;
  if p_status not in ('available_today','taking_new_customers','emergency_24_7','limited','unavailable') then raise exception 'invalid_availability_status'; end if;
  insert into public.business_availability(business_id,tenant_id,availability_status,message,expires_at,updated_by,updated_at)
  values(p_business_id,v_tenant,p_status,nullif(left(trim(coalesce(p_message,'')),300),''),p_expires_at,auth.uid(),now())
  on conflict(business_id) do update set availability_status=excluded.availability_status,message=excluded.message,expires_at=excluded.expires_at,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.owner_set_business_availability(uuid,text,text,timestamptz) from public;
grant execute on function public.owner_set_business_availability(uuid,text,text,timestamptz) to authenticated;

create or replace function public.owner_upsert_catalog_item(p_id uuid,p_business_id uuid,p_item_type text,p_category_label text,p_name text,p_description text,p_price_label text,p_item_url text,p_sort_order integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  v_tenant:=private.owner_business_tenant(p_business_id); if v_tenant is null then raise exception 'insufficient_privilege'; end if;
  if not private.require_plan(p_business_id,array['pro']) then raise exception 'catalog_requires_pro'; end if;
  if p_item_type not in ('service','menu_item','product') then raise exception 'invalid_item_type'; end if;
  if char_length(trim(coalesce(p_name,'')))<2 then raise exception 'item_name_required'; end if;
  if p_id is null then
    insert into public.business_catalog_items(tenant_id,business_id,item_type,category_label,name,description,price_label,item_url,sort_order,status,created_by) values(v_tenant,p_business_id,p_item_type,nullif(left(trim(coalesce(p_category_label,'')),120),''),left(trim(p_name),160),nullif(left(trim(coalesce(p_description,'')),1200),''),nullif(left(trim(coalesce(p_price_label,'')),100),''),nullif(left(trim(coalesce(p_item_url,'')),600),''),greatest(0,coalesce(p_sort_order,0)),'pending',auth.uid()) returning id into v_id;
  else
    update public.business_catalog_items set item_type=p_item_type,category_label=nullif(left(trim(coalesce(p_category_label,'')),120),''),name=left(trim(p_name),160),description=nullif(left(trim(coalesce(p_description,'')),1200),''),price_label=nullif(left(trim(coalesce(p_price_label,'')),100),''),item_url=nullif(left(trim(coalesce(p_item_url,'')),600),''),sort_order=greatest(0,coalesce(p_sort_order,0)),status='pending',reviewed_by=null,reviewed_at=null,review_notes=null,updated_at=now() where id=p_id and business_id=p_business_id returning id into v_id;
    if v_id is null then raise exception 'catalog_item_not_found'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.owner_upsert_catalog_item(uuid,uuid,text,text,text,text,text,text,integer) from public;
grant execute on function public.owner_upsert_catalog_item(uuid,uuid,text,text,text,text,text,text,integer) to authenticated;

create or replace function public.owner_upsert_portfolio_project(p_id uuid,p_business_id uuid,p_title text,p_summary text,p_project_type text,p_city text,p_completed_on date,p_before_media_id uuid,p_after_media_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  v_tenant:=private.owner_business_tenant(p_business_id); if v_tenant is null then raise exception 'insufficient_privilege'; end if;
  if not private.require_plan(p_business_id,array['pro']) then raise exception 'portfolio_requires_pro'; end if;
  if char_length(trim(coalesce(p_title,'')))<3 then raise exception 'project_title_required'; end if;
  if p_before_media_id is not null and not exists(select 1 from public.business_media where id=p_before_media_id and business_id=p_business_id and approval_status='approved') then raise exception 'invalid_before_media'; end if;
  if p_after_media_id is not null and not exists(select 1 from public.business_media where id=p_after_media_id and business_id=p_business_id and approval_status='approved') then raise exception 'invalid_after_media'; end if;
  if p_id is null then
    insert into public.business_portfolio_projects(tenant_id,business_id,title,summary,project_type,city,completed_on,before_media_id,after_media_id,status,created_by) values(v_tenant,p_business_id,left(trim(p_title),180),nullif(left(trim(coalesce(p_summary,'')),1800),''),nullif(left(trim(coalesce(p_project_type,'')),120),''),nullif(left(trim(coalesce(p_city,'')),100),''),p_completed_on,p_before_media_id,p_after_media_id,'pending',auth.uid()) returning id into v_id;
  else
    update public.business_portfolio_projects set title=left(trim(p_title),180),summary=nullif(left(trim(coalesce(p_summary,'')),1800),''),project_type=nullif(left(trim(coalesce(p_project_type,'')),120),''),city=nullif(left(trim(coalesce(p_city,'')),100),''),completed_on=p_completed_on,before_media_id=p_before_media_id,after_media_id=p_after_media_id,status='pending',reviewed_by=null,reviewed_at=null,review_notes=null,updated_at=now() where id=p_id and business_id=p_business_id returning id into v_id;
    if v_id is null then raise exception 'portfolio_project_not_found'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.owner_upsert_portfolio_project(uuid,uuid,text,text,text,text,date,uuid,uuid) from public;
grant execute on function public.owner_upsert_portfolio_project(uuid,uuid,text,text,text,text,date,uuid,uuid) to authenticated;

-- Ask a Local Pro.
create or replace function public.submit_local_pro_question(p_business_id uuid,p_question text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select tenant_id into v_tenant from public.businesses where id=p_business_id and status='published'; if v_tenant is null then raise exception 'business_not_found'; end if;
  if char_length(trim(coalesce(p_question,'')))<8 then raise exception 'question_too_short'; end if;
  insert into public.local_pro_questions(tenant_id,business_id,user_id,question,status) values(v_tenant,p_business_id,auth.uid(),left(trim(p_question),1200),'pending') returning id into v_id;
  return v_id;
end $$;
revoke all on function public.submit_local_pro_question(uuid,text) from public;
grant execute on function public.submit_local_pro_question(uuid,text) to authenticated;

create or replace function public.owner_answer_local_pro_question(p_question_id uuid,p_answer text)
returns void language plpgsql security definer set search_path='' as $$
declare v_business uuid;v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select business_id,tenant_id into v_business,v_tenant from public.local_pro_questions where id=p_question_id;
  if v_business is null or private.owner_business_tenant(v_business) is null then raise exception 'insufficient_privilege'; end if;
  if char_length(trim(coalesce(p_answer,'')))<8 then raise exception 'answer_too_short'; end if;
  update public.local_pro_questions set answer=left(trim(p_answer),2400),answered_by=auth.uid(),answered_at=now(),status='awaiting_review',reviewed_by=null,reviewed_at=null,review_notes=null,updated_at=now() where id=p_question_id;
end $$;
revoke all on function public.owner_answer_local_pro_question(uuid,text) from public;
grant execute on function public.owner_answer_local_pro_question(uuid,text) to authenticated;

-- Appointment owner response is only possible after staff delivered the linked lead to that business.
create or replace function public.owner_update_appointment_request(p_appointment_id uuid,p_status text,p_owner_response text)
returns void language plpgsql security definer set search_path='' as $$
declare v_business uuid;v_lead uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_status not in ('accepted','declined','reschedule_requested','completed','cancelled') then raise exception 'invalid_appointment_status'; end if;
  select business_id,lead_id into v_business,v_lead from public.appointment_requests where id=p_appointment_id;
  if v_business is null or private.owner_business_tenant(v_business) is null then raise exception 'insufficient_privilege'; end if;
  if not exists(select 1 from public.lead_recipients where lead_id=v_lead and business_id=v_business) then raise exception 'appointment_not_released_by_admin'; end if;
  update public.appointment_requests set status=p_status,owner_response=nullif(left(trim(coalesce(p_owner_response,'')),1200),''),responded_at=now(),updated_at=now() where id=p_appointment_id;
end $$;
revoke all on function public.owner_update_appointment_request(uuid,text,text) from public;
grant execute on function public.owner_update_appointment_request(uuid,text,text) to authenticated;

-- Referrals. Applying a code does not automatically issue a credit.
create or replace function public.ensure_business_referral_code(p_business_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_code text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  v_tenant:=private.owner_business_tenant(p_business_id); if v_tenant is null then raise exception 'insufficient_privilege'; end if;
  select code into v_code from public.business_referral_codes where business_id=p_business_id;
  if v_code is null then
    loop
      v_code:='LOCAL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
      begin insert into public.business_referral_codes(business_id,tenant_id,code,created_by) values(p_business_id,v_tenant,v_code,auth.uid()); exit; exception when unique_violation then null; end;
    end loop;
  end if;
  return v_code;
end $$;
revoke all on function public.ensure_business_referral_code(uuid) from public;
grant execute on function public.ensure_business_referral_code(uuid) to authenticated;

create or replace function public.apply_business_referral_code(p_referred_business_id uuid,p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_referrer uuid;v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  v_tenant:=private.owner_business_tenant(p_referred_business_id); if v_tenant is null then raise exception 'insufficient_privilege'; end if;
  select business_id into v_referrer from public.business_referral_codes where tenant_id=v_tenant and upper(code)=upper(trim(p_code)); if v_referrer is null then raise exception 'invalid_referral_code'; end if;
  if v_referrer=p_referred_business_id then raise exception 'cannot_self_refer'; end if;
  insert into public.business_referrals(tenant_id,referrer_business_id,referred_business_id,status) values(v_tenant,v_referrer,p_referred_business_id,'pending') on conflict(referred_business_id) do update set referrer_business_id=excluded.referrer_business_id,status='pending',reviewed_by=null,review_notes=null returning id into v_id;
  return v_id;
end $$;
revoke all on function public.apply_business_referral_code(uuid,text) from public;
grant execute on function public.apply_business_referral_code(uuid,text) to authenticated;

-- Request-first lead marketplace. Approval enables checkout but still does not release consumer data.
create or replace function public.request_marketplace_offer(p_offer_id uuid,p_owner_message text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_offer public.lead_marketplace_offers%rowtype;v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_offer from public.lead_marketplace_offers where id=p_offer_id for update;
  if v_offer.id is null then raise exception 'offer_not_found'; end if;
  if v_offer.access_mode<>'admin_request' then raise exception 'offer_does_not_require_request'; end if;
  if v_offer.status not in ('offered','reserved') then raise exception 'offer_not_available'; end if;
  if v_offer.expires_at is not null and v_offer.expires_at<now() then raise exception 'offer_expired'; end if;
  if private.owner_business_tenant(v_offer.business_id) is null then raise exception 'insufficient_privilege'; end if;
  insert into public.lead_marketplace_requests(tenant_id,offer_id,lead_id,business_id,requested_by,status,owner_message,requested_at,updated_at)
  values(v_offer.tenant_id,v_offer.id,v_offer.lead_id,v_offer.business_id,auth.uid(),'pending',nullif(left(trim(coalesce(p_owner_message,'')),600),''),now(),now())
  on conflict(offer_id,business_id) do update set requested_by=auth.uid(),status='pending',owner_message=excluded.owner_message,admin_notes=null,reviewed_by=null,reviewed_at=null,requested_at=now(),updated_at=now()
  returning id into v_id;
  update public.lead_marketplace_offers set checkout_enabled=false,updated_at=now() where id=v_offer.id;
  return v_id;
end $$;
revoke all on function public.request_marketplace_offer(uuid,text) from public;
grant execute on function public.request_marketplace_offer(uuid,text) to authenticated;

create or replace function public.admin_review_marketplace_request(p_request_id uuid,p_decision text,p_admin_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_req public.lead_marketplace_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_req from public.lead_marketplace_requests where id=p_request_id for update; if v_req.id is null then raise exception 'request_not_found'; end if;
  if not private.has_tenant_role(v_req.tenant_id,array['admin','super_admin']) then raise exception 'insufficient_privilege'; end if;
  if p_decision not in ('approved','declined') then raise exception 'invalid_decision'; end if;
  update public.lead_marketplace_requests set status=p_decision,admin_notes=nullif(left(trim(coalesce(p_admin_notes,'')),1200),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_request_id;
  if p_decision='approved' then update public.lead_marketplace_offers set checkout_enabled=true,status=case when status='offered' then 'reserved' else status end,updated_at=now() where id=v_req.offer_id;
  else update public.lead_marketplace_offers set checkout_enabled=false,status=case when status='reserved' then 'offered' else status end,updated_at=now() where id=v_req.offer_id; end if;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_req.tenant_id,auth.uid(),'marketplace_request_reviewed','Marketplace request '||p_request_id||' marked '||p_decision||'. Consumer details were not released by this review.');
end $$;
revoke all on function public.admin_review_marketplace_request(uuid,text,text) from public;
grant execute on function public.admin_review_marketplace_request(uuid,text,text) to authenticated;

-- Generic staff moderation for community/business-provided commerce content.
create or replace function public.admin_review_local_commerce(p_entity_type text,p_entity_id uuid,p_decision text,p_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  if p_entity_type='recommendation' then select tenant_id into v_tenant from public.business_recommendations where id=p_entity_id;
  elsif p_entity_type='deal' then select tenant_id into v_tenant from public.business_deals where id=p_entity_id;
  elsif p_entity_type='catalog' then select tenant_id into v_tenant from public.business_catalog_items where id=p_entity_id;
  elsif p_entity_type='portfolio' then select tenant_id into v_tenant from public.business_portfolio_projects where id=p_entity_id;
  elsif p_entity_type='question' then select tenant_id into v_tenant from public.local_pro_questions where id=p_entity_id;
  else raise exception 'invalid_entity_type'; end if;
  if v_tenant is null then raise exception 'entity_not_found'; end if;
  if not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'insufficient_privilege'; end if;
  if p_entity_type='recommendation' then update public.business_recommendations set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=nullif(left(trim(coalesce(p_notes,'')),1200),''),updated_at=now() where id=p_entity_id;
  elsif p_entity_type='deal' then update public.business_deals set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=nullif(left(trim(coalesce(p_notes,'')),1200),''),updated_at=now() where id=p_entity_id;
  elsif p_entity_type='catalog' then update public.business_catalog_items set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=nullif(left(trim(coalesce(p_notes,'')),1200),''),updated_at=now() where id=p_entity_id;
  elsif p_entity_type='portfolio' then update public.business_portfolio_projects set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=nullif(left(trim(coalesce(p_notes,'')),1200),''),updated_at=now() where id=p_entity_id;
  elsif p_entity_type='question' then
    if p_decision='approved' and not exists(select 1 from public.local_pro_questions where id=p_entity_id and nullif(trim(coalesce(answer,'')),'') is not null) then raise exception 'question_requires_answer_before_publication'; end if;
    update public.local_pro_questions set status=case when p_decision='approved' then 'published' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=nullif(left(trim(coalesce(p_notes,'')),1200),''),updated_at=now() where id=p_entity_id;
  end if;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'local_commerce_reviewed',p_entity_type||' '||p_entity_id||' marked '||p_decision||'. This moderation does not alter verification or organic rank.');
end $$;
revoke all on function public.admin_review_local_commerce(text,uuid,text,text) from public;
grant execute on function public.admin_review_local_commerce(text,uuid,text,text) to authenticated;

-- Referral review / credit decision remains Admin-controlled.
create or replace function public.admin_review_business_referral(p_referral_id uuid,p_status text,p_credit_value_cents integer,p_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.business_referrals where id=p_referral_id; if v_tenant is null then raise exception 'referral_not_found'; end if;
  if auth.uid() is null or not private.has_tenant_role(v_tenant,array['admin','super_admin']) then raise exception 'insufficient_privilege'; end if;
  if p_status not in ('qualified','credited','rejected') then raise exception 'invalid_referral_status'; end if;
  if coalesce(p_credit_value_cents,0)<0 then raise exception 'invalid_credit_value'; end if;
  update public.business_referrals set status=p_status,credit_value_cents=coalesce(p_credit_value_cents,0),qualified_at=case when p_status in ('qualified','credited') then coalesce(qualified_at,now()) else qualified_at end,credited_at=case when p_status='credited' then coalesce(credited_at,now()) else credited_at end,reviewed_by=auth.uid(),review_notes=nullif(left(trim(coalesce(p_notes,'')),1200),'') where id=p_referral_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'business_referral_reviewed','Referral '||p_referral_id||' marked '||p_status||'. Any financial credit remains separately auditable.');
end $$;
revoke all on function public.admin_review_business_referral(uuid,text,integer,text) from public;
grant execute on function public.admin_review_business_referral(uuid,text,integer,text) to authenticated;

-- Deliberate lead delivery releases linked appointment request to that specific business.
create or replace function private.release_appointment_after_delivery()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.appointment_requests set status='released_to_business',updated_at=now() where lead_id=new.lead_id and business_id=new.business_id and status='pending_admin';
  return new;
end $$;
revoke all on function private.release_appointment_after_delivery() from public,anon,authenticated;
drop trigger if exists release_appointment_after_lead_delivery on public.lead_recipients;
create trigger release_appointment_after_lead_delivery after insert on public.lead_recipients for each row execute function private.release_appointment_after_delivery();

-- Public community favorite aggregate. This is a community signal, not verification.
create or replace view public.business_local_fave_stats with (security_invoker=true) as
select business_id,count(*)::integer as recommendation_count,max(created_at) as latest_recommendation_at
from public.business_recommendations where status='approved' group by business_id;
grant select on public.business_local_fave_stats to anon,authenticated;

-- Marketplace offer RPC gains request-first state while preserving existing prepaid offers.
drop function if exists public.get_business_marketplace_offers(uuid);
create function public.get_business_marketplace_offers(p_business_id uuid)
returns table(offer_id uuid,lead_id uuid,status text,price_cents integer,service text,city text,timeline text,created_at timestamptz,expires_at timestamptz,sale_mode text,source_scope text,access_mode text,checkout_enabled boolean,request_status text)
language sql security definer set search_path='' as $$
  select o.id,o.lead_id,o.status,o.price_cents,l.service,l.city,l.timeline,o.created_at,o.expires_at,i.sale_mode,i.source_scope,o.access_mode,o.checkout_enabled,r.status
  from public.lead_marketplace_offers o
  join public.leads l on l.id=o.lead_id
  join public.lead_marketplace_inventory i on i.lead_id=o.lead_id
  left join public.lead_marketplace_requests r on r.offer_id=o.id and r.business_id=o.business_id
  where o.business_id=p_business_id
    and exists(select 1 from public.business_owners bo where bo.business_id=p_business_id and bo.user_id=auth.uid())
    and o.status in ('offered','checkout_pending','reserved','purchased','delivered')
  order by o.created_at desc;
$$;
revoke all on function public.get_business_marketplace_offers(uuid) from public;
grant execute on function public.get_business_marketplace_offers(uuid) to authenticated;

-- Indexes supporting outcome/revenue analytics.
create index if not exists lead_recipients_business_outcome_idx on public.lead_recipients(business_id,status,outcome_updated_at desc);
create index if not exists lead_recipients_won_value_idx on public.lead_recipients(business_id,won_at) where status='won';

comment on table public.business_recommendations is 'Community recommendation signal. Approval cannot create verification, Sponsored status, or organic-rank preference.';
comment on table public.business_deals is 'Business-supplied local offers. Public approval is content moderation, not an organic-ranking signal.';
comment on table public.business_availability is 'Owner-reported temporary availability. It is not a physical-location or verification signal.';
comment on table public.lead_marketplace_requests is 'Request-first marketplace interest. Approval enables checkout only; it does not release consumer contact data or create a billable agreement.';
comment on column public.lead_recipients.outcome_value_cents is 'Owner-entered estimated closed-job value for ROI analytics only; never used to calculate lead billing.';
