-- Require authenticated username-bearing accounts for public business creation and claims.
alter table public.profiles add column if not exists username text;

alter table public.profiles drop constraint if exists profiles_username_format_check;
alter table public.profiles add constraint profiles_username_format_check check (
  username is null or (
    username = lower(username)
    and char_length(username) between 3 and 30
    and username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'
  )
);
create unique index if not exists profiles_username_lower_uidx on public.profiles (lower(username)) where username is not null;

alter table public.business_submissions add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null;
create index if not exists business_submissions_submitted_by_user_idx on public.business_submissions(submitted_by_user_id) where submitted_by_user_id is not null;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_username text := lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
begin
  if v_username <> '' and (char_length(v_username) not between 3 and 30 or v_username !~ '^[a-z0-9][a-z0-9._-]{2,29}$') then
    raise exception 'invalid_username';
  end if;
  insert into public.profiles(id, display_name, username)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), nullif(v_username,''))
  on conflict (id) do update set
    display_name=coalesce(excluded.display_name,public.profiles.display_name),
    username=coalesce(excluded.username,public.profiles.username);
  return new;
exception when unique_violation then
  raise exception 'username_taken';
end;
$$;

create or replace function private.account_has_business_username(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=p_user_id
      and p.username is not null
      and char_length(p.username) between 3 and 30
      and p.username = lower(p.username)
      and p.username ~ '^[a-z0-9][a-z0-9._-]{2,29}$'
  );
$$;
revoke all on function private.account_has_business_username(uuid) from public, anon;
grant execute on function private.account_has_business_username(uuid) to authenticated;

create or replace function private.auth_user_can_stage_submission_media(p_folders text[])
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_submission uuid;
  v_tenant uuid;
begin
  if v_uid is null or array_length(p_folders,1) < 2 then return false; end if;
  if not private.account_has_business_username(v_uid) then return false; end if;
  begin
    v_tenant := p_folders[1]::uuid;
    v_submission := p_folders[2]::uuid;
  exception when others then return false;
  end;
  return exists(
    select 1 from public.business_submissions s
    where s.id=v_submission
      and s.tenant_id=v_tenant
      and s.submitted_by_user_id=v_uid
      and s.status='pending'
      and s.reviewed_at is null
  );
end;
$$;
revoke all on function private.auth_user_can_stage_submission_media(text[]) from public, anon;
grant execute on function private.auth_user_can_stage_submission_media(text[]) to authenticated;

drop policy if exists "public submit business safely" on public.business_submissions;
create policy "account holder submit business safely"
on public.business_submissions for insert to authenticated
with check (
  tenant_id is not null
  and exists(select 1 from public.tenants t where t.id=business_submissions.tenant_id)
  and submitted_by_user_id=(select auth.uid())
  and private.account_has_business_username((select auth.uid()))
  and status='pending'
  and reviewed_by is null and reviewed_at is null and review_notes is null
  and promoted_business_id is null and claim_invited_at is null
  and length(btrim(business_name)) between 2 and 200
  and length(btrim(phone)) between 7 and 40
  and length(btrim(email)) between 5 and 180 and position('@' in email)>1
  and (category is null or length(btrim(category)) between 2 and 120)
  and (city is null or length(btrim(city)) between 2 and 120)
  and operating_model in ('online','storefront','both')
  and consent_to_contact=true
  and source in ('public_site','directory_listing_form')
  and octet_length(profile_data::text)<=30000
);

drop policy if exists "public insert submission media" on public.business_submission_media;
create policy "account holder insert own submission media"
on public.business_submission_media for insert to authenticated
with check (
  status='pending'
  and promoted_at is null
  and promoted_business_media_id is null
  and private.submission_accepts_media(tenant_id,submission_id)
  and exists(
    select 1 from public.business_submissions s
    where s.id=business_submission_media.submission_id
      and s.tenant_id=business_submission_media.tenant_id
      and s.submitted_by_user_id=(select auth.uid())
  )
  and private.account_has_business_username((select auth.uid()))
);

drop policy if exists "public upload pending business submission media" on storage.objects;
create policy "account holder upload own pending business submission media"
on storage.objects for insert to authenticated
with check (
  bucket_id='business-submission-media'
  and private.submission_media_path_allowed(storage.foldername(name))
  and private.auth_user_can_stage_submission_media(storage.foldername(name))
);

drop policy if exists "public submit business claim safely" on public.business_claims;
create policy "account holder submit business claim safely"
on public.business_claims for insert to authenticated
with check (
  status='pending'
  and reviewed_by is null and reviewed_at is null and review_notes is null
  and claimant_user_id=(select auth.uid())
  and private.account_has_business_username((select auth.uid()))
  and exists(
    select 1 from public.businesses b
    where b.id=business_claims.business_id
      and lower(coalesce(b.status,'')) in ('published','pending')
  )
);

create or replace function public.submit_business_ownership_claim(
  p_business_id uuid,
  p_claimant_name text,
  p_claimant_role text,
  p_verification_method text,
  p_verification_details text,
  p_verification_url text default null,
  p_phone text default null
)
returns uuid
language plpgsql
set search_path=''
as $$
declare
  v_id uuid;
  v_uid uuid:=auth.uid();
  v_email text:=lower(coalesce(auth.jwt()->>'email',''));
  v_business public.businesses%rowtype;
  v_submission_id uuid;
  v_method text:=lower(trim(coalesce(p_verification_method,'')));
begin
  if v_uid is null then raise exception 'authentication_required';end if;
  if not private.account_has_business_username(v_uid) then raise exception 'business_username_required';end if;
  if char_length(trim(coalesce(p_claimant_name,'')))<2 then raise exception 'claimant_name_required';end if;
  if char_length(v_email)<5 or position('@' in v_email)<2 then raise exception 'account_email_required';end if;
  if v_method not in('business_email','listed_phone','official_website','registration_license','business_document','official_social','other') then raise exception 'verification_method_required';end if;
  if char_length(trim(coalesce(p_verification_details,'')))<10 then raise exception 'verification_details_required';end if;
  select * into v_business from public.businesses where id=p_business_id;
  if not found then raise exception 'business_not_found';end if;
  if v_business.claimed then raise exception 'business_already_claimed';end if;
  if v_business.status='pending' then
    select s.id into v_submission_id from public.business_submissions s
    where s.promoted_business_id=p_business_id and s.status='approved' and lower(s.email)=v_email
    order by s.reviewed_at desc nulls last limit 1;
    if v_submission_id is null then raise exception 'claim_invitation_email_mismatch';end if;
  elsif v_business.status<>'published' then raise exception 'business_not_claimable';end if;
  if exists(select 1 from public.business_claims c where c.business_id=p_business_id and c.claimant_user_id=v_uid and c.status in('pending','in_review','approved')) then raise exception 'claim_already_submitted';end if;
  insert into public.business_claims(business_id,claimant_user_id,claimant_name,claimant_role,email,phone,status,verification_method,verification_details,verification_url,submission_id)
  values(p_business_id,v_uid,trim(p_claimant_name),nullif(trim(p_claimant_role),''),v_email,nullif(trim(coalesce(p_phone,'')),''),'pending',v_method,trim(p_verification_details),nullif(trim(coalesce(p_verification_url,'')),''),v_submission_id)
  returning id into v_id;
  return v_id;
end;
$$;
