create index if not exists skylight_service_intake_questions_tenant_idx on public.skylight_service_intake_questions(tenant_id);
create index if not exists skylight_service_intake_questions_created_by_idx on public.skylight_service_intake_questions(created_by) where created_by is not null;
create index if not exists skylight_service_intake_questions_updated_by_idx on public.skylight_service_intake_questions(updated_by) where updated_by is not null;

create index if not exists skylight_service_asset_requirements_tenant_idx on public.skylight_service_asset_requirements(tenant_id);
create index if not exists skylight_service_asset_requirements_created_by_idx on public.skylight_service_asset_requirements(created_by) where created_by is not null;
create index if not exists skylight_service_asset_requirements_updated_by_idx on public.skylight_service_asset_requirements(updated_by) where updated_by is not null;

create index if not exists skylight_project_intake_fields_tenant_idx on public.skylight_project_intake_fields(tenant_id);
create index if not exists skylight_project_intake_fields_service_idx on public.skylight_project_intake_fields(service_id) where service_id is not null;
create index if not exists skylight_project_intake_fields_template_idx on public.skylight_project_intake_fields(template_id) where template_id is not null;
create index if not exists skylight_project_intake_fields_answered_by_idx on public.skylight_project_intake_fields(answered_by) where answered_by is not null;

create index if not exists skylight_project_asset_requirements_tenant_idx on public.skylight_project_asset_requirements(tenant_id);
create index if not exists skylight_project_asset_requirements_service_idx on public.skylight_project_asset_requirements(service_id) where service_id is not null;
create index if not exists skylight_project_asset_requirements_template_idx on public.skylight_project_asset_requirements(template_id) where template_id is not null;

create index if not exists skylight_project_assets_tenant_idx on public.skylight_project_assets(tenant_id);
create index if not exists skylight_project_assets_client_idx on public.skylight_project_assets(client_id);
create index if not exists skylight_project_assets_service_idx on public.skylight_project_assets(service_id) where service_id is not null;
create index if not exists skylight_project_assets_uploaded_by_idx on public.skylight_project_assets(uploaded_by) where uploaded_by is not null;
create index if not exists skylight_project_assets_removed_by_idx on public.skylight_project_assets(removed_by) where removed_by is not null;

create index if not exists skylight_projects_intake_reviewed_by_idx on public.skylight_projects(intake_reviewed_by) where intake_reviewed_by is not null;
