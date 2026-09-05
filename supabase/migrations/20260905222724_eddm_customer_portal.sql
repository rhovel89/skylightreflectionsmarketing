-- Secure EDDM customer portal: explicit client-account access, invitations, customer artwork/proof review, messages and customer-safe notifications.

create table if not exists public.skylight_client_portal_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.skylight_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text not null default 'primary' check(access_role in ('primary','billing','creative')),
  status text not null default 'active' check(status in ('active','revoked')),
  invited_email text,
  granted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id,user_id)
);
create index if not exists skylight_client_portal_access_user_idx on public.skylight_client_portal_access(user_id,status,client_id);
create index if not exists skylight_client_portal_access_client_idx on public.skylight_client_portal_access(client_id,status,user_id);

create table if not exists public.skylight_client_portal_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.skylight_clients(id) on delete cascade,
  interest_id uuid references public.skylight_eddm_interests(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  invite_email text not null,
  expires_at timestamptz not null default (now()+interval '14 days'),
  used_at timestamptz,
  used_by uuid references auth.users(id),
  revoked_at timestamptz,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists skylight_client_portal_invites_client_idx on public.skylight_client_portal_invites(client_id,created_at desc);
create index if not exists skylight_client_portal_invites_interest_idx on public.skylight_client_portal_invites(interest_id,created_at desc);

create table if not exists public.skylight_eddm_portal_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  interest_id uuid not null references public.skylight_eddm_interests(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_type text not null check(sender_type in ('customer','staff','system')),
  body text not null check(char_length(body) between 1 and 4000),
  customer_visible boolean not null default true,
  read_by_customer_at timestamptz,
  read_by_staff_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists skylight_eddm_portal_messages_interest_idx on public.skylight_eddm_portal_messages(interest_id,created_at);
create index if not exists skylight_eddm_portal_messages_staff_unread_idx on public.skylight_eddm_portal_messages(tenant_id,created_at desc) where sender_type='customer' and read_by_staff_at is null;

alter table public.skylight_eddm_artwork_assets
  add column if not exists source text not null default 'admin' check(source in ('admin','customer')),
  add column if not exists customer_visible boolean not null default false,
  add column if not exists review_status text not null default 'not_required' check(review_status in ('not_required','pending','approved','changes_requested')),
  add column if not exists customer_review_note text,
  add column if not exists customer_reviewed_at timestamptz,
  add column if not exists customer_reviewed_by uuid references auth.users(id);

alter table public.skylight_client_portal_access enable row level security;
alter table public.skylight_client_portal_invites enable row level security;
alter table public.skylight_eddm_portal_messages enable row level security;

drop policy if exists "staff manage skylight portal access" on public.skylight_client_portal_access;
create policy "staff manage skylight portal access" on public.skylight_client_portal_access for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
drop policy if exists "customer read own skylight portal access" on public.skylight_client_portal_access;
create policy "customer read own skylight portal access" on public.skylight_client_portal_access for select to authenticated
using(user_id=(select auth.uid()) and status='active');

drop policy if exists "staff manage skylight portal invites" on public.skylight_client_portal_invites;
create policy "staff manage skylight portal invites" on public.skylight_client_portal_invites for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

drop policy if exists "staff manage eddm portal messages" on public.skylight_eddm_portal_messages;
create policy "staff manage eddm portal messages" on public.skylight_eddm_portal_messages for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

grant select on public.skylight_client_portal_access to authenticated;
grant select,insert,update,delete on public.skylight_client_portal_invites,public.skylight_eddm_portal_messages to authenticated;
revoke all on public.skylight_client_portal_access,public.skylight_client_portal_invites,public.skylight_eddm_portal_messages from anon;

create or replace function private.user_has_skylight_client_access(p_client_id uuid,p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.skylight_client_portal_access a
    where a.client_id=p_client_id and a.user_id=p_user_id and a.status='active'
  )
$$;
revoke all on function private.user_has_skylight_client_access(uuid,uuid) from public,anon,authenticated;

create or replace function private.user_has_eddm_interest_access(p_interest_id uuid,p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.skylight_eddm_interests i
    join public.skylight_client_portal_access a on a.client_id=i.client_id and a.tenant_id=i.tenant_id
    where i.id=p_interest_id and a.user_id=p_user_id and a.status='active'
  )
$$;
revoke all on function private.user_has_eddm_interest_access(uuid,uuid) from public,anon,authenticated;

-- Customers may read/upload only objects whose third folder is an EDDM interest they explicitly have access to.
drop policy if exists "eddm customers read own assets" on storage.objects;
create policy "eddm customers read own assets" on storage.objects for select to authenticated using(
  bucket_id='eddm-assets'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.user_has_eddm_interest_access(((storage.foldername(name))[3])::uuid,(select auth.uid()))
);
drop policy if exists "eddm customers upload own assets" on storage.objects;
create policy "eddm customers upload own assets" on storage.objects for insert to authenticated with check(
  bucket_id='eddm-assets'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.user_has_eddm_interest_access(((storage.foldername(name))[3])::uuid,(select auth.uid()))
);

create or replace function private.notify_eddm_portal_users(p_interest_id uuid,p_title text,p_body text,p_event_key text) returns integer
language plpgsql security definer set search_path='' as $$
declare r record; v_tenant uuid; v_count integer:=0; v_inserted integer; v_email text;
begin
  select tenant_id into v_tenant from public.skylight_eddm_interests where id=p_interest_id;
  if v_tenant is null then return 0; end if;
  for r in
    select distinct a.user_id,u.email
    from public.skylight_eddm_interests i
    join public.skylight_client_portal_access a on a.client_id=i.client_id and a.tenant_id=i.tenant_id and a.status='active'
    join auth.users u on u.id=a.user_id
    where i.id=p_interest_id
  loop
    insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
    select r.user_id,v_tenant,left(p_title,180),left(p_body,1200),'/account/eddm',left(p_event_key,240)
    where not exists(select 1 from public.notifications n where n.user_id=r.user_id and n.event_key=left(p_event_key,240));
    get diagnostics v_inserted=row_count;
    if v_inserted=1 then
      v_count:=v_count+1;
      v_email:=nullif(btrim(coalesce(r.email,'')),'');
      if v_email is not null then
        insert into public.email_outbox(tenant_id,recipient_email,message_type,template_key,subject,body,cta_label,cta_url,status,scheduled_for)
        values(v_tenant,v_email,'transactional','eddm_portal_update',left(p_title,180),left(p_body,5000),'Open EDDM Portal','https://central-il-local-pros.vercel.app/account/eddm','queued',now());
      end if;
    end if;
  end loop;
  return v_count;
end$$;
revoke all on function private.notify_eddm_portal_users(uuid,text,text,text) from public,anon,authenticated;

create or replace function private.notify_eddm_admins(p_tenant_id uuid,p_title text,p_body text,p_event_key text) returns integer
language plpgsql security definer set search_path='' as $$
declare r record; v_count integer:=0; v_inserted integer;
begin
  for r in select distinct user_id from public.user_roles where tenant_id=p_tenant_id and role in('admin','super_admin') loop
    insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
    select r.user_id,p_tenant_id,left(p_title,180),left(p_body,1200),'/admin/skylight-eddm',left(p_event_key,240)
    where not exists(select 1 from public.notifications n where n.user_id=r.user_id and n.event_key=left(p_event_key,240));
    get diagnostics v_inserted=row_count; v_count:=v_count+v_inserted;
  end loop;
  return v_count;
end$$;
revoke all on function private.notify_eddm_admins(uuid,text,text,text) from public,anon,authenticated;

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
  v_url:=v_base||'/account/eddm/claim?token='||v_token::text;
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

create or replace function public.claim_skylight_client_portal_invite(p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.skylight_client_portal_invites%rowtype; v_uid uuid:=auth.uid(); v_email text;
begin
  if v_uid is null then raise exception 'Sign in before accepting this portal invitation.'; end if;
  select lower(coalesce(auth.jwt()->>'email','')) into v_email;
  select * into v from public.skylight_client_portal_invites where token=p_token for update;
  if v.id is null or v.revoked_at is not null or v.used_at is not null or v.expires_at<=now() then raise exception 'This portal invitation is invalid or has expired.'; end if;
  if lower(v.invite_email)<>v_email then raise exception 'Sign in with the email address that received this portal invitation.'; end if;
  insert into public.skylight_client_portal_access(tenant_id,client_id,user_id,access_role,status,invited_email,granted_by,accepted_at)
  values(v.tenant_id,v.client_id,v_uid,'primary','active',v.invite_email,v.invited_by,now())
  on conflict(client_id,user_id) do update set status='active',invited_email=excluded.invited_email,accepted_at=coalesce(public.skylight_client_portal_access.accepted_at,now()),updated_at=now();
  update public.skylight_client_portal_invites set used_at=now(),used_by=v_uid where id=v.id;
  insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
  values(v_uid,v.tenant_id,'EDDM portal connected','Your Skylight EDDM campaign is now connected to this account.','/account/eddm','eddm_portal_connected:'||v.client_id::text||':'||v_uid::text);
  perform private.notify_eddm_admins(v.tenant_id,'EDDM customer joined the portal',v.invite_email||' connected secure EDDM portal access.','eddm_portal_claimed:'||v.id::text);
  if v.interest_id is not null then
    insert into public.skylight_eddm_activity(tenant_id,market_id,interest_id,event_type,message,metadata,actor_user_id)
    select i.tenant_id,i.market_id,i.id,'portal_claimed','Customer accepted secure EDDM portal access.',jsonb_build_object('user_id',v_uid),v_uid from public.skylight_eddm_interests i where i.id=v.interest_id;
  end if;
  return jsonb_build_object('ok',true,'client_id',v.client_id,'interest_id',v.interest_id);
end$$;
revoke all on function public.claim_skylight_client_portal_invite(uuid) from public,anon;
grant execute on function public.claim_skylight_client_portal_invite(uuid) to authenticated;

create or replace function public.admin_set_skylight_client_portal_access(p_access_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.skylight_client_portal_access%rowtype; v_status text:=lower(btrim(coalesce(p_status,'')));
begin
  select * into a from public.skylight_client_portal_access where id=p_access_id;
  if a.id is null then raise exception 'Portal access record not found.'; end if;
  if not private.has_tenant_role(a.tenant_id,array['admin','super_admin']) then raise exception 'Not authorized.'; end if;
  if v_status not in('active','revoked') then raise exception 'Invalid portal access status.'; end if;
  update public.skylight_client_portal_access set status=v_status,updated_at=now() where id=a.id;
  return jsonb_build_object('ok',true,'status',v_status);
end$$;
revoke all on function public.admin_set_skylight_client_portal_access(uuid,text) from public,anon;
grant execute on function public.admin_set_skylight_client_portal_access(uuid,text) to authenticated;

create or replace function public.get_my_eddm_portal() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  return jsonb_build_object(
    'clients',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'company_name',c.company_name,'contact_name',c.contact_name,'email',c.email,'phone',c.phone,'access_role',a.access_role))
      from public.skylight_client_portal_access a join public.skylight_clients c on c.id=a.client_id
      where a.user_id=v_uid and a.status='active'),'[]'::jsonb),
    'campaigns',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'client_id',i.client_id,'business_name',i.business_name,'mode',i.mode,'status',i.status,'artwork_status',i.artwork_status,'artwork_due_date',i.artwork_due_date,
      'city',i.city,'state',i.state,'postal_code',i.postal_code,'area_description',i.area_description,'desired_piece_count',i.desired_piece_count,'package_key',i.package_key,'smart_coupon',i.smart_coupon,
      'market_id',m.id,'market_name',m.name,'production_status',m.production_status,'target_piece_count',m.target_piece_count,'target_mail_date',m.target_mail_date,'actual_mail_date',m.actual_mail_date,'market_artwork_due_date',m.artwork_due_date,'print_due_date',m.print_due_date,
      'invoice',case when inv.id is null then null else jsonb_build_object('id',inv.id,'invoice_number',inv.invoice_number,'status',inv.status,'issue_date',inv.issue_date,'due_date',inv.due_date,'total_cents',inv.total_cents,'amount_paid_cents',inv.amount_paid_cents,'balance_due_cents',inv.balance_due_cents,'deposit_required_cents',inv.deposit_required_cents,'public_token',inv.public_token,'hosted_invoice_url',inv.hosted_invoice_url) end
    ) order by i.created_at desc)
      from public.skylight_eddm_interests i
      join public.skylight_client_portal_access a on a.client_id=i.client_id and a.tenant_id=i.tenant_id and a.user_id=v_uid and a.status='active'
      left join public.skylight_eddm_markets m on m.id=i.market_id
      left join public.skylight_invoices inv on inv.id=i.invoice_id),'[]'::jsonb),
    'spots',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'interest_id',s.interest_id,'slot_code',s.slot_code,'status',s.status,'agreed_price_cents',s.agreed_price_cents,'package_name',p.name,'package_key',s.package_key) order by s.slot_code)
      from public.skylight_eddm_spots s
      join public.skylight_eddm_interests i on i.id=s.interest_id
      join public.skylight_client_portal_access a on a.client_id=i.client_id and a.user_id=v_uid and a.status='active'
      left join public.skylight_eddm_packages p on p.id=s.package_id),'[]'::jsonb),
    'assets',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'interest_id',x.interest_id,'asset_type',x.asset_type,'status',x.status,'file_name',x.file_name,'storage_path',x.storage_path,'mime_type',x.mime_type,'file_size_bytes',x.file_size_bytes,'source',x.source,'review_status',x.review_status,'customer_review_note',x.customer_review_note,'customer_reviewed_at',x.customer_reviewed_at,'created_at',x.created_at) order by x.created_at desc)
      from public.skylight_eddm_artwork_assets x
      join public.skylight_eddm_interests i on i.id=x.interest_id
      join public.skylight_client_portal_access a on a.client_id=i.client_id and a.user_id=v_uid and a.status='active'
      where x.customer_visible=true and x.asset_type in('customer_artwork','proof','approved_proof','print_ready')),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',msg.id,'interest_id',msg.interest_id,'sender_type',msg.sender_type,'body',msg.body,'created_at',msg.created_at) order by msg.created_at)
      from public.skylight_eddm_portal_messages msg
      join public.skylight_eddm_interests i on i.id=msg.interest_id
      join public.skylight_client_portal_access a on a.client_id=i.client_id and a.user_id=v_uid and a.status='active'
      where msg.customer_visible=true),'[]'::jsonb)
  );
end$$;
revoke all on function public.get_my_eddm_portal() from public,anon;
grant execute on function public.get_my_eddm_portal() to authenticated;

create or replace function public.customer_register_eddm_artwork(p_interest_id uuid,p_file_name text,p_storage_path text,p_mime_type text,p_file_size_bytes bigint,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.skylight_eddm_interests%rowtype; v_id uuid; v_uid uuid:=auth.uid(); v_folder text[];
begin
  if v_uid is null or not private.user_has_eddm_interest_access(p_interest_id,v_uid) then raise exception 'You do not have access to this EDDM campaign.'; end if;
  select * into i from public.skylight_eddm_interests where id=p_interest_id;
  if i.status in('lost','cancelled') then raise exception 'Artwork uploads are closed for this campaign.'; end if;
  if p_file_size_bytes is null or p_file_size_bytes<=0 or p_file_size_bytes>26214400 then raise exception 'Artwork must be 25 MB or smaller.'; end if;
  if p_mime_type not in('image/jpeg','image/png','image/webp','application/pdf') then raise exception 'Use JPG, PNG, WebP or PDF artwork.'; end if;
  v_folder:=storage.foldername(p_storage_path);
  if array_length(v_folder,1)<3 or v_folder[1]<>i.tenant_id::text or v_folder[3]<>i.id::text then raise exception 'Invalid artwork storage path.'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='eddm-assets' and o.name=p_storage_path) then raise exception 'Uploaded artwork file was not found.'; end if;
  insert into public.skylight_eddm_artwork_assets(tenant_id,market_id,interest_id,asset_type,status,file_name,storage_path,mime_type,file_size_bytes,notes,uploaded_by,source,customer_visible,review_status)
  values(i.tenant_id,i.market_id,i.id,'customer_artwork','uploaded',left(p_file_name,240),p_storage_path,p_mime_type,p_file_size_bytes,nullif(left(btrim(coalesce(p_note,'')),1600),''),v_uid,'customer',true,'not_required') returning id into v_id;
  update public.skylight_eddm_interests set artwork_status=case when artwork_status in('approved','print_ready') then artwork_status else 'received' end,updated_at=now() where id=i.id;
  insert into public.skylight_eddm_activity(tenant_id,market_id,interest_id,event_type,message,metadata,actor_user_id)
  values(i.tenant_id,i.market_id,i.id,'customer_artwork_uploaded','Customer uploaded EDDM artwork.',jsonb_build_object('asset_id',v_id,'file_name',left(p_file_name,240)),v_uid);
  perform private.notify_eddm_admins(i.tenant_id,'New EDDM artwork uploaded',i.business_name||' uploaded artwork in the customer portal.','eddm_customer_artwork:'||v_id::text);
  return jsonb_build_object('ok',true,'asset_id',v_id);
end$$;
revoke all on function public.customer_register_eddm_artwork(uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.customer_register_eddm_artwork(uuid,text,text,text,bigint,text) to authenticated;

create or replace function public.customer_review_eddm_proof(p_asset_id uuid,p_decision text,p_note text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.skylight_eddm_artwork_assets%rowtype; i public.skylight_eddm_interests%rowtype; v_uid uuid:=auth.uid(); v_decision text:=lower(btrim(coalesce(p_decision,'')));
begin
  select * into a from public.skylight_eddm_artwork_assets where id=p_asset_id;
  if a.id is null or a.interest_id is null or a.customer_visible=false or a.asset_type not in('proof','approved_proof') then raise exception 'Customer proof not found.'; end if;
  if v_uid is null or not private.user_has_eddm_interest_access(a.interest_id,v_uid) then raise exception 'You do not have access to this proof.'; end if;
  if v_decision not in('approve','changes') then raise exception 'Choose approve or request changes.'; end if;
  select * into i from public.skylight_eddm_interests where id=a.interest_id;
  update public.skylight_eddm_artwork_assets set
    review_status=case when v_decision='approve' then 'approved' else 'changes_requested' end,
    status=case when v_decision='approve' then 'approved' else 'needs_changes' end,
    customer_review_note=nullif(left(btrim(coalesce(p_note,'')),2000),''),customer_reviewed_at=now(),customer_reviewed_by=v_uid,
    approved_at=case when v_decision='approve' then now() else approved_at end,
    updated_at=now()
  where id=a.id;
  update public.skylight_eddm_interests set artwork_status=case when v_decision='approve' then 'approved' else 'needs_changes' end,artwork_approved_at=case when v_decision='approve' then now() else null end,updated_at=now() where id=i.id;
  insert into public.skylight_eddm_activity(tenant_id,market_id,interest_id,event_type,message,metadata,actor_user_id)
  values(i.tenant_id,i.market_id,i.id,case when v_decision='approve' then 'proof_approved_by_customer' else 'proof_changes_requested' end,
    case when v_decision='approve' then 'Customer approved EDDM proof.' else 'Customer requested changes to EDDM proof.' end,
    jsonb_build_object('asset_id',a.id,'note',nullif(left(btrim(coalesce(p_note,'')),2000),'')),v_uid);
  perform private.notify_eddm_admins(i.tenant_id,case when v_decision='approve' then 'EDDM proof approved' else 'EDDM proof changes requested' end,
    i.business_name||case when v_decision='approve' then ' approved the proof in the customer portal.' else ' requested proof changes in the customer portal.' end,
    'eddm_proof_review:'||a.id::text||':'||v_decision);
  return jsonb_build_object('ok',true,'decision',v_decision);
end$$;
revoke all on function public.customer_review_eddm_proof(uuid,text,text) from public,anon;
grant execute on function public.customer_review_eddm_proof(uuid,text,text) to authenticated;

create or replace function public.customer_send_eddm_portal_message(p_interest_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.skylight_eddm_interests%rowtype; v_uid uuid:=auth.uid(); v_body text:=btrim(coalesce(p_body,'')); v_id uuid;
begin
  if v_uid is null or not private.user_has_eddm_interest_access(p_interest_id,v_uid) then raise exception 'You do not have access to this EDDM campaign.'; end if;
  if length(v_body)<1 or length(v_body)>4000 then raise exception 'Message must be between 1 and 4000 characters.'; end if;
  select * into i from public.skylight_eddm_interests where id=p_interest_id;
  insert into public.skylight_eddm_portal_messages(tenant_id,interest_id,sender_user_id,sender_type,body,customer_visible)
  values(i.tenant_id,i.id,v_uid,'customer',v_body,true) returning id into v_id;
  perform private.notify_eddm_admins(i.tenant_id,'New EDDM customer message',i.business_name||' sent a message from the EDDM customer portal.','eddm_customer_message:'||v_id::text);
  return jsonb_build_object('ok',true,'message_id',v_id);
end$$;
revoke all on function public.customer_send_eddm_portal_message(uuid,text) from public,anon;
grant execute on function public.customer_send_eddm_portal_message(uuid,text) to authenticated;

create or replace function public.admin_send_eddm_portal_message(p_interest_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.skylight_eddm_interests%rowtype; v_body text:=btrim(coalesce(p_body,'')); v_id uuid;
begin
  select * into i from public.skylight_eddm_interests where id=p_interest_id;
  if i.id is null then raise exception 'EDDM advertiser not found.'; end if;
  if not private.has_tenant_role(i.tenant_id,array['staff','admin','super_admin']) then raise exception 'Not authorized.'; end if;
  if length(v_body)<1 or length(v_body)>4000 then raise exception 'Message must be between 1 and 4000 characters.'; end if;
  insert into public.skylight_eddm_portal_messages(tenant_id,interest_id,sender_user_id,sender_type,body,customer_visible,read_by_staff_at)
  values(i.tenant_id,i.id,auth.uid(),'staff',v_body,true,now()) returning id into v_id;
  perform private.notify_eddm_portal_users(i.id,'New message from Skylight Reflections Marketing',left(v_body,800),'eddm_staff_message:'||v_id::text);
  return jsonb_build_object('ok',true,'message_id',v_id);
end$$;
revoke all on function public.admin_send_eddm_portal_message(uuid,text) from public,anon;
grant execute on function public.admin_send_eddm_portal_message(uuid,text) to authenticated;

create or replace function private.eddm_portal_asset_notify_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.interest_id is not null and new.source='admin' and new.customer_visible=true then
    if tg_op='INSERT' and new.asset_type in('proof','approved_proof') then
      perform private.notify_eddm_portal_users(new.interest_id,'Your EDDM proof is ready','Skylight Reflections Marketing posted a proof for your review. Open your secure EDDM portal to approve it or request changes.','eddm_proof_ready:'||new.id::text);
    elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='needs_changes' then
      perform private.notify_eddm_portal_users(new.interest_id,'EDDM artwork needs changes','Skylight marked your EDDM artwork/proof as needing changes. Open the portal for the latest status.','eddm_artwork_changes:'||new.id::text||':'||extract(epoch from new.updated_at)::bigint::text);
    end if;
  end if;
  return new;
end$$;
revoke all on function private.eddm_portal_asset_notify_trigger() from public,anon,authenticated;
drop trigger if exists eddm_portal_asset_notify on public.skylight_eddm_artwork_assets;
create trigger eddm_portal_asset_notify after insert or update of status,customer_visible,review_status on public.skylight_eddm_artwork_assets for each row execute function private.eddm_portal_asset_notify_trigger();

create or replace function private.eddm_portal_market_notify_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record; v_label text;
begin
  if old.production_status is distinct from new.production_status or old.target_mail_date is distinct from new.target_mail_date or old.actual_mail_date is distinct from new.actual_mail_date then
    v_label:=replace(initcap(replace(new.production_status,'_',' ')),'Usps','USPS');
    for r in select id from public.skylight_eddm_interests where market_id=new.id and client_id is not null and status not in('lost','cancelled') loop
      perform private.notify_eddm_portal_users(r.id,'EDDM campaign update',new.name||' is now in the '||v_label||' stage.'||case when new.target_mail_date is not null then ' Target mail date: '||to_char(new.target_mail_date,'Mon DD, YYYY')||'.' else '' end,'eddm_market_stage:'||new.id::text||':'||new.production_status||':'||coalesce(new.target_mail_date::text,'')||':'||coalesce(new.actual_mail_date::text,''));
    end loop;
  end if;
  return new;
end$$;
revoke all on function private.eddm_portal_market_notify_trigger() from public,anon,authenticated;
drop trigger if exists eddm_portal_market_notify on public.skylight_eddm_markets;
create trigger eddm_portal_market_notify after update of production_status,target_mail_date,actual_mail_date on public.skylight_eddm_markets for each row execute function private.eddm_portal_market_notify_trigger();

create or replace function private.eddm_portal_invoice_notify_trigger() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record; v_title text; v_body text;
begin
  if old.status is distinct from new.status or old.amount_paid_cents is distinct from new.amount_paid_cents or old.balance_due_cents is distinct from new.balance_due_cents then
    for r in select id,business_name from public.skylight_eddm_interests where invoice_id=new.id and client_id is not null loop
      if new.status='paid' then v_title:='EDDM invoice paid'; v_body:='Payment is recorded for invoice '||coalesce(new.invoice_number,'')||'. Thank you.';
      elsif new.status in('sent','partial','overdue') then v_title:='EDDM invoice update'; v_body:='Invoice '||coalesce(new.invoice_number,'')||' is '||replace(new.status,'_',' ')||'. Current balance: $'||to_char(new.balance_due_cents/100.0,'FM999999990.00')||'.';
      else continue; end if;
      perform private.notify_eddm_portal_users(r.id,v_title,v_body,'eddm_invoice:'||new.id::text||':'||new.status||':'||new.amount_paid_cents::text||':'||new.balance_due_cents::text);
    end loop;
  end if;
  return new;
end$$;
revoke all on function private.eddm_portal_invoice_notify_trigger() from public,anon,authenticated;
drop trigger if exists eddm_portal_invoice_notify on public.skylight_invoices;
create trigger eddm_portal_invoice_notify after update of status,amount_paid_cents,balance_due_cents on public.skylight_invoices for each row execute function private.eddm_portal_invoice_notify_trigger();

comment on table public.skylight_client_portal_access is 'Explicit customer-account access to Skylight client records. Matching email alone never grants access.';
comment on table public.skylight_client_portal_invites is 'Single-use, email-bound invitations for secure Skylight customer portal access.';
comment on table public.skylight_eddm_portal_messages is 'Customer-visible EDDM conversation thread; internal Admin notes remain in separate private fields/tables.';
comment on function public.get_my_eddm_portal() is 'Returns only the authenticated customer own EDDM campaigns, spots, customer-visible assets, messages and invoice-safe fields; never internal economics or other advertisers.';
