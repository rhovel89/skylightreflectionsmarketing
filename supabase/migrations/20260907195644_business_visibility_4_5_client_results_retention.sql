create table if not exists public.business_visibility_client_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.skylight_clients(id) on delete cascade,
  captured_on date not null default current_date,
  health_status text not null check (health_status in ('healthy','watch','attention','insufficient_data')),
  attention_points integer not null default 0 check (attention_points between 0 and 100),
  latest_visibility_snapshot_id uuid references public.business_visibility_opportunity_snapshots(id) on delete set null,
  latest_visibility_snapshot_at timestamptz,
  signal_counts jsonb not null default '{}'::jsonb,
  delivery_metrics jsonb not null default '{}'::jsonb,
  revenue_metrics jsonb not null default '{}'::jsonb,
  trend_windows jsonb not null default '{}'::jsonb,
  signals jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  source_fingerprint text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id,client_id,source_fingerprint)
);

create table if not exists public.business_visibility_retention_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.skylight_clients(id) on delete cascade,
  health_snapshot_id uuid references public.business_visibility_client_health_snapshots(id) on delete set null,
  review_status text not null default 'not_reviewed' check (review_status in ('not_reviewed','monitor','renewal_review','renewal_discussion','retained','churn_risk','churned','closed')),
  renewal_readiness text not null default 'not_assessed' check (renewal_readiness in ('not_assessed','ready_for_review','needs_attention','insufficient_data')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  next_review_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,client_id)
);

create table if not exists public.business_visibility_retention_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.skylight_clients(id) on delete cascade,
  review_id uuid references public.business_visibility_retention_reviews(id) on delete set null,
  health_snapshot_id uuid references public.business_visibility_client_health_snapshots(id) on delete set null,
  event_type text not null check (event_type in ('health_snapshot_captured','review_created','review_updated','review_claimed','review_unassigned','review_note_updated')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_visibility_client_health_tenant_business on public.business_visibility_client_health_snapshots(tenant_id,business_id,captured_on desc);
create index if not exists idx_visibility_client_health_client on public.business_visibility_client_health_snapshots(client_id,captured_on desc);
create index if not exists idx_visibility_client_health_latest_snapshot on public.business_visibility_client_health_snapshots(latest_visibility_snapshot_id) where latest_visibility_snapshot_id is not null;
create index if not exists idx_visibility_client_health_created_by on public.business_visibility_client_health_snapshots(created_by) where created_by is not null;

create index if not exists idx_visibility_retention_reviews_business on public.business_visibility_retention_reviews(tenant_id,business_id,review_status,next_review_date);
create index if not exists idx_visibility_retention_reviews_health on public.business_visibility_retention_reviews(health_snapshot_id) where health_snapshot_id is not null;
create index if not exists idx_visibility_retention_reviews_assigned on public.business_visibility_retention_reviews(assigned_user_id) where assigned_user_id is not null;
create index if not exists idx_visibility_retention_reviews_created_by on public.business_visibility_retention_reviews(created_by) where created_by is not null;
create index if not exists idx_visibility_retention_reviews_updated_by on public.business_visibility_retention_reviews(updated_by) where updated_by is not null;

create index if not exists idx_visibility_retention_events_client on public.business_visibility_retention_events(tenant_id,client_id,created_at desc);
create index if not exists idx_visibility_retention_events_business on public.business_visibility_retention_events(business_id,created_at desc);
create index if not exists idx_visibility_retention_events_review on public.business_visibility_retention_events(review_id,created_at desc) where review_id is not null;
create index if not exists idx_visibility_retention_events_health on public.business_visibility_retention_events(health_snapshot_id) where health_snapshot_id is not null;
create index if not exists idx_visibility_retention_events_actor on public.business_visibility_retention_events(actor_user_id) where actor_user_id is not null;

alter table public.business_visibility_client_health_snapshots enable row level security;
alter table public.business_visibility_retention_reviews enable row level security;
alter table public.business_visibility_retention_events enable row level security;

revoke all on table public.business_visibility_client_health_snapshots from anon, authenticated;
revoke all on table public.business_visibility_retention_reviews from anon, authenticated;
revoke all on table public.business_visibility_retention_events from anon, authenticated;

grant select,insert on table public.business_visibility_client_health_snapshots to authenticated;
grant select,insert,update on table public.business_visibility_retention_reviews to authenticated;
grant select,insert on table public.business_visibility_retention_events to authenticated;
grant all on table public.business_visibility_client_health_snapshots to service_role;
grant all on table public.business_visibility_retention_reviews to service_role;
grant all on table public.business_visibility_retention_events to service_role;

create policy "staff read visibility client health snapshots" on public.business_visibility_client_health_snapshots
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff insert visibility client health snapshots" on public.business_visibility_client_health_snapshots
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff manage visibility retention reviews" on public.business_visibility_retention_reviews
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff read visibility retention events" on public.business_visibility_retention_events
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff insert visibility retention events" on public.business_visibility_retention_events
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create or replace function private.prevent_visibility_client_health_snapshot_mutation()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  raise exception 'business visibility client health snapshots are immutable';
end;
$$;
revoke all on function private.prevent_visibility_client_health_snapshot_mutation() from public,anon,authenticated;

drop trigger if exists trg_visibility_client_health_immutable on public.business_visibility_client_health_snapshots;
create trigger trg_visibility_client_health_immutable
before update or delete on public.business_visibility_client_health_snapshots
for each row execute function private.prevent_visibility_client_health_snapshot_mutation();

create or replace function private.preserve_visibility_retention_review_creator()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  new.created_by:=old.created_by;
  return new;
end;
$$;
revoke all on function private.preserve_visibility_retention_review_creator() from public,anon,authenticated;

drop trigger if exists trg_visibility_retention_review_preserve_creator on public.business_visibility_retention_reviews;
create trigger trg_visibility_retention_review_preserve_creator
before update on public.business_visibility_retention_reviews
for each row execute function private.preserve_visibility_retention_review_creator();