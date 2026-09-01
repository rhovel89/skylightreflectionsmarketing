# External Launch Actions — Central Illinois Local Pros V15.5

Application code is complete and validated. The remaining steps require account-level actions that the current connected tool permissions cannot complete.

## 1. Vercel permission

The connected Vercel identity can read the team but receives HTTP 403 for both production and preview deployment creation for `central-il-local-pros`.

Required account action:
- Ensure the connected Vercel account has a role in `rhovel89's projects` that can create projects/deployments.
- If that role is already correct, reconnect the Vercel integration so the connector receives deployment-capable authorization.

After permission is fixed, deploy `central-il-local-pros-v15.5` and verify readback before promotion.

## 2. Production domain

After a persistent deployment exists:
- assign the final production domain
- set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS origin
- redeploy

## 3. Supabase Auth URLs

The current Supabase connector has no Auth Site URL/redirect mutation action. Configure the final production origin in the Supabase Auth URL settings once the public domain is known.

## 4. First Super Admin

Create the owner's real account through production `/login`. Use the exact resulting `auth.users.id` UUID with `supabase/v15_5_bootstrap_first_super_admin.sql`. Never create a fake/bootstrap identity or make first signup automatically privileged.

## 5. Skylight logo

The existing Canva source has been located:
- title: `Skylight Reflections Marketing`
- design ID: `DAGkw1OgHJE`

Export/select the correct durable website-safe logo/wordmark from that source and install it through Site Builder. Do not use the separate Skylight Homestead Concepts brand board.

## 6. Live E2E verification

After deployment/auth/branding are configured, execute `LAUNCH_RUNBOOK.md` and close GitHub Issue #1 only after the live site passes.
