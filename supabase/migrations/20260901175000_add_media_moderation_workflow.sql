alter table public.business_media add column if not exists reviewed_by uuid null references auth.users(id) on delete set null;
alter table public.business_media add column if not exists reviewed_at timestamptz null;
alter table public.business_media add column if not exists review_notes text null;
create index if not exists business_media_tenant_approval_created_idx on public.business_media(tenant_id,approval_status,created_at desc);

create or replace function public.review_business_media(p_media_id uuid,p_decision text,p_notes text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select tenant_id into v_tenant from public.business_media where id=p_media_id;
  if v_tenant is null then raise exception 'media_not_found'; end if;
  if not private.has_tenant_role(v_tenant,array['staff','admin','super_admin']) then raise exception 'insufficient_privilege'; end if;
  if p_decision not in ('approve','reject') then raise exception 'invalid_decision'; end if;
  update public.business_media
     set approval_status=case when p_decision='approve' then 'approved' else 'rejected' end,
         status=case when p_decision='approve' then 'active' else 'rejected' end,
         reviewed_by=auth.uid(),reviewed_at=now(),review_notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now()
   where id=p_media_id and approval_status='pending';
  if not found then raise exception 'media_not_pending'; end if;
  insert into public.audit_logs(tenant_id,actor_user_id,action_type,action_text) values(v_tenant,auth.uid(),case when p_decision='approve' then 'media_approved' else 'media_rejected' end,initcap(p_decision)||'d business media '||p_media_id);
end $$;
grant execute on function public.review_business_media(uuid,text,text) to authenticated;
revoke execute on function public.review_business_media(uuid,text,text) from anon;
