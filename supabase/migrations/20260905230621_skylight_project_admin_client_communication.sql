create or replace function public.admin_send_skylight_project_message(p_project_id uuid,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.skylight_projects%rowtype; v_id uuid;
begin
  select * into p from public.skylight_projects where id=p_project_id;
  if p.id is null then raise exception 'Project not found.'; end if;
  if not private.has_tenant_role(p.tenant_id,array['staff','admin','super_admin']) then raise exception 'Not authorized.'; end if;
  if char_length(btrim(coalesce(p_body,''))) not between 1 and 5000 then raise exception 'Message must be between 1 and 5000 characters.'; end if;
  insert into public.skylight_project_messages(tenant_id,project_id,sender_user_id,sender_type,body,customer_visible)
  values(p.tenant_id,p.id,auth.uid(),'staff',btrim(p_body),true) returning id into v_id;
  update public.skylight_project_messages set read_by_staff_at=coalesce(read_by_staff_at,now()) where project_id=p.id and sender_type='customer' and read_by_staff_at is null;
  perform private.notify_skylight_client_users(p.client_id,'New Skylight project message',left(btrim(p_body),500),'/account/skylight','skylight_staff_project_message:'||v_id::text);
  insert into public.skylight_project_activity(tenant_id,client_id,project_id,event_type,message,actor_user_id)
  values(p.tenant_id,p.client_id,p.id,'staff_message','Skylight sent a client-visible project message.',auth.uid());
  return jsonb_build_object('ok',true,'message_id',v_id);
end$$;
revoke all on function public.admin_send_skylight_project_message(uuid,text) from public,anon;
grant execute on function public.admin_send_skylight_project_message(uuid,text) to authenticated;

create or replace function public.admin_set_skylight_client_access(p_access_id uuid,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.skylight_client_portal_access%rowtype;
begin
  if p_status not in('active','revoked') then raise exception 'Invalid access status.'; end if;
  select * into a from public.skylight_client_portal_access where id=p_access_id;
  if a.id is null then raise exception 'Client access not found.'; end if;
  if not private.has_tenant_role(a.tenant_id,array['staff','admin','super_admin']) then raise exception 'Not authorized.'; end if;
  update public.skylight_client_portal_access set status=p_status,updated_at=now() where id=a.id;
  return jsonb_build_object('ok',true,'access_id',a.id,'status',p_status);
end$$;
revoke all on function public.admin_set_skylight_client_access(uuid,text) from public,anon;
grant execute on function public.admin_set_skylight_client_access(uuid,text) to authenticated;
