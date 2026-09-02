create or replace function public.route_directory_lead(p_lead_id uuid,p_business_id uuid,p_route_reason text default 'Staff matched by service and market',p_route_rank integer default 0) returns uuid language plpgsql set search_path='' as $$
declare v_tenant uuid;v_context_business uuid;v_recipient uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select tenant_id,business_id into v_tenant,v_context_business from public.leads where id=p_lead_id;
  if v_tenant is null then raise exception 'lead_not_found'; end if;
  if not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'insufficient_privilege'; end if;
  if v_context_business is not null and v_context_business is distinct from p_business_id then raise exception 'business_specific_lead_requires_target_business'; end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=v_tenant and b.status='published') then raise exception 'published_business_required'; end if;
  insert into public.lead_recipients(tenant_id,lead_id,business_id,route_reason,route_rank,status,routed_at,updated_at)
  values(v_tenant,p_lead_id,p_business_id,nullif(trim(coalesce(p_route_reason,'')),''),greatest(coalesce(p_route_rank,0),0),'new',now(),now())
  on conflict(lead_id,business_id) do nothing returning id into v_recipient;
  if v_recipient is null then select id into v_recipient from public.lead_recipients where lead_id=p_lead_id and business_id=p_business_id; end if;
  update public.leads set assigned_business_id=coalesce(assigned_business_id,p_business_id),status=case when status='new' then 'routed' else status end where id=p_lead_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),'lead_routed','Routed lead '||p_lead_id||' to business '||p_business_id);
  return v_recipient;
end $$;
create unique index if not exists lead_pricing_rules_default_vertical_unique on public.lead_pricing_rules(tenant_id,vertical) where category_id is null;
