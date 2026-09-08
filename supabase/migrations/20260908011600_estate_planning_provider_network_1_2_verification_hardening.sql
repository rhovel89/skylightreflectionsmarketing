-- Estate Planning provider-network hardening.
-- Assignment requires reviewed state-specific evidence in addition to internally approved configured coverage.

create or replace function public.assign_estate_planning_provider(p_lead_id uuid,p_provider_id uuid,p_notes text default null)
returns uuid language plpgsql security invoker set search_path to '' as $$
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
  select ps.referral_capacity into v_state_capacity from public.estate_planning_provider_states ps where ps.tenant_id=v_tenant and ps.provider_id=p_provider_id and ps.state_code=v_state and ps.coverage_status='approved' and ps.verification_status='reviewed' and nullif(trim(coalesce(ps.verification_reference,'')),'') is not null;
  if not found then raise exception 'provider requires approved configured coverage and reviewed verification evidence for this lead state'; end if;
  select count(*) into v_open_count from public.estate_planning_lead_referrals r where r.tenant_id=v_tenant and r.provider_id=p_provider_id and r.lead_id<>p_lead_id and r.referral_status in ('pending_review','approved_for_referral','referred','accepted');
  if v_provider.capacity_limit is not null and v_open_count >= v_provider.capacity_limit then raise exception 'provider overall referral capacity is currently full'; end if;
  if v_state_capacity is not null and v_open_count >= v_state_capacity then raise exception 'provider configured state referral capacity is currently full'; end if;
  update public.estate_planning_lead_referrals set provider_id=p_provider_id,provider_name=v_provider.display_name,provider_state=v_state,provider_reference=coalesce(v_provider.external_reference,provider_reference),referral_status='pending_review',assigned_at=now(),referral_notes=coalesce(nullif(trim(p_notes),''),referral_notes),updated_by=v_user,updated_at=now() where id=v_ref.id;
  insert into public.estate_planning_referral_events(tenant_id,lead_id,referral_id,provider_id,event_type,notes,actor_user_id) values(v_tenant,p_lead_id,v_ref.id,p_provider_id,'provider_assigned',nullif(trim(p_notes),''),v_user) returning id into v_event_id;
  return v_event_id;
end; $$;

create or replace function public.prepare_estate_planning_referral_handoff(p_lead_id uuid,p_notes text default null)
returns uuid language plpgsql security invoker set search_path to '' as $$
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
  if not exists(select 1 from public.estate_planning_provider_states ps where ps.tenant_id=v_tenant and ps.provider_id=v_ref.provider_id and ps.state_code=v_state and ps.coverage_status='approved' and ps.verification_status='reviewed' and nullif(trim(coalesce(ps.verification_reference,'')),'') is not null) then raise exception 'assigned provider no longer has approved configured coverage with reviewed verification evidence for this lead state'; end if;
  v_snapshot := jsonb_build_object('lead_id',v_lead.id,'consumer_name',v_lead.consumer_name,'phone',v_lead.phone,'email',v_lead.email,'city',v_lead.city,'state',v_state,'zip_code',v_details.zip_code,'primary_need',v_details.project_type,'timeline',v_lead.timeline,'preferred_contact',v_details.preferred_contact,'message',v_lead.message,'planning_answers',coalesce(v_details.answers,'{}'::jsonb),'provider_id',v_provider.id,'provider_name',v_provider.display_name,'consent_version',v_consent.consent_version,'referral_consent_text',v_consent.referral_consent_text,'consent_recorded_at',v_consent.recorded_at,'prepared_at',now());
  insert into public.estate_planning_referral_events(tenant_id,lead_id,referral_id,provider_id,event_type,notes,data_snapshot,actor_user_id) values(v_tenant,p_lead_id,v_ref.id,v_ref.provider_id,'handoff_prepared',nullif(trim(p_notes),''),v_snapshot,v_user) returning id into v_event_id;
  update public.estate_planning_lead_referrals set referral_status='approved_for_referral',updated_by=v_user,updated_at=now() where id=v_ref.id;
  return v_event_id;
end; $$;

create or replace function public.record_estate_planning_provider_response(p_lead_id uuid,p_response text,p_notes text default null)
returns uuid language plpgsql security invoker set search_path to '' as $$
declare v_tenant constant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid; v_user uuid := auth.uid(); v_ref public.estate_planning_lead_referrals%rowtype; v_event_id uuid;
begin
  if v_user is null or not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'staff access required'; end if;
  if p_response not in ('accepted','declined') then raise exception 'provider response must be accepted or declined'; end if;
  select r.* into v_ref from public.estate_planning_lead_referrals r where r.tenant_id=v_tenant and r.lead_id=p_lead_id for update;
  if not found or v_ref.provider_id is null then raise exception 'assigned provider is required'; end if;
  if v_ref.referral_status not in ('referred','accepted','declined') then raise exception 'provider response can only be recorded after a manual handoff is recorded'; end if;
  insert into public.estate_planning_referral_events(tenant_id,lead_id,referral_id,provider_id,event_type,notes,data_snapshot,actor_user_id) values(v_tenant,p_lead_id,v_ref.id,v_ref.provider_id,'provider_response_recorded',nullif(trim(p_notes),''),jsonb_build_object('response',p_response,'recorded_at',now()),v_user) returning id into v_event_id;
  update public.estate_planning_lead_referrals set referral_status=p_response,provider_responded_at=now(),referral_notes=coalesce(nullif(trim(p_notes),''),referral_notes),updated_by=v_user,updated_at=now() where id=v_ref.id;
  return v_event_id;
end; $$;
revoke all on function public.record_estate_planning_provider_response(uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_estate_planning_provider_response(uuid,text,text) to authenticated;
