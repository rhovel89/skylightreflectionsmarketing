-- Sales Command Center 3.8 — Client Acquisition Engine schema
-- Staff-only acquisition measurement, campaign spend, and experiment planning.
-- Nothing in this migration sends outreach, enrolls prospects, changes billing, or affects public ranking.

create table if not exists public.skylight_sales_acquisition_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  default_window_days integer not null default 90 check (default_window_days between 1 and 3650),
  min_segment_opportunities integer not null default 3 check (min_segment_opportunities between 1 and 10000),
  min_sent_sample_directional integer not null default 10 check (min_sent_sample_directional between 1 and 10000),
  min_sent_sample_mature integer not null default 30 check (min_sent_sample_mature between 2 and 100000),
  min_wins_for_cac integer not null default 3 check (min_wins_for_cac between 1 and 10000),
  experiment_planner_enabled boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_sent_sample_mature >= min_sent_sample_directional)
);

create table if not exists public.skylight_sales_campaign_spend (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.skylight_sales_campaigns(id) on delete cascade,
  spend_date date not null default current_date,
  amount_cents integer not null check (amount_cents >= 0),
  source text not null default 'manual' check (source in ('manual','import','other')),
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_skylight_sales_campaign_spend_campaign_date
  on public.skylight_sales_campaign_spend(tenant_id,campaign_id,spend_date desc);

create table if not exists public.skylight_sales_acquisition_experiments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status text not null default 'planning' check (status in ('planning','running','paused','completed','cancelled')),
  hypothesis text,
  dimension_type text check (dimension_type is null or dimension_type in ('city','category','service','evidence','campaign','template')),
  dimension_key text,
  campaign_id uuid references public.skylight_sales_campaigns(id) on delete set null,
  target_sample_size integer check (target_sample_size is null or target_sample_size between 1 and 100000),
  notes text,
  result_summary text,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_skylight_sales_acquisition_experiments_status
  on public.skylight_sales_acquisition_experiments(tenant_id,status,updated_at desc);

create table if not exists public.skylight_sales_acquisition_metrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric_date date not null,
  window_days integer not null check (window_days between 0 and 3650),
  dimension_type text not null check (dimension_type in ('overall','city','category','service','evidence','campaign','template')),
  dimension_key text not null,
  opportunities integer not null default 0,
  research_opportunities integer not null default 0,
  contact_ready_opportunities integer not null default 0,
  drafted_opportunities integer not null default 0,
  approved_opportunities integer not null default 0,
  sent_opportunities integer not null default 0,
  replied_opportunities integer not null default 0,
  positive_reply_opportunities integer not null default 0,
  meeting_opportunities integer not null default 0,
  proposal_opportunities integer not null default 0,
  won_opportunities integer not null default 0,
  lost_opportunities integer not null default 0,
  suppressed_opportunities integer not null default 0,
  attributed_opportunities integer not null default 0,
  avg_score numeric(10,2),
  paid_revenue_cents bigint not null default 0,
  campaign_spend_cents bigint not null default 0,
  cac_cents bigint,
  cost_per_meeting_cents bigint,
  roas_bps bigint,
  contact_ready_rate_bps integer,
  send_rate_bps integer,
  reply_rate_bps integer,
  positive_reply_rate_bps integer,
  meeting_rate_bps integer,
  proposal_rate_bps integer,
  sent_to_win_rate_bps integer,
  closed_win_rate_bps integer,
  avg_days_to_first_reply numeric(10,2),
  avg_days_to_win numeric(10,2),
  sample_maturity text not null default 'none' check (sample_maturity in ('none','small','developing','mature')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,metric_date,window_days,dimension_type,dimension_key)
);
create index if not exists idx_skylight_sales_acquisition_metrics_latest
  on public.skylight_sales_acquisition_metrics(tenant_id,metric_date desc,window_days,dimension_type,dimension_key);
create index if not exists idx_skylight_sales_acquisition_metrics_dimension
  on public.skylight_sales_acquisition_metrics(tenant_id,dimension_type,dimension_key,window_days,metric_date desc);

alter table public.skylight_sales_acquisition_settings enable row level security;
alter table public.skylight_sales_campaign_spend enable row level security;
alter table public.skylight_sales_acquisition_experiments enable row level security;
alter table public.skylight_sales_acquisition_metrics enable row level security;

create policy "staff manage skylight acquisition settings" on public.skylight_sales_acquisition_settings
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff manage skylight campaign spend" on public.skylight_sales_campaign_spend
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff manage skylight acquisition experiments" on public.skylight_sales_acquisition_experiments
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff read skylight acquisition metrics" on public.skylight_sales_acquisition_metrics
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff insert skylight acquisition metrics" on public.skylight_sales_acquisition_metrics
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff update skylight acquisition metrics" on public.skylight_sales_acquisition_metrics
for update to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff delete skylight acquisition metrics" on public.skylight_sales_acquisition_metrics
for delete to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

revoke all on table public.skylight_sales_acquisition_settings from anon;
revoke all on table public.skylight_sales_campaign_spend from anon;
revoke all on table public.skylight_sales_acquisition_experiments from anon;
revoke all on table public.skylight_sales_acquisition_metrics from anon;

grant select,insert,update,delete on table public.skylight_sales_acquisition_settings to authenticated;
grant select,insert,update,delete on table public.skylight_sales_campaign_spend to authenticated;
grant select,insert,update,delete on table public.skylight_sales_acquisition_experiments to authenticated;
grant select,insert,update,delete on table public.skylight_sales_acquisition_metrics to authenticated;

grant all on table public.skylight_sales_acquisition_settings to service_role;
grant all on table public.skylight_sales_campaign_spend to service_role;
grant all on table public.skylight_sales_acquisition_experiments to service_role;
grant all on table public.skylight_sales_acquisition_metrics to service_role;