-- Applied to production Supabase as migration: expand_featured_ad_inventory_and_business_visibility
alter table public.sponsorships add column if not exists page_path text;
alter table public.sponsorships add column if not exists priority integer not null default 100;
alter table public.sponsorships add column if not exists sort_order integer not null default 100;
alter table public.sponsorships add column if not exists origin text not null default 'manual';
alter table public.sponsorships add column if not exists rotation_weight integer not null default 1;
alter table public.sponsorships add column if not exists updated_at timestamptz not null default now();

alter table public.sponsorships drop constraint if exists sponsorships_placement_check;
alter table public.sponsorships add constraint sponsorships_placement_check check (placement in (
  'sitewide','search','city','category',
  'homepage_featured','global_sidebar','city_sidebar','category_sidebar','market_sidebar','page_sidebar',
  'guide_sidebar','business_profile_sidebar','restaurant_sidebar','home_services_sidebar','attorney_sidebar','local_stores_sidebar'
));

do $$ begin
  alter table public.sponsorships add constraint sponsorships_priority_check check (priority between 0 and 1000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sponsorships add constraint sponsorships_sort_order_check check (sort_order between 0 and 100000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sponsorships add constraint sponsorships_rotation_weight_check check (rotation_weight between 1 and 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sponsorships add constraint sponsorships_origin_check check (origin in ('manual','stripe','promotional'));
exception when duplicate_object then null; end $$;

create index if not exists sponsorships_inventory_idx on public.sponsorships(tenant_id,placement,active,priority desc,sort_order,starts_on,ends_on);
create index if not exists sponsorships_page_path_idx on public.sponsorships(tenant_id,page_path) where page_path is not null;

create or replace function private.validate_sponsorship_scope()
returns trigger language plpgsql set search_path='' as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.businesses where id=new.business_id and status='published';
  if v_tenant is null then raise exception 'published_business_required'; end if;
  new.tenant_id:=v_tenant;
  new.updated_at:=now();
  if new.market_location_id is not null and not exists(select 1 from public.locations l where l.id=new.market_location_id and l.tenant_id=v_tenant and l.is_active=true) then raise exception 'active_market_required'; end if;
  if new.category_id is not null and not exists(select 1 from public.categories c where c.id=new.category_id and c.tenant_id=v_tenant and c.is_active=true) then raise exception 'active_category_required'; end if;
  if new.page_path is not null and (left(new.page_path,1)<>'/' or length(new.page_path)>500) then raise exception 'valid_page_path_required'; end if;
  if new.placement in ('sitewide','global_sidebar','homepage_featured','restaurant_sidebar','home_services_sidebar','attorney_sidebar','local_stores_sidebar') and (new.market_location_id is not null or new.category_id is not null or new.page_path is not null) then raise exception 'global_placement_scope_must_be_empty'; end if;
  if new.placement in ('city','city_sidebar') and new.market_location_id is null then raise exception 'city_sponsorship_requires_market'; end if;
  if new.placement in ('category','category_sidebar') and new.category_id is null then raise exception 'category_sponsorship_requires_category'; end if;
  if new.placement='market_sidebar' and (new.market_location_id is null or new.category_id is null) then raise exception 'market_sidebar_requires_city_and_category'; end if;
  if new.placement='page_sidebar' and new.page_path is null then raise exception 'page_sidebar_requires_page_path'; end if;
  return new;
end $$;
revoke all on function private.validate_sponsorship_scope() from public,anon,authenticated;

drop trigger if exists trg_validate_sponsorship_scope on public.sponsorships;
create trigger trg_validate_sponsorship_scope before insert or update on public.sponsorships for each row execute function private.validate_sponsorship_scope();

create or replace function private.deactivate_sponsorships_for_unpublished_business()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='published' and new.status<>'published' then
    update public.sponsorships set active=false,updated_at=now() where business_id=new.id and active=true;
  end if;
  return new;
end $$;
revoke all on function private.deactivate_sponsorships_for_unpublished_business() from public,anon,authenticated;
drop trigger if exists trg_deactivate_sponsorships_for_unpublished_business on public.businesses;
create trigger trg_deactivate_sponsorships_for_unpublished_business after update of status on public.businesses for each row execute function private.deactivate_sponsorships_for_unpublished_business();

update public.sponsorships s set tenant_id=b.tenant_id,updated_at=now() from public.businesses b where s.business_id=b.id and s.tenant_id is distinct from b.tenant_id;