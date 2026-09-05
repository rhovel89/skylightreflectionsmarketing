-- Make nullable market/category alert keys behave as a true preference key.
create unique index if not exists consumer_local_alert_preferences_key_uidx
on public.consumer_local_alert_preferences(user_id,location_id,category_id,alert_type) nulls not distinct;

create or replace function public.upsert_consumer_local_alert(p_location_id uuid,p_category_id uuid,p_alert_type text,p_email boolean,p_in_app boolean,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tenant uuid;v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_alert_type not in ('deals','new_businesses','local_updates') then raise exception 'invalid_alert_type'; end if;
  select coalesce((select tenant_id from public.locations where id=p_location_id),(select tenant_id from public.categories where id=p_category_id)) into v_tenant;
  if v_tenant is null then raise exception 'a valid market or category is required'; end if;
  if p_location_id is not null and not exists(select 1 from public.locations where id=p_location_id and tenant_id=v_tenant and is_active) then raise exception 'invalid_location'; end if;
  if p_category_id is not null and not exists(select 1 from public.categories where id=p_category_id and tenant_id=v_tenant and is_active) then raise exception 'invalid_category'; end if;
  update public.consumer_local_alert_preferences
  set email_enabled=coalesce(p_email,true),in_app_enabled=coalesce(p_in_app,true),active=coalesce(p_active,true),updated_at=now()
  where user_id=auth.uid()
    and location_id is not distinct from p_location_id
    and category_id is not distinct from p_category_id
    and alert_type=p_alert_type
  returning id into v_id;
  if v_id is null then
    insert into public.consumer_local_alert_preferences(tenant_id,user_id,location_id,category_id,alert_type,email_enabled,in_app_enabled,active,updated_at)
    values(v_tenant,auth.uid(),p_location_id,p_category_id,p_alert_type,coalesce(p_email,true),coalesce(p_in_app,true),coalesce(p_active,true),now())
    returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.upsert_consumer_local_alert(uuid,uuid,text,boolean,boolean,boolean) from public;
grant execute on function public.upsert_consumer_local_alert(uuid,uuid,text,boolean,boolean,boolean) to authenticated;
