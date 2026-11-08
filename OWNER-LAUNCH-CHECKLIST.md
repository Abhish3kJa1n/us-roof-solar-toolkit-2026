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

- [x] Deploy an isolated Preview and a `main` Production deployment through the Git-connected Cloudflare Pages project. Cloudflare reports the November 8, 2026 Production deployment from merge commit `7b90b230ed0eb60011424b565eea5a0b43397551` as successful, with both custom domains attached to this project. The stable Pages hostname passed live HTTP, crawler, sitemap, `ads.txt`, 404, security-header and internal-file-isolation checks. Apex/`www` automated checks receive a Cloudflare JavaScript challenge; normal-browser custom-domain behavior remains unverified.
- [ ] Confirm HTTPS, HTTP-to-HTTPS redirect, canonical host and security headers.
- [ ] Test desktop, tablet and mobile browsers with real rendering. Check no horizontal overflow or clipped calculator results.
- [ ] Test keyboard-only operation, focus visibility, zoom at 200%/400%, screen reader form labels, result announcements and table navigation.
- [ ] Check WCAG 2.2 AA criteria with automated and manual testing; a passing automated scan alone is not conformance.
- [ ] Measure Core Web Vitals with field data after traffic exists; lab Lighthouse runs are useful but are not CrUX field data.
- [ ] Scan production network requests, cookies, storage, scripts and security headers after ad/analytics/CMP changes.
- [ ] Add error monitoring only after it is selected and disclosed in the Privacy Notice.

## G. Search and advertising launch

- [x] Run `scripts/audit_site.py` and the full repository QA suite through GitHub Actions. PR #16 completed all 22 project checks successfully on November 8, 2026; its run also passed the dedicated Chromium homepage-calculator regression and live Production public-page smoke.
- [x] Verify that the `main` build publishes `index,follow`, serves `robots.txt` and `sitemap.xml`, and returns HTTP 200 for all 24 sitemap URLs on the stable Production Pages hostname. Preview remains noindex. Do not rerun `configure_site.py` or change indexing state blindly; Production is already indexable.
- [ ] In a normal browser, verify both custom hosts, HTTPS, canonical redirects and visitor access through Cloudflare Browser Integrity Check. Automated non-browser checks received a JavaScript challenge and cannot establish the normal-browser result.
- [ ] Submit the verified sitemap in Google Search Console (if not already submitted) and monitor indexing/coverage. A published sitemap does not prove pages are indexed.
- [x] Confirm the homepage AdSense verification meta tag and root `ads.txt` publisher record match the owner-confirmed ID `ca-pub-6193507831935325` / `pub-6193507831935325`. The root `ads.txt` and homepage meta were verified on the stable Pages hostname.
- [x] The owner reports submitting the AdSense site review request. This records submission only; Google approval has not been verified.
- [ ] Wait for AdSense approval and resolve any policy/review issues. Do not activate ads before approval and completion of the privacy, consent/opt-out and legal checks.
- [ ] After approval, choose manual ad units with real IDs or deliberately configure Auto ads in the AdSense dashboard. Neither ad units nor Auto ads are currently configured. Keep ads outside the calculator input/result workflow and validate layout/performance before activation.
- [ ] Never buy traffic, incentivize clicks or place ads where they can be mistaken for calculator buttons or navigation.

## Release decision

**Current state (November 8, 2026):** Production `main` commit `7b90b230ed0eb60011424b565eea5a0b43397551` is deployed successfully. The stable Pages hostname passed live public-page, indexability, 24-URL sitemap, `ads.txt`, `robots.txt`, security-header, 404 and internal-file-isolation checks. PR #16 passed full QA, Chromium calculator regression and Production public smoke. Apex/`www` automated checks receive a Cloudflare JavaScript challenge, so normal-browser custom-domain access remains open. The owner reports submitting AdSense for review; approval is not established. **Ad serving is not enabled.** Publisher identity/contact, genuine authorship and qualified review, independent calculator/tariff validation, privacy/consent/legal review, manual accessibility checks and Search Console monitoring remain unresolved.


## Location API release gate

- [x] Free NLR PVWatts and OpenEI credentials are configured as server-side Cloudflare secrets. Preview smoke tests passed November 4, 2026. On November 8, 2026, live Production requests confirmed that both Production provider credentials are accepted: the Census -> signed proof -> PVWatts and OpenEI paths both succeeded. Secret values were not read or logged; never put keys in Git or client code.
- [x] The live D1 database `roof-solar-api-quota` exists; migrations `0001_create_api_quota.sql` and `0002_add_census_suggest_quota.sql` are applied; `API_QUOTA_DB` is bound in both Preview and Production. Cloudflare confirms both environments share the same D1 database ID. The November 8, 2026 Production smoke test proved the exact Census lookup, PVWatts and OpenEI routes operational using their signed-proof and provider-key requirements. All three API endpoints require the shared quota guard.
- [ ] Optionally add tested per-IP WAF rate limiting for `/api/*` as a secondary defense only; Free-plan counters are not global and do not replace D1.
- [x] Pages Runtime **Fail open / closed** is set to Fail open in the current `roof-solar-toolkit-2026` Preview and Production project configurations. Recheck after any project replacement or environment change.
- [ ] Monitor actual Pages Functions and D1 usage and recheck Cloudflare's current account-level Free allowances before launch. The application's D1 guards currently cap exact Census lookups at 10,000/day, Census autocomplete at 20,000/day, PVWatts at 15,000/day and OpenEI at 5,000/day; the 15-minute bucket guards also constrain burst rates. Account usage has not yet been audited over a representative traffic period.

Read-only D1 snapshot checked November 8, 2026 after the Production provider smoke test: Census had 2 successful reservations, PVWatts 2 and OpenEI 1 in the November 8 UTC day bucket; the latest update was 10:25:50 UTC and the most recent 15-minute bucket began at 10:15 UTC. The Census-suggestions row had last been updated November 6 (day count 12). The five new Production smoke-test reservations (2 Census, 2 PVWatts, 1 OpenEI) account for the new November 8 entries. Preview and Production share this D1 database, so aggregate counters cannot otherwise be attributed to one environment or unique visitors. This is not a representative traffic-period or account-level Pages Functions usage audit; leave the monitoring gate open.
- [x] Run a live Austin PVWatts V8 Preview smoke test using the server-side key. It returned 1,483 kWh/year for the 1 kW DC test scenario, with monthly output and weather-station identifier 677404.
- [x] Hardened the provider proxy boundary: PVWatts and OpenEI require a short-lived HMAC-signed location proof issued by exact Census city/state verification; raw or modified coordinates are rejected before quota reservation/upstream calls. The November 8, 2026 live Production Austin, TX test confirmed that Census issued a proof and both provider routes accepted it.
- [x] Verified one live Production Austin, TX result: NLR returned a climate-station distance of 1,661 metres (1.03 miles), within the configured 100-mile radius. Important units: PVWatts `station_info.distance` is metres; request parameter `radius` is miles. Further geographically diverse locations should be checked before claiming coverage across the US.
- [ ] If no climate station is available within 100 miles, keep the calculation unavailable for that location rather than expanding to an unrestricted distant station.
- [ ] Verify current OpenEI candidate records against actual utility tariff documents and a sample customer bill; do not auto-apply a candidate rate to dollar savings.

## H. Public build packaging and deployment method

- [x] Production canonical/OG URLs are configured for `https://getroofsolarcalculator.online`. The `main` build script changes page-level robots metadata to `index,follow`, removes the global `X-Robots-Tag: noindex` header and copies `sitemap.xml`. The November 8 Production smoke test verified the deployed Pages hostname's HTML, indexability, security headers, `ads.txt`, `robots.txt`, sitemap and all 24 sitemap URLs. Custom-domain HTTP requests from the non-browser runner are challenged by Cloudflare Browser Integrity Check; normal-browser behavior remains to be checked.
- [x] Clean public staging script added: `sh scripts/prepare_deploy.sh`; generates `dist/` with 26 visitor-facing HTML documents and only their public static dependencies. Internal Markdown research, QA scripts, migrations and owner notes are excluded.
- [x] Deployment-stage regression test added: verifies 482 local references, no internal-file leakage and retained noindex.
- [x] Cloudflare Pages Git integration is configured: root directory `/`, build command `sh scripts/prepare_deploy.sh`, build output `dist`, framework preset None; `/functions` remains at repository root. Preview deployment from the audit branch completed successfully. This project does not require `package.json` or `package-lock.json`.
- [x] Direct Upload was not selected; the project uses Git integration. Do not create a second Direct Upload project or use dashboard drag-and-drop for this Functions-enabled build.
- [x] Cloudflare account, Git-connected Pages project and D1 binding are configured. As checked November 8, 2026, Cloudflare reports the apex and `www` custom domains active on `roof-solar-toolkit-2026`; the latest Production deployment from commit `14f19bb9d940edd8a114d5ebf069332bab53adfe` succeeded. Do not repeat the old `roofcalc` routing claim. End-to-end custom-domain behavior still requires a normal-browser check because non-browser CI receives a Cloudflare JavaScript challenge.
- [x] Preview build and Pages Functions compilation completed; live Census, PVWatts and OpenEI Preview smoke tests passed November 4, 2026. On November 8, the Production Census -> signed proof -> PVWatts/OpenEI smoke test passed; Production returned 1,483 kWh/year for the 1 kW DC Austin test and 49 nearby OpenEI candidate records. The Production Pages/crawler smoke also verified 24 sitemap pages, root `ads.txt`, `robots.txt`, sitemap, security headers, privacy notice, 404 behavior and internal-file isolation on the stable Pages hostname. PR #16 subsequently passed real Chromium regression for the combined homepage calculator and standalone calculators.
- [ ] In a normal Chrome browser, verify apex and `www` custom-domain pages, HTTPS, canonical redirect, headers and actual user access through Cloudflare Browser Integrity Check. The stable Production Pages hostname already returned expected content for the homepage, `ads.txt`, `robots.txt`, sitemap and all 24 sitemap pages. Also confirm internal `scripts/`, Markdown research, migrations and owner records are not publicly exposed.
