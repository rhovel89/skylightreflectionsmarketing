alter table public.listing_events drop constraint if exists listing_events_event_type_check;
alter table public.listing_events add constraint listing_events_event_type_check check(event_type in ('impression','profile_view','phone_click','website_click','directions_click'));
create or replace function private.rollup_listing_event()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.listing_daily_stats(business_id,stat_date,impressions,profile_views,phone_clicks,website_clicks,directions_clicks,lead_submissions)
  values(new.business_id,current_date,case when new.event_type='impression' then 1 else 0 end,case when new.event_type='profile_view' then 1 else 0 end,case when new.event_type='phone_click' then 1 else 0 end,case when new.event_type='website_click' then 1 else 0 end,case when new.event_type='directions_click' then 1 else 0 end,0)
  on conflict(business_id,stat_date) do update set
    impressions=public.listing_daily_stats.impressions+excluded.impressions,
    profile_views=public.listing_daily_stats.profile_views+excluded.profile_views,
    phone_clicks=public.listing_daily_stats.phone_clicks+excluded.phone_clicks,
    website_clicks=public.listing_daily_stats.website_clicks+excluded.website_clicks,
    directions_clicks=public.listing_daily_stats.directions_clicks+excluded.directions_clicks;
  return new;
end $$;
revoke all on function private.rollup_listing_event() from public,anon,authenticated;
