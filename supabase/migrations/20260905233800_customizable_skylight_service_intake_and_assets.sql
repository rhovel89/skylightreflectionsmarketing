-- Customizable per-service onboarding questions, asset requirements, immutable project snapshots, and private client file collection.

create table if not exists public.skylight_service_intake_questions(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null references public.skylight_service_catalog(id) on delete cascade,
  label text not null check(char_length(btrim(label)) between 1 and 220),
  help_text text,
  question_type text not null default 'short_text' check(question_type in ('short_text','long_text','number','url','email','phone','date','single_select','multi_select','checkbox')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb check(jsonb_typeof(options)='array'),
  placeholder text,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists skylight_service_intake_questions_service_idx on public.skylight_service_intake_questions(service_id,active,sort_order);

create table if not exists public.skylight_service_asset_requirements(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null references public.skylight_service_catalog(id) on delete cascade,
  label text not null check(char_length(btrim(label)) between 1 and 220),
  description text,
  required boolean not null default false,
  category text not null default 'general',
  allowed_mime_types text[] not null default array['image/jpeg','image/png','image/webp','application/pdf']::text[],
  max_files integer not null default 5 check(max_files between 1 and 25),
  sort_order integer not null default 100,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists skylight_service_asset_requirements_service_idx on public.skylight_service_asset_requirements(service_id,active,sort_order);

alter table public.skylight_projects
  add column if not exists intake_status text not null default 'not_required' check(intake_status in ('not_required','pending','in_progress','submitted','reviewed')),
  add column if not exists intake_submitted_at timestamptz,
  add column if not exists intake_reviewed_at timestamptz,
  add column if not exists intake_reviewed_by uuid references auth.users(id);

create table if not exists public.skylight_project_intake_fields(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.skylight_projects(id) on delete cascade,
  service_id uuid references public.skylight_service_catalog(id) on delete set null,
  template_id uuid references public.skylight_service_intake_questions(id) on delete set null,
  label text not null,
  help_text text,
  question_type text not null check(question_type in ('short_text','long_text','number','url','email','phone','date','single_select','multi_select','checkbox')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb check(jsonb_typeof(options)='array'),
  placeholder text,
  sort_order integer not null default 100,
  response jsonb,
  answered_at timestamptz,
  answered_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,service_id,template_id)
);
create index if not exists skylight_project_intake_fields_project_idx on public.skylight_project_intake_fields(project_id,sort_order);

create table if not exists public.skylight_project_asset_requirements(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.skylight_projects(id) on delete cascade,
  service_id uuid references public.skylight_service_catalog(id) on delete set null,
  template_id uuid references public.skylight_service_asset_requirements(id) on delete set null,
  label text not null,
  description text,
  required boolean not null default false,
  category text not null default 'general',
  allowed_mime_types text[] not null,
  max_files integer not null default 5 check(max_files between 1 and 25),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique(project_id,service_id,template_id)
);
create index if not exists skylight_project_asset_requirements_project_idx on public.skylight_project_asset_requirements(project_id,sort_order);

create table if not exists public.skylight_project_assets(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.skylight_clients(id) on delete cascade,
  project_id uuid not null references public.skylight_projects(id) on delete cascade,
  requirement_id uuid references public.skylight_project_asset_requirements(id) on delete set null,
  service_id uuid references public.skylight_service_catalog(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check(file_size_bytes between 1 and 26214400),
  source text not null check(source in ('customer','staff')),
  customer_visible boolean not null default true,
  description text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id)
);
create index if not exists skylight_project_assets_project_idx on public.skylight_project_assets(project_id,created_at desc) where removed_at is null;
create index if not exists skylight_project_assets_requirement_idx on public.skylight_project_assets(requirement_id,created_at desc) where removed_at is null;

alter table public.skylight_service_intake_questions enable row level security;
alter table public.skylight_service_asset_requirements enable row level security;
alter table public.skylight_project_intake_fields enable row level security;
alter table public.skylight_project_asset_requirements enable row level security;
alter table public.skylight_project_assets enable row level security;

-- Staff control service templates and project snapshots.
drop policy if exists "staff manage skylight service intake questions" on public.skylight_service_intake_questions;
create policy "staff manage skylight service intake questions" on public.skylight_service_intake_questions for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
drop policy if exists "staff manage skylight service asset requirements" on public.skylight_service_asset_requirements;
create policy "staff manage skylight service asset requirements" on public.skylight_service_asset_requirements for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
drop policy if exists "staff manage skylight project intake fields" on public.skylight_project_intake_fields;
create policy "staff manage skylight project intake fields" on public.skylight_project_intake_fields for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
drop policy if exists "staff manage skylight project asset requirements" on public.skylight_project_asset_requirements;
create policy "staff manage skylight project asset requirements" on public.skylight_project_asset_requirements for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
drop policy if exists "staff manage skylight project assets" on public.skylight_project_assets;
create policy "staff manage skylight project assets" on public.skylight_project_assets for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

grant select,insert,update,delete on public.skylight_service_intake_questions,public.skylight_service_asset_requirements,public.skylight_project_intake_fields,public.skylight_project_asset_requirements,public.skylight_project_assets to authenticated;
revoke all on public.skylight_service_intake_questions,public.skylight_service_asset_requirements,public.skylight_project_intake_fields,public.skylight_project_asset_requirements,public.skylight_project_assets from anon;

-- Generic project access helper. Kept private so storage/RPC policies can use it without exposing it as an application action.
create or replace function private.user_has_skylight_project_access(p_project_id uuid,p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.skylight_projects p
    join public.skylight_client_portal_access a on a.client_id=p.client_id and a.tenant_id=p.tenant_id
    where p.id=p_project_id and a.user_id=p_user_id and a.status='active'
  )
$$;
revoke all on function private.user_has_skylight_project_access(uuid,uuid) from public,anon,authenticated;

-- Snapshot active service onboarding rules whenever a service is attached to a newly created project.
create or replace function private.snapshot_skylight_service_intake() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_count integer;
begin
  select p.tenant_id into v_tenant from public.skylight_projects p where p.id=new.project_id;
  if v_tenant is null or new.service_id is null then return new; end if;

  insert into public.skylight_project_intake_fields(tenant_id,project_id,service_id,template_id,label,help_text,question_type,required,options,placeholder,sort_order)
  select v_tenant,new.project_id,q.service_id,q.id,q.label,q.help_text,q.question_type,q.required,q.options,q.placeholder,q.sort_order
  from public.skylight_service_intake_questions q
  where q.service_id=new.service_id and q.tenant_id=v_tenant and q.active=true
  on conflict(project_id,service_id,template_id) do nothing;

  insert into public.skylight_project_asset_requirements(tenant_id,project_id,service_id,template_id,label,description,required,category,allowed_mime_types,max_files,sort_order)
  select v_tenant,new.project_id,r.service_id,r.id,r.label,r.description,r.required,r.category,r.allowed_mime_types,r.max_files,r.sort_order
  from public.skylight_service_asset_requirements r
  where r.service_id=new.service_id and r.tenant_id=v_tenant and r.active=true
  on conflict(project_id,service_id,template_id) do nothing;

  select (select count(*) from public.skylight_project_intake_fields f where f.project_id=new.project_id)
       + (select count(*) from public.skylight_project_asset_requirements r where r.project_id=new.project_id)
    into v_count;
  if v_count>0 then
    update public.skylight_projects set intake_status=case when intake_status='not_required' then 'pending' else intake_status end,updated_at=now() where id=new.project_id;
  end if;
  return new;
end$$;
revoke all on function private.snapshot_skylight_service_intake() from public,anon,authenticated;
drop trigger if exists skylight_project_service_snapshot_intake on public.skylight_project_services;
create trigger skylight_project_service_snapshot_intake after insert on public.skylight_project_services for each row execute function private.snapshot_skylight_service_intake();

-- Private storage bucket. Customer-visible files live under tenant/client/project/customer/*; internal files use /internal/*.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('skylight-project-assets','skylight-project-assets',false,26214400,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "skylight customers read own project assets" on storage.objects;
create policy "skylight customers read own project assets" on storage.objects for select to authenticated using(
  bucket_id='skylight-project-assets'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and coalesce((storage.foldername(name))[4],'')='customer'
  and private.user_has_skylight_project_access(((storage.foldername(name))[3])::uuid,(select auth.uid()))
);
drop policy if exists "skylight customers upload own project assets" on storage.objects;
create policy "skylight customers upload own project assets" on storage.objects for insert to authenticated with check(
  bucket_id='skylight-project-assets'
  and coalesce((storage.foldername(name))[3],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and coalesce((storage.foldername(name))[4],'')='customer'
  and private.user_has_skylight_project_access(((storage.foldername(name))[3])::uuid,(select auth.uid()))
);
drop policy if exists "skylight staff manage project asset storage" on storage.objects;
create policy "skylight staff manage project asset storage" on storage.objects for all to authenticated using(
  bucket_id='skylight-project-assets'
  and coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.has_tenant_role(((storage.foldername(name))[1])::uuid,array['staff','admin','super_admin'])
) with check(
  bucket_id='skylight-project-assets'
  and coalesce((storage.foldername(name))[1],'') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.has_tenant_role(((storage.foldername(name))[1])::uuid,array['staff','admin','super_admin'])
);

create or replace function public.get_my_skylight_intake() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  return jsonb_build_object('projects',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',p.id,'client_id',p.client_id,'tenant_id',p.tenant_id,'project_number',p.project_number,'name',p.name,'status',p.status,'intake_status',p.intake_status,
      'intake_submitted_at',p.intake_submitted_at,'intake_reviewed_at',p.intake_reviewed_at,
      'upload_prefix',p.tenant_id::text||'/'||p.client_id::text||'/'||p.id::text||'/customer',
      'fields',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'service_id',f.service_id,'label',f.label,'help_text',f.help_text,'question_type',f.question_type,'required',f.required,'options',f.options,'placeholder',f.placeholder,'sort_order',f.sort_order,'response',f.response,'answered_at',f.answered_at) order by f.sort_order,f.created_at) from public.skylight_project_intake_fields f where f.project_id=p.id),'[]'::jsonb),
      'asset_requirements',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'service_id',r.service_id,'label',r.label,'description',r.description,'required',r.required,'category',r.category,'allowed_mime_types',r.allowed_mime_types,'max_files',r.max_files,'sort_order',r.sort_order) order by r.sort_order,r.created_at) from public.skylight_project_asset_requirements r where r.project_id=p.id),'[]'::jsonb),
      'assets',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'requirement_id',a.requirement_id,'service_id',a.service_id,'storage_path',a.storage_path,'file_name',a.file_name,'mime_type',a.mime_type,'file_size_bytes',a.file_size_bytes,'description',a.description,'source',a.source,'created_at',a.created_at) order by a.created_at desc) from public.skylight_project_assets a where a.project_id=p.id and a.removed_at is null and a.customer_visible=true),'[]'::jsonb)
    ) order by p.created_at desc)
    from public.skylight_projects p
    where private.user_has_skylight_project_access(p.id,v_uid)
      and (exists(select 1 from public.skylight_project_intake_fields f where f.project_id=p.id) or exists(select 1 from public.skylight_project_asset_requirements r where r.project_id=p.id))
  ),'[]'::jsonb));
end$$;
revoke all on function public.get_my_skylight_intake() from public,anon;
grant execute on function public.get_my_skylight_intake() to authenticated;

create or replace function public.customer_save_skylight_intake_response(p_field_id uuid,p_response jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.skylight_project_intake_fields%rowtype; p public.skylight_projects%rowtype; v_text text; v_valid boolean:=true;
begin
  select * into f from public.skylight_project_intake_fields where id=p_field_id;
  if f.id is null then raise exception 'Intake field not found.'; end if;
  select * into p from public.skylight_projects where id=f.project_id;
  if p.id is null or not private.user_has_skylight_project_access(p.id,auth.uid()) then raise exception 'Intake field not available.'; end if;
  if p.intake_status='reviewed' then raise exception 'This intake has already been reviewed by Skylight.'; end if;
  v_text:=btrim(coalesce(case when jsonb_typeof(p_response)='string' then trim(both '"' from p_response::text) else p_response::text end,''));
  if f.question_type in('single_select') and p_response is not null and not exists(select 1 from jsonb_array_elements_text(f.options) o where o.value=v_text) then v_valid:=false; end if;
  if f.question_type='multi_select' and p_response is not null and jsonb_typeof(p_response)<>'array' then v_valid:=false; end if;
  if f.question_type='checkbox' and p_response is not null and jsonb_typeof(p_response)<>'boolean' then v_valid:=false; end if;
  if not v_valid then raise exception 'Invalid response for this intake field.'; end if;
  update public.skylight_project_intake_fields set response=p_response,answered_at=now(),answered_by=auth.uid(),updated_at=now() where id=f.id;
  update public.skylight_projects set intake_status='in_progress',intake_submitted_at=null,updated_at=now() where id=p.id and intake_status in('pending','submitted');
  return jsonb_build_object('ok',true,'field_id',f.id);
end$$;
revoke all on function public.customer_save_skylight_intake_response(uuid,jsonb) from public,anon;
grant execute on function public.customer_save_skylight_intake_response(uuid,jsonb) to authenticated;

create or replace function public.customer_register_skylight_project_asset(p_project_id uuid,p_requirement_id uuid,p_storage_path text,p_file_name text,p_mime_type text,p_file_size_bytes bigint,p_description text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.skylight_projects%rowtype; r public.skylight_project_asset_requirements%rowtype; v_prefix text; v_count integer; v_id uuid;
begin
  select * into p from public.skylight_projects where id=p_project_id;
  if p.id is null or not private.user_has_skylight_project_access(p.id,auth.uid()) then raise exception 'Project not available.'; end if;
  if p.intake_status='reviewed' then raise exception 'This intake has already been reviewed by Skylight.'; end if;
  if p_requirement_id is not null then
    select * into r from public.skylight_project_asset_requirements where id=p_requirement_id and project_id=p.id;
    if r.id is null then raise exception 'Asset requirement not available.'; end if;
  end if;
  if p_file_size_bytes<1 or p_file_size_bytes>26214400 then raise exception 'File must be 25 MB or smaller.'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') then raise exception 'Unsupported file type.'; end if;
  if r.id is not null and not (p_mime_type=any(r.allowed_mime_types)) then raise exception 'This file type is not allowed for that requirement.'; end if;
  v_prefix:=p.tenant_id::text||'/'||p.client_id::text||'/'||p.id::text||'/customer/';
  if left(p_storage_path,char_length(v_prefix))<>v_prefix or p_storage_path like '%..%' then raise exception 'Invalid project asset path.'; end if;
  if r.id is not null then
    select count(*) into v_count from public.skylight_project_assets a where a.requirement_id=r.id and a.removed_at is null;
    if v_count>=r.max_files then raise exception 'Maximum files reached for this requirement.'; end if;
  end if;
  insert into public.skylight_project_assets(tenant_id,client_id,project_id,requirement_id,service_id,storage_path,file_name,mime_type,file_size_bytes,source,customer_visible,description,uploaded_by)
  values(p.tenant_id,p.client_id,p.id,r.id,r.service_id,p_storage_path,left(p_file_name,260),p_mime_type,p_file_size_bytes,'customer',true,nullif(left(btrim(coalesce(p_description,'')),2000),''),auth.uid()) returning id into v_id;
  update public.skylight_projects set intake_status=case when intake_status='pending' then 'in_progress' else intake_status end,updated_at=now() where id=p.id;
  perform private.notify_skylight_admins(p.tenant_id,'Client uploaded Skylight onboarding file',left(p_file_name,220)||' was added to '||p.project_number||'.','/admin/skylight-intake?project='||p.id::text,'skylight_intake_asset:'||v_id::text);
  return jsonb_build_object('ok',true,'asset_id',v_id);
end$$;
revoke all on function public.customer_register_skylight_project_asset(uuid,uuid,text,text,text,bigint,text) from public,anon;
grant execute on function public.customer_register_skylight_project_asset(uuid,uuid,text,text,text,bigint,text) to authenticated;

create or replace function public.customer_remove_skylight_project_asset(p_asset_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.skylight_project_assets%rowtype; p public.skylight_projects%rowtype;
begin
  select * into a from public.skylight_project_assets where id=p_asset_id and removed_at is null;
  if a.id is null then raise exception 'File not found.'; end if;
  select * into p from public.skylight_projects where id=a.project_id;
  if p.id is null or not private.user_has_skylight_project_access(p.id,auth.uid()) or a.source<>'customer' then raise exception 'File not available.'; end if;
  if p.intake_status='reviewed' then raise exception 'This intake has already been reviewed by Skylight.'; end if;
  update public.skylight_project_assets set removed_at=now(),removed_by=auth.uid() where id=a.id;
  update public.skylight_projects set intake_status='in_progress',intake_submitted_at=null,updated_at=now() where id=p.id and intake_status='submitted';
  return jsonb_build_object('ok',true,'storage_path',a.storage_path);
end$$;
revoke all on function public.customer_remove_skylight_project_asset(uuid) from public,anon;
grant execute on function public.customer_remove_skylight_project_asset(uuid) to authenticated;

create or replace function private.skylight_response_present(p_response jsonb,p_type text) returns boolean
language sql immutable set search_path='' as $$
  select case
    when p_response is null or p_response='null'::jsonb then false
    when p_type='checkbox' then p_response='true'::jsonb
    when p_type='multi_select' then jsonb_typeof(p_response)='array' and jsonb_array_length(p_response)>0
    when jsonb_typeof(p_response)='string' then char_length(btrim(trim(both '"' from p_response::text)))>0
    else true
  end
$$;
revoke all on function private.skylight_response_present(jsonb,text) from public,anon,authenticated;

create or replace function public.customer_submit_skylight_intake(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.skylight_projects%rowtype; v_missing_questions integer; v_missing_assets integer;
begin
  select * into p from public.skylight_projects where id=p_project_id for update;
  if p.id is null or not private.user_has_skylight_project_access(p.id,auth.uid()) then raise exception 'Project not available.'; end if;
  if p.intake_status='reviewed' then raise exception 'This intake has already been reviewed by Skylight.'; end if;
  select count(*) into v_missing_questions from public.skylight_project_intake_fields f where f.project_id=p.id and f.required=true and not private.skylight_response_present(f.response,f.question_type);
  select count(*) into v_missing_assets from public.skylight_project_asset_requirements r where r.project_id=p.id and r.required=true and not exists(select 1 from public.skylight_project_assets a where a.requirement_id=r.id and a.removed_at is null and a.customer_visible=true);
  if v_missing_questions>0 or v_missing_assets>0 then raise exception 'Complete all required questions and file requirements before submitting.'; end if;
  update public.skylight_projects set intake_status='submitted',intake_submitted_at=now(),updated_at=now() where id=p.id;
  perform private.notify_skylight_admins(p.tenant_id,'Skylight onboarding submitted',p.project_number||' onboarding is ready for staff review.','/admin/skylight-intake?project='||p.id::text,'skylight_intake_submitted:'||p.id::text||':'||extract(epoch from now())::bigint::text);
  return jsonb_build_object('ok',true,'project_id',p.id,'status','submitted');
end$$;
revoke all on function public.customer_submit_skylight_intake(uuid) from public,anon;
grant execute on function public.customer_submit_skylight_intake(uuid) to authenticated;

create or replace function public.admin_review_skylight_intake(p_project_id uuid,p_decision text,p_note text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
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
  return jsonb_build_object('ok',true,'project_id',p.id,'status',case when v_decision='reviewed' then 'reviewed' else 'in_progress' end);
end$$;
revoke all on function public.admin_review_skylight_intake(uuid,text,text) from public,anon;
grant execute on function public.admin_review_skylight_intake(uuid,text,text) to authenticated;

comment on table public.skylight_service_intake_questions is 'Editable per-service onboarding question templates. Active project copies are immutable snapshots.';
comment on table public.skylight_service_asset_requirements is 'Editable per-service client file requirement templates. Active project copies are immutable snapshots.';
comment on table public.skylight_project_assets is 'Private Skylight project files. Customer-visible storage uses the /customer/ namespace; staff-only files use /internal/.';
