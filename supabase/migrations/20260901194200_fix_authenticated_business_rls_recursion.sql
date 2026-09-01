-- Remove an authenticated RLS recursion between businesses and business_owners.
-- Ownership/staff checks use private SECURITY DEFINER helpers so policies do not
-- recursively re-enter each other's RLS graphs.

create or replace function private.owns_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_owners bo
    where bo.business_id = p_business_id
      and bo.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_manage_business(p_business_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    join public.user_roles ur
      on ur.tenant_id = b.tenant_id
    where b.id = p_business_id
      and ur.user_id = (select auth.uid())
      and ur.role = any(p_roles)
  );
$$;

revoke all on function private.owns_business(uuid) from public;
revoke all on function private.can_manage_business(uuid, text[]) from public;
grant execute on function private.owns_business(uuid) to authenticated;
grant execute on function private.can_manage_business(uuid, text[]) to authenticated;

drop policy if exists "owner read owned business" on public.businesses;
create policy "owner read owned business"
on public.businesses
for select
to authenticated
using (private.owns_business(id));

drop policy if exists "owner read own business locations" on public.business_locations;
create policy "owner read own business locations"
on public.business_locations
for select
to authenticated
using (private.owns_business(business_id));

drop policy if exists "staff manage ownership" on public.business_owners;
create policy "staff manage ownership"
on public.business_owners
for all
to authenticated
using (private.can_manage_business(business_id, array['staff','admin','super_admin']::text[]))
with check (private.can_manage_business(business_id, array['staff','admin','super_admin']::text[]));
