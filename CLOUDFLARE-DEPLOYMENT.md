# Cloudflare Pages deployment runbook

**Recommended host for this mostly static build:** Cloudflare Pages, using Git integration. This is a recommendation, not an account setup or a completed deployment. Most pages are static HTML/CSS/JavaScript; three optional Pages Functions provide Census city/state place lookup, PVWatts production modelling and nearby utility-tariff candidate discovery. All three API routes require one small Cloudflare D1 database for shared request-quota guards. Census place lookup needs no provider secret; PVWatts and OpenEI each require their own server-side provider secret. Every route fails closed until D1 and its migration/binding are configured; the PVWatts and OpenEI routes also require their respective keys.

## Why this hosting choice

Cloudflare Pages supports plain static HTML, GitHub/GitLab deployments, preview deployments, custom domains, and project-level HTTP headers. The current Free-plan documentation (checked October 31, 2026) lists 500 builds per month, up to 20,000 site files and a 25 MiB per-file limit; this project is far below those limits. Limits can change, so recheck the live documentation before deployment. Git integration cannot later be switched to Direct Upload for the same Pages project; choose the deployment mode deliberately.

Official documentation:

- Static HTML deployment: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
- Custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Custom headers: https://developers.cloudflare.com/pages/configuration/headers/
- Limits: https://developers.cloudflare.com/pages/platform/limits/

## Before you deploy

1. Complete the publisher section in `OWNER-LAUNCH-CHECKLIST.md`.
2. Create a private GitHub repository for the site. Keep the project files at the repository root; do not upload the parent directory containing unrelated files.
3. Review the entire site and its policy drafts. The current build is intentionally `noindex` and the `_headers` file also sends `X-Robots-Tag: noindex, follow`.
4. Do not add AdSense, analytics, affiliate scripts, a CMP or other third-party code yet. The current Content Security Policy only allows the current first-party site code.

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

## Add the production domain

1. Complete trademark clearance before using the brand commercially. The owner has already registered `getroofsolarcalculator.online` through Hostinger; it is not yet connected to Cloudflare. Do not buy another domain or transfer the registration as part of this setup.
2. In Cloudflare Pages, open the project → **Custom domains → Set up a domain**. Do this in the Pages dashboard; do not only create a DNS CNAME manually.
3. For an apex domain, Cloudflare requires the domain to be a zone in that Cloudflare account and its nameservers to point to Cloudflare. For a subdomain, use the CNAME target shown by the dashboard.
4. Choose one canonical host (`example.com` or `www.example.com`) and redirect the other to it. Do not split indexing signals between both.
5. Confirm HTTPS works for all variants before enabling HSTS. Do not enable HSTS preload or `includeSubDomains` until every covered host is permanently HTTPS-capable.

## Configure canonical URLs safely

The script `scripts/configure_site.py` automates canonical URL insertion and later sitemap creation.

First, configure canonical URLs while retaining noindex:

```bash
python scripts/configure_site.py --domain https://getroofsolarcalculator.online
```

This writes canonical and `og:url` tags but retains `noindex,follow` and does not create `sitemap.xml`.

Only after every gate in `OWNER-LAUNCH-CHECKLIST.md` is complete, intentionally enable indexing:

```bash
python scripts/configure_site.py --domain https://getroofsolarcalculator.online --enable-indexing
```

That command:

- changes every HTML page from `noindex,follow` to `index,follow`;
- removes the global `X-Robots-Tag: noindex` directive from `_headers`;
- creates `sitemap.xml` from the actual HTML files;
- adds the sitemap URL to `robots.txt`.

Do not run the second command before the real publisher identity, legal review, technical review and production checks are complete. If the site is not ready, the safe command is the first one.

## Security headers included

`_headers` adds:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- a restrictive `Permissions-Policy`
- a Content Security Policy with no third-party script, connection, image, font or frame origins; JavaScript is externalized into first-party files and `script-src` does not permit inline scripts
- `X-Robots-Tag: noindex, follow` during pre-launch

The current CSP allows first-party scripts only (`script-src 'self'`); all browser JavaScript is externalized under `assets/js/`. The three API calls are same-origin and the Functions make provider requests server-side, so the browser CSP can remain `connect-src 'self'`. Inline CSS/style attributes remain allowed (`style-src 'self' 'unsafe-inline'`) because the HTML still uses inline styling. No third-party browser scripts, direct browser API calls or ad tags are included. The three Pages Functions call their provider APIs server-side. Before adding ad tags, analytics, CMP scripts, remotely hosted assets, embedded widgets or a third-party API, extend the policy only for the vendors actually selected, prefer nonces/hashes where feasible, and re-test the entire website. Do not copy broad wildcards into the policy.

Cloudflare's default serving behavior and custom header support can change. Verify actual response headers after deployment with browser developer tools or a header scanner. HSTS is deliberately not included in this pre-launch file.

The project includes a first-party SVG favicon. The local QA script checks stylesheet, script and icon paths before deployment.

## Production launch sequence

1. Run `python scripts/run_all_checks.py` locally; resolve every reported issue. This also tests the Pages Function proxies with mocked provider responses and the research scripts with synthetic CSV fixtures.
2. Deploy the preview and run all browser, mobile, keyboard and screen-reader checks.
3. Add the approved custom domain and verify HTTPS and redirects.
4. Run `scripts/configure_site.py` in safe mode with the final canonical domain.
5. Complete and publish the real Privacy Notice, Terms, About, Contact and Editorial Policy.
6. Add genuine author bylines and qualified technical reviewers; do not fabricate credentials or review dates.
7. Add only the analytics, advertising and consent technology that has been selected. Update CSP and privacy disclosures to match.
8. Test consent, opt-out signals, ad rendering, performance and user controls on production.
9. Decide whether the editorial content is genuinely ready for indexing. Only then run the `--enable-indexing` command, submit `sitemap.xml` in Search Console and inspect the index coverage reports.
10. Apply to an ad network only after the site contains substantial original value and the policy pages and consent stack are complete.

**Important:** a technically successful Cloudflare deployment is not legal approval, Google indexing, AdSense approval, evidence of search demand or an income forecast.


## Pages Functions: Census place lookup, PVWatts and tariff candidates

The repository now contains a root-level `functions/` directory:

- `functions/api/location.js` maps `/api/location?city=Austin&state=TX` to the US Census Bureau TIGERweb ACS2026 service (January 1, 2026 vintage). It queries Incorporated Places (layer 28) and Census Designated Places (layer 30) and returns representative place points, not an address or rooftop coordinate.
- `functions/api/pvwatts.js` maps `/api/pvwatts?...` to the NLR PVWatts V8 API. The NLR key is read from `env.PVWATTS_API_KEY` and never returned to the browser.
- `functions/api/tariffs.js` maps `/api/tariffs?...` to OpenEI URDB. Its results are nearby residential tariff *candidates*, not proof of the homeowner's utility or rate plan.

`_routes.json` deliberately invokes Functions only for `/api/*`. This matters for zero-cost hosting: Cloudflare says static asset requests are free and unlimited, while Function invocations count against the Workers Free daily quota. Cloudflare documentation last updated October 29, 2026 lists 100,000 Workers requests per day on the Free plan, shared across Workers and Pages Functions, with a 10 ms CPU time limit per invocation. This is an account-level limit and can change. Do not remove `_routes.json` or expand its include pattern casually. A static HTML/CSS/JS request should not invoke these Functions. Check the live limits before deployment.

### API secrets (only after the owner chooses to enable the endpoints)

The Census place resolver needs no provider secret, but all three API routes fail closed until the shared D1 quota binding is available. PVWatts and OpenEI additionally return a not-configured response until their respective provider key is supplied. The current separate `roof-solar-toolkit-2026` Pages project already has the D1 binding and PVWatts key in Preview; its OpenEI key is still absent. Production deployments remain disabled and neither provider key is configured in Production. The numbered steps below describe a new/manual setup, not outstanding work for the current Preview. Complete them in this order only when creating another environment:

1. Create a D1 database named `roof-solar-quota` in **Workers & Pages → D1**. Because the site targets U.S. visitors but the owner may create it from India, set a U.S. primary-location hint (start with `ENAM` as a provisional default) rather than blindly accepting a creator-nearby location. Cloudflare says location hints are best-effort and should reflect where most database writes originate; they cannot guarantee the chosen region. D1 has a free allowance; check current pricing/limits before use.
2. Open the new database's SQL console and execute the contents of `migrations/0001_create_api_quota.sql`. This creates a small table for per-endpoint aggregate counters; it does not store IP addresses, city names, coordinates or visitor identifiers.
3. In **Workers & Pages → your Pages project → Settings → Bindings → Add → D1 database binding**, set the variable name to exactly `API_QUOTA_DB`, select `roof-solar-quota`, and save. Configure both Preview and Production environments as applicable, then redeploy for the binding to take effect.
4. Only after the D1 binding is present, add `PVWATTS_API_KEY` as a server-side **secret** in the Preview environment. Add `OPENEI_API_KEY` only if tariff-candidate discovery is wanted. Do not expose either key as a public variable.
5. Never place a real key in HTML, browser JavaScript, Git, this ZIP, or a public issue. `.dev.vars.example` contains placeholders only. For local development, create a local D1 binding named `API_QUOTA_DB`, apply the same migration to that local database, copy `.dev.vars.example` to `.dev.vars`, and add the test keys. Cloudflare documents Pages local D1 bindings through a Wrangler configuration file; local D1 is separate from the remote database.
6. In **Workers & Pages → your Pages project → Settings → Runtime → Fail open / closed**, choose **Fail open** for this non-critical calculator site so static pages remain available if the Free Functions daily quota is exhausted; API-backed features may temporarily fail.
7. Run the mocked local suite, then a carefully limited real PVWatts test from Preview. The Census place route works without a provider secret but still requires the shared D1 binding. PVWatts and OpenEI require the shared D1 binding and their own provider keys. No tariff is automatically selected or used for payback.

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


## API quota hardening — mandatory before adding the NLR key

NLR documents a default limit of 1,000 requests per API key per rolling hour. A public PVWatts proxy must not rely on a per-IP rate rule alone: Cloudflare Free rate-limit counters are IP-based and local to data centers, so many different visitors can still collectively consume the same upstream key. The project therefore reserves each PVWatts request in a shared D1 counter **before** contacting NLR and fails closed if the database is missing, unavailable or at its cap. The same table applies separate site-side caps to Census place lookups and OpenEI tariff-candidate requests.

The included SQL guard allows at most 180 PVWatts requests per fixed 15-minute bucket. Any rolling 60-minute interval can overlap at most five such buckets, so the application-level ceiling is 900 requests/hour, leaving 100 requests of headroom under NLR's documented 1,000/hour limit. It also caps PVWatts reservations at 15,000 per UTC day. Exact Census lookups have a site cap of 60 per 15 minutes / 10,000 per UTC day; Census autocomplete has a separate 120 per 15 minutes / 20,000 per UTC day cap; OpenEI candidates have 60 per 15 minutes / 5,000 per UTC day. These are application caps, not provider-published Census/OpenEI numeric limits. The code stores up to four aggregate scope rows with no visitor identifiers. D1 writes go to its primary database instance; Cloudflare describes each D1 database as single-threaded, so this counter adds one serialized write per API request and its physical location affects round-trip latency for the U.S. audience. OpenEI documentation reviewed does not specify a numeric public API quota, so this project applies a separate conservative cap of 60 requests per 15-minute bucket and 5,000 per UTC day; these are our application limits, not OpenEI-published limits. This is not a guarantee against unrelated use of the NLR key; dedicate that key to this site. D1 must be configured and the migration applied before either provider key is added.

Optional Cloudflare WAF rate limiting for `/api/*` can provide secondary per-IP abuse resistance, but Free-plan counters are per-IP and data-center-local. It is **not** the global key quota guard and does not replace D1. WAF rules can also block legitimate shared-IP users, so test thresholds before use.

Current published Free limits checked November 1, 2026: Workers/Pages Functions 100,000 requests/day; D1 100,000 rows written/day, 5 million rows read/day and 5 GB total storage. The combined application daily caps are below the D1 write allowance. Monitor actual usage and recheck Cloudflare's live plan terms before launch. Never place NLR or OpenEI keys in browser JavaScript or commit real `.dev.vars` files.

Official references: [Cloudflare D1 data location and primary-location hints](https://developers.cloudflare.com/d1/configuration/data-location/), [Cloudflare D1 throughput and single-threaded limits](https://developers.cloudflare.com/d1/platform/limits/), [NLR PVWatts V8 rate limits and station-distance units](https://developer.nlr.gov/docs/solar/pvwatts/v8/), [Cloudflare Pages D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/), [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cloudflare Workers request limits](https://developers.cloudflare.com/workers/platform/limits/), and [Cloudflare rate-limit counter behavior](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/).

The PVWatts proxy requests a climate data station within 100 miles rather than asking NLR to use the nearest station regardless of distance. The returned station distance is documented by NLR in metres and is converted to miles in the visitor interface. Mock tests and a local SQLite simulation verify guard logic, the 100-mile search parameter and unit conversion; live D1, NLR service, abuse behavior and cross-edge concurrency have **not** been tested.
