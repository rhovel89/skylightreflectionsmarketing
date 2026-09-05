-- Allow a claimed business to use only the specific Free Intro Leads deliberately delivered by staff,
-- even before ongoing paid Lead Inbox access is active.
drop policy if exists "owner read specifically routed leads" on public.leads;
create policy "owner read specifically routed leads" on public.leads for select to authenticated
using (
  exists(
    select 1 from public.lead_recipients lr
    join public.business_owners bo on bo.business_id=lr.business_id
    where lr.lead_id=leads.id
      and bo.user_id=(select auth.uid())
      and (private.business_has_lead_inbox_access(lr.business_id) or lr.delivery_type='intro')
  )
);

create or replace function public.update_owner_lead_recipient(p_recipient_id uuid,p_status text,p_owner_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_business uuid;v_type text;
begin
 if auth.uid() is null then raise exception 'authentication_required';end if;
 if p_status not in('viewed','contacted','appointment_set','quoted','won','lost','declined','spam') then raise exception 'invalid_lead_status';end if;
 select business_id,delivery_type into v_business,v_type from public.lead_recipients where id=p_recipient_id;
 if v_business is null then raise exception 'lead_recipient_not_found';end if;
 if not exists(select 1 from public.business_owners bo where bo.business_id=v_business and bo.user_id=auth.uid()) then raise exception 'insufficient_privilege';end if;
 if not private.business_has_lead_inbox_access(v_business) and v_type<>'intro' then raise exception 'lead_inbox_not_enabled_for_business';end if;
 update public.lead_recipients set status=p_status,owner_notes=nullif(trim(coalesce(p_owner_notes,'')),''),viewed_at=case when p_status in('viewed','contacted','appointment_set','quoted','won','lost','declined','spam') then coalesce(viewed_at,now()) else viewed_at end,contacted_at=case when p_status in('contacted','appointment_set','quoted','won','lost') then coalesce(contacted_at,now()) else contacted_at end,updated_at=now() where id=p_recipient_id;
end $$;
revoke all on function public.update_owner_lead_recipient(uuid,text,text) from public,anon;
grant execute on function public.update_owner_lead_recipient(uuid,text,text) to authenticated,service_role;
