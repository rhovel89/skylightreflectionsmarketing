# Vercel Deployment Permission Gate

Checkpoint: 2026-09-01

Central Illinois Local Pros V15.5 is application-ready and passes the locked CI/build/runtime smoke-test gate. Deployment attempts through the connected Vercel identity established the following external permission boundary.

## Connected team

- Team: `rhovel89's projects`
- Team ID: `team_tHPVB7CEdukrVFxaP8vNxuV4`
- Project/deployment name requested: `central-il-local-pros`

## Verified deployment behavior

An initial deployment call without an explicit team binding returned an initializing deployment ID and URL, but Vercel's project/deployment read APIs could not subsequently resolve either resource. It is therefore treated as unverified and not live.

When the team was explicitly bound, both production and preview deployment attempts returned HTTP 403 permission errors:

- Production: connected identity does not have permission to create a Production Deployment for this project.
- Preview: connected identity does not have permission to create a Preview Deployment for this project.

Do not represent the application as deployed until a Vercel deployment can be created and read back from the selected team.

## Required resolution

1. Confirm the Vercel connection is authorized with a team role that can create deployments/projects in `rhovel89's projects`.
2. Reconnect/repair the Vercel integration if the correct account owns the team but the connector lacks deployment permission.
3. Create/import `rhovel89/skylightreflectionsmarketing` as `central-il-local-pros`.
4. Use `central-il-local-pros-v15.5` as the initial production source.
5. Deploy preview first and verify it through Vercel readback.
6. Promote/deploy to production only after preview verification.

The application itself should not be modified to work around this account-level permission gate.
