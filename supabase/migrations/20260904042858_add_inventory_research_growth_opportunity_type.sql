set lock_timeout = '5s';

alter table public.growth_opportunities
  drop constraint if exists growth_opportunities_opportunity_type_check;

alter table public.growth_opportunities
  add constraint growth_opportunities_opportunity_type_check
  check (opportunity_type = any (array[
    'claim_activation'::text,
    'contact_enrichment'::text,
    'paid_plan_activation'::text,
    'pro_upgrade'::text,
    'sponsorship'::text,
    'lead_buyer_activation'::text,
    'skylight_marketing'::text,
    'inventory_research'::text
  ]));
