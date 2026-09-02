create or replace function private.validate_sponsorship_scope()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_tenant uuid;
  v_status text;
begin
  select tenant_id,status into v_tenant,v_status
  from public.businesses
  where id=new.business_id;

  if v_tenant is null then
    raise exception 'business_required';
  end if;

  -- A sponsorship may be deactivated after its business leaves publication.
  -- New placements, re-activation, and reassignment still require a published business.
  if (tg_op='INSERT' or new.active or (tg_op='UPDATE' and new.business_id is distinct from old.business_id))
     and v_status<>'published' then
    raise exception 'published_business_required';
  end if;

  new.tenant_id:=v_tenant;
  new.updated_at:=now();

  if new.market_location_id is not null and not exists(
    select 1 from public.locations l
    where l.id=new.market_location_id and l.tenant_id=v_tenant and l.is_active=true
  ) then raise exception 'active_market_required'; end if;

  if new.category_id is not null and not exists(
    select 1 from public.categories c
    where c.id=new.category_id and c.tenant_id=v_tenant and c.is_active=true
  ) then raise exception 'active_category_required'; end if;

  if new.page_path is not null and (left(new.page_path,1)<>'/' or length(new.page_path)>500) then
    raise exception 'valid_page_path_required';
  end if;

  if new.placement in ('sitewide','global_sidebar','homepage_featured','restaurant_sidebar','home_services_sidebar','attorney_sidebar','local_stores_sidebar')
     and (new.market_location_id is not null or new.category_id is not null or new.page_path is not null) then
    raise exception 'global_placement_scope_must_be_empty';
  end if;

  if new.placement in ('city','city_sidebar') and new.market_location_id is null then
    raise exception 'city_sponsorship_requires_market';
  end if;

  if new.placement in ('category','category_sidebar') and new.category_id is null then
    raise exception 'category_sponsorship_requires_category';
  end if;

  if new.placement='market_sidebar' and (new.market_location_id is null or new.category_id is null) then
    raise exception 'market_sidebar_requires_city_and_category';
  end if;

  if new.placement='page_sidebar' and new.page_path is null then
    raise exception 'page_sidebar_requires_page_path';
  end if;

  return new;
end
$$;
