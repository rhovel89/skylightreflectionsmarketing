insert into business_service_areas (business_id,location_id)
select b.id,l.id
from businesses b cross join locations l
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
  and b.slug='popejoy-plumbing-heating-electric-septic-pontiac'
  and l.tenant_id=b.tenant_id
  and l.slug='flanagan'
  and l.is_active=true
  and not exists (
    select 1 from business_service_areas bsa where bsa.business_id=b.id and bsa.location_id=l.id
  );
