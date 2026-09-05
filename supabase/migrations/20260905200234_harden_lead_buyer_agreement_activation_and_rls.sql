drop policy if exists lead_buyer_agreement_drafts_admin_manage on public.lead_buyer_agreement_drafts;
create policy lead_buyer_agreement_drafts_admin_manage on public.lead_buyer_agreement_drafts
for all to authenticated
using (private.has_tenant_role(tenant_id,array['admin','super_admin']))
with check (
  private.has_tenant_role(tenant_id,array['admin','super_admin'])
  and exists(
    select 1
    from public.businesses b
    where b.id=lead_buyer_agreement_drafts.business_id
      and b.tenant_id=lead_buyer_agreement_drafts.tenant_id
  )
);

create or replace function private.finalize_lead_buyer_agreement_activation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status='activated' and old.status is distinct from new.status then
    update public.notifications
       set read_at=coalesce(read_at,now())
     where tenant_id=new.tenant_id
       and event_key='lead_buyer_agreement_ready:'||new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.finalize_lead_buyer_agreement_activation() from public,anon,authenticated;
grant execute on function private.finalize_lead_buyer_agreement_activation() to postgres;

drop trigger if exists lead_buyer_agreement_activation_finalize on public.lead_buyer_agreement_drafts;
create trigger lead_buyer_agreement_activation_finalize
after update of status on public.lead_buyer_agreement_drafts
for each row execute function private.finalize_lead_buyer_agreement_activation();

create or replace function public.activate_lead_buyer_agreement_draft(p_draft_id uuid)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  v public.lead_buyer_agreement_drafts%rowtype;
  v_program_id uuid;
begin
  select * into v from public.lead_buyer_agreement_drafts where id=p_draft_id for update;
  if v.id is null then raise exception 'agreement_draft_not_found'; end if;
  if auth.uid() is null or not private.has_tenant_role(v.tenant_id,array['super_admin']) then raise exception 'insufficient_privilege'; end if;
  if v.status <> 'ready_for_review' then raise exception 'agreement_not_ready_for_activation'; end if;
  if v.consent_recorded_at is null or nullif(trim(coalesce(v.consent_source,'')),'') is null or nullif(trim(coalesce(v.consent_reference,'')),'') is null then raise exception 'documented_consent_required'; end if;
  if nullif(trim(coalesce(v.owner_summary,'')),'') is null then raise exception 'owner_summary_required'; end if;
  if v.agreement_started_on is null then raise exception 'agreement_start_required'; end if;

  select public.configure_business_lead_program_v2(
    v.business_id,v.featured_addon_enabled,v.billing_model,v.per_lead_price_cents,v.bundle_lead_count,v.bundle_price_cents,
    v.due_days,v.billing_email,v.owner_summary,'active',v.agreement_started_on,v.agreement_ends_on,v.max_leads_per_month,
    v.lead_sale_mode,v.max_buyers_per_lead,false,'manual',false,true,0,false,null,true,true
  ) into v_program_id;

  update public.lead_buyer_agreement_drafts
     set status='activated',activated_at=now(),activated_by=auth.uid(),resulting_program_id=v_program_id,updated_by=auth.uid(),updated_at=now()
   where id=v.id;

  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
  values(v.tenant_id,auth.uid(),'lead_buyer_agreement_activated','Activated reviewed Lead Buyer agreement draft '||v.id||' as authoritative program '||v_program_id||'. Activation created no lead delivery or charge.');
  return v_program_id;
end;
$$;
revoke all on function public.activate_lead_buyer_agreement_draft(uuid) from public,anon;
grant execute on function public.activate_lead_buyer_agreement_draft(uuid) to authenticated;
