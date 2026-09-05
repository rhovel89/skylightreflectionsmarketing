-- EDDM production operations: spot inventory, private artwork, profitability and production workflow.

alter table public.skylight_eddm_packages
  add column if not exists slot_prefix text;

update public.skylight_eddm_packages
set slot_prefix = case package_key when 'coop-a' then 'A' when 'coop-b' then 'B' when 'coop-c' then 'C' else slot_prefix end
where slot_prefix is null;

alter table public.skylight_eddm_markets
  add column if not exists campaign_mode text not null default 'coop' check (campaign_mode in ('coop','single_business')),
  add column if not exists production_status text not null default 'interest' check (production_status in ('interest','selling','filled','artwork','payment','ready_to_print','printing','usps_drop','mailed','completed','on_hold','cancelled')),
  add column if not exists target_revenue_cents integer check (target_revenue_cents is null or target_revenue_cents >= 0),
  add column if not exists print_cost_estimate_cents integer not null default 0 check (print_cost_estimate_cents >= 0),
  add column if not exists postage_cost_estimate_cents integer not null default 0 check (postage_cost_estimate_cents >= 0),
  add column if not exists design_cost_estimate_cents integer not null default 0 check (design_cost_estimate_cents >= 0),
  add column if not exists other_cost_estimate_cents integer not null default 0 check (other_cost_estimate_cents >= 0),
  add column if not exists print_cost_actual_cents integer not null default 0 check (print_cost_actual_cents >= 0),
  add column if not exists postage_cost_actual_cents integer not null default 0 check (postage_cost_actual_cents >= 0),
  add column if not exists design_cost_actual_cents integer not null default 0 check (design_cost_actual_cents >= 0),
  add column if not exists other_cost_actual_cents integer not null default 0 check (other_cost_actual_cents >= 0),
  add column if not exists artwork_due_date date,
  add column if not exists print_due_date date,
  add column if not exists actual_mail_date date,
  add column if not exists print_vendor text,
  add column if not exists usps_drop_location text,
  add column if not exists usps_confirmation text,
  add column if not exists production_notes text,
  add column if not exists mailed_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.skylight_eddm_interests
  add column if not exists artwork_status text not null default 'not_received' check (artwork_status in ('not_received','received','needs_changes','proof_ready','approved','print_ready')),
  add column if not exists artwork_due_date date,
  add column if not exists artwork_approved_at timestamptz,
  add column if not exists commitment_amount_cents integer check (commitment_amount_cents is null or commitment_amount_cents >= 0),
  add column if not exists committed_at timestamptz,
  add column if not exists production_notes text;

create table if not exists public.skylight_eddm_spots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  market_id uuid not null references public.skylight_eddm_markets(id) on delete cascade,
  package_id uuid references public.skylight_eddm_packages(id) on delete set null,
  package_key text not null,
  slot_code text not null,
  status text not null default 'available' check (status in ('available','held','reserved','artwork','approved','paid','print_ready','released','cancelled','retired')),
  interest_id uuid references public.skylight_eddm_interests(id) on delete set null,
  agreed_price_cents integer check (agreed_price_cents is null or agreed_price_cents >= 0),
  held_until timestamptz,
  committed_at timestamptz,
  released_at timestamptz,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(market_id,slot_code)
);
create index if not exists skylight_eddm_spots_market_status_idx on public.skylight_eddm_spots(market_id,status,slot_code);
create index if not exists skylight_eddm_spots_interest_idx on public.skylight_eddm_spots(interest_id) where interest_id is not null;

create table if not exists public.skylight_eddm_artwork_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  market_id uuid references public.skylight_eddm_markets(id) on delete cascade,
  interest_id uuid references public.skylight_eddm_interests(id) on delete cascade,
  spot_id uuid references public.skylight_eddm_spots(id) on delete set null,
  asset_type text not null default 'customer_artwork' check (asset_type in ('customer_artwork','proof','approved_proof','print_ready','usps_document','other')),
  status text not null default 'uploaded' check (status in ('uploaded','needs_changes','approved','superseded')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  notes text,
  uploaded_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,storage_path)
);
create index if not exists skylight_eddm_artwork_market_idx on public.skylight_eddm_artwork_assets(market_id,asset_type,status,created_at desc);
create index if not exists skylight_eddm_artwork_interest_idx on public.skylight_eddm_artwork_assets(interest_id,created_at desc);

create table if not exists public.skylight_eddm_activity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  market_id uuid references public.skylight_eddm_markets(id) on delete cascade,
  interest_id uuid references public.skylight_eddm_interests(id) on delete cascade,
  spot_id uuid references public.skylight_eddm_spots(id) on delete set null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists skylight_eddm_activity_market_idx on public.skylight_eddm_activity(market_id,created_at desc);
create index if not exists skylight_eddm_activity_interest_idx on public.skylight_eddm_activity(interest_id,created_at desc);

alter table public.skylight_eddm_spots enable row level security;
alter table public.skylight_eddm_artwork_assets enable row level security;
alter table public.skylight_eddm_activity enable row level security;

drop policy if exists "staff manage eddm spots" on public.skylight_eddm_spots;
create policy "staff manage eddm spots" on public.skylight_eddm_spots for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

drop policy if exists "staff manage eddm artwork" on public.skylight_eddm_artwork_assets;
create policy "staff manage eddm artwork" on public.skylight_eddm_artwork_assets for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

drop policy if exists "staff read eddm activity" on public.skylight_eddm_activity;
create policy "staff read eddm activity" on public.skylight_eddm_activity for select to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

drop policy if exists "staff insert eddm activity" on public.skylight_eddm_activity;
create policy "staff insert eddm activity" on public.skylight_eddm_activity for insert to authenticated
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

grant select,insert,update,delete on public.skylight_eddm_spots,public.skylight_eddm_artwork_assets to authenticated;
grant select,insert on public.skylight_eddm_activity to authenticated;
revoke all on public.skylight_eddm_spots,public.skylight_eddm_artwork_assets,public.skylight_eddm_activity from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('eddm-assets','eddm-assets',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "staff read eddm assets" on storage.objects;
create policy "staff read eddm assets" on storage.objects for select to authenticated using(
  bucket_id='eddm-assets' and case
    when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.has_tenant_role(((storage.foldername(name))[1])::uuid,array['staff','admin','super_admin'])
    else false end
);
drop policy if exists "staff upload eddm assets" on storage.objects;
create policy "staff upload eddm assets" on storage.objects for insert to authenticated with check(
  bucket_id='eddm-assets' and case
    when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.has_tenant_role(((storage.foldername(name))[1])::uuid,array['staff','admin','super_admin'])
    else false end
);
drop policy if exists "staff update eddm assets" on storage.objects;
create policy "staff update eddm assets" on storage.objects for update to authenticated using(
  bucket_id='eddm-assets' and case
    when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.has_tenant_role(((storage.foldername(name))[1])::uuid,array['staff','admin','super_admin'])
    else false end
) with check(
  bucket_id='eddm-assets' and case
    when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.has_tenant_role(((storage.foldername(name))[1])::uuid,array['staff','admin','super_admin'])
    else false end
);
drop policy if exists "staff delete eddm assets" on storage.objects;
create policy "staff delete eddm assets" on storage.objects for delete to authenticated using(
  bucket_id='eddm-assets' and case
    when coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.has_tenant_role(((storage.foldername(name))[1])::uuid,array['staff','admin','super_admin'])
    else false end
);

create or replace function private.sync_eddm_market_spots_internal(p_market_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_mode text; v_inserted integer:=0; r record; n integer; v_prefix text;
begin
  select tenant_id,campaign_mode into v_tenant,v_mode from public.skylight_eddm_markets where id=p_market_id;
  if v_tenant is null or v_mode<>'coop' then return 0; end if;
  for r in select id,package_key,slot_count,slot_prefix from public.skylight_eddm_packages where tenant_id=v_tenant and active=true and mode in('coop','both') and coalesce(slot_count,0)>0 order by sort_order loop
    v_prefix:=upper(coalesce(nullif(btrim(r.slot_prefix),''),right(r.package_key,1)));
    for n in 1..r.slot_count loop
      insert into public.skylight_eddm_spots(tenant_id,market_id,package_id,package_key,slot_code,status)
      values(v_tenant,p_market_id,r.id,r.package_key,v_prefix||n::text,'available')
      on conflict(market_id,slot_code) do nothing;
      if found then v_inserted:=v_inserted+1; end if;
    end loop;
  end loop;
  return v_inserted;
end$$;
revoke all on function private.sync_eddm_market_spots_internal(uuid) from public,anon,authenticated;

create or replace function public.admin_sync_eddm_market_spots(p_market_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.skylight_eddm_markets where id=p_market_id;
  if v_tenant is null then raise exception 'EDDM campaign not found.'; end if;
  if not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'Not authorized.'; end if;
  return private.sync_eddm_market_spots_internal(p_market_id);
end$$;
revoke all on function public.admin_sync_eddm_market_spots(uuid) from public,anon;
grant execute on function public.admin_sync_eddm_market_spots(uuid) to authenticated;

create or replace function private.eddm_market_insert_sync_spots() returns trigger
language plpgsql security definer set search_path='' as $$begin perform private.sync_eddm_market_spots_internal(new.id); return new; end$$;
revoke all on function private.eddm_market_insert_sync_spots() from public,anon,authenticated;
drop trigger if exists eddm_market_insert_sync_spots on public.skylight_eddm_markets;
create trigger eddm_market_insert_sync_spots after insert on public.skylight_eddm_markets for each row execute function private.eddm_market_insert_sync_spots();

create or replace function private.eddm_package_sync_spots() returns trigger
language plpgsql security definer set search_path='' as $$declare r record; begin
  if tg_op='INSERT' or old.slot_count is distinct from new.slot_count or old.slot_prefix is distinct from new.slot_prefix or old.active is distinct from new.active then
    for r in select id from public.skylight_eddm_markets where tenant_id=new.tenant_id and campaign_mode='coop' and production_status not in('completed','cancelled') loop
      perform private.sync_eddm_market_spots_internal(r.id);
    end loop;
  end if;
  return new;
end$$;
revoke all on function private.eddm_package_sync_spots() from public,anon,authenticated;
drop trigger if exists eddm_package_sync_spots on public.skylight_eddm_packages;
create trigger eddm_package_sync_spots after insert or update of slot_count,slot_prefix,active on public.skylight_eddm_packages for each row execute function private.eddm_package_sync_spots();

-- Populate slot inventory for any co-op markets that existed before this migration.
do $$declare r record; begin for r in select id from public.skylight_eddm_markets where campaign_mode='coop' loop perform private.sync_eddm_market_spots_internal(r.id); end loop; end$$;

create or replace view public.skylight_eddm_market_financials with (security_invoker=true) as
with spot_rollup as (
  select s.market_id,
    count(*) filter(where s.status<>'retired')::integer as total_spots,
    count(*) filter(where s.interest_id is not null and s.status not in('available','released','cancelled','retired'))::integer as filled_spots,
    coalesce(sum(coalesce(s.agreed_price_cents,p.price_cents,0)) filter(where s.interest_id is not null and s.status not in('available','released','cancelled','retired')),0)::bigint as spot_committed_revenue_cents,
    coalesce(sum(coalesce(p.price_cents,0)) filter(where s.status<>'retired'),0)::bigint as max_spot_revenue_cents
  from public.skylight_eddm_spots s
  left join public.skylight_eddm_packages p on p.id=s.package_id
  group by s.market_id
), invoice_rollup as (
  select x.market_id,
    coalesce(sum(inv.total_cents),0)::bigint as invoiced_cents,
    coalesce(sum(inv.amount_paid_cents),0)::bigint as paid_cents,
    coalesce(sum(inv.balance_due_cents),0)::bigint as balance_due_cents,
    count(*)::integer as invoice_count,
    count(*) filter(where inv.status='paid')::integer as paid_invoice_count
  from (select distinct market_id,invoice_id from public.skylight_eddm_interests where market_id is not null and invoice_id is not null) x
  join public.skylight_invoices inv on inv.id=x.invoice_id
  group by x.market_id
), readiness as (
  select i.market_id,
    count(*) filter(where i.status not in('lost','cancelled'))::integer as advertiser_count,
    count(*) filter(where i.status in('committed','won'))::integer as committed_advertisers,
    count(*) filter(where i.status in('committed','won') and i.artwork_status not in('approved','print_ready'))::integer as artwork_pending_count,
    count(*) filter(where i.invoice_id is null and i.status in('committed','won'))::integer as uninvoiced_committed_count
  from public.skylight_eddm_interests i where i.market_id is not null group by i.market_id
)
select m.id as market_id,m.tenant_id,m.name,m.campaign_mode,m.production_status,m.target_piece_count,m.target_mail_date,
  coalesce(sr.total_spots,0) as total_spots,coalesce(sr.filled_spots,0) as filled_spots,
  coalesce(rd.advertiser_count,0) as advertiser_count,coalesce(rd.committed_advertisers,0) as committed_advertisers,
  coalesce(rd.artwork_pending_count,0) as artwork_pending_count,coalesce(rd.uninvoiced_committed_count,0) as uninvoiced_committed_count,
  case when m.campaign_mode='single_business' then coalesce(ir.invoiced_cents,m.target_revenue_cents,0) else coalesce(sr.spot_committed_revenue_cents,0) end::bigint as projected_revenue_cents,
  coalesce(sr.max_spot_revenue_cents,0)::bigint as max_spot_revenue_cents,
  coalesce(ir.invoiced_cents,0)::bigint as invoiced_cents,coalesce(ir.paid_cents,0)::bigint as paid_cents,coalesce(ir.balance_due_cents,0)::bigint as balance_due_cents,
  coalesce(ir.invoice_count,0) as invoice_count,coalesce(ir.paid_invoice_count,0) as paid_invoice_count,
  (m.print_cost_estimate_cents+m.postage_cost_estimate_cents+m.design_cost_estimate_cents+m.other_cost_estimate_cents)::bigint as estimated_cost_cents,
  (m.print_cost_actual_cents+m.postage_cost_actual_cents+m.design_cost_actual_cents+m.other_cost_actual_cents)::bigint as actual_cost_cents,
  (case when m.campaign_mode='single_business' then coalesce(ir.invoiced_cents,m.target_revenue_cents,0) else coalesce(sr.spot_committed_revenue_cents,0) end - (m.print_cost_estimate_cents+m.postage_cost_estimate_cents+m.design_cost_estimate_cents+m.other_cost_estimate_cents))::bigint as projected_profit_cents,
  (coalesce(ir.paid_cents,0) - (m.print_cost_actual_cents+m.postage_cost_actual_cents+m.design_cost_actual_cents+m.other_cost_actual_cents))::bigint as cash_profit_cents,
  greatest((m.print_cost_estimate_cents+m.postage_cost_estimate_cents+m.design_cost_estimate_cents+m.other_cost_estimate_cents) - (case when m.campaign_mode='single_business' then coalesce(ir.invoiced_cents,m.target_revenue_cents,0) else coalesce(sr.spot_committed_revenue_cents,0) end),0)::bigint as break_even_remaining_cents,
  case when (case when m.campaign_mode='single_business' then coalesce(ir.invoiced_cents,m.target_revenue_cents,0) else coalesce(sr.spot_committed_revenue_cents,0) end)>0 then round((((case when m.campaign_mode='single_business' then coalesce(ir.invoiced_cents,m.target_revenue_cents,0) else coalesce(sr.spot_committed_revenue_cents,0) end) - (m.print_cost_estimate_cents+m.postage_cost_estimate_cents+m.design_cost_estimate_cents+m.other_cost_estimate_cents))::numeric / (case when m.campaign_mode='single_business' then coalesce(ir.invoiced_cents,m.target_revenue_cents,0) else coalesce(sr.spot_committed_revenue_cents,0) end)::numeric)*10000)::integer else null end as projected_margin_bps
from public.skylight_eddm_markets m
left join spot_rollup sr on sr.market_id=m.id
left join invoice_rollup ir on ir.market_id=m.id
left join readiness rd on rd.market_id=m.id;

grant select on public.skylight_eddm_market_financials to authenticated;
revoke all on public.skylight_eddm_market_financials from anon;

comment on table public.skylight_eddm_spots is 'Private EDDM ad-slot inventory. One market+slot_code row prevents double booking.';
comment on table public.skylight_eddm_artwork_assets is 'Private Admin-only artwork, proof, print-ready and USPS document metadata. Files live in the private eddm-assets storage bucket.';
comment on view public.skylight_eddm_market_financials is 'Private staff revenue/cost/readiness analytics. Estimates are operational projections and are never public ranking signals.';
comment on column public.skylight_eddm_markets.production_status is 'Manual operational stage. Threshold interest never auto-advances to billing, print or mailing.';
