create table if not exists public.growth_outreach_templates(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  template_key text not null,
  stage text not null check(stage in('claim_activation','claim_follow_up','paid_plan_activation','pro_upgrade','sponsorship','lead_buyer_activation','skylight_marketing')),
  channel text not null check(channel in('email','sms','call')),
  name text not null,
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,template_key)
);

alter table public.growth_outreach_templates enable row level security;
drop policy if exists "staff manage growth outreach templates" on public.growth_outreach_templates;
create policy "staff manage growth outreach templates" on public.growth_outreach_templates
for all to authenticated
using(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']))
with check(private.has_tenant_role(tenant_id,array['staff','admin','super_admin']));
create index if not exists growth_outreach_templates_tenant_stage_idx on public.growth_outreach_templates(tenant_id,stage,is_active);

create or replace function private.seed_growth_outreach_templates(p_tenant_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare n integer:=0;begin
  insert into public.growth_outreach_templates(tenant_id,template_key,stage,channel,name,subject,body)
  values
  (p_tenant_id,'claim_email','claim_activation','email','Free listing claim invitation','Your free {{directory_name}} business listing','Hi {{contact_name}},\n\nWe have a published listing for {{business_name}} on {{directory_name}}. Claiming the listing is free and lets the business owner manage approved profile information through the owner portal.\n\nClaiming does not purchase verification or change organic directory ranking. If you are the owner or authorized representative, you can review the listing here: {{business_url}}\n\nClaim the listing: {{claim_url}}\n\nThank you,\n{{directory_name}}\nPowered by {{parent_brand_name}}'),
  (p_tenant_id,'claim_sms','claim_activation','sms','Free listing claim SMS',null,'Hi {{contact_name}} — {{business_name}} has a free listing on {{directory_name}}. If you are the owner/authorized representative, you can review and claim it here: {{claim_url}}. Claiming is free and does not buy rank or verification.'),
  (p_tenant_id,'claim_followup_email','claim_follow_up','email','Claim invitation follow-up','Following up on your {{directory_name}} listing','Hi {{contact_name}},\n\nI’m following up about the existing {{business_name}} listing on {{directory_name}}. If you are the owner or authorized representative, you can claim the listing at no charge and manage approved business information from the owner portal.\n\nReview the listing: {{business_url}}\nClaim: {{claim_url}}\n\nIf you are not the right contact, no action is required.'),
  (p_tenant_id,'paid_plan_email','paid_plan_activation','email','Optional paid plan introduction','Optional tools for your {{directory_name}} profile','Hi {{contact_name}},\n\nNow that {{business_name}} is claimed, there are optional paid profile tools available if they fit your goals. Paid plans add product features and visibility options described in the plan; they do not purchase verification or organic ranking.\n\nYou can review current plan options here: {{plans_url}}'),
  (p_tenant_id,'pro_upgrade_email','pro_upgrade','email','Pro conversion tools introduction','Pro tools for {{business_name}}','Hi {{contact_name}},\n\nYour current {{directory_name}} account is eligible to review Pro tools, including Lead Inbox and conversion-focused profile features. Pro is optional and does not purchase organic ranking.\n\nReview the Pro features and current pricing here: {{plans_url}}'),
  (p_tenant_id,'sponsorship_email','sponsorship','email','Sponsored visibility introduction','Clearly labeled sponsorship options in {{market_name}}','Hi {{contact_name}},\n\n{{directory_name}} has optional clearly labeled sponsorship inventory in selected markets and categories. Sponsorship is advertising displayed separately from organic directory relevance and verification.\n\nIf you want to review available inventory for {{business_name}}, reply and we can confirm the markets, placement, term and price before anything is activated.'),
  (p_tenant_id,'lead_buyer_email','lead_buyer_activation','email','Lead buyer agreement introduction','Lead opportunities for {{business_name}}','Hi {{contact_name}},\n\n{{business_name}} may be a fit for paid lead delivery through {{directory_name}}. Before activation, we confirm service types, geography, pricing, monthly limits, exclusive/shared rules and the billing terms in writing. Billing is based on an agreed lead being delivered—not on whether the lead becomes a booked or closed customer.\n\nIf you want to review the lead program, reply and we can go through the agreement details.'),
  (p_tenant_id,'skylight_marketing_email','skylight_marketing','email','Separate Skylight marketing introduction','A separate marketing opportunity for {{business_name}}','Hi {{contact_name}},\n\nSeparate from your directory listing, our team at {{parent_brand_name}} noticed a potential marketing opportunity for {{business_name}} based on publicly reviewed business information. If you would like, we can discuss ways to improve local visibility, lead generation or the website/marketing funnel.\n\nThis marketing offer is separate from {{directory_name}} organic ranking, verification and claim status.')
  on conflict(tenant_id,template_key) do nothing;
  get diagnostics n=row_count;return n;
end$$;
revoke all on function private.seed_growth_outreach_templates(uuid) from public,anon,authenticated;
grant execute on function private.seed_growth_outreach_templates(uuid) to service_role;

create or replace function private.seed_growth_outreach_templates_on_tenant()
returns trigger language plpgsql security definer set search_path='' as $$begin perform private.seed_growth_outreach_templates(new.id);return new;end$$;
revoke all on function private.seed_growth_outreach_templates_on_tenant() from public,anon,authenticated;

drop trigger if exists seed_growth_outreach_templates_after_tenant on public.tenants;
create trigger seed_growth_outreach_templates_after_tenant after insert on public.tenants for each row execute function private.seed_growth_outreach_templates_on_tenant();

select private.seed_growth_outreach_templates(id) from public.tenants;
