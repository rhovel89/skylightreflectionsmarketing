-- Final childcare informational-only cleanup.
-- Rename the footer destination so it cannot be mistaken for a provider-matching workflow.
update public.navigation_items
set label='Childcare Resources', updated_at=now()
where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
  and href='/childcare';
