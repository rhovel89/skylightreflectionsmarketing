-- V15.5 one-time operator bootstrap.
-- DO NOT run until the owner has created the first Supabase Auth account.
-- Replace OWNER_AUTH_USER_UUID with that exact auth.users.id value.
-- This is an explicit assignment; it never auto-promotes an arbitrary first user.

insert into public.user_roles (tenant_id, user_id, role)
values (
  '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,
  'OWNER_AUTH_USER_UUID'::uuid,
  'super_admin'
)
on conflict do nothing;
