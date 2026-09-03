alter table public.outreach_tasks drop constraint if exists outreach_tasks_task_type_check;
alter table public.outreach_tasks add constraint outreach_tasks_task_type_check check(task_type in('verify','contact_research','claim_invite','marketing_outreach','follow_up','call','email','sms'));

create unique index if not exists outreach_tasks_one_open_type_per_prospect_idx
on public.outreach_tasks(tenant_id,prospect_id,task_type)
where status in('open','in_progress');

create or replace function private.sync_growth_outreach_tasks(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_converted integer:=0;
  v_research_created integer:=0;
  v_research_done integer:=0;
  v_claim_created integer:=0;
  v_marketing_created integer:=0;
begin
  update public.outreach_tasks t
  set task_type='contact_research',
      notes=case when nullif(trim(coalesce(t.notes,'')),'') is null then 'Owner contact must be researched before a claim invitation can be sent.' else t.notes||E'\nOwner contact must be researched before a claim invitation can be sent.' end
  from public.business_prospects p
  where t.tenant_id=p_tenant_id and t.prospect_id=p.id and t.task_type='claim_invite' and t.status in('open','in_progress')
    and p.claim_invite_sent_at is null and coalesce(p.owner_contact_email,'')='' and coalesce(p.owner_contact_phone,'')='';
  get diagnostics v_converted=row_count;

  insert into public.outreach_tasks(tenant_id,prospect_id,assigned_user_id,task_type,due_at,status,notes)
  select p_tenant_id,g.prospect_id,p.assigned_user_id,'contact_research',coalesce(p.next_follow_up_at,now()),'open',
    'Research a legitimate public owner or decision-maker email/phone before any claim or marketing outreach. Do not mark outreach sent until contact actually occurs.'
  from public.growth_opportunities g join public.business_prospects p on p.id=g.prospect_id
  where g.tenant_id=p_tenant_id and g.opportunity_type='contact_enrichment' and g.status in('open','in_progress')
    and not exists(select 1 from public.outreach_tasks t where t.tenant_id=p_tenant_id and t.prospect_id=g.prospect_id and t.task_type='contact_research' and t.status in('open','in_progress'));
  get diagnostics v_research_created=row_count;

  update public.outreach_tasks t
  set status='done',completed_at=coalesce(completed_at,now()),
      notes=case when nullif(trim(coalesce(t.notes,'')),'') is null then 'Contact research automatically resolved because an owner contact channel is now present in the prospect CRM.' else t.notes||E'\nContact research automatically resolved because an owner contact channel is now present in the prospect CRM.' end
  from public.business_prospects p
  where t.tenant_id=p_tenant_id and t.prospect_id=p.id and t.task_type='contact_research' and t.status in('open','in_progress')
    and (coalesce(p.owner_contact_email,'')<>'' or coalesce(p.owner_contact_phone,'')<>'');
  get diagnostics v_research_done=row_count;

  insert into public.outreach_tasks(tenant_id,prospect_id,assigned_user_id,task_type,due_at,status,notes)
  select p_tenant_id,g.prospect_id,p.assigned_user_id,'claim_invite',coalesce(p.next_follow_up_at,now()),'open',
    'Contact channel is available. Send a factual invitation to claim the existing free directory listing. A task is not proof the invitation was sent; set the sent timestamp only after actual outreach.'
  from public.growth_opportunities g join public.business_prospects p on p.id=g.prospect_id
  where g.tenant_id=p_tenant_id and g.opportunity_type='claim_activation' and g.status in('open','in_progress')
    and p.claim_invite_sent_at is null and (coalesce(p.owner_contact_email,'')<>'' or coalesce(p.owner_contact_phone,'')<>'')
    and not exists(select 1 from public.outreach_tasks t where t.tenant_id=p_tenant_id and t.prospect_id=g.prospect_id and t.task_type='claim_invite' and t.status in('open','in_progress','done'));
  get diagnostics v_claim_created=row_count;

  insert into public.outreach_tasks(tenant_id,prospect_id,assigned_user_id,task_type,due_at,status,notes)
  select p_tenant_id,g.prospect_id,p.assigned_user_id,'marketing_outreach',coalesce(p.next_follow_up_at,now()),'open',
    'Review the documented marketing flags and make a separate Skylight Reflections Marketing offer only if relevant. Directory organic ranking is not part of this sales offer.'
  from public.growth_opportunities g join public.business_prospects p on p.id=g.prospect_id
  where g.tenant_id=p_tenant_id and g.opportunity_type='skylight_marketing' and g.status in('open','in_progress')
    and p.marketing_pitch_sent_at is null and (coalesce(p.owner_contact_email,'')<>'' or coalesce(p.owner_contact_phone,'')<>'')
    and not exists(select 1 from public.outreach_tasks t where t.tenant_id=p_tenant_id and t.prospect_id=g.prospect_id and t.task_type='marketing_outreach' and t.status in('open','in_progress','done'));
  get diagnostics v_marketing_created=row_count;

  return jsonb_build_object('converted_claim_tasks_to_research',v_converted,'contact_research_created',v_research_created,'contact_research_completed',v_research_done,'claim_tasks_created',v_claim_created,'marketing_tasks_created',v_marketing_created,'synced_at',now());
end$$;

revoke all on function private.sync_growth_outreach_tasks(uuid) from public,anon,authenticated;
grant execute on function private.sync_growth_outreach_tasks(uuid) to service_role;

create or replace function public.refresh_growth_opportunities(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_opportunities jsonb;v_tasks jsonb;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then raise exception 'insufficient_privilege'; end if;
  v_opportunities:=private.refresh_growth_opportunities(p_tenant_id);
  v_tasks:=private.sync_growth_outreach_tasks(p_tenant_id);
  return jsonb_build_object('opportunities',v_opportunities,'outreach_tasks',v_tasks);
end$$;
revoke all on function public.refresh_growth_opportunities(uuid) from public,anon;
grant execute on function public.refresh_growth_opportunities(uuid) to authenticated,service_role;

create or replace function private.refresh_all_growth_opportunities()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare r record;n integer:=0;
begin
  for r in select distinct tenant_id from public.businesses where tenant_id is not null loop
    perform private.refresh_growth_opportunities(r.tenant_id);
    perform private.sync_growth_outreach_tasks(r.tenant_id);
    n:=n+1;
  end loop;
  return n;
end$$;
revoke all on function private.refresh_all_growth_opportunities() from public,anon,authenticated;
grant execute on function private.refresh_all_growth_opportunities() to service_role;

select private.refresh_all_growth_opportunities();
