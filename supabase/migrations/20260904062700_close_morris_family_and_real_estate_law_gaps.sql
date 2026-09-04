do $$
declare
  v_tenant uuid;
  v_morris uuid;
  v_family uuid;
  v_real_estate uuid;
  v_business uuid;
begin
  select id into v_tenant from public.tenants where id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
  if v_tenant is null then raise exception 'target_tenant_not_found'; end if;

  select id into v_morris from public.locations where tenant_id=v_tenant and name='Morris' and is_active=true limit 1;
  select id into v_family from public.categories where tenant_id=v_tenant and name='Family Law' and is_active=true limit 1;
  select id into v_real_estate from public.categories where tenant_id=v_tenant and name='Real Estate Law' and is_active=true limit 1;
  if v_morris is null or v_family is null or v_real_estate is null then raise exception 'required_taxonomy_or_market_missing'; end if;

  select id into v_business from public.businesses where tenant_id=v_tenant and slug='law-office-charles-l-schmidt-morris';
  if v_business is null then
    insert into public.businesses(
      tenant_id,slug,name,phone,website,description,status,published_at,address_text,
      source_name,source_url,source_checked_at,claimed,verified,featured,profile_score
    ) values (
      v_tenant,
      'law-office-charles-l-schmidt-morris',
      'Law Office of Charles L. Schmidt, Ltd.',
      '815-942-0701',
      'https://www.charlesschmidtlaw.com/',
      'Morris law office serving Grundy County with established practice areas that include residential and commercial real estate, divorce and family law, estate planning, probate, bankruptcy and related legal matters.',
      'published',now(),
      '117 W Washington St, Morris, IL 60450',
      'Law Office of Charles L. Schmidt, Ltd.',
      'https://www.charlesschmidtlaw.com/',
      now(),false,false,false,72
    ) returning id into v_business;
  end if;

  insert into public.business_categories(business_id,category_id,is_primary)
  values(v_business,v_real_estate,true) on conflict do nothing;
  insert into public.business_categories(business_id,category_id,is_primary)
  values(v_business,v_family,false) on conflict do nothing;

  insert into public.business_locations(
    tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,
    address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at
  )
  select v_tenant,v_business,v_morris,'Morris','office',true,true,false,
         '117 W Washington St, Morris, IL 60450','Morris','IL','60450','815-942-0701',
         'Law Office of Charles L. Schmidt, Ltd.','https://www.charlesschmidtlaw.com/contact/',now()
  where not exists(
    select 1 from public.business_locations
    where tenant_id=v_tenant and business_id=v_business and location_id=v_morris and is_active=true
  );

  perform private.refresh_seo_market_gaps_system(v_tenant);
  perform private.refresh_data_quality_tasks(v_tenant);
  perform private.ensure_acquisition_research_prospects(v_tenant);
  perform private.refresh_growth_opportunities(v_tenant);
  perform private.sync_growth_outreach_tasks(v_tenant);
end $$;
