create or replace function private.sync_skylight_first_party_marketing_signals(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_changed integer := 0;
  v_flagged integer := 0;
begin
  with event_90 as (
    select le.business_id,
      count(*) filter (where le.event_type='impression')::integer as impressions,
      count(*) filter (where le.event_type='profile_view')::integer as profile_views,
      count(*) filter (where le.event_type in ('website_click','phone_click','email_click','lead_submit'))::integer as conversion_events
    from public.listing_events le
    where le.tenant_id=p_tenant_id and le.created_at>=now()-interval '90 days'
    group by le.business_id
  ), signal_rows as (
    select p.id prospect_id,
      array(
        select distinct flag from unnest(
          coalesce(array(select f from unnest(coalesce(p.marketing_flags,array[]::text[])) f where f not like 'first_party:%'),array[]::text[])
          || array_remove(array[
            case when b.status='published' and coalesce(nullif(trim(b.website),''),'')='' then 'first_party:missing_website' end,
            case when b.status='published' and coalesce(b.profile_score,0)<70 then 'first_party:low_profile_completion' end,
            case when b.status='published' and not exists(select 1 from public.business_catalog_items ci where ci.tenant_id=p_tenant_id and ci.business_id=b.id and ci.status='approved') then 'first_party:missing_catalog' end,
            case when b.status='published' and not exists(select 1 from public.business_portfolio_projects pp where pp.tenant_id=p_tenant_id and pp.business_id=b.id and pp.status='approved') then 'first_party:missing_portfolio' end,
            case when b.status='published' and coalesce(b.review_count,0)>=20 and coalesce(b.rating,0)>=4 and coalesce(nullif(trim(b.website),''),'')='' then 'first_party:strong_reviews_weak_web' end,
            case when b.status='published' and (coalesce(e.impressions,0)>=25 or coalesce(e.profile_views,0)>=3) and coalesce(e.conversion_events,0)=0 then 'first_party:high_visibility_low_conversion' end,
            case when b.status='published' and b.claimed and (coalesce(b.profile_score,0)<80 or not exists(select 1 from public.business_catalog_items ci where ci.tenant_id=p_tenant_id and ci.business_id=b.id and ci.status='approved') or not exists(select 1 from public.business_portfolio_projects pp where pp.tenant_id=p_tenant_id and pp.business_id=b.id and pp.status='approved')) then 'first_party:claimed_underutilized_profile' end,
            case when b.status='published' and exists(select 1 from public.business_categories bc join public.categories c on c.id=bc.category_id where bc.business_id=b.id and (lower(coalesce(c.vertical,'')) like '%restaurant%' or lower(c.name) like '%restaurant%' or lower(c.name) like '%food%')) and coalesce(nullif(trim(b.menu_url),''),'')='' and coalesce(nullif(trim(b.ordering_url),''),'')='' then 'first_party:restaurant_missing_web_menu' end
          ]::text[],null)
        ) flag
      ) as new_flags
    from public.business_prospects p
    join public.businesses b on b.id=p.business_id and b.tenant_id=p_tenant_id
    left join event_90 e on e.business_id=b.id
    where p.tenant_id=p_tenant_id and p.business_id is not null
  ), updated as (
    update public.business_prospects p
    set marketing_flags=s.new_flags,
        updated_at=case when p.marketing_flags is distinct from s.new_flags then now() else p.updated_at end
    from signal_rows s
    where p.id=s.prospect_id and p.marketing_flags is distinct from s.new_flags
    returning p.id
  ) select count(*) into v_changed from updated;

  select count(*) into v_flagged
  from public.business_prospects p
  where p.tenant_id=p_tenant_id
    and exists(select 1 from unnest(coalesce(p.marketing_flags,array[]::text[])) f where f like 'first_party:%');

  return jsonb_build_object('tenant_id',p_tenant_id,'changed_prospects',v_changed,'first_party_flagged_prospects',v_flagged,'synced_at',now());
end;
$function$;

revoke all on function private.sync_skylight_first_party_marketing_signals(uuid) from public,anon,authenticated;

comment on function private.sync_skylight_first_party_marketing_signals(uuid) is
'Internal Skylight sales intelligence only. Adds/removes first_party:* marketing flags from evidence in directory/profile/engagement data. Must never affect organic ranking, verification, sponsorship, lead routing or billing.';

create or replace function public.get_revenue_command_center(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['super_admin']) then
    raise exception 'insufficient_privilege';
  end if;

  with active_programs as (
    select lp.* from public.business_lead_programs lp
    where lp.tenant_id=p_tenant_id and lp.status='active'
  ), charges_month as (
    select c.business_id,count(*)::integer delivered_month,max(c.delivered_at) last_delivery_at
    from public.lead_delivery_charges c
    where c.tenant_id=p_tenant_id and c.delivered_at>=date_trunc('month',now())
    group by c.business_id
  ), charges_90 as (
    select c.business_id,count(*)::integer delivered_90,max(c.delivered_at) last_delivery_at
    from public.lead_delivery_charges c
    where c.tenant_id=p_tenant_id and c.delivered_at>=now()-interval '90 days'
    group by c.business_id
  ), paid_invoices as (
    select i.business_id,
      coalesce(sum(i.amount_due_cents) filter(where i.paid_at>=date_trunc('month',now())),0)::bigint paid_month_cents,
      coalesce(sum(i.amount_due_cents) filter(where i.paid_at>=now()-interval '30 days'),0)::bigint paid_30_cents,
      coalesce(sum(i.amount_due_cents) filter(where i.paid_at>=now()-interval '90 days'),0)::bigint paid_90_cents
    from public.lead_invoices i
    where i.tenant_id=p_tenant_id and i.status='paid' and i.paid_at>=now()-interval '90 days'
    group by i.business_id
  ), open_invoices as (
    select i.business_id,
      coalesce(sum(i.amount_due_cents) filter(where i.status in('sent','overdue')),0)::bigint open_cents,
      coalesce(sum(i.amount_due_cents) filter(where i.status='overdue'),0)::bigint overdue_cents,
      min(i.due_at) filter(where i.status='overdue') oldest_overdue_at,
      count(*) filter(where i.status in('sent','overdue'))::integer open_invoice_count
    from public.lead_invoices i
    where i.tenant_id=p_tenant_id and i.status in('sent','overdue')
    group by i.business_id
  ), outcomes_90 as (
    select lr.business_id,
      count(*) filter(where lr.won_at>=now()-interval '90 days')::integer won_jobs_90,
      coalesce(sum(lr.outcome_value_cents) filter(where lr.won_at>=now()-interval '90 days'),0)::bigint owner_reported_job_value_90_cents
    from public.lead_recipients lr
    where lr.tenant_id=p_tenant_id
    group by lr.business_id
  ), buyer_rows as (
    select ap.business_id,b.name,
      ap.billing_model,ap.lead_sale_mode,ap.per_lead_price_cents,ap.bundle_price_cents,ap.bundle_lead_count,
      ap.max_leads_per_month,ap.agreement_started_on,ap.agreement_ends_on,ap.manual_delivery_hold,ap.delivery_hold_reason,
      coalesce(cm.delivered_month,0) delivered_month,coalesce(c90.delivered_90,0) delivered_90,
      coalesce(pi.paid_month_cents,0) paid_month_cents,coalesce(pi.paid_30_cents,0) paid_30_cents,coalesce(pi.paid_90_cents,0) paid_90_cents,
      coalesce(oi.open_cents,0) open_cents,coalesce(oi.overdue_cents,0) overdue_cents,oi.oldest_overdue_at,coalesce(oi.open_invoice_count,0) open_invoice_count,
      coalesce(o.won_jobs_90,0) won_jobs_90,coalesce(o.owner_reported_job_value_90_cents,0) owner_reported_job_value_90_cents,
      greatest(0,coalesce(ap.max_leads_per_month,0)-coalesce(cm.delivered_month,0)) remaining_cap,
      case when coalesce(ap.max_leads_per_month,0)>0 then round(100.0*coalesce(cm.delivered_month,0)/ap.max_leads_per_month,1) else null end utilization_pct,
      coalesce(cm.last_delivery_at,c90.last_delivery_at) last_delivery_at,
      least(100,
        case when coalesce(oi.overdue_cents,0)>0 then 45 else 0 end+
        case when ap.manual_delivery_hold then 25 else 0 end+
        case when ap.agreement_ends_on is not null and ap.agreement_ends_on between current_date and current_date+30 then 20 else 0 end+
        case when coalesce(cm.last_delivery_at,c90.last_delivery_at) is null or coalesce(cm.last_delivery_at,c90.last_delivery_at)<now()-interval '45 days' then 15 else 0 end
      )::integer retention_attention_score
    from active_programs ap
    join public.businesses b on b.id=ap.business_id and b.tenant_id=p_tenant_id
    left join charges_month cm on cm.business_id=ap.business_id
    left join charges_90 c90 on c90.business_id=ap.business_id
    left join paid_invoices pi on pi.business_id=ap.business_id
    left join open_invoices oi on oi.business_id=ap.business_id
    left join outcomes_90 o on o.business_id=ap.business_id
  ), provider_pairs as (
    select distinct bc.business_id,
      lower(regexp_replace(trim(c.name),'[^a-z0-9]+','','g')) service_key,
      lower(regexp_replace(trim(city.city_name),'[^a-z0-9]+','','g')) city_key
    from public.business_categories bc
    join public.categories c on c.id=bc.category_id and c.tenant_id=p_tenant_id and c.is_active
    join public.businesses b on b.id=bc.business_id and b.tenant_id=p_tenant_id and b.status='published'
    cross join lateral (
      select bl.city::text city_name from public.business_locations bl
      where bl.business_id=b.id and bl.tenant_id=p_tenant_id and bl.is_active and coalesce(trim(bl.city),'')<>''
      union
      select l.name::text city_name from public.business_service_areas bsa join public.locations l on l.id=bsa.location_id
      where bsa.business_id=b.id and l.tenant_id=p_tenant_id and l.is_active and coalesce(trim(l.name),'')<>''
    ) city
  ), demand as (
    select trim(l.service) service,trim(l.city) city,
      lower(regexp_replace(trim(l.service),'[^a-z0-9]+','','g')) service_key,
      lower(regexp_replace(trim(l.city),'[^a-z0-9]+','','g')) city_key,
      count(*)::integer demand_90
    from public.leads l
    where l.tenant_id=p_tenant_id and l.created_at>=now()-interval '90 days'
      and coalesce(trim(l.service),'')<>'' and coalesce(trim(l.city),'')<>''
    group by trim(l.service),trim(l.city),lower(regexp_replace(trim(l.service),'[^a-z0-9]+','','g')),lower(regexp_replace(trim(l.city),'[^a-z0-9]+','','g'))
  ), market_rows as (
    select d.*,
      (select count(distinct pp.business_id) from provider_pairs pp where pp.service_key=d.service_key and pp.city_key=d.city_key)::integer providers,
      (select count(distinct pp.business_id) from provider_pairs pp join active_programs ap on ap.business_id=pp.business_id where pp.service_key=d.service_key and pp.city_key=d.city_key)::integer active_buyers
    from demand d
  ), latest_interest as (
    select distinct on(lr.business_id) lr.business_id,lr.lead_program_interest,lr.interest_updated_at
    from public.lead_recipients lr
    where lr.tenant_id=p_tenant_id and lr.interest_updated_at is not null
    order by lr.business_id,lr.interest_updated_at desc,lr.updated_at desc,lr.id desc
  ), revenue_actions as (
    select 'collections'::text action_type,b.id::text entity_key,b.id business_id,
      'Collect overdue lead invoice · '||b.name title,
      'Overdue lead receivables require review before more billable delivery is considered.' detail,
      '/admin/lead-billing'::text href,100::integer priority,oi.overdue_cents::bigint value_cents
    from open_invoices oi join public.businesses b on b.id=oi.business_id
    where oi.overdue_cents>0
    union all
    select 'lead_buyer_follow_up',b.id::text,b.id,
      'Follow up with interested lead buyer · '||b.name,
      'The owner explicitly requested more leads and the private sales follow-up is due. Interest alone does not activate billing or routing.',
      '/admin/lead-buyers',98,
      case when crm.target_price_cents is not null and crm.target_monthly_cap is not null then crm.target_price_cents::bigint*crm.target_monthly_cap::bigint else 0 end
    from latest_interest li
    join public.businesses b on b.id=li.business_id and b.tenant_id=p_tenant_id
    left join public.lead_buyer_crm_profiles crm on crm.tenant_id=p_tenant_id and crm.business_id=b.id
    where li.lead_program_interest='interested'
      and not exists(select 1 from active_programs ap where ap.business_id=b.id)
      and coalesce(crm.sales_status,'open')='open'
      and (coalesce(crm.follow_up_at,li.interest_updated_at+interval '24 hours')<=now())
    union all
    select 'agreement_review',b.id::text,b.id,
      'Review lead buyer agreement · '||b.name,
      'Documented buyer consent is recorded and the draft is ready for explicit Super Admin review. Review does not itself deliver or charge a lead.',
      '/admin/lead-buyers',96,
      case when d.billing_model='pay_per_lead' and d.per_lead_price_cents is not null and d.max_leads_per_month is not null then d.per_lead_price_cents::bigint*d.max_leads_per_month::bigint when d.billing_model='lead_bundle' then coalesce(d.bundle_price_cents,0)::bigint else 0 end
    from public.lead_buyer_agreement_drafts d join public.businesses b on b.id=d.business_id and b.tenant_id=p_tenant_id
    where d.tenant_id=p_tenant_id and d.status='ready'
    union all
    select 'renewal',br.business_id::text,br.business_id,
      'Renew lead buyer agreement · '||br.name,
      'Active lead agreement ends within 30 days. Review actual buyer results and needs before proposing renewal.',
      '/admin/lead-buyers',90,
      case when br.billing_model='pay_per_lead' and br.per_lead_price_cents is not null and br.max_leads_per_month is not null then br.per_lead_price_cents::bigint*br.max_leads_per_month::bigint when br.billing_model='lead_bundle' then coalesce(br.bundle_price_cents,0)::bigint else 0 end
    from buyer_rows br where br.agreement_ends_on between current_date and current_date+30
    union all
    select 'market_gap',mr.service_key||':'||mr.city_key,null::uuid,
      'Recruit lead supply · '||mr.service||' in '||mr.city,
      mr.demand_90||' consumer leads in 90 days, '||mr.providers||' matching published providers, and '||mr.active_buyers||' active lead buyers. Research legitimate providers; do not fabricate offices.',
      '/admin/inventory-expansion',least(94,70+mr.demand_90*4)::integer,0::bigint
    from market_rows mr where mr.demand_90>=2 and (mr.providers=0 or mr.active_buyers=0)
    union all
    select 'growth_opportunity',g.id::text,g.business_id,
      coalesce(g.title,'Growth opportunity'),
      coalesce(g.next_action,g.detail,'Review the evidence-backed growth opportunity.'),
      '/admin/growth-opportunities',least(95,coalesce(g.score,0))::integer,coalesce(g.estimated_monthly_value_cents,0)::bigint
    from public.growth_opportunities g
    where g.tenant_id=p_tenant_id and g.status in('open','in_progress') and coalesce(g.score,0)>=80
  ), first_party_signals as (
    select p.id prospect_id,p.business_id,p.business_name,p.owner_contact_email,p.owner_contact_phone,
      array(select f from unnest(coalesce(p.marketing_flags,array[]::text[])) f where f like 'first_party:%') signals,
      g.score,g.estimated_monthly_value_cents,g.status opportunity_status
    from public.business_prospects p
    left join public.growth_opportunities g on g.tenant_id=p_tenant_id and g.opportunity_key='skylight:'||p.id::text
    where p.tenant_id=p_tenant_id and p.business_id is not null
      and exists(select 1 from unnest(coalesce(p.marketing_flags,array[]::text[])) f where f like 'first_party:%')
  )
  select jsonb_build_object(
    'generated_at',now(),
    'metrics',jsonb_build_object(
      'lead_revenue_month_cents',coalesce((select sum(paid_month_cents) from paid_invoices),0),
      'lead_revenue_30_cents',coalesce((select sum(paid_30_cents) from paid_invoices),0),
      'lead_revenue_90_cents',coalesce((select sum(paid_90_cents) from paid_invoices),0),
      'open_receivables_cents',coalesce((select sum(open_cents) from open_invoices),0),
      'overdue_receivables_cents',coalesce((select sum(overdue_cents) from open_invoices),0),
      'active_lead_buyers',(select count(*) from active_programs),
      'buyers_with_retention_attention',(select count(*) from buyer_rows where retention_attention_score>=40),
      'buyers_near_monthly_cap',(select count(*) from buyer_rows where utilization_pct>=80),
      'remaining_monthly_lead_capacity',coalesce((select sum(remaining_cap) from buyer_rows where max_leads_per_month is not null),0),
      'agreements_expiring_30d',(select count(*) from buyer_rows where agreement_ends_on between current_date and current_date+30),
      'evidence_backed_growth_value_cents',coalesce((select sum(estimated_monthly_value_cents) from public.growth_opportunities where tenant_id=p_tenant_id and status in('open','in_progress') and estimated_monthly_value_cents>0),0),
      'first_party_skylight_prospects',(select count(*) from first_party_signals),
      'market_gaps_without_active_buyers',(select count(*) from market_rows where demand_90>=2 and active_buyers=0)
    ),
    'buyers',coalesce((select jsonb_agg(to_jsonb(x) order by x.retention_attention_score desc,x.paid_90_cents desc) from (select * from buyer_rows limit 100) x),'[]'::jsonb),
    'market_gaps',coalesce((select jsonb_agg(to_jsonb(x) order by x.demand_90::numeric/greatest(1,x.providers) desc,x.demand_90 desc) from (select mr.*,round(mr.demand_90::numeric/greatest(1,mr.providers),1) demand_pressure from market_rows mr order by mr.demand_90::numeric/greatest(1,mr.providers) desc,mr.demand_90 desc limit 50) x),'[]'::jsonb),
    'skylight_prospects',coalesce((select jsonb_agg(to_jsonb(x) order by coalesce(x.score,0) desc,cardinality(x.signals) desc) from (select * from first_party_signals order by coalesce(score,0) desc,cardinality(signals) desc limit 75) x),'[]'::jsonb),
    'today_actions',coalesce((select jsonb_agg(to_jsonb(x) order by x.priority desc,x.value_cents desc) from (select * from revenue_actions order by priority desc,value_cents desc limit 30) x),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_revenue_command_center(uuid) from public,anon;
grant execute on function public.get_revenue_command_center(uuid) to authenticated;

comment on function public.get_revenue_command_center(uuid) is
'Super Admin-only executive revenue intelligence. Read-only analytics and prioritization; it does not modify billing, lead routing, verification, sponsorship or organic ranking.';

create or replace function private.refresh_all_growth_opportunities()
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare r record;n integer:=0;
begin
  for r in select distinct tenant_id from public.businesses where tenant_id is not null loop
    perform private.ensure_acquisition_research_prospects(r.tenant_id);
    perform private.sync_skylight_first_party_marketing_signals(r.tenant_id);
    perform private.refresh_growth_opportunities(r.tenant_id);
    perform private.sync_explicit_lead_buyer_opportunities(r.tenant_id);
    perform private.sync_local_commerce_growth_opportunities(r.tenant_id);
    perform private.sync_growth_outreach_tasks(r.tenant_id);
    n:=n+1;
  end loop;
  return n;
end;
$function$;

create or replace function public.refresh_growth_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_first_party jsonb;
  v_opportunities jsonb;
  v_explicit_lead_buyers jsonb;
  v_tasks jsonb;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then
    raise exception 'insufficient_privilege';
  end if;
  v_first_party := private.sync_skylight_first_party_marketing_signals(p_tenant_id);
  v_opportunities := private.refresh_growth_opportunities(p_tenant_id);
  v_explicit_lead_buyers := private.sync_explicit_lead_buyer_opportunities(p_tenant_id);
  v_tasks := private.sync_growth_outreach_tasks(p_tenant_id);
  return jsonb_build_object(
    'first_party_marketing_signals',v_first_party,
    'opportunities',v_opportunities,
    'explicit_lead_buyers',v_explicit_lead_buyers,
    'outreach_tasks',v_tasks
  );
end;
$function$;
