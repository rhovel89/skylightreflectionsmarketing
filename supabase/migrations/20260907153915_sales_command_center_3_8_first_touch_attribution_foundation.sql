-- Sales Command Center 3.8 foundation
-- Lock first-touch campaign attribution from real sent outreach so campaign/service revenue reporting is not inferred from later activity.

alter table public.skylight_sales_opportunities
  add column if not exists attribution_campaign_id uuid references public.skylight_sales_campaigns(id) on delete set null,
  add column if not exists attribution_outreach_draft_id uuid references public.skylight_sales_outreach_drafts(id) on delete set null,
  add column if not exists attribution_source text check (attribution_source is null or attribution_source in ('first_sent_outreach','staff')),
  add column if not exists attribution_locked_at timestamptz;

create index if not exists idx_skylight_sales_opportunities_attribution_campaign
  on public.skylight_sales_opportunities(tenant_id,attribution_campaign_id)
  where attribution_campaign_id is not null;
create index if not exists idx_skylight_sales_opportunities_attribution_draft
  on public.skylight_sales_opportunities(attribution_outreach_draft_id)
  where attribution_outreach_draft_id is not null;

with first_touch as (
  select distinct on (d.opportunity_id)
    d.opportunity_id,d.id as draft_id,d.campaign_id,d.sent_at
  from public.skylight_sales_outreach_drafts d
  where d.status='sent' and d.sent_at is not null and d.campaign_id is not null
  order by d.opportunity_id,d.sent_at asc,d.created_at asc
)
update public.skylight_sales_opportunities o
set attribution_campaign_id=f.campaign_id,
    attribution_outreach_draft_id=f.draft_id,
    attribution_source='first_sent_outreach',
    attribution_locked_at=f.sent_at,
    updated_at=greatest(o.updated_at,f.sent_at)
from first_touch f
where o.id=f.opportunity_id and o.attribution_campaign_id is null;

create or replace function private.capture_skylight_sales_first_touch_attribution()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
  if new.status='sent' and new.sent_at is not null and new.campaign_id is not null then
    update public.skylight_sales_opportunities
    set attribution_campaign_id=new.campaign_id,
        attribution_outreach_draft_id=new.id,
        attribution_source='first_sent_outreach',
        attribution_locked_at=new.sent_at,
        updated_at=greatest(updated_at,new.sent_at)
    where id=new.opportunity_id and attribution_campaign_id is null;
  end if;
  return new;
end;
$$;

revoke all on function private.capture_skylight_sales_first_touch_attribution() from public,anon,authenticated;

drop trigger if exists skylight_sales_capture_first_touch_attribution on public.skylight_sales_outreach_drafts;
create trigger skylight_sales_capture_first_touch_attribution
after insert or update of status,sent_at,campaign_id on public.skylight_sales_outreach_drafts
for each row execute function private.capture_skylight_sales_first_touch_attribution();
