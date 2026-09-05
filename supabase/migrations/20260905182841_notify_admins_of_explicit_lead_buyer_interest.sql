create or replace function private.lead_buyer_interest_growth_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_name text;
  v_event_key text;
begin
  if new.lead_program_interest is distinct from old.lead_program_interest
     or new.interest_updated_at is distinct from old.interest_updated_at then
    perform private.sync_explicit_lead_buyer_opportunities(new.tenant_id);

    v_event_key := 'lead_buyer_interest:' || new.id::text;

    if new.lead_program_interest = 'interested' then
      select b.name into v_business_name
      from public.businesses b
      where b.id = new.business_id and b.tenant_id = new.tenant_id;

      insert into public.notifications(user_id, tenant_id, title, body, action_url, event_key, read_at, created_at)
      select distinct ur.user_id,
        new.tenant_id,
        'Lead buyer wants more leads',
        coalesce(v_business_name, 'A claimed business') || ' explicitly asked for more leads after a delivered lead. Review the Lead Buyer CRM before activating any agreement. No billing or future routing was activated by this response.',
        '/admin/lead-buyers',
        v_event_key,
        null,
        now()
      from public.user_roles ur
      where ur.tenant_id = new.tenant_id
        and ur.role in ('admin','super_admin')
      on conflict (user_id, event_key) where event_key is not null
      do update set
        title = excluded.title,
        body = excluded.body,
        action_url = excluded.action_url,
        tenant_id = excluded.tenant_id,
        read_at = null,
        created_at = now();
    else
      update public.notifications n
      set read_at = coalesce(n.read_at, now())
      where n.tenant_id = new.tenant_id
        and n.event_key = v_event_key
        and n.user_id in (
          select ur.user_id from public.user_roles ur
          where ur.tenant_id = new.tenant_id
            and ur.role in ('admin','super_admin')
        );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.lead_buyer_interest_growth_trigger() from public, anon, authenticated;

comment on function private.lead_buyer_interest_growth_trigger() is
'Private trigger: synchronizes explicit owner lead interest into the Growth/Action Center engine and creates a deduplicated unread Admin/Super Admin notification. Non-interested decisions automatically clear the stale unread alert. It never activates billing or future lead routing.';
