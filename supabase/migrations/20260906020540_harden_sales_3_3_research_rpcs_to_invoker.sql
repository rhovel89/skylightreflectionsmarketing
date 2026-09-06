create or replace function public.refresh_prospect_research_queue(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_created integer:=0;
  v_completed integer:=0;
  v_prioritized integer:=0;
  v_stage_reconciled integer:=0;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then
    raise exception 'Staff access is required.';
  end if;

  insert into public.outreach_tasks(tenant_id,prospect_id,assigned_user_id,task_type,due_at,status,notes)
  select
    o.tenant_id,
    o.prospect_id,
    coalesce(o.assigned_user_id,p.assigned_user_id),
    'contact_research',
    case o.priority
      when 'hot' then now()
      when 'high' then now()+interval '1 day'
      when 'medium' then now()+interval '3 days'
      else now()+interval '7 days'
    end,
    'open',
    case
      when coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>''
        then 'A potential owner/decision-maker contact channel is recorded, but provenance is incomplete. Verify the association, source URL and checked date before outreach.'
      else 'Research a legitimate public owner or decision-maker email/phone. Generic listing contact fields are research aids only and are not owner-contact evidence.'
    end
  from public.skylight_sales_opportunities o
  join public.business_prospects p on p.id=o.prospect_id and p.tenant_id=o.tenant_id
  where o.tenant_id=p_tenant_id
    and o.active
    and o.stage in('new','research')
    and not (
      (coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'')
      and coalesce(trim(p.owner_contact_source_url),'')<>''
      and p.owner_contact_checked_at is not null
    )
    and not exists(
      select 1 from public.outreach_tasks t
      where t.tenant_id=o.tenant_id and t.prospect_id=o.prospect_id and t.task_type='contact_research' and t.status in('open','in_progress')
    )
  on conflict do nothing;
  get diagnostics v_created=row_count;

  update public.outreach_tasks t
  set status='done',
      completed_at=coalesce(t.completed_at,now()),
      notes=left(
        case when nullif(trim(coalesce(t.notes,'')),'') is null
          then 'Research resolved because the CRM now contains a sourced owner/decision-maker contact channel with a source URL and checked timestamp.'
          else t.notes||E'\nResearch resolved because the CRM now contains a sourced owner/decision-maker contact channel with a source URL and checked timestamp.'
        end,
        2400
      )
  from public.business_prospects p
  where t.tenant_id=p_tenant_id
    and t.prospect_id=p.id
    and t.task_type='contact_research'
    and t.status in('open','in_progress')
    and (coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'')
    and coalesce(trim(p.owner_contact_source_url),'')<>''
    and p.owner_contact_checked_at is not null;
  get diagnostics v_completed=row_count;

  update public.outreach_tasks t
  set due_at=case o.priority
        when 'hot' then now()
        when 'high' then now()+interval '1 day'
        when 'medium' then now()+interval '3 days'
        else now()+interval '7 days'
      end,
      assigned_user_id=coalesce(t.assigned_user_id,o.assigned_user_id,p.assigned_user_id)
  from public.skylight_sales_opportunities o
  join public.business_prospects p on p.id=o.prospect_id and p.tenant_id=o.tenant_id
  where t.tenant_id=p_tenant_id
    and t.prospect_id=o.prospect_id
    and t.task_type='contact_research'
    and t.status='open'
    and o.tenant_id=p_tenant_id
    and o.active
    and o.stage in('new','research');
  get diagnostics v_prioritized=row_count;

  update public.skylight_sales_opportunities o
  set stage=case
        when (coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'')
          and coalesce(trim(p.owner_contact_source_url),'')<>''
          and p.owner_contact_checked_at is not null
          then 'contact_ready'
        else 'research'
      end,
      updated_at=now()
  from public.business_prospects p
  where o.tenant_id=p_tenant_id
    and o.prospect_id=p.id
    and p.tenant_id=o.tenant_id
    and o.active
    and o.stage in('new','research','contact_ready');
  get diagnostics v_stage_reconciled=row_count;

  update public.skylight_sales_campaign_members m
  set status=case when o.stage='contact_ready' then 'ready' else 'research' end,
      priority=o.priority,
      updated_at=now()
  from public.skylight_sales_opportunities o
  where o.tenant_id=p_tenant_id
    and m.opportunity_id=o.id
    and m.status in('queued','research','ready');

  return jsonb_build_object(
    'research_tasks_created',v_created,
    'research_tasks_completed',v_completed,
    'research_tasks_prioritized',v_prioritized,
    'sales_stages_reconciled',v_stage_reconciled,
    'downstream_outreach_sync','scheduled_growth_refresh',
    'automatic_outreach',false,
    'public_ranking_effect',false,
    'refreshed_at',now()
  );
end;
$$;

revoke all on function public.refresh_prospect_research_queue(uuid) from public,anon;
grant execute on function public.refresh_prospect_research_queue(uuid) to authenticated;

comment on function public.refresh_prospect_research_queue(uuid) is
  'SECURITY INVOKER staff-only Sales 3.3 research queue refresh. RLS governs all writes. Prioritizes evidence-backed contact research and reconciles private sales readiness. Downstream claim/marketing task sync remains handled by the existing scheduled growth refresh; no outreach is sent.';

create or replace function public.verify_prospect_owner_contact(
  p_tenant_id uuid,
  p_prospect_id uuid,
  p_contact_name text,
  p_contact_title text,
  p_contact_email text,
  p_contact_phone text,
  p_source_url text,
  p_checked_at timestamptz,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_email text:=nullif(trim(coalesce(p_contact_email,'')),'');
  v_phone text:=nullif(trim(coalesce(p_contact_phone,'')),'');
  v_source text:=nullif(trim(coalesce(p_source_url,'')),'');
  v_checked timestamptz:=coalesce(p_checked_at,now());
  v_tasks_completed integer:=0;
  v_sales_ready integer:=0;
begin
  if v_user is null or not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then
    raise exception 'Staff access is required.';
  end if;
  if v_email is null and v_phone is null then
    raise exception 'A sourced owner/decision-maker email or phone is required.';
  end if;
  if v_source is null or v_source !~* '^https?://' then
    raise exception 'A valid http(s) source URL is required before Contact Ready.';
  end if;
  if length(v_source)>1000 then raise exception 'Source URL is too long.'; end if;
  if v_email is not null and length(v_email)>240 then raise exception 'Email is too long.'; end if;
  if v_phone is not null and length(v_phone)>80 then raise exception 'Phone is too long.'; end if;
  if not exists(select 1 from public.business_prospects p where p.id=p_prospect_id and p.tenant_id=p_tenant_id and p.status<>'do_not_contact') then
    raise exception 'Eligible prospect not found.';
  end if;

  update public.business_prospects
  set owner_contact_name=nullif(trim(coalesce(p_contact_name,'')),''),
      owner_contact_title=nullif(trim(coalesce(p_contact_title,'')),''),
      owner_contact_email=v_email,
      owner_contact_phone=v_phone,
      owner_contact_source_url=v_source,
      owner_contact_checked_at=v_checked,
      status=case when status='research' then 'contact_ready' else status end,
      crm_stage=case when crm_stage in('research','verify') then 'claim_outreach' else crm_stage end,
      notes=case
        when nullif(trim(coalesce(p_notes,'')),'') is null then notes
        when nullif(trim(coalesce(notes,'')),'') is null then left(trim(p_notes),2400)
        else left(notes||E'\n'||trim(p_notes),2400)
      end,
      updated_at=now()
  where tenant_id=p_tenant_id and id=p_prospect_id;

  update public.outreach_tasks
  set status='done',completed_at=coalesce(completed_at,now()),
      notes=left(case when nullif(trim(coalesce(notes,'')),'') is null
        then 'Completed after staff verified a sourced owner/decision-maker contact in Sales Research 3.3.'
        else notes||E'\nCompleted after staff verified a sourced owner/decision-maker contact in Sales Research 3.3.' end,2400)
  where tenant_id=p_tenant_id and prospect_id=p_prospect_id and task_type='contact_research' and status in('open','in_progress');
  get diagnostics v_tasks_completed=row_count;

  update public.skylight_sales_opportunities
  set stage='contact_ready',active=true,updated_at=now()
  where tenant_id=p_tenant_id and prospect_id=p_prospect_id and active and stage in('new','research','contact_ready');
  get diagnostics v_sales_ready=row_count;

  update public.skylight_sales_campaign_members m
  set status='ready',updated_at=now()
  from public.skylight_sales_opportunities o
  where o.tenant_id=p_tenant_id and o.prospect_id=p_prospect_id and m.opportunity_id=o.id and m.status in('queued','research','ready');

  insert into public.prospect_activities(tenant_id,prospect_id,actor_user_id,activity_type,summary,metadata)
  values(
    p_tenant_id,p_prospect_id,v_user,'research',
    'Verified sourced owner/decision-maker contact for private sales readiness.',
    jsonb_build_object(
      'research_outcome','verified_contact',
      'source_url',v_source,
      'checked_at',v_checked,
      'has_email',v_email is not null,
      'has_phone',v_phone is not null,
      'contact_name',nullif(trim(coalesce(p_contact_name,'')),''),
      'contact_title',nullif(trim(coalesce(p_contact_title,'')),'')
    )
  );

  return jsonb_build_object(
    'ok',true,
    'contact_ready',true,
    'research_tasks_completed',v_tasks_completed,
    'sales_opportunities_ready',v_sales_ready,
    'downstream_outreach_sync','scheduled_growth_refresh',
    'private_alert_sync','scheduled_sales_refresh',
    'automatic_outreach',false,
    'billing_authorization',false,
    'public_ranking_effect',false,
    'verified_at',now()
  );
end;
$$;

revoke all on function public.verify_prospect_owner_contact(uuid,uuid,text,text,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.verify_prospect_owner_contact(uuid,uuid,text,text,text,text,text,timestamptz,text) to authenticated;

comment on function public.verify_prospect_owner_contact(uuid,uuid,text,text,text,text,text,timestamptz,text) is
  'SECURITY INVOKER, RLS-governed staff verification of sourced owner/decision-maker contact provenance. Resolves research and moves only private sales readiness. Scheduled growth/sales refresh handles downstream tasks and alerts. It never sends outreach or authorizes billing/routing.';

create or replace function public.record_prospect_research_attempt(
  p_tenant_id uuid,
  p_prospect_id uuid,
  p_research_source_url text,
  p_notes text,
  p_next_review_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_source text:=nullif(trim(coalesce(p_research_source_url,'')),'');
  v_note text:=nullif(trim(coalesce(p_notes,'')),'');
  v_next timestamptz:=coalesce(p_next_review_at,now()+interval '7 days');
  v_task_id uuid;
begin
  if v_user is null or not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then
    raise exception 'Staff access is required.';
  end if;
  if v_source is null or v_source !~* '^https?://' then
    raise exception 'A valid http(s) research source URL is required.';
  end if;
  if length(v_source)>1000 then raise exception 'Research source URL is too long.'; end if;
  if not exists(select 1 from public.business_prospects p where p.id=p_prospect_id and p.tenant_id=p_tenant_id and p.status<>'do_not_contact') then
    raise exception 'Eligible prospect not found.';
  end if;

  insert into public.prospect_activities(tenant_id,prospect_id,actor_user_id,activity_type,summary,metadata)
  values(
    p_tenant_id,p_prospect_id,v_user,'research',
    'Research attempt recorded; no sourced owner/decision-maker contact was verified.',
    jsonb_build_object('research_outcome','no_verified_contact','research_source_url',v_source,'notes',v_note,'next_review_at',v_next)
  );

  update public.outreach_tasks
  set status='in_progress',due_at=v_next,
      notes=left(case when nullif(trim(coalesce(notes,'')),'') is null
        then 'Research attempt recorded. Source reviewed: '||v_source||coalesce(E'\n'||v_note,'')
        else notes||E'\nResearch attempt recorded. Source reviewed: '||v_source||coalesce(E'\n'||v_note,'') end,2400)
  where tenant_id=p_tenant_id and prospect_id=p_prospect_id and task_type='contact_research' and status in('open','in_progress')
  returning id into v_task_id;

  if v_task_id is null then
    insert into public.outreach_tasks(tenant_id,prospect_id,task_type,due_at,status,notes)
    values(p_tenant_id,p_prospect_id,'contact_research',v_next,'in_progress',left('Research attempt recorded. Source reviewed: '||v_source||coalesce(E'\n'||v_note,''),2400))
    returning id into v_task_id;
  end if;

  update public.skylight_sales_opportunities
  set stage='research',updated_at=now()
  where tenant_id=p_tenant_id and prospect_id=p_prospect_id and active and stage in('new','research','contact_ready')
    and not exists(
      select 1 from public.business_prospects p
      where p.id=p_prospect_id and p.tenant_id=p_tenant_id
        and (coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'')
        and coalesce(trim(p.owner_contact_source_url),'')<>'' and p.owner_contact_checked_at is not null
    );

  return jsonb_build_object(
    'ok',true,
    'research_task_id',v_task_id,
    'next_review_at',v_next,
    'contact_ready',false,
    'automatic_outreach',false,
    'public_ranking_effect',false,
    'recorded_at',now()
  );
end;
$$;

revoke all on function public.record_prospect_research_attempt(uuid,uuid,text,text,timestamptz) from public,anon;
grant execute on function public.record_prospect_research_attempt(uuid,uuid,text,text,timestamptz) to authenticated;

comment on function public.record_prospect_research_attempt(uuid,uuid,text,text,timestamptz) is
  'SECURITY INVOKER, RLS-governed private staff research attempt logging without contact fabrication. Keeps private sales in Research and schedules the next review. No outreach is sent.';
