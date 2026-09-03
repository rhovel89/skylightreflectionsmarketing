create or replace function public.create_lead_invoice(p_business_id uuid,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_tenant uuid;v_program public.business_lead_programs%rowtype;v_invoice uuid;v_count int;v_amount int;v_bundle_count int:=0;v_limit int;v_number text;v_snapshot_count int;v_snapshot_price int;
begin
 select tenant_id into v_tenant from public.businesses where id=p_business_id;
 if v_tenant is null then raise exception 'business_not_found'; end if;
 if auth.uid() is null or not private.has_tenant_role(v_tenant,array['super_admin']) then raise exception 'insufficient_privilege'; end if;
 select * into v_program from public.business_lead_programs where business_id=p_business_id and status='active';
 if v_program.business_id is null then raise exception 'billing_program_not_configured'; end if;
 if v_program.billing_model='pay_per_lead' then
  select count(*),coalesce(sum(per_lead_price_cents),0) into v_count,v_amount from public.lead_delivery_charges where business_id=p_business_id and billing_status='unbilled' and billing_model='pay_per_lead';
  if v_count=0 or v_amount<=0 then raise exception 'no_unbilled_leads'; end if;v_limit:=v_count;
 else
  select bundle_lead_count,bundle_price_cents into v_snapshot_count,v_snapshot_price from public.lead_delivery_charges where business_id=p_business_id and billing_status='unbilled' and billing_model='lead_bundle' order by delivered_at,id limit 1;
  if coalesce(v_snapshot_count,0)<=0 or coalesce(v_snapshot_price,0)<=0 then raise exception 'no_unbilled_leads'; end if;
  select count(*) into v_count from public.lead_delivery_charges where business_id=p_business_id and billing_status='unbilled' and billing_model='lead_bundle' and bundle_lead_count=v_snapshot_count and bundle_price_cents=v_snapshot_price;
  v_bundle_count:=floor(v_count::numeric/v_snapshot_count)::int;if v_bundle_count<=0 then raise exception 'bundle_not_yet_fulfilled';end if;v_limit:=v_bundle_count*v_snapshot_count;v_count:=v_limit;v_amount:=v_bundle_count*v_snapshot_price;
 end if;
 v_number:='LP-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.lead_invoice_number_seq')::text,6,'0');
 insert into public.lead_invoices(tenant_id,business_id,invoice_number,billing_model,lead_count,bundle_count,amount_due_cents,status,due_at,notes,created_by) values(v_tenant,p_business_id,v_number,v_program.billing_model,v_count,v_bundle_count,v_amount,'draft',now()+make_interval(days=>v_program.due_days),nullif(trim(coalesce(p_notes,'')),''),auth.uid()) returning id into v_invoice;
 with picked as(select id from public.lead_delivery_charges where business_id=p_business_id and billing_status='unbilled' and billing_model=v_program.billing_model and(v_program.billing_model='pay_per_lead' or(bundle_lead_count=v_snapshot_count and bundle_price_cents=v_snapshot_price)) order by delivered_at,id limit v_limit) update public.lead_delivery_charges c set billing_status='invoiced',invoice_id=v_invoice from picked where c.id=picked.id;
 insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'lead_invoice_created','Created lead invoice '||v_number||' for '||v_count||' delivered lead(s), $'||round(v_amount::numeric/100,2)||'.');return v_invoice;
end $$;
revoke all on function public.create_lead_invoice(uuid,text) from public;grant execute on function public.create_lead_invoice(uuid,text) to authenticated;
