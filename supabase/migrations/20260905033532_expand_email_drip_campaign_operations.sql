alter table public.email_drip_campaigns
  add column if not exists audience_rules jsonb not null default '{}'::jsonb,
  add column if not exists start_at timestamptz,
  add column if not exists send_timezone text not null default 'America/Chicago',
  add column if not exists send_hour smallint not null default 10,
  add column if not exists campaign_goal text not null default 'education',
  add column if not exists utm_source text not null default 'central_il_local_pros',
  add column if not exists utm_medium text not null default 'email',
  add column if not exists utm_campaign text;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='email_drip_campaigns_send_hour_check') then
    alter table public.email_drip_campaigns add constraint email_drip_campaigns_send_hour_check check(send_hour between 0 and 23);
  end if;
end $$;

alter table public.email_drip_enrollments
  add column if not exists source text not null default 'automatic',
  add column if not exists paused_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.email_outbox
  add column if not exists tracking_token uuid not null default gen_random_uuid(),
  add column if not exists open_count integer not null default 0,
  add column if not exists click_count integer not null default 0,
  add column if not exists first_opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists first_clicked_at timestamptz,
  add column if not exists last_clicked_at timestamptz;

create unique index if not exists email_outbox_tracking_token_key on public.email_outbox(tracking_token);
create index if not exists email_outbox_campaign_status_idx on public.email_outbox(campaign_id,status,scheduled_for desc);
create index if not exists email_drip_enrollments_campaign_status_idx on public.email_drip_enrollments(campaign_id,status,next_send_at);

create table if not exists public.email_engagement_events(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  outbox_id uuid not null references public.email_outbox(id) on delete cascade,
  campaign_id uuid references public.email_drip_campaigns(id) on delete set null,
  enrollment_id uuid references public.email_drip_enrollments(id) on delete set null,
  step_id uuid references public.email_drip_steps(id) on delete set null,
  event_type text not null check(event_type in('open','click')),
  occurred_at timestamptz not null default now()
);
create index if not exists email_engagement_events_campaign_idx on public.email_engagement_events(campaign_id,event_type,occurred_at desc);
create index if not exists email_engagement_events_outbox_idx on public.email_engagement_events(outbox_id,occurred_at desc);

alter table public.email_engagement_events enable row level security;
drop policy if exists "tenant staff manage email engagement events" on public.email_engagement_events;
create policy "tenant staff manage email engagement events" on public.email_engagement_events
for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']::text[]))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']::text[]));

revoke all on public.email_engagement_events from anon;
grant select,insert,update,delete on public.email_engagement_events to authenticated;

create or replace function public.record_email_open(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_row public.email_outbox%rowtype;
begin
  select * into v_row from public.email_outbox where tracking_token=p_token and status='sent' limit 1;
  if not found then return false; end if;
  update public.email_outbox
     set open_count=open_count+1,
         first_opened_at=coalesce(first_opened_at,now()),
         last_opened_at=now(),
         updated_at=now()
   where id=v_row.id;
  insert into public.email_engagement_events(tenant_id,outbox_id,campaign_id,enrollment_id,step_id,event_type)
  values(v_row.tenant_id,v_row.id,v_row.campaign_id,v_row.enrollment_id,v_row.step_id,'open');
  return true;
end;$$;

create or replace function public.record_email_click(p_token uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_row public.email_outbox%rowtype;
begin
  select * into v_row from public.email_outbox where tracking_token=p_token and status='sent' limit 1;
  if not found then return null; end if;
  update public.email_outbox
     set click_count=click_count+1,
         first_clicked_at=coalesce(first_clicked_at,now()),
         last_clicked_at=now(),
         updated_at=now()
   where id=v_row.id;
  insert into public.email_engagement_events(tenant_id,outbox_id,campaign_id,enrollment_id,step_id,event_type)
  values(v_row.tenant_id,v_row.id,v_row.campaign_id,v_row.enrollment_id,v_row.step_id,'click');
  return v_row.cta_url;
end;$$;

revoke all on function public.record_email_open(uuid) from public;
revoke all on function public.record_email_click(uuid) from public;
grant execute on function public.record_email_open(uuid) to anon,authenticated;
grant execute on function public.record_email_click(uuid) to anon,authenticated;
