# Central Illinois Local Pros — Production Launch Runbook

Release: V15.5  
Production source branch: `central-il-local-pros-v15.5`  
Repository: `rhovel89/skylightreflectionsmarketing`

This runbook is the final external launch sequence. Do not create fake reviews, leads, claims, verifications, sponsorships, analytics events, or business activity to make production appear populated.

## 1. Pre-launch automated gate

The GitHub Actions workflow must be green on the exact release commit. It performs:

- dependency install on Node 22
- TypeScript validation
- full Next.js production build
- production server startup
- `/api/health` database connectivity check
- safe public route smoke tests for `/`, `/illinois`, `/guides`, `/robots.txt`, `/sitemap.xml`, and `/login`
- admin `X-Robots-Tag: noindex, nofollow, noarchive` header check
- source assertion that `/search` remains `noindex, follow`

Do not deploy a commit whose validation workflow is red.

## 2. Create the persistent Vercel project

In the Vercel team `rhovel89's projects`:

1. Create a new project.
2. Import Git repository `rhovel89/skylightreflectionsmarketing`.
3. Use the repository root as the project root.
4. Framework preset: Next.js.
5. Set the production branch to `central-il-local-pros-v15.5` for the initial release.
6. Do not point production at the repository default branch until an intentional merge/cutover is approved.

The code can derive its initial canonical host from Vercel's injected production URL. After the permanent public domain is known, set `NEXT_PUBLIC_SITE_URL` explicitly and redeploy.

## 3. Production environment variables

Required browser-safe variables:

- `NEXT_PUBLIC_SUPABASE_URL=https://zbsdbqdvmlatlklwjiuh.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<the current Supabase publishable key already used by V15.5>`
- `NEXT_PUBLIC_SITE_URL=https://<verified-production-domain>`

Never add the Supabase service-role/secret key to `NEXT_PUBLIC_*` variables or browser code.

## 4. First production deployment

Deploy the validated `central-il-local-pros-v15.5` branch.

Immediately verify:

- `/api/health` returns HTTP 200 and `"ok":true`
- `/` loads normally
- `/robots.txt` references the production sitemap host
- `/sitemap.xml` uses the production host and canonical business/city/category slugs
- `/search` emits `noindex, follow`
- `/admin` is not publicly accessible and sends a noindex/noarchive header
- `/account` and `/business-portal` require authentication where appropriate

## 5. Supabase Auth production URLs

In Supabase Auth URL configuration:

1. Set the Site URL to the verified production origin.
2. Add the production callback/redirect origin required by the app.
3. Keep only intentional preview/local redirect URLs.
4. Confirm email confirmation links return to the production app.

Do this before relying on owner/staff account creation in production.

## 6. Bootstrap the first Super Admin

There must be no automatic "first user becomes admin" logic.

1. Open the production `/login` page.
2. Create the owner's real Supabase Auth account with the intended administrator email and a strong password.
3. Confirm the account if email confirmation is enabled.
4. Obtain that exact user's `auth.users.id` UUID from Supabase.
5. Open `supabase/v15_5_bootstrap_first_super_admin.sql`.
6. Replace `OWNER_AUTH_USER_UUID` with that exact UUID.
7. Run the one-time statement in the Supabase SQL editor.
8. Sign out and sign back in.
9. Confirm `/admin` opens and `/admin/launch-readiness` reports at least one Super Admin.

Never promote an arbitrary first signup.

## 7. Final Skylight branding

From `/admin/site-builder`:

1. Upload/configure the durable Skylight Reflections Marketing logo export.
2. Confirm directory name, parent brand, primary/secondary/accent colors, hero copy, footer copy, pricing and navigation.
3. Verify the logo renders on desktop and mobile public pages and inside relevant business/staff surfaces.

The fallback logo is not the final brand asset.

## 8. Live end-to-end smoke test

Use legitimate test actions and remove only test records that are clearly synthetic and safe to delete afterward.

### Public discovery

- homepage renders
- search by category
- search by city
- search by business name
- open a real published business profile
- confirm physical locations and service areas are labeled separately
- confirm Sponsored appears only for a valid active sponsorship record
- confirm Verified appears only for legitimately verified records

### Consumer lead

- submit one clearly labeled internal test lead with contact consent
- confirm a direct profile inquiry routes to that business
- confirm a general request remains available for staff routing
- confirm the business owner sees only leads routed to their owned business
- confirm staff can route a general lead with route reason/rank

### Owner workflow

- submit a business ownership claim from a controlled test account
- approve it through staff moderation only after validating the test setup
- confirm claimed ownership does not create a Verified badge
- submit a listing edit request and verify it remains pending until staff review
- upload a permitted JPEG/PNG/WebP image and verify it remains non-public until staff approval

### Staff workflow

- claims moderation
- submission moderation
- owner edit moderation
- listing report moderation
- business/branch verification evidence workflow
- media moderation
- sponsorship controls
- lead routing
- search intelligence
- listing analytics
- audit log

### Analytics

After the live actions above, confirm real events begin appearing in:

- listing event totals
- listing daily statistics
- owner analytics
- staff listing analytics
- search intelligence

Do not manually populate analytics counters.

## 9. Launch Readiness screen

Open `/admin/launch-readiness` and resolve all remaining gates. The screen intentionally distinguishes configuration readiness from real production traffic.

## 10. Launch decision

Launch publicly only when all of the following are true:

- exact release commit has a green GitHub workflow
- persistent Vercel project exists
- verified production domain is serving the app
- production environment variables are installed
- Supabase Auth production URLs are configured
- first Super Admin is bootstrapped
- final Skylight logo is installed
- live browser smoke test passes
- Supabase security advisor remains at zero unresolved security lints
- no fake verification/review/sponsorship/lead data has been introduced

## 11. Post-launch first 24 hours

Monitor:

- Vercel runtime errors and 5xx responses
- `/api/health`
- Supabase security advisor
- incoming claims/submissions/reports/media
- lead routing
- search zero-result patterns
- listing analytics collection
- sitemap/robots host correctness

Any production incident involving authorization, verification, data isolation, or incorrect paid-placement disclosure should block growth work until resolved.
