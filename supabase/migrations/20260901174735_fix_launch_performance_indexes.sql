-- V15.5 launch performance cleanup.
-- Adds covering indexes for foreign keys reported by the Supabase performance advisor
-- and removes two verified duplicate index definitions.

create index if not exists business_media_reviewed_by_idx
  on public.business_media(reviewed_by);

create index if not exists business_prospects_assigned_user_idx
  on public.business_prospects(assigned_user_id);

create index if not exists outreach_tasks_assigned_user_idx
  on public.outreach_tasks(assigned_user_id);

create index if not exists outreach_tasks_prospect_idx
  on public.outreach_tasks(prospect_id);

create index if not exists prospect_activities_actor_user_idx
  on public.prospect_activities(actor_user_id);

create index if not exists prospect_activities_tenant_idx
  on public.prospect_activities(tenant_id);

create index if not exists seo_market_gaps_market_location_idx
  on public.seo_market_gaps(market_location_id);

-- Exact duplicate of lead_recipients_business_status_idx.
drop index if exists public.lead_recipients_business_idx;

-- Exact duplicate of leads_tenant_status_created_idx.
drop index if exists public.leads_tenant_status_idx;
