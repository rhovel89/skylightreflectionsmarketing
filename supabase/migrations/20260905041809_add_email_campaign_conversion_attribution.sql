alter table public.email_drip_campaigns add column if not exists conversion_goal text not null default 'any_inquiry';

do $$ begin
  if not exists(select 1 from pg_constraint where conname='email_drip_campaigns_conversion_goal_check') then
    alter table public.email_drip_campaigns add constraint email_drip_campaigns_conversion_goal_check check (conversion_goal in ('any_inquiry','sponsored_inquiry','skylight_inquiry'));
  end if;
end $$;

update public.email_drip_campaigns
set conversion_goal=case campaign_goal when 'sponsored' then 'sponsored_inquiry' when 'skylight_growth' then 'skylight_inquiry' else 'any_inquiry' end
where conversion_goal='any_inquiry';

alter table public.email_outbox add column if not exists preheader text;
alter table public.email_outbox add column if not exists conversion_count integer not null default 0;
alter table public.email_outbox add column if not exists first_converted_at timestamptz;

create or replace function public.fill_email_outbox_preheader()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.preheader is null and new.step_id is not null then
    select s.preheader into new.preheader from public.email_drip_steps s where s.id=new.step_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fill_email_outbox_preheader on public.email_outbox;
create trigger trg_fill_email_outbox_preheader before insert or update of step_id on public.email_outbox for each row execute function public.fill_email_outbox_preheader();

create table if not exists public.email_campaign_conversions(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.email_drip_campaigns(id) on delete cascade,
  enrollment_id uuid references public.email_drip_enrollments(id) on delete set null,
  step_id uuid references public.email_drip_steps(id) on delete set null,
  outbox_id uuid not null references public.email_outbox(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  marketing_lead_id uuid unique references public.marketing_leads(id) on delete set null,
  recipient_email text not null,
  conversion_type text not null check (conversion_type in ('sponsored_inquiry','skylight_inquiry','marketing_inquiry')),
  attribution_model text not null default 'same_email_last_click_30d',
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists email_campaign_conversions_campaign_time_idx on public.email_campaign_conversions(campaign_id,occurred_at desc);
create index if not exists email_campaign_conversions_outbox_idx on public.email_campaign_conversions(outbox_id);
create index if not exists email_campaign_conversions_type_idx on public.email_campaign_conversions(tenant_id,conversion_type,occurred_at desc);

alter table public.email_campaign_conversions enable row level security;
drop policy if exists "tenant staff manage email campaign conversions" on public.email_campaign_conversions;
create policy "tenant staff manage email campaign conversions" on public.email_campaign_conversions for all to authenticated using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']::text[])) with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']::text[]));

create or replace function public.attribute_email_campaign_conversion_from_lead()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_outbox public.email_outbox%rowtype;
  v_type text;
  v_conversion_id uuid;
begin
  if new.tenant_id is null or nullif(trim(coalesce(new.email,'')),'') is null then return new; end if;

  select o.* into v_outbox
  from public.email_outbox o
  where o.tenant_id=new.tenant_id
    and o.message_type='drip'
    and o.status='sent'
    and o.campaign_id is not null
    and lower(trim(o.recipient_email))=lower(trim(new.email))
    and coalesce(o.click_count,0)>0
    and o.last_clicked_at is not null
    and o.last_clicked_at <= coalesce(new.created_at,now())
    and o.last_clicked_at >= coalesce(new.created_at,now()) - interval '30 days'
  order by o.last_clicked_at desc
  limit 1;

  if v_outbox.id is null then return new; end if;

  v_type:=case
    when new.plan_interest in ('sponsorship','featured','pro','verified') or new.service_interest='Directory Visibility / Sponsorship' then 'sponsored_inquiry'
    when new.plan_interest='marketing_review' or new.service_interest in ('Website Design / Redesign','Local SEO','Google Business Profile','Social Media Management','Branding / Graphic Design','Lead Generation','Full Digital Marketing Review') then 'skylight_inquiry'
    else 'marketing_inquiry'
  end;

  insert into public.email_campaign_conversions(tenant_id,campaign_id,enrollment_id,step_id,outbox_id,business_id,marketing_lead_id,recipient_email,conversion_type,occurred_at,metadata)
  values(new.tenant_id,v_outbox.campaign_id,v_outbox.enrollment_id,v_outbox.step_id,v_outbox.id,v_outbox.business_id,new.id,lower(trim(new.email)),v_type,coalesce(new.created_at,now()),jsonb_build_object('plan_interest',new.plan_interest,'service_interest',new.service_interest,'source',new.source,'landing_path',new.landing_path))
  on conflict(marketing_lead_id) do nothing
  returning id into v_conversion_id;

  if v_conversion_id is not null then
    update public.email_outbox set conversion_count=conversion_count+1,first_converted_at=coalesce(first_converted_at,coalesce(new.created_at,now())),updated_at=now() where id=v_outbox.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attribute_email_campaign_conversion on public.marketing_leads;
create trigger trg_attribute_email_campaign_conversion after insert on public.marketing_leads for each row execute function public.attribute_email_campaign_conversion_from_lead();
