# V15.5 Validation

## Production release gate

Validated runtime-code commit: `d1f1b1cd98891c0adccb2ebc1269c46b970ffdd6`

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
- Vercel Git production deployment: **PASS**.
- Canonical production origin: `https://central-il-local-pros.vercel.app`.
- Persistent Vercel project: **VERIFIED**.
- Production branch: `central-il-local-pros-v15.5`.
- Production and Preview Supabase public environment variables: **CONFIGURED**.

The release workflow repeats the locked build and runtime smoke gate on every push to `central-il-local-pros-v15.5`.

## Auth, Admin and RLS

- Supabase Auth production Site URL / redirect origin: **CONFIGURED**.
- Confirmed Auth users: **1**.
- Super Admin assignments: **1**.
- Authenticated Admin access: **VERIFIED**.
- Authenticated RLS recursion between `businesses` and `business_owners`: **FIXED**.
- Authenticated Admin inventory readback: **301 published businesses / 306 active locations**.
- Protected claims, submissions, owner edits, listing reports, verification, lead routing, media moderation and sponsorship workflows: **ENFORCED**.
- Claim approval does not automatically verify a business.
- Paid sponsorship state remains separate from organic ranking, verification, SEO coverage and lead routing.

## Supabase security and performance

- Database/storage security policies introduced for V15.5: **PASS**.
- Listing-event tenant isolation: **VERIFIED**.
- Listing-event grants: **LEAST PRIVILEGE**.
- Durable `site-assets` logo bucket: **Admin / Super Admin write restricted**.
- Current Supabase Security Advisor: **1 warning** — `auth_leaked_password_protection`.
- The warning is an Auth hardening setting, not an RLS/schema vulnerability. Enable leaked-password protection in Supabase Auth when available/configured for the project plan.

Migration `20260901174735_fix_launch_performance_indexes` resolved the launch-level missing-FK-index and duplicate-index findings. Pre-traffic `unused_index` INFO notices and intentional overlapping access-policy performance warnings remain deferred until representative traffic exists.

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
- Listing interaction events: **308**
- Supabase Auth users: **1**
- Super Admin role assignments: **1**

No fake lead, verification, sponsorship, review or customer activity was inserted merely to make production dashboards appear populated.

## Final branding gate

- Durable Skylight logo upload workflow: **LIVE**.
- Upload path: authenticated browser → Supabase Storage `site-assets` → protected server activation.
- Vercel Function body-size dependency for logo binaries: **REMOVED**.
- Final durable logo: **INSTALLED**.
- Format: **PNG**.
- Stored size: **331,536 bytes**.
- `site_settings.brand_logo_url`: **CONFIGURED** to the managed Supabase Storage asset.
- Launch Readiness expected remaining launch gates: **0**.

## Status

**V15.5 is production live.**

There are no remaining external launch gates for hosting, Auth bootstrap, Super Admin access, or final branding. Remaining work is post-launch hardening and real-traffic verification, chiefly enabling Supabase Auth leaked-password protection when available and continuing to validate owner/lead/media workflows with legitimate production activity rather than fabricated records.
