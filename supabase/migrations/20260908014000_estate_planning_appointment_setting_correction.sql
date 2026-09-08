-- Estate Planning is an appointment-setting workflow: preliminary qualification + booking.
-- It is not a provider onboarding, provider network, referral marketplace, or lawyer-document collection workflow.

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
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_user uuid := auth.uid();
  v_tenant constant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
  v_state text := upper(trim(coalesce(p_state,'')));
  v_attr jsonb := case when jsonb_typeof(coalesce(p_attribution,'{}'::jsonb))='object' then coalesce(p_attribution,'{}'::jsonb) else '{}'::jsonb end;
  v_consent_version constant text := 'estate-planning-appointment-setting-v4-2026-09';
  v_contact_consent constant text := 'I agree that Central Illinois Local Pros / Skylight Reflections Marketing may contact me by phone, text, or email about this estate-planning consultation request. Message and data rates may apply.';
  v_appointment_consent constant text := 'I agree that Skylight Reflections Marketing may share my contact information and the qualifying answers I submit with the estate-planning attorney or law office connected to this appointment request so my consultation can be scheduled and followed up on.';
begin
  if not coalesce(p_consent_to_contact,false) or not coalesce(p_consent_to_share,false) then raise exception 'contact and appointment-sharing consent are required'; end if;
  if char_length(trim(coalesce(p_consumer_name,''))) < 2 or char_length(trim(coalesce(p_phone,''))) < 7 or position('@' in coalesce(p_email,'')) < 2 then raise exception 'valid contact information is required'; end if;
  if char_length(trim(coalesce(p_city,''))) < 2 then raise exception 'city is required'; end if;
  if v_state !~ '^[A-Z]{2}$' then raise exception 'valid state is required'; end if;
  if p_zip_code is not null and trim(p_zip_code) <> '' and trim(p_zip_code) !~ '^[0-9]{5}(-[0-9]{4})?$' then raise exception 'valid ZIP code required'; end if;
  if char_length(trim(coalesce(p_primary_need,''))) < 2 then raise exception 'planning need is required'; end if;

  insert into public.leads(tenant_id,business_id,assigned_business_id,service,city,consumer_name,phone,email,message,timeline,status,consumer_user_id,consent_to_contact,source,consent_disclosure_version,consent_recorded_at)
  values(v_tenant,null,null,'Estate Planning & Trust',trim(p_city),trim(p_consumer_name),trim(p_phone),trim(p_email),nullif(trim(coalesce(p_message,'')),''),nullif(trim(coalesce(p_timeline,'')),''),'new',v_user,true,'estate_planning_nationwide',v_consent_version,now()) returning id into v_id;

  insert into public.lead_project_details(lead_id,tenant_id,project_type,property_type,budget_range,zip_code,preferred_contact,urgency,answers)
  values(
    v_id,v_tenant,nullif(trim(coalesce(p_primary_need,'')),''),'Personal / legal matter',null,
    nullif(trim(coalesce(p_zip_code,'')),''),nullif(trim(coalesce(p_preferred_contact,'')),''),nullif(trim(coalesce(p_timeline,'')),''),
    jsonb_build_object(
      'state',v_state,
      'primary_need',trim(coalesce(p_primary_need,'')),
      'existing_plan',nullif(trim(coalesce(p_existing_plan,'')),''),
      'family_context',nullif(trim(coalesce(p_family_context,'')),''),
      'business_owner',coalesce(p_business_owner,false),
      'real_estate_owner',coalesce(p_real_estate_owner,false),
      'appointment_program','estate_planning_appointment_setting',
      'appointment_information_share_consent',true
    )
  );

  -- Existing tables are retained for backward-compatible qualification and appointment tracking.
  insert into public.estate_planning_lead_sales(tenant_id,lead_id,created_by,updated_by) values(v_tenant,v_id,v_user,v_user);
  insert into public.estate_planning_lead_referrals(tenant_id,lead_id,created_by,updated_by) values(v_tenant,v_id,v_user,v_user);
  insert into public.estate_planning_lead_consents(tenant_id,lead_id,consent_version,contact_consent_text,referral_consent_text,source_page,landing_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,contact_snapshot,recorded_at)
  values(
    v_tenant,v_id,v_consent_version,v_contact_consent,v_appointment_consent,'/estate-planning',
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
$function$;

-- Retire the unused 1.2 provider-network/handoff infrastructure.
drop function if exists public.assign_estate_planning_provider(uuid,uuid,text);
drop function if exists public.clear_estate_planning_provider_assignment(uuid,text);
drop function if exists public.prepare_estate_planning_referral_handoff(uuid,text);
drop function if exists public.record_estate_planning_referral_handoff(uuid,text,text,text);
drop function if exists public.record_estate_planning_provider_response(uuid,text,text);

drop table if exists public.estate_planning_referral_events cascade;
drop table if exists public.estate_planning_provider_states cascade;
drop table if exists public.estate_planning_providers cascade;
alter table if exists public.estate_planning_lead_referrals drop column if exists provider_id;
