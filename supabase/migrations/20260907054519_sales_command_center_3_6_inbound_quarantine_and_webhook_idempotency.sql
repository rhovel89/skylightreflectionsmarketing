-- Sales Command Center 3.6 hardening
-- Preserve unmatched inbound mail and make webhook processing idempotent.

create table if not exists public.skylight_sales_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  webhook_id text not null,
  event_type text not null,
  provider_email_id text,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(tenant_id,provider,webhook_id)
);
create index if not exists idx_skylight_sales_webhook_receipts_recent on public.skylight_sales_webhook_receipts(tenant_id,received_at desc);
create index if not exists idx_skylight_sales_webhook_receipts_provider_email on public.skylight_sales_webhook_receipts(provider,provider_email_id) where provider_email_id is not null;

create table if not exists public.skylight_sales_unmatched_inbound (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null default 'resend',
  provider_email_id text,
  provider_message_id text,
  in_reply_to_header text,
  references_header text,
  sender_name text,
  sender_email text,
  recipient_emails text[] not null default '{}'::text[],
  subject text,
  body text not null,
  headers jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  received_at timestamptz not null default now(),
  status text not null default 'unmatched' check (status in ('unmatched','attached','dismissed')),
  attached_opportunity_id uuid references public.skylight_sales_opportunities(id) on delete set null,
  attached_reply_id uuid references public.skylight_sales_replies(id) on delete set null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_skylight_sales_unmatched_inbound_provider_email on public.skylight_sales_unmatched_inbound(tenant_id,provider,provider_email_id) where provider_email_id is not null;
create index if not exists idx_skylight_sales_unmatched_inbound_queue on public.skylight_sales_unmatched_inbound(tenant_id,status,received_at desc);
create index if not exists idx_skylight_sales_unmatched_inbound_opportunity on public.skylight_sales_unmatched_inbound(attached_opportunity_id) where attached_opportunity_id is not null;
create index if not exists idx_skylight_sales_unmatched_inbound_reply on public.skylight_sales_unmatched_inbound(attached_reply_id) where attached_reply_id is not null;

alter table public.skylight_sales_webhook_receipts enable row level security;
alter table public.skylight_sales_unmatched_inbound enable row level security;
create policy "staff read skylight sales webhook receipts" on public.skylight_sales_webhook_receipts for select to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create policy "staff manage skylight unmatched inbound" on public.skylight_sales_unmatched_inbound for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
revoke all on table public.skylight_sales_webhook_receipts from anon;
revoke all on table public.skylight_sales_unmatched_inbound from anon;
grant select on table public.skylight_sales_webhook_receipts to authenticated;
grant select,insert,update,delete on table public.skylight_sales_unmatched_inbound to authenticated;
grant all on table public.skylight_sales_webhook_receipts to service_role;
grant all on table public.skylight_sales_unmatched_inbound to service_role;
