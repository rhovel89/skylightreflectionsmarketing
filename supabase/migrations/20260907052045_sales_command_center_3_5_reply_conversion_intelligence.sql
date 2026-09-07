-- Sales Command Center 3.5
-- Reply intelligence, meeting conversion, proposal handoff, win/loss intelligence.
-- Human review remains authoritative; no automatic outreach, billing, proposal send, listing verification, sponsored activation, or lead routing.

alter table public.skylight_sales_opportunities
  add column if not exists first_reply_at timestamptz,
  add column if not exists last_reply_at timestamptz,
  add column if not exists proposal_id uuid references public.skylight_proposals(id) on delete set null,
  add column if not exists outcome_reason_code text;

create index if not exists skylight_sales_opportunities_proposal_fk_idx
  on public.skylight_sales_opportunities(proposal_id)
  where proposal_id is not null;
create index if not exists skylight_sales_opportunities_reply_idx
  on public.skylight_sales_opportunities(tenant_id,last_reply_at desc)
  where last_reply_at is not null;

create table if not exists public.skylight_sales_replies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opportunity_id uuid not null references public.skylight_sales_opportunities(id) on delete cascade,
  prospect_id uuid not null references public.business_prospects(id) on delete cascade,
  draft_id uuid references public.skylight_sales_outreach_drafts(id) on delete set null,
  campaign_id uuid references public.skylight_sales_campaigns(id) on delete set null,
  campaign_member_id uuid references public.skylight_sales_campaign_members(id) on delete set null,
  channel text not null default 'email' check (channel in ('email','phone','sms','linkedin','social')),
  provider text,
  provider_message_id text,
  in_reply_to_message_id text,
  sender_name text,
  sender_email text,
  subject text,
  body text not null,
  received_at timestamptz not null default now(),
  classification_suggestion text not null default 'ambiguous' check (classification_suggestion in ('positive','question','neutral','negative','do_not_contact','wrong_person','out_of_office','bounce','ambiguous')),
  classification_confidence integer not null default 0 check (classification_confidence between 0 and 100),
  suggestion_reason text,
  review_status text not null default 'pending' check (review_status in ('pending','confirmed','dismissed')),
  confirmed_classification text check (confirmed_classification is null or confirmed_classification in ('positive','question','neutral','negative','do_not_contact','wrong_person','out_of_office','bounce','ambiguous')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  staff_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_skylight_sales_replies_provider_message
  on public.skylight_sales_replies(tenant_id,provider,provider_message_id)
  where provider_message_id is not null;
create index if not exists idx_skylight_sales_replies_review_queue
  on public.skylight_sales_replies(tenant_id,review_status,received_at desc);
create index if not exists idx_skylight_sales_replies_opportunity
  on public.skylight_sales_replies(opportunity_id,received_at desc);
create index if not exists idx_skylight_sales_replies_prospect
  on public.skylight_sales_replies(prospect_id,received_at desc);
create index if not exists idx_skylight_sales_replies_draft
  on public.skylight_sales_replies(draft_id) where draft_id is not null;
create index if not exists idx_skylight_sales_replies_campaign
  on public.skylight_sales_replies(campaign_id) where campaign_id is not null;
create index if not exists idx_skylight_sales_replies_campaign_member
  on public.skylight_sales_replies(campaign_member_id) where campaign_member_id is not null;

create table if not exists public.skylight_sales_meetings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opportunity_id uuid not null references public.skylight_sales_opportunities(id) on delete cascade,
  prospect_id uuid not null references public.business_prospects(id) on delete cascade,
  campaign_id uuid references public.skylight_sales_campaigns(id) on delete set null,
  campaign_member_id uuid references public.skylight_sales_campaign_members(id) on delete set null,
  reply_id uuid references public.skylight_sales_replies(id) on delete set null,
  meeting_type text not null default 'discovery' check (meeting_type in ('discovery','strategy','demo','follow_up','other')),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  scheduled_at timestamptz not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 480),
  location_type text not null default 'phone' check (location_type in ('phone','video','in_person','other')),
  location_detail text,
  external_calendar_id text,
  outcome text check (outcome is null or outcome in ('qualified','proposal_requested','not_ready','not_fit','follow_up','other')),
  notes text,
  booked_by uuid,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_skylight_sales_meetings_schedule
  on public.skylight_sales_meetings(tenant_id,status,scheduled_at);
create index if not exists idx_skylight_sales_meetings_opportunity
  on public.skylight_sales_meetings(opportunity_id,scheduled_at desc);
create index if not exists idx_skylight_sales_meetings_prospect
  on public.skylight_sales_meetings(prospect_id,scheduled_at desc);
create index if not exists idx_skylight_sales_meetings_campaign
  on public.skylight_sales_meetings(campaign_id) where campaign_id is not null;
create index if not exists idx_skylight_sales_meetings_campaign_member
  on public.skylight_sales_meetings(campaign_member_id) where campaign_member_id is not null;
create index if not exists idx_skylight_sales_meetings_reply
  on public.skylight_sales_meetings(reply_id) where reply_id is not null;

create table if not exists public.skylight_sales_proposal_handoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opportunity_id uuid not null references public.skylight_sales_opportunities(id) on delete cascade,
  prospect_id uuid not null references public.business_prospects(id) on delete cascade,
  campaign_id uuid references public.skylight_sales_campaigns(id) on delete set null,
  campaign_member_id uuid references public.skylight_sales_campaign_members(id) on delete set null,
  reply_id uuid references public.skylight_sales_replies(id) on delete set null,
  meeting_id uuid references public.skylight_sales_meetings(id) on delete set null,
  client_id uuid references public.skylight_clients(id) on delete set null,
  proposal_id uuid references public.skylight_proposals(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','ready','linked','cancelled')),
  title text not null,
  recommended_service_slugs text[] not null default '{}'::text[],
  scope_notes text,
  pricing_notes text,
  estimated_value_cents integer check (estimated_value_cents is null or estimated_value_cents >= 0),
  created_by uuid,
  updated_by uuid,
  linked_by uuid,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_skylight_sales_proposal_handoffs_open
  on public.skylight_sales_proposal_handoffs(opportunity_id)
  where status in ('draft','ready');
create index if not exists idx_skylight_sales_proposal_handoffs_queue
  on public.skylight_sales_proposal_handoffs(tenant_id,status,created_at desc);
create index if not exists idx_skylight_sales_proposal_handoffs_prospect
  on public.skylight_sales_proposal_handoffs(prospect_id,created_at desc);
create index if not exists idx_skylight_sales_proposal_handoffs_campaign
  on public.skylight_sales_proposal_handoffs(campaign_id) where campaign_id is not null;
create index if not exists idx_skylight_sales_proposal_handoffs_campaign_member
  on public.skylight_sales_proposal_handoffs(campaign_member_id) where campaign_member_id is not null;
create index if not exists idx_skylight_sales_proposal_handoffs_reply
  on public.skylight_sales_proposal_handoffs(reply_id) where reply_id is not null;
create index if not exists idx_skylight_sales_proposal_handoffs_meeting
  on public.skylight_sales_proposal_handoffs(meeting_id) where meeting_id is not null;
create index if not exists idx_skylight_sales_proposal_handoffs_client
  on public.skylight_sales_proposal_handoffs(client_id) where client_id is not null;
create index if not exists idx_skylight_sales_proposal_handoffs_proposal
  on public.skylight_sales_proposal_handoffs(proposal_id) where proposal_id is not null;

create table if not exists public.skylight_sales_conversion_events (
  id bigint generated by default as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opportunity_id uuid not null references public.skylight_sales_opportunities(id) on delete cascade,
  prospect_id uuid not null references public.business_prospects(id) on delete cascade,
  campaign_id uuid references public.skylight_sales_campaigns(id) on delete set null,
  campaign_member_id uuid references public.skylight_sales_campaign_members(id) on delete set null,
  reply_id uuid references public.skylight_sales_replies(id) on delete set null,
  meeting_id uuid references public.skylight_sales_meetings(id) on delete set null,
  handoff_id uuid references public.skylight_sales_proposal_handoffs(id) on delete set null,
  proposal_id uuid references public.skylight_proposals(id) on delete set null,
  actor_user_id uuid,
  event_type text not null check (event_type in ('reply_recorded','reply_confirmed','meeting_booked','meeting_completed','proposal_handoff_created','proposal_handoff_ready','proposal_linked','value_updated','won','lost')),
  value_cents integer check (value_cents is null or value_cents >= 0),
  reason_code text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_skylight_sales_conversion_events_opportunity
  on public.skylight_sales_conversion_events(opportunity_id,created_at desc);
create index if not exists idx_skylight_sales_conversion_events_prospect
  on public.skylight_sales_conversion_events(prospect_id,created_at desc);
create index if not exists idx_skylight_sales_conversion_events_campaign
  on public.skylight_sales_conversion_events(campaign_id,created_at desc) where campaign_id is not null;
create index if not exists idx_skylight_sales_conversion_events_campaign_member
  on public.skylight_sales_conversion_events(campaign_member_id) where campaign_member_id is not null;
create index if not exists idx_skylight_sales_conversion_events_reply
  on public.skylight_sales_conversion_events(reply_id) where reply_id is not null;
create index if not exists idx_skylight_sales_conversion_events_meeting
  on public.skylight_sales_conversion_events(meeting_id) where meeting_id is not null;
create index if not exists idx_skylight_sales_conversion_events_handoff
  on public.skylight_sales_conversion_events(handoff_id) where handoff_id is not null;
create index if not exists idx_skylight_sales_conversion_events_proposal
  on public.skylight_sales_conversion_events(proposal_id) where proposal_id is not null;

-- Cover foreign keys introduced in 3.4 and reported by the advisor.
create index if not exists skylight_sales_followups_campaign_fk_idx on public.skylight_sales_followups(campaign_id) where campaign_id is not null;
create index if not exists skylight_sales_followups_campaign_member_fk_idx on public.skylight_sales_followups(campaign_member_id) where campaign_member_id is not null;
create index if not exists skylight_sales_followups_prior_draft_fk_idx on public.skylight_sales_followups(prior_draft_id) where prior_draft_id is not null;
create index if not exists skylight_sales_followups_prospect_fk_idx on public.skylight_sales_followups(prospect_id);
create index if not exists skylight_sales_followups_template_fk_idx on public.skylight_sales_followups(template_id) where template_id is not null;
create index if not exists skylight_sales_outreach_drafts_campaign_member_fk_idx on public.skylight_sales_outreach_drafts(campaign_member_id) where campaign_member_id is not null;
create index if not exists skylight_sales_outreach_drafts_template_fk_idx on public.skylight_sales_outreach_drafts(template_id) where template_id is not null;
create index if not exists skylight_sales_outreach_events_campaign_fk_idx on public.skylight_sales_outreach_events(campaign_id) where campaign_id is not null;
create index if not exists skylight_sales_outreach_events_campaign_member_fk_idx on public.skylight_sales_outreach_events(campaign_member_id) where campaign_member_id is not null;
create index if not exists skylight_sales_outreach_events_draft_fk_idx on public.skylight_sales_outreach_events(draft_id) where draft_id is not null;
create index if not exists skylight_sales_outreach_events_prospect_fk_idx on public.skylight_sales_outreach_events(prospect_id);
create index if not exists skylight_sales_suppressions_opportunity_fk_idx on public.skylight_sales_suppressions(opportunity_id) where opportunity_id is not null;
create index if not exists skylight_sales_suppressions_prospect_fk_idx on public.skylight_sales_suppressions(prospect_id);

-- The unsubscribe ingress is trigger-processed and normally empty, but it should still have a key.
alter table public.skylight_sales_unsubscribe_requests
  add constraint skylight_sales_unsubscribe_requests_pkey primary key (token);

alter table public.skylight_sales_replies enable row level security;
alter table public.skylight_sales_meetings enable row level security;
alter table public.skylight_sales_proposal_handoffs enable row level security;
alter table public.skylight_sales_conversion_events enable row level security;

create policy "staff manage skylight sales replies" on public.skylight_sales_replies
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff manage skylight sales meetings" on public.skylight_sales_meetings
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff manage skylight proposal handoffs" on public.skylight_sales_proposal_handoffs
for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff read skylight conversion events" on public.skylight_sales_conversion_events
for select to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

create policy "staff append skylight conversion events" on public.skylight_sales_conversion_events
for insert to authenticated
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));

revoke all on table public.skylight_sales_replies from anon;
revoke all on table public.skylight_sales_meetings from anon;
revoke all on table public.skylight_sales_proposal_handoffs from anon;
revoke all on table public.skylight_sales_conversion_events from anon;

grant select,insert,update,delete on table public.skylight_sales_replies to authenticated;
grant select,insert,update,delete on table public.skylight_sales_meetings to authenticated;
grant select,insert,update,delete on table public.skylight_sales_proposal_handoffs to authenticated;
grant select,insert on table public.skylight_sales_conversion_events to authenticated;
grant usage,select on sequence public.skylight_sales_conversion_events_id_seq to authenticated;

grant all on table public.skylight_sales_replies to service_role;
grant all on table public.skylight_sales_meetings to service_role;
grant all on table public.skylight_sales_proposal_handoffs to service_role;
grant all on table public.skylight_sales_conversion_events to service_role;
grant usage,select on sequence public.skylight_sales_conversion_events_id_seq to service_role;
