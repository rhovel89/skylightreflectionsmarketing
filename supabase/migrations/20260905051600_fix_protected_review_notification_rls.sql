alter function public.review_business_claim(uuid,text,text) security definer;
alter function public.review_business_submission(uuid,text,text) security definer;
alter function public.review_business_verification(uuid,text,text,text) security definer;

revoke all on function public.review_business_claim(uuid,text,text) from public, anon;
revoke all on function public.review_business_submission(uuid,text,text) from public, anon;
revoke all on function public.review_business_verification(uuid,text,text,text) from public, anon;

grant execute on function public.review_business_claim(uuid,text,text) to authenticated, service_role;
grant execute on function public.review_business_submission(uuid,text,text) to authenticated, service_role;
grant execute on function public.review_business_verification(uuid,text,text,text) to authenticated, service_role;
