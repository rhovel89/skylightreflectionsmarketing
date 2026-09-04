do $$
declare
  v_tenant uuid;
  v_pontiac uuid;
  v_firm uuid;
begin
  select id into v_tenant from public.tenants where id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
  if v_tenant is null then raise exception 'target_tenant_not_found'; end if;
  select id into v_pontiac from public.locations where tenant_id=v_tenant and name='Pontiac' and is_active=true limit 1;
  if v_pontiac is null then raise exception 'pontiac_market_missing'; end if;
  if (select count(*) from public.categories where tenant_id=v_tenant and is_active=true and name in ('Divorce','Business Law','Civil Litigation')) <> 3 then
    raise exception 'required_category_missing';
  end if;

  select id into v_firm from public.businesses where tenant_id=v_tenant and slug='fellheimer-law-firm-pontiac';
  if v_firm is null then
    insert into public.businesses(tenant_id,slug,name,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,claimed,verified,featured,profile_score)
    values(
      v_tenant,
      'fellheimer-law-firm-pontiac',
      'Fellheimer Law Firm, Ltd.',
      '815-842-3858',
      'https://fellheimerlawfirm.com/',
      'Long-established Pontiac general-practice law firm. Current firm and attorney profiles support civil litigation, corporate and business matters, and divorce-related representation from its Pontiac office.',
      'published',now(),
      '210 N Main St, Pontiac, IL 61764',
      'Official website and current legal-directory profiles',
      'https://fellheimerlawfirm.com/',
      now(),false,false,false,84
    ) returning id into v_firm;
  end if;

  insert into public.business_categories(business_id,category_id,is_primary)
    select v_firm,c.id,(c.name='Civil Litigation')
    from public.categories c
    where c.tenant_id=v_tenant and c.is_active=true
      and c.name in ('Divorce','Business Law','Civil Litigation')
    on conflict do nothing;

  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
    select v_tenant,v_firm,v_pontiac,'Pontiac','office',true,true,false,
      '210 N Main St, Pontiac, IL 61764','Pontiac','IL','61764','815-842-3858',
      'Official website','https://fellheimerlawfirm.com/',now()
    where not exists(
      select 1 from public.business_locations where tenant_id=v_tenant and business_id=v_firm and location_id=v_pontiac and is_active=true
    );

  perform private.refresh_seo_market_gaps_system(v_tenant);
  perform private.refresh_data_quality_tasks(v_tenant);
  perform private.ensure_acquisition_research_prospects(v_tenant);
  perform private.refresh_growth_opportunities(v_tenant);
  perform private.sync_growth_outreach_tasks(v_tenant);
end $$;
