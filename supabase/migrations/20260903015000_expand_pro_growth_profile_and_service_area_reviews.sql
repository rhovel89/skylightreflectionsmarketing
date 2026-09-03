alter table public.business_edit_requests drop constraint if exists business_edit_requests_request_type_check;
alter table public.business_edit_requests add constraint business_edit_requests_request_type_check check(request_type=any(array['profile_update'::text,'location_update'::text,'services_update'::text,'hours_update'::text,'media_update'::text,'pro_profile_update'::text,'service_areas_update'::text,'other'::text]));

update public.plans set features='["Everything in Featured","Up to 10 showcase photos","Restaurant menu upload","Lead Inbox included","Pro mini-site: services, FAQs, announcements, service packages, special offer, holiday hours, custom CTAs and social links","Advanced analytics","Expanded locations","Priority business tools"]'::jsonb,updated_at=now() where slug='pro';

create or replace function public.review_business_edit_request(p_request_id uuid,p_decision text,p_notes text default null) returns jsonb language plpgsql set search_path='' as $$
declare
  v_req public.business_edit_requests%rowtype;v_business public.businesses%rowtype;v_actor uuid:=auth.uid();v_decision text:=lower(trim(coalesce(p_decision,'')));v_changes jsonb;v_services jsonb;v_faqs jsonb;v_social jsonb;v_offer jsonb;v_announcements jsonb;v_packages jsonb;v_holiday_hours jsonb;v_cta jsonb;v_area jsonb;v_area_id uuid;
begin
  if v_actor is null then raise exception 'authentication_required';end if;
  select * into v_req from public.business_edit_requests where id=p_request_id for update;if not found then raise exception 'edit_request_not_found';end if;
  select * into v_business from public.businesses where id=v_req.business_id and tenant_id=v_req.tenant_id;if not found then raise exception 'business_not_found';end if;
  if not exists(select 1 from public.user_roles ur where ur.user_id=v_actor and ur.tenant_id=v_req.tenant_id and ur.role in('staff','admin','super_admin')) then raise exception 'insufficient_privilege';end if;
  if v_decision not in('approve','reject') then raise exception 'invalid_decision';end if;
  if v_decision='approve' then
    v_changes:=coalesce(v_req.proposed_changes,'{}'::jsonb);
    if v_req.request_type='profile_update' then
      update public.businesses set description=case when v_changes?'description' then nullif(trim(v_changes->>'description'),'') else description end,phone=case when v_changes?'phone' then nullif(trim(v_changes->>'phone'),'') else phone end,website=case when v_changes?'website' then nullif(trim(v_changes->>'website'),'') else website end,hours=case when v_changes?'hours' then nullif(trim(v_changes->>'hours'),'') else hours end,updated_at=now() where id=v_req.business_id and tenant_id=v_req.tenant_id;
    elsif v_req.request_type='pro_profile_update' then
      if private.business_active_plan_slug(v_req.business_id)<>'pro' then raise exception 'pro_plan_required_for_pro_profile';end if;
      v_services:=coalesce(v_changes->'services','[]'::jsonb);v_faqs:=coalesce(v_changes->'faqs','[]'::jsonb);v_social:=coalesce(v_changes->'social_links','{}'::jsonb);v_offer:=coalesce(v_changes->'offer','{}'::jsonb);v_announcements:=coalesce(v_changes->'announcements','[]'::jsonb);v_packages:=coalesce(v_changes->'packages','[]'::jsonb);v_holiday_hours:=coalesce(v_changes->'holiday_hours','[]'::jsonb);v_cta:=coalesce(v_changes->'cta','{}'::jsonb);
      if jsonb_typeof(v_services)<>'array' or jsonb_array_length(v_services)>12 then raise exception 'invalid_services';end if;
      if jsonb_typeof(v_faqs)<>'array' or jsonb_array_length(v_faqs)>8 then raise exception 'invalid_faqs';end if;
      if jsonb_typeof(v_announcements)<>'array' or jsonb_array_length(v_announcements)>3 then raise exception 'invalid_announcements';end if;
      if jsonb_typeof(v_packages)<>'array' or jsonb_array_length(v_packages)>8 then raise exception 'invalid_packages';end if;
      if jsonb_typeof(v_holiday_hours)<>'array' or jsonb_array_length(v_holiday_hours)>20 then raise exception 'invalid_holiday_hours';end if;
      if jsonb_typeof(v_social)<>'object' or jsonb_typeof(v_offer)<>'object' or jsonb_typeof(v_cta)<>'object' then raise exception 'invalid_pro_profile';end if;
      update public.businesses set attributes=jsonb_set(coalesce(attributes,'{}'::jsonb),'{pro_profile}',jsonb_build_object('services',v_services,'faqs',v_faqs,'social_links',v_social,'offer',v_offer,'announcements',v_announcements,'packages',v_packages,'holiday_hours',v_holiday_hours,'cta',v_cta,'approved_at',now(),'approved_by',v_actor),true),updated_at=now() where id=v_req.business_id and tenant_id=v_req.tenant_id;
    elsif v_req.request_type='service_areas_update' then
      if jsonb_typeof(coalesce(v_changes->'location_ids','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(v_changes->'location_ids','[]'::jsonb))>50 then raise exception 'invalid_service_areas';end if;
      delete from public.business_service_areas where business_id=v_req.business_id;
      for v_area in select value from jsonb_array_elements(coalesce(v_changes->'location_ids','[]'::jsonb)) loop
        begin v_area_id:=trim(both '"' from v_area::text)::uuid;exception when others then raise exception 'invalid_service_area_id';end;
        if not exists(select 1 from public.locations l where l.id=v_area_id and l.tenant_id=v_req.tenant_id and l.is_active=true) then raise exception 'invalid_service_area_location';end if;
        insert into public.business_service_areas(business_id,location_id) values(v_req.business_id,v_area_id) on conflict do nothing;
      end loop;
    else raise exception 'unsupported_request_type';end if;
    update public.business_edit_requests set status='approved',staff_notes=nullif(trim(coalesce(p_notes,'')),''),reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_request_id;
    insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_req.tenant_id,v_actor,'business_edit_approved','Approved owner edit request '||p_request_id::text||' ('||v_req.request_type||') for business '||v_req.business_id::text);
  else
    update public.business_edit_requests set status='rejected',staff_notes=nullif(trim(coalesce(p_notes,'')),''),reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_request_id;
    insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_req.tenant_id,v_actor,'business_edit_rejected','Rejected owner edit request '||p_request_id::text||' for business '||v_req.business_id::text);
  end if;
  return jsonb_build_object('ok',true,'request_id',p_request_id,'decision',v_decision,'business_id',v_req.business_id);
end$$;
