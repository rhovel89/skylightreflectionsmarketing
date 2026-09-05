alter table public.email_drip_enrollments add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists email_drip_enrollments_unsubscribe_token_idx on public.email_drip_enrollments(unsubscribe_token);
create or replace function public.unsubscribe_business_email(p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_changed integer;
begin
  update public.email_drip_enrollments set status='unsubscribed',next_send_at=null where unsubscribe_token=p_token and status<>'unsubscribed';
  get diagnostics v_changed=row_count;
  return v_changed>0;
end;$$;
revoke all on function public.unsubscribe_business_email(uuid) from public;
grant execute on function public.unsubscribe_business_email(uuid) to anon,authenticated;
