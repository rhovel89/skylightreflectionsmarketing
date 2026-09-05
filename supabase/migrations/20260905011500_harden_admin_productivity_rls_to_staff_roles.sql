drop policy if exists admin_saved_views_own_rows on public.admin_saved_views;
create policy admin_saved_views_staff_own_rows on public.admin_saved_views
for all to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.tenant_id = admin_saved_views.tenant_id
      and ur.role in ('staff','admin','super_admin')
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.tenant_id = admin_saved_views.tenant_id
      and ur.role in ('staff','admin','super_admin')
  )
);

drop policy if exists admin_notification_reads_own_rows on public.admin_notification_reads;
create policy admin_notification_reads_staff_own_rows on public.admin_notification_reads
for all to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.tenant_id = admin_notification_reads.tenant_id
      and ur.role in ('staff','admin','super_admin')
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.tenant_id = admin_notification_reads.tenant_id
      and ur.role in ('staff','admin','super_admin')
  )
);
