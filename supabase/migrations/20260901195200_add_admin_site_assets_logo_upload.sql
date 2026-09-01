-- Durable site-brand asset storage. Public reads are served by the public bucket;
-- writes are limited to authenticated Admin/Super Admin users for the tenant
-- encoded in the first storage path segment.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin upload site assets" on storage.objects;
create policy "admin upload site assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-assets'
  and (storage.foldername(name))[1] is not null
  and private.has_tenant_role(((storage.foldername(name))[1])::uuid, array['admin','super_admin']::text[])
);

drop policy if exists "admin update site assets" on storage.objects;
create policy "admin update site assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'site-assets'
  and (storage.foldername(name))[1] is not null
  and private.has_tenant_role(((storage.foldername(name))[1])::uuid, array['admin','super_admin']::text[])
)
with check (
  bucket_id = 'site-assets'
  and (storage.foldername(name))[1] is not null
  and private.has_tenant_role(((storage.foldername(name))[1])::uuid, array['admin','super_admin']::text[])
);

drop policy if exists "admin delete site assets" on storage.objects;
create policy "admin delete site assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-assets'
  and (storage.foldername(name))[1] is not null
  and private.has_tenant_role(((storage.foldername(name))[1])::uuid, array['admin','super_admin']::text[])
);
