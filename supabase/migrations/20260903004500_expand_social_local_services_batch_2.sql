do $$
declare
  v_tenant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3';
  v_springfield uuid;
  v_bloomington uuid;
  v_normal uuid;
  v_business uuid;
  v_pressure uuid;
  v_junk uuid;
  v_auto uuid;
  v_handyman uuid;
begin
  select id into v_springfield from public.locations where tenant_id=v_tenant and slug='springfield' and is_active=true limit 1;
  select id into v_bloomington from public.locations where tenant_id=v_tenant and slug='bloomington' and is_active=true limit 1;
  select id into v_normal from public.locations where tenant_id=v_tenant and slug='normal' and is_active=true limit 1;
  select id into v_pressure from public.categories where tenant_id=v_tenant and slug='pressure-washing' and is_active=true limit 1;
  select id into v_junk from public.categories where tenant_id=v_tenant and slug='junk-removal' and is_active=true limit 1;
  select id into v_auto from public.categories where tenant_id=v_tenant and slug='auto-detailing' and is_active=true limit 1;
  select id into v_handyman from public.categories where tenant_id=v_tenant and slug='handyman' and is_active=true limit 1;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'midwest-power-soft-wash-springfield','Midwest Power/Soft Wash',v_springfield,'217-816-0924','https://www.midwestpowersoftwashing.com/','Family-owned Springfield-area exterior cleaning company providing pressure washing, soft washing, roof cleaning and gutter cleaning for residential and commercial properties.','published',now(),'9 St Marys Ct, Springfield, IL 62702','Official website','https://www.midwestpowersoftwashing.com/',now(),'{"discovery":"social_public_web"}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,website=excluded.website,description=excluded.description,address_text=excluded.address_text,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_pressure,true) on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
  values(v_tenant,v_business,v_springfield,'Springfield location','office',true,true,false,'9 St Marys Ct','Springfield','IL','62702','217-816-0924','Official website','https://www.midwestpowersoftwashing.com/',now()) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,website,description,status,published_at,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'springfield-junk-away','Springfield Junk Away',v_springfield,'217-523-9858','https://www.springfieldjunkaway.com/','Locally operated Springfield-area junk removal and cleanout service handling household, garage, office, storage, appliance, furniture and other hauling needs.','published',now(),'Official website','https://www.springfieldjunkaway.com/',now(),'{"discovery":"social_public_web","service_area_business":true}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,website=excluded.website,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_junk,true) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_springfield) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'kings-deluxe-auto-spa-springfield','King''s Deluxe Auto Spa',v_springfield,'217-670-5169','https://kingsdeluxeautospa.com/','Springfield auto detailing and car-care business offering in-shop and mobile detailing, ceramic coating, tinting, wash and wax services.','published',now(),'2832 E Clear Lake Ave, Springfield, IL 62703','Official website','https://kingsdeluxeautospa.com/',now(),'{"discovery":"social_public_web"}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,website=excluded.website,description=excluded.description,address_text=excluded.address_text,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_auto,true) on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
  values(v_tenant,v_business,v_springfield,'Springfield location','office',true,true,false,'2832 E Clear Lake Ave','Springfield','IL','62703','217-670-5169','Official website','https://kingsdeluxeautospa.com/contact-us/',now()) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,email,website,description,status,published_at,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'geoffs-fix-it-springfield','Geoff''s Fix It LLC',v_springfield,'217-279-6020','GeoffsFixIt@gmail.com','https://www.geoffsfixit.com/','Springfield-area handyman and carpentry service focused on decks, fences, doors, trim, flooring, repairs, woodworking and smaller home-improvement projects.','published',now(),'Official website','https://www.geoffsfixit.com/',now(),'{"discovery":"social_public_web","service_area_business":true}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,email=excluded.email,website=excluded.website,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_handyman,true) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_springfield) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,email,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'petersburg-power-washing-springfield','Petersburg Power Washing, Inc.',v_springfield,'217-416-6388','ppnpw@yahoo.com','https://petersburgpowerwashing.com/','Family-owned Springfield-area company providing residential, commercial and industrial power washing plus gutter cleaning, air-duct cleaning and vehicle detailing.','published',now(),'829 S 11th St, Springfield, IL 62703','Official website','https://petersburgpowerwashing.com/',now(),'{"discovery":"social_public_web"}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,email=excluded.email,website=excluded.website,description=excluded.description,address_text=excluded.address_text,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_pressure,true) on conflict do nothing;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_auto,false) on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,email,source_name,source_url,source_checked_at)
  values(v_tenant,v_business,v_springfield,'Springfield location','office',true,true,false,'829 S 11th St','Springfield','IL','62703','217-416-6388','ppnpw@yahoo.com','Official website','https://petersburgpowerwashing.com/',now()) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,website,description,status,published_at,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'egans-exterior-services-bloomington','Egan''s Exterior Services',v_bloomington,'309-533-8433','https://eganexteriors.com/','Bloomington-Normal exterior cleaning company serving McLean County with pressure washing, soft washing, concrete cleaning, deck and fence restoration, commercial cleaning and seasonal lighting.','published',now(),'Official website + linked Facebook business page','https://eganexteriors.com/about/',now(),'{"discovery":"facebook_and_official_web","facebook_url":"https://www.facebook.com/EgansExteriorServices","service_area_business":true}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,website=excluded.website,description=excluded.description,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,attributes=public.businesses.attributes||excluded.attributes,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_pressure,true) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_bloomington) on conflict do nothing;
  insert into public.business_service_areas(business_id,location_id) values(v_business,v_normal) on conflict do nothing;

  insert into public.businesses(tenant_id,slug,name,primary_location_id,phone,email,website,description,status,published_at,address_text,source_name,source_url,source_checked_at,attributes)
  values(v_tenant,'charterwood-handyman-bloomington','Charterwood Handyman',v_bloomington,'309-200-7309','travis@charterwoodhandyman.com','https://charterwoodhandyman.com/','Locally owned Bloomington handyman service providing home repairs, maintenance, carpentry, drywall, doors, flooring, fencing, accessibility improvements and smaller remodeling projects.','published',now(),'19150 Meander Way, Bloomington, IL 61705','Official website','https://charterwoodhandyman.com/',now(),'{"discovery":"social_public_web"}'::jsonb)
  on conflict (tenant_id,slug) do update set phone=excluded.phone,email=excluded.email,website=excluded.website,description=excluded.description,address_text=excluded.address_text,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now()
  returning id into v_business;
  insert into public.business_categories(business_id,category_id,is_primary) values(v_business,v_handyman,true) on conflict do nothing;
  insert into public.business_locations(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,email,source_name,source_url,source_checked_at)
  values(v_tenant,v_business,v_bloomington,'Bloomington location','office',true,true,false,'19150 Meander Way','Bloomington','IL','61705','309-200-7309','travis@charterwoodhandyman.com','Official website','https://charterwoodhandyman.com/',now()) on conflict do nothing;

  update public.businesses
  set attributes=coalesce(attributes,'{}'::jsonb)||'{"facebook_reviews_url":"https://www.facebook.com/pg/amgpressurewashingcom-1784757821779746/reviews/?ref=page_internal","discovery":"facebook_and_official_web"}'::jsonb,source_checked_at=now(),updated_at=now()
  where tenant_id=v_tenant and slug='amg-pressure-washing-bloomington';
end $$;
