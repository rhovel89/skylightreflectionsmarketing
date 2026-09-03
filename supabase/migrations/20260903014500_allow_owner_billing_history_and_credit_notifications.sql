drop policy if exists lead_delivery_charges_owner_read on public.lead_delivery_charges;
create policy lead_delivery_charges_owner_read on public.lead_delivery_charges for select to authenticated using(
  exists(select 1 from public.business_owners bo where bo.business_id=lead_delivery_charges.business_id and bo.user_id=(select auth.uid()))
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);

drop policy if exists lead_invoices_owner_read on public.lead_invoices;
create policy lead_invoices_owner_read on public.lead_invoices for select to authenticated using(
  exists(select 1 from public.business_owners bo where bo.business_id=lead_invoices.business_id and bo.user_id=(select auth.uid()))
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);

create or replace function private.notify_lead_credit_review() returns trigger language plpgsql security definer set search_path='' as $$
declare v_title text;v_body text;
begin
  if new.status is not distinct from old.status or new.status not in('approved','rejected') then return new;end if;
  if new.status='approved' then
    v_title:='Lead credit approved';
    v_body:='Your lead credit request was approved'||case when coalesce(new.approved_credit_cents,0)>0 then ' for $'||to_char(new.approved_credit_cents::numeric/100,'FM999999990.00') else '' end||'.';
  else
    v_title:='Lead credit request reviewed';v_body:='Your lead credit request was not approved.';
  end if;
  if new.staff_notes is not null then v_body:=v_body||' Staff note: '||left(new.staff_notes,300);end if;
  insert into public.notifications(user_id,tenant_id,title,body,action_url) values(new.requested_by,new.tenant_id,v_title,v_body,'/business-portal/billing?business='||new.business_id::text);
  return new;
end$$;
revoke all on function private.notify_lead_credit_review() from public,anon,authenticated;
drop trigger if exists trg_notify_lead_credit_review on public.lead_credit_requests;
create trigger trg_notify_lead_credit_review after update of status on public.lead_credit_requests for each row execute function private.notify_lead_credit_review();
