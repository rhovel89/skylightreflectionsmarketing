create table if not exists public.network_launches(
  id uuid primary key default gen_random_uuid(),
  parent_tenant_id uuid not null references public.tenants(id) on delete cascade,
  provisioned_tenant_id uuid references public.tenants(id) on delete set null,
  directory_name text not null,
  tenant_slug text not null,
  region_label text,
  target_domain text,
  status text not null default 'planned' check(status in('planned','tenant_ready','configuring','launch_ready','launched','paused')),
  deployment_strategy text not null default 'shared_code_separate_tenant',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_tenant_id,tenant_slug)
);

alter table public.network_launches enable row level security;
drop policy if exists "staff manage network launches" on public.network_launches;
create policy "staff manage network launches" on public.network_launches
for all to authenticated
using(private.has_tenant_role(parent_tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(parent_tenant_id,array['staff','admin','super_admin']));

create index if not exists network_launches_parent_status_idx on public.network_launches(parent_tenant_id,status,updated_at desc);
create index if not exists network_launches_provisioned_tenant_idx on public.network_launches(provisioned_tenant_id);

create or replace function public.provision_local_pros_tenant(
  p_parent_tenant_id uuid,
  p_directory_name text,
  p_tenant_slug text,
  p_region_label text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_new_tenant uuid;
  v_parent_settings public.site_settings%rowtype;
  v_cat record;
  v_parent_new uuid;
  v_new_category uuid;
begin
  if auth.uid() is null or not private.has_tenant_role(p_parent_tenant_id,array['super_admin']) then raise exception 'insufficient_privilege'; end if;
  if nullif(trim(p_directory_name),'') is null then raise exception 'directory_name_required'; end if;
  if p_tenant_slug is null or p_tenant_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid_tenant_slug'; end if;
  if exists(select 1 from public.tenants where slug=p_tenant_slug) then raise exception 'tenant_slug_exists'; end if;

  select * into v_parent_settings from public.site_settings where tenant_id=p_parent_tenant_id;
  if v_parent_settings.tenant_id is null then raise exception 'parent_site_settings_missing'; end if;

  insert into public.tenants(name,slug,region)
  values(trim(p_directory_name),p_tenant_slug,nullif(trim(coalesce(p_region_label,'')),''))
  returning id into v_new_tenant;

  insert into public.site_settings(
    tenant_id,support_email,support_phone,default_seo_title,default_meta_description,founding_offer,feature_flags,
    directory_name,parent_brand_name,brand_logo_url,brand_primary_color,brand_secondary_color,brand_accent_color,
    brand_dark_color,brand_charcoal_color,brand_light_color,brand_silver_color,consumer_tagline,business_tagline,
    hero_eyebrow,hero_title,hero_subtitle,footer_text,social_links,branding_options,updated_at
  ) values(
    v_new_tenant,v_parent_settings.support_email,v_parent_settings.support_phone,trim(p_directory_name),
    'Find local professionals, businesses, restaurants and stores across '||coalesce(nullif(trim(coalesce(p_region_label,'')),''),trim(p_directory_name))||'.',
    v_parent_settings.founding_offer,v_parent_settings.feature_flags,
    trim(p_directory_name),v_parent_settings.parent_brand_name,v_parent_settings.brand_logo_url,v_parent_settings.brand_primary_color,
    v_parent_settings.brand_secondary_color,v_parent_settings.brand_accent_color,v_parent_settings.brand_dark_color,
    v_parent_settings.brand_charcoal_color,v_parent_settings.brand_light_color,v_parent_settings.brand_silver_color,
    v_parent_settings.consumer_tagline,v_parent_settings.business_tagline,
    coalesce(nullif(trim(coalesce(p_region_label,'')),''),trim(p_directory_name))||' Business Directory',
    v_parent_settings.hero_title,
    'Find home-service professionals, attorneys, restaurants, local stores and independent local service providers across '||coalesce(nullif(trim(coalesce(p_region_label,'')),''),trim(p_directory_name))||'. Compare local profiles and connect directly.',
    v_parent_settings.footer_text,v_parent_settings.social_links,v_parent_settings.branding_options,now()
  );

  create temporary table if not exists network_category_map(old_id uuid primary key,new_id uuid not null) on commit drop;
  truncate network_category_map;
  for v_cat in
    select id,parent_id,vertical,slug,name,is_active
    from public.categories where tenant_id=p_parent_tenant_id
    order by case when parent_id is null then 0 else 1 end,name
  loop
    v_parent_new:=null;
    if v_cat.parent_id is not null then select new_id into v_parent_new from network_category_map where old_id=v_cat.parent_id; end if;
    insert into public.categories(tenant_id,parent_id,vertical,slug,name,is_active)
    values(v_new_tenant,v_parent_new,v_cat.vertical,v_cat.slug,v_cat.name,v_cat.is_active)
    returning id into v_new_category;
    insert into network_category_map(old_id,new_id) values(v_cat.id,v_new_category);
  end loop;

  insert into public.plans(
    tenant_id,slug,name,monthly_price_cents,annual_price_cents,is_active,features,description,badge,entitlements,sort_order,updated_at,
    stripe_product_id,stripe_monthly_price_id,stripe_annual_price_id,stripe_monthly_payment_link_id,stripe_annual_payment_link_id,stripe_monthly_payment_url,stripe_annual_payment_url
  )
  select v_new_tenant,slug,name,monthly_price_cents,annual_price_cents,is_active,features,description,badge,entitlements,sort_order,now(),
    null,null,null,null,null,null,null
  from public.plans where tenant_id=p_parent_tenant_id;

  insert into public.network_launches(parent_tenant_id,provisioned_tenant_id,directory_name,tenant_slug,region_label,status,created_by,updated_at)
  values(p_parent_tenant_id,v_new_tenant,trim(p_directory_name),p_tenant_slug,nullif(trim(coalesce(p_region_label,'')),''),'tenant_ready',auth.uid(),now())
  on conflict(parent_tenant_id,tenant_slug) do update set provisioned_tenant_id=excluded.provisioned_tenant_id,directory_name=excluded.directory_name,region_label=excluded.region_label,status='tenant_ready',updated_at=now();

  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
  values(p_parent_tenant_id,auth.uid(),'network_tenant_provisioned','Provisioned Local Pros tenant skeleton '||p_tenant_slug||' ('||trim(p_directory_name)||'). Stripe identifiers, domain, locations, businesses, SEO pages and content require intentional market-specific configuration.');

  return v_new_tenant;
end$$;

revoke all on function public.provision_local_pros_tenant(uuid,text,text,text) from public,anon;
grant execute on function public.provision_local_pros_tenant(uuid,text,text,text) to authenticated,service_role;
