create or replace function public.customer_save_skylight_intake_response(p_field_id uuid,p_response jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  f public.skylight_project_intake_fields%rowtype;
  p public.skylight_projects%rowtype;
  v_text text;
  v_valid boolean:=true;
  v_present boolean;
begin
  select * into f from public.skylight_project_intake_fields where id=p_field_id;
  if f.id is null then raise exception 'Intake field not found.'; end if;
  select * into p from public.skylight_projects where id=f.project_id;
  if p.id is null or not private.user_has_skylight_project_access(p.id,auth.uid()) then raise exception 'Intake field not available.'; end if;
  if p.intake_status='reviewed' then raise exception 'This intake has already been reviewed by Skylight.'; end if;
  if octet_length(coalesce(p_response::text,''))>16000 then raise exception 'This response is too long.'; end if;
  v_text:=btrim(coalesce(case when jsonb_typeof(p_response)='string' then trim(both '"' from p_response::text) else p_response::text end,''));
  v_present:=private.skylight_response_present(p_response,f.question_type);

  if v_present then
    if f.question_type='single_select' and not exists(select 1 from jsonb_array_elements_text(f.options) o where o.value=v_text) then v_valid:=false; end if;
    if f.question_type='multi_select' then
      if jsonb_typeof(p_response)<>'array' then v_valid:=false;
      elsif exists(select 1 from jsonb_array_elements_text(p_response) x where not exists(select 1 from jsonb_array_elements_text(f.options) o where o.value=x.value)) then v_valid:=false;
      end if;
    end if;
    if f.question_type='checkbox' and jsonb_typeof(p_response)<>'boolean' then v_valid:=false; end if;
    if f.question_type='number' and (jsonb_typeof(p_response) not in('number','string') or v_text !~ '^-?[0-9]+([.][0-9]+)?$') then v_valid:=false; end if;
    if f.question_type='email' and (jsonb_typeof(p_response)<>'string' or v_text !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then v_valid:=false; end if;
    if f.question_type='url' and (jsonb_typeof(p_response)<>'string' or v_text !~* '^https?://[^[:space:]]+$') then v_valid:=false; end if;
    if f.question_type='date' and (jsonb_typeof(p_response)<>'string' or v_text !~ '^\d{4}-\d{2}-\d{2}$') then v_valid:=false; end if;
    if f.question_type in('short_text','long_text','phone') and jsonb_typeof(p_response)<>'string' then v_valid:=false; end if;
  end if;
  if not v_valid then raise exception 'Invalid response for %.',f.label; end if;

  update public.skylight_project_intake_fields set response=p_response,answered_at=now(),answered_by=auth.uid(),updated_at=now() where id=f.id;
  update public.skylight_projects set intake_status='in_progress',intake_submitted_at=null,updated_at=now() where id=p.id and intake_status in('pending','submitted');
  return jsonb_build_object('ok',true,'field_id',f.id);
end$$;
revoke all on function public.customer_save_skylight_intake_response(uuid,jsonb) from public,anon;
grant execute on function public.customer_save_skylight_intake_response(uuid,jsonb) to authenticated;

create or replace function public.admin_review_skylight_intake(p_project_id uuid,p_decision text,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.skylight_projects%rowtype; v_decision text:=lower(btrim(coalesce(p_decision,'')));
begin
  select * into p from public.skylight_projects where id=p_project_id for update;
  if p.id is null or not private.has_tenant_role(p.tenant_id,array['staff','admin','super_admin']) then raise exception 'Not authorized.'; end if;
  if v_decision not in('reviewed','changes_requested') then raise exception 'Invalid intake review decision.'; end if;
  if v_decision='reviewed' and p.intake_status<>'submitted' then raise exception 'Client onboarding must be submitted before it can be marked reviewed.'; end if;
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
