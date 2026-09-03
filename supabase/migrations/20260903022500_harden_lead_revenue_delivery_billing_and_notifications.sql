-- Lead revenue hardening: historical snapshot billing, shared-buyer safeguards,
-- credit application, and idempotent owner notifications.

alter table public.notifications
  add column if not exists event_key text;

create unique index if not exists notifications_user_event_key_uidx
  on public.notifications(user_id,event_key)
  where event_key is not null;

create index if not exists lead_delivery_charges_business_month_idx
  on public.lead_delivery_charges(business_id,delivered_at desc)
  where billing_status <> 'void';

create index if not exists lead_invoices_business_status_due_idx
  on public.lead_invoices(business_id,status,due_at);

create or replace function private.notify_business_owners_event(
  p_tenant_id uuid,
  p_business_id uuid,
  p_event_key text,
  p_title text,
  p_body text,
  p_action_url text
) returns integer
language plpgsql
security definer
set search_path=''
as $$
declare v_inserted integer:=0;
begin
  insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
  select bo.user_id,p_tenant_id,left(p_title,160),left(p_body,1200),p_action_url,p_event_key
  from public.business_owners bo
  where bo.business_id=p_business_id
  on conflict(user_id,event_key) where event_key is not null do nothing;
  get diagnostics v_inserted=row_count;
  return v_inserted;
end$$;

revoke all on function private.notify_business_owners_event(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function private.notify_business_owners_event(uuid,uuid,text,text,text,text) to service_role;

create or replace function public.deliver_billable_lead(
  p_lead_id uuid,
  p_business_id uuid,
  p_route_reason text default 'Paid lead delivery',
  p_route_rank integer default 0
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_tenant uuid;
  v_program public.business_lead_programs%rowtype;
  v_recipient uuid;
  v_month_count integer:=0;
  v_other_buyers integer:=0;
  v_open integer:=0;
  v_overdue integer:=0;
begin
  select tenant_id into v_tenant from public.leads where id=p_lead_id;
  if v_tenant is null then raise exception 'lead_not_found';end if;
  if auth.uid() is null or not private.has_tenant_role(v_tenant,array['super_admin']) then raise exception 'insufficient_privilege';end if;
  if not exists(select 1 from public.businesses where id=p_business_id and tenant_id=v_tenant) then raise exception 'business_tenant_mismatch';end if;
  if not private.business_has_lead_inbox_access(p_business_id) then raise exception 'lead_inbox_not_enabled_for_business';end if;

  select * into v_program from public.business_lead_programs where business_id=p_business_id and status='active' for update;
  if v_program.business_id is null then raise exception 'billing_program_not_configured';end if;
  if v_program.agreement_started_on is not null and current_date<v_program.agreement_started_on then raise exception 'lead_agreement_not_started';end if;
  if v_program.agreement_ends_on is not null and current_date>v_program.agreement_ends_on then raise exception 'lead_agreement_ended';end if;
  if v_program.manual_delivery_hold then raise exception 'lead_delivery_on_manual_hold';end if;
  if v_program.billing_model='pay_per_lead' and coalesce(v_program.per_lead_price_cents,0)<=0 then raise exception 'billing_program_not_configured';end if;
  if v_program.billing_model='lead_bundle' and(coalesce(v_program.bundle_lead_count,0)<=0 or coalesce(v_program.bundle_price_cents,0)<=0) then raise exception 'billing_program_not_configured';end if;

  if exists(select 1 from public.lead_recipients where lead_id=p_lead_id and business_id=p_business_id) then raise exception 'lead_already_delivered_to_business';end if;
  select count(distinct business_id) into v_other_buyers
  from public.lead_recipients
  where lead_id=p_lead_id and business_id<>p_business_id;

  if v_program.lead_sale_mode='exclusive' and v_other_buyers>0 then raise exception 'exclusive_lead_already_delivered';end if;
  -- max_buyers_per_lead is the total number of buyers, including the business being added now.
  if v_program.lead_sale_mode='shared' and v_other_buyers>=greatest(2,v_program.max_buyers_per_lead) then raise exception 'shared_lead_buyer_limit_reached';end if;

  if v_program.max_leads_per_month is not null then
    select count(*) into v_month_count
    from public.lead_delivery_charges
    where business_id=p_business_id and billing_status<>'void' and delivered_at>=date_trunc('month',now());
    if v_month_count>=v_program.max_leads_per_month then raise exception 'monthly_lead_cap_reached';end if;
  end if;

  if v_program.stop_delivery_on_open_balance then
    select count(*) into v_open from public.lead_invoices where business_id=p_business_id and status in('sent','overdue');
    if v_open>0 then raise exception 'delivery_blocked_open_balance';end if;
  end if;

  if v_program.stop_delivery_on_overdue then
    select count(*) into v_overdue
    from public.lead_invoices
    where business_id=p_business_id and status in('sent','overdue') and due_at is not null
      and due_at+make_interval(days=>v_program.overdue_grace_days)<now();
    if v_overdue>0 then raise exception 'delivery_blocked_overdue_balance';end if;
  end if;

  v_recipient:=public.route_directory_lead(p_lead_id,p_business_id,p_route_reason,p_route_rank);
  insert into public.lead_delivery_charges(
    tenant_id,business_id,lead_id,recipient_id,billing_model,
    per_lead_price_cents,bundle_lead_count,bundle_price_cents,
    billing_status,delivered_at,created_by
  ) values(
    v_tenant,p_business_id,p_lead_id,v_recipient,v_program.billing_model,
    v_program.per_lead_price_cents,v_program.bundle_lead_count,v_program.bundle_price_cents,
    'unbilled',now(),auth.uid()
  ) on conflict(recipient_id) do nothing;

  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
  values(v_tenant,auth.uid(),'billable_lead_delivered','Delivered billable lead '||p_lead_id||' to business '||p_business_id||'. Billing is based on delivery, not close outcome.');
  return v_recipient;
end$$;

revoke all on function public.deliver_billable_lead(uuid,uuid,text,integer) from public,anon;
grant execute on function public.deliver_billable_lead(uuid,uuid,text,integer) to authenticated,service_role;

create or replace function private.create_lead_invoice_internal(
  p_business_id uuid,
  p_notes text default null,
  p_actor uuid default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_tenant uuid;
  v_program public.business_lead_programs%rowtype;
  v_invoice uuid;
  v_first public.lead_delivery_charges%rowtype;
  v_count integer:=0;
  v_subtotal integer:=0;
  v_bundle_count integer:=0;
  v_limit integer:=0;
  v_number text;
  v_credit_total integer:=0;
  v_due integer:=0;
  v_remaining integer:=0;
  v_credit public.business_lead_credits%rowtype;
  v_apply integer:=0;
begin
  select tenant_id into v_tenant from public.businesses where id=p_business_id;
  if v_tenant is null then raise exception 'business_not_found';end if;
  select * into v_program from public.business_lead_programs where business_id=p_business_id and status='active';
  if v_program.business_id is null then raise exception 'billing_program_not_configured';end if;

  -- Invoice the oldest eligible historical price snapshot, not merely the business's newest terms.
  select * into v_first
  from public.lead_delivery_charges
  where business_id=p_business_id and billing_status='unbilled'
  order by delivered_at,id
  limit 1;
  if v_first.id is null then raise exception 'no_unbilled_leads';end if;

  if v_first.billing_model='pay_per_lead' then
    select count(*),coalesce(sum(per_lead_price_cents),0)
      into v_count,v_subtotal
    from public.lead_delivery_charges
    where business_id=p_business_id and billing_status='unbilled' and billing_model='pay_per_lead';
    if v_count=0 or v_subtotal<=0 then raise exception 'no_unbilled_leads';end if;
    v_limit:=v_count;
  elsif v_first.billing_model='lead_bundle' then
    if coalesce(v_first.bundle_lead_count,0)<=0 or coalesce(v_first.bundle_price_cents,0)<=0 then raise exception 'invalid_historical_bundle_snapshot';end if;
    select count(*) into v_count
    from public.lead_delivery_charges
    where business_id=p_business_id and billing_status='unbilled' and billing_model='lead_bundle'
      and bundle_lead_count=v_first.bundle_lead_count and bundle_price_cents=v_first.bundle_price_cents;
    v_bundle_count:=floor(v_count::numeric/v_first.bundle_lead_count)::int;
    if v_bundle_count<=0 then raise exception 'bundle_not_yet_fulfilled';end if;
    v_limit:=v_bundle_count*v_first.bundle_lead_count;
    v_count:=v_limit;
    v_subtotal:=v_bundle_count*v_first.bundle_price_cents;
  else
    raise exception 'invalid_historical_billing_model';
  end if;

  v_number:='LP-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.lead_invoice_number_seq')::text,6,'0');
  insert into public.lead_invoices(
    tenant_id,business_id,invoice_number,billing_model,lead_count,bundle_count,
    subtotal_cents,credit_applied_cents,amount_due_cents,status,due_at,notes,created_by
  ) values(
    v_tenant,p_business_id,v_number,v_first.billing_model,v_count,v_bundle_count,
    v_subtotal,0,v_subtotal,'draft',now()+make_interval(days=>v_program.due_days),
    nullif(trim(coalesce(p_notes,'')),''),p_actor
  ) returning id into v_invoice;

  if v_first.billing_model='pay_per_lead' then
    with picked as(
      select id from public.lead_delivery_charges
      where business_id=p_business_id and billing_status='unbilled' and billing_model='pay_per_lead'
      order by delivered_at,id limit v_limit
    )
    update public.lead_delivery_charges c set billing_status='invoiced',invoice_id=v_invoice
    from picked where c.id=picked.id;
  else
    with picked as(
      select id from public.lead_delivery_charges
      where business_id=p_business_id and billing_status='unbilled' and billing_model='lead_bundle'
        and bundle_lead_count=v_first.bundle_lead_count and bundle_price_cents=v_first.bundle_price_cents
      order by delivered_at,id limit v_limit
    )
    update public.lead_delivery_charges c set billing_status='invoiced',invoice_id=v_invoice
    from picked where c.id=picked.id;
  end if;

  v_remaining:=v_subtotal;
  for v_credit in
    select * from public.business_lead_credits
    where business_id=p_business_id and status='available' and remaining_amount_cents>0
    order by created_at,id for update
  loop
    exit when v_remaining<=0;
    v_apply:=least(v_remaining,v_credit.remaining_amount_cents);
    insert into public.lead_credit_applications(tenant_id,credit_id,invoice_id,amount_cents)
    values(v_tenant,v_credit.id,v_invoice,v_apply)
    on conflict(credit_id,invoice_id) do update set amount_cents=public.lead_credit_applications.amount_cents+excluded.amount_cents;
    update public.business_lead_credits
      set remaining_amount_cents=remaining_amount_cents-v_apply,
          status=case when remaining_amount_cents-v_apply=0 then 'exhausted' else 'available' end,
          updated_at=now()
      where id=v_credit.id;
    v_credit_total:=v_credit_total+v_apply;
    v_remaining:=v_remaining-v_apply;
  end loop;

  v_due:=v_subtotal-v_credit_total;
  update public.lead_invoices
    set credit_applied_cents=v_credit_total,amount_due_cents=v_due,
        status=case when v_due=0 then 'paid' else 'draft' end,
        paid_at=case when v_due=0 then now() end,updated_at=now()
    where id=v_invoice;
  if v_due=0 then update public.lead_delivery_charges set billing_status='paid' where invoice_id=v_invoice;end if;

  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
  values(v_tenant,p_actor,'lead_invoice_created','Created lead invoice '||v_number||' for '||v_count||' delivered lead(s), subtotal $'||round(v_subtotal::numeric/100,2)||', credits $'||round(v_credit_total::numeric/100,2)||'. Historical delivery price snapshots were preserved.');
  return v_invoice;
end$$;

revoke all on function private.create_lead_invoice_internal(uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.create_lead_invoice_internal(uuid,text,uuid) to service_role;

create or replace function public.review_lead_credit_request(
  p_request_id uuid,
  p_decision text,
  p_approved_credit_cents integer default null,
  p_staff_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_req public.lead_credit_requests%rowtype;
  v_charge public.lead_delivery_charges%rowtype;
  v_invoice public.lead_invoices%rowtype;
  v_amount integer;
  v_max_amount integer;
  v_credit uuid;
  v_apply integer:=0;
begin
  select * into v_req from public.lead_credit_requests where id=p_request_id for update;
  if v_req.id is null then raise exception 'credit_request_not_found';end if;
  if auth.uid() is null or not private.has_tenant_role(v_req.tenant_id,array['super_admin']) then raise exception 'insufficient_privilege';end if;
  if v_req.status<>'pending' then raise exception 'credit_request_already_reviewed';end if;
  if p_decision not in('approve','reject') then raise exception 'invalid_decision';end if;
  select * into v_charge from public.lead_delivery_charges where id=v_req.charge_id for update;
  if v_charge.id is null then raise exception 'charge_not_found';end if;

  if p_decision='reject' then
    update public.lead_credit_requests
      set status='rejected',approved_credit_cents=0,staff_notes=nullif(trim(coalesce(p_staff_notes,'')),''),
          reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
      where id=p_request_id;
    insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
    values(v_req.tenant_id,auth.uid(),'lead_credit_rejected','Rejected lead credit request '||p_request_id||'.');
    return jsonb_build_object('ok',true,'decision','rejected');
  end if;

  v_max_amount:=case when v_charge.billing_model='pay_per_lead' then v_charge.per_lead_price_cents else round(v_charge.bundle_price_cents::numeric/nullif(v_charge.bundle_lead_count,0))::int end;
  v_amount:=coalesce(p_approved_credit_cents,v_req.requested_credit_cents,v_max_amount);
  if coalesce(v_amount,0)<=0 then raise exception 'positive_credit_required';end if;
  if coalesce(v_max_amount,0)<=0 then raise exception 'invalid_charge_snapshot';end if;
  if v_amount>v_max_amount then raise exception 'credit_exceeds_delivered_lead_value';end if;

  if v_charge.billing_status='unbilled' and v_amount=v_max_amount then
    update public.lead_delivery_charges set billing_status='void' where id=v_charge.id;
    insert into public.business_lead_credits(
      tenant_id,business_id,request_id,charge_id,original_amount_cents,remaining_amount_cents,status,created_by
    ) values(v_req.tenant_id,v_req.business_id,v_req.id,v_req.charge_id,v_amount,0,'resolved_before_invoice',auth.uid())
    returning id into v_credit;
  else
    insert into public.business_lead_credits(
      tenant_id,business_id,request_id,charge_id,original_amount_cents,remaining_amount_cents,status,created_by
    ) values(v_req.tenant_id,v_req.business_id,v_req.id,v_req.charge_id,v_amount,v_amount,'available',auth.uid())
    returning id into v_credit;

    if v_charge.invoice_id is not null then
      select * into v_invoice from public.lead_invoices where id=v_charge.invoice_id for update;
      if v_invoice.id is not null and v_invoice.status='draft' and v_invoice.amount_due_cents>0 then
        v_apply:=least(v_amount,v_invoice.amount_due_cents);
        insert into public.lead_credit_applications(tenant_id,credit_id,invoice_id,amount_cents)
        values(v_req.tenant_id,v_credit,v_invoice.id,v_apply);
        update public.business_lead_credits
          set remaining_amount_cents=remaining_amount_cents-v_apply,
              status=case when remaining_amount_cents-v_apply=0 then 'exhausted' else 'available' end,
              updated_at=now()
          where id=v_credit;
        update public.lead_invoices
          set credit_applied_cents=credit_applied_cents+v_apply,
              amount_due_cents=amount_due_cents-v_apply,
              status=case when amount_due_cents-v_apply=0 then 'paid' else status end,
              paid_at=case when amount_due_cents-v_apply=0 then coalesce(paid_at,now()) else paid_at end,
              updated_at=now()
          where id=v_invoice.id;
        if v_invoice.amount_due_cents-v_apply=0 then
          update public.lead_delivery_charges set billing_status='paid' where invoice_id=v_invoice.id;
        end if;
      end if;
    end if;
  end if;

  update public.lead_credit_requests
    set status='approved',approved_credit_cents=v_amount,staff_notes=nullif(trim(coalesce(p_staff_notes,'')),''),
        reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    where id=p_request_id;

  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
  values(v_req.tenant_id,auth.uid(),'lead_credit_approved','Approved lead credit request '||p_request_id||' for $'||round(v_amount::numeric/100,2)||case when v_apply>0 then '; $'||round(v_apply::numeric/100,2)||' applied immediately to draft invoice.' else '.' end);

  return jsonb_build_object(
    'ok',true,'decision','approved','credit_id',v_credit,'amount_cents',v_amount,
    'resolved_before_invoice',v_charge.billing_status='unbilled' and v_amount=v_max_amount,
    'applied_to_draft_invoice_cents',v_apply,
    'remaining_credit_cents',greatest(0,v_amount-v_apply)
  );
end$$;

revoke all on function public.review_lead_credit_request(uuid,text,integer,text) from public,anon;
grant execute on function public.review_lead_credit_request(uuid,text,integer,text) to authenticated,service_role;

create or replace function private.notify_lead_delivery_owner()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_program public.business_lead_programs%rowtype;
  v_lead public.leads%rowtype;
  v_month_count integer:=0;
  v_pct numeric:=0;
begin
  select * into v_program from public.business_lead_programs where business_id=new.business_id;
  select * into v_lead from public.leads where id=new.lead_id;

  if coalesce(v_program.notify_on_delivery,true) then
    perform private.notify_business_owners_event(
      new.tenant_id,new.business_id,'lead-delivered:'||new.id::text,'New lead delivered',
      coalesce(v_lead.service,'Local service')||' lead in '||coalesce(v_lead.city,'your service area')||' was delivered to your Lead Inbox. Lead billing is based on delivery under your agreement.',
      '/business-portal/leads?business='||new.business_id::text
    );
  end if;

  if v_program.max_leads_per_month is not null and v_program.max_leads_per_month>0 then
    select count(*) into v_month_count from public.lead_delivery_charges
    where business_id=new.business_id and billing_status<>'void' and delivered_at>=date_trunc('month',now());
    v_pct:=v_month_count::numeric/v_program.max_leads_per_month;
    if v_month_count>=v_program.max_leads_per_month then
      perform private.notify_business_owners_event(
        new.tenant_id,new.business_id,'lead-cap-reached:'||to_char(now(),'YYYY-MM'),'Monthly lead limit reached',
        'Your configured monthly lead limit of '||v_program.max_leads_per_month||' has been reached. Additional paid lead delivery is paused until the next month or until your agreement is updated.',
        '/business-portal/billing?business='||new.business_id::text
      );
    elsif v_pct>=0.8 then
      perform private.notify_business_owners_event(
        new.tenant_id,new.business_id,'lead-cap-80:'||to_char(now(),'YYYY-MM'),'Lead limit almost reached',
        'You have received '||v_month_count||' of '||v_program.max_leads_per_month||' leads for this month.',
        '/business-portal/billing?business='||new.business_id::text
      );
    end if;
  end if;
  return new;
end$$;

create or replace function private.notify_lead_invoice_owner()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_program public.business_lead_programs%rowtype;
  v_title text;
  v_body text;
  v_key text;
begin
  select * into v_program from public.business_lead_programs where business_id=new.business_id;
  if not coalesce(v_program.notify_on_invoice,true) then return new;end if;
  if tg_op='INSERT' then
    v_title:='Lead invoice created';v_body:=new.invoice_number||' was created for $'||to_char(new.amount_due_cents::numeric/100,'FM999999990.00')||'.';v_key:='invoice-created:'||new.id::text;
  elsif new.status is distinct from old.status and new.status='overdue' then
    v_title:='Lead invoice overdue';v_body:=new.invoice_number||' is overdue. Lead delivery may pause based on your agreement.';v_key:='invoice-overdue:'||new.id::text;
  elsif new.status is distinct from old.status and new.status='paid' then
    v_title:='Lead invoice paid';v_body:=new.invoice_number||' is recorded as paid.';v_key:='invoice-paid:'||new.id::text;
  elsif new.status is distinct from old.status and new.status='sent' then
    v_title:='Lead invoice sent';v_body:=new.invoice_number||' was sent and is due '||coalesce(to_char(new.due_at,'Mon DD, YYYY'),'per agreement')||'.';v_key:='invoice-sent:'||new.id::text;
  elsif new.status is distinct from old.status and new.status='void' then
    v_title:='Lead invoice voided';v_body:=new.invoice_number||' was voided. Any still-billable delivered leads were returned to the unbilled ledger.';v_key:='invoice-void:'||new.id::text;
  else return new;end if;
  perform private.notify_business_owners_event(new.tenant_id,new.business_id,v_key,v_title,v_body,'/business-portal/billing?business='||new.business_id::text);
  return new;
end$$;

create or replace function private.notify_lead_credit_review()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_title text;v_body text;
begin
  if new.status is not distinct from old.status or new.status not in('approved','rejected') then return new;end if;
  if new.status='approved' then
    v_title:='Lead credit approved';
    v_body:='Your lead credit request was approved'||case when coalesce(new.approved_credit_cents,0)>0 then ' for $'||to_char(new.approved_credit_cents::numeric/100,'FM999999990.00') else '' end||'. Approved credits apply to eligible invoice balances according to billing status.';
  else
    v_title:='Lead credit request reviewed';v_body:='Your lead credit request was not approved.';
  end if;
  if new.staff_notes is not null then v_body:=v_body||' Staff note: '||left(new.staff_notes,300);end if;
  insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
  values(new.requested_by,new.tenant_id,v_title,v_body,'/business-portal/billing?business='||new.business_id::text,'credit-review:'||new.id::text||':'||new.status)
  on conflict(user_id,event_key) where event_key is not null do nothing;
  return new;
end$$;

revoke all on function private.notify_lead_delivery_owner() from public,anon,authenticated;
revoke all on function private.notify_lead_invoice_owner() from public,anon,authenticated;
revoke all on function private.notify_lead_credit_review() from public,anon,authenticated;

create or replace function private.process_lead_billing_cycle()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_program public.business_lead_programs%rowtype;
  v_created integer:=0;
  v_overdue integer:=0;
  v_due_soon integer:=0;
  v_invoice uuid;
  v_due boolean;
  v_row record;
begin
  update public.lead_invoices set status='overdue',updated_at=now()
  where status='sent' and due_at is not null and due_at<now();
  get diagnostics v_overdue=row_count;

  for v_row in
    select i.id,i.tenant_id,i.business_id,i.invoice_number,i.due_at
    from public.lead_invoices i
    join public.business_lead_programs p on p.business_id=i.business_id
    where i.status='sent' and i.due_at is not null
      and i.due_at>=now() and i.due_at<now()+interval '3 days'
      and coalesce(p.notify_on_invoice,true)
  loop
    v_due_soon:=v_due_soon+private.notify_business_owners_event(
      v_row.tenant_id,v_row.business_id,'invoice-due-soon:'||v_row.id::text,
      'Lead invoice due soon',v_row.invoice_number||' is due '||to_char(v_row.due_at,'Mon DD, YYYY')||'.',
      '/business-portal/billing?business='||v_row.business_id::text
    );
  end loop;

  for v_program in
    select * from public.business_lead_programs
    where status='active' and auto_invoice_enabled=true and auto_invoice_cadence<>'manual'
  loop
    v_due:=case v_program.auto_invoice_cadence
      when 'daily' then v_program.last_auto_invoice_at is null or v_program.last_auto_invoice_at<now()-interval '1 day'
      when 'weekly' then v_program.last_auto_invoice_at is null or v_program.last_auto_invoice_at<now()-interval '7 days'
      when 'monthly' then v_program.last_auto_invoice_at is null or date_trunc('month',v_program.last_auto_invoice_at)<date_trunc('month',now())
      when 'bundle_ready' then true
      else false end;
    if not v_due or v_program.manual_delivery_hold then continue;end if;
    begin
      v_invoice:=private.create_lead_invoice_internal(v_program.business_id,'Automatically prepared draft from delivered leads.',null);
      update public.business_lead_programs set last_auto_invoice_at=now(),updated_at=now() where id=v_program.id;
      v_created:=v_created+1;
    exception when others then
      if sqlerrm not like '%no_unbilled_leads%' and sqlerrm not like '%bundle_not_yet_fulfilled%' then
        insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
        values(v_program.tenant_id,null,'lead_auto_invoice_error','Auto invoice failed for business '||v_program.business_id||': '||left(sqlerrm,400));
      end if;
    end;
  end loop;
  return jsonb_build_object('overdue_marked',v_overdue,'due_soon_notifications',v_due_soon,'draft_invoices_created',v_created,'processed_at',now());
end$$;

revoke all on function private.process_lead_billing_cycle() from public,anon,authenticated;
grant execute on function private.process_lead_billing_cycle() to service_role;

-- The v2 contract endpoint is authoritative; keep the legacy contract writer off the signed-in API surface.
revoke execute on function public.configure_business_lead_program(uuid,boolean,text,integer,integer,integer,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.configure_business_lead_program(uuid,boolean,text,integer,integer,integer,integer,text,text,text) to service_role;

-- Scheduled automation does not need to be callable by ordinary signed-in users.
revoke execute on function public.run_lead_billing_automation() from public,anon,authenticated;
grant execute on function public.run_lead_billing_automation() to service_role;
