create or replace function public.admin_review_skylight_intake(p_project_id uuid,p_decision text,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.skylight_projects%rowtype; v_decision text:=lower(btrim(coalesce(p_decision,'')));
begin
  select * into p from public.skylight_projects where id=p_project_id;
  if p.id is null or not private.has_tenant_role(p.tenant_id,array['staff','admin','super_admin']) then raise exception 'Not authorized.'; end if;
  if v_decision not in('reviewed','changes_requested') then raise exception 'Invalid intake review decision.'; end if;
  if v_decision='reviewed' then
    update public.skylight_projects set intake_status='reviewed',intake_reviewed_at=now(),intake_reviewed_by=auth.uid(),client_visible_update=coalesce(nullif(left(btrim(coalesce(p_note,'')),5000),''),client_visible_update),updated_at=now() where id=p.id;
    perform private.notify_skylight_client_users(p.client_id,'Skylight onboarding reviewed','Your onboarding information for '||p.project_number||' has been reviewed.','/account/skylight/intake','skylight_intake_reviewed:'||p.id::text);
  else
    update public.skylight_projects set intake_status='in_progress',intake_submitted_at=null,intake_reviewed_at=null,intake_reviewed_by=null,client_visible_update=coalesce(nullif(left(btrim(coalesce(p_note,'')),5000),''),client_visible_update),updated_at=now() where id=p.id;
    perform private.notify_skylight_client_users(p.client_id,'Skylight onboarding needs an update',coalesce(nullif(left(btrim(coalesce(p_note,'')),900),''),'Skylight requested an update to your onboarding information.'),'/account/skylight/intake','skylight_intake_changes:'||p.id::text||':'||extract(epoch from now())::bigint::text);
  end if;
  insert into public.skylight_project_activity(tenant_id,client_id,project_id,event_type,message,metadata,actor_user_id)
  values(p.tenant_id,p.client_id,p.id,'intake_reviewed',case when v_decision='reviewed' then 'Staff marked client onboarding reviewed.' else 'Staff requested onboarding changes.' end,jsonb_build_object('decision',v_decision,'note',nullif(left(btrim(coalesce(p_note,'')),1200),'')),auth.uid());
  return jsonb_build_object('ok',true,'project_id',p.id,'status',case when v_decision='reviewed' then 'reviewed' else 'in_progress' end);
end$$;
revoke all on function public.admin_review_skylight_intake(uuid,text,text) from public,anon;
grant execute on function public.admin_review_skylight_intake(uuid,text,text) to authenticated;
comment on function public.admin_review_skylight_intake(uuid,text,text) is 'Hardened staff-only intake review RPC. SECURITY DEFINER is required only to call private customer notification helpers; tenant role is checked before mutation.';
