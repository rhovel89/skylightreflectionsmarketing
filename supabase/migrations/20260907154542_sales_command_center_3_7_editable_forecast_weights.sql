-- Sales 3.7 forecast assumptions are explicit and staff-editable, never hidden model guesses.
alter table public.skylight_sales_action_settings
  add column if not exists weight_new_bps integer not null default 500 check (weight_new_bps between 0 and 10000),
  add column if not exists weight_research_bps integer not null default 500 check (weight_research_bps between 0 and 10000),
  add column if not exists weight_contact_ready_bps integer not null default 1500 check (weight_contact_ready_bps between 0 and 10000),
  add column if not exists weight_contacted_bps integer not null default 2500 check (weight_contacted_bps between 0 and 10000),
  add column if not exists weight_qualified_bps integer not null default 5000 check (weight_qualified_bps between 0 and 10000),
  add column if not exists weight_proposal_bps integer not null default 7500 check (weight_proposal_bps between 0 and 10000),
  add column if not exists weight_nurture_bps integer not null default 1000 check (weight_nurture_bps between 0 and 10000);
