create or replace function public.preserve_visibility_report_schedule_creator()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

revoke all on function public.preserve_visibility_report_schedule_creator() from public, anon, authenticated;
grant execute on function public.preserve_visibility_report_schedule_creator() to service_role;

drop trigger if exists trg_visibility_report_schedule_preserve_creator on public.business_visibility_report_schedules;
create trigger trg_visibility_report_schedule_preserve_creator
before update on public.business_visibility_report_schedules
for each row execute function public.preserve_visibility_report_schedule_creator();