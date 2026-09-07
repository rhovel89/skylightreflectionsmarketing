create table if not exists public.business_visibility_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  provider text not null check (provider in ('brightlocal','manual','import','other')),
  source_url text,
  provider_reference text,
  original_filename text,
  status text not null default 'completed' check (status in ('completed','partial','failed')),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (source_url is not null or provider_reference is not null),
  check (source_url is null or source_url ~* '^https?://')
);

alter table public.business_visibility_rankings
  add column if not exists import_batch_id uuid references public.business_visibility_import_batches(id) on delete set null;

create index if not exists idx_visibility_import_batches_business
  on public.business_visibility_import_batches(tenant_id,business_id,created_at desc);
create index if not exists idx_visibility_import_batches_business_fk
  on public.business_visibility_import_batches(business_id);
create index if not exists idx_visibility_import_batches_prospect_fk
  on public.business_visibility_import_batches(prospect_id);
create index if not exists idx_visibility_rankings_import_batch_fk
  on public.business_visibility_rankings(import_batch_id);

alter table public.business_visibility_import_batches enable row level security;
create policy "staff manage visibility import batches" on public.business_visibility_import_batches
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

revoke all on table public.business_visibility_import_batches from anon;
grant select,insert,update,delete on table public.business_visibility_import_batches to authenticated;
grant all on table public.business_visibility_import_batches to service_role;
