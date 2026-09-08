insert into public.navigation_items(tenant_id,menu_key,label,href,sort_order,is_visible,metadata)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'header','Estate Planning','/estate-planning',35,true,jsonb_build_object('purpose','nationwide_estate_planning_lead_funnel')
where not exists(select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and menu_key='header' and href='/estate-planning');

insert into public.navigation_items(tenant_id,menu_key,label,href,sort_order,is_visible,metadata)
select '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid,'footer_find','Estate Planning & Trust','/estate-planning',25,true,jsonb_build_object('purpose','nationwide_estate_planning_lead_funnel')
where not exists(select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3'::uuid and menu_key='footer_find' and href='/estate-planning');
