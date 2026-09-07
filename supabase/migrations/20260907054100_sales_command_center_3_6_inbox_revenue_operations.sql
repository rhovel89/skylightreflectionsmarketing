-- Sales Command Center 3.6
-- Unified conversation inbox, thread-aware staff replies, lifecycle linkage, and revenue attribution.
-- Human approval remains authoritative for outbound communication and financial commitments.

alter table public.skylight_sales_outreach_drafts
  add column if not exists provider_message_header text;

alter table public.skylight_sales_replies
  add column if not exists provider_email_id text,
  add column if not exists in_reply_to_header text,
  add column if not exists references_header text,
  add column if not exists headers jsonb not null default '{}'::jsonb,
  add column if not exists attachments jsonb not null default '[]'::jsonb;

create unique index if not exists uq_skylight_sales_replies_provider_email on public.skylight_sales_replies(tenant_id,provider,provider_email_id) where provider_email_id is not null;
create index if not exists idx_skylight_sales_replies_thread_header on public.skylight_sales_replies(tenant_id,in_reply_to_header) where in_reply_to_header is not null;
create index if not exists idx_skylight_sales_outreach_drafts_message_header on public.skylight_sales_outreach_drafts(tenant_id,provider_message_header) where provider_message_header is not null;

create table if not exists public.skylight_sales_thread_state (
  opportunity_id uuid primary key references public.skylight_sales_opportunities(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prospect_id uuid not null references public.business_prospects(id) on delete cascade,
  status text not null default 'waiting_on_them' check (status in ('waiting_on_us','waiting_on_them','closed')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_inbound_at timestamptz,last_outbound_at timestamptz,last_activity_at timestamptz not null default now(),last_subject text,updated_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists idx_skylight_sales_thread_state_queue on public.skylight_sales_thread_state(tenant_id,status,last_activity_at desc);
create index if not exists idx_skylight_sales_thread_state_prospect on public.skylight_sales_thread_state(prospect_id,last_activity_at desc);

create table if not exists public.skylight_sales_response_drafts (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,opportunity_id uuid not null references public.skylight_sales_opportunities(id) on delete cascade,prospect_id uuid not null references public.business_prospects(id) on delete cascade,reply_id uuid references public.skylight_sales_replies(id) on delete set null,campaign_id uuid references public.skylight_sales_campaigns(id) on delete set null,campaign_member_id uuid references public.skylight_sales_campaign_members(id) on delete set null,channel text not null default 'email' check (channel in ('email','sms','linkedin','social')),recipient_name text,recipient_email text,recipient_phone text,subject text,body text not null,in_reply_to_header text,references_header text,status text not null default 'draft' check (status in ('draft','approved','sent','cancelled','failed')),provider text,provider_email_id text,provider_message_header text,approved_by uuid,approved_at timestamptz,sent_by uuid,sent_at timestamptz,created_by uuid,updated_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists idx_skylight_sales_response_drafts_queue on public.skylight_sales_response_drafts(tenant_id,status,created_at desc);
create index if not exists idx_skylight_sales_response_drafts_opportunity on public.skylight_sales_response_drafts(opportunity_id,created_at desc);
create index if not exists idx_skylight_sales_response_drafts_prospect on public.skylight_sales_response_drafts(prospect_id,created_at desc);
create index if not exists idx_skylight_sales_response_drafts_reply on public.skylight_sales_response_drafts(reply_id) where reply_id is not null;
create index if not exists idx_skylight_sales_response_drafts_campaign on public.skylight_sales_response_drafts(campaign_id) where campaign_id is not null;
create index if not exists idx_skylight_sales_response_drafts_campaign_member on public.skylight_sales_response_drafts(campaign_member_id) where campaign_member_id is not null;
create unique index if not exists uq_skylight_sales_response_provider_email on public.skylight_sales_response_drafts(tenant_id,provider,provider_email_id) where provider_email_id is not null;

alter table public.skylight_sales_opportunities add column if not exists project_id uuid references public.skylight_projects(id) on delete set null,add column if not exists attributed_revenue_cents integer check (attributed_revenue_cents is null or attributed_revenue_cents >= 0),add column if not exists revenue_attributed_at timestamptz;
create index if not exists skylight_sales_opportunities_project_fk_idx on public.skylight_sales_opportunities(project_id) where project_id is not null;
create index if not exists skylight_sales_opportunities_revenue_idx on public.skylight_sales_opportunities(tenant_id,revenue_attributed_at desc) where revenue_attributed_at is not null;

create table if not exists public.skylight_sales_revenue_links (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,opportunity_id uuid not null references public.skylight_sales_opportunities(id) on delete cascade,prospect_id uuid not null references public.business_prospects(id) on delete cascade,client_id uuid references public.skylight_clients(id) on delete set null,proposal_id uuid references public.skylight_proposals(id) on delete set null,invoice_id uuid references public.skylight_invoices(id) on delete set null,project_id uuid references public.skylight_projects(id) on delete set null,link_type text not null check (link_type in ('client','proposal','invoice','project','revenue_snapshot')),amount_cents integer check (amount_cents is null or amount_cents >= 0),status_snapshot text,source text not null default 'sync' check (source in ('sync','staff')),notes text,created_by uuid,updated_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check ((link_type='client' and client_id is not null) or (link_type='proposal' and proposal_id is not null) or (link_type='invoice' and invoice_id is not null) or (link_type='project' and project_id is not null) or (link_type='revenue_snapshot'))
);
create index if not exists idx_skylight_sales_revenue_links_opportunity on public.skylight_sales_revenue_links(opportunity_id,created_at desc);
create index if not exists idx_skylight_sales_revenue_links_prospect on public.skylight_sales_revenue_links(prospect_id,created_at desc);
create index if not exists idx_skylight_sales_revenue_links_client on public.skylight_sales_revenue_links(client_id) where client_id is not null;
create index if not exists idx_skylight_sales_revenue_links_proposal on public.skylight_sales_revenue_links(proposal_id) where proposal_id is not null;
create index if not exists idx_skylight_sales_revenue_links_invoice on public.skylight_sales_revenue_links(invoice_id) where invoice_id is not null;
create index if not exists idx_skylight_sales_revenue_links_project on public.skylight_sales_revenue_links(project_id) where project_id is not null;
create unique index if not exists uq_skylight_sales_revenue_links_client on public.skylight_sales_revenue_links(opportunity_id,client_id) where link_type='client' and client_id is not null;
create unique index if not exists uq_skylight_sales_revenue_links_proposal on public.skylight_sales_revenue_links(opportunity_id,proposal_id) where link_type='proposal' and proposal_id is not null;
create unique index if not exists uq_skylight_sales_revenue_links_invoice on public.skylight_sales_revenue_links(opportunity_id,invoice_id) where link_type='invoice' and invoice_id is not null;
create unique index if not exists uq_skylight_sales_revenue_links_project on public.skylight_sales_revenue_links(opportunity_id,project_id) where link_type='project' and project_id is not null;

alter table public.skylight_sales_thread_state enable row level security;
alter table public.skylight_sales_response_drafts enable row level security;
alter table public.skylight_sales_revenue_links enable row level security;
create policy "staff manage skylight sales thread state" on public.skylight_sales_thread_state for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff manage skylight sales response drafts" on public.skylight_sales_response_drafts for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff manage skylight sales revenue links" on public.skylight_sales_revenue_links for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
revoke all on table public.skylight_sales_thread_state from anon;revoke all on table public.skylight_sales_response_drafts from anon;revoke all on table public.skylight_sales_revenue_links from anon;
grant select,insert,update,delete on table public.skylight_sales_thread_state to authenticated;grant select,insert,update,delete on table public.skylight_sales_response_drafts to authenticated;grant select,insert,update,delete on table public.skylight_sales_revenue_links to authenticated;
grant all on table public.skylight_sales_thread_state to service_role;grant all on table public.skylight_sales_response_drafts to service_role;grant all on table public.skylight_sales_revenue_links to service_role;
