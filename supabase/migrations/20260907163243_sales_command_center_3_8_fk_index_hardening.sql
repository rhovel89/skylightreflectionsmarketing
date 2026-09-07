-- Sales Command Center 3.8 performance hardening.
-- Cover campaign foreign keys with campaign-first indexes for joins/deletes.
create index if not exists idx_skylight_sales_campaign_spend_campaign_fk
  on public.skylight_sales_campaign_spend(campaign_id);
create index if not exists idx_skylight_sales_acquisition_experiments_campaign_fk
  on public.skylight_sales_acquisition_experiments(campaign_id)
  where campaign_id is not null;