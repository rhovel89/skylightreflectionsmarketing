-- Super-admin reusable campaign templates plus discoverable Lawn Care navigation.
-- Operational rows were inserted in canonical Supabase on 2026-09-02; keep this idempotent for future environment bootstrap.
insert into public.navigation_items (tenant_id,menu_key,label,href,sort_order,is_visible,metadata)
select '6673621d-b359-4c17-a984-c8f50d914eb3','footer_find','Lawn Care','/lawn-care',45,true,'{}'::jsonb
where not exists (select 1 from public.navigation_items where tenant_id='6673621d-b359-4c17-a984-c8f50d914eb3' and menu_key='footer_find' and href='/lawn-care');
