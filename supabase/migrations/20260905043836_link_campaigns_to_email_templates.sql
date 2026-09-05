alter table public.email_drip_campaigns add column if not exists source_template_id uuid references public.email_template_library(id) on delete set null;
alter table public.email_drip_campaigns add column if not exists source_template_version_at timestamptz;
create index if not exists email_drip_campaigns_source_template_idx on public.email_drip_campaigns(source_template_id) where source_template_id is not null;
