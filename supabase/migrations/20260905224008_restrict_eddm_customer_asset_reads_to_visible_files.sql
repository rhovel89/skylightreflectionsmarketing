-- Customer storage reads require both explicit campaign access and customer-visible asset metadata.
drop policy if exists "eddm customers read own assets" on storage.objects;
create policy "eddm customers read own assets" on storage.objects for select to authenticated using(
  bucket_id='eddm-assets'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.current_user_has_eddm_interest_access(((storage.foldername(name))[3])::uuid)
  and exists(
    select 1
    from public.skylight_eddm_artwork_assets a
    where a.storage_path=storage.objects.name
      and a.interest_id=((storage.foldername(storage.objects.name))[3])::uuid
      and a.customer_visible=true
      and a.asset_type in('customer_artwork','proof','approved_proof','print_ready')
  )
);

comment on policy "eddm customers read own assets" on storage.objects is 'Customer may read only files tied to explicit EDDM access AND customer-visible artwork/proof metadata. Internal USPS/production assets remain private even if their storage path is guessed.';
