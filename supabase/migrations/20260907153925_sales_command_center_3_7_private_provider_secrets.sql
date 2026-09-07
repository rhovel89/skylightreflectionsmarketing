-- Sales Command Center 3.7 integration hardening
-- Server-only provider secrets used for webhook verification when an environment secret is unavailable.

create table if not exists public.skylight_sales_provider_secrets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  secret_key text not null,
  secret_value text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,provider,secret_key)
);

alter table public.skylight_sales_provider_secrets enable row level security;
revoke all on table public.skylight_sales_provider_secrets from public,anon,authenticated;
grant all on table public.skylight_sales_provider_secrets to service_role;
create index if not exists idx_skylight_sales_provider_secrets_provider on public.skylight_sales_provider_secrets(tenant_id,provider,secret_key);
