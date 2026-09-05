-- Align approval notifications with account-first onboarding and keep account identity private.
create or replace function public.review_business_submission(p_submission_id uuid, p_decision text, p_notes text default null)
returns jsonb
language plpgsql
set search_path=''
as $$
declare
  v_sub public.business_submissions%rowtype;
  v_actor uuid:=auth.uid();
  v_decision text:=lower(trim(coalesce(p_decision,'')));
  v_category_id uuid;
  v_location_id uuid;
  v_business_id uuid;
  v_slug text;
  v_base_slug text;
  v_physical boolean:=false;
  v_location_name text;
begin
  if v_actor is null then raise exception 'authentication_required';end if;
  select * into v_sub from public.business_submissions where id=p_submission_id for update;
  if not found then raise exception 'submission_not_found';end if;
  if v_sub.tenant_id is null then raise exception 'submission_tenant_required';end if;
  if not private.has_tenant_role(v_sub.tenant_id,array['staff','admin','super_admin']::text[]) then raise exception 'insufficient_privilege';end if;
  if v_decision not in('approve','reject') then raise exception 'invalid_decision';end if;
  if v_decision='reject' then
    update public.business_submissions set status='rejected',reviewed_by=v_actor,reviewed_at=now(),review_notes=nullif(trim(coalesce(p_notes,'')),'') where id=p_submission_id;
    insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_sub.tenant_id,v_actor,'business_submission_rejected','Rejected business submission '||p_submission_id::text||' for '||v_sub.business_name);
    return jsonb_build_object('ok',true,'submission_id',p_submission_id,'decision','reject');
  end if;
  if v_sub.status<>'pending' then raise exception 'submission_not_pending';end if;
  if nullif(trim(coalesce(v_sub.category,'')),'') is not null then
    select c.id into v_category_id from public.categories c where c.tenant_id=v_sub.tenant_id and c.is_active=true and (lower(c.name)=lower(trim(v_sub.category)) or lower(c.slug)=lower(regexp_replace(trim(v_sub.category),'[^a-zA-Z0-9]+','-','g'))) order by case when lower(c.name)=lower(trim(v_sub.category)) then 0 else 1 end limit 1;
    if v_category_id is null then raise exception 'category_not_found';end if;
  end if;
  if nullif(trim(coalesce(v_sub.city,'')),'') is not null then
    select l.id,l.name into v_location_id,v_location_name from public.locations l where l.tenant_id=v_sub.tenant_id and l.is_active=true and l.type in('city','town') and lower(l.name)=lower(trim(v_sub.city)) order by l.name limit 1;
    if v_location_id is null then raise exception 'location_not_found';end if;
  end if;
  if exists(select 1 from public.businesses b where b.tenant_id=v_sub.tenant_id and (lower(trim(b.name))=lower(trim(v_sub.business_name)) or trim(b.phone)=trim(v_sub.phone) or (nullif(trim(v_sub.website),'') is not null and lower(trim(coalesce(b.website,'')))=lower(trim(v_sub.website))))) then raise exception 'possible_duplicate_business';end if;
  v_base_slug:=trim(both '-' from lower(regexp_replace(v_sub.business_name||coalesce('-'||nullif(v_sub.city,''),'')||'-il','[^a-zA-Z0-9]+','-','g')));v_slug:=v_base_slug;
  if exists(select 1 from public.businesses b where b.tenant_id=v_sub.tenant_id and b.slug=v_slug) then v_slug:=v_base_slug||'-'||substr(p_submission_id::text,1,8);end if;
  v_physical:=v_sub.operating_model in('storefront','both') and nullif(trim(coalesce(v_sub.address_text,'')),'') is not null and v_location_id is not null;
  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,email,website,description,hours,status,published_at,claimed,verified,featured,rating,review_count,price_range,menu_url,ordering_url,reservation_url,address_text,source_name,source_url,source_checked_at,attributes)
  values(v_sub.tenant_id,v_slug,trim(v_sub.business_name),case when v_physical then v_location_id else null end,trim(v_sub.phone),lower(trim(v_sub.email)),nullif(trim(v_sub.website),''),nullif(trim(v_sub.description),''),nullif(trim(v_sub.hours),''),'pending',null,false,false,false,0,0,nullif(trim(v_sub.price_range),''),nullif(trim(v_sub.menu_url),''),nullif(trim(v_sub.ordering_url),''),nullif(trim(v_sub.reservation_url),''),case when v_physical then nullif(trim(v_sub.address_text),'') else null end,'Business Submission',case when nullif(trim(v_sub.website),'') is not null then trim(v_sub.website) else null end,case when nullif(trim(v_sub.website),'') is not null then now() else null end,jsonb_build_object('submission_id',p_submission_id,'submission_source',v_sub.source,'operating_model',v_sub.operating_model,'submitted_profile',coalesce(v_sub.profile_data,'{}'::jsonb)))
  returning id into v_business_id;
  if v_category_id is not null then insert into public.business_categories(business_id,category_id,is_primary) values(v_business_id,v_category_id,true);end if;
  if v_physical then
    insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,email,source_name,source_url,source_checked_at)
    values(v_sub.tenant_id,v_business_id,v_location_id,'Primary Location','storefront',true,true,false,trim(v_sub.address_text),v_location_name,coalesce(nullif(trim(v_sub.state),''),'IL'),nullif(trim(v_sub.postal_code),''),trim(v_sub.phone),lower(trim(v_sub.email)),'Business Submission',case when nullif(trim(v_sub.website),'') is not null then trim(v_sub.website) else null end,case when nullif(trim(v_sub.website),'') is not null then now() else null end);
  end if;
  insert into public.business_service_areas(business_id,location_id)
  select v_business_id,l.id from public.locations l where l.tenant_id=v_sub.tenant_id and l.is_active=true and exists(select 1 from unnest(coalesce(v_sub.service_areas,'{}'::text[])) a where lower(trim(a))=lower(l.name)) on conflict do nothing;
  update public.business_submissions set status='approved',reviewed_by=v_actor,reviewed_at=now(),review_notes=nullif(trim(coalesce(p_notes,'')),''),promoted_business_id=v_business_id,claim_invited_at=now() where id=p_submission_id;
  insert into public.email_outbox(tenant_id,business_id,recipient_email,recipient_name,message_type,template_key,subject,body,cta_label,cta_url,status,scheduled_for)
  values(v_sub.tenant_id,v_business_id,lower(v_sub.email),coalesce(nullif(v_sub.contact_name,''),v_sub.business_name),'transactional','business_submission_approved','Your business profile is approved for ownership review','We approved the directory profile information for '||v_sub.business_name||'. The profile is not public yet. Sign in to the Central Illinois Local Pros account used to submit this business, then submit your ownership evidence. After ownership and final verification are approved, the profile can be published.','Claim Your Business','/claim?business='||v_business_id::text,'queued',now());
  if v_sub.submitted_by_user_id is not null then
    insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
    values(v_sub.submitted_by_user_id,v_sub.tenant_id,'Business profile approved for ownership review',v_sub.business_name||' is ready for the ownership-evidence step. Sign in to the account that submitted it to continue.','/claim?business='||v_business_id::text,'business_submission_approved:'||p_submission_id::text);
  end if;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_sub.tenant_id,v_actor,'business_submission_approved_pending_claim','Approved business submission '||p_submission_id::text||' and created pending business '||v_business_id::text||' for ownership review.');
  return jsonb_build_object('ok',true,'submission_id',p_submission_id,'decision','approve','business_id',v_business_id,'slug',v_slug,'status','pending','claim_invited',true);
end;
$$;
