create table if not exists public.business_visibility_opportunity_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  client_id uuid references public.skylight_clients(id) on delete set null,
  generated_at timestamptz not null default now(),
  period_start date,
  period_end date,
  opportunity_score numeric(6,2) check (opportunity_score is null or opportunity_score between 0 and 100),
  opportunity_band text not null default 'not_measured' check (opportunity_band in ('not_measured','low','moderate','high','very_high')),
  measurement_coverage numeric(6,2) not null default 0 check (measurement_coverage between 0 and 100),
  component_scores jsonb not null default '{}'::jsonb,
  comparisons jsonb not null default '[]'::jsonb,
  source_manifest jsonb not null default '[]'::jsonb,
  snapshot_data jsonb not null default '{}'::jsonb,
  source_fingerprint text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id,business_id,source_fingerprint)
);

create table if not exists public.business_visibility_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  opportunity_id uuid references public.skylight_sales_opportunities(id) on delete set null,
  snapshot_id uuid not null references public.business_visibility_opportunity_snapshots(id) on delete cascade,
  recommendation_key text not null,
  category text not null check (category in ('technical_seo','on_page_seo','content','ctr','organic_rank','local_rank','google_business_profile','competitor_gap','visibility_alert')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  title text not null,
  finding text not null,
  recommended_action text not null,
  source_refs jsonb not null default '[]'::jsonb,
  source_fingerprint text not null,
  status text not null default 'open' check (status in ('open','accepted','completed','dismissed')),
  staff_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,business_id,recommendation_key,source_fingerprint)
);

create table if not exists public.business_visibility_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  client_id uuid references public.skylight_clients(id) on delete set null,
  snapshot_id uuid not null references public.business_visibility_opportunity_snapshots(id) on delete restrict,
  report_type text not null check (report_type in ('prospect','client')),
  title text not null,
  period_start date,
  period_end date,
  status text not null default 'draft' check (status in ('draft','finalized','archived')),
  executive_summary text not null,
  snapshot_data jsonb not null default '{}'::jsonb,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  finalized_by uuid references auth.users(id) on delete set null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_visibility_opportunity_snapshots_tenant_business on public.business_visibility_opportunity_snapshots(tenant_id,business_id,generated_at desc);
create index if not exists idx_visibility_opportunity_snapshots_business on public.business_visibility_opportunity_snapshots(business_id,generated_at desc);
create index if not exists idx_visibility_opportunity_snapshots_prospect on public.business_visibility_opportunity_snapshots(prospect_id) where prospect_id is not null;
create index if not exists idx_visibility_opportunity_snapshots_client on public.business_visibility_opportunity_snapshots(client_id) where client_id is not null;
create index if not exists idx_visibility_opportunity_snapshots_created_by on public.business_visibility_opportunity_snapshots(created_by) where created_by is not null;

create index if not exists idx_visibility_recommendations_tenant_business on public.business_visibility_recommendations(tenant_id,business_id,status,priority,updated_at desc);
create index if not exists idx_visibility_recommendations_business on public.business_visibility_recommendations(business_id,updated_at desc);
create index if not exists idx_visibility_recommendations_prospect on public.business_visibility_recommendations(prospect_id) where prospect_id is not null;
create index if not exists idx_visibility_recommendations_opportunity on public.business_visibility_recommendations(opportunity_id) where opportunity_id is not null;
create index if not exists idx_visibility_recommendations_snapshot on public.business_visibility_recommendations(snapshot_id);
create index if not exists idx_visibility_recommendations_created_by on public.business_visibility_recommendations(created_by) where created_by is not null;
create index if not exists idx_visibility_recommendations_updated_by on public.business_visibility_recommendations(updated_by) where updated_by is not null;

create index if not exists idx_visibility_reports_tenant_business on public.business_visibility_reports(tenant_id,business_id,created_at desc);
create index if not exists idx_visibility_reports_business on public.business_visibility_reports(business_id,created_at desc);
create index if not exists idx_visibility_reports_prospect on public.business_visibility_reports(prospect_id) where prospect_id is not null;
create index if not exists idx_visibility_reports_client on public.business_visibility_reports(client_id) where client_id is not null;
create index if not exists idx_visibility_reports_snapshot on public.business_visibility_reports(snapshot_id);
create index if not exists idx_visibility_reports_created_by on public.business_visibility_reports(created_by) where created_by is not null;
create index if not exists idx_visibility_reports_updated_by on public.business_visibility_reports(updated_by) where updated_by is not null;
create index if not exists idx_visibility_reports_finalized_by on public.business_visibility_reports(finalized_by) where finalized_by is not null;

alter table public.business_visibility_opportunity_snapshots enable row level security;
alter table public.business_visibility_recommendations enable row level security;
alter table public.business_visibility_reports enable row level security;

revoke all on table public.business_visibility_opportunity_snapshots from anon, authenticated;
revoke all on table public.business_visibility_recommendations from anon, authenticated;
revoke all on table public.business_visibility_reports from anon, authenticated;

grant select,insert on table public.business_visibility_opportunity_snapshots to authenticated;
grant select,insert,update on table public.business_visibility_recommendations to authenticated;
grant select,insert,update on table public.business_visibility_reports to authenticated;
grant all on table public.business_visibility_opportunity_snapshots to service_role;
grant all on table public.business_visibility_recommendations to service_role;
grant all on table public.business_visibility_reports to service_role;

create policy "staff read visibility opportunity snapshots" on public.business_visibility_opportunity_snapshots
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff insert visibility opportunity snapshots" on public.business_visibility_opportunity_snapshots
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff read visibility recommendations" on public.business_visibility_recommendations
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff insert visibility recommendations" on public.business_visibility_recommendations
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff update visibility recommendations" on public.business_visibility_recommendations
for update to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff read visibility reports" on public.business_visibility_reports
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff insert visibility reports" on public.business_visibility_reports
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff update visibility reports" on public.business_visibility_reports
for update to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

alter table public.business_visibility_sales_evidence
  drop constraint if exists business_visibility_sales_evidence_evidence_type_check;
alter table public.business_visibility_sales_evidence
  add constraint business_visibility_sales_evidence_evidence_type_check
  check (evidence_type in ('website_audit','ranking','competitor_audit','competitor_ranking','visibility_alert','visibility_recommendation'));
