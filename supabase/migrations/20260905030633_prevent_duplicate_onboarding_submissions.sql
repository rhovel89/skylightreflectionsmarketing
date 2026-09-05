create unique index if not exists business_submissions_pending_identity_uniq
on public.business_submissions(tenant_id,lower(btrim(business_name)),btrim(phone))
where status='pending' and promoted_business_id is null;
