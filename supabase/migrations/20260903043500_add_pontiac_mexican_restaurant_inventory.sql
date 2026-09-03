-- Source-backed Pontiac Mexican restaurant inventory.
-- This migration is idempotent and resolves tenant/location/category records by stable slugs.

with tenant as (
  select id from public.tenants where slug='central-illinois-local-pros' limit 1
), pontiac as (
  select id from public.locations where tenant_id=(select id from tenant) and slug='pontiac' and is_active=true limit 1
), upsert_la_mex as (
  insert into public.businesses(
    tenant_id,slug,name,phone,website,description,status,primary_location_id,address_text,
    source_name,source_url,source_checked_at,published_at,updated_at
  )
  values(
    (select id from tenant),'la-mex-pontiac','La Mex','(815) 844-4564',
    'https://www.facebook.com/pg/La-Mex-restaurant-382364881885816/about/',
    'Authentic Mexican restaurant in Pontiac, Illinois serving freshly prepared Mexican favorites.',
    'published',(select id from pontiac),'930 W Custer Ave, Pontiac, IL 61764',
    'Enjoy Illinois — Illinois Office of Tourism','https://www.enjoyillinois.com/explore/listing/la-mex-1/',now(),now(),now()
  )
  on conflict(tenant_id,slug) do update set
    name=excluded.name,
    phone=excluded.phone,
    website=excluded.website,
    description=excluded.description,
    status='published',
    primary_location_id=excluded.primary_location_id,
    address_text=excluded.address_text,
    source_name=excluded.source_name,
    source_url=excluded.source_url,
    source_checked_at=excluded.source_checked_at,
    updated_at=now()
  returning id
), upsert_taco as (
  insert into public.businesses(
    tenant_id,slug,name,phone,description,status,primary_location_id,address_text,
    source_name,source_url,source_checked_at,published_at,updated_at
  )
  values(
    (select id from tenant),'the-taco-truck-pontiac','The Taco Truck','(815) 302-3406',
    'Mexican restaurant in Pontiac, Illinois serving tacos, burritos, quesadillas and other Mexican favorites.',
    'published',(select id from pontiac),'1826 W Reynolds St, Pontiac, IL 61764',
    'Restaurantji — Pontiac Mexican Restaurants','https://www.restaurantji.com/il/pontiac/mexican/',now(),now(),now()
  )
  on conflict(tenant_id,slug) do update set
    name=excluded.name,
    phone=excluded.phone,
    description=excluded.description,
    status='published',
    primary_location_id=excluded.primary_location_id,
    address_text=excluded.address_text,
    source_name=excluded.source_name,
    source_url=excluded.source_url,
    source_checked_at=excluded.source_checked_at,
    updated_at=now()
  returning id
), ids as (
  select id from upsert_la_mex
  union all
  select id from upsert_taco
), mexican as (
  select id from public.categories where tenant_id=(select id from tenant) and slug='mexican-restaurants' and is_active=true limit 1
)
insert into public.business_categories(business_id,category_id,is_primary)
select ids.id,(select id from mexican),true from ids
on conflict do nothing;

with tenant as (
  select id from public.tenants where slug='central-illinois-local-pros' limit 1
), pontiac as (
  select id from public.locations where tenant_id=(select id from tenant) and slug='pontiac' and is_active=true limit 1
), rows as (
  select id,name,address_text,phone
  from public.businesses
  where tenant_id=(select id from tenant)
    and slug in ('la-mex-pontiac','the-taco-truck-pontiac')
)
insert into public.business_locations(
  tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,
  address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at,updated_at
)
select
  (select id from tenant),r.id,(select id from pontiac),'Primary Location','restaurant',true,true,false,
  r.address_text,'Pontiac','IL','61764',r.phone,
  case when r.name='La Mex' then 'Enjoy Illinois — Illinois Office of Tourism' else 'Restaurantji — Pontiac Mexican Restaurants' end,
  case when r.name='La Mex' then 'https://www.enjoyillinois.com/explore/listing/la-mex-1/' else 'https://www.restaurantji.com/il/pontiac/mexican/' end,
  now(),now()
from rows r
where not exists(
  select 1 from public.business_locations bl
  where bl.business_id=r.id and bl.location_id=(select id from pontiac) and bl.is_primary=true
);
