alter table public.marketing_leads
  add column if not exists plan_interest text,
  add column if not exists context_city text,
  add column if not exists context_category text,
  add column if not exists context_business_id uuid references public.businesses(id) on delete set null,
  add column if not exists landing_path text;

alter table public.marketing_leads drop constraint if exists marketing_leads_plan_interest_check;
alter table public.marketing_leads add constraint marketing_leads_plan_interest_check
  check (plan_interest is null or plan_interest = any(array['free','verified','featured','pro','sponsorship','marketing_review']::text[]));

create index if not exists marketing_leads_tenant_plan_created_idx
  on public.marketing_leads(tenant_id, plan_interest, created_at desc);

create or replace function public.track_growth_event(
  p_tenant_id uuid,
  p_event_type text,
  p_page_path text default null,
  p_business_id uuid default null,
  p_city text default null,
  p_category text default null,
  p_plan text default null,
  p_source text default null
) returns void
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
begin
  if p_tenant_id is null or not exists(select 1 from public.tenants t where t.id=p_tenant_id) then
    raise exception 'Invalid tenant.';
  end if;

  if p_event_type is null or p_event_type <> all(array[
    'for_businesses_view','claim_cta_click','claim_submit','list_business_cta_click','listing_submit',
    'visibility_plan_click','market_sponsorship_click','marketing_review_click','marketing_lead_submit','business_visibility_click'
  ]::text[]) then
    raise exception 'Invalid growth event.';
  end if;

  if p_page_path is not null and length(p_page_path) > 400 then raise exception 'Invalid page path.'; end if;
  if p_city is not null and length(p_city) > 120 then raise exception 'Invalid city.'; end if;
  if p_category is not null and length(p_category) > 160 then raise exception 'Invalid category.'; end if;
  if p_source is not null and length(p_source) > 120 then raise exception 'Invalid source.'; end if;
  if p_plan is not null and p_plan <> all(array['free','verified','featured','pro','sponsorship','marketing_review']::text[]) then
    raise exception 'Invalid plan.';
  end if;

  if p_business_id is not null and not exists(
    select 1 from public.businesses b
    where b.id=p_business_id and b.tenant_id=p_tenant_id and lower(coalesce(b.status,''))='published'
  ) then
    raise exception 'Invalid business.';
  end if;

  insert into public.analytics_events(tenant_id,business_id,user_id,event_type,page_path,category,city,metadata,occurred_at)
  values(
    p_tenant_id,p_business_id,auth.uid(),p_event_type,nullif(btrim(p_page_path),''),nullif(btrim(p_category),''),nullif(btrim(p_city),''),
    jsonb_strip_nulls(jsonb_build_object('plan',nullif(btrim(p_plan),''),'source',nullif(btrim(p_source),''))),now()
  );
end;
$$;

revoke all on function public.track_growth_event(uuid,text,text,uuid,text,text,text,text) from public;
grant execute on function public.track_growth_event(uuid,text,text,uuid,text,text,text,text) to anon, authenticated;
