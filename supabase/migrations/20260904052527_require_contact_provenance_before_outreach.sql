create or replace function private.sync_growth_outreach_tasks(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim_converted integer:=0;
  v_marketing_converted integer:=0;
  v_research_created integer:=0;
  v_research_done integer:=0;
  v_claim_created integer:=0;
  v_marketing_created integer:=0;
begin
  update public.outreach_tasks t
  set task_type='contact_research',
      notes=case when nullif(trim(coalesce(t.notes,'')),'') is null
        then 'Complete owner/decision-maker contact research and provenance before a claim invitation can be sent.'
        else t.notes||E'\nComplete owner/decision-maker contact research and provenance before a claim invitation can be sent.' end
  from public.business_prospects p
  where t.tenant_id=p_tenant_id and t.prospect_id=p.id and t.task_type='claim_invite' and t.status in('open','in_progress')
    and p.claim_invite_sent_at is null
    and not ((coalesce(p.owner_contact_email,'')<>'' or coalesce(p.owner_contact_phone,'')<>'') and coalesce(p.owner_contact_source_url,'')<>'' and p.owner_contact_checked_at is not null);
  get diagnostics v_claim_converted=row_count;

  update public.outreach_tasks t
  set task_type='contact_research',
      notes=case when nullif(trim(coalesce(t.notes,'')),'') is null
        then 'Complete owner/decision-maker contact research and provenance before separate marketing outreach.'
        else t.notes||E'\nComplete owner/decision-maker contact research and provenance before separate marketing outreach.' end
  from public.business_prospects p
  where t.tenant_id=p_tenant_id and t.prospect_id=p.id and t.task_type='marketing_outreach' and t.status in('open','in_progress')
    and p.marketing_pitch_sent_at is null
    and not ((coalesce(p.owner_contact_email,'')<>'' or coalesce(p.owner_contact_phone,'')<>'') and coalesce(p.owner_contact_source_url,'')<>'' and p.owner_contact_checked_at is not null);
  get diagnostics v_marketing_converted=row_count;

  insert into public.outreach_tasks(tenant_id,prospect_id,assigned_user_id,task_type,due_at,status,notes)
  select p_tenant_id,p.id,p.assigned_user_id,'contact_research',coalesce(p.next_follow_up_at,now()),'open',
    case when coalesce(p.owner_contact_email,'')='' and coalesce(p.owner_contact_phone,'')=''
      then 'Research a legitimate public owner or decision-maker email/phone. Generic listing contact fields are not owner-contact evidence.'
      else 'An owner-contact channel is present, but provenance is incomplete. Verify the decision-maker association, store the source URL and checked date, then proceed.' end
  from public.business_prospects p join public.businesses b on b.id=p.business_id and b.tenant_id=p.tenant_id
  where p.tenant_id=p_tenant_id and b.status='published' and not coalesce(b.claimed,false) and p.status<>'do_not_contact'
    and not ((coalesce(p.owner_contact_email,'')<>'' or coalesce(p.owner_contact_phone,'')<>'') and coalesce(p.owner_contact_source_url,'')<>'' and p.owner_contact_checked_at is not null)
    and not exists(select 1 from public.outreach_tasks t where t.tenant_id=p_tenant_id and t.prospect_id=p.id and t.task_type='contact_research' and t.status in('open','in_progress'));
  get diagnostics v_research_created=row_count;

  update public.outreach_tasks t
  set status='done',completed_at=coalesce(completed_at,now()),
      notes=case when nullif(trim(coalesce(t.notes,'')),'') is null
        then 'Contact research automatically resolved because an evidence-backed owner/decision-maker contact is now present in the CRM.'
        else t.notes||E'\nContact research automatically resolved because an evidence-backed owner/decision-maker contact is now present in the CRM.' end
  from public.business_prospects p
  where t.tenant_id=p_tenant_id and t.prospect_id=p.id and t.task_type='contact_research' and t.status in('open','in_progress')
    and (coalesce(p.owner_contact_email,'')<>'' or coalesce(p.owner_contact_phone,'')<>'') and coalesce(p.owner_contact_source_url,'')<>'' and p.owner_contact_checked_at is not null;
  get diagnostics v_research_done=row_count;

  insert into public.outreach_tasks(tenant_id,prospect_id,assigned_user_id,task_type,due_at,status,notes)
  select p_tenant_id,g.prospect_id,p.assigned_user_id,'claim_invite',coalesce(p.next_follow_up_at,now()),'open',
    'Evidence-backed owner/decision-maker contact is available. Send a factual invitation to claim the existing free directory listing. A task is not proof the invitation was sent; set the sent timestamp only after actual outreach.'
  from public.growth_opportunities g join public.business_prospects p on p.id=g.prospect_id
  where g.tenant_id=p_tenant_id and g.opportunity_type='claim_activation' and g.status in('open','in_progress') and p.claim_invite_sent_at is null
    and (coalesce(p.owner_contact_email,'')<>'' or coalesce(p.owner_contact_phone,'')<>'') and coalesce(p.owner_contact_source_url,'')<>'' and p.owner_contact_checked_at is not null
    and not exists(select 1 from public.outreach_tasks t where t.tenant_id=p_tenant_id and t.prospect_id=g.prospect_id and t.task_type='claim_invite' and t.status in('open','in_progress','done'));
  get diagnostics v_claim_created=row_count;

  insert into public.outreach_tasks(tenant_id,prospect_id,assigned_user_id,task_type,due_at,status,notes)
  select p_tenant_id,g.prospect_id,p.assigned_user_id,'marketing_outreach',coalesce(p.next_follow_up_at,now()),'open',
    'Review the documented marketing flags and make a separate Skylight Reflections Marketing offer only if relevant. Directory organic ranking is not part of this sales offer.'
  from public.growth_opportunities g join public.business_prospects p on p.id=g.prospect_id
  where g.tenant_id=p_tenant_id and g.opportunity_type='skylight_marketing' and g.status in('open','in_progress') and p.marketing_pitch_sent_at is null
    and (coalesce(p.owner_contact_email,'')<>'' or coalesce(p.owner_contact_phone,'')<>'') and coalesce(p.owner_contact_source_url,'')<>'' and p.owner_contact_checked_at is not null
    and not exists(select 1 from public.outreach_tasks t where t.tenant_id=p_tenant_id and t.prospect_id=g.prospect_id and t.task_type='marketing_outreach' and t.status in('open','in_progress','done'));
  get diagnostics v_marketing_created=row_count;

  return jsonb_build_object('converted_claim_tasks_to_research',v_claim_converted,'converted_marketing_tasks_to_research',v_marketing_converted,'contact_research_created',v_research_created,'contact_research_completed',v_research_done,'claim_tasks_created',v_claim_created,'marketing_tasks_created',v_marketing_created,'synced_at',now());
end;
$$;

revoke all on function private.sync_growth_outreach_tasks(uuid) from public, anon, authenticated;

comment on function private.sync_growth_outreach_tasks(uuid) is
  'Synchronizes staff outreach work while requiring an actionable owner/decision-maker contact plus provenance source URL and checked date before claim or marketing outreach tasks are created. Tasks never imply outreach was sent.';