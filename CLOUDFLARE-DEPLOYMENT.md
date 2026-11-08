# Cloudflare Pages deployment runbook

**Current host and verified state (November 8, 2026):** Cloudflare Pages Git integration is active for `Abhish3kJa1n/us-roof-solar-toolkit-2026` on project `roof-solar-toolkit-2026`, with `main` as the Production branch. Latest Production deployment: merge commit `36c010129f92c4aca5c93b1a5929a1c93064deeb`, Cloudflare deployment `3f237f8e-6def-4c6a-955e-32c77a64a34b`, status active; both `https://getroofsolarcalculator.online` and `https://www.getroofsolarcalculator.online` are attached and report active domain/HTTP validation. Build command is `sh scripts/prepare_deploy.sh`, output is `dist`, root is `/`. Three Pages Functions handle Census place lookup, PVWatts and OpenEI candidate discovery. All require the shared D1 quota binding; PVWatts/OpenEI also require server-side keys. Live Production tests on November 8 confirmed the signed Census -> PVWatts/OpenEI path before the PR #20 Census-resilience changes. PR #20's revised lookup passed six-place integration testing on Preview. The updated runtime was also re-tested against Production in CI run #647: Austin exact Census lookup issued a signed proof; PVWatts V8 returned 1,483 kWh/year for 1 kW DC, 12 valid monthly values and a weather station 1.03 miles away; OpenEI returned 49 nearby candidates. No secrets or proof tokens were logged. This is one representative city, not national coverage or tariff validation. Preview and Production share D1 database `2128d4c7-1031-4029-9629-d6e1abb602d1`; counters are aggregated, so environment-level attribution is unavailable. Do not change that binding without a tested migration/rollback plan. The source contains the AdSense ownership meta tag, root `ads.txt` and a guarded AdSense bootstrap in Pages middleware. Production ad serving remains disabled: the `ADSENSE_ENABLED` runtime variable is not configured, and Production HTML routing remains API-only unless the separate build-time `ADSENSE_MIDDLEWARE_ENABLED=true` switch is set. No manual ad-slot IDs are defined in source; Auto ads dashboard state has not been independently checked. Cloudflare Web Analytics is configured at project level.

## Why this hosting choice

Cloudflare Pages supports plain static HTML, GitHub/GitLab deployments, preview deployments, custom domains, and project-level HTTP headers. The current Free-plan documentation (checked October 31, 2026) lists 500 builds per month, up to 20,000 site files and a 25 MiB per-file limit; this project is far below those limits. Limits can change, so recheck the live documentation before deployment. Git integration cannot later be switched to Direct Upload for the same Pages project; choose the deployment mode deliberately.

Official documentation:

- Static HTML deployment: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
- Custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Custom headers: https://developers.cloudflare.com/pages/configuration/headers/
- Limits: https://developers.cloudflare.com/pages/platform/limits/

## Before you deploy

**For this existing project, deployment and domain attachment are already configured.** Do not create another Pages project, re-attach the custom domains, change DNS, create a second D1 database or switch deployment mode as part of routine work. Use `OWNER-LAUNCH-CHECKLIST.md` and `PREVIEW-DEPLOYMENT-STATUS.md` for the current operational state.

For a new or replacement environment only: complete owner-side identity, contact, legal and technical gates first; keep secrets out of Git/client code; test on Preview before Production; and remember that the main-branch Production build is indexable while Preview stays noindex. The guarded AdSense bootstrap is already staged in source but remains inactive in Production. Keep the Production route opt-in and runtime `ADSENSE_ENABLED` switch off until Google approval and owner-side privacy, consent/opt-out and legal gates are complete. Cloudflare Web Analytics is configured separately at project level.

## Connect GitHub to Cloudflare Pages

1. Sign in to Cloudflare and open **Workers & Pages**.
2. Choose **Create application → Pages → Connect to Git**.
3. Authorize access only to the repository you intend to deploy.
4. Select the new repository and production branch `main`.
5. For this plain static HTML project, use:
   - Framework preset: **None**
   - Build command: `sh scripts/prepare_deploy.sh`
   - Build output directory: `dist`
   - Root directory: `/` (the repository root)
6. Deploy. Cloudflare provides a `*.pages.dev` preview/production hostname.

The repository root is **not** the public document root. The build script creates `dist/` containing only visitor-facing HTML, CSS, JavaScript, source data, `robots.txt`, `_headers` and `_routes.json`. It deliberately excludes QA scripts, internal Markdown research records, migrations and owner-only checklists. The `/functions` directory remains at repository root so Cloudflare Pages can compile the three Pages Functions while serving static files from `dist/`. This project does not need `package.json`, `package-lock.json`, `npm install` or a Node build step; the build command is a dependency-free shell script. Do not use `.` as the build output directory.

Cloudflare currently cautions that a Git-integrated Pages project cannot later be switched to Direct Upload. Pick Git integration only if you are comfortable maintaining the site through the repository. This project is small enough that Git integration is the cleaner long-term path.

### Alternative: Direct Upload with Wrangler CLI

Use this only if you prefer manual deployments and accept that a Direct Upload Pages project cannot later be converted to Git integration. From the repository root, build the clean static output and deploy it with Wrangler:

```bash
sh scripts/prepare_deploy.sh
npx wrangler pages project create
# Follow the prompts once; use a project name such as roof-solar-toolkit.
npx wrangler pages deploy dist --project-name roof-solar-toolkit --branch=main
```

Run the deploy command from the repository root, not from inside `dist/`, because Wrangler must see the sibling `/functions` directory to upload and compile Pages Functions. Cloudflare's dashboard drag-and-drop ZIP/folder upload does **not** compile a `/functions` directory; do not use it for this build. Wrangler Direct Upload supports the Functions directory when run from the project root. Official references: [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) and [Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/).

## Preview domain: keep it noindex

The package includes a custom `404.html` page. Cloudflare Pages serves this file for missing routes; it remains `noindex` and is intentionally excluded from the generated sitemap.

The HTML pages all contain `noindex,follow`. `_headers` also adds an `X-Robots-Tag: noindex, follow` response header to all files. This is deliberate for pre-launch previews. Do not remove it merely because the preview URL is live.

Review the preview at desktop and mobile widths. Test every calculator in a real browser, check the browser console, verify all links, and inspect the response headers. A `pages.dev` preview is not the final canonical domain.

## Add the production domain (completed for this project)

The apex and `www` hosts are already attached to `roof-solar-toolkit-2026`; Cloudflare reports both as Production aliases. Do not re-attach DNS/Pages domains, create a replacement project, or change the registrar/nameservers as part of routine work. The normal-browser custom-domain path, canonical redirect and Analytics beacon delivery still need human-browser checking. Read-only headless Chromium was challenged on the apex hostname and remained on `Just a moment...` after 30 seconds; the test did not establish whether ordinary visitors are blocked. Read-only zone settings on November 8: Browser Integrity Check `on`, Bot Fight Mode `true`, Security Level `medium`, Challenge Page TTL `1800` seconds. The exact trigger is not isolated. No Cloudflare protection setting was changed. Trademark clearance remains a separate owner/legal task.

For a genuinely new replacement environment, create a separate cutover plan with owner approval, an explicit rollback route, HTTPS/certificate checks and canonical-host verification before moving traffic. These are not outstanding setup steps for the current project.

## Configure canonical URLs safely

The script `scripts/configure_site.py` automates canonical URL insertion and later sitemap creation.

**Current project status:** the `main` build already publishes `index,follow` for public pages, removes the noindex response header and copies the 24-URL sitemap. Preview builds retain noindex. On November 8, 2026 the stable Production Pages hostname passed live crawler-response checks. Do not rerun either configuration command or revert indexing blindly. If a future, evidence-based decision requires suppressing indexing, create and test a dedicated change with an explicit rollback plan. The generic commands below describe a new site only.

## Security headers included

`_headers` applies the current enforced production security policy:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- restrictive `Permissions-Policy`
- restrictive CSP with `script-src 'self'` plus the exact Cloudflare Web Analytics beacon script URL; `connect-src` includes same-origin and the Cloudflare telemetry endpoint

Production has no `X-Robots-Tag: noindex`; the Production build makes public pages indexable. Preview public HTML routes use the nonce middleware, while `/api/*` remains an explicit bypass. On guide and EIA reference routes, the middleware enforces nonce-based strict CSP and also emits a separate report-only candidate policy; other HTML routes retain the current enforced CSP. Every transformed HTML response receives a fresh nonce and `private, no-store` cache controls; Preview remains noindex. The guarded AdSense loader is limited to guide and EIA reference routes, requires HTTPS, an exact production custom-domain host and the runtime `ADSENSE_ENABLED=true` switch. Preview `pages.dev` hosts are not eligible. Production must also be separately opted into middleware routing with the build-time `ADSENSE_MIDDLEWARE_ENABLED=true` switch; both switches must remain off until Google approval and the owner privacy/consent/legal gates are complete. Do not replace CSP with a broad Google-domain allowlist.

Cloudflare's default serving behavior and custom header support can change. Verify actual response headers after deployment with browser developer tools or a header scanner. HSTS is deliberately not included in this pre-launch file.

The project includes a first-party SVG favicon. The local QA script checks stylesheet, script and icon paths before deployment.

## Remaining Production launch work

1. Complete real owner identity and monitored privacy/editorial contact details. No identity or address should be invented.
2. Clear the working brand through proper USPTO/common-law review and obtain qualified advice as needed.
3. Add genuine author bylines and obtain qualified roofing/PV review. Do not fabricate qualifications or review dates.
4. Independently validate solar model assumptions against representative utility tariffs and bills; OpenEI returns candidates, not confirmed tariffs. Validate roof cost references against comparable written proposals and measured examples.
5. Complete qualified privacy, advertising, IP/copyright, accessibility and applicable U.S. state-law review. Determine whether opt-out/GPC controls are required before activating targeted advertising.
6. In a normal browser, verify both custom hosts, HTTPS, canonical redirects and Browser Integrity Check behavior. The automated runner receives a challenge.
7. Submit the published sitemap to Search Console if not already submitted, then monitor real index coverage. An indexable build and a sitemap do not prove indexing.
8. The owner reports AdSense site review submission; approval remains unverified. Keep both AdSense activation switches off. After approval and completion of privacy/consent/legal gates, choose manual ad placements with actual ad-unit IDs or deliberately enable Auto ads in the AdSense dashboard, then test editorial-page layout/performance before broader rollout. The repository does not define manual ad-slot IDs; the dashboard Auto ads state has not been independently verified.
9. Measure field Core Web Vitals after traffic exists and continue monitoring Pages Functions/D1 usage. Preview and Production share the D1 quota database.

**Important:** deployment success is not legal approval, Google indexing, AdSense approval, evidence of search demand or an income forecast.



## Pages Functions: Census place lookup, PVWatts and tariff candidates

The repository now contains a root-level `functions/` directory:

- `functions/api/location.js` maps `/api/location?city=Austin&state=TX` to the US Census Bureau TIGERweb ACS2026 service (January 1, 2026 vintage). It queries Incorporated Places (layer 28) and Census Designated Places (layer 30) and returns representative place points, not an address or rooftop coordinate. When a provider secret is available, exact place results also receive a 24-hour HMAC-signed location proof.
- `functions/_shared/location-token.js` creates and verifies the signed proof. It uses a domain-separated HMAC-SHA256 key derived from the server-side `LOCATION_TOKEN_SECRET` if set, otherwise from the PVWatts or OpenEI secret. No secret or signing key is returned to the browser.
- `functions/api/pvwatts.js` maps `/api/pvwatts?...` to the NLR PVWatts V8 API. It requires a signed proof matching the exact submitted latitude, longitude and state before reserving quota or calling NLR. The NLR key is read from `env.PVWATTS_API_KEY` and never returned to the browser.
- `functions/api/tariffs.js` maps `/api/tariffs?...` to OpenEI URDB. It applies the same proof check before reserving quota or calling OpenEI. Its results are nearby residential tariff *candidates*, not proof of the homeowner's utility or rate plan.

`_routes.json` deliberately invokes Functions only for `/api/*`. This matters for zero-cost hosting: Cloudflare says static asset requests are free and unlimited, while Function invocations count against the Workers Free daily quota. Cloudflare documentation last updated October 29, 2026 lists 100,000 Workers requests per day on the Free plan, shared across Workers and Pages Functions, with a 10 ms CPU time limit per invocation. This is an account-level limit and can change. Do not remove `_routes.json` or expand its include pattern casually. A static HTML/CSS/JS request should not invoke these Functions. Check the live limits before deployment.

### API secrets (current Production and Preview state)

The Census place resolver needs no provider secret, but all three API routes fail closed until the shared D1 quota binding is available. PVWatts and OpenEI additionally require their respective provider keys. The current Pages project has the D1 binding and server-side provider keys in both Preview and Production. The November 8, 2026 live Production smoke passed exact Census city/state lookup, signed location-proof validation, NLR PVWatts V8 and OpenEI URDB requests before the later PR #20 Census-resilience changes. PR #20's updated code passed six-place Preview integration checks. A post-merge Production API smoke then passed in CI run #647 for Austin, TX: exact Census lookup and signed proof issuance, PVWatts output of 1,483 kWh/year per 1 kW DC with a 1.03-mile station distance, and 49 OpenEI candidate records. The proof is issued only after exact Census verification; PVWatts and OpenEI reject arbitrary or altered coordinates before reserving D1 quota or calling upstream providers. Production test values were not logged. Preview and Production share the same D1 database ID, so quota counters aggregate both environments. The numbered steps below describe creation of a genuinely new/replacement environment, not outstanding setup for the current Pages project:

1. Create a D1 database named `roof-solar-quota` in **Workers & Pages → D1**. Because the site targets U.S. visitors but the owner may create it from India, set a U.S. primary-location hint (start with `ENAM` as a provisional default) rather than blindly accepting a creator-nearby location. Cloudflare says location hints are best-effort and should reflect where most database writes originate; they cannot guarantee the chosen region. D1 has a free allowance; check current pricing/limits before use.
2. Open the new database's SQL console and execute `migrations/0001_create_api_quota.sql`, then `migrations/0002_add_census_suggest_quota.sql` in that order. The second migration adds the separate autocomplete scope while preserving the earlier counters. The table stores aggregate counters only; it does not store IP addresses, city names, coordinates or visitor identifiers.
3. In **Workers & Pages → your Pages project → Settings → Bindings → Add → D1 database binding**, set the variable name to exactly `API_QUOTA_DB`, select `roof-solar-quota`, and save. Configure both Preview and Production environments as applicable, then redeploy for the binding to take effect.
4. Only after the D1 binding is present, add `PVWATTS_API_KEY` as a server-side **secret** in the Preview environment. Add `OPENEI_API_KEY` only if tariff-candidate discovery is wanted. Do not expose either key as a public variable.
5. Never place a real key in HTML, browser JavaScript, Git, this ZIP, or a public issue. `.dev.vars.example` contains placeholders only. For local development, create a local D1 binding named `API_QUOTA_DB`, apply the same migration to that local database, copy `.dev.vars.example` to `.dev.vars`, and add the test keys. Cloudflare documents Pages local D1 bindings through a Wrangler configuration file; local D1 is separate from the remote database.
6. In **Workers & Pages → your Pages project → Settings → Runtime → Fail open / closed**, choose **Fail open** for this non-critical calculator site so static pages remain available if the Free Functions daily quota is exhausted; API-backed features may temporarily fail.
7. The mocked local suite and a limited live Preview smoke test have been run. On November 4, 2026 the Preview passed Census autocomplete/exact lookup, NLR PVWatts V8 and OpenEI URDB; OpenEI returned 49 nearby residential tariff candidates for Austin, TX. The Census place route needs no provider secret but requires the shared D1 binding. PVWatts and OpenEI each require the shared D1 binding and their own server-side provider key. No tariff is automatically selected or used for payback. Repeat the live smoke test after any API code, secret or binding change.

Cloudflare Pages Functions count as Workers requests. Current Free-plan documentation lists 100,000 shared requests/day and a 10 ms CPU limit per invocation; D1 Free currently lists 100,000 rows written/day, 5 million rows read/day and 5 GB total storage. The quota guard caps this site at 10,000 exact Census lookups, 20,000 Census autocomplete searches, 15,000 PVWatts and 5,000 OpenEI reservations/day (50,000 total), leaving headroom under the published D1 write allowance. Keep Functions limited to `/api/*`, monitor dashboard usage, and recheck limits before launch. If the D1 binding, database or an endpoint quota is unavailable, all API routes intentionally fail closed; static pages remain available. No paid upgrade is authorized or needed for this design at current stated limits.

Local mocked tests can be run without keys or network access:

```bash
python scripts/test_location_api.py
python scripts/run_all_checks.py
```

A local static web server such as `python -m http.server` will **not** execute Pages Functions. Use `npx wrangler pages dev` with a local D1 binding and migration to test all three API routes and their quota behavior. Cloudflare notes that local D1 is separate from the remote database; local Pages development cannot directly test the remote D1 binding. A real PVWatts or OpenEI integration test still requires the owner to provide the corresponding secret and network access.

### Before using outputs commercially

- Test PVWatts V8 against the NLR calculator using the same coordinates and all model inputs. The source uses typical meteorological year data and does not inspect the property.
- Compare the selected OpenEI candidate with the homeowner's exact current utility tariff document. Census place-point proximity is not a service-territory test.
- Review NLR and OpenEI API terms, free-key limits, storage/cache provisions and commercial use.
- Review the Census TIGERweb service terms, data product vintage, attribution expectations and any applicable Census API usage guidance before redistributing a derived location dataset.
- Re-test all endpoints, error paths, cache behavior and privacy disclosures after deployment.


## Current Pages Production and Preview configuration — November 8, 2026

- Project: `roof-solar-toolkit-2026`; repository: `Abhish3kJa1n/us-roof-solar-toolkit-2026`; Production branch: `main`.
- Current Production merge commit: `36c010129f92c4aca5c93b1a5929a1c93064deeb`; Cloudflare deployment `3f237f8e-6def-4c6a-955e-32c77a64a34b` reports an active successful deployment, with both apex and `www` domains attached and validated active.
- Stable Pages-hostname public smoke passed the homepage, 24 sitemap URLs, canonical/indexable metadata, security headers, `ads.txt`, `robots.txt`, sitemap, real 404, API validation and internal-file-isolation checks. Apex/`www` non-browser HTTP requests and headless Chromium received Cloudflare's browser challenge; Chromium remained on the challenge page after 30 seconds. This is not evidence that normal Chrome users are blocked. Browser Integrity Check is on, Bot Fight Mode is enabled and Security Level is medium; the trigger is not isolated.
- Production `_routes.json` remains limited to `/api/*`; the HTML nonce middleware is not enabled on Production. Preview builds route public HTML through nonce middleware; eligible guide/EIA pages enforce strict nonce CSP and also emit a report-only candidate policy. Preview stays noindex and the AdSense loader remains off on pages.dev hosts.
- `API_QUOTA_DB` is bound in both environments to the same D1 database ID `2128d4c7-1031-4029-9629-d6e1abb602d1`. Production and Preview provider credentials are held as Cloudflare secrets. The November 8 Production API smoke confirmed they work without exposing secret values.
- `index.html` contains the publisher verification meta tag and root `ads.txt` contains the matching publisher record. The guarded AdSense bootstrap exists in source but is not active in Production; no manual ad-slot IDs are defined, and dashboard Auto ads status is unverified. Cloudflare Web Analytics is configured at project level; Production custom-domain beacon behavior still needs normal-browser verification; the headless Chromium attempt could not reach the page because of the Cloudflare challenge. Google approval and owner-side privacy/consent/legal gates remain outstanding.
- PR #16's full local QA suite, dedicated Chromium calculator regression and live Production public smoke passed on November 8. PR #18's four-city live Production Census -> signed proof -> PVWatts/OpenEI sample also passed. PR #20 then passed all 22 project checks, the six-place Preview Census -> signed proof -> PVWatts/OpenEI sample (including Anchorage and Urban Honolulu), and the separate Production public-page/custom-domain edge smoke. PR #20's six-place API validation was Preview-only; a separate post-merge Production check in CI run #647 verified Austin exact Census lookup, signed proof, PVWatts and OpenEI. These small samples do not establish national coverage or tariff accuracy. Real devices, assistive technologies, normal-browser custom-domain behavior and successful Production `/cdn-cgi/rum` telemetry remain separate manual checks.



## API quota hardening — implemented for provider proxies

NLR documents a default limit of 1,000 requests per API key per rolling hour. A public PVWatts proxy must not rely on a per-IP rate rule alone: Cloudflare Free rate-limit counters are IP-based and local to data centers, so many different visitors can still collectively consume the same upstream key. The project therefore reserves each PVWatts request in a shared D1 counter **before** contacting NLR and fails closed if the database is missing, unavailable or at its cap. The same table applies separate site-side caps to Census place lookups and OpenEI tariff-candidate requests.

The included SQL guard allows at most 180 PVWatts requests per fixed 15-minute bucket. Any rolling 60-minute interval can overlap at most five such buckets, so the application-level ceiling is 900 requests/hour, leaving 100 requests of headroom under NLR's documented 1,000/hour limit. It also caps PVWatts reservations at 15,000 per UTC day. Exact Census lookups have a site cap of 60 per 15 minutes / 10,000 per UTC day; Census autocomplete has a separate 120 per 15 minutes / 20,000 per UTC day cap; OpenEI candidates have 60 per 15 minutes / 5,000 per UTC day. These are application caps, not provider-published Census/OpenEI numeric limits. The code stores up to four aggregate scope rows with no visitor identifiers. D1 writes go to its primary database instance; Cloudflare describes each D1 database as single-threaded, so this counter adds one serialized write per API request and its physical location affects round-trip latency for the U.S. audience. OpenEI documentation reviewed does not specify a numeric public API quota, so this project applies a separate conservative cap of 60 requests per 15-minute bucket and 5,000 per UTC day; these are our application limits, not OpenEI-published limits. This is not a guarantee against unrelated use of the NLR key; dedicate that key to this site. D1 must be configured and the migration applied before either provider key is added.

Optional Cloudflare WAF rate limiting for `/api/*` can provide secondary per-IP abuse resistance, but Free-plan counters are per-IP and data-center-local. It is **not** the global key quota guard and does not replace D1. WAF rules can also block legitimate shared-IP users, so test thresholds before use.

Current published Free limits checked November 1, 2026: Workers/Pages Functions 100,000 requests/day; D1 100,000 rows written/day, 5 million rows read/day and 5 GB total storage. The combined application daily caps are below the D1 write allowance. Monitor actual usage and recheck Cloudflare's live plan terms before launch. Never place NLR or OpenEI keys in browser JavaScript or commit real `.dev.vars` files.

Official references: [Cloudflare D1 data location and primary-location hints](https://developers.cloudflare.com/d1/configuration/data-location/), [Cloudflare D1 throughput and single-threaded limits](https://developers.cloudflare.com/d1/platform/limits/), [NLR PVWatts V8 rate limits and station-distance units](https://developer.nlr.gov/docs/solar/pvwatts/v8/), [Cloudflare Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/), [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cloudflare Workers request limits](https://developers.cloudflare.com/workers/platform/limits/), and [Cloudflare rate-limit counter behavior](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/).

The PVWatts proxy requests a climate data station within 100 miles rather than asking NLR to use the nearest station regardless of distance. The returned station distance is documented by NLR in metres and is converted to miles in the visitor interface. Mock tests and a local SQLite simulation verify guard logic, the 100-mile search parameter and unit conversion; live D1, NLR service, abuse behavior and cross-edge concurrency have **not** been tested.
