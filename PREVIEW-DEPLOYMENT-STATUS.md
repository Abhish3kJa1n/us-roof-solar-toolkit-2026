# Cloudflare Pages deployment status

Last verified: November 8, 2026

## Current Git-connected Pages project

- Project: `roof-solar-toolkit-2026`
- Repository: `Abhish3kJa1n/us-roof-solar-toolkit-2026`
- Production branch: `main`
- Runtime application changes include PR #20 merge commit: `907de6f37610136572bea80bac2626051b640941`.
- Latest Cloudflare Production deployment: `3f237f8e-6def-4c6a-955e-32c77a64a34b` from main commit `36c010129f92c4aca5c93b1a5929a1c93064deeb` — active; deploy stage succeeded.
- Pages deployment URL: https://3f237f8e.roof-solar-toolkit-2026.pages.dev
- Custom-domain aliases reported by Cloudflare:
  - https://getroofsolarcalculator.online
  - https://www.getroofsolarcalculator.online
- Build command: `sh scripts/prepare_deploy.sh`
- Build output directory: `dist`
- Root directory: `/`
- Pages Functions enabled.

The current project is Git-connected and has both Production and Preview deployments. Old notes that say Production is disabled, domains belong to `roofcalc`, or provider secrets exist only in Preview are obsolete.

## Production public smoke — verified November 8, 2026

The live smoke test against the stable Pages project hostname passed:

- Homepage returns HTTP 200 and has indexable metadata with the canonical apex URL.
- All 24 sitemap URLs return HTTP 200 with indexable metadata.
- `robots.txt`, `sitemap.xml` and root `ads.txt` return expected content.
- Homepage AdSense meta tag and `ads.txt` publisher record match the owner-confirmed publisher ID `ca-pub-6193507831935325`.
- Security headers and the enforced first-party CSP are present.
- The custom 404 responds with HTTP 404.
- Internal repository files (QA scripts, Markdown owner files, migrations, `_headers`, `_routes.json`, workflow files and source Functions) are not exposed from the public document root.
- Invalid short city autocomplete input is rejected before quota reservation.

**Custom-domain limitation (November 8, 2026):** automated non-browser requests to the apex and `www` hosts received a Cloudflare JavaScript challenge. A separate read-only headless Chromium test remained on `Just a moment...` after 30 seconds (HTTP 200 challenge response). Read-only zone settings showed Browser Integrity Check `on`, Bot Fight Mode `true`, Security Level `medium` and Challenge Page TTL `1800` seconds. The exact trigger is not isolated, and this does not establish whether ordinary human visitors are blocked. Do not disable or weaken those protections to satisfy CI. A real Chrome check on the owner's normal network remains outstanding, including canonical redirects and Analytics `/cdn-cgi/rum` delivery.

## API / D1 configuration

- Binding: `API_QUOTA_DB`
- Database: `roof-solar-api-quota`
- Database ID: `2128d4c7-1031-4029-9629-d6e1abb602d1`
- Migrations: `0001_create_api_quota.sql` and `0002_add_census_suggest_quota.sql`
- Preview and Production share this database ID. Quota totals therefore aggregate both environments; D1 counters cannot be attributed to Preview vs. Production from current records alone.
- Production smoke on November 8 verified exact Census place lookup, issuance/acceptance of the signed location proof, PVWatts V8 response and OpenEI candidate response. The Austin test scenario returned 1,483 kWh/year for 1 kW DC and 49 nearby rate candidates. PR #18 then passed a sequential four-region Production sample: Seattle, WA 1,088 kWh/year (station 0.84 mi; 50 candidates), Phoenix, AZ 1,755 kWh/year (0.58 mi; 50 candidates), Miami, FL 1,558 kWh/year (0.80 mi; 40 candidates), and Boston, MA 1,275 kWh/year (0.38 mi; 50 candidates), each for a 1 kW DC scenario. All four passed exact Census lookup, signed proof, positive annual/12-month output, the enforced 100-mile PVWatts station constraint and OpenEI response-shape checks. PR #20 later passed the same 18-request integration flow on Preview across six representative places: Seattle (1,088 kWh/year/kW DC; station 0.84 mi; 50 candidates), Phoenix (1,755; 0.58 mi; 50), Miami (1,558; 0.80 mi; 40), Boston (1,275; 0.38 mi; 50), Anchorage (951; 1.02 mi; 6) and Urban Honolulu (1,586; 0.90 mi; 50). These six-place results are Preview validation, not a six-place Production test. They remain a small representative sample, not nationwide coverage, property-level production, utility-territory matching or bill-savings validation. The PR #20 code is deployed in Production. Its updated Census -> signed proof -> PVWatts/OpenEI path passed the post-merge Production smoke in GitHub Actions run #647: Austin, TX exact Census lookup issued a signed proof; PVWatts V8 returned 1,483 kWh/year for 1 kW DC and 12 valid monthly values, with a station 1,661 metres (1.03 miles) away; OpenEI returned 49 nearby candidate records. Secrets and proof tokens were not logged. This is one representative city validation, not nationwide coverage or actual household-tariff verification.
- Provider secret values were not read or printed. Keep `PVWATTS_API_KEY`, `OPENEI_API_KEY` and any signing secret in Cloudflare secret bindings only.

## CSP and AdSense state

- Production static HTML keeps the existing enforced CSP; Production Pages Functions routing remains `/api/*` only.
- Preview public HTML routes use the nonce middleware. Eligible guide/EIA pages enforce strict nonce CSP and also emit a report-only candidate policy; other HTML routes retain their current enforced CSP. Nonce-bearing HTML is `private, no-store`; API routes bypass the middleware; Preview stays noindex.
- AdSense site-verification meta tag and root `ads.txt` record are present and match the confirmed publisher ID.
- A guarded AdSense bootstrap exists in source but remains inactive in Production. The runtime `ADSENSE_ENABLED` variable is not configured; Production routes remain API-only unless the separate build-time `ADSENSE_MIDDLEWARE_ENABLED=true` switch is set. No manual ad-slot IDs are defined in source; dashboard Auto ads status is not independently verified. Cloudflare Web Analytics is configured at project level; its Preview beacon script loaded in Chromium, but its telemetry POST was rejected for the unregistered `pages.dev` hostname. Production custom-domain beacon delivery still needs a normal-browser check; headless Chromium could not reach the content behind the challenge. AdSense approval is not verified; the owner reports that review was submitted.
- Do not enable ad serving or change Production routing/CSP until Google approval and owner-side privacy, consent/opt-out and legal checks are complete. Manual slots require actual ad-unit IDs; Auto ads require a deliberate dashboard decision.

## Browser and calculator QA

PR #16 (merged November 8, 2026) passed:
- Full 22-check project QA suite.
- Real Chromium regression for all 24 public pages and the combined homepage calculator.
- Metal material -> secondary selector behavior, metal reference switching, mixed/custom rate preservation and recalculation.
- Roof-area, panel-count, solar savings/payback, homepage roof/solar estimate and loan payment scenarios.
- Missing export credit correctly withholds total savings/payback.
- Four standalone calculator screens checked for horizontal overflow at 390px.
- Live Production public-page smoke.

This does not certify real iOS/Android devices, keyboard-only navigation, screen readers, WCAG 2.2 AA, 200%/400% zoom, Lighthouse lab scores, real-user Core Web Vitals or the custom-domain normal-browser path.

## Owner-side launch gates still open

See `OWNER-LAUNCH-CHECKLIST.md` for the full record. The main outstanding categories are:

1. Real publisher identity, jurisdiction and monitored privacy/editorial contact method.
2. Trademark/common-law clearance and qualified legal review.
3. Genuine author bylines and qualified roofing/PV technical review.
4. Independent model validation against representative tariffs, bills and measured roof/proposal examples.
5. Applicable privacy/consent/opt-out/GPC review before any ad activation.
6. Normal-browser testing of apex and `www`, plus keyboard, screen-reader and manual accessibility checks.
7. Search Console sitemap submission and index coverage monitoring.
8. Representative Pages Functions/D1 usage monitoring. Preview and Production share a D1 quota database.

This file is a state snapshot, not legal advice or a monetization approval. Recheck Cloudflare and Google state before future production changes.

## Production API follow-up after PR #20

The one-time CI smoke completed successfully in run #647 on November 8, 2026. It used one Austin, TX scenario and the existing Production D1 quota guard; it did not change secrets, D1 schema/binding, DNS, CSP, ad-serving switches or Production configuration. Results: Census proof issued; PVWatts 1,483 kWh/year for 1 kW DC, 12 valid monthly values, station 1.03 miles; OpenEI 49 candidates. This is not a nationwide or tariff-accuracy test.
