alter table public.sponsorships
  add column if not exists promo_text text,
  add column if not exists promo_cta_label text,
  add column if not exists promo_url text,
  add column if not exists monthly_add_on_cents integer not null default 500;

alter table public.sponsorships drop constraint if exists sponsorships_placement_check;
alter table public.sponsorships add constraint sponsorships_placement_check check (
  placement = any (array[
    'sitewide'::text,'search'::text,'city'::text,'category'::text,
    'homepage_featured'::text,'homepage_ticker'::text,
    'global_sidebar'::text,'city_sidebar'::text,'category_sidebar'::text,
    'market_sidebar'::text,'page_sidebar'::text,'guide_sidebar'::text,
    'business_profile_sidebar'::text,'restaurant_sidebar'::text,
    'home_services_sidebar'::text,'attorney_sidebar'::text,'local_stores_sidebar'::text
  ])
);

alter table public.sponsorships drop constraint if exists sponsorships_monthly_add_on_cents_check;
alter table public.sponsorships add constraint sponsorships_monthly_add_on_cents_check
  check (monthly_add_on_cents >= 0 and monthly_add_on_cents <= 100000);

create index if not exists sponsorships_homepage_ticker_active_idx
  on public.sponsorships (tenant_id, placement, active, starts_on, ends_on, priority desc, sort_order asc)
  where placement='homepage_ticker';
