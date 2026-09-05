-- Make the Skylight services hub discoverable from the editable public footer.
insert into public.navigation_items(tenant_id,menu_key,label,href,sort_order,is_visible,metadata)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'footer_business','Marketing Services','/skylight-services',40,true,jsonb_build_object('source','skylight_services_suite')
where not exists(
  select 1 from public.navigation_items
  where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
    and menu_key='footer_business'
    and href='/skylight-services'
);

update public.navigation_items
set label='Marketing Services',sort_order=40,is_visible=true,updated_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('source','skylight_services_suite')
where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid
  and menu_key='footer_business'
  and href='/skylight-services';
