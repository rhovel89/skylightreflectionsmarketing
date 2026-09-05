create or replace function private.sync_explicit_lead_buyer_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resolved integer := 0;
  v_snoozed integer := 0;
  v_upserted integer := 0;
  v_changed integer := 0;
begin
  update public.growth_opportunities g
  set status = 'resolved',
      updated_at = now(),
      last_refreshed_at = now(),
      source_facts = coalesce(g.source_facts, '{}'::jsonb) || jsonb_build_object('resolved_reason','active_lead_program')
  where g.tenant_id = p_tenant_id
    and g.opportunity_key like 'lead-buyer:%'
    and exists (
      select 1 from public.business_lead_programs lp
      where lp.tenant_id = p_tenant_id
        and lp.business_id = g.business_id
        and lp.status = 'active'
    )
    and g.status <> 'resolved';
  get diagnostics v_resolved = row_count;

  with latest as (
    select distinct on (lr.business_id)
      lr.business_id, lr.lead_program_interest, lr.interest_updated_at
    from public.lead_recipients lr
    where lr.tenant_id = p_tenant_id
      and lr.interest_updated_at is not null
    order by lr.business_id, lr.interest_updated_at desc, lr.updated_at desc, lr.id desc
  )
  update public.growth_opportunities g
  set status = 'resolved',
      updated_at = now(),
      last_refreshed_at = now(),
      source_facts = coalesce(g.source_facts, '{}'::jsonb) || jsonb_build_object('resolved_reason','owner_not_interested')
  from latest l
  left join public.lead_buyer_crm_profiles crm
    on crm.tenant_id = p_tenant_id and crm.business_id = l.business_id
  where g.tenant_id = p_tenant_id
    and g.business_id = l.business_id
    and g.opportunity_key = 'lead-buyer:' || l.business_id::text
    and l.lead_program_interest = 'not_interested'
    and not (crm.reopened_at is not null and crm.reopened_at > l.interest_updated_at)
    and g.status <> 'resolved';
  get diagnostics v_changed = row_count;
  v_resolved := v_resolved + v_changed;

  update public.growth_opportunities g
  set status = 'resolved', updated_at = now(), last_refreshed_at = now(),
      source_facts = coalesce(g.source_facts, '{}'::jsonb) || jsonb_build_object('resolved_reason','admin_declined')
  from public.lead_buyer_crm_profiles crm
  where crm.tenant_id = p_tenant_id
    and crm.business_id = g.business_id
    and crm.sales_status = 'declined'
    and g.tenant_id = p_tenant_id
    and g.opportunity_key = 'lead-buyer:' || g.business_id::text
    and g.status <> 'resolved';
  get diagnostics v_changed = row_count;
  v_resolved := v_resolved + v_changed;

  with latest as (
    select distinct on (lr.business_id)
      lr.business_id, lr.lead_program_interest
    from public.lead_recipients lr
    where lr.tenant_id = p_tenant_id and lr.interest_updated_at is not null
    order by lr.business_id, lr.interest_updated_at desc, lr.updated_at desc, lr.id desc
  )
  update public.growth_opportunities g
  set status = 'snoozed', updated_at = now(), last_refreshed_at = now(),
      source_facts = coalesce(g.source_facts, '{}'::jsonb) || jsonb_build_object('snoozed_reason','admin_paused')
  from latest l
  join public.lead_buyer_crm_profiles crm
    on crm.tenant_id = p_tenant_id and crm.business_id = l.business_id
  where g.tenant_id = p_tenant_id
    and g.business_id = l.business_id
    and g.opportunity_key = 'lead-buyer:' || l.business_id::text
    and l.lead_program_interest = 'interested'
    and crm.sales_status = 'paused'
    and g.status in ('open','in_progress');
  get diagnostics v_snoozed = row_count;

  with latest as (
    select distinct on (lr.business_id)
      lr.business_id, lr.id recipient_id, lr.lead_id, lr.delivery_type,
      lr.lead_program_interest, lr.interest_updated_at
    from public.lead_recipients lr
    where lr.tenant_id = p_tenant_id
      and lr.interest_updated_at is not null
    order by lr.business_id, lr.interest_updated_at desc, lr.updated_at desc, lr.id desc
  ), eligible as (
    select l.*, b.name,
      crm.sales_status, crm.target_price_cents, crm.target_monthly_cap,
      crm.preferred_sale_mode, crm.target_billing_model,
      crm.follow_up_at, crm.last_contact_at, crm.reopened_at,
      case
        when crm.target_price_cents is not null and crm.target_monthly_cap is not null
          then least(2147483647::bigint, crm.target_price_cents::bigint * crm.target_monthly_cap::bigint)::integer
        else 0
      end as estimated_value_cents
    from latest l
    join public.businesses b
      on b.id = l.business_id and b.tenant_id = p_tenant_id
    left join public.lead_buyer_crm_profiles crm
      on crm.tenant_id = p_tenant_id and crm.business_id = l.business_id
    where b.status = 'published'
      and b.claimed
      and l.lead_program_interest = 'interested'
      and coalesce(crm.sales_status, 'open') = 'open'
      and not exists (
        select 1 from public.business_lead_programs lp
        where lp.tenant_id = p_tenant_id
          and lp.business_id = l.business_id
          and lp.status = 'active'
      )
  ), upserted as (
    insert into public.growth_opportunities(
      tenant_id, opportunity_key, opportunity_type, business_id,
      title, detail, score, estimated_monthly_value_cents, status,
      next_action, due_at, source_facts, last_refreshed_at, updated_at
    )
    select p_tenant_id,
      'lead-buyer:' || e.business_id::text,
      'lead_buyer_activation',
      e.business_id,
      'Lead buyer follow-up · ' || e.name,
      'The business owner explicitly asked for more leads after receiving a delivered lead. This is a private sales signal only and does not activate billing, future routing, verification, Sponsored placement or organic ranking changes.',
      98,
      e.estimated_value_cents,
      'open',
      case
        when e.last_contact_at is not null and e.last_contact_at >= e.interest_updated_at and e.follow_up_at is not null
          then 'Follow up on the scheduled date. Confirm lead categories, service areas, price, monthly cap and exclusive/shared rules before any Admin-approved agreement is activated.'
        else 'Owner explicitly requested more leads. Contact the business to confirm lead categories, service areas, price, monthly cap, exclusive/shared rules and delivery-based billing before activating anything.'
      end,
      case
        when e.last_contact_at is not null and e.last_contact_at >= e.interest_updated_at and e.follow_up_at is not null
          then e.follow_up_at
        else now()
      end,
      jsonb_build_object(
        'owner_explicit_interest', true,
        'interest_updated_at', e.interest_updated_at,
        'recipient_id', e.recipient_id,
        'lead_id', e.lead_id,
        'delivery_type', e.delivery_type,
        'target_price_cents', e.target_price_cents,
        'target_monthly_cap', e.target_monthly_cap,
        'preferred_sale_mode', e.preferred_sale_mode,
        'target_billing_model', e.target_billing_model,
        'last_contact_at', e.last_contact_at,
        'follow_up_at', e.follow_up_at
      ),
      now(), now()
    from eligible e
    on conflict (tenant_id, opportunity_key) do update set
      opportunity_type = excluded.opportunity_type,
      business_id = excluded.business_id,
      title = excluded.title,
      detail = excluded.detail,
      score = excluded.score,
      estimated_monthly_value_cents = excluded.estimated_monthly_value_cents,
      status = case when public.growth_opportunities.status = 'in_progress' then 'in_progress' else 'open' end,
      next_action = excluded.next_action,
      due_at = excluded.due_at,
      source_facts = excluded.source_facts,
      last_refreshed_at = now(),
      updated_at = now()
    returning id
  )
  select count(*) into v_upserted from upserted;

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'explicit_interest_upserted', v_upserted,
    'resolved', v_resolved,
    'snoozed', v_snoozed,
    'synced_at', now()
  );
end;
$$;

create or replace function private.lead_buyer_interest_growth_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_program_interest is distinct from old.lead_program_interest
     or new.interest_updated_at is distinct from old.interest_updated_at then
    perform private.sync_explicit_lead_buyer_opportunities(new.tenant_id);
  end if;
  return new;
end;
$$;

drop trigger if exists lead_buyer_interest_growth_sync on public.lead_recipients;
create trigger lead_buyer_interest_growth_sync
after update of lead_program_interest, interest_updated_at on public.lead_recipients
for each row execute function private.lead_buyer_interest_growth_trigger();

create or replace function private.lead_buyer_crm_growth_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_explicit_lead_buyer_opportunities(new.tenant_id);
  return new;
end;
$$;

drop trigger if exists lead_buyer_crm_growth_sync_insert on public.lead_buyer_crm_profiles;
create trigger lead_buyer_crm_growth_sync_insert
after insert on public.lead_buyer_crm_profiles
for each row execute function private.lead_buyer_crm_growth_trigger();

drop trigger if exists lead_buyer_crm_growth_sync_update on public.lead_buyer_crm_profiles;
create trigger lead_buyer_crm_growth_sync_update
after update of sales_status, target_price_cents, target_monthly_cap, preferred_sale_mode, target_billing_model, follow_up_at, last_contact_at, reopened_at
on public.lead_buyer_crm_profiles
for each row execute function private.lead_buyer_crm_growth_trigger();

create or replace function private.lead_program_growth_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_explicit_lead_buyer_opportunities(old.tenant_id);
    return old;
  end if;
  perform private.sync_explicit_lead_buyer_opportunities(new.tenant_id);
  return new;
end;
$$;

drop trigger if exists lead_program_growth_sync_insert on public.business_lead_programs;
create trigger lead_program_growth_sync_insert
after insert on public.business_lead_programs
for each row execute function private.lead_program_growth_trigger();

drop trigger if exists lead_program_growth_sync_status on public.business_lead_programs;
create trigger lead_program_growth_sync_status
after update of status on public.business_lead_programs
for each row execute function private.lead_program_growth_trigger();

drop trigger if exists lead_program_growth_sync_delete on public.business_lead_programs;
create trigger lead_program_growth_sync_delete
after delete on public.business_lead_programs
for each row execute function private.lead_program_growth_trigger();

create or replace function public.refresh_growth_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opportunities jsonb;
  v_explicit_lead_buyers jsonb;
  v_tasks jsonb;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then
    raise exception 'insufficient_privilege';
  end if;
  v_opportunities := private.refresh_growth_opportunities(p_tenant_id);
  v_explicit_lead_buyers := private.sync_explicit_lead_buyer_opportunities(p_tenant_id);
  v_tasks := private.sync_growth_outreach_tasks(p_tenant_id);
  return jsonb_build_object(
    'opportunities', v_opportunities,
    'explicit_lead_buyers', v_explicit_lead_buyers,
    'outreach_tasks', v_tasks
  );
end;
$$;

create or replace function private.refresh_all_growth_opportunities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select distinct tenant_id from public.businesses where tenant_id is not null
  loop
    perform private.ensure_acquisition_research_prospects(r.tenant_id);
    perform private.refresh_growth_opportunities(r.tenant_id);
    perform private.sync_explicit_lead_buyer_opportunities(r.tenant_id);
    perform private.sync_growth_outreach_tasks(r.tenant_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

comment on function private.sync_explicit_lead_buyer_opportunities(uuid) is
'Keeps explicit owner interest in receiving more leads synchronized into the existing private Growth/Action Center opportunity engine without activating billing or future lead routing.';

select private.sync_explicit_lead_buyer_opportunities('6673621d-b359-4c17-a984-c8f50d914eb3'::uuid);
