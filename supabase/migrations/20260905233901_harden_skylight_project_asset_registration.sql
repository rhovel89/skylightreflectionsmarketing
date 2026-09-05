create or replace function public.customer_register_skylight_project_asset(p_project_id uuid,p_requirement_id uuid,p_storage_path text,p_file_name text,p_mime_type text,p_file_size_bytes bigint,p_description text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  p public.skylight_projects%rowtype;
  r public.skylight_project_asset_requirements%rowtype;
  o storage.objects%rowtype;
  v_prefix text;
  v_count integer;
  v_id uuid;
  v_mime text;
  v_size bigint;
begin
  select * into p from public.skylight_projects where id=p_project_id;
  if p.id is null or not private.user_has_skylight_project_access(p.id,auth.uid()) then raise exception 'Project not available.'; end if;
  if p.intake_status='reviewed' then raise exception 'This intake has already been reviewed by Skylight.'; end if;
  if p_requirement_id is not null then
    select * into r from public.skylight_project_asset_requirements where id=p_requirement_id and project_id=p.id;
    if r.id is null then raise exception 'Asset requirement not available.'; end if;
  end if;
  v_prefix:=p.tenant_id::text||'/'||p.client_id::text||'/'||p.id::text||'/customer/';
  if left(p_storage_path,char_length(v_prefix))<>v_prefix or p_storage_path like '%..%' then raise exception 'Invalid project asset path.'; end if;
  select * into o from storage.objects where bucket_id='skylight-project-assets' and name=p_storage_path;
  if o.id is null then raise exception 'Uploaded file was not found in secure storage.'; end if;
  if o.owner is distinct from auth.uid() then raise exception 'The uploaded file does not belong to this account.'; end if;
  v_mime:=coalesce(nullif(o.metadata->>'mimetype',''),p_mime_type,'application/octet-stream');
  v_size:=coalesce(nullif(o.metadata->>'size','')::bigint,p_file_size_bytes,0);
  if v_size<1 or v_size>26214400 then raise exception 'File must be 25 MB or smaller.'; end if;
  if v_mime not in ('image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') then raise exception 'Unsupported file type.'; end if;
  if r.id is not null and not (v_mime=any(r.allowed_mime_types)) then raise exception 'This file type is not allowed for that requirement.'; end if;
  if exists(select 1 from public.skylight_project_assets a where a.storage_path=p_storage_path) then raise exception 'This file is already registered.'; end if;
  if r.id is not null then
    select count(*) into v_count from public.skylight_project_assets a where a.requirement_id=r.id and a.removed_at is null;
    if v_count>=r.max_files then raise exception 'Maximum files reached for this requirement.'; end if;
  end if;
  insert into public.skylight_project_assets(tenant_id,client_id,project_id,requirement_id,service_id,storage_path,file_name,mime_type,file_size_bytes,source,customer_visible,description,uploaded_by)
  values(p.tenant_id,p.client_id,p.id,r.id,r.service_id,p_storage_path,left(p_file_name,260),v_mime,v_size,'customer',true,nullif(left(btrim(coalesce(p_description,'')),2000),''),auth.uid()) returning id into v_id;
  update public.skylight_projects set intake_status=case when intake_status='pending' then 'in_progress' else intake_status end,updated_at=now() where id=p.id;
  perform private.notify_skylight_admins(p.tenant_id,'Client uploaded Skylight onboarding file',left(p_file_name,220)||' was added to '||p.project_number||'.','/admin/skylight-intake?project='||p.id::text,'skylight_intake_asset:'||v_id::text);
  return jsonb_build_object('ok',true,'asset_id',v_id,'mime_type',v_mime,'file_size_bytes',v_size);
end$$;
revoke all on function public.customer_register_skylight_project_asset(uuid,uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.customer_register_skylight_project_asset(uuid,uuid,text,text,text,bigint,text) to authenticated;

comment on function public.customer_register_skylight_project_asset(uuid,uuid,text,text,text,bigint,text) is 'Registers only an authenticated user-owned object that already exists in the private Skylight project storage path; storage metadata is authoritative for MIME and size.';
