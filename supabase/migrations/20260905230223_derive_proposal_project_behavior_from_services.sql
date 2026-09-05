create or replace function private.skylight_recompute_proposal(p_proposal_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_sub integer; v_discount integer; v_create boolean;
begin
  select coalesce(sum(i.line_total_cents),0)::integer,
         coalesce(bool_or(coalesce(s.create_project_on_acceptance,true)),true)
    into v_sub,v_create
  from public.skylight_proposal_items i
  left join public.skylight_service_catalog s on s.id=i.service_id
  where i.proposal_id=p_proposal_id;
  select discount_cents into v_discount from public.skylight_proposals where id=p_proposal_id;
  update public.skylight_proposals
  set subtotal_cents=v_sub,
      total_cents=greatest(0,v_sub-coalesce(v_discount,0)),
      create_project=v_create,
      updated_at=now()
  where id=p_proposal_id;
end$$;
revoke all on function private.skylight_recompute_proposal(uuid) from public,anon,authenticated;

comment on column public.skylight_proposals.create_project is 'Derived from selected service defaults: if any selected/custom line requires project delivery, the accepted proposal may create a project. Services configured for no project remain proposal/agreement/invoice only when all lines are no-project services.';
