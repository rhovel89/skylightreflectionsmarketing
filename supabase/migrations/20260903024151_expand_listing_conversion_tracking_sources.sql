alter table public.listing_events drop constraint if exists listing_events_source_check;

alter table public.listing_events
  add constraint listing_events_source_check
  check (
    source = any (
      array[
        'directory_public'::text,
        'profile_phone'::text,
        'profile_directions'::text,
        'business_website'::text,
        'menu'::text,
        'online_order'::text,
        'reservation'::text,
        'pro_primary_cta'::text,
        'pro_secondary_cta'::text,
        'pro_offer'::text,
        'pro_package'::text,
        'pro_social_facebook'::text,
        'pro_social_instagram'::text,
        'pro_social_linkedin'::text,
        'pro_social_tiktok'::text,
        'pro_social_youtube'::text,
        'pro_social_x'::text
      ]
    )
  );

create index if not exists listing_events_business_source_created_idx
  on public.listing_events(business_id,source,created_at desc);
