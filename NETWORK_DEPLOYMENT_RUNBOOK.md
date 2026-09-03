# Local Pros Network — Replicated Market Deployment Runbook

The Local Pros application can now be reused for additional regional directories without editing the core Central Illinois source code.

## 1. Provision the tenant skeleton

From `/admin/network-expansion`, a Super Admin can create a new tenant skeleton.

Provisioning copies only reusable configuration:
- active category taxonomy
- plan names, prices, features and entitlements
- Skylight brand settings and public-copy defaults

Provisioning deliberately does **not** copy:
- businesses, locations or service areas
- owners, claims or verification
- reviews or ratings
- leads, lead buyers, invoices or credits
- subscriptions or sponsorships
- analytics/search events
- SEO pages or guides
- Stripe product/price/payment-link identifiers

## 2. Create the deployment

Create a separate Vercel project for the market using the same repository and approved production branch/code.

Set these browser-safe market selectors:
- `NEXT_PUBLIC_DIRECTORY_TENANT_ID=<provisioned tenant UUID>`
- `NEXT_PUBLIC_DIRECTORY_TENANT_SLUG=<tenant slug>`
- `NEXT_PUBLIC_DIRECTORY_NAME=<market directory name>`
- `NEXT_PUBLIC_DIRECTORY_REGION=<human readable region>`
- `NEXT_PUBLIC_PARENT_BRAND_NAME=Skylight Reflections Marketing`
- `NEXT_PUBLIC_SITE_URL=https://<market-domain>`

Keep the normal Supabase publishable URL/key configuration. Never place service-role, Stripe secret, webhook secret or provider credentials in `NEXT_PUBLIC_*` variables.

## 3. Configure Auth and billing

For the new domain:
- add intentional Supabase Auth redirect/callback URLs
- verify email/password reset flows
- create or map market-specific Stripe products/prices/payment links through the protected pricing workflow
- keep paid plans, sponsorship, verification and organic rank as separate concepts

The tenant provisioner intentionally leaves all copied plan Stripe IDs blank.

## 4. Build market inventory

Add only current, source-backed businesses and locations.

Keep physical locations and service areas separate. A service area never implies an office.

Researched/imported listings start unclaimed, unverified, non-sponsored, rating 0 and review count 0 unless legitimate evidence/workflows establish otherwise.

## 5. SEO launch gate

Do not index thin city/category pages simply because a market exists.

A city or city/category page requires:
- a reviewed/indexable SEO record
- at least three legitimate published providers connected through active physical locations or legitimate service areas
- substantive useful content
- canonical/sitemap parity

Search pages and private routes remain noindex.

## 6. Revenue activation

After real owners claim listings:
- present optional paid plans based on owner needs
- offer clearly labeled sponsorship separately from organic rank
- activate Lead Inbox/lead buying only through the approved agreement workflow
- use delivery as the lead billing event
- keep Skylight marketing outreach separate from directory ranking

## 7. Release gate

Before public launch, verify the exact deployment commit, `/api/health`, canonical host, database tenant, Auth, Stripe reconciliation, sitemap/robots, private-route crawl controls and runtime errors.
