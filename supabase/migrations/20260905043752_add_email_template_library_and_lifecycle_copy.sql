create table if not exists public.email_template_library(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  name text not null,
  delivery_class text not null check (delivery_class in ('transactional','promotional')),
  system_template_key text,
  audience text not null default 'verified_opted_in',
  trigger_event text not null default 'business_verified',
  campaign_goal text not null default 'education',
  conversion_goal text not null default 'any_inquiry',
  audience_rules jsonb not null default '{}'::jsonb,
  purpose text,
  compliance_note text,
  send_hour smallint not null default 10 check (send_hour between 0 and 23),
  utm_source text not null default 'central_il_local_pros',
  utm_medium text not null default 'email',
  utm_campaign text,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps)='array'),
  can_create_campaign boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,slug)
);

create unique index if not exists email_template_library_system_key_uq on public.email_template_library(tenant_id,system_template_key) where system_template_key is not null;
create index if not exists email_template_library_class_idx on public.email_template_library(tenant_id,delivery_class,is_active,sort_order);

alter table public.email_template_library enable row level security;
drop policy if exists "tenant staff manage email template library" on public.email_template_library;
create policy "tenant staff manage email template library" on public.email_template_library for all to authenticated
using (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']::text[]))
with check (private.has_tenant_role(tenant_id,array['staff','admin','super_admin']::text[]));

create or replace function public.apply_transactional_email_template()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_template public.email_template_library%rowtype;
  v_step jsonb;
  v_business_name text;
  v_business_slug text;
  v_business_id text:=coalesce(new.business_id::text,'');
  v_recipient_name text:=coalesce(new.recipient_name,'');
  v_subject text;
  v_preheader text;
  v_body text;
  v_cta_label text;
  v_cta_url text;
  v_replace text;
begin
  if new.message_type<>'transactional' or nullif(trim(coalesce(new.template_key,'')),'') is null then return new; end if;
  select * into v_template from public.email_template_library t
  where t.tenant_id=new.tenant_id and t.delivery_class='transactional' and t.is_active=true and t.system_template_key=new.template_key
  order by t.updated_at desc limit 1;
  if not found then return new; end if;
  v_step:=v_template.steps->0;
  if v_step is null or jsonb_typeof(v_step)<>'object' then return new; end if;
  if new.business_id is not null then select b.name,b.slug into v_business_name,v_business_slug from public.businesses b where b.id=new.business_id; end if;
  v_business_name:=coalesce(nullif(v_business_name,''),nullif(v_recipient_name,''),'your business');
  v_business_slug:=coalesce(v_business_slug,'');
  v_subject:=coalesce(nullif(v_step->>'subject',''),new.subject);
  v_preheader:=coalesce(nullif(v_step->>'preheader',''),new.preheader);
  v_body:=coalesce(nullif(v_step->>'body',''),new.body);
  v_cta_label:=coalesce(nullif(v_step->>'cta_label',''),new.cta_label);
  v_cta_url:=coalesce(nullif(v_step->>'cta_url',''),new.cta_url);
  foreach v_replace in array array['subject','preheader','body','cta_label','cta_url'] loop
    if v_replace='subject' and v_subject is not null then v_subject:=replace(replace(replace(replace(v_subject,'{{business_name}}',v_business_name),'{{business_id}}',v_business_id),'{{business_slug}}',v_business_slug),'{{recipient_name}}',v_recipient_name);
    elsif v_replace='preheader' and v_preheader is not null then v_preheader:=replace(replace(replace(replace(v_preheader,'{{business_name}}',v_business_name),'{{business_id}}',v_business_id),'{{business_slug}}',v_business_slug),'{{recipient_name}}',v_recipient_name);
    elsif v_replace='body' and v_body is not null then v_body:=replace(replace(replace(replace(v_body,'{{business_name}}',v_business_name),'{{business_id}}',v_business_id),'{{business_slug}}',v_business_slug),'{{recipient_name}}',v_recipient_name);
    elsif v_replace='cta_label' and v_cta_label is not null then v_cta_label:=replace(replace(replace(replace(v_cta_label,'{{business_name}}',v_business_name),'{{business_id}}',v_business_id),'{{business_slug}}',v_business_slug),'{{recipient_name}}',v_recipient_name);
    elsif v_replace='cta_url' and v_cta_url is not null then v_cta_url:=replace(replace(replace(replace(v_cta_url,'{{business_name}}',v_business_name),'{{business_id}}',v_business_id),'{{business_slug}}',v_business_slug),'{{recipient_name}}',v_recipient_name);
    end if;
  end loop;
  new.subject:=v_subject; new.preheader:=v_preheader; new.body:=v_body; new.cta_label:=v_cta_label; new.cta_url:=v_cta_url;
  return new;
end;
$$;

drop trigger if exists trg_apply_transactional_email_template on public.email_outbox;
create trigger trg_apply_transactional_email_template before insert on public.email_outbox for each row execute function public.apply_transactional_email_template();

insert into public.email_template_library(tenant_id,slug,name,delivery_class,system_template_key,audience,trigger_event,campaign_goal,conversion_goal,purpose,compliance_note,send_hour,utm_campaign,steps,can_create_campaign,is_active,sort_order)
select t.id,'claim-your-listing','Claim Your Listing','transactional','business_submission_approved','new_business_submitters','business_profile_approved','retention','any_inquiry','Lifecycle email sent after staff approves a submitted business profile and before ownership verification.','Transactional lifecycle message. Claiming does not equal verification or publication.',10,null,
jsonb_build_array(jsonb_build_object('step_order',1,'delay_days',0,'subject','Your business profile is ready to claim','preheader','Complete ownership verification to move {{business_name}} toward publication.','body','We reviewed and approved the directory profile information for {{business_name}}.\n\nYour profile is not public yet. Sign in to the Central Illinois Local Pros account that submitted this business and complete the ownership-evidence step.\n\nAfter ownership is approved, our staff completes final source-backed directory verification before the profile can be published.\n\nClaiming a business does not automatically verify or publish it.','cta_label','Claim Your Business','cta_url','/claim?business={{business_id}}','is_active',true)),false,true,10
from public.tenants t where t.slug='central-illinois-local-pros'
on conflict(tenant_id,slug) do update set name=excluded.name,delivery_class=excluded.delivery_class,system_template_key=excluded.system_template_key,audience=excluded.audience,trigger_event=excluded.trigger_event,campaign_goal=excluded.campaign_goal,conversion_goal=excluded.conversion_goal,purpose=excluded.purpose,compliance_note=excluded.compliance_note,steps=excluded.steps,can_create_campaign=excluded.can_create_campaign,is_active=excluded.is_active,sort_order=excluded.sort_order,updated_at=now();

insert into public.email_template_library(tenant_id,slug,name,delivery_class,system_template_key,audience,trigger_event,campaign_goal,conversion_goal,purpose,compliance_note,send_hour,utm_campaign,steps,can_create_campaign,is_active,sort_order)
select t.id,'finish-verification','Finish Verification','transactional','business_claim_approved','claimed_business_owners','ownership_approved','retention','any_inquiry','Lifecycle email sent after ownership approval to explain the remaining final verification gate.','Transactional lifecycle message. Ownership approval marks the listing Claimed but does not automatically verify or publish a pending profile.',10,null,
jsonb_build_array(jsonb_build_object('step_order',1,'delay_days',0,'subject','Ownership approved — finish verification for {{business_name}}','preheader','Your claim is approved. Final directory verification is the remaining publication gate.','body','Your ownership claim for {{business_name}} has been approved.\n\nThe listing is now marked Claimed, but Claiming and Verification are separate trust steps. If this is a new pending profile, final source-backed directory verification is still required before publication.\n\nOpen your Business Portal to review the profile and make sure the information we should verify is accurate.','cta_label','Open Business Portal','cta_url','/business-portal','is_active',true)),false,true,20
from public.tenants t where t.slug='central-illinois-local-pros'
on conflict(tenant_id,slug) do update set name=excluded.name,delivery_class=excluded.delivery_class,system_template_key=excluded.system_template_key,audience=excluded.audience,trigger_event=excluded.trigger_event,campaign_goal=excluded.campaign_goal,conversion_goal=excluded.conversion_goal,purpose=excluded.purpose,compliance_note=excluded.compliance_note,steps=excluded.steps,can_create_campaign=excluded.can_create_campaign,is_active=excluded.is_active,sort_order=excluded.sort_order,updated_at=now();

insert into public.email_template_library(tenant_id,slug,name,delivery_class,audience,trigger_event,campaign_goal,conversion_goal,purpose,compliance_note,send_hour,utm_campaign,steps,can_create_campaign,is_active,sort_order)
select t.id,'profile-optimization-foundation','Profile Optimization Before Paid Visibility','promotional','verified_opted_in','business_verified','education','any_inquiry','Help verified opt-in business owners strengthen their directory profile before considering paid visibility.','Education only. Do not imply profile completeness guarantees rankings, leads or better organic position.',10,'profile_optimization_foundation',
jsonb_build_array(
jsonb_build_object('step_order',1,'delay_days',2,'subject','Your profile is live — make it easier to choose you','preheader','A stronger profile helps local customers understand your business faster.','body','Your Central Illinois Local Pros profile is verified and live. Before paying for more visibility, make sure the profile clearly explains what you do, where you serve and how customers should contact you.\n\nReview your description, services, hours, phone, website, service areas and photos. Better information can make each visit more useful, but it does not change our organic ranking rules or guarantee leads.','cta_label','Review Your Business Profile','cta_url','/business-portal','is_active',true),
jsonb_build_object('step_order',2,'delay_days',6,'subject','3 profile details customers use to compare local businesses','preheader','Clarity, trust and a simple next step matter.','body','When people compare local businesses, three things often matter immediately: what the business actually offers, whether the details look current and trustworthy, and how easy it is to take the next step.\n\nUse your profile to answer those questions quickly. Keep services specific, hours accurate, photos current and calls to action easy to understand.','cta_label','Check Your Profile','cta_url','/business-portal','is_active',true),
jsonb_build_object('step_order',3,'delay_days',10,'subject','Before buying more visibility, strengthen the destination','preheader','Make sure extra attention has somewhere strong to land.','body','Paid visibility can create additional exposure, but the profile still has to do the work of explaining the business. Before considering Featured or Sponsored placement, make sure the destination is complete and current.\n\nSponsored placement never changes verification or organic rank, and additional visibility does not guarantee inquiries.','cta_label','Review Business Options','cta_url','/for-businesses','is_active',true)),true,true,30
from public.tenants t where t.slug='central-illinois-local-pros'
on conflict(tenant_id,slug) do update set name=excluded.name,delivery_class=excluded.delivery_class,audience=excluded.audience,trigger_event=excluded.trigger_event,campaign_goal=excluded.campaign_goal,conversion_goal=excluded.conversion_goal,purpose=excluded.purpose,compliance_note=excluded.compliance_note,send_hour=excluded.send_hour,utm_campaign=excluded.utm_campaign,steps=excluded.steps,can_create_campaign=excluded.can_create_campaign,is_active=excluded.is_active,sort_order=excluded.sort_order,updated_at=now();

insert into public.email_template_library(tenant_id,slug,name,delivery_class,audience,trigger_event,campaign_goal,conversion_goal,purpose,compliance_note,send_hour,utm_campaign,steps,can_create_campaign,is_active,sort_order)
select t.id,'sponsored-placement-education-template','Sponsored Placement Education','promotional','verified_opted_in','business_verified','sponsored','sponsored_inquiry','Educate verified opt-in business owners about clearly labeled Featured/Sponsored visibility without implying payment changes organic rank or verification.','Paid placement must stay clearly labeled and separate from verification, organic relevance and lead guarantees.',10,'sponsored_placement_education',
jsonb_build_array(
jsonb_build_object('step_order',1,'delay_days',2,'subject','Your business is live — what Sponsored placement actually changes','preheader','Paid visibility is separate from organic rank.','body','Your Central Illinois Local Pros profile is verified and live. Sponsored placement can put a clearly labeled business card in additional high-visibility areas of the directory.\n\nIt does not buy a better organic position, change verification, or guarantee leads.','cta_label','See Visibility Options','cta_url','/for-businesses','is_active',true),
jsonb_build_object('step_order',2,'delay_days',5,'subject','Be seen where local customers are already browsing','preheader','Reach shoppers inside relevant directory pages.','body','Featured and Sponsored placements are designed for businesses that want additional exposure while people are already browsing local categories, cities and business profiles.\n\nThe placement stays clearly labeled as advertising and remains separate from organic ranking.','cta_label','Explore Sponsored Placement','cta_url','/for-businesses','is_active',true),
jsonb_build_object('step_order',3,'delay_days',9,'subject','Make your profile convert before buying more visibility','preheader','Strong profiles help customers understand the business faster.','body','Before adding paid visibility, review your logo, photos, business description, hours, service areas, website and calls to action. Better profile information can make every visit more useful without changing organic ranking rules.','cta_label','Review Business Options','cta_url','/for-businesses','is_active',true),
jsonb_build_object('step_order',4,'delay_days',14,'subject','Want to explore Featured or Sponsored placement?','preheader','Choose visibility only when it fits your goals.','body','If additional directory exposure fits your goals, you can review Featured and Sponsored options. Paid placement remains separate from verification, organic relevance and lead guarantees.','cta_label','Ask About Visibility','cta_url','/contact?reason=visibility-plan&plan=featured&source=email-template','is_active',true)),true,true,40
from public.tenants t where t.slug='central-illinois-local-pros'
on conflict(tenant_id,slug) do update set name=excluded.name,delivery_class=excluded.delivery_class,audience=excluded.audience,trigger_event=excluded.trigger_event,campaign_goal=excluded.campaign_goal,conversion_goal=excluded.conversion_goal,purpose=excluded.purpose,compliance_note=excluded.compliance_note,send_hour=excluded.send_hour,utm_campaign=excluded.utm_campaign,steps=excluded.steps,can_create_campaign=excluded.can_create_campaign,is_active=excluded.is_active,sort_order=excluded.sort_order,updated_at=now();

insert into public.email_template_library(tenant_id,slug,name,delivery_class,audience,trigger_event,campaign_goal,conversion_goal,purpose,compliance_note,send_hour,utm_campaign,steps,can_create_campaign,is_active,sort_order)
select t.id,'skylight-local-growth-nurture','Skylight Local Growth Nurture','promotional','verified_opted_in','business_verified','skylight_growth','skylight_inquiry','Educational Skylight Reflections Marketing nurture covering local SEO, Google Business Profile quality, websites, conversion and qualified-lead systems.','No Google ranking, traffic or lead guarantees. Keep recommendations practical and educational.',10,'skylight_local_growth_nurture',
jsonb_build_array(
jsonb_build_object('step_order',1,'delay_days',3,'subject','3 local SEO gaps that can cost a business visibility','preheader','A practical checklist from Skylight Reflections Marketing.','body','Local visibility usually starts with consistent business information, useful location-focused website content, and a well-maintained Google Business Profile.\n\nSkylight Reflections Marketing can help identify gaps and prioritize improvements, but no agency can guarantee a specific Google ranking.','cta_label','Review Growth Options','cta_url','/contact?reason=visibility-plan&plan=marketing_review&source=email-template','is_active',true),
jsonb_build_object('step_order',2,'delay_days',7,'subject','Your Google Business Profile and local search visibility','preheader','Accuracy, relevance and activity matter.','body','Your Google Business Profile is often one of the first places local customers encounter your business. Accurate categories, services, hours, photos, reviews and website alignment can strengthen the overall local-search presence.','cta_label','Request a Visibility Review','cta_url','/contact?reason=visibility-plan&plan=marketing_review&source=email-template','is_active',true),
jsonb_build_object('step_order',3,'delay_days',12,'subject','Turn more website visits into qualified inquiries','preheader','Traffic is only useful when the next step is clear.','body','For lead-based businesses, a website should make it easy to understand services, service areas, trust signals and the next action. Skylight can help improve landing pages, local SEO structure and lead-capture paths around the customers you actually want.','cta_label','Explore Lead Growth Help','cta_url','/contact?reason=visibility-plan&plan=marketing_review&source=email-template','is_active',true),
jsonb_build_object('step_order',4,'delay_days',18,'subject','What to improve before paying for more traffic','preheader','Fix conversion and local visibility foundations first.','body','Before adding more paid traffic, review whether your website, Google Business Profile, directory profile and contact flow are ready to convert attention into real inquiries. Improving the foundation can make future marketing spend more useful.','cta_label','See Marketing Support','cta_url','/contact?reason=visibility-plan&plan=marketing_review&source=email-template','is_active',true),
jsonb_build_object('step_order',5,'delay_days',25,'subject','Want a Skylight Reflections Marketing visibility review?','preheader','Review SEO, Google visibility and lead-generation opportunities.','body','If you want a second set of eyes on your local visibility, Skylight Reflections Marketing can review the business website, local SEO foundation, Google Business Profile and lead-generation opportunities, then recommend practical next steps.','cta_label','Request a Review','cta_url','/contact?reason=visibility-plan&plan=marketing_review&source=email-template','is_active',true)),true,true,50
from public.tenants t where t.slug='central-illinois-local-pros'
on conflict(tenant_id,slug) do update set name=excluded.name,delivery_class=excluded.delivery_class,audience=excluded.audience,trigger_event=excluded.trigger_event,campaign_goal=excluded.campaign_goal,conversion_goal=excluded.conversion_goal,purpose=excluded.purpose,compliance_note=excluded.compliance_note,send_hour=excluded.send_hour,utm_campaign=excluded.utm_campaign,steps=excluded.steps,can_create_campaign=excluded.can_create_campaign,is_active=excluded.is_active,sort_order=excluded.sort_order,updated_at=now();
