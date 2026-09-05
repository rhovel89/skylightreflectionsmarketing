-- Bind pending-profile claims to the authenticated account that created the submission.
create or replace function public.get_claimable_business(p_business_id uuid)
returns table(id uuid,name text,status text,phone text,email text,website text,operating_model text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_email text:=lower(coalesce(auth.jwt()->>'email',''));
begin
  if v_uid is null then raise exception 'authentication_required';end if;
  if not private.account_has_business_username(v_uid) then raise exception 'business_username_required';end if;
  return query
  select b.id,b.name,b.status,b.phone,b.email,b.website,coalesce(s.operating_model,'')
  from public.businesses b
  left join lateral(
    select s1.operating_model,s1.email,s1.submitted_by_user_id
    from public.business_submissions s1
    where s1.promoted_business_id=b.id and s1.status='approved'
    order by s1.reviewed_at desc nulls last limit 1
  )s on true
  where b.id=p_business_id
    and b.tenant_id=(select t.id from public.tenants t where t.slug='central-illinois-local-pros' limit 1)
    and b.claimed=false
    and (
      b.status='published'
      or (
        b.status='pending'
        and (s.submitted_by_user_id=v_uid or (s.submitted_by_user_id is null and lower(coalesce(s.email,''))=v_email))
      )
    );
end;
$$;

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
    select s.id into v_submission_id
    from public.business_submissions s
    where s.promoted_business_id=p_business_id
      and s.status='approved'
      and (s.submitted_by_user_id=v_uid or (s.submitted_by_user_id is null and lower(s.email)=v_email))
    order by s.reviewed_at desc nulls last limit 1;
    if v_submission_id is null then raise exception 'claim_invitation_account_mismatch';end if;
  elsif v_business.status<>'published' then raise exception 'business_not_claimable';end if;
  if exists(select 1 from public.business_claims c where c.business_id=p_business_id and c.claimant_user_id=v_uid and c.status in('pending','in_review','approved')) then raise exception 'claim_already_submitted';end if;
  insert into public.business_claims(business_id,claimant_user_id,claimant_name,claimant_role,email,phone,status,verification_method,verification_details,verification_url,submission_id)
  values(p_business_id,v_uid,trim(p_claimant_name),nullif(trim(p_claimant_role),''),v_email,nullif(trim(coalesce(p_phone,'')),''),'pending',v_method,trim(p_verification_details),nullif(trim(coalesce(p_verification_url,'')),''),v_submission_id)
  returning id into v_id;
  return v_id;
end;
$$;
