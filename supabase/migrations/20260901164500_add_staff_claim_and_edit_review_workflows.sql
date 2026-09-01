create or replace function public.review_business_claim(p_claim_id uuid,p_decision text,p_notes text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_claim public.business_claims%rowtype;v_business public.businesses%rowtype;v_actor uuid:=auth.uid();v_claimant_user uuid;v_decision text:=lower(trim(coalesce(p_decision,'')));
begin
 if v_actor is null then raise exception 'authentication_required';end if;
 select * into v_claim from public.business_claims where id=p_claim_id for update;if not found then raise exception 'claim_not_found';end if;
 select * into v_business from public.businesses where id=v_claim.business_id;if not found then raise exception 'business_not_found';end if;
 if not exists(select 1 from public.user_roles ur where ur.user_id=v_actor and ur.tenant_id=v_business.tenant_id and ur.role in('staff','admin','super_admin')) then raise exception 'insufficient_privilege';end if;
 if v_decision not in('approve','reject') then raise exception 'invalid_decision';end if;
 if v_decision='approve' then
  v_claimant_user:=v_claim.claimant_user_id;
  if v_claimant_user is null then select u.id into v_claimant_user from auth.users u where lower(u.email)=lower(v_claim.email) order by u.created_at asc limit 1;end if;
  if v_claimant_user is null then raise exception 'claimant_account_required';end if;
  insert into public.business_owners(business_id,user_id,ownership_role) values(v_claim.business_id,v_claimant_user,'owner') on conflict(business_id,user_id) do update set ownership_role=excluded.ownership_role;
  update public.business_claims set claimant_user_id=v_claimant_user,status='approved',reviewed_by=v_actor,reviewed_at=now(),review_notes=nullif(trim(coalesce(p_notes,'')),'') where id=p_claim_id;
  update public.businesses set claimed=true,updated_at=now() where id=v_claim.business_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_business.tenant_id,v_actor,'business_claim_approved','Approved ownership claim '||p_claim_id::text||' for business '||v_claim.business_id::text);
 else
  update public.business_claims set status='rejected',reviewed_by=v_actor,reviewed_at=now(),review_notes=nullif(trim(coalesce(p_notes,'')),'') where id=p_claim_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_business.tenant_id,v_actor,'business_claim_rejected','Rejected ownership claim '||p_claim_id::text||' for business '||v_claim.business_id::text);
 end if;
 return jsonb_build_object('ok',true,'claim_id',p_claim_id,'decision',v_decision,'business_id',v_claim.business_id,'claimant_user_id',v_claimant_user);
end;$$;
revoke all on function public.review_business_claim(uuid,text,text) from public;grant execute on function public.review_business_claim(uuid,text,text) to authenticated;

create or replace function public.review_business_edit_request(p_request_id uuid,p_decision text,p_notes text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_req public.business_edit_requests%rowtype;v_business public.businesses%rowtype;v_actor uuid:=auth.uid();v_decision text:=lower(trim(coalesce(p_decision,'')));v_changes jsonb;
begin
 if v_actor is null then raise exception 'authentication_required';end if;
 select * into v_req from public.business_edit_requests where id=p_request_id for update;if not found then raise exception 'edit_request_not_found';end if;
 select * into v_business from public.businesses where id=v_req.business_id and tenant_id=v_req.tenant_id;if not found then raise exception 'business_not_found';end if;
 if not exists(select 1 from public.user_roles ur where ur.user_id=v_actor and ur.tenant_id=v_req.tenant_id and ur.role in('staff','admin','super_admin')) then raise exception 'insufficient_privilege';end if;
 if v_decision not in('approve','reject') then raise exception 'invalid_decision';end if;
 if v_decision='approve' then
  if v_req.request_type<>'profile_update' then raise exception 'unsupported_request_type';end if;v_changes:=coalesce(v_req.proposed_changes,'{}'::jsonb);
  update public.businesses set description=case when v_changes?'description' then nullif(trim(v_changes->>'description'),'') else description end,phone=case when v_changes?'phone' then nullif(trim(v_changes->>'phone'),'') else phone end,website=case when v_changes?'website' then nullif(trim(v_changes->>'website'),'') else website end,hours=case when v_changes?'hours' then nullif(trim(v_changes->>'hours'),'') else hours end,updated_at=now() where id=v_req.business_id and tenant_id=v_req.tenant_id;
  update public.business_edit_requests set status='approved',staff_notes=nullif(trim(coalesce(p_notes,'')),''),reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_request_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_req.tenant_id,v_actor,'business_edit_approved','Approved owner edit request '||p_request_id::text||' for business '||v_req.business_id::text);
 else
  update public.business_edit_requests set status='rejected',staff_notes=nullif(trim(coalesce(p_notes,'')),''),reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_request_id;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_req.tenant_id,v_actor,'business_edit_rejected','Rejected owner edit request '||p_request_id::text||' for business '||v_req.business_id::text);
 end if;
 return jsonb_build_object('ok',true,'request_id',p_request_id,'decision',v_decision,'business_id',v_req.business_id);
end;$$;
revoke all on function public.review_business_edit_request(uuid,text,text) from public;grant execute on function public.review_business_edit_request(uuid,text,text) to authenticated;
