-- The secret value itself is intentionally not committed.
create table if not exists private.integration_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on table private.integration_secrets from public, anon, authenticated;

create or replace function public.get_server_integration_secret(p_key text)
returns text
language sql
security definer
set search_path=''
as $$
  select value from private.integration_secrets where key=p_key;
$$;
revoke all on function public.get_server_integration_secret(text) from public, anon, authenticated;
grant execute on function public.get_server_integration_secret(text) to service_role;
