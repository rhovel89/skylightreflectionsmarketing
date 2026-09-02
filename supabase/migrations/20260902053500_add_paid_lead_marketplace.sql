alter table public.leads add column if not exists consent_disclosure_version text;
alter table public.leads add column if not exists consent_recorded_at timestamptz;

create table if not exists public.lead_marketplace_inventory (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vertical text not null default 'other' check (vertical in ('home','legal','restaurant','retail','other')),
  source_scope text not null default 'general' check (source_scope in ('general','business_specific')),
  target_business_id uuid references public.businesses(id) on delete set null,
  monetization_mode text not null default 'disabled' check (monetization_mode in ('lead_sale','flat_advertising_only','disabled')),
  review_status text not null default 'pending' check (review_status in ('pending','qualified','disqualified')),
  marketplace_status text not null default 'review' check (marketplace_status in ('review','available','reserved','sold','fulfilled','withdrawn')),
  sale_mode text not null default 'exclusive' check (sale_mode in ('exclusive','shared')),
  price_cents integer not null default 0 check (price_cents >= 0),
  max_buyers integer not null default 1 check (max_buyers >= 1 and max_buyers <= 10),
  sold_count integer not null default 0 check (sold_count >= 0),
  quality_score integer not null default 0 check (quality_score >= 0 and quality_score <= 100),
  quality_notes text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lead_marketplace_inventory_status_idx on public.lead_marketplace_inventory(tenant_id,marketplace_status,vertical,updated_at desc);
create index if not exists lead_marketplace_inventory_target_idx on public.lead_marketplace_inventory(tenant_id,target_business_id,marketplace_status);

create table if not exists public.lead_marketplace_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  price_cents integer not null check (price_cents > 0),
  status text not null default 'offered' check (status in ('offered','checkout_pending','reserved','purchased','delivered','declined','expired','canceled','refunded')),
  checkout_session_id text,
  checkout_url text,
  payment_intent_id text,
  offered_at timestamptz not null default now(),
  expires_at timestamptz,
  purchased_at timestamptz,
  delivered_at timestamptz,
  route_recipient_id uuid references public.lead_recipients(id) on delete set null,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lead_id,business_id)
);
create index if not exists lead_marketplace_offers_business_idx on public.lead_marketplace_offers(tenant_id,business_id,status,updated_at desc);
create index if not exists lead_marketplace_offers_lead_idx on public.lead_marketplace_offers(tenant_id,lead_id,status);

create table if not exists public.lead_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vertical text not null check (vertical in ('home','legal','restaurant','retail','other')),
  category_id uuid references public.categories(id) on delete cascade,
  name text not null,
  base_price_cents integer not null default 0 check (base_price_cents >= 0),
  sale_mode text not null default 'exclusive' check (sale_mode in ('exclusive','shared')),
  max_buyers integer not null default 1 check (max_buyers >= 1 and max_buyers <= 10),
  monetization_mode text not null default 'disabled' check (monetization_mode in ('lead_sale','flat_advertising_only','disabled')),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(tenant_id,vertical,category_id)
);

create or replace function private.lead_marketplace_touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists lead_marketplace_inventory_touch on public.lead_marketplace_inventory;
create trigger lead_marketplace_inventory_touch before update on public.lead_marketplace_inventory for each row execute function private.lead_marketplace_touch_updated_at();
drop trigger if exists lead_marketplace_offers_touch on public.lead_marketplace_offers;
create trigger lead_marketplace_offers_touch before update on public.lead_marketplace_offers for each row execute function private.lead_marketplace_touch_updated_at();
drop trigger if exists lead_pricing_rules_touch on public.lead_pricing_rules;
create trigger lead_pricing_rules_touch before update on public.lead_pricing_rules for each row execute function private.lead_marketplace_touch_updated_at();

alter table public.lead_marketplace_inventory enable row level security;
alter table public.lead_marketplace_offers enable row level security;
alter table public.lead_pricing_rules enable row level security;
create policy lead_inventory_staff_select on public.lead_marketplace_inventory for select to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']::text[]));
create policy lead_inventory_super_admin_write on public.lead_marketplace_inventory for all to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[])) with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy lead_offers_staff_select on public.lead_marketplace_offers for select to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']::text[]) or exists(select 1 from public.business_owners bo where bo.business_id=lead_marketplace_offers.business_id and bo.user_id=(select auth.uid())));
create policy lead_offers_super_admin_write on public.lead_marketplace_offers for all to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[])) with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy lead_pricing_staff_select on public.lead_pricing_rules for select to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']::text[]));
create policy lead_pricing_super_admin_write on public.lead_pricing_rules for all to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[])) with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));

insert into public.lead_pricing_rules(tenant_id,vertical,category_id,name,base_price_cents,sale_mode,max_buyers,monetization_mode,is_active)
values
('6673621d-b359-4c17-a984-c8f50d914eb3','home',null,'Home Services — manual price before sale',0,'exclusive',1,'lead_sale',true),
('6673621d-b359-4c17-a984-c8f50d914eb3','legal',null,'Legal — advertising model only / compliance review',0,'exclusive',1,'flat_advertising_only',true),
('6673621d-b359-4c17-a984-c8f50d914eb3','restaurant',null,'Restaurants — lead sales disabled by default',0,'exclusive',1,'disabled',true),
('6673621d-b359-4c17-a984-c8f50d914eb3','retail',null,'Local Stores — lead sales disabled by default',0,'exclusive',1,'disabled',true),
('6673621d-b359-4c17-a984-c8f50d914eb3','other',null,'Other — lead sales disabled by default',0,'exclusive',1,'disabled',true)
on conflict(tenant_id,vertical,category_id) do nothing;

create or replace function private.detect_lead_vertical(p_tenant uuid,p_business uuid,p_service text) returns text language plpgsql stable set search_path='' as $$
declare v text;
begin
  if p_business is not null then select c.vertical into v from public.business_categories bc join public.categories c on c.id=bc.category_id where bc.business_id=p_business and c.tenant_id=p_tenant order by bc.is_primary desc,c.name limit 1; end if;
  if v is null then select c.vertical into v from public.categories c where c.tenant_id=p_tenant and c.is_active=true and (lower(c.name)=lower(trim(coalesce(p_service,''))) or lower(c.slug)=lower(regexp_replace(trim(coalesce(p_service,'')),'[^a-zA-Z0-9]+','-','g'))) order by case when c.vertical='home' then 0 else 1 end,c.name limit 1; end if;
  return coalesce(v,'other');
end; $$;
create or replace function private.prepare_lead_marketplace_inventory() returns trigger language plpgsql set search_path='' as $$
declare v_vertical text;v_mode text;
begin
  v_vertical:=private.detect_lead_vertical(new.tenant_id,new.business_id,new.service);v_mode:=case when v_vertical='home' then 'lead_sale' when v_vertical='legal' then 'flat_advertising_only' else 'disabled' end;
  insert into public.lead_marketplace_inventory(lead_id,tenant_id,vertical,source_scope,target_business_id,monetization_mode,review_status,marketplace_status,sale_mode,price_cents,max_buyers)
  values(new.id,new.tenant_id,v_vertical,case when new.business_id is null then 'general' else 'business_specific' end,new.business_id,v_mode,'pending','review','exclusive',0,1) on conflict(lead_id) do nothing;return new;
end; $$;
drop trigger if exists prepare_lead_marketplace_inventory on public.leads;
create trigger prepare_lead_marketplace_inventory after insert on public.leads for each row execute function private.prepare_lead_marketplace_inventory();
insert into public.lead_marketplace_inventory(lead_id,tenant_id,vertical,source_scope,target_business_id,monetization_mode,review_status,marketplace_status,sale_mode,price_cents,max_buyers)
select l.id,l.tenant_id,private.detect_lead_vertical(l.tenant_id,l.business_id,l.service),case when l.business_id is null then 'general' else 'business_specific' end,l.business_id,case private.detect_lead_vertical(l.tenant_id,l.business_id,l.service) when 'home' then 'lead_sale' when 'legal' then 'flat_advertising_only' else 'disabled' end,'pending','review','exclusive',0,1 from public.leads l where l.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3' on conflict(lead_id) do nothing;

create or replace function public.configure_marketplace_lead(p_lead_id uuid,p_price_cents integer,p_sale_mode text default 'exclusive',p_max_buyers integer default 1,p_quality_score integer default 50,p_notes text default null) returns void language plpgsql security definer set search_path='' as $$
declare v public.lead_marketplace_inventory%rowtype;
begin select * into v from public.lead_marketplace_inventory where lead_id=p_lead_id for update;if not found then raise exception 'lead_inventory_not_found';end if;if auth.uid() is null or not private.has_tenant_role(v.tenant_id,array['super_admin']::text[]) then raise exception 'insufficient_privilege';end if;if v.monetization_mode<>'lead_sale' then raise exception 'lead_sale_not_enabled_for_vertical';end if;if coalesce(p_price_cents,0)<=0 then raise exception 'positive_price_required';end if;if p_sale_mode not in ('exclusive','shared') then raise exception 'invalid_sale_mode';end if;if p_sale_mode='exclusive' then p_max_buyers:=1;end if;if p_max_buyers<1 or p_max_buyers>10 then raise exception 'invalid_max_buyers';end if;update public.lead_marketplace_inventory set review_status='qualified',marketplace_status='available',price_cents=p_price_cents,sale_mode=p_sale_mode,max_buyers=p_max_buyers,quality_score=greatest(0,least(coalesce(p_quality_score,50),100)),quality_notes=nullif(trim(coalesce(p_notes,'')),'') where lead_id=p_lead_id;insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v.tenant_id,auth.uid(),'lead_marketplace_qualified','Qualified lead '||p_lead_id||' for paid marketplace at $'||round(p_price_cents::numeric/100,2)||' ('||p_sale_mode||').');end; $$;
revoke all on function public.configure_marketplace_lead(uuid,integer,text,integer,integer,text) from public;grant execute on function public.configure_marketplace_lead(uuid,integer,text,integer,integer,text) to authenticated;
create or replace function public.create_marketplace_lead_offer(p_lead_id uuid,p_business_id uuid,p_price_cents integer default null,p_expires_at timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.lead_marketplace_inventory%rowtype;v_id uuid;v_price integer;
begin select * into v from public.lead_marketplace_inventory where lead_id=p_lead_id for update;if not found then raise exception 'lead_inventory_not_found';end if;if auth.uid() is null or not private.has_tenant_role(v.tenant_id,array['super_admin']::text[]) then raise exception 'insufficient_privilege';end if;if v.review_status<>'qualified' or v.marketplace_status not in ('available','reserved') or v.monetization_mode<>'lead_sale' then raise exception 'lead_not_available_for_sale';end if;if v.source_scope='business_specific' and v.target_business_id is distinct from p_business_id then raise exception 'business_specific_lead_can_only_be_offered_to_target_business';end if;if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=v.tenant_id and b.status='published') then raise exception 'published_business_required';end if;if v.sale_mode='exclusive' and exists(select 1 from public.lead_marketplace_offers o where o.lead_id=p_lead_id and o.status in ('purchased','delivered')) then raise exception 'exclusive_lead_already_sold';end if;if v.sale_mode='shared' and v.sold_count>=v.max_buyers then raise exception 'shared_lead_buyer_limit_reached';end if;v_price:=coalesce(p_price_cents,v.price_cents);if v_price<=0 then raise exception 'positive_price_required';end if;insert into public.lead_marketplace_offers(tenant_id,lead_id,business_id,price_cents,status,expires_at,created_by) values(v.tenant_id,p_lead_id,p_business_id,v_price,'offered',p_expires_at,auth.uid()) on conflict(lead_id,business_id) do update set price_cents=excluded.price_cents,status='offered',expires_at=excluded.expires_at,checkout_session_id=null,checkout_url=null,payment_intent_id=null,purchased_at=null,delivered_at=null,updated_at=now() returning id into v_id;update public.lead_marketplace_inventory set marketplace_status=case when sale_mode='exclusive' then 'reserved' else marketplace_status end where lead_id=p_lead_id;insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v.tenant_id,auth.uid(),'lead_marketplace_offer_created','Created paid lead offer '||v_id||' for business '||p_business_id||' at $'||round(v_price::numeric/100,2)||'.');return v_id;end; $$;
revoke all on function public.create_marketplace_lead_offer(uuid,uuid,integer,timestamptz) from public;grant execute on function public.create_marketplace_lead_offer(uuid,uuid,integer,timestamptz) to authenticated;
create or replace function public.get_business_marketplace_offers(p_business_id uuid) returns table(offer_id uuid,lead_id uuid,status text,price_cents integer,service text,city text,timeline text,created_at timestamptz,expires_at timestamptz,sale_mode text,source_scope text) language sql security definer set search_path='' as $$ select o.id,o.lead_id,o.status,o.price_cents,l.service,l.city,l.timeline,o.created_at,o.expires_at,i.sale_mode,i.source_scope from public.lead_marketplace_offers o join public.leads l on l.id=o.lead_id join public.lead_marketplace_inventory i on i.lead_id=o.lead_id where o.business_id=p_business_id and exists(select 1 from public.business_owners bo where bo.business_id=p_business_id and bo.user_id=(select auth.uid())) and o.status in ('offered','checkout_pending','reserved','purchased','delivered') order by o.created_at desc; $$;
revoke all on function public.get_business_marketplace_offers(uuid) from public;grant execute on function public.get_business_marketplace_offers(uuid) to authenticated;

create or replace function public.submit_directory_lead(p_tenant_id uuid,p_business_id uuid,p_service text,p_city text,p_consumer_name text,p_phone text,p_email text,p_message text default null,p_timeline text default null,p_consent_to_contact boolean default false) returns uuid language plpgsql set search_path='' as $$
declare v_id uuid;
begin if not p_consent_to_contact then raise exception 'contact consent is required';end if;if char_length(trim(coalesce(p_service,'')))<2 or char_length(trim(coalesce(p_city,'')))<2 then raise exception 'service and city are required';end if;if char_length(trim(coalesce(p_consumer_name,'')))<2 then raise exception 'name is required';end if;if position('@' in coalesce(p_email,''))<2 then raise exception 'valid email required';end if;insert into public.leads(tenant_id,business_id,assigned_business_id,service,city,consumer_name,phone,email,message,timeline,status,notes,consumer_user_id,consent_to_contact,source,consent_disclosure_version,consent_recorded_at) values(p_tenant_id,p_business_id,null,trim(p_service),trim(p_city),trim(p_consumer_name),trim(p_phone),trim(p_email),nullif(trim(p_message),''),nullif(trim(p_timeline),''),'new',null,(select auth.uid()),true,'directory_quote_form','lead-sharing-v1-2026-09',now()) returning id into v_id;return v_id;end; $$;