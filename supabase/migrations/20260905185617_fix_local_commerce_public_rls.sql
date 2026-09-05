-- Split anonymous public visibility from authenticated owner/staff visibility.
-- Anonymous policies must never call private staff-role helpers.

-- Recommendations
drop policy if exists "recommendations public approved" on public.business_recommendations;
drop policy if exists "recommendations anon approved" on public.business_recommendations;
drop policy if exists "recommendations authenticated visible" on public.business_recommendations;
create policy "recommendations anon approved" on public.business_recommendations for select to anon using (status='approved');
create policy "recommendations authenticated visible" on public.business_recommendations for select to authenticated using (
  status='approved' or user_id=auth.uid() or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);

-- Deals
drop policy if exists "deals visible" on public.business_deals;
drop policy if exists "deals anon public" on public.business_deals;
drop policy if exists "deals authenticated visible" on public.business_deals;
create policy "deals anon public" on public.business_deals for select to anon using (
  status='approved' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())
);
create policy "deals authenticated visible" on public.business_deals for select to authenticated using (
  (status='approved' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()))
  or exists(select 1 from public.business_owners bo where bo.business_id=business_deals.business_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);

-- Availability
drop policy if exists "availability visible" on public.business_availability;
drop policy if exists "availability anon current" on public.business_availability;
drop policy if exists "availability authenticated visible" on public.business_availability;
create policy "availability anon current" on public.business_availability for select to anon using (expires_at is null or expires_at>=now());
create policy "availability authenticated visible" on public.business_availability for select to authenticated using (
  (expires_at is null or expires_at>=now())
  or exists(select 1 from public.business_owners bo where bo.business_id=business_availability.business_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);

-- Catalog
drop policy if exists "catalog visible" on public.business_catalog_items;
drop policy if exists "catalog anon approved" on public.business_catalog_items;
drop policy if exists "catalog authenticated visible" on public.business_catalog_items;
create policy "catalog anon approved" on public.business_catalog_items for select to anon using (status='approved');
create policy "catalog authenticated visible" on public.business_catalog_items for select to authenticated using (
  status='approved'
  or exists(select 1 from public.business_owners bo where bo.business_id=business_catalog_items.business_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);

-- Portfolio
drop policy if exists "portfolio visible" on public.business_portfolio_projects;
drop policy if exists "portfolio anon approved" on public.business_portfolio_projects;
drop policy if exists "portfolio authenticated visible" on public.business_portfolio_projects;
create policy "portfolio anon approved" on public.business_portfolio_projects for select to anon using (status='approved');
create policy "portfolio authenticated visible" on public.business_portfolio_projects for select to authenticated using (
  status='approved'
  or exists(select 1 from public.business_owners bo where bo.business_id=business_portfolio_projects.business_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);

-- Q&A
drop policy if exists "questions visible" on public.local_pro_questions;
drop policy if exists "questions anon published" on public.local_pro_questions;
drop policy if exists "questions authenticated visible" on public.local_pro_questions;
create policy "questions anon published" on public.local_pro_questions for select to anon using (status='published');
create policy "questions authenticated visible" on public.local_pro_questions for select to authenticated using (
  status='published' or user_id=auth.uid()
  or exists(select 1 from public.business_owners bo where bo.business_id=local_pro_questions.business_id and bo.user_id=auth.uid())
  or private.has_tenant_role(tenant_id,array['staff','admin','super_admin'])
);
