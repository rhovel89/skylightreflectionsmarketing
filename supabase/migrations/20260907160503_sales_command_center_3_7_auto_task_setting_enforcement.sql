-- Sales 3.7 setting enforcement
-- Honor the editable auto_create_tasks switch without touching communication or billing controls.

create or replace function private.guard_skylight_sales_auto_generated_actions()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare v_auto boolean;
begin
  if not coalesce(new.auto_generated,false) then return new; end if;
  select auto_create_tasks into v_auto from public.skylight_sales_action_settings where tenant_id=new.tenant_id;
  if v_auto is false then return null; end if;
  return new;
end;
$$;
revoke all on function private.guard_skylight_sales_auto_generated_actions() from public,anon,authenticated;

drop trigger if exists skylight_sales_auto_generated_action_guard on public.skylight_sales_action_items;
create trigger skylight_sales_auto_generated_action_guard
before insert on public.skylight_sales_action_items
for each row execute function private.guard_skylight_sales_auto_generated_actions();
