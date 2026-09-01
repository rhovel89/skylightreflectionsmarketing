drop policy if exists "staff read listing daily stats" on public.listing_daily_stats;
create policy "staff read listing daily stats" on public.listing_daily_stats for select to authenticated using(
  exists(select 1 from public.businesses b where b.id=business_id and private.has_tenant_role(b.tenant_id,array['staff','admin','super_admin']))
);
