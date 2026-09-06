-- These SECURITY DEFINER RPCs are authenticated owner/staff/admin operations.
-- They already enforce auth.uid()/ownership/tenant-role checks internally.
-- Remove public/anonymous EXECUTE surface while preserving signed-in and service-role callers.

revoke execute on function public.admin_review_business_referral(uuid,text,integer,text) from public, anon;
revoke execute on function public.admin_review_local_commerce(text,uuid,text,text) from public, anon;
revoke execute on function public.admin_review_marketplace_request(uuid,text,text) from public, anon;
revoke execute on function public.admin_revoke_business_plan_grant(uuid,text) from public, anon;
revoke execute on function public.admin_set_business_plan_grant(uuid,text,text,date,date,text) from public, anon;

revoke execute on function public.apply_business_referral_code(uuid,text) from public, anon;
revoke execute on function public.ensure_business_referral_code(uuid) from public, anon;
revoke execute on function public.get_business_marketplace_offers(uuid) from public, anon;
revoke execute on function public.get_business_plan_access(uuid) from public, anon;

revoke execute on function public.owner_answer_local_pro_question(uuid,text) from public, anon;
revoke execute on function public.owner_set_business_availability(uuid,text,text,timestamptz) from public, anon;
revoke execute on function public.owner_update_appointment_request(uuid,text,text) from public, anon;
revoke execute on function public.owner_upsert_business_deal(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) from public, anon;
revoke execute on function public.owner_upsert_catalog_item(uuid,uuid,text,text,text,text,text,text,integer) from public, anon;
revoke execute on function public.owner_upsert_portfolio_project(uuid,uuid,text,text,text,text,date,uuid,uuid) from public, anon;
revoke execute on function public.request_marketplace_offer(uuid,text) from public, anon;
revoke execute on function public.update_owner_lead_outcome(uuid,text,text,timestamptz,integer,integer,text) from public, anon;
revoke execute on function public.upsert_consumer_local_alert(uuid,uuid,text,boolean,boolean,boolean) from public, anon;

grant execute on function public.admin_review_business_referral(uuid,text,integer,text) to authenticated, service_role;
grant execute on function public.admin_review_local_commerce(text,uuid,text,text) to authenticated, service_role;
grant execute on function public.admin_review_marketplace_request(uuid,text,text) to authenticated, service_role;
grant execute on function public.admin_revoke_business_plan_grant(uuid,text) to authenticated, service_role;
grant execute on function public.admin_set_business_plan_grant(uuid,text,text,date,date,text) to authenticated, service_role;

grant execute on function public.apply_business_referral_code(uuid,text) to authenticated, service_role;
grant execute on function public.ensure_business_referral_code(uuid) to authenticated, service_role;
grant execute on function public.get_business_marketplace_offers(uuid) to authenticated, service_role;
grant execute on function public.get_business_plan_access(uuid) to authenticated, service_role;

grant execute on function public.owner_answer_local_pro_question(uuid,text) to authenticated, service_role;
grant execute on function public.owner_set_business_availability(uuid,text,text,timestamptz) to authenticated, service_role;
grant execute on function public.owner_update_appointment_request(uuid,text,text) to authenticated, service_role;
grant execute on function public.owner_upsert_business_deal(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) to authenticated, service_role;
grant execute on function public.owner_upsert_catalog_item(uuid,uuid,text,text,text,text,text,text,integer) to authenticated, service_role;
grant execute on function public.owner_upsert_portfolio_project(uuid,uuid,text,text,text,text,date,uuid,uuid) to authenticated, service_role;
grant execute on function public.request_marketplace_offer(uuid,text) to authenticated, service_role;
grant execute on function public.update_owner_lead_outcome(uuid,text,text,timestamptz,integer,integer,text) to authenticated, service_role;
grant execute on function public.upsert_consumer_local_alert(uuid,uuid,text,boolean,boolean,boolean) to authenticated, service_role;
