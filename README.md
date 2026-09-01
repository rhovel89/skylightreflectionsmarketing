# Central Illinois Local Pros — Canonical V15.5 — Launch & Operations

Production-oriented Next.js source for **Central Illinois Local Pros**, powered by **Skylight Reflections Marketing**.

## Locked product baseline
V15.5 preserves the V13/V15.1 restored feature baseline and adds the production-backed V15.2/V15.3 systems. Do not remove major functions without an explicit owner decision.

Public verticals: Home Services, Attorneys / Legal, Restaurants, Local Stores / Retail.

## Architecture
- Next.js 16 App Router
- React 19
- TypeScript
- Supabase Postgres + Auth + RLS
- `@supabase/ssr` cookie-based authentication
- Next.js `proxy.ts` session refresh
- No browser-exposed service-role key
- Database-driven branding, navigation, public content, pricing and directory inventory

## Production project
Supabase project ref: `zbsdbqdvmlatlklwjiuh`
Tenant slug: `central-illinois-local-pros`

Copy `.env.example` to `.env.local` and add the project's **publishable key**.

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## First staff account
The live database currently has no `user_roles` rows. Create/sign in with the owner's Supabase Auth account, then assign that user's UUID a `super_admin` role for tenant `6673621d-b359-4c17-a984-c8f50d914eb3` in Supabase. After that, the subtle **Staff / Admin Login** footer link can use real authentication. Team/role changes are Super Admin only.

Do not ship a hard-coded admin username/password.

## Editable from Admin
- Skylight logo and colors
- directory/parent brand names and taglines
- homepage hero and global copy
- pricing/plans/features
- navigation/footer links
- business listings/statuses
- categories and markets, including new cities/towns/areas
- physical branches and service-area separation
- claims, submissions, listing reports
- owner edit requests
- guides/content
- SEO content/index controls
- sponsored placements
- leads/routing/subscriptions
- Skylight CRM/marketing opportunities
- Local Guides/content blocks and navigation creation
- legitimate physical branch creation, kept separate from service areas

## Integrity rules
- claimed != verified
- public research listings remain unclaimed/unverified until workflow completes
- do not fabricate reviews/ratings/rankings
- hide review UI without a legitimate source
- legal copy stays neutral/informational
- service area is not a physical office
- sponsorship is labeled and does not secretly alter organic relevance/routing
- private SEO/security/CRM diagnostics never appear on customer pages

## Deployment
At the V15.5 checkpoint, Local Pros is being established as an isolated remote branch without changing the existing Skylight `main` branch. The connected Vercel team still has no verified Local Pros project, so the site is **not yet a verified live deployment**. See `docs/V15.5_LAUNCH_STATUS.md`.
