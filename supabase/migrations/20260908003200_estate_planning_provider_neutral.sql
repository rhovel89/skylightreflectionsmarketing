alter table public.estate_planning_lead_sales
  alter column buyer_name set default 'Private Estate Planning Referral Partner';

alter table public.estate_planning_lead_sales
  alter column buyer_url drop not null,
  alter column buyer_url drop default;

update public.estate_planning_lead_sales
set buyer_name = 'Private Estate Planning Referral Partner',
    buyer_url = null,
    updated_at = now()
where buyer_name = 'Estate Legacy Pro'
   or buyer_url = 'https://estatelegacypro.com/';

update public.leads
set source = 'estate_planning_nationwide',
    consent_disclosure_version = 'estate-planning-provider-referral-v2-2026-09'
where source = 'estate_legacy_pro_nationwide';

update public.lead_project_details
set answers = (coalesce(answers,'{}'::jsonb) - 'referral_partner_url' - 'consent_to_share_with_estate_legacy_pro') || jsonb_build_object(
  'referral_partner','Participating estate-planning service provider',
  'lead_program','estate_planning_nationwide',
  'consent_to_share_with_estate_planning_provider',true
)
where answers->>'lead_program' = 'estate_legacy_pro_nationwide'
   or answers->>'referral_partner' = 'Estate Legacy Pro';

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
  values(p_tenant_id,null,null,'Estate Planning & Trust',trim(p_city),trim(p_consumer_name),trim(p_phone),trim(p_email),nullif(trim(coalesce(p_message,'')),''),nullif(trim(coalesce(p_timeline,'')),''),'new',v_user,true,'estate_planning_nationwide','estate-planning-provider-referral-v2-2026-09',now()) returning id into v_id;

  insert into public.lead_project_details(lead_id,tenant_id,project_type,property_type,budget_range,zip_code,preferred_contact,urgency,answers)
  values(v_id,p_tenant_id,nullif(trim(coalesce(p_primary_need,'')),''),'Personal / legal matter',null,nullif(trim(coalesce(p_zip_code,'')),''),nullif(trim(coalesce(p_preferred_contact,'')),''),nullif(trim(coalesce(p_timeline,'')),''),jsonb_build_object('state',v_state,'primary_need',trim(coalesce(p_primary_need,'')),'existing_plan',nullif(trim(coalesce(p_existing_plan,'')),''),'family_context',nullif(trim(coalesce(p_family_context,'')),''),'business_owner',coalesce(p_business_owner,false),'real_estate_owner',coalesce(p_real_estate_owner,false),'referral_partner','Participating estate-planning service provider','lead_program','estate_planning_nationwide','consent_to_share_with_estate_planning_provider',true));

  insert into public.estate_planning_lead_sales(tenant_id,lead_id,created_by,updated_by) values(p_tenant_id,v_id,v_user,v_user);
  return v_id;
end;
$$;

revoke all on function public.submit_estate_planning_lead(uuid,text,text,text,text,text,text,text,text,text,boolean,boolean,text,text,text,boolean,boolean) from public;
grant execute on function public.submit_estate_planning_lead(uuid,text,text,text,text,text,text,text,text,text,boolean,boolean,text,text,text,boolean,boolean) to anon, authenticated;
