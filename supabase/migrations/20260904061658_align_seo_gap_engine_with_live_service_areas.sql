create or replace function private.refresh_seo_market_gaps_system(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_one_away integer;
  v_two_away integer;
  v_filled integer;
begin
  if p_tenant_id is null then raise exception 'tenant_id_required'; end if;

  with business_markets as (
    select b.id as business_id, b.primary_location_id as market_location_id
    from public.businesses b
    where b.tenant_id=p_tenant_id and b.status='published' and b.primary_location_id is not null
    union
    select b.id, bl.location_id
    from public.businesses b
    join public.business_locations bl on bl.business_id=b.id and bl.tenant_id=p_tenant_id and bl.is_active=true and bl.location_id is not null
    where b.tenant_id=p_tenant_id and b.status='published'
    union
    select b.id, bsa.location_id
    from public.businesses b
    join public.business_service_areas bsa on bsa.business_id=b.id and bsa.location_id is not null
    join public.locations sa_location on sa_location.id=bsa.location_id and sa_location.tenant_id=p_tenant_id and sa_location.is_active=true
    where b.tenant_id=p_tenant_id and b.status='published'
  ), counts as (
    select l.id as market_location_id,l.name as city,c.id as category_id,c.name as category,count(distinct bm.business_id)::int as providers
    from business_markets bm
    join public.locations l on l.id=bm.market_location_id and l.tenant_id=p_tenant_id and l.is_active=true and l.type='city'
    join public.business_categories bc on bc.business_id=bm.business_id
    join public.categories c on c.id=bc.category_id and c.tenant_id=p_tenant_id and c.is_active=true
    group by l.id,l.name,c.id,c.name
  )
  insert into public.seo_market_gaps(tenant_id,market_location_id,category_id,city,category,current_providers,target_providers,status,priority,reason,last_calculated_at,updated_at)
  select p_tenant_id,market_location_id,category_id,city,category,providers,3,
    case when providers>=3 then 'filled' else 'open' end,
    case when providers>=3 then 'low' when providers=2 then 'high' when providers=1 then 'medium' else 'low' end,
    case when providers>=3 then 'Provider threshold met using legitimate published physical-location and clearly labeled service-area relationships.'
         when providers=2 then 'One additional legitimate published provider relationship would meet the current category-page threshold.'
         when providers=1 then 'Two additional legitimate published provider relationships are needed to meet the current category-page threshold.'
         else 'No published providers currently remain in this category and market.' end,
    now(),now()
  from counts
  on conflict (tenant_id,market_location_id,category_id) do update set
    city=excluded.city,category=excluded.category,current_providers=excluded.current_providers,target_providers=excluded.target_providers,status=excluded.status,priority=excluded.priority,reason=excluded.reason,last_calculated_at=now(),updated_at=now();

  update public.seo_market_gaps g
  set current_providers=0,status='open',priority='low',reason='No published providers currently remain in this category and market.',last_calculated_at=now(),updated_at=now()
  where g.tenant_id=p_tenant_id and not exists (
    select 1
    from public.businesses b
    join public.business_categories bc on bc.business_id=b.id
    where b.tenant_id=p_tenant_id and b.status='published' and bc.category_id=g.category_id
      and (b.primary_location_id=g.market_location_id
        or exists(select 1 from public.business_locations bl where bl.business_id=b.id and bl.tenant_id=p_tenant_id and bl.is_active=true and bl.location_id=g.market_location_id)
        or exists(select 1 from public.business_service_areas bsa join public.locations sa_location on sa_location.id=bsa.location_id and sa_location.tenant_id=p_tenant_id and sa_location.is_active=true where bsa.business_id=b.id and bsa.location_id=g.market_location_id))
  );

  select count(*) into v_one_away from public.seo_market_gaps where tenant_id=p_tenant_id and status='open' and current_providers=2;
  select count(*) into v_two_away from public.seo_market_gaps where tenant_id=p_tenant_id and status='open' and current_providers=1;
  select count(*) into v_filled from public.seo_market_gaps where tenant_id=p_tenant_id and status='filled';
  return jsonb_build_object('one_away',v_one_away,'two_away',v_two_away,'filled',v_filled,'provider_relationships','physical_or_service_area','refreshed_at',now());
end;
$$;

revoke all on function private.refresh_seo_market_gaps_system(uuid) from public,anon,authenticated;

create or replace function public.refresh_seo_market_gaps(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id=(select auth.uid()) and ur.tenant_id=p_tenant_id and ur.role in ('staff','admin','super_admin')
  ) then raise exception 'insufficient_privilege'; end if;
  return private.refresh_seo_market_gaps_system(p_tenant_id);
end;
$$;

revoke all on function public.refresh_seo_market_gaps(uuid) from public,anon;
grant execute on function public.refresh_seo_market_gaps(uuid) to authenticated,service_role;

create or replace function private.refresh_all_data_quality_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare r record; n integer:=0;
begin
  for r in select id from public.tenants loop
    perform private.refresh_seo_market_gaps_system(r.id);
    perform private.refresh_data_quality_tasks(r.id);
    n:=n+1;
  end loop;
  return n;
end;
$$;

revoke all on function private.refresh_all_data_quality_tasks() from public,anon,authenticated;

select private.refresh_seo_market_gaps_system('6673621d-b359-4c17-a984-c8f50d914eb3'::uuid);
select private.refresh_data_quality_tasks('6673621d-b359-4c17-a984-c8f50d914eb3'::uuid);
