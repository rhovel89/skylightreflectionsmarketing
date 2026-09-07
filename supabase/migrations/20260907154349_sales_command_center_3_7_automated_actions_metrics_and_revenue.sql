-- Sales Command Center 3.7 automation
-- Database-native daily task generation, factual snapshots, and paid-revenue reconciliation.
-- These routines create/update administrative records only. They never send email/SMS, create charges, send proposals, or change public ranking.

alter table public.skylight_sales_action_items
  add column if not exists last_seen_at timestamptz not null default now();
create index if not exists idx_skylight_sales_action_items_last_seen
  on public.skylight_sales_action_items(tenant_id,status,last_seen_at) where auto_generated=true;

create or replace function private.refresh_skylight_sales_action_queue(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_started timestamptz := now();
  v_settings public.skylight_sales_action_settings%rowtype;
  v_open integer := 0;
  v_resolved integer := 0;
  v_run_id uuid;
begin
  if auth.uid() is not null and not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then
    raise exception 'Not authorized for this tenant';
  end if;

  insert into public.skylight_sales_action_settings(tenant_id)
  values(p_tenant_id)
  on conflict(tenant_id) do nothing;
  select * into v_settings from public.skylight_sales_action_settings where tenant_id=p_tenant_id;
  if not coalesce(v_settings.action_queue_enabled,true) then
    return jsonb_build_object('ok',true,'enabled',false,'generated',0,'resolved',0);
  end if;

  insert into public.skylight_sales_automation_runs(tenant_id,run_type,source,status,metadata)
  values(p_tenant_id,'action_refresh',case when auth.uid() is null then 'system' else 'staff' end,'running',jsonb_build_object('automatic_outreach',false,'billing_authorization',false,'public_ranking_effect',false))
  returning id into v_run_id;

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,campaign_id,reply_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select r.tenant_id,r.opportunity_id,r.prospect_id,r.campaign_id,r.id,'reply_review',
    case when r.classification_suggestion in ('do_not_contact','bounce','wrong_person') then 'urgent' else 'high' end,
    'open','reply-review:'||r.id::text,'Review inbound reply',coalesce(r.suggestion_reason,'An inbound reply is waiting for staff classification.'),
    'Open the Sales Inbox, review the exact reply, confirm or correct its classification, then choose the next human action.',coalesce(r.received_at,now()),o.assigned_user_id,
    jsonb_build_object('classification_suggestion',r.classification_suggestion,'classification_advisory',true),now()
  from public.skylight_sales_replies r join public.skylight_sales_opportunities o on o.id=r.opportunity_id
  where r.tenant_id=p_tenant_id and r.review_status='pending'
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,unmatched_inbound_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,metadata,last_seen_at)
  select u.tenant_id,u.id,'unmatched_inbound_review','high','open','unmatched-inbound:'||u.id::text,'Match or dismiss inbound email','An inbound email could not be safely connected to an existing Sales opportunity.',
    'Review sender, subject and body. Attach it to the correct real opportunity only when the match is supported; otherwise dismiss it.',u.received_at,jsonb_build_object('sender_email',u.sender_email,'subject',u.subject),now()
  from public.skylight_sales_unmatched_inbound u where u.tenant_id=p_tenant_id and u.status='unmatched'
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,reply_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select d.tenant_id,d.opportunity_id,d.prospect_id,d.reply_id,'response_approval',case when d.status='approved' then 'high' else 'medium' end,'open','response-draft:'||d.id::text,
    case when d.status='approved' then 'Approved response waiting for explicit send' else 'Review response draft' end,
    case when d.status='approved' then 'A staff-approved response has not been sent.' else 'A response draft still requires human review and approval.' end,
    case when d.status='approved' then 'Re-read the conversation and suppression state, then explicitly send or revise the response.' else 'Review/edit the response and explicitly approve it only if appropriate.' end,
    d.created_at,o.assigned_user_id,jsonb_build_object('response_draft_id',d.id,'status',d.status),now()
  from public.skylight_sales_response_drafts d join public.skylight_sales_opportunities o on o.id=d.opportunity_id
  where d.tenant_id=p_tenant_id and d.status in ('draft','approved')
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,campaign_id,followup_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select f.tenant_id,f.opportunity_id,f.prospect_id,f.campaign_id,f.id,'followup_due',case when f.due_at < now()-interval '3 days' then 'urgent' else 'high' end,'open','followup-due:'||f.id::text,
    'Follow-up due','A human follow-up task is due or overdue.','Review prior history and suppression state, prepare the appropriate follow-up, and send only after explicit staff approval.',f.due_at,coalesce(f.assigned_user_id,o.assigned_user_id),jsonb_build_object('sequence_stage',f.sequence_stage,'channel',f.channel),now()
  from public.skylight_sales_followups f join public.skylight_sales_opportunities o on o.id=f.opportunity_id
  where f.tenant_id=p_tenant_id and f.status='open' and f.due_at<=now()
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select o.tenant_id,o.id,o.prospect_id,'hot_opportunity','high','open','hot-opportunity:'||o.id::text,'Hot opportunity needs a next action','Opportunity score/priority is high and no later follow-up is protecting it.',
    'Review the opportunity, recent contact history and evidence, then set the next concrete staff action.',coalesce(o.next_follow_up_at,now()),o.assigned_user_id,jsonb_build_object('score',o.score,'priority',o.priority,'stage',o.stage),now()
  from public.skylight_sales_opportunities o left join public.business_prospects bp on bp.id=o.prospect_id
  where o.tenant_id=p_tenant_id and o.active=true and o.stage not in ('won','lost') and coalesce(bp.status,'')<>'do_not_contact'
    and (o.priority='hot' or o.score>=v_settings.hot_score_threshold) and (o.next_follow_up_at is null or o.next_follow_up_at<=now()+interval '1 day')
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select o.tenant_id,o.id,o.prospect_id,'opportunity_stalled',case when o.stage in ('qualified','proposal') then 'high' else 'medium' end,'open','stalled-opportunity:'||o.id::text,
    'Opportunity appears stalled','No opportunity update has been recorded within the configured stale window.','Review the actual history. Either define the next action, move it to nurture, or close it with a factual outcome reason.',now(),o.assigned_user_id,jsonb_build_object('stage',o.stage,'last_updated_at',o.updated_at,'stale_days',v_settings.stale_opportunity_days),now()
  from public.skylight_sales_opportunities o left join public.skylight_sales_thread_state t on t.opportunity_id=o.id left join public.business_prospects bp on bp.id=o.prospect_id
  where o.tenant_id=p_tenant_id and o.active=true and o.stage in ('contact_ready','contacted','qualified','proposal','nurture')
    and o.updated_at < now() - make_interval(days=>v_settings.stale_opportunity_days) and coalesce(t.status,'')<>'waiting_on_us' and coalesce(bp.status,'')<>'do_not_contact'
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,campaign_id,meeting_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select m.tenant_id,m.opportunity_id,m.prospect_id,m.campaign_id,m.id,'meeting_upcoming',case when m.scheduled_at<=now()+interval '4 hours' then 'urgent' else 'high' end,'open','meeting-upcoming:'||m.id::text,
    'Upcoming sales meeting','A scheduled meeting is inside the configured reminder window.',case when m.calendar_sync_status='linked' then 'Review the account, evidence, prior conversation and discovery notes before the meeting.' else 'Review the account and create the Google Calendar event explicitly if desired; no invite is sent automatically.' end,
    m.scheduled_at,o.assigned_user_id,jsonb_build_object('calendar_sync_status',m.calendar_sync_status,'meeting_type',m.meeting_type),now()
  from public.skylight_sales_meetings m join public.skylight_sales_opportunities o on o.id=m.opportunity_id
  where m.tenant_id=p_tenant_id and m.status='scheduled' and m.scheduled_at>=now() and m.scheduled_at<=now()+make_interval(hours=>v_settings.meeting_reminder_hours)
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,campaign_id,proposal_handoff_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select h.tenant_id,h.opportunity_id,h.prospect_id,h.campaign_id,h.id,'proposal_create','high','open','proposal-create:'||h.id::text,'Create draft proposal','A staff-reviewed proposal handoff is Ready but is not linked to a proposal.',
    'Create the draft proposal, verify scope/pricing/terms, then use the existing proposal workflow. Do not send automatically.',now(),o.assigned_user_id,jsonb_build_object('estimated_value_cents',h.estimated_value_cents,'recommended_services',h.recommended_service_slugs),now()
  from public.skylight_sales_proposal_handoffs h join public.skylight_sales_opportunities o on o.id=h.opportunity_id
  where h.tenant_id=p_tenant_id and h.status='ready' and h.proposal_id is null
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,proposal_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select o.tenant_id,o.id,o.prospect_id,p.id,'proposal_followup','high','open','proposal-followup:'||p.id::text,'Proposal follow-up due',
    case when p.viewed_at is null then 'A sent proposal has not been viewed within the configured window.' else 'A viewed proposal has no recorded decision within the configured window.' end,
    'Review the proposal and conversation history. Follow up manually if appropriate; do not alter acceptance or billing state automatically.',now(),o.assigned_user_id,jsonb_build_object('proposal_status',p.status,'sent_at',p.sent_at,'viewed_at',p.viewed_at,'total_cents',p.total_cents),now()
  from public.skylight_sales_opportunities o join public.skylight_proposals p on p.id=o.proposal_id
  where o.tenant_id=p_tenant_id and p.status in ('sent','viewed') and p.accepted_at is null and p.declined_at is null
    and ((p.viewed_at is null and p.sent_at is not null and p.sent_at<=now()-make_interval(days=>v_settings.proposal_sent_followup_days)) or (p.viewed_at is not null and p.viewed_at<=now()-make_interval(days=>v_settings.proposal_viewed_followup_days)))
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,proposal_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select o.tenant_id,o.id,o.prospect_id,p.id,'proposal_expiring',case when p.expires_at<=current_date+1 then 'urgent' else 'high' end,'open','proposal-expiring:'||p.id::text,'Proposal nearing expiration','An open proposal expires inside the configured warning window.',
    'Review the proposal and customer conversation. Extend or follow up only through an explicit staff action.',p.expires_at::timestamptz,o.assigned_user_id,jsonb_build_object('expires_at',p.expires_at,'proposal_status',p.status),now()
  from public.skylight_sales_opportunities o join public.skylight_proposals p on p.id=o.proposal_id
  where o.tenant_id=p_tenant_id and p.expires_at is not null and p.accepted_at is null and p.declined_at is null and p.status not in ('accepted','declined','expired') and p.expires_at between current_date and current_date+v_settings.proposal_expiring_days
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,invoice_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select o.tenant_id,o.id,o.prospect_id,i.id,'invoice_due','medium','open','invoice-due:'||i.id::text,'Linked invoice due soon','An explicitly linked Sales invoice has an outstanding balance and is approaching its due date.',
    'Review the invoice/customer history. Any reminder, payment change or collection action remains an explicit staff decision.',i.due_date::timestamptz,o.assigned_user_id,jsonb_build_object('balance_due_cents',i.balance_due_cents,'invoice_status',i.status),now()
  from public.skylight_sales_opportunities o join public.skylight_invoices i on i.id=o.invoice_id
  where o.tenant_id=p_tenant_id and i.balance_due_cents>0 and i.status not in ('paid','void') and i.due_date is not null and i.due_date>=current_date and i.due_date<=current_date+v_settings.invoice_due_soon_days
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,invoice_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select o.tenant_id,o.id,o.prospect_id,i.id,'invoice_overdue','high','open','invoice-overdue:'||i.id::text,'Linked invoice overdue','An explicitly linked Sales invoice has an outstanding balance past its due date.',
    'Review the invoice and client record. Any reminder, payment-plan, collection or billing change requires a deliberate staff action.',i.due_date::timestamptz,o.assigned_user_id,jsonb_build_object('balance_due_cents',i.balance_due_cents,'invoice_status',i.status),now()
  from public.skylight_sales_opportunities o join public.skylight_invoices i on i.id=o.invoice_id
  where o.tenant_id=p_tenant_id and i.balance_due_cents>0 and i.status not in ('paid','void') and i.due_date<current_date
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,invoice_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select o.tenant_id,o.id,o.prospect_id,i.id,'revenue_sync','low','open','revenue-sync:'||o.id::text,'Refresh paid-revenue attribution','The paid amount on the explicitly linked invoice differs from the opportunity attribution snapshot.',
    'Run Revenue Reconcile. This updates reporting only and does not modify the invoice or payment record.',now(),o.assigned_user_id,jsonb_build_object('attributed_revenue_cents',o.attributed_revenue_cents,'invoice_paid_cents',i.amount_paid_cents),now()
  from public.skylight_sales_opportunities o join public.skylight_invoices i on i.id=o.invoice_id
  where o.tenant_id=p_tenant_id and coalesce(o.attributed_revenue_cents,0)<>coalesce(i.amount_paid_cents,0)
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select o.tenant_id,o.id,o.prospect_id,'win_loss_review','medium','open','outcome-review:'||o.id::text,'Capture win/loss reason','A closed Sales opportunity does not have a structured outcome reason.',
    'Review the record and capture the factual reason. Do not infer a reason that was not documented.',now(),o.assigned_user_id,jsonb_build_object('stage',o.stage),now()
  from public.skylight_sales_opportunities o
  where o.tenant_id=p_tenant_id and o.stage in ('won','lost') and coalesce(nullif(o.outcome_reason_code,''),nullif(o.lost_reason,'')) is null
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  insert into public.skylight_sales_action_items(tenant_id,opportunity_id,prospect_id,proposal_id,action_type,priority,status,fingerprint,title,reason,recommended_action,due_at,assigned_user_id,metadata,last_seen_at)
  select o.tenant_id,o.id,o.prospect_id,p.id,'client_project_handoff','high','open','client-project-handoff:'||o.id::text,'Accepted proposal needs project handoff','The linked proposal is accepted but no project is linked to this Sales opportunity.',
    'Review the accepted proposal and existing project records. Create/link the project through the normal operations workflow; do not create duplicate projects.',now(),o.assigned_user_id,jsonb_build_object('proposal_id',p.id,'proposal_status',p.status),now()
  from public.skylight_sales_opportunities o join public.skylight_proposals p on p.id=o.proposal_id
  where o.tenant_id=p_tenant_id and p.accepted_at is not null and o.project_id is null and not exists(select 1 from public.skylight_projects pj where pj.tenant_id=p_tenant_id and pj.proposal_id=p.id)
  on conflict(tenant_id,fingerprint) where status in ('open','in_progress') do update
    set priority=excluded.priority,title=excluded.title,reason=excluded.reason,recommended_action=excluded.recommended_action,due_at=excluded.due_at,assigned_user_id=excluded.assigned_user_id,metadata=excluded.metadata,last_seen_at=now(),updated_at=now();

  update public.skylight_sales_action_items
  set status='completed',completed_at=now(),updated_at=now(),metadata=metadata||jsonb_build_object('auto_resolved',true,'auto_resolved_at',now())
  where tenant_id=p_tenant_id and auto_generated=true and status='open' and last_seen_at<v_started;
  get diagnostics v_resolved = row_count;

  select count(*) into v_open from public.skylight_sales_action_items where tenant_id=p_tenant_id and status in ('open','in_progress');
  update public.skylight_sales_automation_runs set status='completed',generated_count=v_open,updated_count=v_resolved,completed_at=now(),metadata=metadata||jsonb_build_object('open_actions',v_open,'auto_resolved',v_resolved) where id=v_run_id;
  return jsonb_build_object('ok',true,'enabled',true,'open_actions',v_open,'auto_resolved',v_resolved,'automatic_outreach',false,'billing_authorization',false,'public_ranking_effect',false);
exception when others then
  if v_run_id is not null then update public.skylight_sales_automation_runs set status='failed',error_message=left(sqlerrm,2000),completed_at=now() where id=v_run_id; end if;
  raise;
end;
$$;

create or replace function private.reconcile_skylight_sales_paid_revenue(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare v_changed integer:=0; v_run_id uuid;
begin
  if auth.uid() is not null and not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then raise exception 'Not authorized for this tenant'; end if;
  insert into public.skylight_sales_automation_runs(tenant_id,run_type,source,status,metadata)
  values(p_tenant_id,'revenue_reconcile',case when auth.uid() is null then 'system' else 'staff' end,'running',jsonb_build_object('paid_revenue_attribution_only',true,'billing_authorization',false)) returning id into v_run_id;
  update public.skylight_sales_opportunities o set attributed_revenue_cents=greatest(0,coalesce(i.amount_paid_cents,0)),revenue_attributed_at=now(),updated_at=now()
  from public.skylight_invoices i where o.tenant_id=p_tenant_id and o.invoice_id=i.id and coalesce(o.attributed_revenue_cents,0)<>greatest(0,coalesce(i.amount_paid_cents,0));
  get diagnostics v_changed = row_count;
  update public.skylight_sales_revenue_links l set amount_cents=greatest(0,coalesce(i.amount_paid_cents,0)),status_snapshot=i.status,updated_at=now()
  from public.skylight_invoices i where l.tenant_id=p_tenant_id and l.link_type='invoice' and l.invoice_id=i.id and (coalesce(l.amount_cents,0)<>greatest(0,coalesce(i.amount_paid_cents,0)) or coalesce(l.status_snapshot,'')<>coalesce(i.status,''));
  insert into public.skylight_sales_revenue_links(tenant_id,opportunity_id,prospect_id,client_id,invoice_id,link_type,amount_cents,status_snapshot,source,notes)
  select o.tenant_id,o.id,o.prospect_id,i.client_id,i.id,'invoice',greatest(0,coalesce(i.amount_paid_cents,0)),i.status,'sync','3.7 factual paid-revenue linkage from explicitly linked invoice.'
  from public.skylight_sales_opportunities o join public.skylight_invoices i on i.id=o.invoice_id
  where o.tenant_id=p_tenant_id and not exists(select 1 from public.skylight_sales_revenue_links l where l.tenant_id=p_tenant_id and l.opportunity_id=o.id and l.link_type='invoice' and l.invoice_id=i.id);
  update public.skylight_sales_automation_runs set status='completed',updated_count=v_changed,completed_at=now(),metadata=metadata||jsonb_build_object('opportunities_updated',v_changed) where id=v_run_id;
  return jsonb_build_object('ok',true,'opportunities_updated',v_changed,'paid_revenue_attribution_only',true,'billing_authorization',false);
exception when others then
  if v_run_id is not null then update public.skylight_sales_automation_runs set status='failed',error_message=left(sqlerrm,2000),completed_at=now() where id=v_run_id; end if;
  raise;
end;
$$;

create or replace function private.snapshot_skylight_sales_metrics(p_tenant_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare v_run_id uuid; v_rows integer:=0;
begin
  if auth.uid() is not null and not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then raise exception 'Not authorized for this tenant'; end if;
  insert into public.skylight_sales_action_settings(tenant_id) values(p_tenant_id) on conflict(tenant_id) do nothing;
  if not (select daily_snapshot_enabled from public.skylight_sales_action_settings where tenant_id=p_tenant_id) then return jsonb_build_object('ok',true,'enabled',false); end if;
  insert into public.skylight_sales_automation_runs(tenant_id,run_type,source,status,metadata)
  values(p_tenant_id,'metrics_snapshot',case when auth.uid() is null then 'system' else 'staff' end,'running',jsonb_build_object('factual_metrics_only',true)) returning id into v_run_id;
  with base as (
    select o.*,
      (select count(*)::int from public.skylight_sales_replies r where r.tenant_id=p_tenant_id and r.opportunity_id=o.id) reply_count,
      (select count(*)::int from public.skylight_sales_replies r where r.tenant_id=p_tenant_id and r.opportunity_id=o.id and r.review_status='confirmed' and r.confirmed_classification='positive') positive_reply_count,
      (select count(*)::int from public.skylight_sales_meetings m where m.tenant_id=p_tenant_id and m.opportunity_id=o.id and m.status<>'cancelled') meeting_count,
      coalesce((select p.total_cents from public.skylight_proposals p where p.id=o.proposal_id),0) proposal_value,
      coalesce((select i.total_cents from public.skylight_invoices i where i.id=o.invoice_id),0) invoice_value
    from public.skylight_sales_opportunities o where o.tenant_id=p_tenant_id
  ), dims as (
    select 'overall'::text dimension_type,'all'::text dimension_key,b.* from base b
    union all select 'service',coalesce(nullif(b.primary_service_slug,''),'unassigned'),b.* from base b
    union all select 'campaign',b.attribution_campaign_id::text,b.* from base b where b.attribution_campaign_id is not null
  ), agg as (
    select dimension_type,dimension_key,count(*)::int opportunities,count(*) filter(where active)::int active_opportunities,
      count(*) filter(where stage='contact_ready')::int contact_ready,count(*) filter(where stage='contacted')::int contacted,count(*) filter(where stage='qualified')::int qualified,
      count(*) filter(where stage='proposal')::int proposal_stage,count(*) filter(where stage='won')::int won,count(*) filter(where stage='lost')::int lost,
      coalesce(sum(reply_count),0)::int replies,coalesce(sum(positive_reply_count),0)::int positive_replies,coalesce(sum(meeting_count),0)::int meetings,
      count(*) filter(where proposal_id is not null)::int proposals,coalesce(sum(proposal_value),0)::bigint proposal_value_cents,
      count(*) filter(where invoice_id is not null)::int invoices,coalesce(sum(invoice_value),0)::bigint invoiced_value_cents,coalesce(sum(attributed_revenue_cents),0)::bigint paid_revenue_cents,
      round(avg(extract(epoch from (won_at-coalesce(attribution_locked_at,created_at)))/86400.0) filter(where stage='won' and won_at is not null and coalesce(attribution_locked_at,created_at) is not null),2) avg_days_to_win,
      case when count(*) filter(where stage in ('won','lost'))>0 then round(10000.0*count(*) filter(where stage='won')/count(*) filter(where stage in ('won','lost')))::int else null end win_rate_bps
    from dims group by dimension_type,dimension_key
  )
  insert into public.skylight_sales_daily_metrics(tenant_id,metric_date,dimension_type,dimension_key,opportunities,active_opportunities,contact_ready,contacted,qualified,proposal_stage,won,lost,replies,positive_replies,meetings,proposals,proposal_value_cents,invoices,invoiced_value_cents,paid_revenue_cents,avg_days_to_win,win_rate_bps,updated_at)
  select p_tenant_id,current_date,dimension_type,dimension_key,opportunities,active_opportunities,contact_ready,contacted,qualified,proposal_stage,won,lost,replies,positive_replies,meetings,proposals,proposal_value_cents,invoices,invoiced_value_cents,paid_revenue_cents,avg_days_to_win,win_rate_bps,now() from agg
  on conflict(tenant_id,metric_date,dimension_type,dimension_key) do update set
    opportunities=excluded.opportunities,active_opportunities=excluded.active_opportunities,contact_ready=excluded.contact_ready,contacted=excluded.contacted,qualified=excluded.qualified,proposal_stage=excluded.proposal_stage,won=excluded.won,lost=excluded.lost,replies=excluded.replies,positive_replies=excluded.positive_replies,meetings=excluded.meetings,proposals=excluded.proposals,proposal_value_cents=excluded.proposal_value_cents,invoices=excluded.invoices,invoiced_value_cents=excluded.invoiced_value_cents,paid_revenue_cents=excluded.paid_revenue_cents,avg_days_to_win=excluded.avg_days_to_win,win_rate_bps=excluded.win_rate_bps,updated_at=now();
  get diagnostics v_rows = row_count;
  update public.skylight_sales_automation_runs set status='completed',generated_count=v_rows,completed_at=now(),metadata=metadata||jsonb_build_object('snapshot_rows',v_rows,'metric_date',current_date) where id=v_run_id;
  return jsonb_build_object('ok',true,'snapshot_rows',v_rows,'metric_date',current_date,'factual_metrics_only',true);
exception when others then
  if v_run_id is not null then update public.skylight_sales_automation_runs set status='failed',error_message=left(sqlerrm,2000),completed_at=now() where id=v_run_id; end if;
  raise;
end;
$$;

create or replace function private.refresh_skylight_sales_operating_system(p_tenant_id uuid)
returns jsonb language plpgsql security invoker set search_path = public, private, pg_temp as $$
declare v_revenue jsonb; v_actions jsonb; v_metrics jsonb;
begin
  v_revenue:=private.reconcile_skylight_sales_paid_revenue(p_tenant_id);
  v_actions:=private.refresh_skylight_sales_action_queue(p_tenant_id);
  v_metrics:=private.snapshot_skylight_sales_metrics(p_tenant_id);
  return jsonb_build_object('ok',true,'revenue',v_revenue,'actions',v_actions,'metrics',v_metrics,'automatic_outreach',false,'billing_authorization',false,'public_ranking_effect',false);
end;
$$;

create or replace function private.refresh_all_skylight_sales_operating_systems()
returns jsonb language plpgsql security invoker set search_path = public, private, pg_temp as $$
declare r record; v_count integer:=0;
begin
  for r in select distinct tenant_id from public.skylight_sales_opportunities loop
    perform private.refresh_skylight_sales_operating_system(r.tenant_id); v_count:=v_count+1;
  end loop;
  return jsonb_build_object('ok',true,'tenants_refreshed',v_count);
end;
$$;

create or replace function public.refresh_skylight_sales_operating_system_staff(p_tenant_id uuid)
returns jsonb language plpgsql security invoker set search_path = public, private, pg_temp as $$
begin
  if auth.uid() is null or not private.has_tenant_role(p_tenant_id,array['staff','admin','super_admin']) then raise exception 'Staff role required'; end if;
  return private.refresh_skylight_sales_operating_system(p_tenant_id);
end;
$$;

revoke all on function private.refresh_skylight_sales_action_queue(uuid) from public,anon;
revoke all on function private.reconcile_skylight_sales_paid_revenue(uuid) from public,anon;
revoke all on function private.snapshot_skylight_sales_metrics(uuid) from public,anon;
revoke all on function private.refresh_skylight_sales_operating_system(uuid) from public,anon;
revoke all on function private.refresh_all_skylight_sales_operating_systems() from public,anon,authenticated;
grant execute on function private.refresh_skylight_sales_action_queue(uuid) to authenticated;
grant execute on function private.reconcile_skylight_sales_paid_revenue(uuid) to authenticated;
grant execute on function private.snapshot_skylight_sales_metrics(uuid) to authenticated;
grant execute on function private.refresh_skylight_sales_operating_system(uuid) to authenticated;
revoke all on function public.refresh_skylight_sales_operating_system_staff(uuid) from public,anon;
grant execute on function public.refresh_skylight_sales_operating_system_staff(uuid) to authenticated;

do $$
declare j record;
begin
  for j in select jobid from cron.job where command='select private.refresh_all_skylight_sales_operating_systems();' loop perform cron.unschedule(j.jobid); end loop;
  perform cron.schedule('skylight-sales-operating-system-daily','10 13 * * *','select private.refresh_all_skylight_sales_operating_systems();');
end $$;
