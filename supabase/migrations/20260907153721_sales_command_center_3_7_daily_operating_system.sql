-- Sales Command Center 3.7
-- Daily operating system: deterministic action queue, editable thresholds, calendar linkage, and factual snapshots.
-- This release creates administrative tasks only. It never sends outreach, invoices, proposals, calendar invites, or changes public rankings.

create table if not exists public.skylight_sales_action_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  action_queue_enabled boolean not null default true,
  auto_create_tasks boolean not null default true,
  daily_snapshot_enabled boolean not null default true,
  stale_opportunity_days integer not null default 14 check (stale_opportunity_days between 1 and 180),
  proposal_sent_followup_days integer not null default 3 check (proposal_sent_followup_days between 1 and 60),
  proposal_viewed_followup_days integer not null default 2 check (proposal_viewed_followup_days between 1 and 60),
  proposal_expiring_days integer not null default 3 check (proposal_expiring_days between 0 and 30),
  meeting_reminder_hours integer not null default 24 check (meeting_reminder_hours between 1 and 168),
  invoice_due_soon_days integer not null default 3 check (invoice_due_soon_days between 0 and 30),
  hot_score_threshold integer not null default 80 check (hot_score_threshold between 1 and 100),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skylight_sales_action_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opportunity_id uuid references public.skylight_sales_opportunities(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete cascade,
  campaign_id uuid references public.skylight_sales_campaigns(id) on delete set null,
  reply_id uuid references public.skylight_sales_replies(id) on delete set null,
  followup_id uuid references public.skylight_sales_followups(id) on delete set null,
  meeting_id uuid references public.skylight_sales_meetings(id) on delete set null,
  proposal_handoff_id uuid references public.skylight_sales_proposal_handoffs(id) on delete set null,
  proposal_id uuid references public.skylight_proposals(id) on delete set null,
  invoice_id uuid references public.skylight_invoices(id) on delete set null,
  unmatched_inbound_id uuid references public.skylight_sales_unmatched_inbound(id) on delete set null,
  action_type text not null check (action_type in (
    'reply_review','unmatched_inbound_review','response_approval','followup_due','opportunity_stalled','hot_opportunity',
    'meeting_upcoming','proposal_create','proposal_followup','proposal_expiring','invoice_due','invoice_overdue',
    'revenue_sync','win_loss_review','client_project_handoff'
  )),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','completed','dismissed')),
  fingerprint text not null,
  title text not null,
  reason text not null,
  recommended_action text not null,
  due_at timestamptz,
  snoozed_until timestamptz,
  assigned_user_id uuid,
  auto_generated boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  completed_by uuid,
  completed_at timestamptz,
  dismissed_by uuid,
  dismissed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_skylight_sales_action_items_active_fingerprint
  on public.skylight_sales_action_items(tenant_id,fingerprint)
  where status in ('open','in_progress');
create index if not exists idx_skylight_sales_action_items_queue
  on public.skylight_sales_action_items(tenant_id,status,priority,due_at,created_at desc);
create index if not exists idx_skylight_sales_action_items_opportunity
  on public.skylight_sales_action_items(opportunity_id,status,created_at desc) where opportunity_id is not null;
create index if not exists idx_skylight_sales_action_items_assigned
  on public.skylight_sales_action_items(tenant_id,assigned_user_id,status,due_at) where assigned_user_id is not null;
create index if not exists idx_skylight_sales_action_items_reply on public.skylight_sales_action_items(reply_id) where reply_id is not null;
create index if not exists idx_skylight_sales_action_items_followup on public.skylight_sales_action_items(followup_id) where followup_id is not null;
create index if not exists idx_skylight_sales_action_items_meeting on public.skylight_sales_action_items(meeting_id) where meeting_id is not null;
create index if not exists idx_skylight_sales_action_items_handoff on public.skylight_sales_action_items(proposal_handoff_id) where proposal_handoff_id is not null;
create index if not exists idx_skylight_sales_action_items_proposal on public.skylight_sales_action_items(proposal_id) where proposal_id is not null;
create index if not exists idx_skylight_sales_action_items_invoice on public.skylight_sales_action_items(invoice_id) where invoice_id is not null;
create index if not exists idx_skylight_sales_action_items_unmatched on public.skylight_sales_action_items(unmatched_inbound_id) where unmatched_inbound_id is not null;

create table if not exists public.skylight_sales_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric_date date not null,
  dimension_type text not null default 'overall' check (dimension_type in ('overall','campaign','service')),
  dimension_key text not null default 'all',
  opportunities integer not null default 0,
  active_opportunities integer not null default 0,
  contact_ready integer not null default 0,
  contacted integer not null default 0,
  qualified integer not null default 0,
  proposal_stage integer not null default 0,
  won integer not null default 0,
  lost integer not null default 0,
  replies integer not null default 0,
  positive_replies integer not null default 0,
  meetings integer not null default 0,
  proposals integer not null default 0,
  proposal_value_cents bigint not null default 0,
  invoices integer not null default 0,
  invoiced_value_cents bigint not null default 0,
  paid_revenue_cents bigint not null default 0,
  avg_days_to_win numeric(10,2),
  win_rate_bps integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,metric_date,dimension_type,dimension_key)
);
create index if not exists idx_skylight_sales_daily_metrics_recent
  on public.skylight_sales_daily_metrics(tenant_id,metric_date desc,dimension_type,dimension_key);

create table if not exists public.skylight_sales_automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  run_type text not null check (run_type in ('action_refresh','metrics_snapshot','revenue_reconcile','release_diagnostic')),
  source text not null default 'staff' check (source in ('staff','cron','system')),
  status text not null default 'running' check (status in ('running','completed','failed')),
  generated_count integer not null default 0,
  updated_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  started_by uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_skylight_sales_automation_runs_recent
  on public.skylight_sales_automation_runs(tenant_id,started_at desc);

alter table public.skylight_sales_meetings
  add column if not exists external_calendar_provider text check (external_calendar_provider is null or external_calendar_provider in ('google')),
  add column if not exists external_calendar_url text,
  add column if not exists calendar_sync_status text not null default 'not_linked' check (calendar_sync_status in ('not_linked','creating','linked','failed')),
  add column if not exists calendar_created_at timestamptz,
  add column if not exists calendar_last_error text;

create index if not exists idx_skylight_sales_opportunities_action_queue
  on public.skylight_sales_opportunities(tenant_id,active,stage,priority,updated_at desc);
create index if not exists idx_skylight_proposals_sales_followup
  on public.skylight_proposals(tenant_id,status,sent_at,viewed_at,expires_at);
create index if not exists idx_skylight_invoices_sales_followup
  on public.skylight_invoices(tenant_id,status,due_date,balance_due_cents);
create index if not exists idx_skylight_sales_meetings_schedule
  on public.skylight_sales_meetings(tenant_id,status,scheduled_at);

alter table public.skylight_sales_action_settings enable row level security;
alter table public.skylight_sales_action_items enable row level security;
alter table public.skylight_sales_daily_metrics enable row level security;
alter table public.skylight_sales_automation_runs enable row level security;

create policy "staff manage skylight sales action settings" on public.skylight_sales_action_settings
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff manage skylight sales action items" on public.skylight_sales_action_items
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff read skylight sales daily metrics" on public.skylight_sales_daily_metrics
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff write skylight sales daily metrics" on public.skylight_sales_daily_metrics
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff update skylight sales daily metrics" on public.skylight_sales_daily_metrics
for update to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff read skylight sales automation runs" on public.skylight_sales_automation_runs
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff write skylight sales automation runs" on public.skylight_sales_automation_runs
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff update skylight sales automation runs" on public.skylight_sales_automation_runs
for update to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

revoke all on table public.skylight_sales_action_settings from anon;
revoke all on table public.skylight_sales_action_items from anon;
revoke all on table public.skylight_sales_daily_metrics from anon;
revoke all on table public.skylight_sales_automation_runs from anon;

grant select,insert,update,delete on table public.skylight_sales_action_settings to authenticated;
grant select,insert,update,delete on table public.skylight_sales_action_items to authenticated;
grant select,insert,update on table public.skylight_sales_daily_metrics to authenticated;
grant select,insert,update on table public.skylight_sales_automation_runs to authenticated;

grant all on table public.skylight_sales_action_settings to service_role;
grant all on table public.skylight_sales_action_items to service_role;
grant all on table public.skylight_sales_daily_metrics to service_role;
grant all on table public.skylight_sales_automation_runs to service_role;
