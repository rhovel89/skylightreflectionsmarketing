create or replace function private.enroll_business_drips(p_business_id uuid)
returns integer language plpgsql set search_path='' as $$
declare v_business public.businesses%rowtype;v_email text;v_name text;v_count integer:=0;v_campaign record;v_first_order integer;v_delay integer;
begin
  select * into v_business from public.businesses where id=p_business_id;if not found then return 0;end if;
  select s.email,coalesce(nullif(s.contact_name,''),s.business_name) into v_email,v_name from public.business_submissions s where s.promoted_business_id=p_business_id and s.status='approved' and s.marketing_opt_in=true order by s.reviewed_at desc nulls last,s.created_at desc limit 1;
  if v_email is null then return 0;end if;
  for v_campaign in select c.id from public.email_drip_campaigns c where c.tenant_id=v_business.tenant_id and c.trigger_event='business_verified' and c.status='live' loop
    select step_order,delay_days into v_first_order,v_delay from public.email_drip_steps where campaign_id=v_campaign.id and is_active=true order by step_order limit 1;
    if v_first_order is null then continue;end if;
    insert into public.email_drip_enrollments(tenant_id,campaign_id,business_id,recipient_email,recipient_name,status,next_step_order,next_send_at)
    values(v_business.tenant_id,v_campaign.id,p_business_id,lower(v_email),v_name,'active',v_first_order,now()+make_interval(days=>v_delay))
    on conflict(campaign_id,business_id,recipient_email) do nothing;
    if found then v_count:=v_count+1;end if;
  end loop;
  return v_count;
end;$$;

create or replace function private.queue_due_drip_emails(p_tenant_id uuid)
returns integer language plpgsql set search_path='' as $$
declare v_actor uuid:=auth.uid();v_e record;v_step record;v_next record;v_count integer:=0;
begin
  if v_actor is null or not private.has_tenant_role(p_tenant_id,array['admin','super_admin']::text[]) then raise exception 'insufficient_privilege';end if;
  for v_e in select e.*,c.slug campaign_slug from public.email_drip_enrollments e join public.email_drip_campaigns c on c.id=e.campaign_id where e.tenant_id=p_tenant_id and e.status='active' and c.status='live' and e.next_send_at<=now() order by e.next_send_at asc limit 250 loop
    select * into v_step from public.email_drip_steps where campaign_id=v_e.campaign_id and step_order=v_e.next_step_order and is_active=true;
    if not found then select * into v_step from public.email_drip_steps where campaign_id=v_e.campaign_id and step_order>v_e.next_step_order and is_active=true order by step_order limit 1;end if;
    if not found then update public.email_drip_enrollments set status='completed',next_send_at=null where id=v_e.id;continue;end if;
    insert into public.email_outbox(tenant_id,business_id,recipient_email,recipient_name,message_type,template_key,campaign_id,enrollment_id,step_id,subject,body,cta_label,cta_url,status,scheduled_for)
    values(v_e.tenant_id,v_e.business_id,v_e.recipient_email,v_e.recipient_name,'drip','drip:'||v_e.campaign_slug,v_e.campaign_id,v_e.id,v_step.id,v_step.subject,v_step.body,v_step.cta_label,v_step.cta_url,'queued',now())
    on conflict do nothing;
    if found then v_count:=v_count+1;end if;
    select * into v_next from public.email_drip_steps where campaign_id=v_e.campaign_id and step_order>v_step.step_order and is_active=true order by step_order limit 1;
    if found then update public.email_drip_enrollments set next_step_order=v_next.step_order,next_send_at=v_e.enrolled_at+make_interval(days=>v_next.delay_days),last_sent_at=now() where id=v_e.id;
    else update public.email_drip_enrollments set status='completed',next_send_at=null,last_sent_at=now() where id=v_e.id;end if;
  end loop;
  return v_count;
end;$$;
