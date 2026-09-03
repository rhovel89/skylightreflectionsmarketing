create policy "tenant staff upload business media objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-media'
  and exists (
    select 1
    from public.businesses b
    join public.user_roles ur
      on ur.tenant_id = b.tenant_id
     and ur.user_id = (select auth.uid())
     and ur.role in ('staff','admin','super_admin')
    where b.id::text = (storage.foldername(name))[1]
  )
);

create policy "tenant staff delete business media objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-media'
  and exists (
    select 1
    from public.businesses b
    join public.user_roles ur
      on ur.tenant_id = b.tenant_id
     and ur.user_id = (select auth.uid())
     and ur.role in ('staff','admin','super_admin')
    where b.id::text = (storage.foldername(name))[1]
  )
);
