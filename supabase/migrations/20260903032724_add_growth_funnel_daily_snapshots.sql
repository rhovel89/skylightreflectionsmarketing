create table if not exists public.growth_daily_metrics(
  tenant_id uuid not null,
  metric_date date not null default current_date,
  published_businesses integer not null default 0,
  contactable_prospects integer not null default 0,
  open_contact_research integer not null default 0,
  open_claim_invites integer not null default 0,
  claimed_businesses integer not null default 0,
  owner_links integer not null default 0,
  active_paid_accounts integer not null default 0,
  active_pro_accounts integer not null default 0,
  active_sponsorships integer not null default 0,
  active_lead_buyers integer not null default 0,
  open_growth_opportunities integer not null default 0,
  plan_mrr_cents integer not null default 0,
  paid_lead_revenue_30d_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(tenant_id,metric_date)
);

alter table public.growth_daily_metrics enable row level security;
drop policy if exists "staff read growth daily metrics" on public.growth_daily_metrics;
create policy "staff read growth daily metrics" on public.growth_daily_metrics
for select to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create or replace function private.snapshot_growth_metrics(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_published integer:=0;v_contactable integer:=0;v_research integer:=0;v_claim_invites integer:=0;v_claimed integer:=0;v_owners integer:=0;
  v_paid integer:=0;v_pro integer:=0;v_sponsors integer:=0;v_buyers integer:=0;v_opps integer:=0;v_mrr integer:=0;v_lead_revenue integer:=0;
begin
  select count(*) into v_published from public.businesses where tenant_id=p_tenant_id and status='published';
  select count(*) into v_claimed from public.businesses where tenant_id=p_tenant_id and status='published' and claimed;
  select count(*) into v_contactable from public.business_prospects where tenant_id=p_tenant_id and crm_stage='claim_outreach' and status in('published','contact_ready') and (coalesce(owner_contact_email,'')<>'' or coalesce(owner_contact_phone,'')<>'');
  select count(*) filter(where task_type='contact_research'),count(*) filter(where task_type='claim_invite') into v_research,v_claim_invites from public.outreach_tasks where tenant_id=p_tenant_id and status in('open','in_progress');
  select count(*) into v_owners from public.business_owners bo join public.businesses b on b.id=bo.business_id where b.tenant_id=p_tenant_id;
  with active as(
    select distinct on(s.business_id) s.business_id,s.billing_interval,p.slug,p.monthly_price_cents,p.annual_price_cents
    from public.subscriptions s join public.businesses b on b.id=s.business_id left join public.plans p on p.id=s.plan_id
    where b.tenant_id=p_tenant_id and s.status in('active','trialing') and coalesce(p.monthly_price_cents,0)>0
    order by s.business_id,s.updated_at desc
  )
  select count(*),count(*) filter(where slug='pro'),coalesce(sum(case when billing_interval='annual' and annual_price_cents>0 then round(annual_price_cents::numeric/12)::int else monthly_price_cents end),0)
  into v_paid,v_pro,v_mrr from active;
  select count(*) into v_sponsors from public.sponsorships sp join public.businesses b on b.id=sp.business_id where b.tenant_id=p_tenant_id and sp.active and (sp.ends_on is null or sp.ends_on>=current_date);
  select count(*) into v_buyers from public.business_lead_programs where tenant_id=p_tenant_id and status='active';
  select count(*) into v_opps from public.growth_opportunities where tenant_id=p_tenant_id and status in('open','in_progress','snoozed');
  select coalesce(sum(amount_due_cents),0) into v_lead_revenue from public.lead_invoices where tenant_id=p_tenant_id and status='paid' and paid_at>=now()-interval '30 days';

  insert into public.growth_daily_metrics(tenant_id,metric_date,published_businesses,contactable_prospects,open_contact_research,open_claim_invites,claimed_businesses,owner_links,active_paid_accounts,active_pro_accounts,active_sponsorships,active_lead_buyers,open_growth_opportunities,plan_mrr_cents,paid_lead_revenue_30d_cents,updated_at)
  values(p_tenant_id,current_date,v_published,v_contactable,v_research,v_claim_invites,v_claimed,v_owners,v_paid,v_pro,v_sponsors,v_buyers,v_opps,v_mrr,v_lead_revenue,now())
  on conflict(tenant_id,metric_date) do update set published_businesses=excluded.published_businesses,contactable_prospects=excluded.contactable_prospects,open_contact_research=excluded.open_contact_research,open_claim_invites=excluded.open_claim_invites,claimed_businesses=excluded.claimed_businesses,owner_links=excluded.owner_links,active_paid_accounts=excluded.active_paid_accounts,active_pro_accounts=excluded.active_pro_accounts,active_sponsorships=excluded.active_sponsorships,active_lead_buyers=excluded.active_lead_buyers,open_growth_opportunities=excluded.open_growth_opportunities,plan_mrr_cents=excluded.plan_mrr_cents,paid_lead_revenue_30d_cents=excluded.paid_lead_revenue_30d_cents,updated_at=now();
  return jsonb_build_object('metric_date',current_date,'published',v_published,'contactable',v_contactable,'claim_invites',v_claim_invites,'claimed',v_claimed,'paid_accounts',v_paid,'plan_mrr_cents',v_mrr,'paid_lead_revenue_30d_cents',v_lead_revenue);
end$$;

revoke all on function private.snapshot_growth_metrics(uuid) from public,anon,authenticated;
grant execute on function private.snapshot_growth_metrics(uuid) to service_role;

create or replace function private.snapshot_all_growth_metrics()
returns integer language plpgsql security definer set search_path='' as $$
declare r record;n integer:=0;begin for r in select distinct tenant_id from public.businesses where tenant_id is not null loop perform private.snapshot_growth_metrics(r.tenant_id);n:=n+1;end loop;return n;end$$;
revoke all on function private.snapshot_all_growth_metrics() from public,anon,authenticated;
grant execute on function private.snapshot_all_growth_metrics() to service_role;

select private.snapshot_all_growth_metrics();
select cron.schedule('local-pros-growth-daily-snapshot','45 12 * * *',$$select private.snapshot_all_growth_metrics();$$)
where not exists(select 1 from cron.job where jobname='local-pros-growth-daily-snapshot');
