create table if not exists public.data_quality_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  object_type text not null check (object_type in ('business','branch','seo_market')),
  object_key text not null,
  business_id uuid references public.businesses(id) on delete cascade,
  branch_id uuid references public.business_locations(id) on delete cascade,
  seo_gap_id uuid references public.seo_market_gaps(id) on delete cascade,
  task_type text not null check (task_type in ('business_provenance','branch_provenance','business_reverify','branch_reverify','seo_inventory')),
  priority text not null default 'medium' check (priority in ('low','medium','high','hot')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','ignored')),
  title text not null,
  details text,
  source_snapshot jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  assigned_user_id uuid references auth.users(id) on delete set null,
  notes text,
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, task_type, object_key)
);

create index if not exists data_quality_tasks_open_due_idx
  on public.data_quality_tasks (tenant_id, status, priority, due_at)
  where status in ('open','in_progress');
create index if not exists data_quality_tasks_business_idx on public.data_quality_tasks(business_id);
create index if not exists data_quality_tasks_branch_idx on public.data_quality_tasks(branch_id);
create index if not exists data_quality_tasks_seo_gap_idx on public.data_quality_tasks(seo_gap_id);
create index if not exists data_quality_tasks_assigned_user_idx on public.data_quality_tasks(assigned_user_id);

alter table public.data_quality_tasks enable row level security;
revoke all on table public.data_quality_tasks from anon;
revoke all on table public.data_quality_tasks from authenticated;
grant select, update on table public.data_quality_tasks to authenticated;

create policy "staff read data quality tasks"
on public.data_quality_tasks
for select
to authenticated
using (private.has_tenant_role(tenant_id, array['staff'::text,'admin'::text,'super_admin'::text]));

create policy "staff update data quality tasks"
on public.data_quality_tasks
for update
to authenticated
using (private.has_tenant_role(tenant_id, array['staff'::text,'admin'::text,'super_admin'::text]))
with check (private.has_tenant_role(tenant_id, array['staff'::text,'admin'::text,'super_admin'::text]));

create or replace function private.refresh_data_quality_tasks(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_provenance integer := 0;
  v_branch_provenance integer := 0;
  v_business_reverify integer := 0;
  v_branch_reverify integer := 0;
  v_seo_inventory integer := 0;
  v_resolved integer := 0;
  v_last integer := 0;
begin
  if p_tenant_id is null then raise exception 'tenant_id_required'; end if;

  insert into public.data_quality_tasks(tenant_id,object_type,object_key,business_id,task_type,priority,status,title,details,source_snapshot,due_at,last_seen_at,updated_at)
  select p_tenant_id,'business','business:'||b.id::text,b.id,'business_provenance','high','open',
    'Complete listing provenance · '||b.name,
    'Published listing is missing a business-level source URL or source checked date. Confirm the current public source before treating the listing as provenance-complete.',
    jsonb_build_object('business_name',b.name,'source_name',b.source_name,'source_url',b.source_url,'source_checked_at',b.source_checked_at),now(),now(),now()
  from public.businesses b
  where b.tenant_id=p_tenant_id and b.status='published'
    and (nullif(btrim(coalesce(b.source_url,'')),'') is null or b.source_checked_at is null)
  on conflict (tenant_id,task_type,object_key) do update set
    priority=excluded.priority,title=excluded.title,details=excluded.details,source_snapshot=excluded.source_snapshot,due_at=excluded.due_at,last_seen_at=now(),updated_at=now(),
    status=case when public.data_quality_tasks.status='ignored' then 'ignored' else 'open' end,
    resolved_at=case when public.data_quality_tasks.status='ignored' then public.data_quality_tasks.resolved_at else null end;
  get diagnostics v_business_provenance = row_count;

  update public.data_quality_tasks q set status='resolved',resolved_at=now(),updated_at=now()
  where q.tenant_id=p_tenant_id and q.task_type='business_provenance' and q.status in ('open','in_progress')
    and not exists (select 1 from public.businesses b where b.id=q.business_id and b.tenant_id=p_tenant_id and b.status='published' and (nullif(btrim(coalesce(b.source_url,'')),'') is null or b.source_checked_at is null));
  get diagnostics v_last = row_count; v_resolved := v_resolved + v_last;

  insert into public.data_quality_tasks(tenant_id,object_type,object_key,business_id,branch_id,task_type,priority,status,title,details,source_snapshot,due_at,last_seen_at,updated_at)
  select p_tenant_id,'branch','branch:'||bl.id::text,bl.business_id,bl.id,'branch_provenance','high','open',
    'Complete branch provenance · '||b.name||' · '||coalesce(nullif(bl.city,''),'Unknown market'),
    'Active branch/location record is missing a source URL or checked date. Verify the branch as a real location relationship before relying on it for market inventory.',
    jsonb_build_object('business_name',b.name,'city',bl.city,'location_type',bl.location_type,'source_name',bl.source_name,'source_url',bl.source_url,'source_checked_at',bl.source_checked_at),now(),now(),now()
  from public.business_locations bl join public.businesses b on b.id=bl.business_id and b.tenant_id=bl.tenant_id
  where bl.tenant_id=p_tenant_id and bl.is_active=true and b.status='published'
    and (nullif(btrim(coalesce(bl.source_url,'')),'') is null or bl.source_checked_at is null)
  on conflict (tenant_id,task_type,object_key) do update set
    business_id=excluded.business_id,priority=excluded.priority,title=excluded.title,details=excluded.details,source_snapshot=excluded.source_snapshot,due_at=excluded.due_at,last_seen_at=now(),updated_at=now(),
    status=case when public.data_quality_tasks.status='ignored' then 'ignored' else 'open' end,
    resolved_at=case when public.data_quality_tasks.status='ignored' then public.data_quality_tasks.resolved_at else null end;
  get diagnostics v_branch_provenance = row_count;

  update public.data_quality_tasks q set status='resolved',resolved_at=now(),updated_at=now()
  where q.tenant_id=p_tenant_id and q.task_type='branch_provenance' and q.status in ('open','in_progress')
    and not exists (select 1 from public.business_locations bl join public.businesses b on b.id=bl.business_id and b.tenant_id=bl.tenant_id where bl.id=q.branch_id and bl.tenant_id=p_tenant_id and bl.is_active=true and b.status='published' and (nullif(btrim(coalesce(bl.source_url,'')),'') is null or bl.source_checked_at is null));
  get diagnostics v_last = row_count; v_resolved := v_resolved + v_last;

  insert into public.data_quality_tasks(tenant_id,object_type,object_key,business_id,task_type,priority,status,title,details,source_snapshot,due_at,last_seen_at,updated_at)
  select p_tenant_id,'business','business:'||b.id::text,b.id,'business_reverify','medium','open',
    'Reverify listing source · '||b.name,
    'Business-level source evidence is at least 180 days old. Recheck the source and update source_checked_at only after confirming the listing facts remain current.',
    jsonb_build_object('business_name',b.name,'source_url',b.source_url,'source_checked_at',b.source_checked_at),b.source_checked_at+interval '180 days',now(),now()
  from public.businesses b
  where b.tenant_id=p_tenant_id and b.status='published' and b.source_checked_at is not null and b.source_checked_at<=now()-interval '180 days'
  on conflict (tenant_id,task_type,object_key) do update set
    priority=excluded.priority,title=excluded.title,details=excluded.details,source_snapshot=excluded.source_snapshot,due_at=excluded.due_at,last_seen_at=now(),updated_at=now(),
    status=case when public.data_quality_tasks.status='ignored' then 'ignored' else 'open' end,
    resolved_at=case when public.data_quality_tasks.status='ignored' then public.data_quality_tasks.resolved_at else null end;
  get diagnostics v_business_reverify = row_count;

  update public.data_quality_tasks q set status='resolved',resolved_at=now(),updated_at=now()
  where q.tenant_id=p_tenant_id and q.task_type='business_reverify' and q.status in ('open','in_progress')
    and not exists (select 1 from public.businesses b where b.id=q.business_id and b.tenant_id=p_tenant_id and b.status='published' and b.source_checked_at is not null and b.source_checked_at<=now()-interval '180 days');
  get diagnostics v_last = row_count; v_resolved := v_resolved + v_last;

  insert into public.data_quality_tasks(tenant_id,object_type,object_key,business_id,branch_id,task_type,priority,status,title,details,source_snapshot,due_at,last_seen_at,updated_at)
  select p_tenant_id,'branch','branch:'||bl.id::text,bl.business_id,bl.id,'branch_reverify','medium','open',
    'Reverify branch source · '||b.name||' · '||coalesce(nullif(bl.city,''),'Unknown market'),
    'Branch/location source evidence is at least 180 days old. Recheck the physical-location or service-area relationship before refreshing the checked date.',
    jsonb_build_object('business_name',b.name,'city',bl.city,'location_type',bl.location_type,'source_url',bl.source_url,'source_checked_at',bl.source_checked_at),bl.source_checked_at+interval '180 days',now(),now()
  from public.business_locations bl join public.businesses b on b.id=bl.business_id and b.tenant_id=bl.tenant_id
  where bl.tenant_id=p_tenant_id and bl.is_active=true and b.status='published' and bl.source_checked_at is not null and bl.source_checked_at<=now()-interval '180 days'
  on conflict (tenant_id,task_type,object_key) do update set
    business_id=excluded.business_id,priority=excluded.priority,title=excluded.title,details=excluded.details,source_snapshot=excluded.source_snapshot,due_at=excluded.due_at,last_seen_at=now(),updated_at=now(),
    status=case when public.data_quality_tasks.status='ignored' then 'ignored' else 'open' end,
    resolved_at=case when public.data_quality_tasks.status='ignored' then public.data_quality_tasks.resolved_at else null end;
  get diagnostics v_branch_reverify = row_count;

  update public.data_quality_tasks q set status='resolved',resolved_at=now(),updated_at=now()
  where q.tenant_id=p_tenant_id and q.task_type='branch_reverify' and q.status in ('open','in_progress')
    and not exists (select 1 from public.business_locations bl join public.businesses b on b.id=bl.business_id and b.tenant_id=bl.tenant_id where bl.id=q.branch_id and bl.tenant_id=p_tenant_id and bl.is_active=true and b.status='published' and bl.source_checked_at is not null and bl.source_checked_at<=now()-interval '180 days');
  get diagnostics v_last = row_count; v_resolved := v_resolved + v_last;

  insert into public.data_quality_tasks(tenant_id,object_type,object_key,seo_gap_id,task_type,priority,status,title,details,source_snapshot,due_at,last_seen_at,updated_at)
  select p_tenant_id,'seo_market','seo:'||g.id::text,g.id,'seo_inventory',case when g.current_providers=2 then 'high' when g.current_providers=1 then 'medium' else 'low' end,'open',
    'Inventory gap · '||g.category||' in '||g.city,
    case when g.current_providers=2 then 'One additional legitimate published provider would make this market eligible for the 3-provider indexing threshold. Research quality before quantity; do not force eligibility.' when g.current_providers=1 then 'Two additional legitimate providers are needed. Treat this as deeper inventory research, not a reason to create thin SEO content.' else 'This market remains below the live indexing threshold and needs legitimate provider inventory.' end,
    jsonb_build_object('city',g.city,'category',g.category,'current_providers',g.current_providers,'provider_gap',g.provider_gap,'gap_priority',g.priority,'reason',g.reason),case when g.current_providers=2 then now() else now()+interval '7 days' end,now(),now()
  from public.seo_market_gaps g where g.tenant_id=p_tenant_id and g.status='open' and g.current_providers<3
  on conflict (tenant_id,task_type,object_key) do update set
    priority=excluded.priority,title=excluded.title,details=excluded.details,source_snapshot=excluded.source_snapshot,due_at=excluded.due_at,last_seen_at=now(),updated_at=now(),
    status=case when public.data_quality_tasks.status='ignored' then 'ignored' else 'open' end,
    resolved_at=case when public.data_quality_tasks.status='ignored' then public.data_quality_tasks.resolved_at else null end;
  get diagnostics v_seo_inventory = row_count;

  update public.data_quality_tasks q set status='resolved',resolved_at=now(),updated_at=now()
  where q.tenant_id=p_tenant_id and q.task_type='seo_inventory' and q.status in ('open','in_progress')
    and not exists (select 1 from public.seo_market_gaps g where g.id=q.seo_gap_id and g.tenant_id=p_tenant_id and g.status='open' and g.current_providers<3);
  get diagnostics v_last = row_count; v_resolved := v_resolved + v_last;

  return jsonb_build_object('business_provenance_seen',v_business_provenance,'branch_provenance_seen',v_branch_provenance,'business_reverify_seen',v_business_reverify,'branch_reverify_seen',v_branch_reverify,'seo_inventory_seen',v_seo_inventory,'resolved_now',v_resolved,'refreshed_at',now());
end;
$$;

revoke all on function private.refresh_data_quality_tasks(uuid) from public, anon, authenticated;

create or replace function private.refresh_all_data_quality_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare r record; n integer:=0;
begin
  for r in select id from public.tenants loop
    perform private.refresh_data_quality_tasks(r.id);
    n:=n+1;
  end loop;
  return n;
end;
$$;

revoke all on function private.refresh_all_data_quality_tasks() from public, anon, authenticated;

select cron.schedule(
  'central-il-data-quality-refresh',
  '50 12 * * *',
  'select private.refresh_all_data_quality_tasks();'
);

select private.refresh_data_quality_tasks('6673621d-b359-4c17-a984-c8f50d914eb3'::uuid);
