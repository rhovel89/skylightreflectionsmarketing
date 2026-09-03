do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname='lead-revenue-crm-daily';
exception when others then null; end $$;

select cron.schedule(
  'lead-revenue-crm-daily',
  '15 13 * * *',
  $$select public.run_lead_billing_automation();$$
);
