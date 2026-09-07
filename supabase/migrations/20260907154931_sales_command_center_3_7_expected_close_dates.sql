-- Sales 3.7 factual forecast horizon support.
-- Close dates are staff-entered; the system does not invent them.
alter table public.skylight_sales_opportunities
  add column if not exists expected_close_date date;
create index if not exists idx_skylight_sales_opportunities_expected_close
  on public.skylight_sales_opportunities(tenant_id,expected_close_date,stage)
  where active=true and expected_close_date is not null;
