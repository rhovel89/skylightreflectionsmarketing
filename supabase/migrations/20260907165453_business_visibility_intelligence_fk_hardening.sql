-- Business Visibility Intelligence 3.9 FK hardening.
-- Narrow FK-leading indexes for delete/join maintenance; no behavior or visibility changes.

create index if not exists idx_business_visibility_audits_business_fk
  on public.business_visibility_audits(business_id);
create index if not exists idx_business_visibility_audits_prospect_fk
  on public.business_visibility_audits(prospect_id)
  where prospect_id is not null;

create index if not exists idx_business_visibility_targets_business_fk
  on public.business_visibility_keyword_targets(business_id);
create index if not exists idx_business_visibility_targets_prospect_fk
  on public.business_visibility_keyword_targets(prospect_id)
  where prospect_id is not null;

create index if not exists idx_business_visibility_rankings_business_fk
  on public.business_visibility_rankings(business_id);
create index if not exists idx_business_visibility_rankings_prospect_fk
  on public.business_visibility_rankings(prospect_id)
  where prospect_id is not null;
