-- Preserve invite tokens across authentication and make only proof-class Admin uploads customer-reviewable by default.
create or replace function public.admin_create_eddm_portal_invite(p_interest_id uuid,p_base_url text default 'https://central-il-local-pros.vercel.app',p_send_email boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.skylight_eddm_interests%rowtype; v_client uuid; v_token uuid; v_email text; v_url text; v_base text; v_invite uuid;
begin
  select * into i from public.skylight_eddm_interests where id=p_interest_id;
  if i.id is null then raise exception 'EDDM advertiser not found.'; end if;
  if not private.has_tenant_role(i.tenant_id,array['staff','admin','super_admin']) then raise exception 'Not authorized.'; end if;
  v_email:=lower(nullif(btrim(coalesce(i.email,'')),''));
  if v_email is null then raise exception 'Add an email address before creating portal access.'; end if;
  v_client:=i.client_id;
  if v_client is null then
    insert into public.skylight_clients(tenant_id,business_id,prospect_id,company_name,contact_name,email,phone,city,state,postal_code,status,internal_notes,created_by,updated_by)
    values(i.tenant_id,i.business_id,i.prospect_id,i.business_name,i.contact_name,i.email,i.phone,i.city,i.state,i.postal_code,'prospect','Created for secure EDDM customer portal access.',auth.uid(),auth.uid()) returning id into v_client;
    update public.skylight_eddm_interests set client_id=v_client,updated_at=now() where id=i.id;
  end if;
  update public.skylight_client_portal_invites set revoked_at=now() where client_id=v_client and used_at is null and revoked_at is null and expires_at>now();
  v_token:=gen_random_uuid();
  insert into public.skylight_client_portal_invites(tenant_id,client_id,interest_id,token,invite_email,expires_at,invited_by)
  values(i.tenant_id,v_client,i.id,v_token,v_email,now()+interval '14 days',auth.uid()) returning id into v_invite;
  v_base:=regexp_replace(coalesce(nullif(btrim(p_base_url),''),'https://central-il-local-pros.vercel.app'),'/$','');
  if v_base !~ '^https://[A-Za-z0-9.-]+(?::[0-9]+)?$' then v_base:='https://central-il-local-pros.vercel.app'; end if;
  v_url:=v_base||'/eddm-portal/claim?token='||v_token::text;
  if coalesce(p_send_email,true) then
    insert into public.email_outbox(tenant_id,business_id,recipient_email,recipient_name,message_type,template_key,subject,body,cta_label,cta_url,status,scheduled_for)
    values(i.tenant_id,i.business_id,v_email,i.contact_name,'transactional','eddm_portal_invite','Your Skylight EDDM campaign portal is ready',
      'Skylight Reflections Marketing has opened secure portal access for your EDDM/direct-mail campaign. Sign in or create your Local Pros account using this email address, then use the secure invitation link to connect your campaign. The portal lets you upload artwork, review proofs, view invoices, track deadlines and follow production status.','Open Secure EDDM Portal',v_url,'queued',now());
  end if;
  insert into public.skylight_eddm_activity(tenant_id,market_id,interest_id,event_type,message,metadata,actor_user_id)
  values(i.tenant_id,i.market_id,i.id,'portal_invited','Secure EDDM customer portal invitation created.',jsonb_build_object('invite_id',v_invite,'email',v_email,'expires_at',now()+interval '14 days'),auth.uid());
  return jsonb_build_object('ok',true,'invite_id',v_invite,'client_id',v_client,'invite_email',v_email,'invite_url',v_url,'expires_at',now()+interval '14 days');
end$$;
revoke all on function public.admin_create_eddm_portal_invite(uuid,text,boolean) from public,anon;
grant execute on function public.admin_create_eddm_portal_invite(uuid,text,boolean) to authenticated;

create or replace function private.eddm_default_proof_customer_visibility() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.source='admin' and new.asset_type='proof' then
    new.customer_visible:=true;
    if new.review_status='not_required' then new.review_status:='pending'; end if;
  elsif new.source='admin' and new.asset_type='approved_proof' then
    new.customer_visible:=true;
    if new.review_status='not_required' then new.review_status:='approved'; end if;
  end if;
  return new;
end$$;
revoke all on function private.eddm_default_proof_customer_visibility() from public,anon,authenticated;
drop trigger if exists eddm_default_proof_customer_visibility on public.skylight_eddm_artwork_assets;
create trigger eddm_default_proof_customer_visibility before insert on public.skylight_eddm_artwork_assets for each row execute function private.eddm_default_proof_customer_visibility();
