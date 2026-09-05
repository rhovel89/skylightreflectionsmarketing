revoke all on function private.sync_explicit_lead_buyer_opportunities(uuid) from public, anon, authenticated;
revoke all on function private.lead_buyer_interest_growth_trigger() from public, anon, authenticated;
revoke all on function private.lead_buyer_crm_growth_trigger() from public, anon, authenticated;
revoke all on function private.lead_program_growth_trigger() from public, anon, authenticated;

grant execute on function private.sync_explicit_lead_buyer_opportunities(uuid) to service_role;

comment on function private.sync_explicit_lead_buyer_opportunities(uuid) is
'Private trigger/staff-refresh helper. Direct client execution is revoked; explicit owner lead interest is synchronized into the Admin growth queue without activating billing or lead routing.';
