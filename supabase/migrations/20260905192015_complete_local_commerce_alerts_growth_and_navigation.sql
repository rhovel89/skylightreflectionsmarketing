-- Complete Local Commerce integration: deduped consumer alerts, commerce growth intelligence, and public navigation.

create table if not exists public.consumer_local_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  preference_id uuid not null references public.consumer_local_alert_preferences(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null check (alert_type in ('deals','new_businesses','local_updates')),
  event_key text not null,
  business_id uuid references public.businesses(id) on delete cascade,
  notification_created boolean not null default false,
  email_queued boolean not null default false,
  created_at timestamptz not null default now(),
  unique(preference_id,event_key)
);
create index if not exists consumer_local_alert_deliveries_user_idx on public.consumer_local_alert_deliveries(user_id,created_at desc);
create index if not exists consumer_local_alert_deliveries_tenant_idx on public.consumer_local_alert_deliveries(tenant_id,alert_type,created_at desc);
alter table public.consumer_local_alert_deliveries enable row level security;
drop policy if exists "local alert deliveries owner read" on public.consumer_local_alert_deliveries;
create policy "local alert deliveries owner read" on public.consumer_local_alert_deliveries for select to authenticated using (
  user_id=auth.uid() or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
grant select on public.consumer_local_alert_deliveries to authenticated;
revoke insert,update,delete on public.consumer_local_alert_deliveries from anon,authenticated;

create or replace function private.deliver_local_alert_event(
  p_tenant_id uuid,
  p_alert_type text,
  p_event_key text,
  p_business_id uuid,
  p_title text,
  p_body text,
  p_action_url text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r record;
  v_delivery_id uuid;
  v_notifications integer:=0;
  v_emails integer:=0;
  v_deliveries integer:=0;
begin
  if p_alert_type not in ('deals','new_businesses','local_updates') then raise exception 'invalid_alert_type'; end if;
  if p_business_id is null or not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'business_not_found'; end if;

  for r in
    select pref.id preference_id,pref.user_id,pref.email_enabled,pref.in_app_enabled,
           u.email,coalesce(nullif(pr.display_name,''),'Local Pros member') recipient_name
    from public.consumer_local_alert_preferences pref
    join auth.users u on u.id=pref.user_id
    left join public.profiles pr on pr.id=pref.user_id
    where pref.tenant_id=p_tenant_id and pref.active and pref.alert_type=p_alert_type
      and (
        pref.location_id is null
        or exists(select 1 from public.business_locations bl where bl.business_id=p_business_id and bl.location_id=pref.location_id and bl.is_active)
        or exists(select 1 from public.business_service_areas sa where sa.business_id=p_business_id and sa.location_id=pref.location_id)
      )
      and (
        pref.category_id is null
        or exists(select 1 from public.business_categories bc where bc.business_id=p_business_id and bc.category_id=pref.category_id)
      )
  loop
    v_delivery_id:=null;
    insert into public.consumer_local_alert_deliveries(tenant_id,preference_id,user_id,alert_type,event_key,business_id)
    values(p_tenant_id,r.preference_id,r.user_id,p_alert_type,left(p_event_key,220),p_business_id)
    on conflict(preference_id,event_key) do nothing
    returning id into v_delivery_id;
    if v_delivery_id is null then continue; end if;
    v_deliveries:=v_deliveries+1;

    if r.in_app_enabled then
      insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key,created_at)
      values(r.user_id,p_tenant_id,left(p_title,160),left(p_body,1200),p_action_url,'local_alert:'||v_delivery_id::text,now())
      on conflict(user_id,event_key) where event_key is not null do nothing;
      update public.consumer_local_alert_deliveries set notification_created=true where id=v_delivery_id;
      v_notifications:=v_notifications+1;
    end if;

    if r.email_enabled and nullif(trim(coalesce(r.email,'')),'') is not null then
      insert into public.email_outbox(
        tenant_id,business_id,recipient_email,recipient_name,message_type,template_key,
        subject,body,cta_label,cta_url,status,scheduled_for
      ) values(
        p_tenant_id,p_business_id,r.email,r.recipient_name,'transactional','consumer_local_alert',
        left(p_title,200),left(p_body,5000),'View Local Update',p_action_url,'queued',now()
      );
      update public.consumer_local_alert_deliveries set email_queued=true where id=v_delivery_id;
      v_emails:=v_emails+1;
    end if;
  end loop;

  return jsonb_build_object('deliveries',v_deliveries,'notifications',v_notifications,'emails_queued',v_emails,'event_key',p_event_key);
end $$;
revoke all on function private.deliver_local_alert_event(uuid,text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.deliver_local_alert_event(uuid,text,text,uuid,text,text,text) to service_role;

create or replace function private.local_alert_deal_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;v_slug text;
begin
  if new.status='approved' and (tg_op='INSERT' or old.status is distinct from new.status) then
    select name,slug into v_name,v_slug from public.businesses where id=new.business_id;
    perform private.deliver_local_alert_event(new.tenant_id,'deals','deal:'||new.id::text,new.business_id,
      'New local deal from '||coalesce(v_name,'a local business'),
      left(coalesce(new.title,'New local offer')||case when nullif(trim(coalesce(new.details,'')),'') is not null then ' — '||new.details else '' end,1200),
      '/business/'||coalesce(v_slug,'')||'/community');
  end if;
  return new;
end $$;
revoke all on function private.local_alert_deal_trigger() from public,anon,authenticated;
drop trigger if exists local_alert_on_deal_approval on public.business_deals;
create trigger local_alert_on_deal_approval after insert or update of status on public.business_deals for each row execute function private.local_alert_deal_trigger();

create or replace function private.local_alert_business_publish_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='published' and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform private.deliver_local_alert_event(new.tenant_id,'new_businesses','business:'||new.id::text,new.id,
      'New local business published: '||new.name,
      left(new.name||' is now published on Central Illinois Local Pros. View the listing for current services, contact details and trust signals.',1200),
      '/business/'||new.slug);
  end if;
  return new;
end $$;
revoke all on function private.local_alert_business_publish_trigger() from public,anon,authenticated;
drop trigger if exists local_alert_on_business_publish on public.businesses;
create trigger local_alert_on_business_publish after insert or update of status on public.businesses for each row execute function private.local_alert_business_publish_trigger();

create or replace function private.local_alert_portfolio_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;v_slug text;
begin
  if new.status='approved' and (tg_op='INSERT' or old.status is distinct from new.status) then
    select name,slug into v_name,v_slug from public.businesses where id=new.business_id;
    perform private.deliver_local_alert_event(new.tenant_id,'local_updates','portfolio:'||new.id::text,new.business_id,
      'New project update from '||coalesce(v_name,'a local business'),
      left(coalesce(new.title,'New project')||case when nullif(trim(coalesce(new.summary,'')),'') is not null then ' — '||new.summary else '' end,1200),
      '/business/'||coalesce(v_slug,'')||'/community');
  end if;
  return new;
end $$;
revoke all on function private.local_alert_portfolio_trigger() from public,anon,authenticated;
drop trigger if exists local_alert_on_portfolio_approval on public.business_portfolio_projects;
create trigger local_alert_on_portfolio_approval after insert or update of status on public.business_portfolio_projects for each row execute function private.local_alert_portfolio_trigger();

create or replace function private.sync_local_commerce_growth_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_upserted integer:=0;v_resolved integer:=0;
begin
  with usage as (
    select b.id business_id,b.name,private.business_active_plan_slug(b.id) plan_slug,
      (select count(*) from public.business_deals d where d.business_id=b.id and d.status<>'rejected') deal_count,
      (select count(*) from public.business_catalog_items c where c.business_id=b.id and c.status<>'rejected') catalog_count,
      (select count(*) from public.business_portfolio_projects p where p.business_id=b.id and p.status<>'rejected') portfolio_count,
      (select count(*) from public.business_availability a where a.business_id=b.id and (a.expires_at is null or a.expires_at>=now())) availability_count,
      (select count(*) from public.business_recommendations r where r.business_id=b.id and r.status='approved') local_faves
    from public.businesses b
    where b.tenant_id=p_tenant_id and b.status='published' and b.claimed
  ), eligible as (
    select *,
      case when plan_slug='pro' then (case when deal_count>0 then 1 else 0 end)+(case when catalog_count>0 then 1 else 0 end)+(case when portfolio_count>0 then 1 else 0 end)+(case when availability_count>0 then 1 else 0 end)
           when plan_slug='featured' then (case when deal_count>0 then 1 else 0 end)
           else 99 end activation_count
    from usage
    where plan_slug in ('featured','pro')
  ), upserted as (
    insert into public.growth_opportunities(
      tenant_id,opportunity_key,opportunity_type,business_id,title,detail,score,estimated_monthly_value_cents,status,next_action,due_at,source_facts,last_refreshed_at,updated_at
    )
    select p_tenant_id,'commerce:'||e.business_id::text,'skylight_marketing',e.business_id,
      'Local Commerce activation · '||e.name,
      case when e.plan_slug='pro' then 'This Pro business has Local Commerce tools available but is using fewer than two of Deals, structured offerings, portfolio projects and current availability. This is a private onboarding/growth signal only and does not affect organic rank.'
           else 'This Featured business can publish moderated Local Deals but has not created one yet. This is a private product-activation signal only and does not affect organic rank.' end,
      case when e.plan_slug='pro' and e.activation_count=0 then 82 when e.plan_slug='pro' then 74 else 66 end,
      0,'open',
      case when e.plan_slug='pro' then 'Review whether the owner needs help activating Deals, structured offerings, portfolio projects or availability. If separate Skylight marketing services are relevant, present them factually and independently from directory ranking.'
           else 'Help the owner publish a useful moderated Local Deal if it fits the business. Do not imply that using the feature changes verification or organic rank.' end,
      now(),
      jsonb_build_object('plan_slug',e.plan_slug,'deal_count',e.deal_count,'catalog_count',e.catalog_count,'portfolio_count',e.portfolio_count,'availability_count',e.availability_count,'local_faves',e.local_faves,'activation_count',e.activation_count),
      now(),now()
    from eligible e
    where (e.plan_slug='pro' and e.activation_count<2) or (e.plan_slug='featured' and e.deal_count=0)
    on conflict(tenant_id,opportunity_key) do update set
      opportunity_type=excluded.opportunity_type,business_id=excluded.business_id,title=excluded.title,detail=excluded.detail,score=excluded.score,
      estimated_monthly_value_cents=excluded.estimated_monthly_value_cents,status=case when public.growth_opportunities.status='in_progress' then 'in_progress' else 'open' end,
      next_action=excluded.next_action,due_at=excluded.due_at,source_facts=excluded.source_facts,last_refreshed_at=now(),updated_at=now()
    returning opportunity_key
  ) select count(*) into v_upserted from upserted;

  update public.growth_opportunities g
  set status='resolved',updated_at=now(),last_refreshed_at=now(),source_facts=coalesce(g.source_facts,'{}'::jsonb)||jsonb_build_object('resolved_reason','commerce_activation_complete')
  where g.tenant_id=p_tenant_id and g.opportunity_key like 'commerce:%' and g.status<>'resolved'
    and not exists(
      select 1 from public.businesses b
      where b.id=g.business_id and b.tenant_id=p_tenant_id and b.status='published' and b.claimed
        and (
          (private.business_active_plan_slug(b.id)='featured' and not exists(select 1 from public.business_deals d where d.business_id=b.id and d.status<>'rejected'))
          or
          (private.business_active_plan_slug(b.id)='pro' and (
            (case when exists(select 1 from public.business_deals d where d.business_id=b.id and d.status<>'rejected') then 1 else 0 end)+
            (case when exists(select 1 from public.business_catalog_items c where c.business_id=b.id and c.status<>'rejected') then 1 else 0 end)+
            (case when exists(select 1 from public.business_portfolio_projects p where p.business_id=b.id and p.status<>'rejected') then 1 else 0 end)+
            (case when exists(select 1 from public.business_availability a where a.business_id=b.id and (a.expires_at is null or a.expires_at>=now())) then 1 else 0 end)
          )<2)
        )
    );
  get diagnostics v_resolved=row_count;
  return jsonb_build_object('tenant_id',p_tenant_id,'commerce_upserted',v_upserted,'commerce_resolved',v_resolved,'synced_at',now());
end $$;
revoke all on function private.sync_local_commerce_growth_opportunities(uuid) from public,anon,authenticated;
grant execute on function private.sync_local_commerce_growth_opportunities(uuid) to service_role;

create or replace function private.local_commerce_growth_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;
begin
  v_tenant:=coalesce(new.tenant_id,old.tenant_id);
  if v_tenant is not null then perform private.sync_local_commerce_growth_opportunities(v_tenant); end if;
  return coalesce(new,old);
end $$;
revoke all on function private.local_commerce_growth_trigger() from public,anon,authenticated;

drop trigger if exists growth_sync_on_deals on public.business_deals;
create trigger growth_sync_on_deals after insert or update or delete on public.business_deals for each row execute function private.local_commerce_growth_trigger();
drop trigger if exists growth_sync_on_catalog on public.business_catalog_items;
create trigger growth_sync_on_catalog after insert or update or delete on public.business_catalog_items for each row execute function private.local_commerce_growth_trigger();
drop trigger if exists growth_sync_on_portfolio on public.business_portfolio_projects;
create trigger growth_sync_on_portfolio after insert or update or delete on public.business_portfolio_projects for each row execute function private.local_commerce_growth_trigger();
drop trigger if exists growth_sync_on_availability on public.business_availability;
create trigger growth_sync_on_availability after insert or update or delete on public.business_availability for each row execute function private.local_commerce_growth_trigger();

create or replace function private.refresh_all_growth_opportunities()
returns integer language plpgsql security definer set search_path='' as $$
declare r record;n integer:=0;
begin
  for r in select distinct tenant_id from public.businesses where tenant_id is not null loop
    perform private.ensure_acquisition_research_prospects(r.tenant_id);
    perform private.refresh_growth_opportunities(r.tenant_id);
    perform private.sync_explicit_lead_buyer_opportunities(r.tenant_id);
    perform private.sync_local_commerce_growth_opportunities(r.tenant_id);
    perform private.sync_growth_outreach_tasks(r.tenant_id);
    n:=n+1;
  end loop;
  return n;
end $$;
revoke all on function private.refresh_all_growth_opportunities() from public,anon,authenticated;
grant execute on function private.refresh_all_growth_opportunities() to service_role;

-- Public navigation for the new consumer surfaces. Admin can continue editing these records from Navigation Editor.
insert into public.navigation_items(tenant_id,menu_key,label,href,sort_order,is_visible)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'header','Get Quotes','/project-match',15,true
where not exists(select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and menu_key='header' and href='/project-match');
insert into public.navigation_items(tenant_id,menu_key,label,href,sort_order,is_visible)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'header','Local Deals','/deals',65,true
where not exists(select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and menu_key='header' and href='/deals');
insert into public.navigation_items(tenant_id,menu_key,label,href,sort_order,is_visible)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'footer_explore','Get Quotes','/project-match',15,true
where not exists(select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and menu_key='footer_explore' and href='/project-match');
insert into public.navigation_items(tenant_id,menu_key,label,href,sort_order,is_visible)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'footer_explore','Local Deals','/deals',25,true
where not exists(select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and menu_key='footer_explore' and href='/deals');

select private.sync_local_commerce_growth_opportunities('6673621d-b359-4c17-a984-c8f50d914eb3'::uuid);
