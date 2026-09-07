revoke all on function public.consume_skylight_sales_unsubscribe(uuid) from public,anon,authenticated,service_role;

create table if not exists public.skylight_sales_unsubscribe_requests (
  token uuid not null,
  requested_at timestamptz not null default now()
);

alter table public.skylight_sales_unsubscribe_requests enable row level security;
revoke all on table public.skylight_sales_unsubscribe_requests from public,anon,authenticated;
grant insert on table public.skylight_sales_unsubscribe_requests to anon,authenticated;

create policy "public may submit opaque sales unsubscribe token"
on public.skylight_sales_unsubscribe_requests
for insert to anon,authenticated
with check (true);

create or replace function private.consume_skylight_sales_unsubscribe_request()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.consume_skylight_sales_unsubscribe(new.token);
  return null;
end;
$$;

revoke all on function private.consume_skylight_sales_unsubscribe_request() from public,anon,authenticated,service_role;

drop trigger if exists trg_consume_skylight_sales_unsubscribe_request on public.skylight_sales_unsubscribe_requests;
create trigger trg_consume_skylight_sales_unsubscribe_request
before insert on public.skylight_sales_unsubscribe_requests
for each row execute function private.consume_skylight_sales_unsubscribe_request();

comment on table public.skylight_sales_unsubscribe_requests is 'Insert-only opaque-token ingress for Sales 3.4 unsubscribe requests. The private trigger consumes the token and returns null, so no request row is retained and no private sales data is exposed.';
