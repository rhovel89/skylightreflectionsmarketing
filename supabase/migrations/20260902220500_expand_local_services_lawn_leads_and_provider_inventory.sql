-- Expands public inventory with source-backed local providers and adds a privacy-first
-- Local Services taxonomy. No imported business is marked claimed, verified or featured.
-- Lawn Care uses the existing paid-lead architecture but requires manual pricing before sale.

do $$
declare
  t uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
  lawn uuid; pet uuid; mobile_pet uuid; childcare uuid;
begin
  insert into public.categories (tenant_id,vertical,slug,name,is_active) values
    (t,'home','lawn-care','Lawn Care',true),
    (t,'other','pet-grooming','Pet Grooming',true),
    (t,'other','mobile-pet-grooming','Mobile Pet Grooming',true),
    (t,'other','childcare-providers','Childcare Providers',true)
  on conflict (tenant_id,slug) do update set name=excluded.name,vertical=excluded.vertical,is_active=true;

  update public.categories set is_active=true
  where tenant_id=t and slug in ('bankruptcy','estate-planning','real-estate-law','workers-compensation');

  select id into lawn from public.categories where tenant_id=t and slug='lawn-care';
  select id into pet from public.categories where tenant_id=t and slug='pet-grooming';
  select id into mobile_pet from public.categories where tenant_id=t and slug='mobile-pet-grooming';
  select id into childcare from public.categories where tenant_id=t and slug='childcare-providers';

  insert into public.lead_pricing_rules
    (tenant_id,vertical,category_id,name,base_price_cents,sale_mode,max_buyers,monetization_mode,is_active) values
    (t,'home',lawn,'Lawn Care — pay per lead, manual price before offer',0,'exclusive',1,'lead_sale',true),
    (t,'other',childcare,'Childcare — provider matching only; paid lead sales disabled',0,'exclusive',1,'disabled',true),
    (t,'other',pet,'Pet Grooming — directory matching; paid lead sales disabled by default',0,'exclusive',1,'disabled',true),
    (t,'other',mobile_pet,'Mobile Pet Grooming — directory matching; paid lead sales disabled by default',0,'exclusive',1,'disabled',true)
  on conflict (tenant_id,vertical,category_id) do update set
    name=excluded.name,base_price_cents=excluded.base_price_cents,sale_mode=excluded.sale_mode,
    max_buyers=excluded.max_buyers,monetization_mode=excluded.monetization_mode,
    is_active=excluded.is_active,updated_at=now();
end $$;

insert into public.businesses
(tenant_id,slug,name,phone,website,description,rating,review_count,verified,featured,claimed,profile_score,status,published_at,address_text,source_name,source_url,source_checked_at,attributes) values
('6673621d-b359-4c17-a984-c8f50d914eb3','paws-up-pet-grooming-normal','Paws Up Pet Grooming','309-808-0389','https://pawsuppetgrooming.com/','Independent dog and cat grooming in Normal, Illinois, with grooming and small-dog daycare services.',0,0,false,false,false,70,'published',now(),'507 Pine St, Normal, IL 61761','Paws Up Pet Grooming','https://pawsuppetgrooming.com/',now(),'{"business_style":"local_independent"}'::jsonb),
('6673621d-b359-4c17-a984-c8f50d914eb3','groomingdales-pet-salon-peoria','Groomingdales Pet Salon','309-613-0225','https://www.facebook.com/Groomingdales-Pet-Salon-119922524742487/','Locally owned Peoria pet grooming salon with a public Facebook presence.',0,0,false,false,false,62,'published',now(),'3203 N Prospect Rd, Peoria, IL 61603','Public business directory / Facebook','https://www.dogdog.org/pet-groomer/groomingdales-pet-salon-peoria',now(),'{"business_style":"local_independent","facebook_primary":true}'::jsonb),
('6673621d-b359-4c17-a984-c8f50d914eb3','wright-touch-grooming-pontiac','Wright Touch Grooming','815-674-3897',null,'Small local pet grooming provider serving Pontiac, Illinois.',0,0,false,false,false,55,'published',now(),'320 W Grant Ave, Pontiac, IL 61764','Google Business Profile',null,now(),'{"business_style":"local_independent","women_owned_publicly_reported":true}'::jsonb),
('6673621d-b359-4c17-a984-c8f50d914eb3','magic-paws-pet-grooming-lincoln','Magic Paws Pet Grooming','217-737-9455',null,'Small pet grooming service serving the Lincoln and Atlanta area, with public listings describing mobile grooming service.',0,0,false,false,false,55,'published',now(),null,'Google Business Profile',null,now(),'{"business_style":"local_independent","mobile_service_publicly_reported":true}'::jsonb),
('6673621d-b359-4c17-a984-c8f50d914eb3','star-lawn-care-bloomington-normal','Star Lawn Care LLC','309-242-3956',null,'Locally owned owner-operated lawn care and snow removal service serving Bloomington-Normal.',0,0,false,false,false,58,'published',now(),null,'Google Business Profile',null,now(),'{"business_style":"owner_operator","service_area":"Bloomington-Normal"}'::jsonb),
('6673621d-b359-4c17-a984-c8f50d914eb3','beckers-lawn-care-landscaping-pontiac','Beckers Lawn Care & Landscaping, LLC','815-823-3599',null,'Family-run Pontiac lawn care and landscaping provider serving residential and commercial properties.',0,0,false,false,false,60,'published',now(),'Pontiac, IL 61764','Yellow Pages','https://www.yellowpages.com/pontiac-il/mip/beckers-lawn-care-landscaping-llc-552444366',now(),'{"business_style":"owner_operator","founded_publicly_reported":1998}'::jsonb),
('6673621d-b359-4c17-a984-c8f50d914eb3','peoria-lawn','Peoria Lawn','309-676-2224',null,'Local Greater Peoria lawn care business providing mowing, trimming, edging, cleanup and seasonal property services.',0,0,false,false,false,60,'published',now(),'4201 W Pfeiffer Rd, Bartonville, IL 61607','Google Business Profile',null,now(),'{"business_style":"local_independent","service_area":"Greater Peoria"}'::jsonb),
('6673621d-b359-4c17-a984-c8f50d914eb3','johnson-taylor-law-pontiac','Johnson & Taylor','815-844-7151','https://jntlaw.com/','Pontiac law firm serving Central Illinois with estate planning, real estate, agricultural, probate and related legal services.',0,0,false,false,false,72,'published',now(),'109 N Mill St, Pontiac, IL 61764','Johnson & Taylor','https://jntlaw.com/',now(),'{"business_style":"local_independent"}'::jsonb),
('6673621d-b359-4c17-a984-c8f50d914eb3','pioletti-pioletti-nichols','Pioletti Pioletti & Nichols','309-821-0246','https://piolettilaw.com/','Family-rooted Illinois law firm handling personal injury, bankruptcy, criminal defense, family law and related matters from multiple Central Illinois offices.',0,0,false,false,false,75,'published',now(),'401 Main St, Suite 103, Peoria, IL 61602','Pioletti Pioletti & Nichols','https://piolettilaw.com/',now(),'{"business_style":"family_practice","multi_location":true}'::jsonb),
('6673621d-b359-4c17-a984-c8f50d914eb3','law-office-david-hunt-peoria','The Law Office of David Hunt','309-220-5313','https://davidhuntlaw.com/','Peoria law office focused on workers’ compensation and personal injury matters throughout Central Illinois.',0,0,false,false,false,72,'published',now(),'245 NE Perry Ave, Peoria, IL 61603','The Law Office of David Hunt','https://davidhuntlaw.com/',now(),'{"business_style":"local_independent"}'::jsonb)
on conflict (tenant_id,slug) do update set
name=excluded.name,phone=excluded.phone,website=excluded.website,description=excluded.description,
address_text=excluded.address_text,source_name=excluded.source_name,source_url=excluded.source_url,
source_checked_at=excluded.source_checked_at,attributes=public.businesses.attributes||excluded.attributes,status='published',updated_at=now();

insert into public.business_categories (business_id,category_id,is_primary)
select b.id,c.id,x.is_primary from (values
('paws-up-pet-grooming-normal','pet-grooming',true),('groomingdales-pet-salon-peoria','pet-grooming',true),('wright-touch-grooming-pontiac','pet-grooming',true),('magic-paws-pet-grooming-lincoln','mobile-pet-grooming',true),('magic-paws-pet-grooming-lincoln','pet-grooming',false),('star-lawn-care-bloomington-normal','lawn-care',true),('beckers-lawn-care-landscaping-pontiac','lawn-care',true),('beckers-lawn-care-landscaping-pontiac','landscaping',false),('peoria-lawn','lawn-care',true),('johnson-taylor-law-pontiac','estate-planning',true),('johnson-taylor-law-pontiac','real-estate-law',false),('pioletti-pioletti-nichols','personal-injury',true),('pioletti-pioletti-nichols','bankruptcy',false),('pioletti-pioletti-nichols','criminal-defense',false),('pioletti-pioletti-nichols','family-law',false),('law-office-david-hunt-peoria','workers-compensation',true),('law-office-david-hunt-peoria','personal-injury',false)) x(bslug,cslug,is_primary)
join public.businesses b on b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3' and b.slug=x.bslug
join public.categories c on c.tenant_id=b.tenant_id and c.slug=x.cslug
on conflict (business_id,category_id) do update set is_primary=excluded.is_primary;

insert into public.business_locations
(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3',b.id,l.id,x.label,x.location_type,x.is_primary,true,false,x.address_text,x.city,'IL',x.postal_code,x.phone,x.source_name,x.source_url,now()
from (values
('paws-up-pet-grooming-normal','Normal','Main location','shop',true,'507 Pine St, Normal, IL 61761','61761','309-808-0389','Paws Up Pet Grooming','https://pawsuppetgrooming.com/'),
('groomingdales-pet-salon-peoria','Peoria','Main location','shop',true,'3203 N Prospect Rd, Peoria, IL 61603','61603','309-613-0225','Public business directory / Facebook','https://www.dogdog.org/pet-groomer/groomingdales-pet-salon-peoria'),
('wright-touch-grooming-pontiac','Pontiac','Main location','shop',true,'320 W Grant Ave, Pontiac, IL 61764','61764','815-674-3897','Google Business Profile',null),
('magic-paws-pet-grooming-lincoln','Lincoln','Lincoln service area','other',true,null,null,'217-737-9455','Google Business Profile',null),
('star-lawn-care-bloomington-normal','Bloomington','Bloomington-Normal service area','other',true,null,null,'309-242-3956','Google Business Profile',null),
('beckers-lawn-care-landscaping-pontiac','Pontiac','Pontiac service area','other',true,null,'61764','815-823-3599','Yellow Pages','https://www.yellowpages.com/pontiac-il/mip/beckers-lawn-care-landscaping-llc-552444366'),
('peoria-lawn','Peoria','Greater Peoria service area','other',true,null,null,'309-676-2224','Google Business Profile',null),
('johnson-taylor-law-pontiac','Pontiac','Main office','office',true,'109 N Mill St, Pontiac, IL 61764','61764','815-844-7151','Johnson & Taylor','https://jntlaw.com/'),
('pioletti-pioletti-nichols','Peoria','Peoria office','office',true,'401 Main St, Suite 103, Peoria, IL 61602','61602','309-821-0246','Pioletti Pioletti & Nichols','https://piolettilaw.com/'),
('pioletti-pioletti-nichols','Bloomington','Bloomington office','office',false,'121 N Main St, Bloomington, IL 61701','61701','309-821-0246','Pioletti Pioletti & Nichols','https://piolettilaw.com/contact-us/'),
('pioletti-pioletti-nichols','Springfield','Springfield office','office',false,'1 W Old State Capitol Plz Ste 721, Springfield, IL 62701','62701','309-821-0246','Pioletti Pioletti & Nichols','https://piolettilaw.com/'),
('law-office-david-hunt-peoria','Peoria','Main office','office',true,'245 NE Perry Ave, Peoria, IL 61603','61603','309-220-5313','The Law Office of David Hunt','https://davidhuntlaw.com/contact/')) x(bslug,city,label,location_type,is_primary,address_text,postal_code,phone,source_name,source_url)
join public.businesses b on b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3' and b.slug=x.bslug
left join public.locations l on l.tenant_id=b.tenant_id and lower(l.name)=lower(x.city) and l.state='IL'
where not exists (select 1 from public.business_locations bl where bl.business_id=b.id and lower(coalesce(bl.city,''))=lower(x.city) and lower(coalesce(bl.label,''))=lower(x.label));

insert into public.business_locations
(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3',b.id,l.id,'Pontiac office','office',false,true,false,
'318 N Mill St, Pontiac, IL 61764','Pontiac','IL','61764','815-683-3163','Google Business Profile',null,now()
from public.businesses b left join public.locations l on l.tenant_id=b.tenant_id and lower(l.name)='pontiac' and l.state='IL'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3' and b.slug='onward-injury-law-bloomington'
and not exists (select 1 from public.business_locations bl where bl.business_id=b.id and lower(coalesce(bl.city,''))='pontiac');

insert into public.navigation_items (tenant_id,menu_key,label,href,sort_order,is_visible,metadata)
select '6673621d-b359-4c17-a984-c8f50d914eb3','header','Local Services','/local-services',55,true,'{}'::jsonb
where not exists (select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3' and menu_key='header' and href='/local-services');
insert into public.navigation_items (tenant_id,menu_key,label,href,sort_order,is_visible,metadata)
select '6673621d-b359-4c17-a984-c8f50d914eb3','footer_find','Local Services','/local-services',50,true,'{}'::jsonb
where not exists (select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3' and menu_key='footer_find' and href='/local-services');
insert into public.navigation_items (tenant_id,menu_key,label,href,sort_order,is_visible,metadata)
select '6673621d-b359-4c17-a984-c8f50d914eb3','footer_find','Find Childcare','/childcare',60,true,'{}'::jsonb
where not exists (select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3' and menu_key='footer_find' and href='/childcare');
