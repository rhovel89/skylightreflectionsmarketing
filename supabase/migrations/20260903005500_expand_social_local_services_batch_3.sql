do $$
declare
  v_tenant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3';
  v_decatur uuid;
  v_forsyth uuid;
  v_mtzion uuid;
  v_business uuid;
  v_pressure uuid;
  v_junk uuid;
  v_auto uuid;
begin
  select id into v_decatur from public.locations where tenant_id=v_tenant and slug='decatur' and is_active=true limit 1;
  select id into v_forsyth from public.locations where tenant_id=v_tenant and slug='forsyth' and is_active=true limit 1;
  select id into v_mtzion from public.locations where tenant_id=v_tenant and slug='mt-zion' and is_active=true limit 1;
  select id into v_pressure from public.categories where tenant_id=v_tenant and slug='pressure-washing' and is_active=true limit 1;
  select id into v_junk from public.categories where tenant_id=v_tenant and slug='junk-removal' and is_active=true limit 1;
  select id into v_auto from public.categories where tenant_id=v_tenant and slug='auto-detailing' and is_active=true limit 1;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'performance-pressure-washing-decatur','Performance Pressure Washing',v_decatur,'217-246-4952','https://performancepressurewashing.net/','Locally owned Decatur pressure-washing company serving residential and commercial customers with exterior cleaning for homes, driveways, patios, decks, gutters, vehicles, equipment and related surfaces.','published',now(),'2254 Karl Ln, Decatur, IL 62522','Official website + linked Facebook business page','https://performancepressurewashing.net/',now(),'{"discovery":"facebook_and_official_web","facebook_url":"https://www.facebook.com/PerformancePressureWashingDecaturIL"}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,website=excluded.website,description=excluded.description,address_text=excluded.address_text,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,attributes=public.businesses.attributes||excluded.attributes,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_pressure,true) on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
  values(v_tenant,v_business,v_decatur,'Decatur location','office',true,true,false,'2254 Karl Ln','Decatur','IL','62522','217-246-4952','Official website','https://performancepressurewashing.net/',now()) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,email,website,description,status,published_at,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'stones-hauling-junk-removal-decatur','Stone''s Hauling and Junk Removal',v_decatur,'217-864-0340','stoneshauling@yahoo.com','https://stonejunkremoval.com/','Locally owned Decatur-area junk removal and hauling company handling furniture, appliances, yard debris, property cleanouts, commercial junk, construction debris and other unwanted items.','published',now(),'Official website + current local business profile','https://stonejunkremoval.com/',now(),'{"discovery":"social_public_web","service_area_business":true}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,email=excluded.email,website=excluded.website,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_junk,true) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_decatur) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,email,website,description,status,published_at,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'dreamy-auto-detailing-decatur','Dreamy Auto Detailing',v_decatur,'217-972-5083','Kael@DreamyCarDetailing.com','https://dreamycardetailing.com/','Central Illinois mobile auto-detailing service providing interior and exterior detailing, paint correction, ceramic coating, fleet detailing and boat detailing in Decatur and surrounding communities.','published',now(),'Official website + current local business profile','https://dreamycardetailing.com/',now(),'{"discovery":"social_public_web","service_area_business":true}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,email=excluded.email,website=excluded.website,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_auto,true) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_decatur) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_forsyth) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_mtzion) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,email,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'detailing-fever-decatur','Detailing Fever',v_decatur,'217-820-4553','snowden@detailingfever.com','https://detailingfever.com/','Decatur auto-detailing business providing mobile interior and exterior detailing, paint correction, ceramic coating and maintenance-detail services throughout Decatur and nearby communities.','published',now(),'1487 N Foster Ave, Decatur, IL 62526','Official website + current local business profile','https://detailingfever.com/',now(),'{"discovery":"social_public_web"}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,email=excluded.email,website=excluded.website,description=excluded.description,address_text=excluded.address_text,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_auto,true) on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,email,source_name,source_url,source_checked_at)
  values(v_tenant,v_business,v_decatur,'Decatur location','office',true,true,false,'1487 N Foster Ave','Decatur','IL','62526','217-820-4553','snowden@detailingfever.com','Official website','https://detailingfever.com/contact-us/',now()) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_forsyth) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_mtzion) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,website,description,status,published_at,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'ashtons-auto-detail-decatur','Ashton''s Auto Detail',v_decatur,'217-521-9027','https://www.ashtonsautodetail.com/','Fully mobile Central Illinois auto-detailing service for cars, trucks, SUVs, boats and farm equipment, with detailing, paint correction and ceramic-coating services in Decatur, Forsyth and nearby communities.','published',now(),'Official website + current local business profile','https://www.ashtonsautodetail.com/',now(),'{"discovery":"social_public_web","service_area_business":true}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,website=excluded.website,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_auto,true) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_decatur) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_forsyth) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_mtzion) on conflict do nothing;
end $$;
