create index if not exists lead_buyer_crm_profiles_business_fk_idx
  on public.lead_buyer_crm_profiles(business_id);

create or replace function private.refresh_skylight_sales_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_count integer:=0;
  v_contact_ready integer:=0;
  v_research integer:=0;
begin
  update public.skylight_sales_opportunities
  set active=false,updated_at=now()
  where tenant_id=p_tenant_id and stage not in('won','lost');

  with candidates as (
    select
      p.id prospect_id,
      p.business_id,
      p.tenant_id,
      p.opportunity_score,
      p.marketing_flags,
      p.owner_contact_email,
      p.owner_contact_phone,
      p.owner_contact_source_url,
      p.owner_contact_checked_at,
      (
        (coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'')
        and coalesce(trim(p.owner_contact_source_url),'')<>''
        and p.owner_contact_checked_at is not null
      ) as verified_owner_contact,
      coalesce(array_agg(distinct m.service_slug order by m.service_slug) filter(where m.service_slug is not null),'{}'::text[]) recommendations,
      coalesce(sum(distinct m.weight),0)::integer mapped_weight,
      (
        select go.id
        from public.growth_opportunities go
        where go.tenant_id=p.tenant_id and go.prospect_id=p.id and go.opportunity_type='skylight_marketing'
        order by go.score desc,go.updated_at desc
        limit 1
      ) growth_id
    from public.business_prospects p
    left join public.skylight_signal_service_map m
      on m.tenant_id=p.tenant_id
     and m.active
     and m.signal_key=any(coalesce(p.marketing_flags,'{}'::text[]))
    where p.tenant_id=p_tenant_id
    group by
      p.id,p.business_id,p.tenant_id,p.opportunity_score,p.marketing_flags,
      p.owner_contact_email,p.owner_contact_phone,p.owner_contact_source_url,p.owner_contact_checked_at
    having count(m.id)>0
  ), scored as (
    select *,
      least(100,greatest(coalesce(opportunity_score,0),35)+least(mapped_weight,45)) score,
      case
        when 'web-design'=any(recommendations) then 'web-design'
        when 'seo'=any(recommendations) then 'seo'
        when 'google-business-profile-optimization'=any(recommendations) then 'google-business-profile-optimization'
        when 'lead-generation'=any(recommendations) then 'lead-generation'
        else recommendations[1]
      end primary_slug,
      case when verified_owner_contact then 'contact_ready' else 'research' end initial_stage
    from candidates
  )
  insert into public.skylight_sales_opportunities(
    tenant_id,prospect_id,business_id,growth_opportunity_id,primary_service_slug,
    recommended_service_slugs,evidence_flags,score,priority,stage,active,updated_at
  )
  select
    tenant_id,prospect_id,business_id,growth_id,primary_slug,recommendations,marketing_flags,score,
    case when score>=90 then 'hot' when score>=75 then 'high' when score>=55 then 'medium' else 'low' end,
    initial_stage,true,now()
  from scored
  on conflict(tenant_id,prospect_id) do update set
    business_id=excluded.business_id,
    growth_opportunity_id=excluded.growth_opportunity_id,
    primary_service_slug=excluded.primary_service_slug,
    recommended_service_slugs=excluded.recommended_service_slugs,
    evidence_flags=excluded.evidence_flags,
    score=excluded.score,
    priority=excluded.priority,
    stage=case
      when public.skylight_sales_opportunities.stage in('contacted','qualified','proposal','won','lost','nurture')
        then public.skylight_sales_opportunities.stage
      else excluded.stage
    end,
    active=case when public.skylight_sales_opportunities.stage in('won','lost') then false else true end,
    updated_at=now();
  get diagnostics v_count=row_count;

  insert into public.skylight_sales_campaign_members(
    campaign_id,opportunity_id,prospect_id,business_id,status,priority,created_at,updated_at
  )
  select c.id,o.id,o.prospect_id,o.business_id,
    case when o.stage='contact_ready' then 'ready' else 'research' end,
    o.priority,now(),now()
  from public.skylight_sales_campaigns c
  join public.skylight_sales_opportunities o
    on o.tenant_id=c.tenant_id
   and o.active
   and c.service_slug=any(o.recommended_service_slugs)
  where c.tenant_id=p_tenant_id
    and c.status='active'
    and c.campaign_type='service_outreach'
  on conflict(campaign_id,opportunity_id) where opportunity_id is not null do update set
    priority=excluded.priority,
    status=case
      when public.skylight_sales_campaign_members.status in('queued','research','ready') then excluded.status
      else public.skylight_sales_campaign_members.status
    end,
    updated_at=now();

  select count(*) filter(where stage='contact_ready'),count(*) filter(where stage='research')
  into v_contact_ready,v_research
  from public.skylight_sales_opportunities
  where tenant_id=p_tenant_id and active;

  return jsonb_build_object(
    'opportunities_refreshed',v_count,
    'contact_ready',v_contact_ready,
    'research_needed',v_research,
    'contact_ready_requires_owner_provenance',true,
    'refreshed_at',now()
  );
end;
$$;

revoke all on function private.refresh_skylight_sales_opportunities(uuid) from public,anon,authenticated;

create or replace function private.refresh_skylight_sales_alerts(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_contact_ready integer:=0;
  v_followups integer:=0;
  v_stale_proposals integer:=0;
  v_buyer_ready integer:=0;
  v_day text:=to_char(current_date,'YYYYMMDD');
  v_week text:=to_char(current_date,'IYYYIW');
begin
  insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
  select distinct ur.user_id,p_tenant_id,
    'Hot Skylight prospect is contact-ready',
    coalesce(bp.business_name,'A Skylight prospect')||' has a sourced owner/decision-maker contact and a '||o.priority||' private sales priority. Review the evidence before human outreach. This signal does not affect public ranking, verification or Sponsored placement.',
    '/admin/skylight-sales',
    'skylight_contact_ready:'||o.id::text
  from public.skylight_sales_opportunities o
  join public.business_prospects bp on bp.id=o.prospect_id and bp.tenant_id=o.tenant_id
  join public.user_roles ur on ur.tenant_id=o.tenant_id and ur.role in('admin','super_admin')
  where o.tenant_id=p_tenant_id and o.active and o.stage='contact_ready' and o.priority in('hot','high')
  on conflict(user_id,event_key) where event_key is not null do nothing;
  get diagnostics v_contact_ready=row_count;

  insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
  select distinct ur.user_id,p_tenant_id,
    'Skylight sales follow-up overdue',
    coalesce(bp.business_name,'A Skylight prospect')||' has a private sales follow-up due. Review the CRM history and evidence before contacting them. No outreach is sent automatically.',
    '/admin/skylight-sales',
    'skylight_followup_due:'||o.id::text||':'||v_day
  from public.skylight_sales_opportunities o
  join public.business_prospects bp on bp.id=o.prospect_id and bp.tenant_id=o.tenant_id
  join public.user_roles ur on ur.tenant_id=o.tenant_id and ur.role in('admin','super_admin')
  where o.tenant_id=p_tenant_id and o.active
    and o.stage in('contact_ready','contacted','qualified','proposal','nurture')
    and o.next_follow_up_at is not null and o.next_follow_up_at<=now()
  on conflict(user_id,event_key) where event_key is not null do nothing;
  get diagnostics v_followups=row_count;

  insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
  select distinct ur.user_id,p_tenant_id,
    'Skylight proposal needs attention',
    coalesce(bp.business_name,'A Skylight prospect')||' has remained in Proposal for more than 7 days. Review the actual proposal/client history before deciding the next step.',
    '/admin/skylight-sales',
    'skylight_proposal_stale:'||o.id::text||':'||v_week
  from public.skylight_sales_opportunities o
  join public.business_prospects bp on bp.id=o.prospect_id and bp.tenant_id=o.tenant_id
  join public.user_roles ur on ur.tenant_id=o.tenant_id and ur.role in('admin','super_admin')
  where o.tenant_id=p_tenant_id and o.active and o.stage='proposal' and o.updated_at<now()-interval '7 days'
  on conflict(user_id,event_key) where event_key is not null do nothing;
  get diagnostics v_stale_proposals=row_count;

  insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
  select distinct ur.user_id,p_tenant_id,
    'Lead Buyer recruitment candidate is contact-ready',
    coalesce(b.name,'A published business')||' matches a real historical-demand Lead Buyer recruitment opportunity and has a business contact path available. Review the evidence before human outreach; historical demand does not guarantee future lead volume.',
    '/admin/skylight-sales#lead-buyer-recruitment',
    'lead_buyer_recruitment_ready:'||g.id::text
  from public.growth_opportunities g
  join public.businesses b on b.id=g.business_id and b.tenant_id=g.tenant_id
  join public.user_roles ur on ur.tenant_id=g.tenant_id and ur.role in('admin','super_admin')
  where g.tenant_id=p_tenant_id and g.opportunity_type='lead_buyer_recruitment'
    and g.status in('open','in_progress')
    and coalesce((g.source_facts->>'contact_path_available')::boolean,false)
  on conflict(user_id,event_key) where event_key is not null do nothing;
  get diagnostics v_buyer_ready=row_count;

  return jsonb_build_object(
    'contact_ready_notifications_created',v_contact_ready,
    'overdue_followup_notifications_created',v_followups,
    'stale_proposal_notifications_created',v_stale_proposals,
    'lead_buyer_ready_notifications_created',v_buyer_ready,
    'automatic_outreach',false,
    'refreshed_at',now()
  );
end;
$$;

revoke all on function private.refresh_skylight_sales_alerts(uuid) from public,anon,authenticated;

create or replace function public.refresh_skylight_sales_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_skylight jsonb;
  v_recruitment jsonb;
  v_alerts jsonb;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['admin','super_admin']) then
    raise exception 'Admin access is required.';
  end if;
  v_skylight:=private.refresh_skylight_sales_opportunities(p_tenant_id);
  v_recruitment:=private.sync_lead_buyer_recruitment_opportunities(p_tenant_id);
  v_alerts:=private.refresh_skylight_sales_alerts(p_tenant_id);
  return jsonb_build_object('skylight_sales',v_skylight,'lead_buyer_recruitment',v_recruitment,'private_alerts',v_alerts,'refreshed_at',now());
end;
$$;

revoke all on function public.refresh_skylight_sales_opportunities(uuid) from public,anon;
grant execute on function public.refresh_skylight_sales_opportunities(uuid) to authenticated;

create or replace function public.get_sales_revenue_intelligence(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['super_admin']) then
    raise exception 'insufficient_privilege';
  end if;

  with sales as (
    select o.*,bp.business_name,bp.city,bp.category
    from public.skylight_sales_opportunities o
    join public.business_prospects bp on bp.id=o.prospect_id and bp.tenant_id=o.tenant_id
    where o.tenant_id=p_tenant_id
  ), active_sales as (
    select * from sales where active
  ), attributed_invoices as (
    select distinct o.invoice_id from sales o where o.invoice_id is not null
  ), attributed_cash as (
    select
      coalesce(sum(case when p.kind='payment' then p.amount_cents else -p.amount_cents end) filter(where p.paid_at>=now()-interval '30 days'),0)::bigint revenue_30_cents,
      coalesce(sum(case when p.kind='payment' then p.amount_cents else -p.amount_cents end) filter(where p.paid_at>=now()-interval '90 days'),0)::bigint revenue_90_cents,
      coalesce(sum(case when p.kind='payment' then p.amount_cents else -p.amount_cents end),0)::bigint revenue_lifetime_cents
    from public.skylight_invoice_payments p
    join attributed_invoices ai on ai.invoice_id=p.invoice_id
  ), recruitment as (
    select g.* from public.growth_opportunities g
    where g.tenant_id=p_tenant_id and g.opportunity_type='lead_buyer_recruitment' and g.status in('open','in_progress','snoozed')
  ), action_rows as (
    select 'sales_followup'::text action_type,o.id::text entity_key,coalesce(o.business_name,'Skylight sales opportunity')::text title,
      ('Follow-up was due '||to_char(o.next_follow_up_at,'Mon DD, YYYY HH12:MI AM')||'. Review the actual sales history before human outreach.')::text detail,
      '/admin/skylight-sales'::text href,
      least(100,96+least(4,greatest(0,floor(extract(epoch from (now()-o.next_follow_up_at))/86400))::integer))::integer priority,
      coalesce(o.estimated_value_cents,0)::bigint value_cents,true::boolean value_is_estimate
    from active_sales o
    where o.stage in('contact_ready','contacted','qualified','proposal','nurture') and o.next_follow_up_at is not null and o.next_follow_up_at<=now()
    union all
    select 'sales_contact_ready',o.id::text,coalesce(o.business_name,'Skylight sales opportunity'),
      'A sourced owner/decision-maker contact is available. Review the evidence and prepare human-approved outreach; nothing is sent automatically.',
      '/admin/skylight-sales',case when o.priority='hot' then 95 when o.priority='high' then 92 else 86 end,
      coalesce(o.estimated_value_cents,0)::bigint,true
    from active_sales o where o.stage='contact_ready'
    union all
    select 'sales_proposal',o.id::text,coalesce(o.business_name,'Skylight sales opportunity'),
      case when o.updated_at<now()-interval '7 days' then 'Proposal stage has been unchanged for more than 7 days. Review the proposal and client history.' else 'Proposal is active. Review its next documented step.' end,
      '/admin/skylight-sales',case when o.updated_at<now()-interval '7 days' then 93 else 84 end,
      coalesce(o.estimated_value_cents,0)::bigint,true
    from active_sales o where o.stage='proposal'
    union all
    select 'lead_buyer_recruitment',g.id::text,coalesce(b.name,'Lead Buyer candidate'),
      coalesce(g.source_facts->>'demand_90','0')||' historical consumer requests in 90 days for '||coalesce(g.source_facts->>'service','this service')||' in '||coalesce(g.source_facts->>'city','this market')||'. Historical demand is not guaranteed future volume.',
      '/admin/skylight-sales#lead-buyer-recruitment',least(94,coalesce(g.score,0)),0::bigint,false
    from recruitment g
    join public.businesses b on b.id=g.business_id and b.tenant_id=g.tenant_id
    where g.status in('open','in_progress')
  )
  select jsonb_build_object(
    'generated_at',now(),
    'metrics',jsonb_build_object(
      'active_sales_opportunities',(select count(*) from active_sales),
      'hot_high',(select count(*) from active_sales where priority in('hot','high')),
      'contact_ready',(select count(*) from active_sales where stage='contact_ready'),
      'research_needed',(select count(*) from active_sales where stage in('new','research')),
      'followups_due',(select count(*) from active_sales where next_follow_up_at is not null and next_follow_up_at<=now() and stage in('contact_ready','contacted','qualified','proposal','nurture')),
      'qualified',(select count(*) from active_sales where stage='qualified'),
      'proposals',(select count(*) from active_sales where stage='proposal'),
      'won',(select count(*) from sales where stage='won'),
      'pipeline_estimate_cents',coalesce((select sum(estimated_value_cents) from active_sales where estimated_value_cents>0),0),
      'actual_attributed_revenue_30_cents',coalesce((select revenue_30_cents from attributed_cash),0),
      'actual_attributed_revenue_90_cents',coalesce((select revenue_90_cents from attributed_cash),0),
      'actual_attributed_revenue_lifetime_cents',coalesce((select revenue_lifetime_cents from attributed_cash),0),
      'lead_buyer_recruitment_candidates',(select count(*) from recruitment),
      'lead_buyer_recruitment_contact_ready',(select count(*) from recruitment where coalesce((source_facts->>'contact_path_available')::boolean,false)),
      'lead_buyer_recruitment_research_needed',(select count(*) from recruitment where not coalesce((source_facts->>'contact_path_available')::boolean,false))
    ),
    'stage_counts',coalesce((select jsonb_object_agg(stage,cnt) from (select stage,count(*) cnt from active_sales group by stage) s),'{}'::jsonb),
    'priority_counts',coalesce((select jsonb_object_agg(priority,cnt) from (select priority,count(*) cnt from active_sales group by priority) p),'{}'::jsonb),
    'top_actions',coalesce((select jsonb_agg(to_jsonb(a) order by a.priority desc,a.value_cents desc) from (select * from action_rows order by priority desc,value_cents desc limit 30) a),'[]'::jsonb),
    'separation',jsonb_build_object(
      'actual_revenue_source','skylight_invoice_payments linked through skylight_sales_opportunities.invoice_id',
      'pipeline_values_are_estimates',true,
      'zero_estimate_does_not_mean_zero_opportunity',true,
      'sales_stage_affects_public_ranking',false,
      'sales_stage_affects_verification',false,
      'sales_stage_affects_sponsored_placement',false,
      'automatic_outreach',false
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_sales_revenue_intelligence(uuid) from public,anon;
grant execute on function public.get_sales_revenue_intelligence(uuid) to authenticated;

create or replace function private.refresh_all_growth_opportunities()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  r record;
  n integer:=0;
begin
  for r in select distinct tenant_id from public.businesses where tenant_id is not null loop
    perform private.ensure_acquisition_research_prospects(r.tenant_id);
    perform private.sync_skylight_first_party_marketing_signals(r.tenant_id);
    perform private.refresh_growth_opportunities(r.tenant_id);
    perform private.sync_explicit_lead_buyer_opportunities(r.tenant_id);
    perform private.sync_lead_buyer_recruitment_opportunities(r.tenant_id);
    perform private.sync_local_commerce_growth_opportunities(r.tenant_id);
    perform private.sync_growth_outreach_tasks(r.tenant_id);
    perform private.refresh_skylight_sales_opportunities(r.tenant_id);
    perform private.refresh_skylight_sales_alerts(r.tenant_id);
    n:=n+1;
  end loop;
  return n;
end;
$$;

revoke all on function private.refresh_all_growth_opportunities() from public,anon,authenticated;
