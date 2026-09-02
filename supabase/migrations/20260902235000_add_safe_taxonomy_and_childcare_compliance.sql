-- Production safety guardrails for the Central Illinois Local Pros expansion.
-- Operational business inventory, guide content and campaign templates are managed in the canonical database; this migration records the durable schema and monetization controls.

do $cat$
declare
  t uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
  r record;
begin
  insert into public.categories (tenant_id,vertical,slug,name,is_active) values
    (t,'legal','probate','Probate',true),(t,'legal','wills-trusts','Wills & Trusts',true),(t,'legal','civil-litigation','Civil Litigation',true),(t,'legal','elder-law','Elder Law',true),(t,'legal','social-security-disability','Social Security Disability',true),
    (t,'other','dog-grooming','Dog Grooming',true),(t,'other','cat-grooming','Cat Grooming',true),(t,'other','pet-sitting','Pet Sitting',true),(t,'other','dog-walking','Dog Walking',true),(t,'other','pet-boarding','Pet Boarding',true),(t,'other','dog-daycare','Dog Daycare',true),(t,'other','pet-training','Pet Training',true),(t,'other','mobile-nail-trimming','Mobile Nail Trimming',true),(t,'other','pet-waste-removal','Pet Waste Removal',true),(t,'other','independent-pet-services','Independent Pet Services',true)
  on conflict (tenant_id,slug) do update set name=excluded.name,vertical=excluded.vertical,is_active=true;
  update public.categories set is_active=true where tenant_id=t and slug in ('business-law','divorce','dui','traffic-law');
  for r in select id,name from public.categories where tenant_id=t and slug in ('dog-grooming','cat-grooming','pet-sitting','dog-walking','pet-boarding','dog-daycare','pet-training','mobile-nail-trimming','pet-waste-removal','independent-pet-services') loop
    insert into public.lead_pricing_rules (tenant_id,vertical,category_id,name,base_price_cents,sale_mode,max_buyers,monetization_mode,is_active)
    values (t,'other',r.id,r.name||' — directory matching; paid lead sales disabled',0,'exclusive',1,'disabled',true)
    on conflict (tenant_id,vertical,category_id) do update set name=excluded.name,base_price_cents=0,sale_mode='exclusive',max_buyers=1,monetization_mode='disabled',is_active=true,updated_at=now();
  end loop;
  update public.lead_pricing_rules set monetization_mode='flat_advertising_only',updated_at=now() where tenant_id=t and vertical='legal';
end $cat$;

create table if not exists public.childcare_provider_compliance (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_type text not null default 'unknown' check (provider_type in ('licensed_daycare_center','licensed_daycare_home','licensed_group_daycare_home','license_exempt_provider','babysitter_in_family_home','other','unknown')),
  license_status text not null default 'unverified' check (license_status in ('unverified','reported','confirmed','expired','not_applicable')),
  license_number text, license_authority text, license_source_url text, license_checked_at timestamptz,
  background_check_status text not null default 'not_claimed' check (background_check_status in ('not_claimed','reported','confirmed','unknown')),
  background_check_source_url text, background_check_checked_at timestamptz,
  capacity_status text not null default 'unreviewed' check (capacity_status in ('unreviewed','reported','confirmed','not_applicable')),
  directory_review_status text not null default 'pending' check (directory_review_status in ('pending','eligible','ineligible','needs_more_information')),
  public_disclosure text, staff_notes text, reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists childcare_provider_compliance_tenant_status_idx on public.childcare_provider_compliance(tenant_id,directory_review_status,updated_at desc);
alter table public.childcare_provider_compliance enable row level security;
drop policy if exists childcare_compliance_super_admin_select on public.childcare_provider_compliance;
create policy childcare_compliance_super_admin_select on public.childcare_provider_compliance for select to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
drop policy if exists childcare_compliance_super_admin_insert on public.childcare_provider_compliance;
create policy childcare_compliance_super_admin_insert on public.childcare_provider_compliance for insert to authenticated with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
drop policy if exists childcare_compliance_super_admin_update on public.childcare_provider_compliance;
create policy childcare_compliance_super_admin_update on public.childcare_provider_compliance for update to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[])) with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
drop policy if exists childcare_compliance_super_admin_delete on public.childcare_provider_compliance;
create policy childcare_compliance_super_admin_delete on public.childcare_provider_compliance for delete to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
revoke all on table public.childcare_provider_compliance from anon;

create or replace function private.enforce_sensitive_lead_monetization()
returns trigger language plpgsql set search_path='' as $fn$
declare cslug text;
begin
  if new.vertical='legal' and new.monetization_mode not in ('flat_advertising_only','disabled') then raise exception 'Legal monetization is restricted to flat advertising or disabled until a compliant model is intentionally approved.'; end if;
  if new.category_id is not null then
    select slug into cslug from public.categories where id=new.category_id and tenant_id=new.tenant_id;
    if cslug='childcare-providers' and new.monetization_mode <> 'disabled' then raise exception 'Childcare paid-lead monetization is disabled pending explicit compliance approval.'; end if;
  end if;
  return new;
end $fn$;
drop trigger if exists lead_pricing_rules_sensitive_monetization_guard on public.lead_pricing_rules;
create trigger lead_pricing_rules_sensitive_monetization_guard before insert or update on public.lead_pricing_rules for each row execute function private.enforce_sensitive_lead_monetization();
