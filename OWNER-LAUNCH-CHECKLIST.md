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

- [ ] Update the EIA state-average electricity price page from the next EIA release. The current dataset is January–August 2026 and is preliminary for 2026.
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
- [ ] Before activating AdSense, review Google's publisher privacy-disclosure requirements and applicable U.S. state privacy opt-out/GPC obligations for the actual audience and business. The current code path defaults off; do not enable it merely because site review has been submitted.
- [ ] If serving personalized ads to visitors in the EEA, UK or Switzerland, implement Google's current certified CMP/IAB TCF requirements first. Recheck Google's current requirements at activation.
- [ ] Test all privacy links, opt-outs and consent choices from a visitor's browser.

## F. Production engineering and accessibility

- [x] Deploy an isolated Preview and a `main` Production deployment through the Git-connected Cloudflare Pages project. Cloudflare reports the November 8, 2026 Production deployment from commit `893108cb04e4a4fdb913f6cca4532618e8fcd320` as successful, with both custom domains active on this project. Live HTTP, redirects, headers and crawler access remain unverified.
- [ ] Confirm HTTPS, HTTP-to-HTTPS redirect, canonical host and security headers.
- [ ] Test desktop, tablet and mobile browsers with real rendering. Check no horizontal overflow or clipped calculator results.
- [ ] Test keyboard-only operation, focus visibility, zoom at 200%/400%, screen reader form labels, result announcements and table navigation.
- [ ] Check WCAG 2.2 AA criteria with automated and manual testing; a passing automated scan alone is not conformance.
- [ ] Measure Core Web Vitals with field data after traffic exists; lab Lighthouse runs are useful but are not CrUX field data.
- [ ] Scan production network requests, cookies, storage, scripts and security headers after ad/analytics/CMP changes.
- [ ] In Preview, only `/guides/*` and the EIA reference route (extensionless canonical path plus `.html` request) invoke the added Pages Function for nonce CSP; homepage, calculator pages, `/assets/*` and `/data/*` stay outside that route. `main` Production stays on the existing API-only route set unless the owner deliberately enables the build-time `ADSENSE_MIDDLEWARE_ENABLED=true` after Google approval and privacy/consent/legal review. When enabled, eligible HTML responses are `private, no-store`; monitor those added invocations, CPU and latency against Cloudflare's current plan.
- [ ] Add error monitoring only after it is selected and disclosed in the Privacy Notice.

## G. Search and advertising launch

- [ ] Use `scripts/audit_site.py` and fix every error.
- [ ] Run the EIA and calculator scenario tests, plus `scripts/test_configure_site.py`, from the project root; keep the safe noindex mode until every release gate is closed.
- [ ] Use `scripts/configure_site.py --domain https://YOUR-DOMAIN` while retaining noindex.
- [ ] Ensure every indexed page provides original, useful, complete content—not just an ad slot or a template.
- [ ] Publish completed About, Contact, Editorial Policy, Privacy and Terms pages.
- [x] The `main` build is already configured to publish `index,follow` for public HTML pages except `404.html`, remove the global `X-Robots-Tag: noindex` header and copy the sitemap into the Production document root; Preview remains noindex. This is a build configuration check, not proof of live crawler access.
- [ ] Verify the live canonical host, redirects, robots.txt, sitemap and crawler-facing headers, then submit the verified sitemap in Search Console and monitor coverage/manual actions. Do not rerun indexing setup or change Production noindex state blindly.
- [x] AdSense publisher verification meta tag and root `ads.txt` are configured in source with the owner-confirmed publisher ID `ca-pub-6193507831935325` / `pub-6193507831935325`. Live HTTP accessibility and Google's review status are separate checks.
- [x] A nonce-based AdSense loader is implemented behind the runtime Pages variable `ADSENSE_ENABLED`; absent/false means no ad loader runs. Preview builds exercise the nonce middleware, but the `main` build remains API-only unless the separate build-time variable `ADSENSE_MIDDLEWARE_ENABLED=true` is explicitly set. When enabled, the loader is restricted to guide pages and the electricity-prices-by-state page. Homepage and calculator pages remain excluded to protect calculator UX.
- [ ] Keep `ADSENSE_ENABLED` absent/false until Google approves the site and the publisher has completed the privacy/consent/legal gates above. After approval, activate only in Production, then verify network requests, actual ad formats, layout shifts and policy compliance. Do not turn on Auto ads without separately reviewing their placement impact.
- [ ] Choose and configure actual ad placements only after approval: create manual AdSense ad units and use their real IDs in reviewed markup, or deliberately enable Auto ads in the AdSense dashboard. Neither manual slots nor dashboard ad settings are configured by this branch; the loader alone is not an ad-placement implementation.
- [ ] Never buy traffic, incentivize clicks or place ads where they can be mistaken for calculator buttons or navigation.

## Release decision

**Current state: The owner has submitted the AdSense site for review, but approval is not established. Production deployment exists and the `main` build is configured to be indexable, but live crawler-facing behavior is not yet verified. The site is NOT READY for monetized launch.** Owner identity/contact, genuine authorship and qualified review, independent calculator validation, privacy/consent/legal review, and browser/accessibility checks remain unresolved. Do not interpret a successful deployment or indexable build as AdSense readiness.


## Location API release gate

- [x] Free NLR PVWatts and OpenEI API keys are configured as server-side **Preview-only** Cloudflare secrets. Live smoke checks passed on November 4, 2026. No API keys are configured in Production; do not put keys in Git or client code.
- [x] The live D1 database `roof-solar-api-quota` exists; migrations `0001_create_api_quota.sql` and `0002_add_census_suggest_quota.sql` have been applied; `API_QUOTA_DB` is bound in both Preview and Production. The November 8 Cloudflare project read confirms a successful Production deployment and the same D1 database ID is bound in Preview and Production. Secret values are not exposed by the project configuration response, so current Production provider-secret presence must be checked in the dashboard/runtime rather than inferred from masked API output. All three API endpoints require the shared quota guard; PVWatts and OpenEI additionally require their respective provider keys.
- [ ] Optionally add tested per-IP WAF rate limiting for `/api/*` as a secondary defense only; Free-plan counters are not global and do not replace D1.
- [x] Pages Runtime **Fail open / closed** is set to Fail open in the current `roof-solar-toolkit-2026` Preview and Production project configurations. Recheck after any project replacement or environment change.
- [ ] Monitor actual Pages Functions and D1 usage and recheck Cloudflare's current account-level Free allowances before launch. The application's D1 guards currently cap exact Census lookups at 10,000/day, Census autocomplete at 20,000/day, PVWatts at 15,000/day and OpenEI at 5,000/day; the 15-minute bucket guards also constrain burst rates. Account usage has not yet been audited over a representative traffic period.
- [x] Run a live Austin PVWatts V8 Preview smoke test using the server-side key. It returned 1,483 kWh/year for the 1 kW DC test scenario, with monthly output and weather-station identifier 677404.
- [x] Hardened the provider proxy boundary: PVWatts and OpenEI require a short-lived HMAC-signed location proof issued by exact Census city/state verification; raw or modified coordinates are rejected before quota reservation/upstream calls. The mocked QA suite passed on November 4, 2026. A fresh live Preview smoke test of this proof flow is pending.
- [ ] Separately record and verify the returned weather-station distance is within the configured 100-mile search radius for representative test locations; the smoke log currently records the station identifier, not its distance.
- [ ] If no climate station is available within 100 miles, keep the calculation unavailable for that location rather than expanding to an unrestricted distant station.
- [ ] Verify current OpenEI candidate records against actual utility tariff documents and a sample customer bill; do not auto-apply a candidate rate to dollar savings.

## H. Public build packaging and deployment method

- [x] Production canonical/OG URLs are configured for `https://getroofsolarcalculator.online`. The `main` build script changes page-level robots metadata to `index,follow`, removes the global `X-Robots-Tag: noindex` header and copies `sitemap.xml`; Cloudflare reports the `main` Production deployment succeeded. Actual deployed HTML/headers, redirects, HTTPS and crawler access remain unverified.
- [x] Clean public staging script added: `sh scripts/prepare_deploy.sh`; generates `dist/` with 26 visitor-facing HTML documents and only their public static dependencies. Internal Markdown research, QA scripts, migrations and owner notes are excluded.
- [x] Deployment-stage regression test added: verifies 482 local references, no internal-file leakage and retained noindex.
- [x] Cloudflare Pages Git integration is configured: root directory `/`, build command `sh scripts/prepare_deploy.sh`, build output `dist`, framework preset None; `/functions` remains at repository root. Preview deployment from the audit branch completed successfully. This project does not require `package.json` or `package-lock.json`.
- [x] Direct Upload was not selected; the project uses Git integration. Do not create a second Direct Upload project or use dashboard drag-and-drop for this Functions-enabled build.
- [x] Cloudflare account, Git-connected Pages project and D1 binding are configured. As checked November 6, 2026, Cloudflare reports the apex and `www` custom domains active on `roof-solar-toolkit-2026`; the latest Production deployment is successful. Do not repeat the old `roofcalc` routing claim. This control-plane check does not prove end-to-end HTTP routing.
- [x] Preview build and Pages Functions compilation completed; live Census, PVWatts and OpenEI endpoint smoke tests passed on November 4, 2026. The November 8 `main` Production build/deploy completed successfully. The earlier smoke tests do not prove current Production API configuration or current live public-page responses.
- [ ] Verify real-browser static URLs on both custom domains, actual response headers, 404 behavior, HTTPS and canonical-host redirects. Confirm production `robots.txt`, `sitemap.xml` and `ads.txt` return expected content/status, and confirm no `scripts/`, internal Markdown, migrations or owner records are publicly exposed.
