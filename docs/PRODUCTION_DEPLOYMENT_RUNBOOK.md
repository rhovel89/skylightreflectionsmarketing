# Central Illinois Local Pros — Production Deployment Runbook

## Canonical application

- Vercel project: `central-il-local-pros`
- Canonical public URL: `https://central-il-local-pros.vercel.app`
- Production branch: `central-il-local-pros-v15.5`
- GitHub repository: `rhovel89/skylightreflectionsmarketing`
- Supabase project: `zbsdbqdvmlatlklwjiuh`
- Node runtime: `24.x`
- Architecture: Next.js + Vercel + Supabase + GitHub

## Approved Vercel model

Central Illinois Local Pros uses both **Production** and **Preview** environments.

### Production

Only the approved application branch `central-il-local-pros-v15.5` should automatically create Production deployments. The canonical domain must point to the latest healthy Production deployment from this branch.

### Preview

Other branches and pull requests remain Preview deployments. Preview URLs are used for QA and should remain protected and/or noindex.

Do not make every Git branch a Production deployment. Do not attach the canonical public domain to Preview deployments. Do not change the repository default branch merely to control Vercel production targeting.

## Configuration status — verified 2026-09-01

Vercel Production Branch Tracking is correctly set to `central-il-local-pros-v15.5`. Preview remains available for other branches. The earlier condition where healthy V15.5 builds were created with `target: null` has been corrected.

The homepage canonical metadata fix was committed as `2103ad93b626bf917f9971f2ec2d96c5f612324a`, deployed to Production and verified with a root self-canonical.

## Environment variables

Environment variables and deployment environments are separate concepts.

- Production variables must be available to Production.
- Preview variables may also be enabled when Preview deployments need to run the application for QA.
- Do not remove Preview access merely to force a deployment into Production.
- Continue using the existing Supabase project; do not create a second database solely to solve deployment targeting.
- Preview deployments must not be used for destructive or fabricated production-data testing.

## Directory integrity rules

Deployment, SEO, acquisition and monetization work must preserve directory trust rules.

Never fabricate:

- Google ratings or review counts
- claimed or verified status
- testimonials
- leads or revenue
- sponsorship transactions
- operational activity
- rankings

For researched/imported businesses, default to:

- `claimed = false`
- `verified = false`
- `featured = false`
- `rating = 0`
- `review_count = 0`

Every researched business must retain genuine source evidence and represent a genuine physical branch when a physical local branch is listed. Paid placement must remain separate from organic directory relevance.

## SEO eligibility rules

A city/category market needs at least **3 genuine published providers** before it is eligible for indexable SEO.

Eligible city/category pages should have reviewed SEO, a canonical URL, useful original local content, BreadcrumbList schema, an unordered ItemList where appropriate, FAQ schema where appropriate, and supported/non-superlative language.

Search/filter URLs remain `noindex, follow`.

### Pontiac coffee exception

`/illinois/pontiac/cafes-coffee` currently has 2 genuine providers and intentionally remains `noindex, follow`. Do not add a weak or questionable third listing merely to unlock this page.

## SEO/application hardening currently in production

- Business profiles use business-specific metadata, canonical URLs, Open Graph/Twitter metadata, `index, follow`, BreadcrumbList schema and published-status filtering.
- Site-wide layout publishes WebSite and Organization structured data, with Skylight Reflections Marketing as the parent organization.
- City pages and city/category pages use reviewed/index gating and thin-page noindex protection.
- City/category pages publish BreadcrumbList, unordered ItemList and FAQ structured data where appropriate.
- Local Guide articles resolve matching city/category records and link directly back to the local directory market; category pages link relevant Local Guides back out, creating reciprocal intent clusters without duplicate pages.
- Vertical hubs (`/home-services`, `/legal-services`, `/restaurants`, `/local-stores`) have dedicated metadata and structured data.
- `/illinois` has canonical metadata and an active-location ItemList.
- `app/sitemap.ts` uses real update timestamps, deduplicates URLs and independently rechecks live provider depth before emitting city/category SEO URLs.
- The homepage has an explicit root canonical.
- Private Admin/account/API/auth areas remain protected by robots rules and authentication/RLS controls.

## Trust and legal layer

Substantive public trust/legal pages currently include:

- `/terms`
- `/privacy`
- `/listing-policy`
- `/advertising-disclosure`

The listing and advertising policies preserve the distinction between researched, claimed and verified listings and make clear that sponsorship does not determine organic ranking.

## Production benchmark — verified 2026-09-01

After the latest Ottawa inventory expansion:

- **353 published businesses**
- **114 city/category markets with at least 3 published providers**
- **33 underfilled city/category markets**
- **0 eligible markets missing reviewed SEO**
- **3 two-provider markets remain**, including the intentional Pontiac Cafes & Coffee exception
- **30 one-provider markets remain**

The latest legitimate unlock was Ottawa → Delis & Sandwiches. A sourced physical Ottawa deli department was added with imported-listing integrity defaults, bringing that market from 2 to 3 providers. The market now has reviewed SEO, renders `index, follow`, publishes BreadcrumbList + ItemList + FAQ structured data, and is included in `sitemap.xml`.

The two remaining non-exception 2-provider Lincoln categories were researched again but no defensible net-new third provider was found, so they remain underfilled/noindex rather than being padded with questionable inventory.

## Admin/Search Intelligence status

`seo_market_gaps` was found stale during the 2026-09-01 production audit even though public pages and live inventory counts were correct. The table was reconciled from actual published-business, active-location and active-category joins without weakening the protected staff/admin refresh function.

Use live published inventory as the source of truth when validating market eligibility. If Admin intelligence disagrees with the live joins, reconcile the intelligence layer before using it to drive inventory expansion.

## Local Guides benchmark — live verification 2026-09-01

The live database reports:

- **78 published guides**
- **78 flagship guides at or above 2,000 characters**
- **0 thin guides below 1,500 characters**
- **0 drafts**
- shortest published guide: **2,206 characters**

This supersedes the older 32-flagship / 43-thin handoff snapshot. Do not add filler simply to increase length. The next editorial work should focus on source quality, freshness, usefulness and intent coverage. Upgrade-before-duplicate remains the anti-cannibalization rule.

## Organic growth → business acquisition → paid revenue architecture

The directory uses a staged business-growth model rather than pay-to-rank:

1. **Organic discovery:** useful indexable city/category pages, business profiles and Local Guides attract local search traffic.
2. **Free business acquisition:** an existing business can submit a free ownership claim; an unlisted business can submit a free listing for staff review.
3. **Reviewed owner access:** claims remain separate from verification and are reviewed before owner access is granted.
4. **Optional business tools:** approved businesses can evaluate paid plan features without changing organic directory relevance.
5. **Clearly labeled sponsorship:** sponsored placement can be sold separately from organic results and must be represented only by a real active sponsorship record.
6. **Skylight services:** a business can separately request a marketing visibility review or other Skylight Reflections Marketing services.

### Current plan catalog

The active database plan catalog currently contains:

- Free — $0/month
- Verified — $19/month or $190/year
- Featured — $49/month or $490/year
- Pro — $99/month or $990/year

These plans do not guarantee verification, badges, leads, organic rank or editorial preference. Verification remains an approval workflow. Stripe remains disconnected until it is explicitly enabled and configured; do not represent an inquiry as a paid subscription.

### Acquisition funnel context

`marketing_leads` now retains structured acquisition context when a real business owner submits a request:

- `plan_interest`
- `context_city`
- `context_category`
- `context_business_id`
- `landing_path`

The public contact workflow validates known plans, active cities/categories and published businesses before persisting that context.

### Privacy-safe growth events

`track_growth_event(...)` records only whitelisted non-PII growth events in `analytics_events`. Public callers cannot supply arbitrary event types or metadata. Successful server-side submissions record submit events only after the corresponding claim, listing submission or marketing lead has actually been created.

Current event families include:

- For Businesses page view
- free claim/listing CTA intent
- successful claim/listing submissions
- paid-plan CTA intent
- city sponsorship CTA intent
- business-profile visibility CTA intent
- marketing-review CTA intent
- successful marketing lead submissions

Do not create synthetic production events merely to make the dashboard look active.

### Public acquisition entry points

The acquisition layer now includes:

- `/for-businesses` — free claim/listing first, then optional plans
- pricing cards — selected plan is carried into `/contact`
- business profiles — free claim remains separate from an optional contextual visibility request
- city pages — optional city sponsorship request carries real city context
- `/contact` — validated plan/city/category/business context is preserved on a real submission

### Admin growth intelligence

Private Admin route `/admin/growth` is protected by the shared staff layout and must remain `noindex`. It distinguishes:

- CTA intent from actual submissions
- actual claims from click events
- actual marketing requests from plan clicks
- open outreach tasks from outreach actually marked sent
- active subscriptions from inquiries
- active sponsorship records from sponsor interest

Starting acquisition audit:

- **341** researched business prospects in the CRM
- **257** published/contact-ready prospects in `claim_outreach` across hot/high/medium priority at the latest reconciliation (36 hot, 132 high, 89 medium)
- **495** open/in-progress outreach tasks
- **306** open claim-invite tasks
- the hot/high/medium claim-outreach cohorts already have claim-invite tasks, so do not duplicate them
- zero claim-invite or marketing-pitch sent timestamps were present at the starting audit; a task is not evidence that outreach was sent
- zero active sponsorship records at the starting monetization audit

## Supabase security note

Latest known Auth advisor item: **Leaked Password Protection Disabled**.

Treat this as an Auth configuration/plan capability, not a SQL workaround. Do not fake-enable it and do not weaken RLS or other policies to clear advisor noise. Performance-advisor notices should be evaluated against actual workload before indexes or policies are changed.

## Release verification checklist

Before considering a release stable, verify:

1. Latest V15.5 deployment is READY and targeted to Production.
2. Canonical homepage returns HTTP 200 and self-canonical metadata.
3. `/api/health` reports a healthy database connection.
4. `/guides` and at least one guide detail return HTTP 200.
5. A newly added business profile returns HTTP 200, is self-canonical, and shows no fabricated reputation/verification state.
6. Representative city and eligible city/category pages return HTTP 200 with correct canonical, robots and structured data.
7. Thin/underfilled city-category markets remain noindex and are not emitted as indexable sitemap URLs.
8. Pontiac Cafes & Coffee remains noindex until a genuine third provider exists.
9. `/restaurants` and `/local-stores` resolve normally.
10. `/contact?reason=list-business` resolves normally.
11. A contextual visibility-plan request renders the selected plan and valid market context without changing organic ranking state.
12. Business profiles expose free claim separately from optional paid visibility.
13. `/admin/growth` remains staff-protected and noindex.
14. `/privacy`, `/listing-policy` and `/advertising-disclosure` resolve normally.
15. `/claim` and `/list-your-business` redirect to their intended workflows.
16. `/sitemap.xml` and `/robots.txt` return successfully.
17. Newly unlocked indexable markets appear in the sitemap only after genuine provider depth is met.
18. No new production runtime-error clusters appear.

## Verification snapshot — 2026-09-01

Verified during the current audit:

- Production branch tracking: correct (`central-il-local-pros-v15.5`)
- Production deployment: READY
- Runtime audits before the growth push: 0 production runtime errors
- `/api/health`: HTTP 200, database healthy, application version 15.5.0
- Homepage: HTTP 200, `index, follow`, WebSite + Organization schema, explicit root canonical
- `/illinois/streator/cafes-coffee`: 3 live providers and indexable SEO
- `/illinois/streator/farm-garden`: 3 live providers and indexable SEO
- `/illinois/lincoln/boutiques-clothing`: 3 live providers and indexable SEO
- `/illinois/pontiac/cafes-coffee`: 2 live providers, `noindex, follow`, intentionally absent from indexable sitemap coverage
- `/illinois/ottawa/delis-sandwiches`: 3 live providers, `index, follow`, self-canonical, BreadcrumbList + ItemList + FAQ schema, included in sitemap
- `/business/kroger-deli-ottawa-columbus-st`: HTTP 200, self-canonical, LocalBusiness + BreadcrumbList schema, no false claimed/verified/featured badges, no fabricated rating/review block; free claim and optional contextual visibility are separated
- `/contact` contextual Featured-plan QA: HTTP 200, valid Ottawa + Delis & Sandwiches context retained in the form, organic-rank disclaimer present
- `/for-businesses`: HTTP 200, self-canonical; paid pricing cards carry selected plan/source context and explicitly disclaim organic-rank or verification guarantees
- Sitemap: dynamically includes newly eligible reviewed markets and excludes thin markets through live provider-depth checks
- Local Guides: 78/78 published guides are 2,000+ characters; no thin guides remain by the current threshold

Continue acquisition, release verification and legitimate inventory/editorial expansion from these confirmed baselines rather than reverting to older counts.