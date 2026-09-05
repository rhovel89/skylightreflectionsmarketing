-- Atomic EDDM spot reservation/release helpers prevent accidental or concurrent double booking.
create or replace function public.admin_reserve_eddm_spot(
  p_spot_id uuid,
  p_interest_id uuid,
  p_mode text default 'reserve',
  p_agreed_price_cents integer default null,
  p_hold_minutes integer default 30
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_tenant uuid; v_market uuid; v_interest_market uuid; v_interest_tenant uuid;
  v_mode text:=lower(btrim(coalesce(p_mode,'reserve'))); v_status text; v_code text; v_count integer;
begin
  if v_mode not in ('hold','reserve') then raise exception 'Reservation mode must be hold or reserve.'; end if;
  if p_agreed_price_cents is not null and p_agreed_price_cents < 0 then raise exception 'Agreed price cannot be negative.'; end if;
  select tenant_id,market_id,slot_code into v_tenant,v_market,v_code from public.skylight_eddm_spots where id=p_spot_id;
  if v_tenant is null then raise exception 'EDDM spot not found.'; end if;
  if not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'Not authorized.'; end if;
  select tenant_id,market_id into v_interest_tenant,v_interest_market from public.skylight_eddm_interests where id=p_interest_id;
  if v_interest_tenant is null or v_interest_tenant<>v_tenant or v_interest_market is distinct from v_market then raise exception 'Advertiser does not belong to this EDDM campaign.'; end if;

  update public.skylight_eddm_spots
  set interest_id=p_interest_id,
      status=case when v_mode='hold' then 'held' else 'reserved' end,
      agreed_price_cents=coalesce(p_agreed_price_cents,agreed_price_cents),
      held_until=case when v_mode='hold' then now()+make_interval(mins=>greatest(5,least(coalesce(p_hold_minutes,30),1440))) else null end,
      committed_at=case when v_mode='reserve' then coalesce(committed_at,now()) else committed_at end,
      released_at=null,
      updated_by=auth.uid(),updated_at=now()
  where id=p_spot_id
    and (
      (interest_id is null and status in ('available','released'))
      or (interest_id=p_interest_id and status='held')
      or (interest_id=p_interest_id and status='reserved')
    );
  get diagnostics v_count=row_count;
  if v_count<>1 then raise exception 'This EDDM spot is already assigned to another advertiser.'; end if;

  if v_mode='reserve' then
    update public.skylight_eddm_interests
    set status=case when status in('lost','cancelled','won') then status else 'committed' end,
        commitment_amount_cents=coalesce(p_agreed_price_cents,commitment_amount_cents),
        committed_at=coalesce(committed_at,now()),updated_at=now()
    where id=p_interest_id;
  end if;
  select status into v_status from public.skylight_eddm_spots where id=p_spot_id;
  insert into public.skylight_eddm_activity(tenant_id,market_id,interest_id,spot_id,event_type,message,metadata,actor_user_id)
  values(v_tenant,v_market,p_interest_id,p_spot_id,case when v_mode='hold' then 'spot_held' else 'spot_reserved' end,
         case when v_mode='hold' then 'Spot '||v_code||' placed on hold.' else 'Spot '||v_code||' reserved for advertiser.' end,
         jsonb_build_object('slot_code',v_code,'agreed_price_cents',p_agreed_price_cents,'mode',v_mode),auth.uid());
  return jsonb_build_object('ok',true,'spot_id',p_spot_id,'slot_code',v_code,'status',v_status,'interest_id',p_interest_id);
end$$;
revoke all on function public.admin_reserve_eddm_spot(uuid,uuid,text,integer,integer) from public,anon;
grant execute on function public.admin_reserve_eddm_spot(uuid,uuid,text,integer,integer) to authenticated;

create or replace function public.admin_release_eddm_spot(p_spot_id uuid,p_reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_market uuid; v_interest uuid; v_code text;
begin
  select tenant_id,market_id,interest_id,slot_code into v_tenant,v_market,v_interest,v_code from public.skylight_eddm_spots where id=p_spot_id;
  if v_tenant is null then raise exception 'EDDM spot not found.'; end if;
  if not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'Not authorized.'; end if;
  update public.skylight_eddm_spots
  set interest_id=null,status='available',agreed_price_cents=null,held_until=null,committed_at=null,released_at=now(),notes=coalesce(nullif(left(btrim(coalesce(p_reason,'')),1200),''),notes),updated_by=auth.uid(),updated_at=now()
  where id=p_spot_id;
  insert into public.skylight_eddm_activity(tenant_id,market_id,interest_id,spot_id,event_type,message,metadata,actor_user_id)
  values(v_tenant,v_market,v_interest,p_spot_id,'spot_released','Spot '||v_code||' released back to inventory.',jsonb_build_object('slot_code',v_code,'reason',nullif(left(btrim(coalesce(p_reason,'')),1200),'')),auth.uid());
  return jsonb_build_object('ok',true,'spot_id',p_spot_id,'slot_code',v_code,'status','available');
end$$;
revoke all on function public.admin_release_eddm_spot(uuid,text) from public,anon;
grant execute on function public.admin_release_eddm_spot(uuid,text) to authenticated;
