alter table public.business_prospects add column if not exists business_id uuid references public.businesses(id) on delete set null;

create index if not exists business_prospects_business_id_idx on public.business_prospects(business_id);
create unique index if not exists business_prospects_tenant_business_uidx on public.business_prospects(tenant_id,business_id) where business_id is not null;

with matches as (
  select p.id prospect_id, min(b.id::text)::uuid business_id
  from public.business_prospects p
  join public.businesses b
    on b.tenant_id=p.tenant_id
   and b.status='published'
   and lower(regexp_replace(b.name,'[^a-z0-9]+','','g'))=lower(regexp_replace(p.business_name,'[^a-z0-9]+','','g'))
  where p.business_id is null
  group by p.id
  having count(*)=1
)
update public.business_prospects p set business_id=m.business_id,updated_at=now()
from matches m where p.id=m.prospect_id;

create table if not exists public.growth_opportunities(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  opportunity_key text not null,
  opportunity_type text not null check(opportunity_type in('claim_activation','contact_enrichment','paid_plan_activation','pro_upgrade','sponsorship','lead_buyer_activation','skylight_marketing')),
  business_id uuid references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  title text not null,
  detail text,
  score integer not null default 0 check(score between 0 and 100),
  estimated_monthly_value_cents integer not null default 0 check(estimated_monthly_value_cents>=0),
  status text not null default 'open' check(status in('open','in_progress','won','lost','snoozed','dismissed','resolved')),
  next_action text,
  due_at timestamptz,
  assigned_user_id uuid,
  source_facts jsonb not null default '{}'::jsonb,
  last_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,opportunity_key)
);

alter table public.growth_opportunities enable row level security;

drop policy if exists "staff manage growth opportunities" on public.growth_opportunities;
create policy "staff manage growth opportunities" on public.growth_opportunities
for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create index if not exists growth_opportunities_tenant_status_score_idx on public.growth_opportunities(tenant_id,status,score desc,updated_at desc);
create index if not exists growth_opportunities_business_idx on public.growth_opportunities(business_id);
create index if not exists growth_opportunities_prospect_idx on public.growth_opportunities(prospect_id);
create index if not exists growth_opportunities_type_idx on public.growth_opportunities(tenant_id,opportunity_type,status);

create or replace function private.refresh_growth_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_upserts integer:=0;
  v_resolved integer:=0;
begin
  with matches as (
    select p.id prospect_id, min(b.id::text)::uuid business_id
    from public.business_prospects p
    join public.businesses b
      on b.tenant_id=p.tenant_id
     and b.status='published'
     and lower(regexp_replace(b.name,'[^a-z0-9]+','','g'))=lower(regexp_replace(p.business_name,'[^a-z0-9]+','','g'))
    where p.tenant_id=p_tenant_id and p.business_id is null
    group by p.id
    having count(*)=1
  )
  update public.business_prospects p set business_id=m.business_id,updated_at=now()
  from matches m where p.id=m.prospect_id;

  create temporary table if not exists growth_refresh_keys(key text primary key) on commit drop;
  truncate growth_refresh_keys;

  with prospect as (
    select distinct on(p.business_id) p.*
    from public.business_prospects p
    where p.tenant_id=p_tenant_id and p.business_id is not null
    order by p.business_id,p.updated_at desc
  ), rows as (
    select b.id business_id,p.id prospect_id,b.name,p.priority,p.opportunity_score,p.owner_contact_email,p.owner_contact_phone,p.website,
      least(100,40 + case p.priority when 'hot' then 20 when 'high' then 15 when 'medium' then 8 else 0 end + case when coalesce(p.owner_contact_email,'')<>'' then 20 else 0 end + case when coalesce(p.owner_contact_phone,'')<>'' then 15 else 0 end + case when coalesce(b.website,'')<>'' then 5 else 0 end)::int score
    from public.businesses b left join prospect p on p.business_id=b.id
    where b.tenant_id=p_tenant_id and b.status='published' and not b.claimed
  ), upserted as (
    insert into public.growth_opportunities(tenant_id,opportunity_key,opportunity_type,business_id,prospect_id,title,detail,score,estimated_monthly_value_cents,next_action,source_facts,last_refreshed_at,updated_at)
    select p_tenant_id,'claim:'||r.business_id,'claim_activation',r.business_id,r.prospect_id,'Claim '||r.name,
      'Convert this published directory listing into an owner-controlled account. Claiming does not create verification and does not change organic rank.',
      r.score,0,
      case when coalesce(r.owner_contact_email,'')<>'' or coalesce(r.owner_contact_phone,'')<>'' then 'Send a factual free-claim invitation using the verified owner contact channel.' else 'Research a legitimate owner or decision-maker contact before outreach.' end,
      jsonb_build_object('priority',coalesce(r.priority,'unresearched'),'prospect_score',coalesce(r.opportunity_score,0),'has_owner_email',coalesce(r.owner_contact_email,'')<>'','has_owner_phone',coalesce(r.owner_contact_phone,'')<>'','has_website',coalesce(r.website,'')<>''),now(),now()
    from rows r
    on conflict(tenant_id,opportunity_key) do update set prospect_id=excluded.prospect_id,title=excluded.title,detail=excluded.detail,score=excluded.score,next_action=excluded.next_action,source_facts=excluded.source_facts,last_refreshed_at=now(),updated_at=now(),status=case when public.growth_opportunities.status='resolved' then 'open' else public.growth_opportunities.status end
    returning opportunity_key
  ) insert into growth_refresh_keys select opportunity_key from upserted on conflict do nothing;
  get diagnostics v_upserts=row_count;

  with rows as (
    select p.id prospect_id,p.business_id,b.name,p.priority,p.opportunity_score
    from public.business_prospects p join public.businesses b on b.id=p.business_id
    where p.tenant_id=p_tenant_id and b.status='published' and not b.claimed and p.status<>'do_not_contact'
      and coalesce(p.owner_contact_email,'')='' and coalesce(p.owner_contact_phone,'')=''
  ), upserted as (
    insert into public.growth_opportunities(tenant_id,opportunity_key,opportunity_type,business_id,prospect_id,title,detail,score,next_action,source_facts,last_refreshed_at,updated_at)
    select p_tenant_id,'contact:'||r.business_id,'contact_enrichment',r.business_id,r.prospect_id,'Find owner contact for '||r.name,
      'This listing is ready for claim outreach, but the CRM does not yet contain an owner email or owner phone. Research only legitimate public business contact sources.',
      least(100,45+case r.priority when 'hot' then 25 when 'high' then 18 when 'medium' then 10 else 0 end+least(15,coalesce(r.opportunity_score,0)/7))::int,
      'Research and verify a public owner/decision-maker email or phone, then update the prospect record before outreach.',
      jsonb_build_object('priority',r.priority,'prospect_score',r.opportunity_score),now(),now()
    from rows r
    on conflict(tenant_id,opportunity_key) do update set prospect_id=excluded.prospect_id,title=excluded.title,detail=excluded.detail,score=excluded.score,next_action=excluded.next_action,source_facts=excluded.source_facts,last_refreshed_at=now(),updated_at=now(),status=case when public.growth_opportunities.status='resolved' then 'open' else public.growth_opportunities.status end
    returning opportunity_key
  ) insert into growth_refresh_keys select opportunity_key from upserted on conflict do nothing;
  get diagnostics v_upserts=row_count;

  with pro_price as (
    select monthly_price_cents from public.plans where tenant_id=p_tenant_id and slug='pro' and is_active order by sort_order limit 1
  ), entry_price as (
    select monthly_price_cents from public.plans where tenant_id=p_tenant_id and monthly_price_cents>0 and is_active order by monthly_price_cents limit 1
  ), active_sub as (
    select distinct on(s.business_id) s.business_id,p.slug,p.name,p.monthly_price_cents
    from public.subscriptions s left join public.plans p on p.id=s.plan_id
    where coalesce(s.tenant_id,p_tenant_id)=p_tenant_id and s.status in('active','trialing')
    order by s.business_id,s.updated_at desc
  ), rows as (
    select b.id business_id,b.name,a.slug plan_slug,a.name plan_name,a.monthly_price_cents current_price,
      coalesce((select monthly_price_cents from entry_price),0) entry_price,
      coalesce((select monthly_price_cents from pro_price),0) pro_price
    from public.businesses b left join active_sub a on a.business_id=b.id
    where b.tenant_id=p_tenant_id and b.status='published' and b.claimed
  ), upserted as (
    insert into public.growth_opportunities(tenant_id,opportunity_key,opportunity_type,business_id,title,detail,score,estimated_monthly_value_cents,next_action,source_facts,last_refreshed_at,updated_at)
    select p_tenant_id,'paid-plan:'||r.business_id,'paid_plan_activation',r.business_id,'Paid plan opportunity · '||r.name,
      'The business is claimed but has no active paid directory subscription. Offer the plan that matches the owner’s actual needs; paid status must not alter organic rank.',
      72,r.entry_price,'Review the owner’s goals and present the appropriate optional paid plan without implying ranking or verification can be bought.',jsonb_build_object('current_plan',coalesce(r.plan_slug,'none'),'entry_monthly_cents',r.entry_price),now(),now()
    from rows r where r.plan_slug is null or r.current_price=0
    on conflict(tenant_id,opportunity_key) do update set title=excluded.title,detail=excluded.detail,score=excluded.score,estimated_monthly_value_cents=excluded.estimated_monthly_value_cents,next_action=excluded.next_action,source_facts=excluded.source_facts,last_refreshed_at=now(),updated_at=now(),status=case when public.growth_opportunities.status='resolved' then 'open' else public.growth_opportunities.status end
    returning opportunity_key
  ) insert into growth_refresh_keys select opportunity_key from upserted on conflict do nothing;

  with pro_price as (
    select monthly_price_cents from public.plans where tenant_id=p_tenant_id and slug='pro' and is_active order by sort_order limit 1
  ), active_sub as (
    select distinct on(s.business_id) s.business_id,p.slug,p.name,p.monthly_price_cents
    from public.subscriptions s join public.plans p on p.id=s.plan_id
    where coalesce(s.tenant_id,p_tenant_id)=p_tenant_id and s.status in('active','trialing') and p.monthly_price_cents>0
    order by s.business_id,s.updated_at desc
  ), rows as (
    select b.id business_id,b.name,a.slug plan_slug,a.name plan_name,a.monthly_price_cents current_price,coalesce((select monthly_price_cents from pro_price),0) pro_price
    from public.businesses b join active_sub a on a.business_id=b.id
    where b.tenant_id=p_tenant_id and b.status='published' and b.claimed and a.slug<>'pro'
  ), upserted as (
    insert into public.growth_opportunities(tenant_id,opportunity_key,opportunity_type,business_id,title,detail,score,estimated_monthly_value_cents,next_action,source_facts,last_refreshed_at,updated_at)
    select p_tenant_id,'pro-upgrade:'||r.business_id,'pro_upgrade',r.business_id,'Pro growth tools · '||r.name,
      'This claimed business is already paying for a lower directory plan. Pro adds Lead Inbox and conversion tools, but does not purchase organic rank.',
      64,greatest(0,r.pro_price-r.current_price),'Use actual owner needs and product usage to determine whether Pro is a legitimate fit.',jsonb_build_object('current_plan',r.plan_slug,'current_monthly_cents',r.current_price,'pro_monthly_cents',r.pro_price),now(),now()
    from rows r where r.pro_price>r.current_price
    on conflict(tenant_id,opportunity_key) do update set title=excluded.title,detail=excluded.detail,score=excluded.score,estimated_monthly_value_cents=excluded.estimated_monthly_value_cents,next_action=excluded.next_action,source_facts=excluded.source_facts,last_refreshed_at=now(),updated_at=now(),status=case when public.growth_opportunities.status='resolved' then 'open' else public.growth_opportunities.status end
    returning opportunity_key
  ) insert into growth_refresh_keys select opportunity_key from upserted on conflict do nothing;

  with active_sub as (
    select distinct on(s.business_id) s.business_id,p.slug,p.name
    from public.subscriptions s join public.plans p on p.id=s.plan_id
    where coalesce(s.tenant_id,p_tenant_id)=p_tenant_id and s.status in('active','trialing') and p.monthly_price_cents>0
    order by s.business_id,s.updated_at desc
  ), rows as (
    select b.id business_id,b.name,a.slug plan_slug
    from public.businesses b join active_sub a on a.business_id=b.id
    where b.tenant_id=p_tenant_id and b.status='published' and b.claimed
      and not exists(select 1 from public.sponsorships sp where sp.business_id=b.id and sp.active and (sp.ends_on is null or sp.ends_on>=current_date))
  ), upserted as (
    insert into public.growth_opportunities(tenant_id,opportunity_key,opportunity_type,business_id,title,detail,score,next_action,source_facts,last_refreshed_at,updated_at)
    select p_tenant_id,'sponsorship:'||r.business_id,'sponsorship',r.business_id,'Sponsored visibility · '||r.name,
      'This paying business has no active sponsorship. Sponsorship is clearly labeled advertising and must remain separate from organic relevance, verification and index eligibility.',
      52,'Evaluate real market sponsorship inventory and offer only clearly labeled placement that fits the business.',jsonb_build_object('current_plan',r.plan_slug),now(),now()
    from rows r
    on conflict(tenant_id,opportunity_key) do update set title=excluded.title,detail=excluded.detail,score=excluded.score,next_action=excluded.next_action,source_facts=excluded.source_facts,last_refreshed_at=now(),updated_at=now(),status=case when public.growth_opportunities.status='resolved' then 'open' else public.growth_opportunities.status end
    returning opportunity_key
  ) insert into growth_refresh_keys select opportunity_key from upserted on conflict do nothing;

  with active_sub as (
    select distinct on(s.business_id) s.business_id,p.slug
    from public.subscriptions s join public.plans p on p.id=s.plan_id
    where coalesce(s.tenant_id,p_tenant_id)=p_tenant_id and s.status in('active','trialing') and p.slug in('featured','pro')
    order by s.business_id,s.updated_at desc
  ), rows as (
    select b.id business_id,b.name,a.slug plan_slug
    from public.businesses b join active_sub a on a.business_id=b.id
    where b.tenant_id=p_tenant_id and b.status='published' and b.claimed
      and not exists(select 1 from public.business_lead_programs lp where lp.business_id=b.id and lp.status='active')
  ), upserted as (
    insert into public.growth_opportunities(tenant_id,opportunity_key,opportunity_type,business_id,title,detail,score,next_action,source_facts,last_refreshed_at,updated_at)
    select p_tenant_id,'lead-buyer:'||r.business_id,'lead_buyer_activation',r.business_id,'Lead buyer activation · '||r.name,
      case when r.plan_slug='pro' then 'Pro includes Lead Inbox, but this business does not yet have an active lead-purchase agreement.' else 'Featured may use Lead Inbox only through the approved add-on/agreement path; no active lead-purchase agreement exists.' end,
      case when r.plan_slug='pro' then 66 else 48 end,
      'Discuss lead geography, services, pricing model, monthly cap, exclusive/shared rules and delivery-based billing before activating any lead agreement.',jsonb_build_object('current_plan',r.plan_slug),now(),now()
    from rows r
    on conflict(tenant_id,opportunity_key) do update set title=excluded.title,detail=excluded.detail,score=excluded.score,next_action=excluded.next_action,source_facts=excluded.source_facts,last_refreshed_at=now(),updated_at=now(),status=case when public.growth_opportunities.status='resolved' then 'open' else public.growth_opportunities.status end
    returning opportunity_key
  ) insert into growth_refresh_keys select opportunity_key from upserted on conflict do nothing;

  with rows as (
    select p.id prospect_id,p.business_id,p.business_name,p.priority,p.opportunity_score,p.marketing_flags,p.marketing_pitch_sent_at,p.owner_contact_email,p.owner_contact_phone
    from public.business_prospects p
    where p.tenant_id=p_tenant_id and p.status<>'do_not_contact' and cardinality(coalesce(p.marketing_flags,array[]::text[]))>0
  ), upserted as (
    insert into public.growth_opportunities(tenant_id,opportunity_key,opportunity_type,business_id,prospect_id,title,detail,score,next_action,source_facts,last_refreshed_at,updated_at)
    select p_tenant_id,'skylight:'||r.prospect_id,'skylight_marketing',r.business_id,r.prospect_id,'Skylight opportunity · '||r.business_name,
      'The research CRM contains legitimate marketing-opportunity flags for this business. This is a Skylight Reflections Marketing sales signal, not a directory ranking factor.',
      least(100,35+case r.priority when 'hot' then 25 when 'high' then 18 when 'medium' then 10 else 0 end+least(22,coalesce(r.opportunity_score,0)/4)+case when coalesce(r.owner_contact_email,'')<>'' or coalesce(r.owner_contact_phone,'')<>'' then 12 else 0 end)::int,
      case when coalesce(r.owner_contact_email,'')<>'' or coalesce(r.owner_contact_phone,'')<>'' then 'Review the research flags and, if appropriate, make a separate factual Skylight marketing offer.' else 'Enrich a legitimate decision-maker contact before any marketing outreach.' end,
      jsonb_build_object('priority',r.priority,'prospect_score',r.opportunity_score,'marketing_flags',r.marketing_flags,'pitch_sent_at',r.marketing_pitch_sent_at,'contactable',coalesce(r.owner_contact_email,'')<>'' or coalesce(r.owner_contact_phone,'')<>''),now(),now()
    from rows r
    on conflict(tenant_id,opportunity_key) do update set business_id=excluded.business_id,prospect_id=excluded.prospect_id,title=excluded.title,detail=excluded.detail,score=excluded.score,next_action=excluded.next_action,source_facts=excluded.source_facts,last_refreshed_at=now(),updated_at=now(),status=case when public.growth_opportunities.status='resolved' then 'open' else public.growth_opportunities.status end
    returning opportunity_key
  ) insert into growth_refresh_keys select opportunity_key from upserted on conflict do nothing;

  update public.growth_opportunities g
  set status='resolved',updated_at=now(),last_refreshed_at=now()
  where g.tenant_id=p_tenant_id and g.status in('open','in_progress')
    and not exists(select 1 from growth_refresh_keys k where k.key=g.opportunity_key);
  get diagnostics v_resolved=row_count;

  return jsonb_build_object('tenant_id',p_tenant_id,'active_opportunities',(select count(*) from public.growth_opportunities where tenant_id=p_tenant_id and status in('open','in_progress','snoozed')),'resolved_now',v_resolved,'refreshed_at',now());
end$$;

revoke all on function private.refresh_growth_opportunities(uuid) from public,anon,authenticated;
grant execute on function private.refresh_growth_opportunities(uuid) to service_role;

create or replace function public.refresh_growth_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then raise exception 'insufficient_privilege'; end if;
  return private.refresh_growth_opportunities(p_tenant_id);
end$$;
revoke all on function public.refresh_growth_opportunities(uuid) from public,anon;
grant execute on function public.refresh_growth_opportunities(uuid) to authenticated,service_role;

create or replace function private.refresh_all_growth_opportunities()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare r record; n integer:=0;
begin
  for r in select distinct tenant_id from public.businesses where tenant_id is not null loop
    perform private.refresh_growth_opportunities(r.tenant_id); n:=n+1;
  end loop;
  return n;
end$$;
revoke all on function private.refresh_all_growth_opportunities() from public,anon,authenticated;
grant execute on function private.refresh_all_growth_opportunities() to service_role;

select private.refresh_all_growth_opportunities();

select cron.schedule('local-pros-growth-opportunity-refresh','35 12 * * *',$$select private.refresh_all_growth_opportunities();$$)
where not exists(select 1 from cron.job where jobname='local-pros-growth-opportunity-refresh');
