create or replace function private.sync_lead_buyer_recruitment_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_now timestamptz := now();
  v_upserted integer := 0;
  v_resolved integer := 0;
  v_members_upserted integer := 0;
begin
  with demand as (
    select
      trim(l.service) as service,
      trim(l.city) as city,
      regexp_replace(lower(trim(l.service)),'[^a-z0-9]+','','g') as service_key,
      regexp_replace(lower(trim(l.city)),'[^a-z0-9]+','','g') as city_key,
      count(*)::integer as demand_90
    from public.leads l
    where l.tenant_id=p_tenant_id
      and l.created_at>=v_now-interval '90 days'
      and coalesce(trim(l.service),'')<>''
      and coalesce(trim(l.city),'')<>''
    group by
      trim(l.service),trim(l.city),
      regexp_replace(lower(trim(l.service)),'[^a-z0-9]+','','g'),
      regexp_replace(lower(trim(l.city)),'[^a-z0-9]+','','g')
    having count(*)>=2
  ), coverage_raw as (
    select distinct
      b.id as business_id,
      regexp_replace(lower(trim(c.name)),'[^a-z0-9]+','','g') as service_key,
      regexp_replace(lower(trim(bl.city)),'[^a-z0-9]+','','g') as city_key,
      'physical_location'::text as coverage_source
    from public.businesses b
    join public.business_categories bc on bc.business_id=b.id
    join public.categories c on c.id=bc.category_id and c.tenant_id=p_tenant_id and c.is_active
    join public.business_locations bl on bl.business_id=b.id and bl.tenant_id=p_tenant_id and bl.is_active
    where b.tenant_id=p_tenant_id
      and b.status='published'
      and coalesce(trim(bl.city),'')<>''

    union all

    select distinct
      b.id as business_id,
      regexp_replace(lower(trim(c.name)),'[^a-z0-9]+','','g') as service_key,
      regexp_replace(lower(trim(l.name)),'[^a-z0-9]+','','g') as city_key,
      'service_area'::text as coverage_source
    from public.businesses b
    join public.business_categories bc on bc.business_id=b.id
    join public.categories c on c.id=bc.category_id and c.tenant_id=p_tenant_id and c.is_active
    join public.business_service_areas bsa on bsa.business_id=b.id
    join public.locations l on l.id=bsa.location_id and l.tenant_id=p_tenant_id and l.is_active
    where b.tenant_id=p_tenant_id
      and b.status='published'
      and coalesce(trim(l.name),'')<>''
  ), coverage as (
    select distinct on (cr.business_id,cr.service_key,cr.city_key)
      cr.business_id,cr.service_key,cr.city_key,cr.coverage_source
    from coverage_raw cr
    order by cr.business_id,cr.service_key,cr.city_key,
      case when cr.coverage_source='physical_location' then 0 else 1 end
  ), latest_prospect as (
    select distinct on (p.business_id)
      p.business_id,p.id as prospect_id,p.owner_contact_name,p.owner_contact_email,p.owner_contact_phone,
      p.owner_contact_source_url,p.owner_contact_checked_at,p.assigned_user_id
    from public.business_prospects p
    where p.tenant_id=p_tenant_id and p.business_id is not null
    order by p.business_id,p.updated_at desc,p.created_at desc,p.id desc
  ), latest_interest as (
    select distinct on (lr.business_id)
      lr.business_id,lr.lead_program_interest,lr.interest_updated_at
    from public.lead_recipients lr
    where lr.tenant_id=p_tenant_id and lr.interest_updated_at is not null
    order by lr.business_id,lr.interest_updated_at desc,lr.updated_at desc,lr.id desc
  ), base_candidates as (
    select
      b.id as business_id,b.name,d.service,d.city,d.service_key,d.city_key,d.demand_90,c.coverage_source,
      p.prospect_id,p.owner_contact_name,p.owner_contact_email,p.owner_contact_phone,
      p.owner_contact_source_url,p.owner_contact_checked_at,p.assigned_user_id,
      b.email as business_email,b.phone as business_phone,
      loc.email as location_email,loc.phone as location_phone,
      li.lead_program_interest,li.interest_updated_at,
      crm.sales_status,crm.reopened_at,crm.follow_up_at,
      (
        (coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'')
        and coalesce(trim(p.owner_contact_source_url),'')<>''
        and p.owner_contact_checked_at is not null
      ) as verified_owner_contact,
      (
        coalesce(trim(b.email),'')<>'' or coalesce(trim(b.phone),'')<>''
        or coalesce(trim(loc.email),'')<>'' or coalesce(trim(loc.phone),'')<>''
      ) as business_contact_available
    from demand d
    join coverage c on c.service_key=d.service_key and c.city_key=d.city_key
    join public.businesses b on b.id=c.business_id and b.tenant_id=p_tenant_id and b.status='published'
    left join latest_prospect p on p.business_id=b.id
    left join latest_interest li on li.business_id=b.id
    left join public.lead_buyer_crm_profiles crm on crm.tenant_id=p_tenant_id and crm.business_id=b.id
    left join lateral (
      select bl.email,bl.phone
      from public.business_locations bl
      where bl.tenant_id=p_tenant_id and bl.business_id=b.id and bl.is_active
        and (coalesce(trim(bl.email),'')<>'' or coalesce(trim(bl.phone),'')<>'')
      order by bl.is_primary desc,bl.updated_at desc,bl.id
      limit 1
    ) loc on true
    where not exists (
      select 1 from public.business_lead_programs lp
      where lp.tenant_id=p_tenant_id and lp.business_id=b.id and lp.status='active'
    )
      and coalesce(crm.sales_status,'open')<>'declined'
      and not (
        coalesce(li.lead_program_interest,'')='not_interested'
        and not (crm.reopened_at is not null and crm.reopened_at>li.interest_updated_at)
      )
  ), candidates as (
    select bc.*,
      (bc.verified_owner_contact or bc.business_contact_available) as contact_path_available,
      case
        when bc.verified_owner_contact then 'verified_owner_contact'
        when bc.business_contact_available then 'business_contact'
        else 'research_needed'
      end as contact_path_type,
      least(94,
        72
        + least(16,bc.demand_90*3)
        + case when bc.verified_owner_contact then 4 when bc.business_contact_available then 2 else 0 end
        + case when bc.coverage_source='physical_location' then 2 else 0 end
      )::integer as recruitment_score,
      case
        when bc.lead_program_interest='interested' then 'snoozed'
        when bc.sales_status='paused' then 'snoozed'
        else 'open'
      end as desired_status
    from base_candidates bc
  ), upserted as (
    insert into public.growth_opportunities(
      tenant_id,opportunity_key,opportunity_type,business_id,prospect_id,
      title,detail,score,estimated_monthly_value_cents,status,next_action,due_at,
      assigned_user_id,source_facts,last_refreshed_at,updated_at
    )
    select
      p_tenant_id,
      'lead-buyer-recruit:'||c.business_id::text||':'||c.service_key||':'||c.city_key,
      'lead_buyer_recruitment',
      c.business_id,c.prospect_id,
      'Recruit Lead Buyer · '||c.name||' · '||c.service||' in '||c.city,
      c.demand_90||' consumer request'||case when c.demand_90=1 then '' else 's' end||' for '||c.service||' in '||c.city||' were recorded in the last 90 days. This is historical first-party demand, not a guarantee of future lead volume. '||
        case when c.coverage_source='service_area' then 'The business is matched through a separately labeled service area; that service area is not treated as a physical office.' else 'The business has an active physical business location in this market.' end,
      c.recruitment_score,
      0,
      c.desired_status,
      case
        when c.lead_program_interest='interested' then 'The owner separately expressed interest in receiving more leads. Work the explicit Lead Buyer activation record and controlled agreement flow; interest alone does not authorize billing or routing.'
        when c.sales_status='paused' then 'Lead Buyer sales follow-up is paused in the CRM. Resume only after an Admin deliberately reopens the relationship.'
        when c.contact_path_type='verified_owner_contact' then 'A sourced owner/decision-maker contact is available. Prepare a factual human-reviewed outreach referencing historical demand; do not promise future volume or auto-enroll the business.'
        when c.contact_path_type='business_contact' then 'A business contact path is available, but it is not necessarily verified owner contact. Prepare human-reviewed outreach without claiming a decision-maker identity that has not been verified.'
        else 'Research a legitimate public business or owner/decision-maker contact before outreach. Do not fabricate a name, email, phone number or physical office.'
      end,
      case when c.desired_status='snoozed' then c.follow_up_at else v_now end,
      c.assigned_user_id,
      jsonb_build_object(
        'service',c.service,
        'city',c.city,
        'service_key',c.service_key,
        'city_key',c.city_key,
        'demand_90',c.demand_90,
        'coverage_source',c.coverage_source,
        'service_area_is_not_office',c.coverage_source='service_area',
        'contact_path_available',c.contact_path_available,
        'contact_path_type',c.contact_path_type,
        'verified_owner_contact',c.verified_owner_contact,
        'owner_explicit_interest',c.lead_program_interest='interested',
        'historical_demand_not_guaranteed',true,
        'consumer_contact_data_released',false,
        'automatic_outreach',false,
        'automatic_enrollment',false,
        'automatic_billing',false,
        'automatic_routing',false
      ),
      v_now,v_now
    from candidates c
    on conflict(tenant_id,opportunity_key) do update set
      opportunity_type='lead_buyer_recruitment',
      business_id=excluded.business_id,
      prospect_id=coalesce(excluded.prospect_id,public.growth_opportunities.prospect_id),
      title=excluded.title,
      detail=excluded.detail,
      score=excluded.score,
      estimated_monthly_value_cents=0,
      status=case
        when public.growth_opportunities.status in('won','lost','dismissed') then public.growth_opportunities.status
        when excluded.status='snoozed' then 'snoozed'
        when public.growth_opportunities.status='in_progress' then 'in_progress'
        else 'open'
      end,
      next_action=excluded.next_action,
      due_at=excluded.due_at,
      assigned_user_id=coalesce(public.growth_opportunities.assigned_user_id,excluded.assigned_user_id),
      source_facts=excluded.source_facts,
      last_refreshed_at=v_now,
      updated_at=v_now
    returning id
  )
  select count(*) into v_upserted from upserted;

  update public.growth_opportunities g
  set status='resolved',
      due_at=null,
      last_refreshed_at=v_now,
      updated_at=v_now,
      source_facts=coalesce(g.source_facts,'{}'::jsonb)||jsonb_build_object(
        'resolved_reason',case
          when exists(select 1 from public.business_lead_programs lp where lp.tenant_id=p_tenant_id and lp.business_id=g.business_id and lp.status='active') then 'active_lead_program'
          when not exists(select 1 from public.businesses b where b.id=g.business_id and b.tenant_id=p_tenant_id and b.status='published') then 'business_unavailable'
          else 'demand_or_eligibility_changed'
        end,
        'resolved_at',v_now
      )
  where g.tenant_id=p_tenant_id
    and g.opportunity_type='lead_buyer_recruitment'
    and g.status in('open','in_progress','snoozed')
    and g.last_refreshed_at<v_now;
  get diagnostics v_resolved=row_count;

  insert into public.skylight_sales_campaign_members(
    campaign_id,growth_opportunity_id,prospect_id,business_id,status,priority,
    assigned_user_id,next_action_at,notes,created_at,updated_at
  )
  select
    c.id,g.id,g.prospect_id,g.business_id,
    case
      when coalesce((g.source_facts->>'owner_explicit_interest')::boolean,false) then 'replied'
      when coalesce((g.source_facts->>'contact_path_available')::boolean,false) then 'ready'
      else 'research'
    end,
    case when g.score>=90 then 'hot' when g.score>=82 then 'high' when g.score>=72 then 'medium' else 'low' end,
    g.assigned_user_id,g.due_at,
    'Historical demand context only: '||coalesce(g.source_facts->>'demand_90','0')||' consumer requests in the last 90 days for '||coalesce(g.source_facts->>'service','this service')||' in '||coalesce(g.source_facts->>'city','this market')||'. Future volume is not guaranteed. Human approval is required before any outreach, agreement, routing or billing action.',
    v_now,v_now
  from public.skylight_sales_campaigns c
  join public.growth_opportunities g on g.tenant_id=c.tenant_id
  where c.tenant_id=p_tenant_id
    and c.status='active'
    and c.campaign_type='lead_buyer_recruitment'
    and g.opportunity_type='lead_buyer_recruitment'
    and g.last_refreshed_at=v_now
    and g.status in('open','in_progress','snoozed')
  on conflict(campaign_id,growth_opportunity_id) where growth_opportunity_id is not null do update set
    prospect_id=coalesce(excluded.prospect_id,public.skylight_sales_campaign_members.prospect_id),
    business_id=excluded.business_id,
    priority=excluded.priority,
    assigned_user_id=coalesce(public.skylight_sales_campaign_members.assigned_user_id,excluded.assigned_user_id),
    next_action_at=excluded.next_action_at,
    status=case
      when public.skylight_sales_campaign_members.status in('queued','research','ready') then excluded.status
      else public.skylight_sales_campaign_members.status
    end,
    updated_at=v_now;
  get diagnostics v_members_upserted=row_count;

  return jsonb_build_object(
    'tenant_id',p_tenant_id,
    'candidates_upserted',v_upserted,
    'stale_resolved',v_resolved,
    'campaign_members_upserted',v_members_upserted,
    'synced_at',v_now
  );
end;
$$;

revoke all on function private.sync_lead_buyer_recruitment_opportunities(uuid) from public,anon,authenticated;
