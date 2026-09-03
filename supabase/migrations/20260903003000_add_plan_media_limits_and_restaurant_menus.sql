alter table public.business_media add column if not exists mime_type text null;
alter table public.business_media add column if not exists original_filename text null;

update public.business_media
set mime_type = case
  when lower(storage_path) like '%.png' then 'image/png'
  when lower(storage_path) like '%.webp' then 'image/webp'
  else 'image/jpeg'
end
where mime_type is null;

alter table public.business_media drop constraint if exists business_media_media_type_check;
alter table public.business_media add constraint business_media_media_type_check
check (media_type = any (array['logo'::text,'cover'::text,'gallery'::text,'menu'::text]));

update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']::text[],
    file_size_limit = 12582912
where id = 'business-media';

update public.plans
set entitlements = coalesce(entitlements,'{}'::jsonb) || '{"max_media":2,"max_gallery_images":0,"menu_upload":false}'::jsonb,
    updated_at = now()
where slug in ('free','verified');

update public.plans
set features = '["Everything in Verified","Up to 5 showcase photos","Restaurant menu upload","Lead inbox","Business analytics","Clearly labeled featured visibility","Homepage Featured Business placement eligibility"]'::jsonb,
    entitlements = coalesce(entitlements,'{}'::jsonb) || '{"max_media":7,"max_gallery_images":5,"menu_upload":true}'::jsonb,
    updated_at = now()
where slug = 'featured';

update public.plans
set features = '["Everything in Featured","Up to 10 showcase photos","Restaurant menu upload","Advanced analytics","Expanded locations","Priority business tools"]'::jsonb,
    entitlements = coalesce(entitlements,'{}'::jsonb) || '{"max_media":12,"max_gallery_images":10,"menu_upload":true}'::jsonb,
    updated_at = now()
where slug = 'pro';

create or replace function private.business_paid_media_entitlements(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'plan_slug', p.slug,
      'max_gallery_images', coalesce((p.entitlements->>'max_gallery_images')::int,0),
      'menu_upload', coalesce((p.entitlements->>'menu_upload')::boolean,false)
    )
    from public.subscriptions s
    join public.plans p on p.id=s.plan_id
    where s.business_id=p_business_id
      and s.status in ('active','trialing','past_due')
      and p.is_active=true
      and (s.ends_at is null or s.ends_at > now())
    order by s.updated_at desc, p.sort_order desc nulls last
    limit 1
  ), '{"plan_slug":"free","max_gallery_images":0,"menu_upload":false}'::jsonb)
$$;
revoke all on function private.business_paid_media_entitlements(uuid) from public;
grant execute on function private.business_paid_media_entitlements(uuid) to authenticated;

create or replace function private.can_submit_business_media(
  p_business_id uuid,
  p_user_id uuid,
  p_media_type text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ent jsonb;
  v_limit int := 0;
  v_count int := 0;
  v_restaurant boolean := false;
begin
  if auth.uid() is null or p_user_id is null or p_user_id <> auth.uid() then return false; end if;
  if not exists (
    select 1 from public.business_owners bo
    where bo.business_id=p_business_id and bo.user_id=p_user_id
  ) then return false; end if;

  if p_media_type in ('logo','cover') then
    select count(*) into v_count
    from public.business_media bm
    where bm.business_id=p_business_id
      and bm.media_type=p_media_type
      and bm.approval_status='pending'
      and bm.status='pending';
    return v_count=0;
  end if;

  v_ent := private.business_paid_media_entitlements(p_business_id);

  if p_media_type='gallery' then
    v_limit := greatest(0,coalesce((v_ent->>'max_gallery_images')::int,0));
    if v_limit=0 then return false; end if;
    select count(*) into v_count
    from public.business_media bm
    where bm.business_id=p_business_id
      and bm.media_type='gallery'
      and bm.approval_status in ('pending','approved')
      and bm.status in ('pending','active');
    return v_count < v_limit;
  end if;

  if p_media_type='menu' then
    if not coalesce((v_ent->>'menu_upload')::boolean,false) then return false; end if;
    select exists(
      select 1
      from public.business_categories bc
      join public.categories c on c.id=bc.category_id
      where bc.business_id=p_business_id and c.vertical='restaurant' and c.is_active=true
    ) into v_restaurant;
    if not v_restaurant then return false; end if;
    select count(*) into v_count
    from public.business_media bm
    where bm.business_id=p_business_id
      and bm.media_type='menu'
      and bm.approval_status='pending'
      and bm.status='pending';
    return v_count=0;
  end if;

  return false;
end $$;
revoke all on function private.can_submit_business_media(uuid,uuid,text) from public;
grant execute on function private.can_submit_business_media(uuid,uuid,text) to authenticated;

create or replace function public.get_public_business_media_entitlements(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.businesses b
    where b.id=p_business_id and lower(coalesce(b.status,''))='published'
  ) then
    return '{"plan_slug":"free","max_gallery_images":0,"menu_upload":false}'::jsonb;
  end if;
  return private.business_paid_media_entitlements(p_business_id);
end $$;
revoke all on function public.get_public_business_media_entitlements(uuid) from public;
grant execute on function public.get_public_business_media_entitlements(uuid) to anon, authenticated;

drop policy if exists "owner submit business media" on public.business_media;
create policy "owner submit business media"
on public.business_media for insert to authenticated
with check (
  submitted_by=(select auth.uid())
  and approval_status='pending'
  and status='pending'
  and exists (
    select 1 from public.business_owners bo
    join public.businesses b on b.id=bo.business_id
    where bo.business_id=business_media.business_id
      and bo.user_id=(select auth.uid())
      and b.tenant_id=business_media.tenant_id
  )
  and private.can_submit_business_media(business_id,submitted_by,media_type)
);

drop policy if exists "owner delete pending business media" on public.business_media;
drop policy if exists "owner delete own business media" on public.business_media;
create policy "owner delete own business media"
on public.business_media for delete to authenticated
using (
  submitted_by=(select auth.uid())
  and exists (
    select 1 from public.business_owners bo
    where bo.business_id=business_media.business_id
      and bo.user_id=(select auth.uid())
  )
);

create or replace function public.review_business_media(p_media_id uuid,p_decision text,p_notes text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_tenant uuid;
  v_business uuid;
  v_media_type text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select tenant_id,business_id,media_type into v_tenant,v_business,v_media_type
  from public.business_media where id=p_media_id;
  if v_tenant is null then raise exception 'media_not_found'; end if;
  if not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'insufficient_privilege'; end if;
  if p_decision not in ('approve','reject') then raise exception 'invalid_decision'; end if;

  if p_decision='approve' and v_media_type in ('logo','cover','menu') then
    update public.business_media
       set status='archived',updated_at=now()
     where business_id=v_business
       and media_type=v_media_type
       and id<>p_media_id
       and approval_status='approved'
       and status='active';
  end if;

  update public.business_media
     set approval_status=case when p_decision='approve' then 'approved' else 'rejected' end,
         status=case when p_decision='approve' then 'active' else 'rejected' end,
         reviewed_by=auth.uid(),reviewed_at=now(),review_notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now()
   where id=p_media_id and approval_status='pending';
  if not found then raise exception 'media_not_pending'; end if;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text)
  values(v_tenant,auth.uid(),case when p_decision='approve' then 'media_approved' else 'media_rejected' end,initcap(p_decision)||'d business media '||p_media_id);
end $$;
grant execute on function public.review_business_media(uuid,text,text) to authenticated;
revoke execute on function public.review_business_media(uuid,text,text) from anon;
