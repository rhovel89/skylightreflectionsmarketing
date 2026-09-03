alter table public.business_prospects
  add column if not exists owner_contact_title text,
  add column if not exists owner_contact_source_url text,
  add column if not exists owner_contact_checked_at timestamptz;

create index if not exists business_prospects_contact_ready_idx
  on public.business_prospects(tenant_id,crm_stage,priority,updated_at desc)
  where coalesce(owner_contact_email,'')<>'' or coalesce(owner_contact_phone,'')<>'';
