-- Protected staff moderation must be able to replace approved service-area rows
-- without opening direct INSERT/DELETE policies on business_service_areas.
alter function public.review_business_edit_request(uuid,text,text) security definer;

revoke all on function public.review_business_edit_request(uuid,text,text) from public, anon;
grant execute on function public.review_business_edit_request(uuid,text,text) to authenticated, service_role;
