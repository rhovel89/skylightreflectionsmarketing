-- Business Visibility Intelligence 4.0
-- Automated-monitoring foundation, source-backed competitor intelligence, factual alerts,
-- and human-approved Sales evidence. All data remains private and has zero public ranking effect.

create table if not exists public.business_visibility_monitoring_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  active boolean not null default true,
  website_monitoring_enabled boolean not null default true,
  website_interval_hours integer not null default 168 check (website_interval_hours between 24 and 2160),
  rank_monitoring_enabled boolean not null default false,
  rank_interval_hours integer not null default 168 check (rank_interval_hours between 24 and 2160),
  competitor_monitoring_enabled boolean not null default false,
  next_website_audit_at timestamptz,
  next_rank_check_at timestamptz,
  last_website_audit_at timestamptz,
  last_rank_check_at timestamptz,
  last_run_status text check (last_run_status is null or last_run_status in ('ok','partial','failed','not_configured')),
  last_run_message text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,business_id)
);

create table if not exists public.business_visibility_competitors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  competitor_name text not null,
  website_url text,
  google_business_url text,
  source_url text not null,
  source_checked_at timestamptz not null,
  notes text,
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(competitor_name)) > 1),
  check (source_url ~* '^https?://'),
  check (website_url is null or website_url ~* '^https?://'),
  check (google_business_url is null or google_business_url ~* '^https?://')
);

create unique index if not exists uq_business_visibility_competitor_name
  on public.business_visibility_competitors(tenant_id,business_id,lower(competitor_name))
  where active=true;

create table if not exists public.business_visibility_competitor_audits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  competitor_id uuid not null references public.business_visibility_competitors(id) on delete cascade,
  website_url text not null,
  final_url text,
  provider text not null default 'direct_site_fetch' check (provider in ('direct_site_fetch','google_pagespeed','combined')),
  checked_at timestamptz not null default now(),
  status text not null default 'completed' check (status in ('completed','failed')),
  http_status integer check (http_status is null or http_status between 100 and 599),
  response_ms integer check (response_ms is null or response_ms >= 0),
  is_https boolean,
  indexable boolean,
  technical_score integer check (technical_score is null or technical_score between 0 and 100),
  on_page_seo_score integer check (on_page_seo_score is null or on_page_seo_score between 0 and 100),
  performance_score integer check (performance_score is null or performance_score between 0 and 100),
  title text,
  meta_description text,
  h1 text,
  word_count integer check (word_count is null or word_count >= 0),
  schema_types text[] not null default '{}'::text[],
  issues jsonb not null default '[]'::jsonb,
  raw_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.business_visibility_competitor_rankings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  competitor_id uuid not null references public.business_visibility_competitors(id) on delete cascade,
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
  check ((not_found=true and position is null) or (not_found=false and position is not null)),
  check (provider='brightlocal' or source_url ~* '^https?://')
);

create table if not exists public.business_visibility_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid references public.business_prospects(id) on delete set null,
  competitor_id uuid references public.business_visibility_competitors(id) on delete set null,
  alert_key text not null,
  alert_type text not null check (alert_type in (
    'website_outage','noindex_detected','technical_regression','on_page_regression','performance_regression',
    'title_changed','meta_changed','canonical_changed','robots_regression','sitemap_regression',
    'rank_drop','rank_gain','top3_lost','top3_gained','top10_lost','top10_gained','competitor_outperforming'
  )),
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  title text not null,
  detail text not null,
  source_table text not null,
  source_record_id uuid not null,
  source_url text,
  previous_value jsonb not null default '{}'::jsonb,
  current_value jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,business_id,alert_key)
);

create table if not exists public.business_visibility_sales_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid not null references public.business_prospects(id) on delete cascade,
  opportunity_id uuid references public.skylight_sales_opportunities(id) on delete set null,
  evidence_type text not null check (evidence_type in ('website_audit','ranking','competitor_audit','competitor_ranking','visibility_alert')),
  evidence_summary text not null,
  source_table text not null,
  source_record_id uuid not null,
  source_url text,
  source_checked_at timestamptz not null,
  status text not null default 'approved' check (status in ('approved','revoked')),
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tenant_id,prospect_id,source_table,source_record_id)
);

create index if not exists idx_visibility_monitoring_due_website
  on public.business_visibility_monitoring_policies(tenant_id,next_website_audit_at)
  where active=true and website_monitoring_enabled=true;
create index if not exists idx_visibility_monitoring_due_rank
  on public.business_visibility_monitoring_policies(tenant_id,next_rank_check_at)
  where active=true and rank_monitoring_enabled=true;
create index if not exists idx_visibility_competitors_business
  on public.business_visibility_competitors(tenant_id,business_id,active,updated_at desc);
create index if not exists idx_visibility_competitor_audits_latest
  on public.business_visibility_competitor_audits(tenant_id,competitor_id,checked_at desc);
create index if not exists idx_visibility_competitor_rankings_latest
  on public.business_visibility_competitor_rankings(tenant_id,competitor_id,target_id,checked_at desc);
create index if not exists idx_visibility_alerts_business_status
  on public.business_visibility_alerts(tenant_id,business_id,status,severity,last_seen_at desc);
create index if not exists idx_visibility_sales_evidence_prospect
  on public.business_visibility_sales_evidence(tenant_id,prospect_id,status,approved_at desc);

alter table public.business_visibility_monitoring_policies enable row level security;
alter table public.business_visibility_competitors enable row level security;
alter table public.business_visibility_competitor_audits enable row level security;
alter table public.business_visibility_competitor_rankings enable row level security;
alter table public.business_visibility_alerts enable row level security;
alter table public.business_visibility_sales_evidence enable row level security;

create policy "staff manage visibility monitoring policies" on public.business_visibility_monitoring_policies
for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff manage visibility competitors" on public.business_visibility_competitors
for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff manage visibility competitor audits" on public.business_visibility_competitor_audits
for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff manage visibility competitor rankings" on public.business_visibility_competitor_rankings
for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff manage visibility alerts" on public.business_visibility_alerts
for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff manage visibility sales evidence" on public.business_visibility_sales_evidence
for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

revoke all on table public.business_visibility_monitoring_policies from anon;
revoke all on table public.business_visibility_competitors from anon;
revoke all on table public.business_visibility_competitor_audits from anon;
revoke all on table public.business_visibility_competitor_rankings from anon;
revoke all on table public.business_visibility_alerts from anon;
revoke all on table public.business_visibility_sales_evidence from anon;

grant select,insert,update,delete on table public.business_visibility_monitoring_policies to authenticated;
grant select,insert,update,delete on table public.business_visibility_competitors to authenticated;
grant select,insert,update,delete on table public.business_visibility_competitor_audits to authenticated;
grant select,insert,update,delete on table public.business_visibility_competitor_rankings to authenticated;
grant select,insert,update,delete on table public.business_visibility_alerts to authenticated;
grant select,insert,update,delete on table public.business_visibility_sales_evidence to authenticated;

grant all on table public.business_visibility_monitoring_policies to service_role;
grant all on table public.business_visibility_competitors to service_role;
grant all on table public.business_visibility_competitor_audits to service_role;
grant all on table public.business_visibility_competitor_rankings to service_role;
grant all on table public.business_visibility_alerts to service_role;
grant all on table public.business_visibility_sales_evidence to service_role;

-- Alert helper. Private trigger-only function; no direct external execution grant.
create or replace function private.upsert_business_visibility_alert(
  p_tenant_id uuid,p_business_id uuid,p_prospect_id uuid,p_competitor_id uuid,
  p_alert_key text,p_alert_type text,p_severity text,p_title text,p_detail text,
  p_source_table text,p_source_record_id uuid,p_source_url text,p_previous jsonb,p_current jsonb
) returns void language plpgsql security definer set search_path=public,private as $$
begin
  insert into public.business_visibility_alerts(
    tenant_id,business_id,prospect_id,competitor_id,alert_key,alert_type,severity,status,title,detail,
    source_table,source_record_id,source_url,previous_value,current_value,first_seen_at,last_seen_at,updated_at
  ) values(
    p_tenant_id,p_business_id,p_prospect_id,p_competitor_id,p_alert_key,p_alert_type,p_severity,'open',p_title,p_detail,
    p_source_table,p_source_record_id,p_source_url,coalesce(p_previous,'{}'::jsonb),coalesce(p_current,'{}'::jsonb),now(),now(),now()
  ) on conflict(tenant_id,business_id,alert_key) do update set
    prospect_id=excluded.prospect_id,competitor_id=excluded.competitor_id,alert_type=excluded.alert_type,severity=excluded.severity,
    status='open',title=excluded.title,detail=excluded.detail,source_table=excluded.source_table,source_record_id=excluded.source_record_id,
    source_url=excluded.source_url,previous_value=excluded.previous_value,current_value=excluded.current_value,last_seen_at=now(),
    acknowledged_by=null,acknowledged_at=null,resolved_by=null,resolved_at=null,updated_at=now();
end $$;
revoke all on function private.upsert_business_visibility_alert(uuid,uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,jsonb,jsonb) from public,anon,authenticated;

create or replace function private.evaluate_business_visibility_audit_alerts() returns trigger
language plpgsql security definer set search_path=public,private as $$
declare p public.business_visibility_audits%rowtype;
begin
  select * into p from public.business_visibility_audits
  where tenant_id=new.tenant_id and business_id=new.business_id and id<>new.id and checked_at<=new.checked_at
  order by checked_at desc limit 1;

  if new.status='failed' or (new.http_status is not null and new.http_status>=500) then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'website_outage','website_outage','critical','Website availability problem detected','The latest source-backed website audit failed or returned a server error.','business_visibility_audits',new.id,new.source_url,to_jsonb(p.http_status),to_jsonb(new.http_status));
  end if;
  if new.indexable=false and (p.id is null or p.indexable is distinct from false) then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'noindex_detected','noindex_detected','critical','Website became non-indexable','The latest website audit detected a noindex condition.','business_visibility_audits',new.id,new.source_url,jsonb_build_object('indexable',p.indexable),jsonb_build_object('indexable',new.indexable));
  end if;
  if p.id is not null and new.technical_score is not null and p.technical_score is not null and new.technical_score <= p.technical_score-10 then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'technical_regression','technical_regression','warning','Technical SEO score dropped',format('Skylight technical score moved from %s to %s.',p.technical_score,new.technical_score),'business_visibility_audits',new.id,new.source_url,jsonb_build_object('score',p.technical_score),jsonb_build_object('score',new.technical_score));
  end if;
  if p.id is not null and new.on_page_seo_score is not null and p.on_page_seo_score is not null and new.on_page_seo_score <= p.on_page_seo_score-10 then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'on_page_regression','on_page_regression','warning','On-page SEO score dropped',format('Skylight on-page score moved from %s to %s.',p.on_page_seo_score,new.on_page_seo_score),'business_visibility_audits',new.id,new.source_url,jsonb_build_object('score',p.on_page_seo_score),jsonb_build_object('score',new.on_page_seo_score));
  end if;
  if p.id is not null and new.performance_score is not null and p.performance_score is not null and new.performance_score <= p.performance_score-15 then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'performance_regression','performance_regression','warning','Website performance score dropped',format('PageSpeed performance moved from %s to %s.',p.performance_score,new.performance_score),'business_visibility_audits',new.id,new.source_url,jsonb_build_object('score',p.performance_score),jsonb_build_object('score',new.performance_score));
  end if;
  if p.id is not null and coalesce(new.title,'')<>coalesce(p.title,'') then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'title_changed','title_changed','info','Homepage title changed','The audited homepage title changed between snapshots.','business_visibility_audits',new.id,new.source_url,jsonb_build_object('title',p.title),jsonb_build_object('title',new.title));
  end if;
  if p.id is not null and coalesce(new.meta_description,'')<>coalesce(p.meta_description,'') then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'meta_changed','meta_changed','info','Meta description changed','The audited homepage meta description changed between snapshots.','business_visibility_audits',new.id,new.source_url,jsonb_build_object('meta_description',p.meta_description),jsonb_build_object('meta_description',new.meta_description));
  end if;
  if p.id is not null and coalesce(new.canonical_url,'')<>coalesce(p.canonical_url,'') then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'canonical_changed','canonical_changed','warning','Canonical URL changed','The audited canonical URL changed between snapshots.','business_visibility_audits',new.id,new.source_url,jsonb_build_object('canonical',p.canonical_url),jsonb_build_object('canonical',new.canonical_url));
  end if;
  if p.id is not null and coalesce(p.robots_txt_status,0) between 200 and 399 and (new.robots_txt_status is null or new.robots_txt_status not between 200 and 399) then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'robots_regression','robots_regression','warning','robots.txt availability changed','robots.txt was previously reachable and is no longer returning a successful status.','business_visibility_audits',new.id,new.source_url,jsonb_build_object('status',p.robots_txt_status),jsonb_build_object('status',new.robots_txt_status));
  end if;
  if p.id is not null and coalesce(p.sitemap_status,0) between 200 and 399 and (new.sitemap_status is null or new.sitemap_status not between 200 and 399) then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'sitemap_regression','sitemap_regression','warning','Sitemap availability changed','The sitemap was previously reachable and is no longer returning a successful status.','business_visibility_audits',new.id,new.source_url,jsonb_build_object('status',p.sitemap_status),jsonb_build_object('status',new.sitemap_status));
  end if;
  return new;
end $$;
revoke all on function private.evaluate_business_visibility_audit_alerts() from public,anon,authenticated;
drop trigger if exists trg_business_visibility_audit_alerts on public.business_visibility_audits;
create trigger trg_business_visibility_audit_alerts after insert on public.business_visibility_audits
for each row execute function private.evaluate_business_visibility_audit_alerts();

create or replace function private.evaluate_business_visibility_ranking_alerts() returns trigger
language plpgsql security definer set search_path=public,private as $$
declare p public.business_visibility_rankings%rowtype; oldpos integer; newpos integer;
begin
  select * into p from public.business_visibility_rankings
  where tenant_id=new.tenant_id and business_id=new.business_id and id<>new.id
    and keyword=new.keyword and search_location=new.search_location and surface=new.surface and device=new.device and engine=new.engine
    and checked_at<=new.checked_at order by checked_at desc limit 1;
  if p.id is null then return new; end if;
  oldpos=case when p.not_found then 101 else p.position end;
  newpos=case when new.not_found then 101 else new.position end;
  if newpos>=oldpos+5 then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'rank_drop:'||coalesce(new.target_id::text,md5(new.keyword||new.search_location||new.surface||new.device)),'rank_drop','warning','Google ranking dropped',format('%s in %s moved from %s to %s on %s.',new.keyword,new.search_location,case when oldpos=101 then 'not found' else '#'||oldpos end,case when newpos=101 then 'not found' else '#'||newpos end,new.surface),'business_visibility_rankings',new.id,new.source_url,jsonb_build_object('position',nullif(oldpos,101)),jsonb_build_object('position',nullif(newpos,101)));
  elsif oldpos>=newpos+5 then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'rank_gain:'||coalesce(new.target_id::text,md5(new.keyword||new.search_location||new.surface||new.device)),'rank_gain','info','Google ranking improved',format('%s in %s moved from %s to %s on %s.',new.keyword,new.search_location,case when oldpos=101 then 'not found' else '#'||oldpos end,case when newpos=101 then 'not found' else '#'||newpos end,new.surface),'business_visibility_rankings',new.id,new.source_url,jsonb_build_object('position',nullif(oldpos,101)),jsonb_build_object('position',nullif(newpos,101)));
  end if;
  if oldpos<=3 and newpos>3 then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'top3_lost:'||coalesce(new.target_id::text,md5(new.keyword||new.search_location||new.surface||new.device)),'top3_lost','warning','Top-3 visibility lost',format('%s moved out of the Top 3 in %s.',new.keyword,new.search_location),'business_visibility_rankings',new.id,new.source_url,jsonb_build_object('position',oldpos),jsonb_build_object('position',nullif(newpos,101)));
  elsif oldpos>3 and newpos<=3 then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'top3_gained:'||coalesce(new.target_id::text,md5(new.keyword||new.search_location||new.surface||new.device)),'top3_gained','info','Top-3 visibility gained',format('%s entered the Top 3 in %s.',new.keyword,new.search_location),'business_visibility_rankings',new.id,new.source_url,jsonb_build_object('position',nullif(oldpos,101)),jsonb_build_object('position',newpos));
  end if;
  if oldpos<=10 and newpos>10 then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'top10_lost:'||coalesce(new.target_id::text,md5(new.keyword||new.search_location||new.surface||new.device)),'top10_lost','warning','Top-10 visibility lost',format('%s moved out of the Top 10 in %s.',new.keyword,new.search_location),'business_visibility_rankings',new.id,new.source_url,jsonb_build_object('position',oldpos),jsonb_build_object('position',nullif(newpos,101)));
  elsif oldpos>10 and newpos<=10 then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,new.prospect_id,null,'top10_gained:'||coalesce(new.target_id::text,md5(new.keyword||new.search_location||new.surface||new.device)),'top10_gained','info','Top-10 visibility gained',format('%s entered the Top 10 in %s.',new.keyword,new.search_location),'business_visibility_rankings',new.id,new.source_url,jsonb_build_object('position',nullif(oldpos,101)),jsonb_build_object('position',newpos));
  end if;
  return new;
end $$;
revoke all on function private.evaluate_business_visibility_ranking_alerts() from public,anon,authenticated;
drop trigger if exists trg_business_visibility_ranking_alerts on public.business_visibility_rankings;
create trigger trg_business_visibility_ranking_alerts after insert on public.business_visibility_rankings
for each row execute function private.evaluate_business_visibility_ranking_alerts();

create or replace function private.evaluate_business_visibility_competitor_ranking_alerts() returns trigger
language plpgsql security definer set search_path=public,private as $$
declare own public.business_visibility_rankings%rowtype; cname text;
begin
  select * into own from public.business_visibility_rankings
  where tenant_id=new.tenant_id and business_id=new.business_id
    and keyword=new.keyword and search_location=new.search_location and surface=new.surface and device=new.device and engine=new.engine
    and checked_at<=new.checked_at order by checked_at desc limit 1;
  select competitor_name into cname from public.business_visibility_competitors where id=new.competitor_id;
  if own.id is not null and not new.not_found and not own.not_found and new.position<own.position then
    perform private.upsert_business_visibility_alert(new.tenant_id,new.business_id,own.prospect_id,new.competitor_id,'competitor_outperforming:'||new.competitor_id::text||':'||coalesce(new.target_id::text,md5(new.keyword||new.search_location||new.surface||new.device)),'competitor_outperforming','warning','Tracked competitor is outranking this business',format('%s is #%s while this business is #%s for %s in %s on %s.',coalesce(cname,'Tracked competitor'),new.position,own.position,new.keyword,new.search_location,new.surface),'business_visibility_competitor_rankings',new.id,new.source_url,jsonb_build_object('business_position',own.position),jsonb_build_object('competitor_position',new.position));
  end if;
  return new;
end $$;
revoke all on function private.evaluate_business_visibility_competitor_ranking_alerts() from public,anon,authenticated;
drop trigger if exists trg_business_visibility_competitor_ranking_alerts on public.business_visibility_competitor_rankings;
create trigger trg_business_visibility_competitor_ranking_alerts after insert on public.business_visibility_competitor_rankings
for each row execute function private.evaluate_business_visibility_competitor_ranking_alerts();
