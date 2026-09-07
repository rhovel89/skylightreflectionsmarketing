-- Sales 3.7 signal tuning
-- Research-stage scoring is useful for prioritization, but should not flood the daily operator queue.
-- Only Contact Ready or later active sales stages may generate a hot-opportunity action card.

create or replace function private.guard_skylight_sales_hot_action_stage()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare v_stage text;
begin
  if new.action_type<>'hot_opportunity' then return new; end if;
  select stage into v_stage from public.skylight_sales_opportunities where id=new.opportunity_id;
  if v_stage not in ('contact_ready','contacted','qualified','proposal') then return null; end if;
  return new;
end;
$$;
revoke all on function private.guard_skylight_sales_hot_action_stage() from public,anon,authenticated;

drop trigger if exists skylight_sales_hot_action_stage_guard on public.skylight_sales_action_items;
create trigger skylight_sales_hot_action_stage_guard
before insert or update on public.skylight_sales_action_items
for each row execute function private.guard_skylight_sales_hot_action_stage();
