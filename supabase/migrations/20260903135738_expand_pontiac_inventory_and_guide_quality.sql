-- Reproducible data migration applied to production as expand_pontiac_inventory_and_guide_quality.
-- Adds source-backed Pontiac inventory, improves category coverage, and upgrades thin guides.

with loc as (
  select id from locations
  where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='pontiac' and is_active=true
  limit 1
), upserted as (
  insert into businesses (tenant_id,slug,name,abbr,primary_location_id,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at)
  select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'popejoy-plumbing-heating-electric-septic-pontiac','Popejoy Plumbing, Heating, Electric and Septic','PP',loc.id,'815-844-4461','https://popejoyinc.com/','Pontiac branch providing plumbing, heating and cooling, electrical, septic, water treatment and related home-service work.','published',now(),'305 Old Route 66, Pontiac, IL 61764','Official business website','https://popejoyinc.com/',now() from loc
  on conflict (tenant_id,slug) do update set name=excluded.name,phone=excluded.phone,website=excluded.website,description=excluded.description,status='published',address_text=excluded.address_text,primary_location_id=excluded.primary_location_id,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now(),published_at=coalesce(businesses.published_at,now())
  returning id
)
insert into business_locations (tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,u.id,loc.id,'Pontiac','office',true,true,false,'305 Old Route 66, Pontiac, IL 61764','Pontiac','IL','61764','815-844-4461','Official business website','https://popejoyinc.com/',now()
from upserted u cross join loc
where not exists (select 1 from business_locations bl where bl.business_id=u.id and bl.location_id=loc.id and bl.address_text='305 Old Route 66, Pontiac, IL 61764');

insert into business_categories (business_id,category_id,is_primary)
select b.id,c.id,(c.slug='plumbing')
from businesses b join categories c on c.tenant_id=b.tenant_id and c.slug in ('plumbing','hvac','electrical')
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='popejoy-plumbing-heating-electric-septic-pontiac'
on conflict (business_id,category_id) do update set is_primary=excluded.is_primary;

with loc as (
  select id from locations
  where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='pontiac' and is_active=true
  limit 1
), upserted as (
  insert into businesses (tenant_id,slug,name,abbr,primary_location_id,phone,email,website,description,status,published_at,address_text,source_name,source_url,source_checked_at)
  select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'dpi-plumbing-heating-cooling-pontiac','DPI Plumbing, Heating & Cooling','DPI',loc.id,'815-419-2040','joel@dpiphc.com','https://dpiphc.com/','Pontiac plumbing and HVAC contractor serving residential and light-commercial customers from its North Ladd Street location.','published',now(),'900 N Ladd St, Pontiac, IL 61764','Illinois Commerce Commission / Trane dealer profile','https://www.trane.com/residential/en/dealers/dpi-plumbing-heating-cooling-llc-pontiac-illinois-1015572/',now() from loc
  on conflict (tenant_id,slug) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,website=excluded.website,description=excluded.description,status='published',address_text=excluded.address_text,primary_location_id=excluded.primary_location_id,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now(),published_at=coalesce(businesses.published_at,now())
  returning id
)
insert into business_locations (tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,email,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,u.id,loc.id,'Pontiac','office',true,true,false,'900 N Ladd St, Pontiac, IL 61764','Pontiac','IL','61764','815-419-2040','joel@dpiphc.com','Illinois Commerce Commission','https://www.icc.illinois.gov/docket/P2024-0924/documents/359144/files/629185.pdf',now()
from upserted u cross join loc
where not exists (select 1 from business_locations bl where bl.business_id=u.id and bl.location_id=loc.id and bl.address_text='900 N Ladd St, Pontiac, IL 61764');

insert into business_categories (business_id,category_id,is_primary)
select b.id,c.id,(c.slug='plumbing')
from businesses b join categories c on c.tenant_id=b.tenant_id and c.slug in ('plumbing','hvac')
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='dpi-plumbing-heating-cooling-pontiac'
on conflict (business_id,category_id) do update set is_primary=excluded.is_primary;

with loc as (
  select id from locations
  where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='pontiac' and is_active=true
  limit 1
), upserted as (
  insert into businesses (tenant_id,slug,name,abbr,primary_location_id,phone,website,description,status,published_at,address_text,source_name,source_url,source_checked_at)
  select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'elegant-lawns-pontiac','Elegant Lawns','EL',loc.id,'815-673-9151','https://www.elegantlawn.com/','Pontiac lawn-care and landscaping provider offering mowing, landscape work, seasonal cleanups, snow and ice services and related property maintenance.','published',now(),'1505 N Aurora St, Pontiac, IL 61764','Official website / current local business profile','https://www.elegantlawn.com/',now() from loc
  on conflict (tenant_id,slug) do update set name=excluded.name,phone=excluded.phone,website=excluded.website,description=excluded.description,status='published',address_text=excluded.address_text,primary_location_id=excluded.primary_location_id,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now(),published_at=coalesce(businesses.published_at,now())
  returning id
)
insert into business_locations (tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,u.id,loc.id,'Pontiac','office',true,true,false,'1505 N Aurora St, Pontiac, IL 61764','Pontiac','IL','61764','815-673-9151','Current local business profile','https://www.bestprosintown.com/il/pontiac/elegant-lawns-/',now()
from upserted u cross join loc
where not exists (select 1 from business_locations bl where bl.business_id=u.id and bl.location_id=loc.id and bl.address_text='1505 N Aurora St, Pontiac, IL 61764');

insert into business_categories (business_id,category_id,is_primary)
select b.id,c.id,(c.slug='lawn-care')
from businesses b join categories c on c.tenant_id=b.tenant_id and c.slug in ('lawn-care','landscaping')
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='elegant-lawns-pontiac'
on conflict (business_id,category_id) do update set is_primary=excluded.is_primary;

with loc as (
  select id from locations
  where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='pontiac' and is_active=true
  limit 1
), upserted as (
  insert into businesses (tenant_id,slug,name,abbr,primary_location_id,phone,description,status,published_at,address_text,source_name,source_url,source_checked_at)
  select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'pfaffs-bakery-pontiac','Pfaff''s Bakery','PB',loc.id,'815-844-7957','Downtown Pontiac bakery offering donuts, pastries, breads, cakes and other baked goods.','published',now(),'313 N Mill St, Pontiac, IL 61764','Visit Pontiac business directory','https://visitpontiac.org/business-directory/pfaffs-bakery/',now() from loc
  on conflict (tenant_id,slug) do update set name=excluded.name,phone=excluded.phone,description=excluded.description,status='published',address_text=excluded.address_text,primary_location_id=excluded.primary_location_id,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now(),published_at=coalesce(businesses.published_at,now())
  returning id
)
insert into business_locations (tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,u.id,loc.id,'Downtown Pontiac','storefront',true,true,false,'313 N Mill St, Pontiac, IL 61764','Pontiac','IL','61764','815-844-7957','Visit Pontiac business directory','https://visitpontiac.org/business-directory/pfaffs-bakery/',now()
from upserted u cross join loc
where not exists (select 1 from business_locations bl where bl.business_id=u.id and bl.location_id=loc.id and bl.address_text='313 N Mill St, Pontiac, IL 61764');

insert into business_categories (business_id,category_id,is_primary)
select b.id,c.id,true
from businesses b join categories c on c.tenant_id=b.tenant_id and c.slug='bakeries-desserts'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='pfaffs-bakery-pontiac'
on conflict (business_id,category_id) do update set is_primary=true;

with loc as (
  select id from locations
  where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='pontiac' and is_active=true
  limit 1
), upserted as (
  insert into businesses (tenant_id,slug,name,abbr,primary_location_id,phone,description,status,published_at,address_text,source_name,source_url,source_checked_at)
  select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'robert-preston-follmer-bankruptcy-pontiac','Robert Preston Follmer','RF',loc.id,'815-842-3245','Pontiac attorney whose current published practice information identifies bankruptcy and debt as a practice area.','published',now(),'5 E Martha Dr, Pontiac, IL 61764','Martindale / Avvo attorney profiles','https://www.martindale.com/attorney/robert-preston-follmer-962794/',now() from loc
  on conflict (tenant_id,slug) do update set name=excluded.name,phone=excluded.phone,description=excluded.description,status='published',address_text=excluded.address_text,primary_location_id=excluded.primary_location_id,source_name=excluded.source_name,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,updated_at=now(),published_at=coalesce(businesses.published_at,now())
  returning id
)
insert into business_locations (tenant_id,business_id,location_id,label,location_type,is_primary,is_active,verified,address_text,city,state,postal_code,phone,source_name,source_url,source_checked_at)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,u.id,loc.id,'Pontiac','office',true,true,false,'5 E Martha Dr, Pontiac, IL 61764','Pontiac','IL','61764','815-842-3245','Martindale / Avvo attorney profiles','https://www.martindale.com/attorney/robert-preston-follmer-962794/',now()
from upserted u cross join loc
where not exists (select 1 from business_locations bl where bl.business_id=u.id and bl.location_id=loc.id and bl.address_text='5 E Martha Dr, Pontiac, IL 61764');

insert into business_categories (business_id,category_id,is_primary)
select b.id,c.id,true
from businesses b join categories c on c.tenant_id=b.tenant_id and c.slug='bankruptcy'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug='robert-preston-follmer-bankruptcy-pontiac'
on conflict (business_id,category_id) do update set is_primary=true;

insert into business_categories (business_id,category_id,is_primary)
select b.id,c.id,false
from businesses b join categories c on c.tenant_id=b.tenant_id and c.slug='burgers'
where b.tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and b.slug in ('b-s-rally-point','bob-ringo-s-grill-smokehouse')
on conflict (business_id,category_id) do nothing;

update businesses
set website='https://bsrallypoint.com/',menu_url='https://bsrallypoint.com/menu/',source_name=coalesce(source_name,'Official business website'),source_url=coalesce(source_url,'https://bsrallypoint.com/'),source_checked_at=now(),updated_at=now()
where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='b-s-rally-point';

update businesses
set website='https://bobandringossmokehouse.com/',source_name=coalesce(source_name,'Official business website'),source_url=coalesce(source_url,'https://bobandringossmokehouse.com/'),source_checked_at=now(),updated_at=now()
where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='bob-ringo-s-grill-smokehouse';

update guides set body=$body$
Shopping secondhand in Pontiac can mean different things depending on the store. Some resale shops are community or charity focused, while others may emphasize clothing, household goods, furniture, collectibles or a changing mix of donated inventory. The most useful comparison starts with what you actually need and how much flexibility you have on brand, size, condition and timing.

## Start with the type of item you need

If you are shopping for clothing, furniture, housewares, seasonal items or collectibles, do not assume every thrift or consignment store carries the same mix. Inventory changes frequently, so a store that was a good fit last month may have a very different selection today. Calling ahead can save time when you need a particular size, item type or larger piece of furniture.

Browse [Thrift & Consignment stores in Pontiac](/illinois/pontiac/thrift-consignment) to compare the published local profiles currently connected to this market.

## Understand thrift, resale and consignment differences

A thrift or charity resale store often relies on donated merchandise. A consignment model may accept items from individual sellers and share proceeds when those items sell. Other resale shops use their own buying model. Policies vary, so ask the individual business how it accepts merchandise, whether it offers store credit or cash, and what categories it is currently taking.

## Compare condition and return policies

Secondhand merchandise is usually sold with more variation in condition than new retail. Inspect clothing, furniture, electronics, toys and household items carefully before purchase. Ask about testing, returns, exchanges or final-sale policies when that matters to your decision. Do not assume policies are identical from one store to another.

## Community and charity resale

Some Pontiac thrift stores use resale revenue to support charitable or community programs. If that matters to you, review the organization’s current mission and store information before visiting. Supporting a mission can be part of the shopping decision, but it is separate from comparing inventory, price and convenience.

## Plan an efficient local shopping trip

If you are visiting more than one store, compare addresses and current hours before leaving. Downtown and neighborhood locations can have different parking or loading considerations, especially if you are shopping for larger items. For furniture or bulky purchases, ask whether pickup deadlines or loading assistance apply.

## What to verify before you go

A practical checklist includes:

- current store hours
- the merchandise category you need
- donation or consignment acceptance rules
- return or final-sale policy
- payment methods
- furniture or large-item pickup rules
- accessibility or parking needs
- whether a specific item is still in stock

Use Central Illinois Local Pros to compare published contact information, location details and business profiles. Claimed ownership, verification and paid Featured placement are separate states. Sponsored visibility is labeled and does not determine organic relevance. Because secondhand inventory can change quickly, verify time-sensitive details directly with the store before making a special trip.
$body$,updated_at=now()
where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='compare-thrift-consignment-pontiac-il';

update guides set body=$body$
Pontiac toy and game shopping includes several different specialty formats. A store may focus on board games, trading cards, collectibles, outdoor recreation, classic toys or a mix of hobby products. The best place to shop depends on whether you are buying for a child, a collector, a game night, a gift or a specific hobby.

## Know what you are shopping for

Start with the product type instead of treating every toy or game store as interchangeable. If you need a specific board game, trading-card release, collectible figure, doll, puzzle or specialty toy, check current availability before making a special trip. Small specialty stores can have excellent selections, but individual products may sell through quickly.

Browse [Toy & Game stores in Pontiac](/illinois/pontiac/toys-games) to compare published local profiles connected to the Pontiac market.

## Compare the shopping experience

A conventional toy store, a hobby or trading-card shop and a collectible-focused destination can serve very different shoppers. Think about whether you want quick retail convenience, staff knowledge about a hobby, opportunities to browse unusual products, or an experience that is part shopping and part local attraction.

## Ask about age range and difficulty

When buying games for children or families, compare the manufacturer’s recommended age, expected play time, number of players and complexity. For gifts, it can help to know what the recipient already owns and what types of games they enjoy. Store staff may be able to explain differences between products, but final suitability decisions belong to the buyer.

## Collectibles and trading cards need extra verification

For collectible products, condition, edition, authenticity and packaging can affect value. Ask the seller how an item is described and whether returns apply before purchasing something expensive. For sealed trading-card or collectible products, verify the exact set or release rather than relying only on a product photo.

## Plan for events, special orders and inventory changes

Some hobby-oriented stores may offer events, organized play, special orders or product holds, while others operate strictly as retail shops. These services can change. Contact the business directly if an event schedule, preorder, special order or time-sensitive product is important to your visit.

## Quick comparison checklist

Before choosing a store, consider:

- product type and age range
- current inventory
- hobby or collector specialization
- price and return policy
- condition of collectible items
- special-order or preorder options
- current store hours
- parking and location convenience
- whether events or organized play are currently offered

Central Illinois Local Pros is a discovery directory. Claimed ownership, verification and paid Featured placement are separate signals, and sponsored visibility does not buy organic rank. Use the directory to build a shortlist, then verify current inventory, policies and event information directly with the business.
$body$,updated_at=now()
where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='compare-toys-games-pontiac-il';

update guides
set summary='A practical Champaign guide for comparing steakhouses by occasion, menu range, reservations, dietary needs and likely total meal cost.',updated_at=now()
where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and slug='champaign-steakhouse-guide';
