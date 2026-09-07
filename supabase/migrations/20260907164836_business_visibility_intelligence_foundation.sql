-- Business Visibility Intelligence: source-backed website audits and Google/local rank history.
-- Private staff intelligence only. This data never changes public Local Pros organic ranking,
-- verification, Sponsored placement, Lead Buyer status, billing, or outreach authorization.

create table if not exists public.business_visibility_audits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  status text not null default 'completed' check (status in ('completed','failed')),
  website_url text not null,
  final_url text,
  provider text not null default 'direct_site_fetch' check (provider in ('direct_site_fetch','google_pagespeed','combined')),
  source_url text,
  checked_at timestamptz not null default now(),
  http_status integer check (http_status is null or (http_status between 100 and 599)),
  response_ms integer check (response_ms is null or response_ms >= 0),
  page_size_bytes integer check (page_size_bytes is null or page_size_bytes >= 0),
  is_https boolean,
  indexable boolean,
  technical_score integer check (technical_score is null or technical_score between 0 and 100),
  on_page_seo_score integer check (on_page_seo_score is null or on_page_seo_score between 0 and 100),
  performance_score integer check (performance_score is null or performance_score between 0 and 100),
  accessibility_score integer check (accessibility_score is null or accessibility_score between 0 and 100),
  best_practices_score integer check (best_practices_score is null or best_practices_score between 0 and 100),
  title text,
  meta_description text,
  h1 text,
  h1_count integer check (h1_count is null or h1_count >= 0),
  canonical_url text,
  robots_meta text,
  robots_txt_status integer check (robots_txt_status is null or (robots_txt_status between 100 and 599)),
  sitemap_status integer check (sitemap_status is null or (sitemap_status between 100 and 599)),
  html_lang text,
  schema_types text[] not null default '{}'::text[],
  word_count integer check (word_count is null or word_count >= 0),
  internal_link_count integer check (internal_link_count is null or internal_link_count >= 0),
  external_link_count integer check (external_link_count is null or external_link_count >= 0),
  image_count integer check (image_count is null or image_count >= 0),
  images_missing_alt integer check (images_missing_alt is null or images_missing_alt >= 0),
  core_web_vitals jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  raw_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_visibility_audits_business_latest
  on public.business_visibility_audits(tenant_id,business_id,checked_at desc);
create index if not exists idx_business_visibility_audits_prospect_latest
  on public.business_visibility_audits(tenant_id,prospect_id,checked_at desc)
  where prospect_id is not null;

create table if not exists public.business_visibility_keyword_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  keyword text not null,
  search_location text not null,
  device text not null default 'desktop' check (device in ('desktop','mobile')),
  active boolean not null default true,
  preferred_provider text not null default 'brightlocal' check (preferred_provider in ('brightlocal','manual','import','other')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,business_id,keyword,search_location,device)
);
create index if not exists idx_business_visibility_targets_business
  on public.business_visibility_keyword_targets(tenant_id,business_id,active,updated_at desc);

create table if not exists public.business_visibility_rankings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  target_id uuid references public.business_visibility_keyword_targets(id) on delete set null,
  keyword text not null,
  search_location text not null,
  engine text not null default 'google' check (engine in ('google','bing')),
  surface text not null check (surface in ('organic','local_pack','maps','local_finder')),
  device text not null default 'desktop' check (device in ('desktop','mobile')),
  position integer check (position is null or position between 1 and 100),
  not_found boolean not null default false,
  result_url text,
  result_title text,
  provider text not null check (provider in ('brightlocal','manual','import','other')),
  provider_reference text,
  source_url text,
  checked_at timestamptz not null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  check ((not_found = true and position is null) or (not_found = false and position is not null))
);
create index if not exists idx_business_visibility_rankings_business_latest
  on public.business_visibility_rankings(tenant_id,business_id,checked_at desc);
create index if not exists idx_business_visibility_rankings_target_latest
  on public.business_visibility_rankings(target_id,checked_at desc)
  where target_id is not null;
create index if not exists idx_business_visibility_rankings_keyword
  on public.business_visibility_rankings(tenant_id,business_id,keyword,search_location,surface,device,checked_at desc);

alter table public.business_visibility_audits enable row level security;
alter table public.business_visibility_keyword_targets enable row level security;
alter table public.business_visibility_rankings enable row level security;

create policy "staff read business visibility audits" on public.business_visibility_audits
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff insert business visibility audits" on public.business_visibility_audits
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff manage business visibility targets" on public.business_visibility_keyword_targets
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff manage business visibility rankings" on public.business_visibility_rankings
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

revoke all on table public.business_visibility_audits from anon;
revoke all on table public.business_visibility_keyword_targets from anon;
revoke all on table public.business_visibility_rankings from anon;

grant select,insert on table public.business_visibility_audits to authenticated;
grant select,insert,update,delete on table public.business_visibility_keyword_targets to authenticated;
grant select,insert,update,delete on table public.business_visibility_rankings to authenticated;

grant all on table public.business_visibility_audits to service_role;
grant all on table public.business_visibility_keyword_targets to service_role;
grant all on table public.business_visibility_rankings to service_role;
