# Preview deployment infrastructure status

Last updated: November 4, 2026

## Git-connected Cloudflare Pages project

- Project: `roof-solar-toolkit-2026`
- Repository: `Abhish3kJa1n/us-roof-solar-toolkit-2026` (repository is currently public)
- Preview branch: `audit/stage1-20261103`
- Production branch: `main`
- Build command: `sh scripts/prepare_deploy.sh`
- Build output: `dist`
- Pages Functions: enabled; routes are limited to `/api/*`
- Latest Preview commit: `d39a24ec874460322d583c7a6468c3764a098b05`
- Latest deployment: https://685c6521.roof-solar-toolkit-2026.pages.dev
- Branch alias: https://audit-stage1-20261103.roof-solar-toolkit-2026.pages.dev
- Deployment build and deploy stages: successful
- Production deployment automation: disabled
- Custom domains on this project: none

## D1 quota guard

- Database: `roof-solar-api-quota`
- Binding: `API_QUOTA_DB`
- Database ID: `2128d4c7-1031-4029-9629-d6e1abb602d1`
- Migrations applied: `migrations/0001_create_api_quota.sql` and `migrations/0002_add_census_suggest_quota.sql`
- The `api_quota` table was verified in the live database. It stores aggregate quota counters, not visitor identifiers, city names or coordinates.
- `API_QUOTA_DB` is bound in both Preview and Production configurations. This does not mean Production is ready: provider secrets are absent there.

## Preview secrets and live verification

The following server-side Cloudflare Preview secrets are configured:

- `PVWATTS_API_KEY`
- `OPENEI_API_KEY`

Cloudflare masks secret values in its configuration response. Their presence in the configuration is not, by itself, proof that they work. The November 4, 2026 live Preview smoke test supplied that proof:

- Census ACS2026 autocomplete: PASS; returned Austin, TX.
- Exact Census place lookup: PASS; returned representative coordinates 30.2986219, -97.7541339.
- NLR PVWatts V8: PASS; returned 1,483 kWh/year for the 1 kW DC Austin smoke-test scenario.
- OpenEI URDB: PASS; returned 49 nearby residential tariff candidate records for the Austin test location.
- The OpenEI records are candidates for manual verification, not proof of the homeowner's utility, service territory, active tariff or applicable rate. No candidate is applied automatically to savings.

The live smoke script printed `LIVE PREVIEW SMOKE TEST COMPLETED.` The GitHub Actions job steps and logs show successful completion, and the local QA job printed `ALL LOCAL QA CHECKS PASSED.` At the time this document was updated, the GitHub workflow API still reported run #147 as `in_progress` with no final run conclusion despite all listed steps having completed successfully. Do not describe the workflow as formally completed until GitHub records its final conclusion.

## Existing custom-domain project — separate from the Git-connected Preview

The Cloudflare zone for `getroofsolarcalculator.online` is active and uses Cloudflare nameservers. However, both `getroofsolarcalculator.online` and `www.getroofsolarcalculator.online` are currently attached to a different Pages project:

- Legacy project: `roofcalc`
- Deployment style: ad-hoc/static upload, not connected to the current GitHub repository
- Pages Functions: not enabled
- Latest production deployment recorded: October 31, 2026

The new `roof-solar-toolkit-2026` project has no custom domain attached. The public domain therefore does not currently serve this new Git-connected Preview project. Do not remove the old project's domain, change DNS, attach the domain to the new project or enable Production as part of ordinary Preview QA. A deliberate cutover and rollback plan is required.

## Release status

This is a live, isolated Preview with working Census, PVWatts and OpenEI integrations. It is not a production launch. Keep the current noindex controls, draft PR and disabled Production deployments until price-data, browser/accessibility, editorial/legal, analytics/ad-network and domain-cutover gates are addressed.
