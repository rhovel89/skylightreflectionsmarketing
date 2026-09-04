create or replace function private.ensure_acquisition_research_prospects(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linked integer := 0;
  v_inserted integer := 0;
  v_remaining integer := 0;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id_required';
  end if;

  with matches as (
    select p.id as prospect_id, min(b.id::text)::uuid as business_id
    from public.business_prospects p
    join public.businesses b
      on b.tenant_id = p.tenant_id
     and b.status = 'published'
     and not coalesce(b.claimed, false)
     and lower(regexp_replace(b.name, '[^a-z0-9]+', '', 'g')) = lower(regexp_replace(p.business_name, '[^a-z0-9]+', '', 'g'))
    where p.tenant_id = p_tenant_id and p.business_id is null
    group by p.id
    having count(*) = 1
  )
  update public.business_prospects p
     set business_id = m.business_id, updated_at = now()
    from matches m
   where p.id = m.prospect_id;
  get diagnostics v_linked = row_count;

  with candidates as (
    select b.id as business_id,b.name as business_name,b.address_text,b.phone,b.website,b.source_name,b.source_url,b.source_checked_at,
           pc.category,pc.vertical,pl.city as physical_city,sa.city as service_area_city
    from public.businesses b
    left join lateral (
      select c.name as category,c.vertical from public.business_categories bc join public.categories c on c.id=bc.category_id
      where bc.business_id=b.id and c.tenant_id=b.tenant_id and c.is_active=true
      order by coalesce(bc.is_primary,false) desc,c.name asc limit 1
    ) pc on true
    left join lateral (
      select coalesce(nullif(bl.city,''),l.name) as city from public.business_locations bl left join public.locations l on l.id=bl.location_id
      where bl.business_id=b.id and bl.tenant_id=b.tenant_id and bl.is_active=true
      order by coalesce(bl.is_primary,false) desc,bl.created_at asc limit 1
    ) pl on true
    left join lateral (
      select l.name as city from public.business_service_areas bsa join public.locations l on l.id=bsa.location_id and l.tenant_id=b.tenant_id
      where bsa.business_id=b.id and l.is_active=true order by l.name asc limit 1
    ) sa on true
    where b.tenant_id=p_tenant_id and b.status='published' and not coalesce(b.claimed,false)
      and b.source_checked_at is not null and pc.vertical in ('home','legal','restaurant','retail','other')
      and not exists(select 1 from public.business_prospects p where p.tenant_id=b.tenant_id and p.business_id=b.id)
  )
  insert into public.business_prospects(
    tenant_id,business_id,business_name,vertical,category,city,address,phone,website,source_name,source_url,source_ref,
    source_checked_at,status,opportunity_score,marketing_flags,notes,crm_stage,priority
  )
  select p_tenant_id,c.business_id,c.business_name,c.vertical,c.category,coalesce(c.physical_city,c.service_area_city),c.address_text,c.phone,c.website,
         c.source_name,c.source_url,'published_listing:'||c.business_id::text,c.source_checked_at,'research',0,array[]::text[],
         'System-created contact research record from published listing facts. Owner/decision-maker identity is not yet researched; generic business contact fields are not owner-contact evidence. ' ||
         case when c.physical_city is not null then 'Physical market context: '||c.physical_city||'.'
              when c.service_area_city is not null then 'Service-area context: '||c.service_area_city||'; this does not represent a local office.'
              else 'No physical or service-area market relationship is currently recorded; research that relationship before claim outreach.' end,
         'research','medium'
  from candidates c;
  get diagnostics v_inserted = row_count;

  select count(*)::integer into v_remaining from public.businesses b
  where b.tenant_id=p_tenant_id and b.status='published' and not coalesce(b.claimed,false)
    and not exists(select 1 from public.business_prospects p where p.tenant_id=b.tenant_id and p.business_id=b.id);

  return jsonb_build_object('tenant_id',p_tenant_id,'linked_existing',v_linked,'inserted_research_records',v_inserted,
    'remaining_without_linked_research',v_remaining,'owner_contacts_created',0,'outreach_events_created',0,'refreshed_at',now());
end;
$$;

revoke all on function private.ensure_acquisition_research_prospects(uuid) from public, anon, authenticated;

create or replace function private.refresh_all_growth_opportunities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare r record;n integer:=0;
begin
  for r in select distinct tenant_id from public.businesses where tenant_id is not null loop
    perform private.ensure_acquisition_research_prospects(r.tenant_id);
    perform private.refresh_growth_opportunities(r.tenant_id);
    perform private.sync_growth_outreach_tasks(r.tenant_id);
    n:=n+1;
  end loop;
  return n;
end;
$$;

comment on function private.ensure_acquisition_research_prospects(uuid) is
  'Creates internal contact-research prospect records for published unclaimed businesses using existing listing facts only. It never creates owner contacts, claim outreach, or contact timestamps, and service-area context is explicitly not represented as a physical office.';