# Central Illinois Local Pros — Production Deployment Runbook

## Canonical application

- Vercel project: `central-il-local-pros`
- Canonical public URL: `https://central-il-local-pros.vercel.app`
- Intended production branch: `central-il-local-pros-v15.5`
- GitHub repository: `rhovel89/skylightreflectionsmarketing`
- Supabase project: `zbsdbqdvmlatlklwjiuh`

## Required Vercel model

Central Illinois Local Pros should use both **Production** and **Preview** environments.

### Production

Only the approved application branch `central-il-local-pros-v15.5` should automatically create Production deployments. The canonical domain must point to the latest healthy Production deployment from this branch.

### Preview

Other branches and pull requests should remain Preview deployments. Preview URLs are used to verify changes before release and should remain protected and/or noindex.

Do not make every Git branch a Production deployment. Do not attach the canonical public domain to Preview deployments.

## Current configuration issue discovered 2026-09-01

The GitHub repository default branch is `main`, while the active production application is maintained on `central-il-local-pros-v15.5`. Vercel is therefore creating healthy builds from V15.5 as Preview deployments with `target: null` rather than automatically moving production traffic.

## Corrective action

In Vercel project settings, set the Git **Production Branch** to:

`central-il-local-pros-v15.5`

Then promote the latest verified READY V15.5 deployment once if necessary. After this is corrected, future commits to V15.5 should use the normal production workflow, while all other branches remain Preview.

## Environment variables

Environment variables and deployment environments are separate concepts.

- Production variables must be available to Production.
- Preview variables may also be enabled when Preview deployments need to run the application for QA.
- Do not remove Preview access merely to force a deployment into Production.
- This project currently uses the existing Supabase project; do not create a second database solely to solve the Vercel branch-target problem.
- Preview deployments must not be used for destructive or fabricated production-data testing.

## Release verification checklist

Before considering a release complete:

1. Latest V15.5 deployment is READY.
2. Deployment target is Production, not `null`.
3. `https://central-il-local-pros.vercel.app/api/health` returns healthy database status.
4. Canonical homepage returns HTTP 200.
5. `/guides` and a newly published guide return HTTP 200.
6. `/terms`, `/claim`, and `/list-your-business` resolve correctly.
7. No new production runtime error clusters appear.
8. Canonical production pages are indexable only where intended; Preview deployments remain noindex.

## Directory integrity

Deployment changes must not alter directory trust rules. Never fabricate claimed/verified state, ratings, reviews, leads, transactions, sponsorships, testimonials or operational events. Sponsored placement remains separate from organic relevance.

## Configuration status — 2026-09-01

Vercel Production Branch Tracking was corrected to `central-il-local-pros-v15.5`. Preview remains assigned to all unassigned Git branches and Development remains CLI-only. This is the approved environment model for the project.