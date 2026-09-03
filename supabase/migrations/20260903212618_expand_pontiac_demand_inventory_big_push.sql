-- Expand Pontiac inventory from current official/local sources while preserving physical-office vs service-area semantics.

insert into public.business_categories (business_id, category_id)
select b.id, c.id from public.businesses b join public.categories c on c.tenant_id=b.tenant_id and c.slug='burgers'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='pub-13-pontiac'
on conflict do nothing;

insert into public.business_categories (business_id, category_id)
select b.id, c.id from public.businesses b join public.categories c on c.tenant_id=b.tenant_id and c.slug='bakeries-desserts'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='the-cup-and-the-scone'
on conflict do nothing;

insert into public.business_categories (business_id, category_id)
select b.id, c.id from public.businesses b join public.categories c on c.tenant_id=b.tenant_id and c.slug='bankruptcy'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='johnson-taylor-law-pontiac'
on conflict do nothing;

insert into public.business_service_areas (business_id, location_id)
select b.id,l.id from public.businesses b
join public.locations l on l.tenant_id=b.tenant_id and l.slug='pontiac' and l.is_active=true
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='pioletti-pioletti-nichols'
and not exists(select 1 from public.business_service_areas x where x.business_id=b.id and x.location_id=l.id);

insert into public.businesses
(tenant_id,slug,name,abbr,primary_location_id,phone,email,website,description,verified,claimed,status,published_at,address_text,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'ryan-rich-turf-management-pontiac','Ryan Rich Turf Management','RR',l.id,
'815-867-6848','rprich25@yahoo.com','https://ryanrichturf.com/','Pontiac-based lawn maintenance and landscaping company serving residential and commercial customers across central and north central Illinois.',false,false,'published',now(),'17752 N 1750 E Rd, Pontiac, IL 61764','Ryan Rich Turf Management','https://ryanrichturf.com/',now()
from public.locations l where l.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and l.slug='pontiac' and l.is_active=true
on conflict (tenant_id,slug) do nothing;

insert into public.businesses
(tenant_id,slug,name,abbr,primary_location_id,phone,website,description,verified,claimed,status,published_at,address_text,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'chief-city-property-maintenance-pontiac','Chief City Property Maintenance','CC',l.id,
'815-842-3337','https://www.chiefcitypropertymaintenance.com/services','Pontiac property-maintenance company providing lawn care, landscaping, tree services, hardscaping, yard cleanup and related exterior services.',false,false,'published',now(),'1130 E Howard St, Pontiac, IL 61764','Chief City Property Maintenance','https://www.chiefcitypropertymaintenance.com/services',now()
from public.locations l where l.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and l.slug='pontiac' and l.is_active=true
on conflict (tenant_id,slug) do nothing;

insert into public.businesses
(tenant_id,slug,name,abbr,primary_location_id,phone,website,description,verified,claimed,status,published_at,address_text,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'smiths-plumbing-heating-ac-pontiac','Smith''s Plumbing, Heating & A/C, Inc.','SP',l.id,
'815-844-7868','https://smithsplumbingandheatingil.com/','Long-established Pontiac plumbing, heating and air-conditioning contractor providing plumbing, HVAC, water-heater and related home-service work.',false,false,'published',now(),'822 E Howard St, Pontiac, IL 61764','Smith''s Plumbing, Heating & A/C, Inc.','https://smithsplumbingandheatingil.com/',now()
from public.locations l where l.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and l.slug='pontiac' and l.is_active=true
on conflict (tenant_id,slug) do nothing;

insert into public.businesses
(tenant_id,slug,name,abbr,primary_location_id,website,phone,email,description,verified,claimed,status,published_at,address_text,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'endzone-bar-grill-pontiac','Endzone Bar & Grill','EB',l.id,
'https://endzonepontiac.com/','815-844-2855','endzonepontiac@gmail.com','Pontiac bar and grill serving classic American food including half-pound burgers, wings, sandwiches, pizzas and other bar favorites.',false,false,'published',now(),'603 S Deerfield Rd, Pontiac, IL 61764','Endzone Bar & Grill','https://endzonepontiac.com/',now()
from public.locations l where l.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and l.slug='pontiac' and l.is_active=true
on conflict (tenant_id,slug) do nothing;

insert into public.businesses
(tenant_id,slug,name,abbr,primary_location_id,description,verified,claimed,status,published_at,address_text,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'joes-tasty-treats-pontiac','Joe''s Tasty Treats','JT',l.id,
'Downtown Pontiac dessert business listed separately in the official Downtown Pontiac business directory.',false,false,'published',now(),'721 W Washington St, Pontiac, IL 61764','Downtown Pontiac Business Directory','https://downtownpontiacil.com/businessdirectory/',now()
from public.locations l where l.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and l.slug='pontiac' and l.is_active=true
on conflict (tenant_id,slug) do nothing;

insert into public.businesses
(tenant_id,slug,name,abbr,phone,description,verified,claimed,status,published_at,address_text,source_name,source_url,source_checked_at)
values
('6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'honest-jons-fbi-handyman-service','Honest Jons FBI Handyman Service','HJ',null,'Handyman provider listed by Angi/HomeAdvisor as serving Pontiac and surrounding areas for multiple small home projects.',false,false,'published',now(),'2223 West Westport Road, Peoria, IL 61615','Angi','https://www.angi.com/companylist/us/il/peoria/honest-jons-fbi-handyman-service-reviews-1.htm',now()),
('6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'wilson-services-handyman-pontiac-service-area','Wilson Services','WS',null,'Handyman provider currently listed by HomeAdvisor as serving Pontiac and surrounding areas for small and large handyman projects.',false,false,'published',now(),null,'HomeAdvisor','https://www.homeadvisor.com/c.Handyman-Services.Pontiac.IL.-12039.html',now()),
('6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'just-about-everything-handyman-pontiac-service-area','Just About Everything','JE',null,'Handyman and home-maintenance provider currently listed by Angi/HomeAdvisor as serving Pontiac and surrounding areas.',false,false,'published',now(),null,'Angi','https://www.angi.com/companylist/us/il/pontiac/plumbing-handymen.htm',now())
on conflict (tenant_id,slug) do nothing;

insert into public.business_locations
(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
select b.tenant_id,b.id,l.id,'Pontiac','office',true,true,false,b.address_text,'Pontiac','IL','61764',b.phone,b.source_name,b.source_url,now()
from public.businesses b join public.locations l on l.tenant_id=b.tenant_id and l.slug='pontiac' and l.is_active=true
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
and b.slug in ('ryan-rich-turf-management-pontiac','chief-city-property-maintenance-pontiac','smiths-plumbing-heating-ac-pontiac','endzone-bar-grill-pontiac','joes-tasty-treats-pontiac')
and not exists(select 1 from public.business_locations x where x.tenant_id=b.tenant_id and x.business_id=b.id and x.location_id=l.id and x.is_active=true);

insert into public.business_service_areas (business_id,location_id)
select b.id,l.id from public.businesses b join public.locations l on l.tenant_id=b.tenant_id and l.slug='pontiac' and l.is_active=true
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
and b.slug in ('honest-jons-fbi-handyman-service','wilson-services-handyman-pontiac-service-area','just-about-everything-handyman-pontiac-service-area')
and not exists(select 1 from public.business_service_areas x where x.business_id=b.id and x.location_id=l.id);

insert into public.business_categories (business_id,category_id)
select b.id,c.id from public.businesses b join public.categories c on c.tenant_id=b.tenant_id
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and (
(b.slug='ryan-rich-turf-management-pontiac' and c.slug in ('lawn-care','landscaping')) or
(b.slug='chief-city-property-maintenance-pontiac' and c.slug in ('lawn-care','landscaping','tree-services')) or
(b.slug='smiths-plumbing-heating-ac-pontiac' and c.slug in ('plumbing','hvac')) or
(b.slug='endzone-bar-grill-pontiac' and c.slug in ('burgers','american-restaurants','bars-pubs')) or
(b.slug='joes-tasty-treats-pontiac' and c.slug='bakeries-desserts') or
(b.slug in ('honest-jons-fbi-handyman-service','wilson-services-handyman-pontiac-service-area','just-about-everything-handyman-pontiac-service-area') and c.slug='handyman'))
on conflict do nothing;
