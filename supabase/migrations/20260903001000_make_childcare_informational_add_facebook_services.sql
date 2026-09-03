-- Childcare becomes informational-only and a source-backed Facebook/public-web service batch is added.
-- Imported businesses are not auto-claimed, verified, featured, sponsored, or assigned fabricated ratings/reviews.

do $categories$
declare
  t constant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
begin
  update public.categories
     set is_active=false
   where tenant_id=t and slug='childcare-providers';

  insert into public.categories (tenant_id,vertical,slug,name,is_active) values
    (t,'home','pressure-washing','Pressure Washing',true),
    (t,'home','handyman','Handyman Services',true),
    (t,'home','carpet-cleaning','Carpet Cleaning',true),
    (t,'other','auto-detailing','Auto Detailing',true),
    (t,'other','recycling-disposal','Recycling & Disposal',true)
  on conflict (tenant_id,slug) do update
    set vertical=excluded.vertical,name=excluded.name,is_active=true;

  insert into public.lead_pricing_rules
    (tenant_id,vertical,category_id,name,base_price_cents,sale_mode,max_buyers,monetization_mode,is_active)
  select t,'other',c.id,c.name||' — directory matching; paid lead sales disabled',0,'exclusive',1,'disabled',true
    from public.categories c
   where c.tenant_id=t and c.slug in ('auto-detailing','recycling-disposal')
  on conflict (tenant_id,vertical,category_id) do update set
    name=excluded.name,base_price_cents=0,sale_mode='exclusive',max_buyers=1,
    monetization_mode='disabled',is_active=true,updated_at=now();
end $categories$;

create or replace function public.submit_directory_lead(
  p_tenant_id uuid,
  p_business_id uuid,
  p_service text,
  p_city text,
  p_consumer_name text,
  p_phone text,
  p_email text,
  p_message text default null::text,
  p_timeline text default null::text,
  p_consent_to_contact boolean default false
) returns uuid
language plpgsql
set search_path to ''
as $function$
declare v_id uuid;
begin
  if lower(trim(coalesce(p_service,''))) in ('childcare','child care','childcare providers','daycare','day care','babysitting','babysitter','nanny') then
    raise exception 'Central Illinois Local Pros does not collect childcare requests. Use the informational Childcare Resources page and official provider-search resources.';
  end if;
  if not p_consent_to_contact then raise exception 'contact consent is required'; end if;
  if char_length(trim(coalesce(p_service,''))) < 2 or char_length(trim(coalesce(p_city,''))) < 2 then raise exception 'service and city are required'; end if;
  if char_length(trim(coalesce(p_consumer_name,''))) < 2 then raise exception 'name is required'; end if;
  if position('@' in coalesce(p_email,'')) < 2 then raise exception 'valid email required'; end if;
  insert into public.leads(tenant_id,business_id,assigned_business_id,service,city,consumer_name,phone,email,message,timeline,status,notes,consumer_user_id,consent_to_contact,source,consent_disclosure_version,consent_recorded_at)
  values(p_tenant_id,p_business_id,null,trim(p_service),trim(p_city),trim(p_consumer_name),trim(p_phone),trim(p_email),nullif(trim(p_message),''),nullif(trim(p_timeline),''),'new',null,(select auth.uid()),true,'directory_quote_form','lead-sharing-v1-2026-09',now())
  returning id into v_id;
  return v_id;
end; $function$;

with service_businesses(slug,name,phone,email,website,description,address_text,city,postal_code,source_name,source_url,profile_score,attributes) as (
  values
  ('reliable-handyman-services-springfield','Reliable Handyman Services Inc.','217-860-7436',null,'https://www.reliablehandymanservices.net/','Springfield-area handyman and home-improvement company offering repairs, decks, fencing, flooring, painting and remodeling.','2975 Stanton St, Springfield, IL 62703','Springfield','62703','Reliable Handyman Services Inc.','https://www.reliablehandymanservices.net/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true}'::jsonb),
  ('that-one-guy-junk-removal-springfield','That One Guy Junk Removal & Dumpster Rentals','217-553-6529','Christopherharmening@yahoo.com','https://thatoneguyjunk.com/','Locally operated Springfield junk-removal, property-cleanout and dumpster-rental service for residential and commercial cleanup projects.','3131 S 3rd St, Springfield, IL 62703','Springfield','62703','That One Guy Junk Removal & Dumpster Rentals','https://thatoneguyjunk.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_url":"https://www.facebook.com/ThatOneGuyJunkRemoval/"}'::jsonb),
  ('golden-rule-cleaning-springfield','Golden Rule Cleaning & More','217-819-1607','springfield@goldenrulecleaningandmore.com','https://goldenrulecleaningandmore.com/','Locally owned Springfield cleaning company providing residential, commercial, move-in/move-out and related home-service work across Central Illinois.','386 S Koke Mill, Suite D, Springfield, IL','Springfield',null,'Golden Rule Cleaning & More','https://goldenrulecleaningandmore.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_url":"https://www.facebook.com/youcantcleantoomuch/"}'::jsonb),
  ('amg-pressure-washing-bloomington','AMG Pressure Washing','309-660-8974','antonioguerra252@gmail.com','https://www.amgpressurewashing.com/','Locally owned Bloomington residential and commercial pressure-washing and soft-washing contractor offering house, roof, concrete, deck, fence and commercial exterior cleaning.','7281 N 1750 East Road, Bloomington, IL 61705','Bloomington','61705','AMG Pressure Washing','https://www.amgpressurewashing.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true}'::jsonb),
  ('power-wash-services-bloomington','Power Wash Services, Inc.','309-827-3846','tjnpws@aol.com','https://powerwashservices.com/','Bloomington exterior-cleaning company providing pressure washing, protective coatings, deck refinishing and related residential and commercial cleaning services.','211 N Clinton St, Bloomington, IL 61701','Bloomington','61701','Power Wash Services, Inc.','https://powerwashservices.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true}'::jsonb),
  ('topkat-cleaning-decatur','TopKat Cleaning','217-791-4135','info@topkatcleaning.com','https://www.topkatcleaning.com/','Decatur cleaning specialist offering carpet, floor, tile, rug, furniture and related residential and commercial cleaning services.','2218 E Logan St, Decatur, IL 62526','Decatur','62526','TopKat Cleaning','https://www.topkatcleaning.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true}'::jsonb),
  ('anything-goes-hauling-springfield','Anything Goes Hauling','217-529-1601',null,'https://anythinggoesspringfield.com/','Family-owned Springfield-area junk-removal and hauling service handling residential and commercial cleanouts, debris, donation hauling and light demolition.',null,'Springfield',null,'Anything Goes Hauling','https://anythinggoesspringfield.com/',60,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true,"service_area_business":true}'::jsonb),
  ('go-green-commercial-clean-bloomington','Go Green Commercial Clean','309-585-0423','info@gogreencommercialclean.com','https://www.gogreencommercialclean.com/','Bloomington cleaning company offering residential and commercial cleaning, carpet cleaning, power washing, upholstery cleaning, construction cleaning and junk removal.','503 N Prospect Rd, Suite 309, Bloomington, IL 61704','Bloomington','61704','Go Green Commercial Clean','https://www.gogreencommercialclean.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true}'::jsonb),
  ('attention-to-detail-309-bloomington','Attention To Detail 309','309-287-5778','ShooksAutomotiveServices@gmail.com','https://www.attentiontodetail309.com/','Bloomington auto-detailing shop serving local car, camper and boating customers with professional detailing and restoration-focused vehicle care.','807 S Morris Ave, Bloomington, IL 61701','Bloomington','61701','Attention To Detail 309','https://www.attentiontodetail309.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true}'::jsonb),
  ('yamanda-cleaning-service-morris','Yamanda Cleaning Service LLC','815-513-5678','info@yamandacleaningservices.com','https://yamandacleaningservice.com/','Morris-based cleaning company offering home, office, business, janitorial, window and post-construction cleaning across Morris and surrounding communities.','519 Franklin St #103, Morris, IL 60450','Morris','60450','Yamanda Cleaning Service LLC','https://yamandacleaningservice.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true}'::jsonb),
  ('gems-carpet-cleaning-plus-pontiac','Gem''s Carpet Cleaning Plus, L.L.C.','815-844-4424','gemsccp@frontier.com','https://gemscarpetcleaningplusreviews.com/','Pontiac carpet-cleaning specialist providing carpet, grout, tile, upholstery, pet-odor, floor-care and water-damage cleaning services.','1320 N Main St, Pontiac, IL 61764','Pontiac','61764','Gem''s Carpet Cleaning Plus, L.L.C.','https://gemscarpetcleaningplusreviews.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true}'::jsonb),
  ('gloss-spot-auto-detailing-champaign','The Gloss Spot Auto Detailing','217-600-2108','theglossspotil@gmail.com','https://www.theglossspotil.com/','Owner-operated Champaign mobile auto-detailing service providing interior and exterior detailing, paint correction, ceramic coating and related vehicle appearance services.',null,'Champaign',null,'The Gloss Spot Auto Detailing','https://www.theglossspotil.com/',60,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_page_confirmed":true,"service_area_business":true}'::jsonb),
  ('gm-recycling-disposal-streator','G&M Recycling & Disposal Inc.','815-673-1211','gmrecyclinganddisposal@hotmail.com','https://gandmrecyclingcenteril.com/','Streator recycling and disposal business specializing in ferrous and non-ferrous scrap metal recycling and approved disposal services for households, contractors and businesses.','1212 E 12th St, Streator, IL 61364','Streator','61364','G&M Recycling & Disposal Inc.','https://gandmrecyclingcenteril.com/',65,'{"business_style":"local_independent","discovery_channel":"public_facebook_and_web_scan","facebook_url":"https://www.facebook.com/p/GM-Recycling-and-Disposal-Inc-100053215735687/"}'::jsonb)
)
insert into public.businesses
  (tenant_id,slug,name,phone,email,website,description,address_text,profile_score,status,published_at,source_name,source_url,source_checked_at,attributes)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,slug,name,phone,email,website,description,address_text,profile_score,'published',now(),source_name,source_url,now(),attributes
from service_businesses
on conflict (tenant_id,slug) do update set
  name=excluded.name,
  phone=coalesce(excluded.phone,businesses.phone),
  email=coalesce(excluded.email,businesses.email),
  website=coalesce(excluded.website,businesses.website),
  description=excluded.description,
  address_text=coalesce(excluded.address_text,businesses.address_text),
  source_name=excluded.source_name,
  source_url=excluded.source_url,
  source_checked_at=excluded.source_checked_at,
  attributes=businesses.attributes || excluded.attributes,
  updated_at=now();

with mappings(bslug,cslug,is_primary) as (values
  ('reliable-handyman-services-springfield','handyman',true),
  ('reliable-handyman-services-springfield','fencing',false),
  ('reliable-handyman-services-springfield','flooring',false),
  ('reliable-handyman-services-springfield','painting',false),
  ('reliable-handyman-services-springfield','remodeling',false),
  ('that-one-guy-junk-removal-springfield','junk-removal',true),
  ('golden-rule-cleaning-springfield','cleaning',true),
  ('golden-rule-cleaning-springfield','handyman',false),
  ('golden-rule-cleaning-springfield','junk-removal',false),
  ('amg-pressure-washing-bloomington','pressure-washing',true),
  ('power-wash-services-bloomington','pressure-washing',true),
  ('power-wash-services-bloomington','cleaning',false),
  ('topkat-cleaning-decatur','carpet-cleaning',true),
  ('topkat-cleaning-decatur','cleaning',false),
  ('anything-goes-hauling-springfield','junk-removal',true),
  ('go-green-commercial-clean-bloomington','cleaning',true),
  ('go-green-commercial-clean-bloomington','pressure-washing',false),
  ('go-green-commercial-clean-bloomington','junk-removal',false),
  ('attention-to-detail-309-bloomington','auto-detailing',true),
  ('yamanda-cleaning-service-morris','cleaning',true),
  ('gems-carpet-cleaning-plus-pontiac','carpet-cleaning',true),
  ('gems-carpet-cleaning-plus-pontiac','cleaning',false),
  ('gloss-spot-auto-detailing-champaign','auto-detailing',true),
  ('gm-recycling-disposal-streator','recycling-disposal',true)
)
insert into public.business_categories(business_id,category_id,is_primary)
select b.id,c.id,m.is_primary
from mappings m
join public.businesses b on b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug=m.bslug
join public.categories c on c.tenant_id=b.tenant_id and c.slug=m.cslug
on conflict (business_id,category_id) do update set is_primary=excluded.is_primary;

with locdata(bslug,label,location_type,address_text,city,postal_code,phone,email,source_url) as (values
  ('reliable-handyman-services-springfield','Main location','service_center','2975 Stanton St, Springfield, IL 62703','Springfield','62703','217-860-7436',null,'https://www.reliablehandymanservices.net/'),
  ('that-one-guy-junk-removal-springfield','Main location','service_center','3131 S 3rd St, Springfield, IL 62703','Springfield','62703','217-553-6529','Christopherharmening@yahoo.com','https://thatoneguyjunk.com/'),
  ('golden-rule-cleaning-springfield','Main location','office','386 S Koke Mill, Suite D, Springfield, IL','Springfield',null,'217-819-1607','springfield@goldenrulecleaningandmore.com','https://goldenrulecleaningandmore.com/'),
  ('amg-pressure-washing-bloomington','Main location','service_center','7281 N 1750 East Road, Bloomington, IL 61705','Bloomington','61705','309-660-8974','antonioguerra252@gmail.com','https://www.amgpressurewashing.com/'),
  ('power-wash-services-bloomington','Main location','service_center','211 N Clinton St, Bloomington, IL 61701','Bloomington','61701','309-827-3846','tjnpws@aol.com','https://powerwashservices.com/'),
  ('topkat-cleaning-decatur','Main location','storefront','2218 E Logan St, Decatur, IL 62526','Decatur','62526','217-791-4135','info@topkatcleaning.com','https://www.topkatcleaning.com/'),
  ('go-green-commercial-clean-bloomington','Main location','office','503 N Prospect Rd, Suite 309, Bloomington, IL 61704','Bloomington','61704','309-585-0423','info@gogreencommercialclean.com','https://www.gogreencommercialclean.com/'),
  ('attention-to-detail-309-bloomington','Main location','service_center','807 S Morris Ave, Bloomington, IL 61701','Bloomington','61701','309-287-5778','ShooksAutomotiveServices@gmail.com','https://www.attentiontodetail309.com/'),
  ('yamanda-cleaning-service-morris','Main location','office','519 Franklin St #103, Morris, IL 60450','Morris','60450','815-513-5678','info@yamandacleaningservices.com','https://yamandacleaningservice.com/'),
  ('gems-carpet-cleaning-plus-pontiac','Main location','service_center','1320 N Main St, Pontiac, IL 61764','Pontiac','61764','815-844-4424','gemsccp@frontier.com','https://gemscarpetcleaningplusreviews.com/'),
  ('gm-recycling-disposal-streator','Main location','shop','1212 E 12th St, Streator, IL 61364','Streator','61364','815-673-1211','gmrecyclinganddisposal@hotmail.com','https://gandmrecyclingcenteril.com/')
)
update public.business_locations bl
set label=l.label,location_type=l.location_type,address_text=l.address_text,city=l.city,state='IL',postal_code=l.postal_code,
    phone=l.phone,email=l.email,source_name=b.name,source_url=l.source_url,source_checked_at=now(),updated_at=now()
from locdata l
join public.businesses b on b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug=l.bslug
where bl.business_id=b.id and bl.is_primary=true and bl.is_active=true;

with locdata(bslug,label,location_type,address_text,city,postal_code,phone,email,source_url) as (values
  ('reliable-handyman-services-springfield','Main location','service_center','2975 Stanton St, Springfield, IL 62703','Springfield','62703','217-860-7436',null,'https://www.reliablehandymanservices.net/'),
  ('that-one-guy-junk-removal-springfield','Main location','service_center','3131 S 3rd St, Springfield, IL 62703','Springfield','62703','217-553-6529','Christopherharmening@yahoo.com','https://thatoneguyjunk.com/'),
  ('golden-rule-cleaning-springfield','Main location','office','386 S Koke Mill, Suite D, Springfield, IL','Springfield',null,'217-819-1607','springfield@goldenrulecleaningandmore.com','https://goldenrulecleaningandmore.com/'),
  ('amg-pressure-washing-bloomington','Main location','service_center','7281 N 1750 East Road, Bloomington, IL 61705','Bloomington','61705','309-660-8974','antonioguerra252@gmail.com','https://www.amgpressurewashing.com/'),
  ('power-wash-services-bloomington','Main location','service_center','211 N Clinton St, Bloomington, IL 61701','Bloomington','61701','309-827-3846','tjnpws@aol.com','https://powerwashservices.com/'),
  ('topkat-cleaning-decatur','Main location','storefront','2218 E Logan St, Decatur, IL 62526','Decatur','62526','217-791-4135','info@topkatcleaning.com','https://www.topkatcleaning.com/'),
  ('go-green-commercial-clean-bloomington','Main location','office','503 N Prospect Rd, Suite 309, Bloomington, IL 61704','Bloomington','61704','309-585-0423','info@gogreencommercialclean.com','https://www.gogreencommercialclean.com/'),
  ('attention-to-detail-309-bloomington','Main location','service_center','807 S Morris Ave, Bloomington, IL 61701','Bloomington','61701','309-287-5778','ShooksAutomotiveServices@gmail.com','https://www.attentiontodetail309.com/'),
  ('yamanda-cleaning-service-morris','Main location','office','519 Franklin St #103, Morris, IL 60450','Morris','60450','815-513-5678','info@yamandacleaningservices.com','https://yamandacleaningservice.com/'),
  ('gems-carpet-cleaning-plus-pontiac','Main location','service_center','1320 N Main St, Pontiac, IL 61764','Pontiac','61764','815-844-4424','gemsccp@frontier.com','https://gemscarpetcleaningplusreviews.com/'),
  ('gm-recycling-disposal-streator','Main location','shop','1212 E 12th St, Streator, IL 61364','Streator','61364','815-673-1211','gmrecyclinganddisposal@hotmail.com','https://gandmrecyclingcenteril.com/')
)
insert into public.business_locations
  (tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,email,source_name,source_url,source_checked_at)
select b.tenant_id,b.id,lcity.id,l.label,l.location_type,true,true,false,l.address_text,l.city,'IL',l.postal_code,l.phone,l.email,b.name,l.source_url,now()
from locdata l
join public.businesses b on b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug=l.bslug
left join public.locations lcity on lcity.tenant_id=b.tenant_id and lcity.type='city' and lower(lcity.name)=lower(l.city)
where not exists (select 1 from public.business_locations x where x.business_id=b.id and x.is_primary=true and x.is_active=true);

with areas(bslug,city) as (values
  ('reliable-handyman-services-springfield','Springfield'),
  ('that-one-guy-junk-removal-springfield','Springfield'),('that-one-guy-junk-removal-springfield','Lincoln'),
  ('golden-rule-cleaning-springfield','Springfield'),
  ('amg-pressure-washing-bloomington','Bloomington'),('amg-pressure-washing-bloomington','Normal'),('amg-pressure-washing-bloomington','Peoria'),
  ('power-wash-services-bloomington','Bloomington'),('power-wash-services-bloomington','Normal'),
  ('topkat-cleaning-decatur','Decatur'),
  ('anything-goes-hauling-springfield','Springfield'),
  ('go-green-commercial-clean-bloomington','Bloomington'),('go-green-commercial-clean-bloomington','Peoria'),('go-green-commercial-clean-bloomington','Champaign'),
  ('attention-to-detail-309-bloomington','Bloomington'),('attention-to-detail-309-bloomington','Normal'),
  ('yamanda-cleaning-service-morris','Morris'),('yamanda-cleaning-service-morris','Ottawa'),
  ('gems-carpet-cleaning-plus-pontiac','Pontiac'),
  ('gloss-spot-auto-detailing-champaign','Champaign'),('gloss-spot-auto-detailing-champaign','Urbana'),
  ('gm-recycling-disposal-streator','Streator'),('gm-recycling-disposal-streator','Ottawa'),('gm-recycling-disposal-streator','Pontiac')
)
insert into public.business_service_areas(business_id,location_id)
select b.id,l.id
from areas a
join public.businesses b on b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug=a.bslug
join public.locations l on l.tenant_id=b.tenant_id and l.type='city' and lower(l.name)=lower(a.city)
on conflict do nothing;
