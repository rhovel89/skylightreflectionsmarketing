create or replace function public.run_lead_billing_automation()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_program public.business_lead_programs%rowtype;
  v_invoice uuid;
  v_created int := 0;
  v_overdue int := 0;
  v_skipped int := 0;
  v_should_run boolean;
  v_owner uuid;
  v_number text;
begin
  update public.lead_invoices set status='overdue',updated_at=now()
   where status='sent' and due_at is not null and due_at < now();
  get diagnostics v_overdue = row_count;

  for v_program in select * from public.business_lead_programs where status='active' and auto_invoice_enabled=true loop
    v_should_run := case v_program.auto_invoice_cadence
      when 'daily' then v_program.last_auto_invoice_at is null or v_program.last_auto_invoice_at::date < current_date
      when 'weekly' then v_program.last_auto_invoice_at is null or v_program.last_auto_invoice_at <= now()-interval '7 days'
      when 'monthly' then v_program.last_auto_invoice_at is null or date_trunc('month',v_program.last_auto_invoice_at) < date_trunc('month',now())
      when 'bundle_ready' then v_program.billing_model='lead_bundle'
      else false end;
    if not v_should_run then v_skipped:=v_skipped+1; continue; end if;
    begin
      v_invoice:=private.create_lead_invoice_internal(v_program.business_id,'Automatically prepared from delivered leads by Lead Revenue CRM.',null);
      update public.business_lead_programs set last_auto_invoice_at=now(),updated_at=now() where id=v_program.id;
      select invoice_number into v_number from public.lead_invoices where id=v_invoice;
      if v_program.notify_on_invoice then
        for v_owner in select user_id from public.business_owners where business_id=v_program.business_id loop
          insert into public.notifications(user_id,tenant_id,title,body,action_url)
          values(v_owner,v_program.tenant_id,'Lead invoice draft prepared',coalesce(v_number,'A lead invoice')||' was prepared from delivered leads. Review billing details in your business portal.','/business-portal/billing?business='||v_program.business_id::text);
        end loop;
      end if;
      v_created:=v_created+1;
    exception when others then
      if sqlerrm in ('no_unbilled_leads','bundle_not_yet_fulfilled') then v_skipped:=v_skipped+1;
      else insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_program.tenant_id,null,'lead_billing_automation_error','Automatic lead invoice preparation failed for business '||v_program.business_id::text||': '||left(sqlerrm,500)); end if;
    end;
  end loop;

  if v_overdue>0 then
    insert into public.notifications(user_id,tenant_id,title,body,action_url)
    select distinct bo.user_id,li.tenant_id,'Lead invoice overdue',li.invoice_number||' is now overdue. Review the invoice in your business portal.','/business-portal/billing?business='||li.business_id::text
      from public.lead_invoices li join public.business_owners bo on bo.business_id=li.business_id join public.business_lead_programs p on p.business_id=li.business_id
     where li.status='overdue' and li.updated_at>=now()-interval '5 minutes' and p.notify_on_invoice=true;
  end if;

  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
  select distinct tenant_id,null,'lead_billing_automation_run','Lead billing automation completed: '||v_created||' draft invoice(s) created, '||v_overdue||' invoice(s) marked overdue, '||v_skipped||' program(s) skipped.' from public.business_lead_programs limit 1;
  return jsonb_build_object('ok',true,'draft_invoices_created',v_created,'invoices_marked_overdue',v_overdue,'programs_skipped',v_skipped);
end$$;

revoke all on function public.run_lead_billing_automation() from public,anon,authenticated;
grant execute on function public.run_lead_billing_automation() to service_role;
