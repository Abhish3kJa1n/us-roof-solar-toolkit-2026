# Preview deployment infrastructure status

Last updated: 2026-11-03

## Cloudflare Pages

- Project: `roof-solar-toolkit-2026`
- Preview branch: `audit/stage1-20261103`
- Production branch: `main`
- Build command: `sh scripts/prepare_deploy.sh`
- Build output: `dist`
- Production deployments: disabled pending review
- Custom domain: not attached; preview uses the `pages.dev` hostname

## D1 quota guard

- Database: `roof-solar-api-quota`
- Binding: `API_QUOTA_DB`
- Region hint: western North America
- Migration: `migrations/0001_create_api_quota.sql`
- The aggregate-only `api_quota` table was applied and verified on 2026-11-03.

## Secrets

- Preview secret name: `PVWATTS_API_KEY`
- Secret value is stored in Cloudflare and must never be committed to this repository.
- Production secret remains unconfigured until preview testing passes.

## Release status

The infrastructure is configured for an isolated preview. This document does not assert that a Pages deployment has completed or that live upstream API requests have passed. Those checks must be completed before production release.
