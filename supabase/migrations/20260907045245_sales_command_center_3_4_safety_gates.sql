create or replace function public.consume_skylight_sales_unsubscribe(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_draft public.skylight_sales_outreach_drafts%rowtype;
  v_value text;
begin
  select * into v_draft from public.skylight_sales_outreach_drafts where unsubscribe_token=p_token limit 1;
  if not found then return jsonb_build_object('ok',true,'suppressed',true); end if;
  v_value:=case when v_draft.channel='email' then lower(nullif(trim(coalesce(v_draft.recipient_email,'')),'')) when v_draft.channel in('phone','sms') then nullif(trim(coalesce(v_draft.recipient_phone,'')),'') else null end;
  insert into public.skylight_sales_suppressions(tenant_id,prospect_id,opportunity_id,channel,contact_value,reason,source,active)
  values(v_draft.tenant_id,v_draft.prospect_id,v_draft.opportunity_id,v_draft.channel,v_value,'Recipient requested no further outreach on this channel.','opt_out',true) on conflict do nothing;
  update public.skylight_sales_outreach_drafts set status=case when status in('draft','approved') then 'blocked' else status end,blocked_reason=case when status in('draft','approved') then 'Recipient opted out of this outreach channel.' else blocked_reason end,updated_at=now() where tenant_id=v_draft.tenant_id and prospect_id=v_draft.prospect_id and channel=v_draft.channel and status in('draft','approved');
  update public.skylight_sales_followups set status='cancelled',updated_at=now(),notes=left(coalesce(notes||E'\n','')||'Cancelled because the recipient opted out of this outreach channel.',2400) where tenant_id=v_draft.tenant_id and prospect_id=v_draft.prospect_id and channel=v_draft.channel and status='open';
  insert into public.skylight_sales_outreach_events(tenant_id,opportunity_id,prospect_id,draft_id,campaign_id,campaign_member_id,channel,event_type,notes,metadata) values(v_draft.tenant_id,v_draft.opportunity_id,v_draft.prospect_id,v_draft.id,v_draft.campaign_id,v_draft.campaign_member_id,v_draft.channel,'do_not_contact','Recipient used the outreach unsubscribe control.',jsonb_build_object('scope','channel','source','opt_out'));
  return jsonb_build_object('ok',true,'suppressed',true);
end;$$;
revoke all on function public.consume_skylight_sales_unsubscribe(uuid) from public;
grant execute on function public.consume_skylight_sales_unsubscribe(uuid) to anon,authenticated,service_role;

create or replace function private.enforce_skylight_sales_dnc()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='do_not_contact' and old.status is distinct from new.status then
    update public.skylight_sales_opportunities set active=false,updated_at=now() where tenant_id=new.tenant_id and prospect_id=new.id and stage not in('won','lost');
    update public.skylight_sales_campaign_members m set status='skipped',updated_at=now(),notes=left(coalesce(m.notes||E'\n','')||'Suppressed because the prospect is Do Not Contact.',2400) from public.skylight_sales_campaigns c where m.campaign_id=c.id and c.tenant_id=new.tenant_id and m.prospect_id=new.id and m.status in('queued','research','ready');
    update public.outreach_tasks set status='cancelled',completed_at=coalesce(completed_at,now()),notes=left(coalesce(notes||E'\n','')||'Cancelled because the prospect is Do Not Contact.',2400) where tenant_id=new.tenant_id and prospect_id=new.id and status in('open','in_progress');
    update public.skylight_sales_outreach_drafts set status='blocked',blocked_reason='Prospect is Do Not Contact.',updated_at=now() where tenant_id=new.tenant_id and prospect_id=new.id and status in('draft','approved');
    update public.skylight_sales_followups set status='cancelled',updated_at=now(),notes=left(coalesce(notes||E'\n','')||'Cancelled because the prospect is Do Not Contact.',2400) where tenant_id=new.tenant_id and prospect_id=new.id and status='open';
    insert into public.skylight_sales_suppressions(tenant_id,prospect_id,channel,contact_value,reason,source,active) values(new.tenant_id,new.id,'all',null,'Prospect marked Do Not Contact.','manual',true) on conflict do nothing;
  end if;
  return new;
end;$$;
revoke all on function private.enforce_skylight_sales_dnc() from public,anon,authenticated;
drop trigger if exists trg_enforce_skylight_sales_dnc on public.business_prospects;
create trigger trg_enforce_skylight_sales_dnc after update of status on public.business_prospects for each row execute function private.enforce_skylight_sales_dnc();

create or replace function private.enforce_outreach_task_dnc()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_dnc boolean:=false;
begin
  select exists(select 1 from public.business_prospects p where p.id=new.prospect_id and p.tenant_id=new.tenant_id and p.status='do_not_contact') into v_dnc;
  if v_dnc and new.status in('open','in_progress') then new.status:='cancelled'; new.completed_at:=coalesce(new.completed_at,now()); new.notes:=left(case when nullif(trim(coalesce(new.notes,'')),'') is null then 'Suppressed because the prospect is Do Not Contact.' else new.notes||E'\nSuppressed because the prospect is Do Not Contact.' end,2400); end if;
  return new;
end;$$;
revoke all on function private.enforce_outreach_task_dnc() from public,anon,authenticated;
drop trigger if exists trg_enforce_outreach_task_dnc on public.outreach_tasks;
create trigger trg_enforce_outreach_task_dnc before insert or update of status,task_type on public.outreach_tasks for each row execute function private.enforce_outreach_task_dnc();

update public.skylight_sales_opportunities o set active=false,updated_at=now() from public.business_prospects p where o.prospect_id=p.id and o.tenant_id=p.tenant_id and p.status='do_not_contact' and o.active and o.stage not in('won','lost');
update public.skylight_sales_campaign_members m set status='skipped',updated_at=now(),notes=left(coalesce(m.notes||E'\n','')||'Suppressed because the prospect is Do Not Contact.',2400) from public.skylight_sales_campaigns c, public.business_prospects p where m.campaign_id=c.id and c.tenant_id=p.tenant_id and m.prospect_id=p.id and p.status='do_not_contact' and m.status in('queued','research','ready');
update public.outreach_tasks t set status='cancelled',completed_at=coalesce(t.completed_at,now()),notes=left(coalesce(t.notes||E'\n','')||'Cancelled because the prospect is Do Not Contact.',2400) from public.business_prospects p where t.tenant_id=p.tenant_id and t.prospect_id=p.id and p.status='do_not_contact' and t.status in('open','in_progress');
insert into public.skylight_sales_suppressions(tenant_id,prospect_id,channel,contact_value,reason,source,active) select p.tenant_id,p.id,'all',null,'Prospect marked Do Not Contact before Sales 3.4.','manual',true from public.business_prospects p where p.status='do_not_contact' on conflict do nothing;

create or replace function private.refresh_skylight_sales_opportunities(p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_count integer:=0; v_contact_ready integer:=0; v_research integer:=0;
begin
  update public.skylight_sales_opportunities set active=false,updated_at=now() where tenant_id=p_tenant_id and stage not in('won','lost');
  with candidates as (
    select p.id prospect_id,p.business_id,p.tenant_id,p.opportunity_score,p.marketing_flags,p.owner_contact_email,p.owner_contact_phone,p.owner_contact_source_url,p.owner_contact_checked_at,((coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'') and coalesce(trim(p.owner_contact_source_url),'')<>'' and p.owner_contact_checked_at is not null) verified_owner_contact,coalesce(array_agg(distinct m.service_slug order by m.service_slug) filter(where m.service_slug is not null),'{}'::text[]) recommendations,coalesce(sum(distinct m.weight),0)::integer mapped_weight,(select go.id from public.growth_opportunities go where go.tenant_id=p.tenant_id and go.prospect_id=p.id and go.opportunity_type='skylight_marketing' order by go.score desc,go.updated_at desc limit 1) growth_id
    from public.business_prospects p left join public.skylight_signal_service_map m on m.tenant_id=p.tenant_id and m.active and m.signal_key=any(coalesce(p.marketing_flags,'{}'::text[])) where p.tenant_id=p_tenant_id and p.status<>'do_not_contact' group by p.id,p.business_id,p.tenant_id,p.opportunity_score,p.marketing_flags,p.owner_contact_email,p.owner_contact_phone,p.owner_contact_source_url,p.owner_contact_checked_at having count(m.id)>0
  ), scored as (
    select *,least(100,greatest(coalesce(opportunity_score,0),35)+least(mapped_weight,45)) score,case when 'web-design'=any(recommendations) then 'web-design' when 'seo'=any(recommendations) then 'seo' when 'google-business-profile-optimization'=any(recommendations) then 'google-business-profile-optimization' when 'lead-generation'=any(recommendations) then 'lead-generation' else recommendations[1] end primary_slug,case when verified_owner_contact then 'contact_ready' else 'research' end initial_stage from candidates
  )
  insert into public.skylight_sales_opportunities(tenant_id,prospect_id,business_id,growth_opportunity_id,primary_service_slug,recommended_service_slugs,evidence_flags,score,priority,stage,active,updated_at)
  select tenant_id,prospect_id,business_id,growth_id,primary_slug,recommendations,marketing_flags,score,case when score>=90 then 'hot' when score>=75 then 'high' when score>=55 then 'medium' else 'low' end,initial_stage,true,now() from scored
  on conflict(tenant_id,prospect_id) do update set business_id=excluded.business_id,growth_opportunity_id=excluded.growth_opportunity_id,primary_service_slug=excluded.primary_service_slug,recommended_service_slugs=excluded.recommended_service_slugs,evidence_flags=excluded.evidence_flags,score=excluded.score,priority=excluded.priority,stage=case when public.skylight_sales_opportunities.stage in('contacted','qualified','proposal','won','lost','nurture') then public.skylight_sales_opportunities.stage else excluded.stage end,active=case when public.skylight_sales_opportunities.stage in('won','lost') then false else true end,updated_at=now();
  get diagnostics v_count=row_count;
  insert into public.skylight_sales_campaign_members(campaign_id,opportunity_id,prospect_id,business_id,status,priority,created_at,updated_at)
  select c.id,o.id,o.prospect_id,o.business_id,case when o.stage='contact_ready' then 'ready' else 'research' end,o.priority,now(),now() from public.skylight_sales_campaigns c join public.skylight_sales_opportunities o on o.tenant_id=c.tenant_id and o.active and c.service_slug=any(o.recommended_service_slugs) join public.business_prospects p on p.id=o.prospect_id and p.tenant_id=o.tenant_id and p.status<>'do_not_contact' where c.tenant_id=p_tenant_id and c.status='active' and c.campaign_type='service_outreach'
  on conflict(campaign_id,opportunity_id) where opportunity_id is not null do update set priority=excluded.priority,status=case when public.skylight_sales_campaign_members.status in('queued','research','ready') then excluded.status else public.skylight_sales_campaign_members.status end,updated_at=now();
  select count(*) filter(where stage='contact_ready'),count(*) filter(where stage='research') into v_contact_ready,v_research from public.skylight_sales_opportunities where tenant_id=p_tenant_id and active;
  return jsonb_build_object('opportunities_refreshed',v_count,'contact_ready',v_contact_ready,'research_needed',v_research,'contact_ready_requires_owner_provenance',true,'do_not_contact_excluded',true,'automatic_outreach',false,'billing_authorization',false,'public_ranking_effect',false,'refreshed_at',now());
end;$$;
revoke all on function private.refresh_skylight_sales_opportunities(uuid) from public,anon,authenticated;

create or replace function public.refresh_skylight_sales_opportunities(p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_skylight jsonb; v_recruitment jsonb; v_alerts jsonb;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['admin','super_admin']) then raise exception 'Admin access is required.'; end if;
  v_skylight:=private.refresh_skylight_sales_opportunities(p_tenant_id); v_recruitment:=private.sync_lead_buyer_recruitment_opportunities(p_tenant_id); v_alerts:=private.refresh_skylight_sales_alerts(p_tenant_id);
  return jsonb_build_object('skylight_sales',v_skylight,'lead_buyer_recruitment',v_recruitment,'private_alerts',v_alerts,'automatic_outreach',false,'billing_authorization',false,'public_ranking_effect',false,'refreshed_at',now());
end;$$;
revoke all on function public.refresh_skylight_sales_opportunities(uuid) from public,anon;
grant execute on function public.refresh_skylight_sales_opportunities(uuid) to authenticated,service_role;

create or replace function public.refresh_prospect_research_queue(p_tenant_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_created integer:=0; v_completed integer:=0; v_prioritized integer:=0; v_stage_reconciled integer:=0;
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then raise exception 'Staff access is required.'; end if;
  insert into public.outreach_tasks(tenant_id,prospect_id,assigned_user_id,task_type,due_at,status,notes)
  select o.tenant_id,o.prospect_id,coalesce(o.assigned_user_id,p.assigned_user_id),'contact_research',case o.priority when 'hot' then now() when 'high' then now()+interval '1 day' when 'medium' then now()+interval '3 days' else now()+interval '7 days' end,'open',case when coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'' then 'A potential owner/decision-maker contact channel is recorded, but provenance is incomplete. Verify the association, source URL and checked date before outreach.' else 'Research a legitimate public owner or decision-maker email/phone. Generic listing contact fields are research aids only and are not owner-contact evidence.' end
  from public.skylight_sales_opportunities o join public.business_prospects p on p.id=o.prospect_id and p.tenant_id=o.tenant_id where o.tenant_id=p_tenant_id and o.active and p.status<>'do_not_contact' and o.stage in('new','research') and not ((coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'') and coalesce(trim(p.owner_contact_source_url),'')<>'' and p.owner_contact_checked_at is not null) and not exists(select 1 from public.outreach_tasks t where t.tenant_id=o.tenant_id and t.prospect_id=o.prospect_id and t.task_type='contact_research' and t.status in('open','in_progress')) on conflict do nothing;
  get diagnostics v_created=row_count;
  update public.outreach_tasks t set status='done',completed_at=coalesce(t.completed_at,now()),notes=left(case when nullif(trim(coalesce(t.notes,'')),'') is null then 'Research resolved because the CRM now contains a sourced owner/decision-maker contact channel with a source URL and checked timestamp.' else t.notes||E'\nResearch resolved because the CRM now contains a sourced owner/decision-maker contact channel with a source URL and checked timestamp.' end,2400) from public.business_prospects p where t.tenant_id=p_tenant_id and t.prospect_id=p.id and p.status<>'do_not_contact' and t.task_type='contact_research' and t.status in('open','in_progress') and (coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'') and coalesce(trim(p.owner_contact_source_url),'')<>'' and p.owner_contact_checked_at is not null;
  get diagnostics v_completed=row_count;
  update public.outreach_tasks t set due_at=case o.priority when 'hot' then now() when 'high' then now()+interval '1 day' when 'medium' then now()+interval '3 days' else now()+interval '7 days' end,assigned_user_id=coalesce(t.assigned_user_id,o.assigned_user_id,p.assigned_user_id) from public.skylight_sales_opportunities o join public.business_prospects p on p.id=o.prospect_id and p.tenant_id=o.tenant_id where t.tenant_id=p_tenant_id and t.prospect_id=o.prospect_id and t.task_type='contact_research' and t.status='open' and o.tenant_id=p_tenant_id and o.active and p.status<>'do_not_contact' and o.stage in('new','research');
  get diagnostics v_prioritized=row_count;
  update public.skylight_sales_opportunities o set stage=case when p.status<>'do_not_contact' and (coalesce(trim(p.owner_contact_email),'')<>'' or coalesce(trim(p.owner_contact_phone),'')<>'') and coalesce(trim(p.owner_contact_source_url),'')<>'' and p.owner_contact_checked_at is not null then 'contact_ready' else 'research' end,active=case when p.status='do_not_contact' then false else o.active end,updated_at=now() from public.business_prospects p where o.tenant_id=p_tenant_id and o.prospect_id=p.id and p.tenant_id=o.tenant_id and o.active and o.stage in('new','research','contact_ready');
  get diagnostics v_stage_reconciled=row_count;
  update public.skylight_sales_campaign_members m set status=case when p.status='do_not_contact' then 'skipped' when o.stage='contact_ready' then 'ready' else 'research' end,priority=o.priority,updated_at=now() from public.skylight_sales_opportunities o join public.business_prospects p on p.id=o.prospect_id and p.tenant_id=o.tenant_id where o.tenant_id=p_tenant_id and m.opportunity_id=o.id and m.status in('queued','research','ready');
  return jsonb_build_object('research_tasks_created',v_created,'research_tasks_completed',v_completed,'research_tasks_prioritized',v_prioritized,'sales_stages_reconciled',v_stage_reconciled,'automatic_outreach',false,'billing_authorization',false,'public_ranking_effect',false,'do_not_contact_excluded',true,'refreshed_at',now());
end;$$;
revoke all on function public.refresh_prospect_research_queue(uuid) from public,anon;
grant execute on function public.refresh_prospect_research_queue(uuid) to authenticated;
