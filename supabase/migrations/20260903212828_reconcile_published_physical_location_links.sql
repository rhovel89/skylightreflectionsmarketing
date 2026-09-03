-- Reconcile published physical branch rows to active market locations only when a real street address is already present.
-- Addressless rows are intentionally not linked because they may represent service-area-style coverage.

update public.business_locations bl
set location_id=l.id, updated_at=now()
from public.businesses b, public.locations l
where b.id=bl.business_id
  and b.tenant_id=bl.tenant_id
  and b.status='published'
  and l.tenant_id=bl.tenant_id
  and l.is_active=true
  and lower(trim(l.name))=lower(trim(bl.city))
  and bl.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
  and bl.is_active=true
  and bl.location_id is null
  and nullif(trim(coalesce(bl.address_text,'')),'') is not null;

update public.businesses b
set primary_location_id=bl.location_id, updated_at=now()
from public.business_locations bl
where bl.business_id=b.id
  and bl.tenant_id=b.tenant_id
  and bl.is_active=true
  and bl.is_primary=true
  and bl.location_id is not null
  and nullif(trim(coalesce(bl.address_text,'')),'') is not null
  and lower(trim(bl.address_text))=lower(trim(b.address_text))
  and b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
  and b.status='published'
  and b.primary_location_id is null;

insert into public.business_locations
(tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,email,source_name,source_url,source_checked_at)
select b.tenant_id,b.id,l.id,'Main office','office',true,true,false,
       b.address_text,l.name,'IL',nullif(substring(b.address_text from 'IL[[:space:]]+([0-9]{5})'),''),
       b.phone,b.email,b.source_name,b.source_url,coalesce(b.source_checked_at,now())
from public.businesses b
join public.locations l on l.tenant_id=b.tenant_id and l.is_active=true
 and lower(b.address_text) like '%, ' || lower(l.name) || ', il%'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
  and b.status='published'
  and b.primary_location_id is null
  and nullif(trim(coalesce(b.address_text,'')),'') is not null
  and not exists(select 1 from public.business_locations x where x.business_id=b.id and x.tenant_id=b.tenant_id and x.is_active=true);

update public.businesses b
set primary_location_id=bl.location_id, updated_at=now()
from public.business_locations bl
where bl.business_id=b.id
  and bl.tenant_id=b.tenant_id
  and bl.is_active=true
  and bl.is_primary=true
  and bl.location_id is not null
  and b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
  and b.status='published'
  and b.primary_location_id is null
  and lower(trim(coalesce(bl.address_text,'')))=lower(trim(coalesce(b.address_text,'')));
