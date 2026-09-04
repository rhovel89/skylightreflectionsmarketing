do $$
declare
  v_tenant uuid;
  v_category uuid;
  v_chatham uuid;
  v_washington uuid;
  v_creek uuid;
  v_brickhouse uuid;
begin
  select id into v_tenant from public.tenants where id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
  if v_tenant is null then raise exception 'target_tenant_not_found'; end if;
  select id into v_category from public.categories where tenant_id=v_tenant and name='American Restaurants' and is_active=true limit 1;
  select id into v_chatham from public.locations where tenant_id=v_tenant and name='Chatham' and is_active=true limit 1;
  select id into v_washington from public.locations where tenant_id=v_tenant and name='Washington' and is_active=true limit 1;
  if v_category is null or v_chatham is null or v_washington is null then raise exception 'required_taxonomy_or_market_missing'; end if;

  select id into v_creek from public.businesses where tenant_id=v_tenant and slug='the-creek-pub-grill-chatham';
  if v_creek is null then
    insert into public.businesses(tenant_id,slug,name,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,claimed,verified,featured,profile_score)
    values(v_tenant,'the-creek-pub-grill-chatham','The Creek Pub & Grill','217-483-8282','https://thecreekpub.com/','Local Chatham pub and grill serving American comfort food, burgers, sandwiches and other casual dining favorites.','published',now(),'1081 Jason Pl, Chatham, IL 62629','Restaurantji','https://www.restaurantji.com/il/chatham/',now(),false,false,false,65)
    returning id into v_creek;
  end if;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_creek,v_category,true) on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
    select v_tenant,v_creek,v_chatham,'Chatham','restaurant',true,true,false,'1081 Jason Pl, Chatham, IL 62629','Chatham','IL','62629','217-483-8282','Restaurantji','https://www.restaurantji.com/il/chatham/',now()
    where not exists(select 1 from public.business_locations where tenant_id=v_tenant and business_id=v_creek and location_id=v_chatham and is_active=true);

  select id into v_brickhouse from public.businesses where tenant_id=v_tenant and slug='brickhouse-bbq-burgers-brew-washington';
  if v_brickhouse is null then
    insert into public.businesses(tenant_id,slug,name,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,claimed,verified,featured,profile_score)
    values(v_tenant,'brickhouse-bbq-burgers-brew-washington','Brickhouse BBQ, Burgers & Brew','309-886-3070','https://thebrickhousebbb.com/','Washington restaurant serving BBQ, burgers, pizza, American entrees and a full bar.','published',now(),'1021 N Cummings Lane, Washington, IL 61571','Washington Chamber of Commerce','https://business.washingtonilcoc.com/list/category/restaurants-74',now(),false,false,false,68)
    returning id into v_brickhouse;
  end if;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_brickhouse,v_category,true) on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
    select v_tenant,v_brickhouse,v_washington,'Washington','restaurant',true,true,false,'1021 N Cummings Lane, Washington, IL 61571','Washington','IL','61571','309-886-3070','Washington Chamber of Commerce','https://business.washingtonilcoc.com/list/category/restaurants-74',now()
    where not exists(select 1 from public.business_locations where tenant_id=v_tenant and business_id=v_brickhouse and location_id=v_washington and is_active=true);

  perform private.refresh_seo_market_gaps_system(v_tenant);
  perform private.refresh_data_quality_tasks(v_tenant);
  perform private.ensure_acquisition_research_prospects(v_tenant);
  perform private.refresh_growth_opportunities(v_tenant);
  perform private.sync_growth_outreach_tasks(v_tenant);
end $$;
