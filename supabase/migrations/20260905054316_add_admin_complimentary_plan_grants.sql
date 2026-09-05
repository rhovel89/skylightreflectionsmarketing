create table if not exists public.business_plan_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  grant_kind text not null check (grant_kind in ('trial','permanent')),
  starts_on date not null default ((now() at time zone 'America/Chicago')::date),
  ends_on date,
  status text not null default 'active' check (status in ('active','revoked')),
  admin_note text,
  granted_by uuid not null references auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_plan_grants_dates check (
    (grant_kind='trial' and ends_on is not null and ends_on >= starts_on)
    or (grant_kind='permanent' and ends_on is null)
  )
);

create unique index if not exists business_plan_grants_one_open_grant_per_business on public.business_plan_grants(business_id) where status='active';
create index if not exists business_plan_grants_tenant_business_idx on public.business_plan_grants(tenant_id,business_id,created_at desc);
create index if not exists business_plan_grants_plan_idx on public.business_plan_grants(plan_id);

create or replace function private.validate_business_plan_grant()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_business_tenant uuid; v_plan_tenant uuid; v_plan_slug text;
begin
  select tenant_id into v_business_tenant from public.businesses where id=new.business_id;
  if v_business_tenant is null then raise exception 'business_not_found'; end if;
  select tenant_id,slug into v_plan_tenant,v_plan_slug from public.plans where id=new.plan_id and is_active=true;
  if v_plan_tenant is null then raise exception 'plan_not_found'; end if;
  if new.tenant_id<>v_business_tenant or new.tenant_id<>v_plan_tenant then raise exception 'tenant_mismatch'; end if;
  if v_plan_slug not in ('featured','pro') then raise exception 'only_featured_or_pro_can_be_granted'; end if;
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists validate_business_plan_grant on public.business_plan_grants;
create trigger validate_business_plan_grant before insert or update on public.business_plan_grants for each row execute function private.validate_business_plan_grant();

alter table public.business_plan_grants enable row level security;
drop policy if exists "admins manage business plan grants" on public.business_plan_grants;
create policy "admins manage business plan grants" on public.business_plan_grants for all to authenticated
using (private.has_tenant_role(tenant_id,array['admin','super_admin']::text[]))
with check (private.has_tenant_role(tenant_id,array['admin','super_admin']::text[]));

create or replace function private.business_effective_plan_access(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_tenant uuid;
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_base_plan public.plans%rowtype;
  v_base_subscription public.subscriptions%rowtype;
  v_grant public.business_plan_grants%rowtype;
  v_grant_plan public.plans%rowtype;
  v_effective_plan public.plans%rowtype;
  v_source text := 'free';
  v_grant_state text := 'none';
  v_grant_applied boolean := false;
begin
  select tenant_id into v_tenant from public.businesses where id=p_business_id;
  if v_tenant is null then
    return jsonb_build_object('effective_plan_slug','free','effective_plan_name','Free','effective_entitlements','{}'::jsonb,'access_source','free','base_plan_slug','free','base_plan_name','Free','grant_state','none','grant_applied',false);
  end if;
  select s.* into v_base_subscription from public.subscriptions s join public.plans p on p.id=s.plan_id
  where s.business_id=p_business_id and s.status in ('active','trialing','past_due') and p.is_active=true and s.starts_at<=now() and (s.ends_at is null or s.ends_at>now())
  order by s.updated_at desc,p.sort_order desc nulls last limit 1;
  if v_base_subscription.id is not null then
    select * into v_base_plan from public.plans where id=v_base_subscription.plan_id;
    v_source:='paid_subscription';
  else
    select * into v_base_plan from public.plans where tenant_id=v_tenant and slug='free' and is_active=true order by sort_order limit 1;
    if v_base_plan.id is null then v_base_plan.slug:='free'; v_base_plan.name:='Free'; v_base_plan.sort_order:=0; v_base_plan.entitlements:='{}'::jsonb; end if;
  end if;
  select * into v_grant from public.business_plan_grants where business_id=p_business_id and status='active' order by created_at desc limit 1;
  if v_grant.id is not null then
    select * into v_grant_plan from public.plans where id=v_grant.plan_id and is_active=true;
    if v_today < v_grant.starts_on then v_grant_state:='scheduled';
    elsif v_grant.ends_on is not null and v_today > v_grant.ends_on then v_grant_state:='expired';
    else v_grant_state:='active'; end if;
  end if;
  v_effective_plan:=v_base_plan;
  if v_grant_state='active' and v_grant_plan.id is not null and coalesce(v_grant_plan.sort_order,0)>coalesce(v_base_plan.sort_order,0) then
    v_effective_plan:=v_grant_plan;
    v_source:=case when v_grant.grant_kind='trial' then 'admin_trial' else 'admin_complimentary' end;
    v_grant_applied:=true;
  end if;
  return jsonb_build_object(
    'effective_plan_id',v_effective_plan.id,'effective_plan_slug',coalesce(v_effective_plan.slug,'free'),'effective_plan_name',coalesce(v_effective_plan.name,'Free'),'effective_entitlements',coalesce(v_effective_plan.entitlements,'{}'::jsonb),'access_source',v_source,
    'base_plan_id',v_base_plan.id,'base_plan_slug',coalesce(v_base_plan.slug,'free'),'base_plan_name',coalesce(v_base_plan.name,'Free'),'base_subscription_id',v_base_subscription.id,'base_subscription_status',v_base_subscription.status,'base_subscription_ends_at',v_base_subscription.ends_at,
    'grant_id',v_grant.id,'grant_plan_id',v_grant_plan.id,'grant_plan_slug',v_grant_plan.slug,'grant_plan_name',v_grant_plan.name,'grant_kind',v_grant.grant_kind,'grant_starts_on',v_grant.starts_on,'grant_ends_on',v_grant.ends_on,'grant_state',v_grant_state,'grant_applied',v_grant_applied,'grant_note',v_grant.admin_note
  );
end $$;

create or replace function public.get_business_plan_access(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_tenant uuid; v_owner boolean; v_staff boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select tenant_id into v_tenant from public.businesses where id=p_business_id;
  if v_tenant is null then raise exception 'business_not_found'; end if;
  select exists(select 1 from public.business_owners where business_id=p_business_id and user_id=auth.uid()) into v_owner;
  select private.has_tenant_role(v_tenant,array['staff','admin','super_admin']::text[]) into v_staff;
  if not v_owner and not v_staff then raise exception 'insufficient_privilege'; end if;
  return private.business_effective_plan_access(p_business_id);
end $$;

create or replace function private.business_active_plan_slug(p_business_id uuid)
returns text language sql stable security definer set search_path=''
as $$ select coalesce(private.business_effective_plan_access(p_business_id)->>'effective_plan_slug','free'); $$;

create or replace function private.business_paid_media_entitlements(p_business_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
  with a as (select private.business_effective_plan_access(p_business_id) as j)
  select jsonb_build_object('plan_slug',coalesce(j->>'effective_plan_slug','free'),'max_gallery_images',coalesce((j->'effective_entitlements'->>'max_gallery_images')::int,0),'menu_upload',coalesce((j->'effective_entitlements'->>'menu_upload')::boolean,false)) from a;
$$;

create or replace function public.admin_set_business_plan_grant(p_business_id uuid,p_plan_slug text,p_grant_kind text,p_starts_on date,p_ends_on date default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_tenant uuid; v_business_name text; v_plan public.plans%rowtype; v_grant_id uuid; v_today date := (now() at time zone 'America/Chicago')::date; v_start date:=coalesce(p_starts_on,(now() at time zone 'America/Chicago')::date); v_kind text:=lower(trim(coalesce(p_grant_kind,'')));
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  select tenant_id,name into v_tenant,v_business_name from public.businesses where id=p_business_id;
  if v_tenant is null then raise exception 'business_not_found'; end if;
  if not private.has_tenant_role(v_tenant,array['admin','super_admin']::text[]) then raise exception 'insufficient_privilege'; end if;
  select * into v_plan from public.plans where tenant_id=v_tenant and slug=lower(trim(coalesce(p_plan_slug,''))) and slug in('featured','pro') and is_active=true limit 1;
  if v_plan.id is null then raise exception 'invalid_grant_plan'; end if;
  if v_kind not in('trial','permanent') then raise exception 'invalid_grant_kind'; end if;
  if v_kind='trial' and (p_ends_on is null or p_ends_on<v_start) then raise exception 'trial_end_date_required'; end if;
  if v_kind='permanent' then p_ends_on:=null; end if;
  update public.business_plan_grants set status='revoked',revoked_at=now(),revoked_by=v_actor,updated_at=now() where business_id=p_business_id and status='active';
  insert into public.business_plan_grants(tenant_id,business_id,plan_id,grant_kind,starts_on,ends_on,status,admin_note,granted_by)
  values(v_tenant,p_business_id,v_plan.id,v_kind,v_start,p_ends_on,'active',nullif(trim(coalesce(p_note,'')),''),v_actor) returning id into v_grant_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,v_actor,'admin_plan_access_granted','Granted '||v_plan.name||' complimentary '||v_kind||' access to business '||p_business_id::text||' ('||v_business_name||') starting '||v_start::text||case when p_ends_on is not null then ' through '||p_ends_on::text else ' with no end date' end||'. This is an entitlement grant, not a payment, verification, or organic-ranking action.');
  perform private.notify_business_owners_event(v_tenant,p_business_id,'plan_grant:'||v_grant_id::text,case when v_kind='trial' then v_plan.name||' trial access added' else v_plan.name||' complimentary access added' end,case when v_start>v_today then 'Your complimentary '||v_plan.name||' access is scheduled to begin on '||v_start::text||'.' else 'Your business now has complimentary '||v_plan.name||' plan access.' end||case when p_ends_on is not null then ' It runs through '||p_ends_on::text||' and then returns to your underlying plan automatically.' else ' This access has no scheduled end date.' end||' This does not change directory verification or organic ranking.','/business-portal/subscription?business='||p_business_id::text);
  return jsonb_build_object('ok',true,'grant_id',v_grant_id,'access',private.business_effective_plan_access(p_business_id));
end $$;

create or replace function public.admin_revoke_business_plan_grant(p_grant_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_grant public.business_plan_grants%rowtype; v_business_name text; v_plan_name text;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  select * into v_grant from public.business_plan_grants where id=p_grant_id for update;
  if v_grant.id is null then raise exception 'grant_not_found'; end if;
  if not private.has_tenant_role(v_grant.tenant_id,array['admin','super_admin']::text[]) then raise exception 'insufficient_privilege'; end if;
  select name into v_business_name from public.businesses where id=v_grant.business_id;
  select name into v_plan_name from public.plans where id=v_grant.plan_id;
  if v_grant.status='active' then
    update public.business_plan_grants set status='revoked',revoked_at=now(),revoked_by=v_actor,admin_note=coalesce(nullif(trim(coalesce(p_note,'')),''),admin_note),updated_at=now() where id=p_grant_id;
    insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_grant.tenant_id,v_actor,'admin_plan_access_revoked','Revoked complimentary '||coalesce(v_plan_name,'plan')||' access grant '||p_grant_id::text||' for business '||v_grant.business_id::text||' ('||coalesce(v_business_name,'business')||'). Effective access now falls back to the underlying paid plan or Free.');
    perform private.notify_business_owners_event(v_grant.tenant_id,v_grant.business_id,'plan_grant_revoked:'||p_grant_id::text,'Complimentary plan access ended','The complimentary '||coalesce(v_plan_name,'plan')||' access on your business was ended. Your account now uses its underlying paid plan or Free plan access. Verification and organic ranking are unchanged.','/business-portal/subscription?business='||v_grant.business_id::text);
  end if;
  return jsonb_build_object('ok',true,'grant_id',p_grant_id,'access',private.business_effective_plan_access(v_grant.business_id));
end $$;

revoke all on function public.get_business_plan_access(uuid) from anon;
grant execute on function public.get_business_plan_access(uuid) to authenticated;
revoke all on function public.admin_set_business_plan_grant(uuid,text,text,date,date,text) from anon;
grant execute on function public.admin_set_business_plan_grant(uuid,text,text,date,date,text) to authenticated;
revoke all on function public.admin_revoke_business_plan_grant(uuid,text) from anon;
grant execute on function public.admin_revoke_business_plan_grant(uuid,text) to authenticated;
