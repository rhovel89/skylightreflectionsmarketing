do $$
declare
  v_tenant constant uuid := '6673621d-b359-4c17-a984-c8f50d914eb3'::uuid;
begin
  insert into public.seo_pages(tenant_id,market_location_id,category_id,city,category,title,description,h1,intro,content,focus_topic,index_mode,reviewed,updated_at)
  select l.tenant_id,l.id,c.id,l.name,c.name,
    case
      when l.name='Peoria' and c.name='Landscaping' then 'Landscaping Companies in Peoria, IL | Central Illinois Local Pros'
      when l.name='Peoria' and c.name='Lawn Care' then 'Lawn Care Services in Peoria, IL | Central Illinois Local Pros'
      when l.name='Peoria' and c.name='Pressure Washing' then 'Pressure Washing in Peoria, IL | Central Illinois Local Pros'
      when l.name='Pontiac' and c.name='Family Law' then 'Family Law Attorneys in Pontiac, IL | Central Illinois Local Pros'
      when l.name='Pontiac' and c.name='Estate Planning' then 'Estate Planning Attorneys in Pontiac, IL | Central Illinois Local Pros'
    end,
    case
      when l.name='Peoria' and c.name='Landscaping' then 'Compare published landscaping companies serving Peoria, Illinois, with local contact details and source-backed provider relationships.'
      when l.name='Peoria' and c.name='Lawn Care' then 'Compare lawn care providers serving Peoria, Illinois, including mowing, maintenance and related outdoor property services.'
      when l.name='Peoria' and c.name='Pressure Washing' then 'Find published pressure washing providers serving Peoria, Illinois, and compare available local contact and service information.'
      when l.name='Pontiac' and c.name='Family Law' then 'Compare published family law attorneys in Pontiac, Illinois, using current directory details and legitimate local office relationships.'
      when l.name='Pontiac' and c.name='Estate Planning' then 'Compare estate planning attorneys in Pontiac, Illinois, including firms handling wills, trusts, probate and related planning matters.'
    end,
    case
      when l.name='Peoria' and c.name='Landscaping' then 'Landscaping Companies in Peoria, IL'
      when l.name='Peoria' and c.name='Lawn Care' then 'Lawn Care Services in Peoria, IL'
      when l.name='Peoria' and c.name='Pressure Washing' then 'Pressure Washing Companies in Peoria, IL'
      when l.name='Pontiac' and c.name='Family Law' then 'Family Law Attorneys in Pontiac, IL'
      when l.name='Pontiac' and c.name='Estate Planning' then 'Estate Planning Attorneys in Pontiac, IL'
    end,
    case
      when l.name='Peoria' and c.name='Landscaping' then 'Looking for landscaping help in Peoria, Illinois? This directory page brings together published providers with a legitimate Peoria location or service relationship so you can compare real options without confusing advertising with organic relevance. Use individual profiles to review available phone, website, service and location details before requesting an estimate.'
      when l.name='Peoria' and c.name='Lawn Care' then 'Peoria homeowners and property managers can use this page to compare published lawn care providers tied to the Peoria market. Listings may cover routine mowing, seasonal maintenance, fertilization and related outdoor-property work. Directory inclusion is based on legitimate provider relationships, while Sponsored visibility is handled separately from organic discovery.'
      when l.name='Peoria' and c.name='Pressure Washing' then 'This Peoria pressure-washing directory is designed for comparing legitimate local providers rather than artificially inflating inventory. Published listings can include residential and commercial exterior cleaning, pressure washing and soft-washing services when those services are supported by current business information.'
      when l.name='Pontiac' and c.name='Family Law' then 'Family-law matters are highly personal, so this Pontiac directory page focuses on helping people identify published local attorneys with a legitimate Pontiac office relationship. Use the listing details as a starting point, then contact the firm directly to confirm whether it handles your specific type of family-law matter and whether it is accepting new clients.'
      when l.name='Pontiac' and c.name='Estate Planning' then 'This Pontiac estate-planning directory brings together published local law practices with supported Pontiac office relationships. Depending on the firm, services can include wills, trusts, powers of attorney, probate, succession planning and related estate matters. Confirm the exact scope, fees and availability directly with the attorney before making a hiring decision.'
    end,
    case
      when l.name='Peoria' and c.name='Landscaping' then 'Landscaping needs vary by property, season and project scope. When comparing Peoria providers, review whether a company focuses on recurring maintenance, landscape installation, grading, planting, hardscape support or a broader mix of outdoor services. Published directory information is intended for discovery, but estimates, schedules, warranties and current service boundaries should be confirmed directly with each business.\n\nCentral Illinois Local Pros keeps organic discovery separate from advertising. A Sponsored placement is paid visibility and does not move a provider higher in the underlying organic order. Claiming a listing or purchasing a plan also does not automatically verify a company. Verification, claim status and sponsorship are separate workflows.\n\nProvider counts are based on legitimate published business relationships with Peoria. A real service area can support market relevance, but it is not converted into a fake office or branch. New submissions are reviewed for genuine business identity, appropriate category fit and a defensible local relationship before they can contribute to market coverage.'
      when l.name='Peoria' and c.name='Lawn Care' then 'A useful lawn-care comparison starts with the work you actually need. Peoria providers may differ in mowing frequency, trimming, fertilization, seasonal cleanup, seeding, commercial maintenance and other services. Check each published profile for available contact information, then confirm current service packages, pricing, schedules and neighborhood coverage directly with the company because those details can change.\n\nOrganic directory visibility is not sold. Sponsored placements are clearly separated from organic relevance, and neither a paid plan nor a claimed listing automatically makes a business verified. Those statuses are maintained independently.\n\nThe directory counts only legitimate provider-to-market relationships. Businesses that serve Peoria without a storefront may be represented through a supported service area, but a service area is never presented as a physical Peoria office. This keeps category coverage useful without manufacturing locations simply to meet an SEO threshold.'
      when l.name='Peoria' and c.name='Pressure Washing' then 'Pressure-washing projects can range from siding, concrete and driveway cleaning to commercial exterior work and lower-pressure soft washing. When comparing Peoria providers, look at the services each company currently advertises, the surfaces it handles and the contact channels available through its profile. For quotes, scheduling, chemicals, techniques and current service limits, confirm details directly with the business.\n\nCentral Illinois Local Pros does not let sponsorship change organic rank. Sponsored visibility is advertising, while organic directory placement follows relevance and inventory rules. A claimed listing is also not the same thing as a verified business, and buying a plan does not create verification.\n\nOnly supported business relationships count toward Peoria coverage. If a provider operates from a real Peoria location, that can be stored as a location; if it only serves Peoria, the relationship must remain a service area. The directory does not create duplicate records or fake offices to force an indexable category page.'
      when l.name='Pontiac' and c.name='Family Law' then 'Family law can include divorce, parenting issues, support, adoption, guardianship and other domestic-relations matters, but not every attorney handles every type of case. Use this Pontiac page to identify local practices, then ask the firm directly about the exact matter, conflicts, consultation process, fees and current availability. Time-sensitive legal information should always be confirmed with the attorney rather than inferred from a directory listing.\n\nThe directory keeps commercial relationships separate from organic discovery. Sponsored placements are labeled advertising and do not improve a firm''s organic rank. Claiming a listing or purchasing a directory plan also does not equal verification; verification is a distinct review process.\n\nA law firm contributes to Pontiac inventory only when there is a legitimate published provider relationship with the market. A broad service area is not converted into an office, and duplicate or unsupported locations are not added merely to satisfy the three-provider indexing threshold.'
      when l.name='Pontiac' and c.name='Estate Planning' then 'Estate planning can involve wills, trusts, powers of attorney, probate planning, business or farm succession and other strategies depending on the client and the attorney''s practice. Compare the published Pontiac firms on this page, then contact the lawyer directly to confirm the services offered, whether the matter fits the practice, expected fees and the documents or information needed for a consultation.\n\nPaid visibility does not control organic directory order. Sponsored placements are advertising, and a claimed or paid listing does not automatically become verified. Those signals remain separate so users can distinguish commercial placement from directory relevance and verification status.\n\nPontiac provider coverage is built from real, source-supported business and location relationships. The directory will not count a service area as a physical branch, duplicate a firm, or manufacture an office simply to reach the minimum provider threshold. Current legal services and attorney availability can change, so users should verify time-sensitive details directly with the firm.'
    end,
    case
      when l.name='Peoria' and c.name='Landscaping' then 'landscaping companies in Peoria Illinois'
      when l.name='Peoria' and c.name='Lawn Care' then 'lawn care services in Peoria Illinois'
      when l.name='Peoria' and c.name='Pressure Washing' then 'pressure washing in Peoria Illinois'
      when l.name='Pontiac' and c.name='Family Law' then 'family law attorneys in Pontiac Illinois'
      when l.name='Pontiac' and c.name='Estate Planning' then 'estate planning attorneys in Pontiac Illinois'
    end,
    'auto',true,now()
  from public.locations l
  join public.categories c on c.tenant_id=l.tenant_id
  where l.tenant_id=v_tenant
    and l.is_active=true and c.is_active=true
    and ((l.name='Peoria' and c.name in ('Landscaping','Lawn Care','Pressure Washing'))
      or (l.name='Pontiac' and c.name in ('Family Law','Estate Planning')))
    and not exists(select 1 from public.seo_pages sp where sp.tenant_id=l.tenant_id and sp.market_location_id=l.id and sp.category_id=c.id);

  perform private.refresh_data_quality_tasks(v_tenant);
end $$;
