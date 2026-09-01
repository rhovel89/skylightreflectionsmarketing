alter table public.leads alter column tenant_id set not null;

do $$ begin
  alter table public.leads add constraint leads_status_check check (status in ('new','routed','in_progress','completed','closed','spam'));
exception when duplicate_object then null; end $$;

create index if not exists leads_tenant_status_created_idx on public.leads(tenant_id,status,created_at desc);
create index if not exists lead_recipients_business_status_idx on public.lead_recipients(business_id,status,routed_at desc);
create index if not exists lead_recipients_lead_status_idx on public.lead_recipients(lead_id,status);

create or replace function public.route_directory_lead(p_lead_id uuid,p_business_id uuid,p_route_reason text default 'Staff matched by service and market',p_route_rank integer default 0)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_tenant uuid; v_recipient uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select tenant_id into v_tenant from public.leads where id=p_lead_id;
  if v_tenant is null then raise exception 'lead_not_found'; end if;
  if not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'insufficient_privilege'; end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=v_tenant and b.status='published') then raise exception 'published_business_required'; end if;
  insert into public.lead_recipients(tenant_id,lead_id,business_id,route_reason,route_rank,status,routed_at,updated_at)
  values(v_tenant,p_lead_id,p_business_id,nullif(trim(coalesce(p_route_reason,'')),''),greatest(coalesce(p_route_rank,0),0),'new',now(),now())
  on conflict(lead_id,business_id) do nothing returning id into v_recipient;
  if v_recipient is null then select id into v_recipient from public.lead_recipients where lead_id=p_lead_id and business_id=p_business_id; end if;
  update public.leads set assigned_business_id=coalesce(assigned_business_id,p_business_id),status=case when status='new' then 'routed' else status end where id=p_lead_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'lead_routed','Routed lead '||p_lead_id||' to business '||p_business_id);
  return v_recipient;
end $$;

create or replace function public.update_owner_lead_recipient(p_recipient_id uuid,p_status text,p_owner_notes text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare v_business uuid; v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_status not in ('viewed','contacted','appointment_set','quoted','won','lost','declined','spam') then raise exception 'invalid_lead_status'; end if;
  select business_id,tenant_id into v_business,v_tenant from public.lead_recipients where id=p_recipient_id;
  if v_business is null or not exists(select 1 from public.business_owners bo where bo.business_id=v_business and bo.user_id=auth.uid()) then raise exception 'insufficient_privilege'; end if;
  update public.lead_recipients set status=p_status,owner_notes=nullif(trim(coalesce(p_owner_notes,'')),''),viewed_at=case when p_status in ('viewed','contacted','appointment_set','quoted','won','lost','declined','spam') then coalesce(viewed_at,now()) else viewed_at end,contacted_at=case when p_status in ('contacted','appointment_set','quoted','won','lost') then coalesce(contacted_at,now()) else contacted_at end,updated_at=now() where id=p_recipient_id;
end $$;

create or replace function private.sync_parent_lead_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_lead uuid; v_status text;
begin
  v_lead:=coalesce(new.lead_id,old.lead_id);
  select case
    when bool_or(status='won') then 'completed'
    when count(*) filter(where status not in ('lost','declined','spam'))=0 and bool_and(status='spam') then 'spam'
    when count(*) filter(where status not in ('lost','declined','spam'))=0 then 'closed'
    when bool_or(status in ('viewed','contacted','appointment_set','quoted')) then 'in_progress'
    when count(*)>0 then 'routed'
    else 'new' end into v_status
  from public.lead_recipients where lead_id=v_lead;
  update public.leads set status=coalesce(v_status,'new') where id=v_lead;
  return coalesce(new,old);
end $$;
revoke all on function private.sync_parent_lead_status() from public,anon,authenticated;

drop trigger if exists trg_sync_parent_lead_status on public.lead_recipients;
create trigger trg_sync_parent_lead_status after insert or update of status or delete on public.lead_recipients for each row execute function private.sync_parent_lead_status();

create or replace function private.route_direct_business_lead()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.business_id is not null and exists(select 1 from public.businesses b where b.id=new.business_id and b.tenant_id=new.tenant_id and b.status='published') then
    insert into public.lead_recipients(tenant_id,lead_id,business_id,route_reason,route_rank,status,routed_at,updated_at)
    values(new.tenant_id,new.id,new.business_id,'Consumer contacted this business directly',1,'new',now(),now())
    on conflict(lead_id,business_id) do nothing;
    update public.leads set assigned_business_id=new.business_id where id=new.id;
  end if;
  return new;
end $$;
revoke all on function private.route_direct_business_lead() from public,anon,authenticated;

drop trigger if exists trg_route_direct_business_lead on public.leads;
create trigger trg_route_direct_business_lead after insert on public.leads for each row execute function private.route_direct_business_lead();

revoke update on table public.lead_recipients from authenticated;
grant update(status,owner_notes,viewed_at,contacted_at,updated_at) on public.lead_recipients to authenticated;
grant execute on function public.route_directory_lead(uuid,uuid,text,integer) to authenticated;
grant execute on function public.update_owner_lead_recipient(uuid,text,text) to authenticated;
revoke execute on function public.route_directory_lead(uuid,uuid,text,integer) from anon;
revoke execute on function public.update_owner_lead_recipient(uuid,text,text) from anon;