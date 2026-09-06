create index if not exists skylight_clients_business_fk_idx on public.skylight_clients (business_id);
create index if not exists skylight_clients_prospect_fk_idx on public.skylight_clients (prospect_id);
create index if not exists skylight_clients_created_by_fk_idx on public.skylight_clients (created_by);
create index if not exists skylight_clients_updated_by_fk_idx on public.skylight_clients (updated_by);

create index if not exists skylight_invoice_items_service_fk_idx on public.skylight_invoice_items (service_id);
create index if not exists skylight_invoice_payments_recorded_by_fk_idx on public.skylight_invoice_payments (recorded_by);
create index if not exists skylight_invoices_created_by_fk_idx on public.skylight_invoices (created_by);
create index if not exists skylight_invoices_updated_by_fk_idx on public.skylight_invoices (updated_by);

create index if not exists skylight_sales_campaign_members_assigned_user_fk_idx on public.skylight_sales_campaign_members (assigned_user_id);
create index if not exists skylight_sales_campaign_members_business_fk_idx on public.skylight_sales_campaign_members (business_id);
create index if not exists skylight_sales_campaign_members_growth_fk_idx on public.skylight_sales_campaign_members (growth_opportunity_id);
create index if not exists skylight_sales_campaign_members_opportunity_fk_idx on public.skylight_sales_campaign_members (opportunity_id);
create index if not exists skylight_sales_campaign_members_prospect_fk_idx on public.skylight_sales_campaign_members (prospect_id);

create index if not exists skylight_sales_campaigns_created_by_fk_idx on public.skylight_sales_campaigns (created_by);
create index if not exists skylight_sales_campaigns_updated_by_fk_idx on public.skylight_sales_campaigns (updated_by);

create index if not exists skylight_sales_opportunities_assigned_user_fk_idx on public.skylight_sales_opportunities (assigned_user_id);
create index if not exists skylight_sales_opportunities_client_fk_idx on public.skylight_sales_opportunities (client_id);
create index if not exists skylight_sales_opportunities_growth_fk_idx on public.skylight_sales_opportunities (growth_opportunity_id);
create index if not exists skylight_sales_opportunities_invoice_fk_idx on public.skylight_sales_opportunities (invoice_id);
create index if not exists skylight_sales_opportunities_prospect_fk_idx on public.skylight_sales_opportunities (prospect_id);
