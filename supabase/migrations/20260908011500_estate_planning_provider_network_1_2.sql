-- Estate Planning Funnel 1.2: private provider network, configured state coverage and controlled manual handoffs.
-- Coverage approval is an internal operational setting; it is not a representation of professional licensure.

create table if not exists public.estate_planning_providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  display_name text not null,
  provider_type text not null default 'law_firm' check (provider_type in ('law_firm','attorney','estate_planning_service','other')),
  onboarding_status text not null default 'prospect' check (onboarding_status in ('prospect','reviewing','approved','declined')),
  operating_status text not null default 'paused' check (operating_status in ('active','paused','inactive')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','documents_pending','reviewed')),
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  website text,
  external_reference text,
  capacity_limit integer check (capacity_limit is null or capacity_limit >= 0),
  capacity_notes text,
  internal_notes text,
  approved_at timestamptz,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_estate_planning_providers_tenant_name on public.estate_planning_providers(tenant_id, lower(display_name));
create index if not exists idx_estate_planning_providers_tenant_status on public.estate_planning_providers(tenant_id, onboarding_status, operating_status, updated_at desc);
alter table public.estate_planning_providers enable row level security;
revoke all on table public.estate_planning_providers from anon, authenticated;
grant select,insert,update on table public.estate_planning_providers to authenticated;
grant all on table public.estate_planning_providers to service_role;
drop policy if exists "staff manage estate planning providers" on public.estate_planning_providers;
create policy "staff manage estate planning providers" on public.estate_planning_providers for all to authenticated
using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));

create table if not exists public.estate_planning_provider_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_id uuid not null references public.estate_planning_providers(id) on delete cascade,
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  coverage_status text not null default 'not_configured' check (coverage_status in ('not_configured','eligible_for_review','approved','paused')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','reviewed')),
  verification_reference text,
  referral_capacity integer check (referral_capacity is null or referral_capacity >= 0),
  notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id,state_code)
);
create index if not exists idx_estate_planning_provider_states_lookup on public.estate_planning_provider_states(tenant_id,state_code,coverage_status,provider_id);
alter table public.estate_planning_provider_states enable row level security;
revoke all on table public.estate_planning_provider_states from anon, authenticated;
grant select,insert,update on table public.estate_planning_provider_states to authenticated;
grant all on table public.estate_planning_provider_states to service_role;
drop policy if exists "staff manage estate planning provider states" on public.estate_planning_provider_states;
create policy "staff manage estate planning provider states" on public.estate_planning_provider_states for all to authenticated
using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));

alter table public.estate_planning_lead_referrals add column if not exists provider_id uuid references public.estate_planning_providers(id) on delete set null;
create index if not exists idx_estate_planning_referrals_provider on public.estate_planning_lead_referrals(tenant_id,provider_id,referral_status,updated_at desc);

create table if not exists public.estate_planning_referral_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  referral_id uuid not null references public.estate_planning_lead_referrals(id) on delete cascade,
  provider_id uuid references public.estate_planning_providers(id) on delete set null,
  event_type text not null check (event_type in ('provider_assigned','assignment_cleared','handoff_prepared','handoff_recorded','provider_response_recorded')),
  transmission_method text check (transmission_method is null or transmission_method in ('manual_email','manual_phone','secure_portal','other')),
  external_reference text,
  notes text,
  data_snapshot jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_estate_planning_referral_events_lead on public.estate_planning_referral_events(tenant_id,lead_id,occurred_at desc);
create index if not exists idx_estate_planning_referral_events_provider on public.estate_planning_referral_events(tenant_id,provider_id,occurred_at desc);
alter table public.estate_planning_referral_events enable row level security;
revoke all on table public.estate_planning_referral_events from anon, authenticated;
grant select,insert on table public.estate_planning_referral_events to authenticated;
grant all on table public.estate_planning_referral_events to service_role;
drop policy if exists "staff read estate planning referral events" on public.estate_planning_referral_events;
create policy "staff read estate planning referral events" on public.estate_planning_referral_events for select to authenticated
using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));
drop policy if exists "staff append estate planning referral events" on public.estate_planning_referral_events;
create policy "staff append estate planning referral events" on public.estate_planning_referral_events for insert to authenticated
with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));

create or replace function public.assign_estate_planning_provider(p_lead_id uuid,p_provider_id uuid,p_notes text default null) returns uuid
language plpgsql security invoker set search_path to '' as $$
declare
  v_tenant constant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid; v_user uuid := auth.uid();
  v_ref public.estate_planning_lead_referrals%rowtype; v_provider public.estate_planning_providers%rowtype;
  v_state text; v_state_capacity integer; v_open_count integer; v_event_id uuid;
begin
  if v_user is null or not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'staff access required'; end if;
  select r.* into v_ref from public.estate_planning_lead_referrals r where r.tenant_id=v_tenant and r.lead_id=p_lead_id for update;
  if not found then raise exception 'estate-planning referral record not found'; end if;
  if v_ref.qualification_status <> 'qualified' then raise exception 'lead must be qualified before provider assignment'; end if;
  select upper(coalesce(d.answers->>'state','')) into v_state from public.lead_project_details d where d.tenant_id=v_tenant and d.lead_id=p_lead_id limit 1;
  if v_state !~ '^[A-Z]{2}$' then raise exception 'lead state is missing or invalid'; end if;
  select p.* into v_provider from public.estate_planning_providers p where p.tenant_id=v_tenant and p.id=p_provider_id;
  if not found then raise exception 'provider not found'; end if;
  if v_provider.onboarding_status <> 'approved' or v_provider.operating_status <> 'active' then raise exception 'provider must be approved and active'; end if;
  select ps.referral_capacity into v_state_capacity from public.estate_planning_provider_states ps where ps.tenant_id=v_tenant and ps.provider_id=p_provider_id and ps.state_code=v_state and ps.coverage_status='approved';
  if not found then raise exception 'provider does not have approved configured coverage for this lead state'; end if;
  select count(*) into v_open_count from public.estate_planning_lead_referrals r where r.tenant_id=v_tenant and r.provider_id=p_provider_id and r.lead_id<>p_lead_id and r.referral_status in ('pending_review','approved_for_referral','referred','accepted');
  if v_provider.capacity_limit is not null and v_open_count >= v_provider.capacity_limit then raise exception 'provider overall referral capacity is currently full'; end if;
  if v_state_capacity is not null and v_open_count >= v_state_capacity then raise exception 'provider configured state referral capacity is currently full'; end if;
  update public.estate_planning_lead_referrals set provider_id=p_provider_id,provider_name=v_provider.display_name,provider_state=v_state,provider_reference=coalesce(v_provider.external_reference,provider_reference),referral_status='pending_review',assigned_at=now(),referral_notes=coalesce(nullif(trim(p_notes),''),referral_notes),updated_by=v_user,updated_at=now() where id=v_ref.id;
  insert into public.estate_planning_referral_events(tenant_id,lead_id,referral_id,provider_id,event_type,notes,actor_user_id) values(v_tenant,p_lead_id,v_ref.id,p_provider_id,'provider_assigned',nullif(trim(p_notes),''),v_user) returning id into v_event_id;
  return v_event_id;
end; $$;
revoke all on function public.assign_estate_planning_provider(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.assign_estate_planning_provider(uuid,uuid,text) to authenticated;

create or replace function public.clear_estate_planning_provider_assignment(p_lead_id uuid,p_notes text default null) returns uuid
language plpgsql security invoker set search_path to '' as $$
declare v_tenant constant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid; v_user uuid := auth.uid(); v_ref public.estate_planning_lead_referrals%rowtype; v_event_id uuid;
begin
  if v_user is null or not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'staff access required'; end if;
  select r.* into v_ref from public.estate_planning_lead_referrals r where r.tenant_id=v_tenant and r.lead_id=p_lead_id for update;
  if not found then raise exception 'estate-planning referral record not found'; end if;
  if v_ref.referral_status in ('referred','accepted') then raise exception 'a recorded handoff cannot be cleared; close or record the outcome instead'; end if;
  insert into public.estate_planning_referral_events(tenant_id,lead_id,referral_id,provider_id,event_type,notes,actor_user_id) values(v_tenant,p_lead_id,v_ref.id,v_ref.provider_id,'assignment_cleared',nullif(trim(p_notes),''),v_user) returning id into v_event_id;
  update public.estate_planning_lead_referrals set provider_id=null,provider_name=null,provider_state=null,provider_reference=null,referral_status='unassigned',assigned_at=null,updated_by=v_user,updated_at=now() where id=v_ref.id;
  return v_event_id;
end; $$;
revoke all on function public.clear_estate_planning_provider_assignment(uuid,text) from public,anon,authenticated;
grant execute on function public.clear_estate_planning_provider_assignment(uuid,text) to authenticated;

create or replace function public.prepare_estate_planning_referral_handoff(p_lead_id uuid,p_notes text default null) returns uuid
language plpgsql security invoker set search_path to '' as $$
declare
  v_tenant constant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid; v_user uuid := auth.uid();
  v_ref public.estate_planning_lead_referrals%rowtype; v_provider public.estate_planning_providers%rowtype; v_consent public.estate_planning_lead_consents%rowtype; v_lead public.leads%rowtype; v_details public.lead_project_details%rowtype;
  v_state text; v_snapshot jsonb; v_event_id uuid;
begin
  if v_user is null or not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'staff access required'; end if;
  select r.* into v_ref from public.estate_planning_lead_referrals r where r.tenant_id=v_tenant and r.lead_id=p_lead_id for update;
  if not found or v_ref.provider_id is null then raise exception 'an assigned provider is required'; end if;
  if v_ref.qualification_status <> 'qualified' then raise exception 'lead must be qualified'; end if;
  select p.* into v_provider from public.estate_planning_providers p where p.tenant_id=v_tenant and p.id=v_ref.provider_id;
  if not found or v_provider.onboarding_status <> 'approved' or v_provider.operating_status <> 'active' then raise exception 'assigned provider must still be approved and active'; end if;
  select c.* into v_consent from public.estate_planning_lead_consents c where c.tenant_id=v_tenant and c.lead_id=p_lead_id;
  if not found then raise exception 'exact referral consent record is required before handoff preparation'; end if;
  select l.* into v_lead from public.leads l where l.tenant_id=v_tenant and l.id=p_lead_id and l.source='estate_planning_nationwide'; if not found then raise exception 'estate-planning lead not found'; end if;
  select d.* into v_details from public.lead_project_details d where d.tenant_id=v_tenant and d.lead_id=p_lead_id limit 1; v_state := upper(coalesce(v_details.answers->>'state',''));
  if not exists(select 1 from public.estate_planning_provider_states ps where ps.tenant_id=v_tenant and ps.provider_id=v_ref.provider_id and ps.state_code=v_state and ps.coverage_status='approved') then raise exception 'assigned provider no longer has approved configured coverage for this lead state'; end if;
  v_snapshot := jsonb_build_object('lead_id',v_lead.id,'consumer_name',v_lead.consumer_name,'phone',v_lead.phone,'email',v_lead.email,'city',v_lead.city,'state',v_state,'zip_code',v_details.zip_code,'primary_need',v_details.project_type,'timeline',v_lead.timeline,'preferred_contact',v_details.preferred_contact,'message',v_lead.message,'planning_answers',coalesce(v_details.answers,'{}'::jsonb),'provider_id',v_provider.id,'provider_name',v_provider.display_name,'consent_version',v_consent.consent_version,'referral_consent_text',v_consent.referral_consent_text,'consent_recorded_at',v_consent.recorded_at,'prepared_at',now());
  insert into public.estate_planning_referral_events(tenant_id,lead_id,referral_id,provider_id,event_type,notes,data_snapshot,actor_user_id) values(v_tenant,p_lead_id,v_ref.id,v_ref.provider_id,'handoff_prepared',nullif(trim(p_notes),''),v_snapshot,v_user) returning id into v_event_id;
  update public.estate_planning_lead_referrals set referral_status='approved_for_referral',updated_by=v_user,updated_at=now() where id=v_ref.id;
  return v_event_id;
end; $$;
revoke all on function public.prepare_estate_planning_referral_handoff(uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_estate_planning_referral_handoff(uuid,text) to authenticated;

create or replace function public.record_estate_planning_referral_handoff(p_lead_id uuid,p_transmission_method text,p_external_reference text default null,p_notes text default null) returns uuid
language plpgsql security invoker set search_path to '' as $$
declare v_tenant constant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid; v_user uuid := auth.uid(); v_ref public.estate_planning_lead_referrals%rowtype; v_snapshot jsonb; v_event_id uuid;
begin
  if v_user is null or not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'staff access required'; end if;
  if p_transmission_method not in ('manual_email','manual_phone','secure_portal','other') then raise exception 'valid manual handoff method is required'; end if;
  select r.* into v_ref from public.estate_planning_lead_referrals r where r.tenant_id=v_tenant and r.lead_id=p_lead_id for update;
  if not found or v_ref.provider_id is null then raise exception 'assigned provider is required'; end if;
  if v_ref.referral_status <> 'approved_for_referral' then raise exception 'handoff must be prepared and approved before it can be recorded'; end if;
  select e.data_snapshot into v_snapshot from public.estate_planning_referral_events e where e.tenant_id=v_tenant and e.lead_id=p_lead_id and e.provider_id=v_ref.provider_id and e.event_type='handoff_prepared' order by e.occurred_at desc limit 1;
  if v_snapshot is null then raise exception 'prepared handoff snapshot is missing'; end if;
  insert into public.estate_planning_referral_events(tenant_id,lead_id,referral_id,provider_id,event_type,transmission_method,external_reference,notes,data_snapshot,actor_user_id) values(v_tenant,p_lead_id,v_ref.id,v_ref.provider_id,'handoff_recorded',p_transmission_method,nullif(trim(p_external_reference),''),nullif(trim(p_notes),''),v_snapshot,v_user) returning id into v_event_id;
  update public.estate_planning_lead_referrals set referral_status='referred',referred_at=now(),referral_notes=coalesce(nullif(trim(p_notes),''),referral_notes),updated_by=v_user,updated_at=now() where id=v_ref.id;
  return v_event_id;
end; $$;
revoke all on function public.record_estate_planning_referral_handoff(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_estate_planning_referral_handoff(uuid,text,text,text) to authenticated;
