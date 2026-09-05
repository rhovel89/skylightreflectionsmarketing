create index if not exists business_claims_submission_fk_idx on public.business_claims(submission_id) where submission_id is not null;
create index if not exists business_submission_media_tenant_idx on public.business_submission_media(tenant_id);
create index if not exists business_submission_media_promoted_media_idx on public.business_submission_media(promoted_business_media_id) where promoted_business_media_id is not null;
create index if not exists email_drip_enrollments_tenant_idx on public.email_drip_enrollments(tenant_id);
create index if not exists email_drip_enrollments_business_idx on public.email_drip_enrollments(business_id);
create index if not exists email_outbox_business_idx on public.email_outbox(business_id) where business_id is not null;
create index if not exists email_outbox_campaign_idx on public.email_outbox(campaign_id) where campaign_id is not null;
create index if not exists email_outbox_step_idx on public.email_outbox(step_id) where step_id is not null;
