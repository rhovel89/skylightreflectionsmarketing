-- Keep the hot-action stage guard from interfering with lifecycle updates/auto-resolution.
drop trigger if exists skylight_sales_hot_action_stage_guard on public.skylight_sales_action_items;
create trigger skylight_sales_hot_action_stage_guard
before insert on public.skylight_sales_action_items
for each row execute function private.guard_skylight_sales_hot_action_stage();
