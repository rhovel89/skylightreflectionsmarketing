insert into public.locations (tenant_id,type,slug,name,county,state,region,nearby,is_active)
values ('6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'city','clinton','Clinton','DeWitt County','Illinois','Central Illinois','{}'::text[],true)
on conflict (tenant_id,type,slug) do update set name=excluded.name,county=excluded.county,state=excluded.state,region=excluded.region,is_active=true;

insert into public.businesses (tenant_id,slug,name,abbr,primary_location_id,phone,website,description,hours,verified,featured,claimed,profile_score,status,published_at,address_text,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'grimsleys-flower-store-clinton-il','Grimsley''s Flower Store','GF',l.id,'(217) 935-2197','https://www.grimsleysflowerstore.com/','Family-owned Clinton florist and gift shop established in 1918, offering custom floral arrangements, plants, gifts, weddings, sympathy flowers and local delivery.','Mon-Fri 8:00 AM-5:00 PM; Sat 8:00 AM-1:00 PM; Sun Closed',false,false,false,55,'published',now(),'102 Jones Court, Clinton, IL 61727','Grimsley''s Flower Store official website','https://www.grimsleysflowerstore.com/about_us.php',now()
from public.locations l
where l.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and l.type='city' and l.slug='clinton'
on conflict (tenant_id,slug) do update set name=excluded.name,primary_location_id=excluded.primary_location_id,phone=excluded.phone,website=excluded.website,description=excluded.description,hours=excluded.hours,address_text=excluded.address_text,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,status='published',updated_at=now();

insert into public.business_categories (business_id,category_id,is_primary)
select b.id,c.id,true from public.businesses b join public.categories c on c.tenant_id=b.tenant_id and c.slug='florists' and c.is_active=true
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='grimsleys-flower-store-clinton-il'
on conflict (business_id,category_id) do update set is_primary=true;

insert into public.business_locations (tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,hours,source_name,source_url,source_checked_at)
select b.tenant_id,b.id,l.id,'Clinton storefront','storefront',true,true,false,'102 Jones Court, Clinton, IL 61727','Clinton','IL','61727','(217) 935-2197','{}'::jsonb,'Grimsley''s Flower Store official website','https://www.grimsleysflowerstore.com/',now()
from public.businesses b join public.locations l on l.tenant_id=b.tenant_id and l.type='city' and l.slug='clinton'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='grimsleys-flower-store-clinton-il'
and not exists (select 1 from public.business_locations bl where bl.business_id=b.id and bl.location_id=l.id and bl.is_active=true);

insert into public.business_service_areas (business_id,location_id)
select b.id,l.id from public.businesses b join public.locations l on l.tenant_id=b.tenant_id and l.slug in ('lincoln','maroa','heyworth') and l.is_active=true
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='grimsleys-flower-store-clinton-il'
on conflict (business_id,location_id) do nothing;
