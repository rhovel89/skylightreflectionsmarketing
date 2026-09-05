-- Ensure onboarding media belongs to the authenticated account's pending submission.
create or replace function private.auth_user_owns_pending_submission(p_tenant uuid,p_submission uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.business_submissions s
    where s.id=p_submission
      and s.tenant_id=p_tenant
      and s.submitted_by_user_id=auth.uid()
      and s.status='pending'
      and s.reviewed_at is null
  ) and private.account_has_business_username(auth.uid());
$$;
revoke all on function private.auth_user_owns_pending_submission(uuid,uuid) from public,anon;
grant execute on function private.auth_user_owns_pending_submission(uuid,uuid) to authenticated;

drop policy if exists "account holder insert own submission media" on public.business_submission_media;
create policy "account holder insert own submission media"
on public.business_submission_media for insert to authenticated
with check (
  status='pending'
  and promoted_at is null
  and promoted_business_media_id is null
  and private.submission_accepts_media(tenant_id,submission_id)
  and private.auth_user_owns_pending_submission(tenant_id,submission_id)
);
