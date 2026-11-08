# Owner-side launch gates

This checklist deliberately separates what can be built in code from facts that only the actual publisher can supply. Do not invent an identity, registered business, address, email, professional qualification, legal review or trademark clearance.

## A. Publisher identity and ownership — must be supplied by the owner

- [ ] Legal publisher name (individual or registered entity).
- [ ] Country of establishment and actual operating location.
- [ ] Monitored editorial/privacy contact email on a domain the publisher controls.
- [ ] Business mailing address or another legally adequate contact method, as applicable.
- [ ] Confirm the publisher owns or controls the domain and can edit the HTML source needed for AdSense verification.
- [ ] Document any commercial, contractor, installer, lender, affiliate or manufacturer relationships. Disclose them where required.

## B. Brand and domain clearance — cannot be certified by a quick web search

- [x] Working domain selected and registered: `getroofsolarcalculator.online` through Hostinger. Cloudflare currently reports both the apex and `www` custom domains as active on the Git-connected `roof-solar-toolkit-2026` Pages project (checked November 8, 2026). This confirms Pages project attachment/status, not end-to-end DNS, redirect or visitor HTTP behavior. Final brand/legal clearance remains open.
- [ ] Search the USPTO Trademark Search system for exact, phonetic and confusingly similar marks in relevant classes; inspect live applications and registrations in TSDR.
- [ ] Search common-law use, corporate names, state business registries, search engines, social accounts and relevant industry directories.
- [x] Domain purchased through Hostinger.
- [ ] Verify the exact expiry date and renewal terms in Hostinger hPanel before the end of the paid period.
- [ ] Have a trademark professional assess likely confusion and the actual goods/services. A domain being available does not mean the name is legally clear.
- [ ] Do not revive **Roofwise** as the brand without fresh clearance; an existing U.S. roofing business was found using that name during the previous audit. The current **Roof & Solar Toolkit** label remains a working title, not a cleared mark.

Official starting points: https://tmsearch.uspto.gov/ and https://tsdr.uspto.gov/ . A search result absence is not a legal clearance opinion.

## C. Editorial and technical accountability

- [ ] Put a genuine named author on each guide, with a factual biography and relevant experience.
- [ ] Obtain review of roofing statements by a qualified roofing professional where technical judgments are made.
- [ ] Obtain review of PV modeling and electrical statements by a qualified solar/PV professional.
- [ ] Record the reviewer's actual qualification, scope of review and review date. No review should be claimed until it occurred.
- [ ] Recheck every tax, incentive, code, tariff and price claim against an official source immediately before publication.
- [ ] Keep a source/change log. Use source-specific dates and identify preliminary data.
- [ ] Add original value before indexing: documented test cases, quote-scope normalization, original analysis or data derived transparently from official sources. Do not spin up thin city/state pages just to target keywords.
- [ ] Create an editorial correction process and monitor the contact channel.

## D. Current data and calculator boundaries

- [x] Rechecked November 8, 2026 against EIA Electric Power Monthly Table 5.6.B: January–August 2026 YTD remains the latest published state-level residential comparison (released October 23, 2026); 2026 figures remain preliminary. The CSV and page already match this release, so no data refresh was warranted. Next scheduled EPM release: November 24, 2026. Source: https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_06_b .
- [ ] Recheck Table 5.6.B after the November 24, 2026 EIA release; refresh the CSV and page only if a newer table is actually published.
- [ ] Never use EIA statewide average prices as a homeowner's utility tariff or as the default solar savings import/export rate.
- [ ] Have the annual solar model independently checked against several real tariff structures and example bills, including TOU and different export rules. The current model is annual and does not reproduce hourly billing.
- [ ] Validate the roof pitch geometry and cost-input experience with measured examples. The combined and standalone roof tools currently use a disclosed, editable Angi national $4–$11 per roof-surface sq-ft context range when no comparable local quote is supplied. This is not a local or material-specific installed-price dataset; verify the source, scope and user-facing wording before launch.
- [ ] Reconcile calculator results against independent tools or professional proposals and publish test methodology, not just screenshots.

## E. Privacy, advertising and consumer law

- [ ] Select the real host, ad network, analytics provider, consent-management platform and any embedded third parties before finalizing the Privacy Notice.
- [x] Identify Cloudflare Web Analytics as enabled at Pages project level and document the observed Preview behavior in `privacy.html`. Chromium confirmed the platform injects and loads `https://static.cloudflareinsights.com/beacon.min.js` on the Preview. The `pages.dev` telemetry POST is rejected by Cloudflare's hostname/CORS validation because that Preview hostname does not match the registered custom domain; this is not evidence that the Production custom-domain endpoint is broken.
- [ ] Run real Chromium desktop and mobile checks on both Production custom domains after the Cloudflare beacon CSP change is released. Confirm `https://static.cloudflareinsights.com/beacon.min.js` loads, the custom-domain telemetry request reaches the expected same-origin `/cdn-cgi/rum` endpoint without CORS/CSP errors, and no calculator/API regressions occur. Preview testing on `pages.dev` observed the script loading but the telemetry request was rejected because that hostname did not match the configured analytics site; do not treat the Preview CORS failure as proof that Production is broken or working.
- [ ] Obtain qualified legal review of privacy, terms, advertising disclosures, IP/copyright, accessibility and applicable federal/state law.
- [ ] Assess privacy-law applicability by thresholds, processing activities, consumer location and business role. State privacy laws differ; do not assume that a small traffic volume automatically exempts every ad-tech activity.
- [ ] Determine whether targeted advertising, cookies, identifiers, IP handling, Global Privacy Control or other opt-out signals require controls for the audience served.
- [ ] If Google personalized ads are served to EEA, UK or Switzerland visitors, confirm Google's then-current certified CMP and IAB TCF requirements are implemented.
- [ ] If affiliate links, sponsorships or paid reviews are introduced, disclose material relationships clearly and near the recommendation.
- [ ] Review native-advertising formats against the FTC requirement that commercial content not mislead readers about its nature; keep disclosures clear, prominent and close to the ad content. Official starting point: https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses .
- [ ] Set a children/audience policy. Do not knowingly collect children's personal information without the required assessment and controls.
- [ ] Make the Privacy Notice accurately describe hosting logs, ad tags, cookies, identifiers, recipients, retention and rights after each technology change.
- [ ] Test all privacy links, opt-outs and consent choices from a visitor's browser.

## F. Production engineering and accessibility

- [x] Deploy an isolated Preview and a `main` Production deployment through the Git-connected Cloudflare Pages project. Cloudflare reports the November 8, 2026 Production deployment from main merge commit `36c010129f92c4aca5c93b1a5929a1c93064deeb` (deployment `3f237f8e-6def-4c6a-955e-32c77a64a34b`) as active, with both custom domains attached and their domain/HTTP validation status active. The stable Pages hostname passed live HTTP, crawler, sitemap, `ads.txt`, 404, security-header and internal-file-isolation checks. Apex/`www` headless Chromium checks received Cloudflare's challenge page and remained there after a 30-second wait. This is not evidence that normal Chrome visitors are blocked; actual human-browser access remains unverified.
- [ ] Confirm HTTPS, HTTP-to-HTTPS redirect, canonical host and security headers.
- [ ] Test desktop, tablet and mobile browsers with real rendering. Check no horizontal overflow or clipped calculator results.
- [ ] Test keyboard-only operation, focus visibility, zoom at 200%/400%, screen reader form labels, result announcements and table navigation.
- [ ] Check WCAG 2.2 AA criteria with automated and manual testing; a passing automated scan alone is not conformance.
- [ ] Measure Core Web Vitals with field data after traffic exists; lab Lighthouse runs are useful but are not CrUX field data.
- [ ] Scan production network requests, cookies, storage, scripts and security headers after ad/analytics/CMP changes.
- [ ] Add error monitoring only after it is selected and disclosed in the Privacy Notice.

## Cloudflare Functions capacity constraint

The guarded guide/EIA route invokes a Pages Function for each eligible HTML page request. On the Cloudflare Workers Free plan, Pages Functions requests count toward the shared 100,000 requests/day allowance alongside existing API Function traffic; static asset requests are free and unlimited. Confirm the account plan and monitor actual daily Function usage before enabling the build flag. If the allowance is approached, the Pages fail-open setting can bypass middleware (ads stop) while API behavior also needs checking. Keep the build-time switch off unless the additional ad-serving benefit justifies this capacity trade-off. Official limits: https://developers.cloudflare.com/pages/functions/pricing/ and https://developers.cloudflare.com/workers/platform/limits/.

## G. Search and advertising launch

- [x] Run `scripts/audit_site.py` and the full repository QA suite through GitHub Actions. PR #16 completed all 22 project checks successfully on November 8, 2026; its run also passed the dedicated Chromium homepage-calculator regression and live Production public-page smoke.
- [x] Verify that the `main` build publishes `index,follow`, serves `robots.txt` and `sitemap.xml`, and returns HTTP 200 for all 24 sitemap URLs on the stable Production Pages hostname. Preview remains noindex. Do not rerun `configure_site.py` or change indexing state blindly; Production is already indexable.
- [ ] In a normal Chrome browser on your usual network, verify both custom hosts, HTTPS, canonical redirects and page access. The read-only headless Chromium test remained on Cloudflare's challenge page after 30 seconds. Zone settings observed on November 8: Browser Integrity Check `on`, Bot Fight Mode `true`, Security Level `medium`, Challenge Page TTL `1800` seconds. The evidence does not isolate which protection triggered the challenge. Do not disable protections to make CI pass.
- [ ] Submit the verified sitemap in Google Search Console (if not already submitted) and monitor indexing/coverage. A published sitemap does not prove pages are indexed.
- [x] Confirm the homepage AdSense verification meta tag and root `ads.txt` publisher record match the owner-confirmed ID `ca-pub-6193507831935325` / `pub-6193507831935325`. The root `ads.txt` and homepage meta were verified on the stable Pages hostname.
- [x] The owner reports submitting the AdSense site review request. This records submission only; Google approval has not been verified.
- [ ] Wait for AdSense approval and resolve any policy/review issues. Do not activate ads before approval and completion of the privacy, consent/opt-out and legal checks.
- [ ] After approval, choose manual ad units with real IDs or deliberately configure Auto ads in the AdSense dashboard. No manual ad-slot IDs are defined in source. The AdSense dashboard Auto ads setting has not been independently verified and must be checked by the owner before activation. Keep ads outside the calculator input/result workflow and validate layout/performance before activation.
- [ ] The guarded AdSense bootstrap is staged in code but remains off by default. Production routing remains API-only unless the build-time Pages variable `ADSENSE_MIDDLEWARE_ENABLED=true` is deliberately configured; even then, the loader requires the separate runtime Pages variable `ADSENSE_ENABLED=true` and an exact apex/`www` custom-domain match. Do not set either variable until Google approval and the publisher-side privacy, consent/opt-out and legal gates are complete.
- [ ] The loader is limited to guide pages and the electricity-prices-by-state reference page. It excludes the homepage and calculators. No manual ad-unit slot IDs or Auto ads settings are supplied by this code; create and review placements separately after approval.

- [ ] Never buy traffic, incentivize clicks or place ads where they can be mistaken for calculator buttons or navigation.

## Release decision

**Current state (November 8, 2026):** Production `main` merge commit `36c010129f92c4aca5c93b1a5929a1c93064deeb` is deployed successfully in Cloudflare deployment `3f237f8e-6def-4c6a-955e-32c77a64a34b`; Cloudflare reports both custom domains active. The stable Pages hostname's earlier live public-page, indexability, 24-URL sitemap, `ads.txt`, `robots.txt`, security-header, 404 and internal-file-isolation checks passed. PR #20's updated Census lookup passed the full 22-check QA suite and six-place live API integration smoke on Preview. A separate post-merge Production smoke passed in CI run #647: Austin exact Census lookup and signed proof; PVWatts returned 1,483 kWh/year per 1 kW DC, 12 valid monthly values and a station 1.03 miles away; OpenEI returned 49 candidates. This is one representative city check, not nationwide or tariff validation. A read-only headless Chromium test against apex and `www` received Cloudflare's challenge page; the second attempt remained on `Just a moment...` after 30 seconds. Cloudflare zone settings show Browser Integrity Check on, Bot Fight Mode enabled, Security Level medium and 1800-second Challenge Page TTL. The exact trigger is unknown, and this does not prove normal human Chrome visitors are blocked. No security setting was changed. Human-browser validation remains outstanding. The owner reports submitting AdSense for review; approval is not established. **Ad serving is not enabled.** Publisher identity/contact, genuine authorship and qualified review, independent calculator/tariff validation, privacy/consent/legal review, manual accessibility checks and Search Console monitoring remain unresolved.


## Location API release gate

- [x] Free NLR PVWatts and OpenEI credentials are configured as server-side Cloudflare secrets. Preview smoke tests passed November 4, 2026. On November 8, 2026, live Production requests confirmed that both Production provider credentials are accepted: the Census -> signed proof -> PVWatts and OpenEI paths both succeeded. Secret values were not read or logged; never put keys in Git or client code.
- [x] The live D1 database `roof-solar-api-quota` exists; migrations `0001_create_api_quota.sql` and `0002_add_census_suggest_quota.sql` are applied; `API_QUOTA_DB` is bound in both Preview and Production. Cloudflare confirms both environments share the same D1 database ID. The November 8, 2026 Production smoke test proved the exact Census lookup, PVWatts and OpenEI routes operational using their signed-proof and provider-key requirements. All three API endpoints require the shared quota guard.
- [ ] Optionally add tested per-IP WAF rate limiting for `/api/*` as a secondary defense only; Free-plan counters are not global and do not replace D1.
- [x] Pages Runtime **Fail open / closed** is set to Fail open in the current `roof-solar-toolkit-2026` Preview and Production project configurations. Recheck after any project replacement or environment change.
- [ ] Monitor actual Pages Functions and D1 usage and recheck Cloudflare's current account-level Free allowances before launch. The application's D1 guards currently cap exact Census lookups at 10,000/day, Census autocomplete at 20,000/day, PVWatts at 15,000/day and OpenEI at 5,000/day; the 15-minute bucket guards also constrain burst rates. Account usage has not yet been audited over a representative traffic period.

Read-only D1 snapshot checked November 8, 2026 after the Production provider smoke test: Census had 2 successful reservations, PVWatts 2 and OpenEI 1 in the November 8 UTC day bucket; the latest update was 10:25:50 UTC and the most recent 15-minute bucket began at 10:15 UTC. The Census-suggestions row had last been updated November 6 (day count 12). The five new Production smoke-test reservations (2 Census, 2 PVWatts, 1 OpenEI) account for the new November 8 entries. Preview and Production share this D1 database, so aggregate counters cannot otherwise be attributed to one environment or unique visitors. This is not a representative traffic-period or account-level Pages Functions usage audit; leave the monitoring gate open.
- [x] Run a live Austin PVWatts V8 Preview smoke test using the server-side key. It returned 1,483 kWh/year for the 1 kW DC test scenario, with monthly output and weather-station identifier 677404.
- [x] Hardened the provider proxy boundary: PVWatts and OpenEI require a short-lived HMAC-signed location proof issued by exact Census city/state verification; raw or modified coordinates are rejected before quota reservation/upstream calls. The November 8, 2026 live Production Austin, TX test confirmed that Census issued a proof and both provider routes accepted it.
- [x] Verified one live Production Austin, TX result: NLR returned a climate-station distance of 1,661 metres (1.03 miles), within the configured 100-mile radius. `station_info.distance` is metres; request parameter `radius` is miles.
- [x] Limited four-region live Production sample (November 8, 2026; PR #18): Seattle, WA returned 1,088 kWh/year per 1 kW DC (weather station 0.84 miles away; 50 OpenEI candidates); Phoenix, AZ 1,755 kWh/year (0.58 miles; 50 candidates); Miami, FL 1,558 kWh/year (0.80 miles; 40 candidates); Boston, MA 1,275 kWh/year (0.38 miles; 50 candidates). All four passed exact Census lookup, signed-proof validation, positive annual/12-month PVWatts output, the configured 100-mile station radius and OpenEI response-shape checks. This validates the live Production integration at four representative place points only. It does **not** establish nationwide coverage, property-specific production, tariff correctness or actual bill savings. PR #20 later added Alaska and Hawaii to a six-place Preview integration smoke; those results are not Production validation. Territories, rural/edge locations and tariff-to-bill matching remain unverified.
- [ ] If no climate station is available within 100 miles, keep the calculation unavailable for that location rather than expanding to an unrestricted distant station.
- [ ] Verify current OpenEI candidate records against actual utility tariff documents and a sample customer bill; do not auto-apply a candidate rate to dollar savings.

## H. Public build packaging and deployment method

- [x] Production canonical/OG URLs are configured for `https://getroofsolarcalculator.online`. The `main` build script changes page-level robots metadata to `index,follow`, removes the global `X-Robots-Tag: noindex` header and copies `sitemap.xml`. The November 8 Production smoke test verified the deployed Pages hostname's HTML, indexability, security headers, `ads.txt`, `robots.txt`, sitemap and all 24 sitemap URLs. Custom-domain non-browser requests and headless Chromium are challenged by Cloudflare; read-only zone settings show Browser Integrity Check on, Bot Fight Mode enabled and Security Level medium. Normal human-browser behavior remains to be checked.
- [x] Clean public staging script added: `sh scripts/prepare_deploy.sh`; generates `dist/` with 26 visitor-facing HTML documents and only their public static dependencies. Internal Markdown research, QA scripts, migrations and owner notes are excluded.
- [x] Deployment-stage regression test added: verifies 482 local references, no internal-file leakage and retained noindex.
- [x] Cloudflare Pages Git integration is configured: root directory `/`, build command `sh scripts/prepare_deploy.sh`, build output `dist`, framework preset None; `/functions` remains at repository root. Preview deployment from the audit branch completed successfully. This project does not require `package.json` or `package-lock.json`.
- [x] Direct Upload was not selected; the project uses Git integration. Do not create a second Direct Upload project or use dashboard drag-and-drop for this Functions-enabled build.
- [x] Cloudflare account, Git-connected Pages project and D1 binding are configured. As checked November 8, 2026, Cloudflare reports the apex and `www` custom domains active on `roof-solar-toolkit-2026`; the latest Production deployment from merge commit `36c010129f92c4aca5c93b1a5929a1c93064deeb` (deployment `3f237f8e-6def-4c6a-955e-32c77a64a34b`) succeeded. Do not repeat the old `roofcalc` routing claim. End-to-end custom-domain behavior remains unverified: headless Chromium received a Cloudflare challenge after 30 seconds, while ordinary human-browser behavior has not been tested. Zone settings observed read-only: Browser Integrity Check `on`, Bot Fight Mode `true`, Security Level `medium`, Challenge Page TTL `1800` seconds. Do not change these protections just to satisfy CI.
- [x] Preview build and Pages Functions compilation completed; live Census, PVWatts and OpenEI Preview smoke tests passed November 4, 2026. On November 8, the Production Census -> signed proof -> PVWatts/OpenEI smoke test passed; Production returned 1,483 kWh/year for the 1 kW DC Austin test and 49 nearby OpenEI candidate records. The Production Pages/crawler smoke also verified 24 sitemap pages, root `ads.txt`, `robots.txt`, sitemap, security headers, privacy notice, 404 behavior and internal-file isolation on the stable Pages hostname. PR #16 subsequently passed real Chromium regression for the combined homepage calculator and standalone calculators.
- [ ] In a normal Chrome browser, verify apex and `www` custom-domain pages, HTTPS, canonical redirect, headers and actual user access through Cloudflare Browser Integrity Check. The stable Production Pages hostname already returned expected content for the homepage, `ads.txt`, `robots.txt`, sitemap and all 24 sitemap pages. Also confirm internal `scripts/`, Markdown research, migrations and owner records are not publicly exposed.
