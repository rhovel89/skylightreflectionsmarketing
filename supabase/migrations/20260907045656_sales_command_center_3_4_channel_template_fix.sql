update public.skylight_sales_outreach_templates
set channel='phone',sequence_stage='call',updated_at=now()
where name='General Call Notes' and channel='email';

insert into public.skylight_sales_outreach_templates(tenant_id,name,service_slug,vertical,channel,sequence_stage,day_offset,subject_template,body_template,active,sort_order)
select t.id,'General LinkedIn First Touch',null,null,'linkedin','first_touch',0,null,
'Hi {{contact_name_or_team}} — I’m Ray with Skylight Reflections Marketing. I reached out because our research on {{business_name}} documented this public marketing signal: {{evidence_summary}}. Based on that, {{service_name}} may be worth a closer look. If it is a current priority, I’d be glad to share a few practical ideas. Nothing about this outreach changes your Central Illinois Local Pros organic ranking, verification, or placement.',true,60
from public.tenants t
where not exists(select 1 from public.skylight_sales_outreach_templates e where e.tenant_id=t.id and e.name='General LinkedIn First Touch');
