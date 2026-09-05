create or replace function public.admin_set_business_plan_grant(
  p_business_id uuid,
  p_plan_slug text,
  p_grant_kind text,
  p_starts_on date,
  p_ends_on date default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_tenant uuid; v_business_name text; v_plan public.plans%rowtype; v_grant_id uuid;
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_start date:=coalesce(p_starts_on,(now() at time zone 'America/Chicago')::date);
  v_kind text:=lower(trim(coalesce(p_grant_kind,'')));
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

  update public.business_plan_grants
    set status='revoked',revoked_at=now(),revoked_by=v_actor,updated_at=now()
    where business_id=p_business_id and status='active';
  update public.sponsorships
    set active=false,updated_at=now()
    where business_id=p_business_id and provider='admin_grant' and active=true;

  insert into public.business_plan_grants(tenant_id,business_id,plan_id,grant_kind,starts_on,ends_on,status,admin_note,granted_by)
  values(v_tenant,p_business_id,v_plan.id,v_kind,v_start,p_ends_on,'active',nullif(trim(coalesce(p_note,'')),''),v_actor)
  returning id into v_grant_id;

  insert into public.sponsorships(tenant_id,business_id,placement,starts_on,ends_on,active,provider,provider_subscription_id,origin,priority,sort_order,rotation_weight,updated_at)
  values(v_tenant,p_business_id,'homepage_featured',v_start,p_ends_on,true,'admin_grant',v_grant_id::text,'promotional',case when v_plan.slug='pro' then 200 else 150 end,100,1,now());

  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
  values(v_tenant,v_actor,'admin_plan_access_granted',
    'Granted '||v_plan.name||' complimentary '||v_kind||' access to business '||p_business_id::text||' ('||v_business_name||') starting '||v_start::text||case when p_ends_on is not null then ' through '||p_ends_on::text else ' with no end date' end||'. Includes the plan promotional Featured placement for the same dates. This is an entitlement grant, not a payment, verification, or organic-ranking action.');

  perform private.notify_business_owners_event(v_tenant,p_business_id,'plan_grant:'||v_grant_id::text,
    case when v_kind='trial' then v_plan.name||' trial access added' else v_plan.name||' complimentary access added' end,
    case when v_start>v_today then 'Your complimentary '||v_plan.name||' access is scheduled to begin on '||v_start::text||'.' else 'Your business now has complimentary '||v_plan.name||' plan access.' end||case when p_ends_on is not null then ' It runs through '||p_ends_on::text||' and then returns to your underlying plan automatically.' else ' This access has no scheduled end date.' end||' Any Featured placement remains clearly labeled and does not change verification or organic ranking.',
    '/business-portal/subscription?business='||p_business_id::text);

  return jsonb_build_object('ok',true,'grant_id',v_grant_id,'access',private.business_effective_plan_access(p_business_id));
end $$;

create or replace function public.admin_revoke_business_plan_grant(p_grant_id uuid,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
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
    update public.sponsorships set active=false,updated_at=now() where business_id=v_grant.business_id and provider='admin_grant' and provider_subscription_id=p_grant_id::text and active=true;
    insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
    values(v_grant.tenant_id,v_actor,'admin_plan_access_revoked','Revoked complimentary '||coalesce(v_plan_name,'plan')||' access grant '||p_grant_id::text||' for business '||v_grant.business_id::text||' ('||coalesce(v_business_name,'business')||'). Its admin-granted Featured placement was also ended. Effective access now falls back to the underlying paid plan or Free.');
    perform private.notify_business_owners_event(v_grant.tenant_id,v_grant.business_id,'plan_grant_revoked:'||p_grant_id::text,'Complimentary plan access ended','The complimentary '||coalesce(v_plan_name,'plan')||' access on your business was ended. Your account now uses its underlying paid plan or Free plan access. Any admin-granted Featured placement ended with it. Verification and organic ranking are unchanged.','/business-portal/subscription?business='||v_grant.business_id::text);
  end if;
  return jsonb_build_object('ok',true,'grant_id',p_grant_id,'access',private.business_effective_plan_access(v_grant.business_id));
end $$;
