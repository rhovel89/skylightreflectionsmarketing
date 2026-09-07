-- Sales Command Center 3.8 — factual acquisition intelligence engine.
-- Conversion metrics only use recorded system events; no outcomes, spend, or attribution are fabricated.

alter table public.skylight_sales_automation_runs
  drop constraint if exists skylight_sales_automation_runs_run_type_check;
alter table public.skylight_sales_automation_runs
  add constraint skylight_sales_automation_runs_run_type_check
  check (run_type in ('action_refresh','metrics_snapshot','revenue_reconcile','release_diagnostic','acquisition_snapshot'));

create or replace function private.snapshot_skylight_sales_acquisition_metrics(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_run_id uuid;
  v_rows integer := 0;
  v_settings public.skylight_sales_acquisition_settings%rowtype;
begin
  if auth.uid() is not null and not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then
    raise exception 'Not authorized for this tenant';
  end if;

  insert into public.skylight_sales_acquisition_settings(tenant_id)
  values(p_tenant_id)
  on conflict(tenant_id) do nothing;
  select * into v_settings from public.skylight_sales_acquisition_settings where tenant_id=p_tenant_id;

  insert into public.skylight_sales_automation_runs(tenant_id,run_type,source,status,metadata)
  values(p_tenant_id,'acquisition_snapshot',case when auth.uid() is null then 'system' else 'staff' end,'running',
    jsonb_build_object('factual_metrics_only',true,'automatic_outreach',false,'billing_authorization',false,'public_ranking_effect',false))
  returning id into v_run_id;

  delete from public.skylight_sales_acquisition_metrics
  where tenant_id=p_tenant_id and metric_date=current_date;

  with first_sent as (
    select distinct on (d.opportunity_id)
      d.opportunity_id,d.id as draft_id,d.campaign_id,d.template_id,d.sent_at
    from public.skylight_sales_outreach_drafts d
    where d.tenant_id=p_tenant_id and d.status='sent' and d.sent_at is not null
    order by d.opportunity_id,d.sent_at asc,d.created_at asc
  ), base as (
    select
      o.id as opportunity_id,o.stage,o.active,o.score,o.primary_service_slug,o.evidence_flags,o.created_at,
      o.first_reply_at,o.won_at,o.proposal_id,o.attributed_revenue_cents,o.attribution_locked_at,
      bp.city,bp.category,bp.status as prospect_status,
      fs.sent_at as first_sent_at,
      coalesce(o.attribution_campaign_id,fs.campaign_id) as campaign_id,
      fs.template_id,
      exists(select 1 from public.skylight_sales_outreach_drafts d where d.tenant_id=p_tenant_id and d.opportunity_id=o.id and d.status in ('draft','approved','sent')) as has_draft,
      exists(select 1 from public.skylight_sales_outreach_drafts d where d.tenant_id=p_tenant_id and d.opportunity_id=o.id and d.status in ('approved','sent')) as has_approved,
      exists(select 1 from public.skylight_sales_replies r where r.tenant_id=p_tenant_id and r.opportunity_id=o.id and r.review_status<>'dismissed') as has_reply,
      exists(select 1 from public.skylight_sales_replies r where r.tenant_id=p_tenant_id and r.opportunity_id=o.id and r.review_status='confirmed' and r.confirmed_classification='positive') as has_positive_reply,
      exists(select 1 from public.skylight_sales_meetings m where m.tenant_id=p_tenant_id and m.opportunity_id=o.id and m.status<>'cancelled') as has_meeting,
      exists(select 1 from public.skylight_sales_suppressions s where s.tenant_id=p_tenant_id and s.opportunity_id=o.id and s.active=true) as has_suppression
    from public.skylight_sales_opportunities o
    join public.business_prospects bp on bp.id=o.prospect_id
    left join first_sent fs on fs.opportunity_id=o.id
    where o.tenant_id=p_tenant_id
  ), windows(window_days) as (
    values (0),(30),(90),(365)
  ), cohorted as (
    select w.window_days,b.*
    from windows w cross join base b
    where w.window_days=0
       or coalesce(b.first_sent_at,b.created_at) >= now()-make_interval(days=>w.window_days)
  ), dims as (
    select 'overall'::text as dimension_type,'all'::text as dimension_key,c.* from cohorted c
    union all
    select 'city',btrim(c.city),c.* from cohorted c where nullif(btrim(c.city),'') is not null
    union all
    select 'category',btrim(c.category),c.* from cohorted c where nullif(btrim(c.category),'') is not null
    union all
    select 'service',btrim(c.primary_service_slug),c.* from cohorted c where nullif(btrim(c.primary_service_slug),'') is not null
    union all
    select 'campaign',c.campaign_id::text,c.* from cohorted c where c.campaign_id is not null
    union all
    select 'template',c.template_id::text,c.* from cohorted c where c.template_id is not null
    union all
    select 'evidence',e.flag,c.*
    from cohorted c cross join lateral unnest(coalesce(c.evidence_flags,array[]::text[])) as e(flag)
    where e.flag like 'first_party:%'
  ), agg as (
    select
      d.window_days,d.dimension_type,d.dimension_key,
      count(*)::int as opportunities,
      count(*) filter(where d.stage='research')::int as research_opportunities,
      count(*) filter(where d.stage='contact_ready')::int as contact_ready_opportunities,
      count(*) filter(where d.has_draft)::int as drafted_opportunities,
      count(*) filter(where d.has_approved)::int as approved_opportunities,
      count(*) filter(where d.first_sent_at is not null)::int as sent_opportunities,
      count(*) filter(where d.has_reply)::int as replied_opportunities,
      count(*) filter(where d.has_positive_reply)::int as positive_reply_opportunities,
      count(*) filter(where d.has_meeting)::int as meeting_opportunities,
      count(*) filter(where d.proposal_id is not null)::int as proposal_opportunities,
      count(*) filter(where d.stage='won')::int as won_opportunities,
      count(*) filter(where d.stage='lost')::int as lost_opportunities,
      count(*) filter(where d.prospect_status='do_not_contact' or d.has_suppression)::int as suppressed_opportunities,
      count(*) filter(where d.campaign_id is not null and d.first_sent_at is not null)::int as attributed_opportunities,
      count(*) filter(where d.stage='won' and d.first_sent_at is not null)::int as sent_wins,
      count(*) filter(where d.has_meeting and d.first_sent_at is not null)::int as sent_meetings,
      coalesce(sum(case when d.first_sent_at is not null then greatest(0,coalesce(d.attributed_revenue_cents,0)) else 0 end),0)::bigint as sent_paid_revenue_cents,
      round(avg(d.score)::numeric,2) as avg_score,
      coalesce(sum(greatest(0,coalesce(d.attributed_revenue_cents,0))),0)::bigint as paid_revenue_cents,
      round(avg(extract(epoch from (d.first_reply_at-d.first_sent_at))/86400.0) filter(where d.first_sent_at is not null and d.first_reply_at is not null and d.first_reply_at>=d.first_sent_at),2) as avg_days_to_first_reply,
      round(avg(extract(epoch from (d.won_at-coalesce(d.attribution_locked_at,d.first_sent_at,d.created_at)))/86400.0) filter(where d.stage='won' and d.won_at is not null and d.won_at>=coalesce(d.attribution_locked_at,d.first_sent_at,d.created_at)),2) as avg_days_to_win
    from dims d
    group by d.window_days,d.dimension_type,d.dimension_key
  ), spend as (
    select w.window_days,'overall'::text dimension_type,'all'::text dimension_key,coalesce(sum(s.amount_cents),0)::bigint amount_cents
    from windows w left join public.skylight_sales_campaign_spend s on s.tenant_id=p_tenant_id and (w.window_days=0 or s.spend_date>=current_date-w.window_days)
    group by w.window_days
    union all
    select w.window_days,'campaign',s.campaign_id::text,coalesce(sum(s.amount_cents),0)::bigint
    from windows w join public.skylight_sales_campaign_spend s on s.tenant_id=p_tenant_id and (w.window_days=0 or s.spend_date>=current_date-w.window_days)
    group by w.window_days,s.campaign_id
  )
  insert into public.skylight_sales_acquisition_metrics(
    tenant_id,metric_date,window_days,dimension_type,dimension_key,
    opportunities,research_opportunities,contact_ready_opportunities,drafted_opportunities,approved_opportunities,sent_opportunities,replied_opportunities,positive_reply_opportunities,meeting_opportunities,proposal_opportunities,won_opportunities,lost_opportunities,suppressed_opportunities,attributed_opportunities,avg_score,paid_revenue_cents,campaign_spend_cents,cac_cents,cost_per_meeting_cents,roas_bps,contact_ready_rate_bps,send_rate_bps,reply_rate_bps,positive_reply_rate_bps,meeting_rate_bps,proposal_rate_bps,sent_to_win_rate_bps,closed_win_rate_bps,avg_days_to_first_reply,avg_days_to_win,sample_maturity,updated_at
  )
  select
    p_tenant_id,current_date,a.window_days,a.dimension_type,a.dimension_key,
    a.opportunities,a.research_opportunities,a.contact_ready_opportunities,a.drafted_opportunities,a.approved_opportunities,a.sent_opportunities,a.replied_opportunities,a.positive_reply_opportunities,a.meeting_opportunities,a.proposal_opportunities,a.won_opportunities,a.lost_opportunities,a.suppressed_opportunities,a.attributed_opportunities,a.avg_score,a.paid_revenue_cents,coalesce(s.amount_cents,0),
    case when coalesce(s.amount_cents,0)>0 and a.sent_wins>=v_settings.min_wins_for_cac then round(s.amount_cents::numeric/a.sent_wins)::bigint else null end,
    case when coalesce(s.amount_cents,0)>0 and a.sent_meetings>0 then round(s.amount_cents::numeric/a.sent_meetings)::bigint else null end,
    case when coalesce(s.amount_cents,0)>0 then round(a.sent_paid_revenue_cents::numeric*10000/s.amount_cents)::bigint else null end,
    case when a.opportunities>0 then round(a.contact_ready_opportunities::numeric*10000/a.opportunities)::int else null end,
    case when a.contact_ready_opportunities>0 then round(a.sent_opportunities::numeric*10000/a.contact_ready_opportunities)::int else null end,
    case when a.sent_opportunities>0 then round(a.replied_opportunities::numeric*10000/a.sent_opportunities)::int else null end,
    case when a.replied_opportunities>0 then round(a.positive_reply_opportunities::numeric*10000/a.replied_opportunities)::int else null end,
    case when a.replied_opportunities>0 then round(a.meeting_opportunities::numeric*10000/a.replied_opportunities)::int else null end,
    case when a.meeting_opportunities>0 then round(a.proposal_opportunities::numeric*10000/a.meeting_opportunities)::int else null end,
    case when a.sent_opportunities>0 then round(a.sent_wins::numeric*10000/a.sent_opportunities)::int else null end,
    case when a.won_opportunities+a.lost_opportunities>0 then round(a.won_opportunities::numeric*10000/(a.won_opportunities+a.lost_opportunities))::int else null end,
    a.avg_days_to_first_reply,a.avg_days_to_win,
    case when a.sent_opportunities=0 then 'none' when a.sent_opportunities<v_settings.min_sent_sample_directional then 'small' when a.sent_opportunities<v_settings.min_sent_sample_mature then 'developing' else 'mature' end,
    now()
  from agg a left join spend s on s.window_days=a.window_days and s.dimension_type=a.dimension_type and s.dimension_key=a.dimension_key
  on conflict(tenant_id,metric_date,window_days,dimension_type,dimension_key) do update set
    opportunities=excluded.opportunities,research_opportunities=excluded.research_opportunities,contact_ready_opportunities=excluded.contact_ready_opportunities,drafted_opportunities=excluded.drafted_opportunities,approved_opportunities=excluded.approved_opportunities,sent_opportunities=excluded.sent_opportunities,replied_opportunities=excluded.replied_opportunities,positive_reply_opportunities=excluded.positive_reply_opportunities,meeting_opportunities=excluded.meeting_opportunities,proposal_opportunities=excluded.proposal_opportunities,won_opportunities=excluded.won_opportunities,lost_opportunities=excluded.lost_opportunities,suppressed_opportunities=excluded.suppressed_opportunities,attributed_opportunities=excluded.attributed_opportunities,avg_score=excluded.avg_score,paid_revenue_cents=excluded.paid_revenue_cents,campaign_spend_cents=excluded.campaign_spend_cents,cac_cents=excluded.cac_cents,cost_per_meeting_cents=excluded.cost_per_meeting_cents,roas_bps=excluded.roas_bps,contact_ready_rate_bps=excluded.contact_ready_rate_bps,send_rate_bps=excluded.send_rate_bps,reply_rate_bps=excluded.reply_rate_bps,positive_reply_rate_bps=excluded.positive_reply_rate_bps,meeting_rate_bps=excluded.meeting_rate_bps,proposal_rate_bps=excluded.proposal_rate_bps,sent_to_win_rate_bps=excluded.sent_to_win_rate_bps,closed_win_rate_bps=excluded.closed_win_rate_bps,avg_days_to_first_reply=excluded.avg_days_to_first_reply,avg_days_to_win=excluded.avg_days_to_win,sample_maturity=excluded.sample_maturity,updated_at=now();

  get diagnostics v_rows = row_count;
  update public.skylight_sales_automation_runs
  set status='completed',generated_count=v_rows,completed_at=now(),metadata=metadata||jsonb_build_object('metric_rows',v_rows,'metric_date',current_date,'windows',jsonb_build_array(0,30,90,365))
  where id=v_run_id;

  return jsonb_build_object('ok',true,'metric_rows',v_rows,'metric_date',current_date,'factual_metrics_only',true,'automatic_outreach',false,'billing_authorization',false,'public_ranking_effect',false);
exception when others then
  if v_run_id is not null then
    update public.skylight_sales_automation_runs set status='failed',error_message=left(sqlerrm,2000),completed_at=now() where id=v_run_id;
  end if;
  raise;
end;
$$;

revoke all on function private.snapshot_skylight_sales_acquisition_metrics(uuid) from public,anon;
grant execute on function private.snapshot_skylight_sales_acquisition_metrics(uuid) to authenticated;

create or replace function private.refresh_skylight_sales_operating_system(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare v_revenue jsonb; v_actions jsonb; v_metrics jsonb; v_acquisition jsonb;
begin
  v_revenue:=private.reconcile_skylight_sales_paid_revenue(p_tenant_id);
  v_actions:=private.refresh_skylight_sales_action_queue(p_tenant_id);
  v_metrics:=private.snapshot_skylight_sales_metrics(p_tenant_id);
  v_acquisition:=private.snapshot_skylight_sales_acquisition_metrics(p_tenant_id);
  return jsonb_build_object('ok',true,'revenue',v_revenue,'actions',v_actions,'metrics',v_metrics,'acquisition',v_acquisition,'automatic_outreach',false,'billing_authorization',false,'public_ranking_effect',false);
end;
$$;

select private.snapshot_skylight_sales_acquisition_metrics(t.id)
from public.tenants t
where exists(select 1 from public.skylight_sales_opportunities o where o.tenant_id=t.id);