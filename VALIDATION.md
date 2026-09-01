# V15.5 Validation

## Application release gate

Validated runtime-code commit: `fc742354f0e0646f842fe9a61047e53ff2ae3dc4`  
Validated GitHub Actions run: `33540683323`

- Dependency graph: **LOCKED** — `package-lock.json` committed with lockfileVersion 3.
- CI dependency installation: **DETERMINISTIC** — `npm ci --no-audit --no-fund`.
- GitHub Actions repository permission: **READ ONLY** (`contents: read`).
- TypeScript validation: **PASS**.
- Next.js production build: **PASS**.
- Production server startup: **PASS**.
- `/api/health` database connectivity check: **PASS**.
- Safe public route smoke tests: **PASS** for `/`, `/illinois`, `/guides`, `/robots.txt`, `/sitemap.xml`, and `/login`.
- Admin crawler protection: **PASS** — `/admin` sends `X-Robots-Tag: noindex, nofollow, noarchive`.
- Dynamic public search indexing rule: **PASS** — `/search` remains `noindex, follow`.
- Local import/build resolution: **PASS** through the production build.
- Launch Readiness tenant-scoping correction: **PASS** through the same locked-dependency build and runtime smoke gate.

The final read-only / `npm ci` workflow repeats the same build and runtime smoke gate on every push to `central-il-local-pros-v15.5`.

## Supabase security and data integrity

- Supabase Security Advisor: **PASS — 0 security lints** after the current V15.5 schema changes.
- Listing-event tenant isolation: **VERIFIED**.
- Listing-event Data API grants: **LEAST PRIVILEGE** — public insertion only where required; staff read remains RLS protected.
- Protected ownership claims, business submissions, owner edits, listing reports, business verification, branch verification, lead routing, media moderation and sponsorship workflows: **ENFORCED**.
- Claim approval does not automatically create a Verified badge.
- Paid sponsorship state remains separate from organic ranking, verification, SEO coverage and lead routing.

## Supabase performance review

Migration `20260901174735_fix_launch_performance_indexes` was applied and recorded in source control.

Resolved launch-level findings:

- added covering indexes for all seven foreign keys flagged as unindexed by the advisor
- removed the exact duplicate `lead_recipients` index pair
- removed the exact duplicate `leads` index pair

Remaining performance-advisor notices are intentionally deferred:

- `unused_index` INFO notices are not actionable before representative production traffic exists
- `multiple_permissive_policies` WARN notices reflect intentional owner/public/staff access paths; they should be benchmarked and consolidated only with regression coverage rather than rewritten immediately before launch

These are performance advisories, not current Supabase Security Advisor findings.

## Production data checkpoint

- Published businesses: **301**
- Active physical locations: **306**
- Verified businesses: **0**
- Verified physical locations: **0**
- Pending claims: **0**
- Pending business submissions: **0**
- Pending owner edit requests: **0**
- Pending listing reports: **0**
- Pending media: **0**
- Consumer leads: **0**
- Sponsorship records: **0**
- Listing interaction events: **0**
- Search events: **0**
- Supabase Auth users: **0**
- Super Admin role assignments: **0**

Zero operational activity is intentional before real production use; no fake lead, verification, sponsorship, review or analytics data was inserted for validation.

## External launch gates

Application validation is not the same as a live production deployment. The following remain external launch actions:

1. Create/import the persistent Vercel project in `rhovel89's projects` from `rhovel89/skylightreflectionsmarketing`.
2. Use `central-il-local-pros-v15.5` as the initial production source branch.
3. Configure the verified public domain and `NEXT_PUBLIC_SITE_URL`.
4. Configure Supabase Auth production Site URL and redirect origins.
5. Create the owner's real Auth account and explicitly bootstrap its exact UUID as `super_admin`.
6. Install the final durable Skylight Reflections Marketing logo.
7. Run the live deployed browser end-to-end smoke test in `LAUNCH_RUNBOOK.md`.

The connected Vercel team currently reports no persistent projects, so a live production deployment has **not** been represented as complete.
