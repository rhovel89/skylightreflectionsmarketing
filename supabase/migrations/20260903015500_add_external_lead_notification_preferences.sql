alter table public.business_lead_programs
  add column if not exists email_delivery_notifications boolean not null default false,
  add column if not exists sms_delivery_notifications boolean not null default false,
  add column if not exists notification_email text,
  add column if not exists notification_phone text;

revoke execute on function public.configure_business_lead_program(uuid,boolean,text,integer,integer,integer,integer,text,text,text) from authenticated,anon;
