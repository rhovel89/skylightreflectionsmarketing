with tenant as (
  select t.id from public.tenants t where t.slug='central-illinois-local-pros' limit 1
), target_business as (
  select b.id
  from public.businesses b,tenant t
  where b.tenant_id=t.id and lower(b.name)=lower('Podbelsek Family Creations') and b.status='published'
  limit 1
), target_category as (
  select c.id
  from public.categories c,tenant t
  where c.tenant_id=t.id and lower(c.name)=lower('Art & Craft Stores') and c.is_active=true
  limit 1
)
insert into public.business_categories(business_id,category_id,is_primary)
select b.id,c.id,false from target_business b cross join target_category c
where not exists (
  select 1 from public.business_categories bc where bc.business_id=b.id and bc.category_id=c.id
);

with tenant as (
  select t.id from public.tenants t where t.slug='central-illinois-local-pros' limit 1
), target_gap as (
  select g.id,g.market_location_id,g.category_id
  from public.seo_market_gaps g,tenant t
  where g.tenant_id=t.id and lower(g.city)=lower('Lincoln') and lower(g.category)=lower('Art & Craft Stores')
  limit 1
), provider_count as (
  select g.id,count(distinct b.id)::int as providers
  from target_gap g
  join public.business_categories bc on bc.category_id=g.category_id
  join public.businesses b on b.id=bc.business_id and b.status='published'
  where b.primary_location_id=g.market_location_id
     or exists (
       select 1 from public.business_locations bl
       where bl.business_id=b.id and bl.tenant_id=b.tenant_id and bl.is_active=true and bl.location_id=g.market_location_id
     )
  group by g.id
)
update public.seo_market_gaps g
set current_providers=pc.providers,
    target_providers=3,
    status=case when pc.providers>=3 then 'filled' else 'open' end,
    priority=case when pc.providers>=3 then 'low' when pc.providers=2 then 'high' when pc.providers=1 then 'medium' else 'low' end,
    reason=case when pc.providers>=3 then 'Provider threshold met.' when pc.providers=2 then 'One additional legitimate published provider is still needed to meet the category-page threshold.' else 'Additional legitimate published providers are still needed to meet the category-page threshold.' end,
    last_calculated_at=now(),updated_at=now()
from provider_count pc
where g.id=pc.id;

with tenant as (
  select t.id from public.tenants t where t.slug='central-illinois-local-pros' limit 1
), market as (
  select l.id from public.locations l,tenant t where l.tenant_id=t.id and l.type='city' and lower(l.name)=lower('Lincoln') limit 1
), category as (
  select c.id from public.categories c,tenant t where c.tenant_id=t.id and lower(c.name)=lower('Art & Craft Stores') and c.is_active=true limit 1
)
insert into public.seo_pages(
  tenant_id,market_location_id,category_id,city,category,title,description,h1,intro,content,focus_topic,index_mode,reviewed,updated_at
)
select
  t.id,m.id,c.id,'Lincoln','Art & Craft Stores',
  'Art & Craft Stores in Lincoln, IL | Central Illinois Local Pros',
  'Explore art and craft stores in Lincoln, Illinois for quilting supplies, creative projects, handcrafted décor, custom pieces and local maker experiences.',
  'Art & Craft Stores in Lincoln, Illinois',
  'Lincoln has a small but varied creative-shopping scene, with local businesses serving different kinds of makers and shoppers. Depending on the project, you can find quilting and sewing materials, handcrafted home décor, personalized creative work, custom gifts and hands-on activities. Use the listings on this page to compare each business by what it actually offers rather than assuming every shop carries the same supplies or services.',
  'When choosing an art or craft store in Lincoln, start with the kind of project you are planning. Quilters and sewists may want to look for fabric selection, notions, patterns, machines, classes or long-arm services. Shoppers looking for finished handmade goods may care more about locally created décor, repurposed pieces, seasonal items or customization. Some local creative businesses also host paint parties, workshops or other guided activities, which can be a better fit when the goal is an experience rather than simply buying supplies.\n\nBefore visiting, check the business profile for current contact information and follow the linked source or website when one is available. Independent stores can have changing hours, appointment-based periods, limited-run inventory or event schedules, so confirming details before a special trip is useful. If you need a specific fabric line, custom engraving, a personalized sign, a commissioned piece or supplies for a deadline-driven project, contact the business directly to confirm availability and turnaround time.\n\nThe directory keeps paid promotion separate from organic relevance. Businesses shown for this market are included because they have a legitimate Lincoln relationship and a matching category; sponsored placement, when present, is labeled and does not replace the underlying organic directory results.',
  'art and craft stores in Lincoln Illinois','auto',true,now()
from tenant t cross join market m cross join category c
where not exists (
  select 1 from public.seo_pages s where s.tenant_id=t.id and s.market_location_id=m.id and s.category_id=c.id
);

select private.refresh_data_quality_tasks(t.id)
from public.tenants t
where t.slug='central-illinois-local-pros';
