-- Trigger-only helper. It is invoked by PostgreSQL from the marketing_leads trigger and is not a public RPC surface.
revoke execute on function public.attribute_email_campaign_conversion_from_lead() from public, anon, authenticated;
grant execute on function public.attribute_email_campaign_conversion_from_lead() to service_role;
