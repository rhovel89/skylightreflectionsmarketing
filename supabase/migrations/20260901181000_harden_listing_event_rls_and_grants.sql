drop policy if exists "public insert listing events safely" on public.listing_events;
create policy "public insert listing events safely" on public.listing_events for insert to anon,authenticated with check(
  source='directory_public' and exists(select 1 from public.businesses b where b.id=listing_events.business_id and b.tenant_id=listing_events.tenant_id and b.status='published')
);

revoke all privileges on table public.listing_events from anon,authenticated;
grant insert on table public.listing_events to anon,authenticated;
grant select on table public.listing_events to authenticated;
do $$
declare seq_name text;
begin
  seq_name:=pg_get_serial_sequence('public.listing_events','id');
  if seq_name is not null then
    execute format('revoke all privileges on sequence %s from anon,authenticated',seq_name);
    execute format('grant usage on sequence %s to anon,authenticated',seq_name);
  end if;
end $$;
