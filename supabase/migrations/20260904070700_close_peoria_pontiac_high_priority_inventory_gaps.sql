do $$
declare
  v_tenant uuid;
  v_peoria uuid;
  v_pontiac uuid;
  v_cic uuid;
  v_cipw uuid;
  v_babb uuid;
begin
  select id into v_tenant from public.tenants where id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
  if v_tenant is null then raise exception 'target_tenant_not_found'; end if;

  select id into v_peoria from public.locations where tenant_id=v_tenant and name='Peoria' and is_active=true limit 1;
  select id into v_pontiac from public.locations where tenant_id=v_tenant and name='Pontiac' and is_active=true limit 1;
  if v_peoria is null or v_pontiac is null then raise exception 'required_market_missing'; end if;

  if (select count(*) from public.categories where tenant_id=v_tenant and is_active=true and name in ('Landscaping','Lawn Care','Pressure Washing','Family Law','Estate Planning','Divorce','Probate','Real Estate Law','Wills & Trusts','Business Law','Civil Litigation','Criminal Defense')) <> 12 then
    raise exception 'required_category_missing';
  end if;

  select id into v_cic from public.businesses where tenant_id=v_tenant and slug='cuttin-it-close-lawn-care-landscaping-peoria';
  if v_cic is null then
    insert into public.businesses(tenant_id,slug,name,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,claimed,verified,featured,profile_score)
    values(v_tenant,'cuttin-it-close-lawn-care-landscaping-peoria','Cuttin'' It Close Lawn Care & Landscaping','309-692-7400','https://cicpeoria.com/','Peoria-based lawn care and landscaping company providing residential and commercial mowing, lawn maintenance, landscaping, fertilization, snow removal, hydroseeding and related outdoor property services.','published',now(),'1715 South Laramie Street, Peoria, IL 61605','Official website','https://cicpeoria.com/',now(),false,false,false,78)
    returning id into v_cic;
  end if;
  insert into public.business_categories(business_id,category_id,is_primary)
    select v_cic,c.id,(c.name='Landscaping') from public.categories c
    where c.tenant_id=v_tenant and c.is_active=true and c.name in ('Landscaping','Lawn Care')
    on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
    select v_tenant,v_cic,v_peoria,'Peoria','office',true,true,false,'1715 South Laramie Street, Peoria, IL 61605','Peoria','IL','61605','309-692-7400','Official website','https://cicpeoria.com/',now()
    where not exists(select 1 from public.business_locations where tenant_id=v_tenant and business_id=v_cic and location_id=v_peoria and is_active=true);

  select id into v_cipw from public.businesses where tenant_id=v_tenant and slug='central-illinois-power-washing-peoria';
  if v_cipw is null then
    insert into public.businesses(tenant_id,slug,name,phone,email,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,claimed,verified,featured,profile_score)
    values(v_tenant,'central-illinois-power-washing-peoria','Central Illinois Power Washing','309-635-3371','info@cipowerwashing.com','https://cipowerwashing.com/','Peoria exterior-cleaning company providing residential and commercial pressure washing and soft washing services across Central Illinois.','published',now(),'2601 W Lake Ave Suite B-4, Peoria, IL 61615','Official website','https://cipowerwashing.com/',now(),false,false,false,80)
    returning id into v_cipw;
  end if;
  insert into public.business_categories(business_id,category_id,is_primary)
    select v_cipw,c.id,true from public.categories c
    where c.tenant_id=v_tenant and c.is_active=true and c.name='Pressure Washing'
    on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,email,source_name,source_url,source_checked_at)
    select v_tenant,v_cipw,v_peoria,'Peoria','office',true,true,false,'2601 W Lake Ave Suite B-4, Peoria, IL 61615','Peoria','IL','61615','309-635-3371','info@cipowerwashing.com','Official website','https://cipowerwashing.com/',now()
    where not exists(select 1 from public.business_locations where tenant_id=v_tenant and business_id=v_cipw and location_id=v_peoria and is_active=true);

  select id into v_babb from public.businesses where tenant_id=v_tenant and slug='david-j-babb-attorney-at-law-pontiac';
  if v_babb is null then
    insert into public.businesses(tenant_id,slug,name,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,claimed,verified,featured,profile_score)
    values(v_tenant,'david-j-babb-attorney-at-law-pontiac','David J. Babb Attorney at Law','815-844-4000','https://davidbabblaw.com/','Pontiac law practice serving Livingston County and surrounding areas with family law, estate planning and probate, real estate, criminal and traffic, civil litigation, and business-law services.','published',now(),'401 N Plum St, Pontiac, IL 61764','Official website','https://davidbabblaw.com/consultation/',now(),false,false,false,82)
    returning id into v_babb;
  end if;
  insert into public.business_categories(business_id,category_id,is_primary)
    select v_babb,c.id,(c.name='Family Law') from public.categories c
    where c.tenant_id=v_tenant and c.is_active=true and c.name in ('Family Law','Estate Planning','Divorce','Probate','Real Estate Law','Wills & Trusts','Business Law','Civil Litigation','Criminal Defense')
    on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
    select v_tenant,v_babb,v_pontiac,'Pontiac','office',true,true,false,'401 N Plum St, Pontiac, IL 61764','Pontiac','IL','61764','815-844-4000','Official website','https://davidbabblaw.com/',now()
    where not exists(select 1 from public.business_locations where tenant_id=v_tenant and business_id=v_babb and location_id=v_pontiac and is_active=true);

  perform private.refresh_seo_market_gaps_system(v_tenant);
  perform private.refresh_data_quality_tasks(v_tenant);
  perform private.ensure_acquisition_research_prospects(v_tenant);
  perform private.refresh_growth_opportunities(v_tenant);
  perform private.sync_growth_outreach_tasks(v_tenant);
end $$;
