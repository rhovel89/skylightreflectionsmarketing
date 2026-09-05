create unique index if not exists email_outbox_enrollment_step_unique on public.email_outbox(enrollment_id,step_id) where enrollment_id is not null and step_id is not null;
