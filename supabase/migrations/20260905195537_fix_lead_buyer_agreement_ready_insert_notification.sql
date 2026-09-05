drop trigger if exists lead_buyer_agreement_ready_notification on public.lead_buyer_agreement_drafts;
create or replace function private.notify_lead_buyer_agreement_ready()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_name text;
begin
  if new.status='ready_for_review' and (tg_op='INSERT' or old.status is distinct from new.status) then
    select name into v_name from public.businesses where id=new.business_id;
    insert into public.notifications(user_id,tenant_id,title,body,action_url,event_key)
    select ur.user_id,new.tenant_id,'Lead buyer agreement ready for review',
      coalesce(v_name,'A Lead Buyer')||' has a documented agreement draft ready for Super Admin review. No billing, paid lead delivery, verification, Sponsored placement, subscription, or ranking change has been activated.',
      '/admin/lead-buyers?business='||new.business_id,
      'lead_buyer_agreement_ready:'||new.id
    from public.user_roles ur
    where ur.tenant_id=new.tenant_id and ur.role='super_admin'
    on conflict (user_id,event_key) where event_key is not null do update set read_at=null,created_at=now(),body=excluded.body,action_url=excluded.action_url;
  end if;
  return new;
end;
$$;
revoke all on function private.notify_lead_buyer_agreement_ready() from public, anon, authenticated;
grant execute on function private.notify_lead_buyer_agreement_ready() to postgres;
create trigger lead_buyer_agreement_ready_notification
after insert or update of status on public.lead_buyer_agreement_drafts
for each row execute function private.notify_lead_buyer_agreement_ready();
