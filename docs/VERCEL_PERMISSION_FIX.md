# Vercel Permission Fix

Vercel documentation confirms that deployment/project capabilities are controlled by team role/permissions. Updating team member roles requires an OWNER-level Vercel identity. Relevant permissions include `CreateProject` and `FullProductionDeployment`.

For the connected team `rhovel89's projects`, the current integration receives HTTP 403 for both Preview and Production deployment creation.

## Fix in Vercel

Use a Vercel team Owner account to ensure the account connected to ChatGPT/Vercel has permission to create projects/deployments in the team. If the team role is already correct, reconnect the Vercel integration afterward so the connection is reauthorized.

Once corrected, retry in this order:

1. Create/deploy Preview for `central-il-local-pros`.
2. Confirm Vercel readback shows the project/deployment.
3. Run live preview smoke tests.
4. Deploy/promote Production.
5. Configure final domain and `NEXT_PUBLIC_SITE_URL`.

Do not weaken application security or alter the validated runtime to work around a Vercel account permission error.
