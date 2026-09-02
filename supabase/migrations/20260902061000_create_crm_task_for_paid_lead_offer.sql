create or replace function private.queue_paid_lead_offer_outreach() returns trigger language plpgsql set search_path='' as $$
declare v_prospect uuid;
begin
  if new.status not in ('offered','reserved','checkout_pending') then return new; end if;
  select bp.id into v_prospect
  from public.business_prospects bp
  where bp.tenant_id=new.tenant_id and bp.business_id=new.business_id and bp.status<>'do_not_contact'
  order by bp.updated_at desc nulls last,bp.created_at desc
  limit 1;
  if v_prospect is null then return new; end if;
  if not exists(
    select 1 from public.outreach_tasks ot
    where ot.tenant_id=new.tenant_id and ot.prospect_id=v_prospect and ot.status in ('open','in_progress')
      and ot.task_type='marketing_outreach' and coalesce(ot.notes,'') like '%Paid lead offer ID: '||new.id::text||'%'
  ) then
    insert into public.outreach_tasks(tenant_id,prospect_id,task_type,due_at,status,notes)
    values(new.tenant_id,v_prospect,'marketing_outreach',now(),'open',
      'Paid lead opportunity is available for this business. Paid lead offer ID: '||new.id::text||'. This is an internal task only; outreach has NOT been sent. Do not include or reveal consumer name, phone, email, or full request details before purchase/delivery. Invite the business owner to claim/access their Business Portal and review the redacted lead opportunity.');
  end if;
  return new;
end; $$;
drop trigger if exists queue_paid_lead_offer_outreach on public.lead_marketplace_offers;
create trigger queue_paid_lead_offer_outreach after insert or update of status on public.lead_marketplace_offers for each row execute function private.queue_paid_lead_offer_outreach();
