with loc as (
  select id from locations where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='flanagan' and is_active=true limit 1
), upserted as (
  insert into businesses (tenant_id,slug,name,abbr,primary_location_id,phone,description,status,published_at,address_text,source_name,source_url,source_checked_at)
  select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'koeller-plumbing-flanagan','Koeller Plumbing','KP',loc.id,'815-796-2860','Local Flanagan plumbing contractor listed by the Village of Flanagan at its North Adams Street location.','published',now(),'101 N Adams St, Flanagan, IL 61740','Village of Flanagan local business directory','https://www.flanaganil.org/local-bussiness',now() from loc
  on conflict (tenant_id,slug) do update set name=excluded.name,phone=excluded.phone,description=excluded.description,status='published',address_text=excluded.address_text,primary_location_id=excluded.primary_location_id,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now(),published_at=coalesce(businesses.published_at,now())
  returning id
)
insert into business_locations (tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,u.id,loc.id,'Flanagan','office',true,true,false,'101 N Adams St, Flanagan, IL 61740','Flanagan','IL','61740','815-796-2860','Village of Flanagan local business directory','https://www.flanaganil.org/local-bussiness',now()
from upserted u cross join loc
where not exists (select 1 from business_locations bl where bl.business_id=u.id and bl.location_id=loc.id and bl.address_text='101 N Adams St, Flanagan, IL 61740');

insert into business_categories (business_id,category_id,is_primary)
select b.id,c.id,true
from businesses b join categories c on c.tenant_id=b.tenant_id and c.slug='plumbing'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='koeller-plumbing-flanagan'
on conflict (business_id,category_id) do update set is_primary=true;

with loc as (
  select id from locations where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='flanagan' and is_active=true limit 1
), upserted as (
  insert into businesses (tenant_id,slug,name,abbr,primary_location_id,phone,description,status,published_at,address_text,source_name,source_url,source_checked_at)
  select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'jim-durre-plumbing-heating-electrical-flanagan','Jim Durre Plumbing, Heating & Electrical','JD',loc.id,'815-796-9025','Flanagan home-services contractor providing plumbing, heating and electrical services from a local Flanagan business location.','published',now(),'101 S Jefferson St, Flanagan, IL 61740','Village of Flanagan local business directory','https://www.flanaganil.org/local-bussiness',now() from loc
  on conflict (tenant_id,slug) do update set name=excluded.name,phone=excluded.phone,description=excluded.description,status='published',address_text=excluded.address_text,primary_location_id=excluded.primary_location_id,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now(),published_at=coalesce(businesses.published_at,now())
  returning id
)
insert into business_locations (tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,u.id,loc.id,'Flanagan','office',true,true,false,'101 S Jefferson St, Flanagan, IL 61740','Flanagan','IL','61740','815-796-9025','Village of Flanagan local business directory','https://www.flanaganil.org/local-bussiness',now()
from upserted u cross join loc
where not exists (select 1 from business_locations bl where bl.business_id=u.id and bl.location_id=loc.id and bl.address_text='101 S Jefferson St, Flanagan, IL 61740');

insert into business_categories (business_id,category_id,is_primary)
select b.id,c.id,(c.slug='plumbing')
from businesses b join categories c on c.tenant_id=b.tenant_id and c.slug in ('plumbing','hvac','electrical')
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='jim-durre-plumbing-heating-electrical-flanagan'
on conflict (business_id,category_id) do update set is_primary=excluded.is_primary;
