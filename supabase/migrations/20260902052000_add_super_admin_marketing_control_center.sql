create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid default auth.uid(),
  name text not null,
  record_type text not null default 'campaign' check (record_type in ('campaign','template')),
  campaign_type text not null default 'directory_awareness',
  audience text not null default 'consumer' check (audience in ('consumer','business_owner','mixed')),
  status text not null default 'draft' check (status in ('draft','ready','scheduled','published','archived')),
  market_location_id uuid references public.locations(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  market_name text,
  category_name text,
  format text not null default 'portrait' check (format in ('square','portrait','story','flyer','print_letter')),
  eyebrow text,
  headline text not null,
  subheadline text,
  cta_label text,
  destination_url text,
  phone text,
  caption text,
  creative_brief text,
  qr_enabled boolean not null default true,
  design_config jsonb not null default '{}'::jsonb,
  canva_design_id text,
  canva_edit_url text,
  canva_view_url text,
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_campaigns_tenant_status_idx on public.marketing_campaigns(tenant_id,status,updated_at desc);
create index if not exists marketing_campaigns_tenant_record_type_idx on public.marketing_campaigns(tenant_id,record_type,updated_at desc);
create index if not exists marketing_campaigns_market_idx on public.marketing_campaigns(tenant_id,market_location_id,category_id);

create table if not exists public.marketing_publications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram','linkedin','x','canva','print','download')),
  status text not null default 'planned' check (status in ('planned','queued','published','failed','canceled')),
  scheduled_for timestamptz,
  published_at timestamptz,
  external_id text,
  external_url text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_publications_campaign_idx on public.marketing_publications(tenant_id,campaign_id,created_at desc);
create index if not exists marketing_publications_schedule_idx on public.marketing_publications(tenant_id,status,scheduled_for);

create table if not exists public.marketing_integration_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('canva','meta')),
  status text not null default 'disconnected' check (status in ('disconnected','connected','error')),
  external_user_id text,
  external_team_id text,
  account_name text,
  scopes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  connected_by uuid,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(tenant_id,provider)
);

create table if not exists private.marketing_integration_tokens (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  token_payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(tenant_id,provider)
);
revoke all on table private.marketing_integration_tokens from public, anon, authenticated;

create or replace function private.marketing_touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists marketing_campaigns_touch_updated_at on public.marketing_campaigns;
create trigger marketing_campaigns_touch_updated_at before update on public.marketing_campaigns for each row execute function private.marketing_touch_updated_at();
drop trigger if exists marketing_publications_touch_updated_at on public.marketing_publications;
create trigger marketing_publications_touch_updated_at before update on public.marketing_publications for each row execute function private.marketing_touch_updated_at();
drop trigger if exists marketing_integration_accounts_touch_updated_at on public.marketing_integration_accounts;
create trigger marketing_integration_accounts_touch_updated_at before update on public.marketing_integration_accounts for each row execute function private.marketing_touch_updated_at();

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_publications enable row level security;
alter table public.marketing_integration_accounts enable row level security;
create policy marketing_campaigns_super_admin_select on public.marketing_campaigns for select to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_campaigns_super_admin_insert on public.marketing_campaigns for insert to authenticated with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_campaigns_super_admin_update on public.marketing_campaigns for update to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[])) with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_campaigns_super_admin_delete on public.marketing_campaigns for delete to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_publications_super_admin_select on public.marketing_publications for select to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_publications_super_admin_insert on public.marketing_publications for insert to authenticated with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_publications_super_admin_update on public.marketing_publications for update to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[])) with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_publications_super_admin_delete on public.marketing_publications for delete to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_integration_accounts_super_admin_select on public.marketing_integration_accounts for select to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_integration_accounts_super_admin_insert on public.marketing_integration_accounts for insert to authenticated with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_integration_accounts_super_admin_update on public.marketing_integration_accounts for update to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[])) with check (private.has_tenant_role(tenant_id,array['super_admin']::text[]));
create policy marketing_integration_accounts_super_admin_delete on public.marketing_integration_accounts for delete to authenticated using (private.has_tenant_role(tenant_id,array['super_admin']::text[]));

create or replace function public.save_marketing_integration_secret(p_tenant uuid,p_provider text,p_token_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant,array['super_admin']::text[]) then raise exception 'insufficient_privilege'; end if;
  if p_provider not in ('canva','meta') then raise exception 'unsupported_provider'; end if;
  insert into private.marketing_integration_tokens(tenant_id,provider,token_payload,updated_at) values(p_tenant,p_provider,p_token_payload,now())
  on conflict(tenant_id,provider) do update set token_payload=excluded.token_payload,updated_at=now();
end; $$;
revoke all on function public.save_marketing_integration_secret(uuid,text,jsonb) from public;
grant execute on function public.save_marketing_integration_secret(uuid,text,jsonb) to authenticated;
create or replace function public.get_marketing_integration_secret(p_tenant uuid,p_provider text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant,array['super_admin']::text[]) then raise exception 'insufficient_privilege'; end if;
  select token_payload into v from private.marketing_integration_tokens where tenant_id=p_tenant and provider=p_provider;
  return v;
end; $$;
revoke all on function public.get_marketing_integration_secret(uuid,text) from public;
grant execute on function public.get_marketing_integration_secret(uuid,text) to authenticated;
create or replace function public.delete_marketing_integration_secret(p_tenant uuid,p_provider text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant,array['super_admin']::text[]) then raise exception 'insufficient_privilege'; end if;
  delete from private.marketing_integration_tokens where tenant_id=p_tenant and provider=p_provider;
end; $$;
revoke all on function public.delete_marketing_integration_secret(uuid,text) from public;
grant execute on function public.delete_marketing_integration_secret(uuid,text) to authenticated;