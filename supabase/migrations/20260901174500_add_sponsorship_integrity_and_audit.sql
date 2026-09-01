do $$ begin
  alter table public.sponsorships add constraint sponsorships_placement_check check (placement in ('sitewide','search','city','category'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.sponsorships add constraint sponsorships_date_order_check check (starts_on is null or ends_on is null or starts_on<=ends_on);
exception when duplicate_object then null; end $$;
create index if not exists sponsorships_active_scope_idx on public.sponsorships(active,starts_on,ends_on,market_location_id,category_id,business_id);

create or replace function private.validate_sponsorship_scope()
returns trigger language plpgsql set search_path='' as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.businesses where id=new.business_id and status='published';
  if v_tenant is null then raise exception 'published_business_required'; end if;
  if new.market_location_id is not null and not exists(select 1 from public.locations l where l.id=new.market_location_id and l.tenant_id=v_tenant and l.is_active=true) then raise exception 'active_market_required'; end if;
  if new.category_id is not null and not exists(select 1 from public.categories c where c.id=new.category_id and c.tenant_id=v_tenant and c.is_active=true) then raise exception 'active_category_required'; end if;
  if new.placement='sitewide' and (new.market_location_id is not null or new.category_id is not null) then raise exception 'sitewide_scope_must_be_global'; end if;
  if new.placement='city' and new.market_location_id is null then raise exception 'city_sponsorship_requires_market'; end if;
  if new.placement='category' and new.category_id is null then raise exception 'category_sponsorship_requires_category'; end if;
  return new;
end $$;
revoke all on function private.validate_sponsorship_scope() from public,anon,authenticated;
drop trigger if exists trg_validate_sponsorship_scope on public.sponsorships;
create trigger trg_validate_sponsorship_scope before insert or update on public.sponsorships for each row execute function private.validate_sponsorship_scope();

create or replace function private.audit_sponsorship_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_business uuid; v_tenant uuid; v_action text;
begin
  v_business:=coalesce(new.business_id,old.business_id);
  select tenant_id into v_tenant from public.businesses where id=v_business;
  v_action:=case tg_op when 'INSERT' then 'sponsorship_created' when 'UPDATE' then 'sponsorship_updated' else 'sponsorship_deleted' end;
  if auth.uid() is not null and v_tenant is not null then insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),v_action,initcap(replace(v_action,'_',' '))||' for business '||v_business); end if;
  return coalesce(new,old);
end $$;
revoke all on function private.audit_sponsorship_change() from public,anon,authenticated;
drop trigger if exists trg_audit_sponsorship_change on public.sponsorships;
create trigger trg_audit_sponsorship_change after insert or update or delete on public.sponsorships for each row execute function private.audit_sponsorship_change();