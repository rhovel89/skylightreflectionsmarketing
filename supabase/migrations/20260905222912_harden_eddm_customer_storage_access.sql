-- Storage policies need a callable current-user access predicate without exposing arbitrary user lookups.
create or replace function private.current_user_has_eddm_interest_access(p_interest_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.skylight_eddm_interests i
    join public.skylight_client_portal_access a on a.client_id=i.client_id and a.tenant_id=i.tenant_id
    where i.id=p_interest_id and a.user_id=auth.uid() and a.status='active'
  )
$$;
revoke all on function private.current_user_has_eddm_interest_access(uuid) from public,anon;
grant execute on function private.current_user_has_eddm_interest_access(uuid) to authenticated;

drop policy if exists "eddm customers read own assets" on storage.objects;
create policy "eddm customers read own assets" on storage.objects for select to authenticated using(
  bucket_id='eddm-assets'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.current_user_has_eddm_interest_access(((storage.foldername(name))[3])::uuid)
);

drop policy if exists "eddm customers upload own assets" on storage.objects;
create policy "eddm customers upload own assets" on storage.objects for insert to authenticated with check(
  bucket_id='eddm-assets'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.current_user_has_eddm_interest_access(((storage.foldername(name))[3])::uuid)
);

comment on function private.current_user_has_eddm_interest_access(uuid) is 'Boolean-only helper for EDDM private storage RLS. It evaluates access only for auth.uid() and does not reveal arbitrary user memberships.';
