# Central Illinois Local Pros — Production Launch & Operations Runbook

Release: V15.5  
Production source branch: `central-il-local-pros-v15.5`  
Repository: `rhovel89/skylightreflectionsmarketing`

This runbook is the external launch and ongoing production-control sequence. Do not create fake reviews, leads, claims, verifications, sponsorships, analytics events, purchases, credits, or business activity to make production appear populated.

## 1. Automated release gate

The GitHub Actions workflow must be green on the exact release commit. It validates:

- locked dependency install on Node 24
- TypeScript
- full Next.js production build
- built production server startup
- safe public-route smoke tests
- `/api/health`
- `/robots.txt` and `/sitemap.xml`
- `/search` remains `noindex, follow`
- private admin crawl protection
- exact canonical Vercel production deployment when the change requires an app deployment
- live dynamic-market discovery and crawler/privacy controls

Do not treat an older READY deployment as proof that a newer release commit is live. `/api/health` must report the exact intended commit.

## 2. Production hosting and canonical origin

Vercel project: `central-il-local-pros`  
Production branch: `central-il-local-pros-v15.5`

Keep the repository root as the project root and Next.js as the framework. Do not point production at another branch until an intentional cutover is approved.

Required browser-safe variables include:

- `NEXT_PUBLIC_SUPABASE_URL=https://zbsdbqdvmlatlklwjiuh.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<current production publishable key>`
- `NEXT_PUBLIC_SITE_URL=https://<verified-production-domain>`

Never place the Supabase service-role key, Stripe secret key, webhook signing secret, provider tokens, or other server credentials in `NEXT_PUBLIC_*` variables or browser code.

## 3. Supabase Auth and staff access

Before broad account use:

1. Keep the Site URL and allowed redirects limited to intended production/preview/local origins.
2. Confirm email confirmation and password-reset links return to the correct app origin.
3. Bootstrap the first Super Admin only with the explicit one-time SQL workflow in `supabase/v15_5_bootstrap_first_super_admin.sql`.
4. Never use “first signup becomes admin” logic.
5. Keep `/admin` staff-only and `/business-portal` owner-authenticated.
6. Enable stronger Auth protections, including leaked-password protection, when available for the project plan/configuration.

## 4. Public discovery and trust controls

Verify all of the following after each material directory/indexing change:

- only published businesses render publicly
- Sponsored is shown only for valid paid placement and is visually separate from organic results
- paid products never alter organic relevance, trust, verification, or index eligibility
- Verified appears only through the protected verification workflow
- claimed ownership does not create a Verified badge
- physical locations and service areas remain separate concepts
- a service-area match is explicitly labeled as service area and never represented as a local office
- city/category pages require at least three published providers before indexing
- provider threshold counts active physical locations and legitimate service areas consistently
- sitemap eligibility matches page-level `index/noindex` behavior
- search and thin market pages remain protected from indexing

## 5. Lead Revenue CRM invariants

The billing event is delivery of an agreed lead. Booking, quote, contact, close, or revenue outcome does not erase a valid delivered-lead charge.

Before changing lead billing code, preserve these controls:

- Pro includes Lead Inbox; Featured may receive it only through the approved add-on path
- agreement dates, monthly caps, exclusive/shared buyer limits and payment holds are checked before delivery
- delivery-time price snapshots remain attached to charges even if the contract later changes
- bundle invoices use compatible historical bundle snapshots; incomplete bundles wait until fulfilled
- credits are exception-based and staff-reviewed
- credits may reduce eligible draft balances without rewriting historical delivered-lead value
- auto billing prepares eligible drafts and overdue state; it must not silently change the commercial agreement
- business notifications are idempotent where an event key is available
- customer-facing lead performance never claims that a click, inquiry, delivered lead or payment equals a closed sale

## 6. Stripe reconciliation

The signed `stripe-directory-webhook` edge function is the source of truth for asynchronous Stripe lifecycle reconciliation.

For lead invoices, verify handling of:

- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.voided`

Reconciliation must verify internal invoice identity, business/tenant identity, Stripe invoice identity where known, and amount where payment amount matters. Mismatches go to review rather than being force-applied.

Subscription payment state and sponsored placement state must remain separate from organic rank and verification.

## 7. Business Portal safety and conversion tooling

Customer-facing Profile Strength is a completeness/readiness tool only. It must not reveal internal SEO clusters, security diagnostics, proprietary ranking signals, staff notes, raw risk scores, lead-buyer intelligence, or `businesses.profile_score`.

Base Profile Strength should be achievable without buying a paid plan. Verification and paid products are not required for a perfect base completeness score.

Pro Conversion Readiness may separately measure optional tools such as:

- services
- FAQs
- primary CTA
- current offer
- packages/products
- social links
- announcements
- approved showcase media

Tracked customer actions may distinguish offer, package, CTA, social, menu, ordering, reservation, phone, directions and website sources. These signals are analytics only; they do not modify organic ordering.

## 8. Private Admin intelligence

The following surfaces are private business/staff intelligence and must never be exposed on public or customer pages:

- Revenue Intelligence
- Lead Revenue CRM controls and internal receivables risk
- Content & Market Intelligence
- SEO coverage/gap diagnostics
- security advisor output
- raw ranking/route weighting signals
- buyer/lead-marketplace internal data
- staff notes and audit details

Use Revenue Intelligence for invoiceable pipeline, credits, payment risk, expiring agreements and demand-versus-provider coverage.

Use Content & Market Intelligence for reviewed/indexable SEO coverage, provider-threshold gaps, guide freshness/thinness review, possible duplicate intent and low-result search demand. Duplicate/thin flags are review signals, not automatic deletion instructions.

## 9. Database and security gate

Before launch or a material authorization/billing change:

- migrations applied in production must also be tracked in GitHub
- RLS and protected workflow permissions must remain intact
- high-value foreign-key/query paths should be indexed as volume grows
- no unresolved authorization, tenant-isolation, secret-exposure or privilege-escalation finding may remain
- review Supabase SECURITY DEFINER advisor warnings individually; some authenticated RPCs intentionally remain callable because the function itself performs role/ownership checks
- do not revoke a required RPC merely to force the advisor warning count to zero
- document and remediate any warning whose exposure is not intentional
- keep server integration secrets out of public tables and browser-accessible code

A literal “zero advisor warnings” count is not the release criterion. The release criterion is **zero unresolved high-risk security findings plus documented review of intentional warnings**.

## 10. Live end-to-end smoke test

Use legitimate test actions and remove only clearly synthetic test records that are safe to delete afterward.

### Public discovery

- homepage renders
- search by category, city and business name
- real published profile opens
- physical locations and service areas label correctly
- Sponsored and Verified badges follow their independent rules
- thin market routes are noindex and omitted from sitemap

### Consumer lead

- submit one clearly labeled internal test lead with consent
- direct inquiry routes only to that business
- general request remains available for staff routing
- owner sees only leads routed to an owned business
- staff routing records reason/rank

### Owner workflow

- ownership claim remains pending until staff moderation
- claim approval does not create verification
- listing edits remain pending until staff review
- permitted media remains non-public until approval
- Profile Strength shows only safe completeness guidance
- Pro conversion tracking begins populating only from real customer actions

### Revenue workflow

- deliver a controlled eligible test lead under a configured agreement
- confirm the delivery ledger stores the negotiated snapshot
- create a draft invoice from eligible delivered leads
- confirm available credits apply correctly
- send only when intentionally approved
- verify signed Stripe lifecycle reconciliation
- confirm payment failure does not erase the delivered-lead charge
- confirm paid/voided states reconcile correctly

### Staff workflow

- claims/submission/edit/report/media moderation
- business/branch verification evidence workflow
- sponsorship controls
- lead routing and marketplace
- Lead Revenue CRM and Revenue Intelligence
- Content & Market Intelligence
- search/listing analytics
- audit log

## 11. Launch decision

Launch or promote a release only when all of the following are true:

- exact release commit is green in GitHub Actions
- exact release commit is serving on the canonical production alias
- `/api/health` reports database OK and that exact deployment commit
- production environment variables and canonical origin are correct
- Supabase Auth production URLs are configured
- at least one intended Super Admin exists
- final Skylight Reflections Marketing branding is installed
- live public/private smoke tests pass
- sitemap and robots are correct
- no unresolved high-risk security or tenant-isolation finding remains
- Stripe webhook reconciliation is active when billing features are enabled
- no fake trust, review, sponsorship, lead or analytics data has been introduced

## 12. Post-launch monitoring

Monitor:

- Vercel runtime error clusters and 5xx responses
- `/api/health` exact commit and database status
- failed or needs-review Stripe webhook events
- Supabase security advisor and Auth settings
- claims/submissions/reports/media moderation queues
- lead routing, lead billing drafts, overdue balances and credit requests
- search zero-result/low-result patterns
- listing and Pro conversion analytics
- sitemap/index eligibility parity
- guide quality/freshness and duplicate-intent review queues

Any production incident involving authorization, tenant isolation, verification, billing integrity, service-area misrepresentation, or incorrect paid-placement disclosure blocks growth work until resolved.
