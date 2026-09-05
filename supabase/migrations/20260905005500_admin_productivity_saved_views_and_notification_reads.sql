create table if not exists public.admin_saved_views (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  scope text not null,
  name text not null,
  query_params jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_saved_views_scope_name_unique unique (tenant_id,user_id,scope,name),
  constraint admin_saved_views_scope_check check (char_length(scope) between 1 and 80),
  constraint admin_saved_views_name_check check (char_length(name) between 1 and 120)
);

create index if not exists admin_saved_views_user_scope_idx
  on public.admin_saved_views(tenant_id,user_id,scope,updated_at desc);

create table if not exists public.admin_notification_reads (
  tenant_id uuid not null,
  user_id uuid not null,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key (tenant_id,user_id,notification_key),
  constraint admin_notification_reads_key_check check (char_length(notification_key) between 1 and 220)
);

create index if not exists admin_notification_reads_user_idx
  on public.admin_notification_reads(tenant_id,user_id,read_at desc);

alter table public.admin_saved_views enable row level security;
alter table public.admin_notification_reads enable row level security;

revoke all on public.admin_saved_views from anon;
revoke all on public.admin_notification_reads from anon;
grant select,insert,update,delete on public.admin_saved_views to authenticated;
grant select,insert,update,delete on public.admin_notification_reads to authenticated;

drop policy if exists admin_saved_views_own_rows on public.admin_saved_views;
create policy admin_saved_views_own_rows on public.admin_saved_views
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists admin_notification_reads_own_rows on public.admin_notification_reads;
create policy admin_notification_reads_own_rows on public.admin_notification_reads
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
