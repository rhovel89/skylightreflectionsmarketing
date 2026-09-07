create table if not exists public.business_visibility_google_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  connection_type text not null check (connection_type in ('search_console','business_profile')),
  status text not null default 'pending' check (status in ('pending','connected','error','disconnected')),
  token_ciphertext text,
  refresh_token_ciphertext text,
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  google_account_email text,
  search_console_property text,
  gbp_account_name text,
  gbp_location_name text,
  gbp_location_title text,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,business_id,connection_type)
);

create table if not exists public.business_visibility_google_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  dataset_type text not null check (dataset_type in ('search_console','gbp_performance','gbp_keywords')),
  source_url text,
  original_filename text,
  provider_reference text,
  status text not null default 'completed' check (status in ('completed','partial','failed')),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_visibility_gsc_metrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  import_batch_id uuid references public.business_visibility_google_import_batches(id) on delete set null,
  connection_id uuid references public.business_visibility_google_connections(id) on delete set null,
  period_start date not null,
  period_end date not null,
  dimension_type text not null check (dimension_type in ('summary','query','page','device','country','search_appearance')),
  dimension_value text,
  search_type text not null default 'web',
  clicks bigint not null default 0 check (clicks >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  ctr numeric(12,8) not null default 0 check (ctr >= 0),
  position numeric(12,4),
  source_type text not null check (source_type in ('google_search_console_api','google_search_console_export')),
  source_url text,
  source_fingerprint text not null,
  checked_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (tenant_id,business_id,source_fingerprint)
);

create table if not exists public.business_visibility_gbp_metrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  import_batch_id uuid references public.business_visibility_google_import_batches(id) on delete set null,
  connection_id uuid references public.business_visibility_google_connections(id) on delete set null,
  location_name text,
  metric_date date not null,
  metric text not null,
  metric_value numeric(18,4) not null default 0 check (metric_value >= 0),
  subentity_type jsonb not null default '{}'::jsonb,
  source_type text not null check (source_type in ('google_business_profile_api','google_business_profile_export')),
  source_url text,
  source_fingerprint text not null,
  checked_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id,business_id,source_fingerprint)
);

create table if not exists public.business_visibility_gbp_search_keywords (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  import_batch_id uuid references public.business_visibility_google_import_batches(id) on delete set null,
  connection_id uuid references public.business_visibility_google_connections(id) on delete set null,
  location_name text,
  month_start date not null,
  search_keyword text not null,
  impressions_value bigint,
  impressions_threshold bigint,
  source_type text not null check (source_type in ('google_business_profile_api','google_business_profile_export')),
  source_url text,
  source_fingerprint text not null,
  checked_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((impressions_value is not null and impressions_threshold is null) or (impressions_value is null and impressions_threshold is not null)),
  check (coalesce(impressions_value, impressions_threshold, 0) >= 0),
  unique (tenant_id,business_id,source_fingerprint)
);

create index if not exists business_visibility_google_connections_business_idx on public.business_visibility_google_connections(business_id);
create index if not exists business_visibility_google_connections_prospect_idx on public.business_visibility_google_connections(prospect_id);
create index if not exists business_visibility_google_import_batches_business_idx on public.business_visibility_google_import_batches(business_id,created_at desc);
create index if not exists business_visibility_google_import_batches_prospect_idx on public.business_visibility_google_import_batches(prospect_id);
create index if not exists business_visibility_gsc_metrics_business_period_idx on public.business_visibility_gsc_metrics(business_id,period_end desc,dimension_type);
create index if not exists business_visibility_gsc_metrics_prospect_idx on public.business_visibility_gsc_metrics(prospect_id);
create index if not exists business_visibility_gsc_metrics_import_idx on public.business_visibility_gsc_metrics(import_batch_id);
create index if not exists business_visibility_gsc_metrics_connection_idx on public.business_visibility_gsc_metrics(connection_id);
create index if not exists business_visibility_gbp_metrics_business_date_idx on public.business_visibility_gbp_metrics(business_id,metric_date desc,metric);
create index if not exists business_visibility_gbp_metrics_prospect_idx on public.business_visibility_gbp_metrics(prospect_id);
create index if not exists business_visibility_gbp_metrics_import_idx on public.business_visibility_gbp_metrics(import_batch_id);
create index if not exists business_visibility_gbp_metrics_connection_idx on public.business_visibility_gbp_metrics(connection_id);
create index if not exists business_visibility_gbp_keywords_business_month_idx on public.business_visibility_gbp_search_keywords(business_id,month_start desc,search_keyword);
create index if not exists business_visibility_gbp_keywords_prospect_idx on public.business_visibility_gbp_search_keywords(prospect_id);
create index if not exists business_visibility_gbp_keywords_import_idx on public.business_visibility_gbp_search_keywords(import_batch_id);
create index if not exists business_visibility_gbp_keywords_connection_idx on public.business_visibility_gbp_search_keywords(connection_id);

alter table public.business_visibility_google_connections enable row level security;
alter table public.business_visibility_google_import_batches enable row level security;
alter table public.business_visibility_gsc_metrics enable row level security;
alter table public.business_visibility_gbp_metrics enable row level security;
alter table public.business_visibility_gbp_search_keywords enable row level security;

create policy "staff manage google visibility connections" on public.business_visibility_google_connections for all to authenticated using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));
create policy "staff manage google visibility imports" on public.business_visibility_google_import_batches for all to authenticated using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));
create policy "staff manage gsc metrics" on public.business_visibility_gsc_metrics for all to authenticated using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));
create policy "staff manage gbp metrics" on public.business_visibility_gbp_metrics for all to authenticated using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));
create policy "staff manage gbp search keywords" on public.business_visibility_gbp_search_keywords for all to authenticated using (private.has_tenant_role(tenant_id, array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id, array['staff','admin','super_admin']));

revoke all on public.business_visibility_google_connections from anon;
revoke all on public.business_visibility_google_import_batches from anon;
revoke all on public.business_visibility_gsc_metrics from anon;
revoke all on public.business_visibility_gbp_metrics from anon;
revoke all on public.business_visibility_gbp_search_keywords from anon;

grant select,insert,update,delete on public.business_visibility_google_connections to authenticated;
grant select,insert,update,delete on public.business_visibility_google_import_batches to authenticated;
grant select,insert,update,delete on public.business_visibility_gsc_metrics to authenticated;
grant select,insert,update,delete on public.business_visibility_gbp_metrics to authenticated;
grant select,insert,update,delete on public.business_visibility_gbp_search_keywords to authenticated;
grant all on public.business_visibility_google_connections to service_role;
grant all on public.business_visibility_google_import_batches to service_role;
grant all on public.business_visibility_gsc_metrics to service_role;
grant all on public.business_visibility_gbp_metrics to service_role;
grant all on public.business_visibility_gbp_search_keywords to service_role;
