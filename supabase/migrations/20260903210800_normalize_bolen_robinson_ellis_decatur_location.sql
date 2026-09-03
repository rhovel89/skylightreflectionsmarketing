-- Normalize the existing canonical Bolen Robinson & Ellis record into Decatur city joins.
with loc as (
  select id from public.locations
  where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='decatur' and is_active=true
  limit 1
), biz as (
  update public.businesses b
  set primary_location_id=loc.id,
      address_text='202 S Franklin St 2nd floor, Decatur, IL 62523',
      source_name='Decatur Bar Association / current firm profile',
      source_url='https://decaturbar.org/directory/',
      source_checked_at=now(),
      updated_at=now()
  from loc
  where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
    and b.slug='bolen-robinson-ellis-decatur'
  returning b.id
)
insert into public.business_locations
(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,biz.id,loc.id,'Decatur office','office',true,true,false,
       '202 S Franklin St 2nd floor, Decatur, IL 62523','Decatur','IL','62523','Decatur Bar Association','https://decaturbar.org/directory/',now()
from biz cross join loc
where not exists (
  select 1 from public.business_locations bl
  where bl.business_id=biz.id and bl.location_id=loc.id and bl.address_text='202 S Franklin St 2nd floor, Decatur, IL 62523'
);
