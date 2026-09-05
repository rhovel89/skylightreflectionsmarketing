-- Skylight EDDM / direct-mail service. Co-op interest never auto-launches or auto-bills.
create table if not exists public.skylight_eddm_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  coop_enabled boolean not null default true,
  single_business_enabled boolean not null default true,
  default_piece_count integer not null default 10000 check(default_piece_count > 0),
  default_coop_required_businesses integer check(default_coop_required_businesses is null or default_coop_required_businesses between 2 and 50),
  public_note text,
  internal_note text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skylight_eddm_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  package_key text not null,
  name text not null,
  mode text not null check(mode in ('coop','single_business','both')),
  billing_period text not null default 'one_time' check(billing_period in ('one_time','monthly','custom')),
  price_cents integer check(price_cents is null or price_cents >= 0),
  ad_width_in numeric(6,2),
  ad_height_in numeric(6,2),
  slot_count integer check(slot_count is null or slot_count > 0),
  default_piece_count integer check(default_piece_count is null or default_piece_count > 0),
  description text,
  active boolean not null default true,
  public_visible boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,package_key)
);

create table if not exists public.skylight_eddm_markets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  city text,
  state text,
  county text,
  postal_codes text[] not null default '{}',
  area_description text,
  status text not null default 'gathering_interest' check(status in ('gathering_interest','threshold_met','quoting','scheduled','active','completed','cancelled')),
  public_interest_open boolean not null default true,
  required_businesses integer check(required_businesses is null or required_businesses between 2 and 50),
  target_piece_count integer check(target_piece_count is null or target_piece_count > 0),
  target_mail_date date,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists skylight_eddm_markets_queue_idx on public.skylight_eddm_markets(tenant_id,status,city,state,created_at desc);

create table if not exists public.skylight_eddm_interests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  mode text not null check(mode in ('coop','single_business')),
  market_id uuid references public.skylight_eddm_markets(id) on delete set null,
  marketing_lead_id uuid references public.marketing_leads(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  client_id uuid references public.skylight_clients(id) on delete set null,
  invoice_id uuid references public.skylight_invoices(id) on delete set null,
  business_name text not null,
  contact_name text,
  phone text,
  email text,
  city text,
  state text,
  postal_code text,
  area_description text,
  desired_piece_count integer check(desired_piece_count is null or desired_piece_count > 0),
  package_key text,
  smart_coupon boolean not null default false,
  message text,
  consent_to_contact boolean not null default false,
  status text not null default 'new' check(status in ('new','contacted','qualified','waitlist','quoted','committed','won','lost','cancelled')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists skylight_eddm_interests_queue_idx on public.skylight_eddm_interests(tenant_id,mode,status,created_at desc);
create index if not exists skylight_eddm_interests_market_idx on public.skylight_eddm_interests(market_id,status,created_at desc);

alter table public.skylight_eddm_settings enable row level security;
alter table public.skylight_eddm_packages enable row level security;
alter table public.skylight_eddm_markets enable row level security;
alter table public.skylight_eddm_interests enable row level security;

drop policy if exists "staff manage eddm settings" on public.skylight_eddm_settings;
create policy "staff manage eddm settings" on public.skylight_eddm_settings for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

drop policy if exists "public read eddm packages" on public.skylight_eddm_packages;
create policy "public read eddm packages" on public.skylight_eddm_packages for select to anon,authenticated using(active and public_visible);
drop policy if exists "staff manage eddm packages" on public.skylight_eddm_packages;
create policy "staff manage eddm packages" on public.skylight_eddm_packages for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

drop policy if exists "staff manage eddm markets" on public.skylight_eddm_markets;
create policy "staff manage eddm markets" on public.skylight_eddm_markets for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

drop policy if exists "staff manage eddm interests" on public.skylight_eddm_interests;
create policy "staff manage eddm interests" on public.skylight_eddm_interests for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

grant select,insert,update,delete on public.skylight_eddm_settings,public.skylight_eddm_markets,public.skylight_eddm_interests to authenticated;
grant select on public.skylight_eddm_packages to anon,authenticated;
grant insert,update,delete on public.skylight_eddm_packages to authenticated;
revoke all on public.skylight_eddm_settings,public.skylight_eddm_markets,public.skylight_eddm_interests from anon;

insert into public.skylight_eddm_settings(tenant_id,default_piece_count,public_note)
select t.id,10000,'Co-op mailers move forward only after enough businesses in the same market show interest and Skylight confirms the campaign. Single-business EDDM can be quoted independently.'
from public.tenants t
on conflict(tenant_id) do nothing;

insert into public.skylight_eddm_packages(tenant_id,package_key,name,mode,billing_period,price_cents,ad_width_in,ad_height_in,slot_count,default_piece_count,description,sort_order)
select t.id,v.package_key,v.name,v.mode,v.billing_period,v.price_cents,v.w,v.h,v.slots,v.pieces,v.description,v.sort_order
from public.tenants t
cross join (values
 ('coop-a','Co-op Community Mailer — A Spot','coop','one_time',70000,3.40::numeric,2.80::numeric,6,10000,'Starter preset based on the current Skylight community-mailer example. Pricing, size and quantity remain editable.',10),
 ('coop-b','Co-op Community Mailer — B Spot','coop','one_time',57500,3.50::numeric,2.10::numeric,3,10000,'Starter preset based on the current Skylight community-mailer example. Pricing, size and quantity remain editable.',20),
 ('coop-c','Co-op Community Mailer — C Spot','coop','one_time',57500,3.50::numeric,2.00::numeric,1,10000,'Starter preset based on the current Skylight community-mailer example. Pricing, size and quantity remain editable.',30),
 ('single-business','Single-Business EDDM Campaign','single_business','custom',null,null,null,null,10000,'One business controls the mailer. Final pricing depends on mail quantity, routes, design, printing, postage and campaign scope.',40),
 ('smart-coupon','Smart Coupon Add-on','both','monthly',25000,null,null,null,null,'Optional text-message coupon and reminder add-on. Starter preset from the current Skylight mailer example; fully editable.',50)
) as v(package_key,name,mode,billing_period,price_cents,w,h,slots,pieces,description,sort_order)
on conflict(tenant_id,package_key) do nothing;

insert into public.skylight_service_catalog(tenant_id,name,slug,category,short_description,description,pricing_model,default_price_cents,unit_label,billing_label,public_visible,active,featured,sort_order,cta_label)
select t.id,'EDDM & Direct Mail','eddm-direct-mail','Direct Mail & EDDM',
'Reach households through either a shared co-op community mailer or a dedicated single-business EDDM campaign.',
'Choose a co-op community mailer that launches only after enough businesses in the same area show interest, or a single-business EDDM campaign built around one advertiser. Market thresholds, quantities, ad sizes, add-ons and pricing are customizable.',
'custom_quote',null,'campaign','Co-op or single-business options',true,true,true,85,'Explore EDDM Options'
from public.tenants t
on conflict(tenant_id,slug) do update set name=excluded.name,category=excluded.category,short_description=excluded.short_description,description=excluded.description,billing_label=excluded.billing_label,active=true,public_visible=true,featured=true,cta_label=excluded.cta_label,updated_at=now();

insert into public.skylight_sales_campaigns(tenant_id,name,slug,campaign_type,service_slug,description,status)
select t.id,'EDDM & Direct Mail Opportunities','eddm-direct-mail-opportunities','service_outreach','eddm-direct-mail','Businesses that may benefit from co-op community mailers or dedicated single-business EDDM campaigns.','active'
from public.tenants t
on conflict(tenant_id,slug) do nothing;

create or replace function public.submit_skylight_eddm_interest(
 p_tenant_id uuid,p_mode text,p_business_name text,p_contact_name text,p_phone text,p_email text,
 p_city text,p_state text,p_postal_code text,p_area_description text,p_desired_piece_count integer,
 p_package_key text,p_smart_coupon boolean,p_message text,p_consent_to_contact boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_mode text:=lower(btrim(coalesce(p_mode,''))); v_lead uuid; v_market uuid; v_interest uuid; v_required integer; v_count integer; v_name text;
begin
 if v_mode not in ('coop','single_business') then raise exception 'Choose co-op or single-business EDDM.'; end if;
 if coalesce(p_consent_to_contact,false)=false then raise exception 'Contact consent is required.'; end if;
 if length(btrim(coalesce(p_business_name,'')))<2 then raise exception 'Business name is required.'; end if;
 if nullif(btrim(coalesce(p_phone,'')),'') is null and nullif(btrim(coalesce(p_email,'')),'') is null then raise exception 'Phone or email is required.'; end if;
 if v_mode='coop' and nullif(btrim(coalesce(p_city,'')),'') is null and nullif(btrim(coalesce(p_postal_code,'')),'') is null and nullif(btrim(coalesce(p_area_description,'')),'') is null then raise exception 'Choose the town, city, ZIP or area for the co-op mailer.'; end if;
 insert into public.marketing_leads(tenant_id,business_name,contact_name,phone,email,service_interest,message,status,created_at,consent_to_contact,source,landing_path)
 values(p_tenant_id,left(btrim(p_business_name),160),nullif(left(btrim(coalesce(p_contact_name,'')),120),''),nullif(left(btrim(coalesce(p_phone,'')),80),''),nullif(left(btrim(coalesce(p_email,'')),240),''),'eddm-direct-mail',nullif(left(btrim(coalesce(p_message,'')),2400),''),'new',now(),true,'skylight_eddm','/eddm') returning id into v_lead;
 if v_mode='coop' then
   select m.id into v_market from public.skylight_eddm_markets m
   where m.tenant_id=p_tenant_id and m.public_interest_open=true and m.status in('gathering_interest','threshold_met')
     and lower(coalesce(m.city,''))=lower(btrim(coalesce(p_city,''))) and lower(coalesce(m.state,''))=lower(btrim(coalesce(p_state,'')))
     and (nullif(btrim(coalesce(p_postal_code,'')),'') is null or p_postal_code=any(m.postal_codes))
   order by m.created_at desc limit 1;
   if v_market is null then
     v_name:=coalesce(nullif(btrim(coalesce(p_city,'')),''),nullif(btrim(coalesce(p_postal_code,'')),''),nullif(btrim(coalesce(p_area_description,'')),''),'New Co-op Market')||case when nullif(btrim(coalesce(p_state,'')),'') is not null then ', '||upper(left(btrim(p_state),2)) else '' end;
     insert into public.skylight_eddm_markets(tenant_id,name,city,state,postal_codes,area_description,status,required_businesses,target_piece_count)
     select p_tenant_id,left(v_name,180),nullif(left(btrim(coalesce(p_city,'')),120),''),nullif(upper(left(btrim(coalesce(p_state,'')),2)),''),
       case when nullif(btrim(coalesce(p_postal_code,'')),'') is null then '{}'::text[] else array[left(btrim(p_postal_code),20)] end,
       nullif(left(btrim(coalesce(p_area_description,'')),600),''),'gathering_interest',s.default_coop_required_businesses,
       coalesce(nullif(p_desired_piece_count,0),s.default_piece_count)
     from public.skylight_eddm_settings s where s.tenant_id=p_tenant_id returning id,required_businesses into v_market,v_required;
   else select required_businesses into v_required from public.skylight_eddm_markets where id=v_market; end if;
 end if;
 insert into public.skylight_eddm_interests(tenant_id,mode,market_id,marketing_lead_id,business_name,contact_name,phone,email,city,state,postal_code,area_description,desired_piece_count,package_key,smart_coupon,message,consent_to_contact,status)
 values(p_tenant_id,v_mode,v_market,v_lead,left(btrim(p_business_name),160),nullif(left(btrim(coalesce(p_contact_name,'')),120),''),nullif(left(btrim(coalesce(p_phone,'')),80),''),nullif(left(btrim(coalesce(p_email,'')),240),''),nullif(left(btrim(coalesce(p_city,'')),120),''),nullif(upper(left(btrim(coalesce(p_state,'')),2)),''),nullif(left(btrim(coalesce(p_postal_code,'')),20),''),nullif(left(btrim(coalesce(p_area_description,'')),600),''),case when coalesce(p_desired_piece_count,0)>0 then p_desired_piece_count else null end,nullif(left(btrim(coalesce(p_package_key,'')),80),''),coalesce(p_smart_coupon,false),nullif(left(btrim(coalesce(p_message,'')),2400),''),true,case when v_mode='coop' then 'waitlist' else 'new' end) returning id into v_interest;
 if v_market is not null and v_required is not null then
   select count(*)::integer into v_count from public.skylight_eddm_interests where market_id=v_market and status not in('lost','cancelled');
   if v_count>=v_required then update public.skylight_eddm_markets set status=case when status='gathering_interest' then 'threshold_met' else status end,updated_at=now() where id=v_market; end if;
 else v_count:=1; end if;
 return jsonb_build_object('interest_id',v_interest,'marketing_lead_id',v_lead,'market_id',v_market,'market_status',(select status from public.skylight_eddm_markets where id=v_market),'interest_count',v_count,'required_businesses',v_required,'mode',v_mode);
end$$;
revoke all on function public.submit_skylight_eddm_interest(uuid,text,text,text,text,text,text,text,text,text,integer,text,boolean,text,boolean) from public;
grant execute on function public.submit_skylight_eddm_interest(uuid,text,text,text,text,text,text,text,text,text,integer,text,boolean,text,boolean) to anon,authenticated;

comment on table public.skylight_eddm_markets is 'Admin-controlled EDDM market/campaign shells. threshold_met only signals sufficient interest; it never schedules, bills, or launches a mailing.';
comment on table public.skylight_eddm_interests is 'Business interest in either co-op or single-business EDDM. Interest and threshold state do not authorize billing.';
