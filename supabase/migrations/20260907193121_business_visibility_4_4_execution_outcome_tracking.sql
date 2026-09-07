create table if not exists public.business_visibility_execution_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  recommendation_id uuid not null references public.business_visibility_recommendations(id) on delete restrict,
  baseline_snapshot_id uuid not null references public.business_visibility_opportunity_snapshots(id) on delete restrict,
  remeasurement_snapshot_id uuid references public.business_visibility_opportunity_snapshots(id) on delete restrict,
  client_id uuid references public.skylight_clients(id) on delete set null,
  project_id uuid references public.skylight_projects(id) on delete set null,
  project_task_id uuid references public.skylight_project_tasks(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','in_progress','work_completed','remeasurement_due','remeasured','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  work_summary text,
  before_evidence jsonb not null default '[]'::jsonb,
  work_evidence jsonb not null default '[]'::jsonb,
  work_completed_at timestamptz,
  work_completed_by uuid references auth.users(id) on delete set null,
  remeasurement_due_date date,
  remeasured_at timestamptz,
  remeasured_by uuid references auth.users(id) on delete set null,
  outcome_status text not null default 'pending' check (outcome_status in ('pending','not_comparable','improved','mixed','no_change','declined')),
  outcome_summary text,
  outcome_metrics jsonb not null default '[]'::jsonb,
  outcome_source_refs jsonb not null default '[]'::jsonb,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recommendation_id)
);

create table if not exists public.business_visibility_execution_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  execution_id uuid not null references public.business_visibility_execution_items(id) on delete cascade,
  event_type text not null check (event_type in ('created','claimed','unassigned','started','project_task_linked','work_note_added','work_completed','remeasurement_scheduled','remeasurement_recorded','outcome_recorded','cancelled','reopened')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.business_visibility_report_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid references public.skylight_clients(id) on delete set null,
  cadence text not null check (cadence in ('monthly','quarterly')),
  next_due_date date not null,
  active boolean not null default true,
  assigned_user_id uuid references auth.users(id) on delete set null,
  last_report_id uuid references public.business_visibility_reports(id) on delete set null,
  last_completed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,business_id)
);

create index if not exists idx_visibility_execution_items_tenant_business on public.business_visibility_execution_items(tenant_id,business_id,status,due_date);
create index if not exists idx_visibility_execution_items_business on public.business_visibility_execution_items(business_id,updated_at desc);
create index if not exists idx_visibility_execution_items_baseline on public.business_visibility_execution_items(baseline_snapshot_id);
create index if not exists idx_visibility_execution_items_remeasurement on public.business_visibility_execution_items(remeasurement_snapshot_id) where remeasurement_snapshot_id is not null;
create index if not exists idx_visibility_execution_items_client on public.business_visibility_execution_items(client_id) where client_id is not null;
create index if not exists idx_visibility_execution_items_project on public.business_visibility_execution_items(project_id) where project_id is not null;
create unique index if not exists idx_visibility_execution_items_project_task_unique on public.business_visibility_execution_items(project_task_id) where project_task_id is not null;
create index if not exists idx_visibility_execution_items_assigned on public.business_visibility_execution_items(assigned_user_id) where assigned_user_id is not null;
create index if not exists idx_visibility_execution_items_created_by on public.business_visibility_execution_items(created_by) where created_by is not null;
create index if not exists idx_visibility_execution_items_updated_by on public.business_visibility_execution_items(updated_by) where updated_by is not null;
create index if not exists idx_visibility_execution_items_completed_by on public.business_visibility_execution_items(work_completed_by) where work_completed_by is not null;
create index if not exists idx_visibility_execution_items_remeasured_by on public.business_visibility_execution_items(remeasured_by) where remeasured_by is not null;

create index if not exists idx_visibility_execution_events_execution on public.business_visibility_execution_events(execution_id,created_at desc);
create index if not exists idx_visibility_execution_events_tenant_business on public.business_visibility_execution_events(tenant_id,business_id,created_at desc);
create index if not exists idx_visibility_execution_events_business on public.business_visibility_execution_events(business_id,created_at desc);
create index if not exists idx_visibility_execution_events_actor on public.business_visibility_execution_events(actor_user_id) where actor_user_id is not null;

create index if not exists idx_visibility_report_schedules_business on public.business_visibility_report_schedules(business_id,next_due_date);
create index if not exists idx_visibility_report_schedules_client on public.business_visibility_report_schedules(client_id) where client_id is not null;
create index if not exists idx_visibility_report_schedules_assigned on public.business_visibility_report_schedules(assigned_user_id) where assigned_user_id is not null;
create index if not exists idx_visibility_report_schedules_last_report on public.business_visibility_report_schedules(last_report_id) where last_report_id is not null;
create index if not exists idx_visibility_report_schedules_created_by on public.business_visibility_report_schedules(created_by) where created_by is not null;
create index if not exists idx_visibility_report_schedules_updated_by on public.business_visibility_report_schedules(updated_by) where updated_by is not null;

alter table public.business_visibility_execution_items enable row level security;
alter table public.business_visibility_execution_events enable row level security;
alter table public.business_visibility_report_schedules enable row level security;

revoke all on table public.business_visibility_execution_items from anon, authenticated;
revoke all on table public.business_visibility_execution_events from anon, authenticated;
revoke all on table public.business_visibility_report_schedules from anon, authenticated;

grant select,insert,update on table public.business_visibility_execution_items to authenticated;
grant select,insert on table public.business_visibility_execution_events to authenticated;
grant select,insert,update on table public.business_visibility_report_schedules to authenticated;
grant all on table public.business_visibility_execution_items to service_role;
grant all on table public.business_visibility_execution_events to service_role;
grant all on table public.business_visibility_report_schedules to service_role;

create policy "staff manage visibility execution items" on public.business_visibility_execution_items
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff read visibility execution events" on public.business_visibility_execution_events
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff insert visibility execution events" on public.business_visibility_execution_events
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff manage visibility report schedules" on public.business_visibility_report_schedules
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));