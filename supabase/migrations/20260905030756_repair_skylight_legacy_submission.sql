do $$
declare v_tenant uuid;v_business uuid;v_submission uuid;v_category uuid;v_pontiac uuid;v_email text;v_name text;
begin
  select id into v_tenant from public.tenants where slug='central-illinois-local-pros' limit 1;
  if v_tenant is null then return;end if;
  insert into public.categories(tenant_id,vertical,slug,name,is_active)
  values(v_tenant,'other','digital-marketing-agencies','Digital Marketing Agencies',true)
  on conflict do nothing;
  select id into v_category from public.categories where tenant_id=v_tenant and slug='digital-marketing-agencies' limit 1;
  select id into v_business from public.businesses where tenant_id=v_tenant and lower(btrim(name))='skylight reflections marketing' order by created_at desc limit 1;
  select id,email,business_name into v_submission,v_email,v_name from public.business_submissions where tenant_id=v_tenant and lower(btrim(business_name))='skylight reflections marketing' order by created_at desc limit 1;
  if v_business is null or v_submission is null then return;end if;
  delete from public.business_categories where business_id=v_business;
  if v_category is not null then insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_category,true) on conflict do nothing;end if;
  select id into v_pontiac from public.locations where tenant_id=v_tenant and lower(name)='pontiac' and is_active=true order by name limit 1;
  if v_pontiac is not null then insert into public.business_service_areas(business_id,location_id) values(v_business,v_pontiac) on conflict do nothing;end if;
  update public.businesses set primary_location_id=null,address_text=null,status='pending',published_at=null,claimed=false,verified=false,source_name='Business Submission',source_url=null,source_checked_at=null,updated_at=now(),attributes=coalesce(attributes,'{}'::jsonb)||jsonb_build_object('submission_id',v_submission,'operating_model','online','legacy_onboarding_repaired',true) where id=v_business;
  update public.business_submissions set category='Digital Marketing Agencies',city=null,operating_model='online',promoted_business_id=v_business,claim_invited_at=now(),review_notes=concat_ws(E'\n',nullif(review_notes,''),'Legacy approval repaired into staged onboarding workflow; Pontiac preserved as a service area, not a physical office.') where id=v_submission;
  if v_email is not null and not exists(select 1 from public.email_outbox where business_id=v_business and template_key='business_submission_approved') then
    insert into public.email_outbox(tenant_id,business_id,recipient_email,recipient_name,message_type,template_key,subject,body,cta_label,cta_url,status,scheduled_for)
    values(v_tenant,v_business,lower(v_email),coalesce(v_name,'Business Owner'),'transactional','business_submission_approved','Your business profile is approved for ownership review','We approved the directory profile information for Skylight Reflections Marketing. The profile is not public yet. Sign in or create an account with this email address, then submit your ownership evidence. After ownership and final verification are approved, the profile can be published.','Claim Your Business','/claim?business='||v_business::text,'queued',now());
  end if;
  insert into public.audit_logs(tenant_id,action_type,action_text) values(v_tenant,'legacy_business_submission_repaired','Repaired Skylight Reflections Marketing legacy approval into pending staged onboarding; corrected category and preserved Pontiac as a service area without inventing a physical office.');
end $$;
