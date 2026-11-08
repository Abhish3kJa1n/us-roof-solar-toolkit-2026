# Roof & Solar Toolkit — U.S. homeowner calculator website

**Review date:** November 8, 2026  
**Release status:** Production is deployed and the `main` build is indexable. The stable Pages hostname, 24 sitemap pages, crawler files and security headers passed live smoke checks. The custom apex/`www` path still needs a real-browser check because the automated non-browser runner receives a Cloudflare challenge. The owner has submitted the AdSense review request; approval is not established and ad serving remains disabled.

## Purpose and business model

This project is intended to become a free, U.S.-focused informational website funded primarily through display advertising. It is **not** a roofing or solar contractor, installer marketplace, quote-lead funnel, contractor directory, lender, utility or government service. The current build has no lead form, quote-submission workflow or customer database. It includes three limited server-side Pages Functions: Census place discovery/verification, PVWatts production modelling and nearby OpenEI utility-tariff candidate discovery. The browser sends a city search term or selected city/state to this site's same-origin Census endpoint. After exact city/state verification, the server signs the returned representative place point with a short-lived HMAC proof; PVWatts and OpenEI reject raw or modified coordinates that lack a matching proof. The browser passes that proof with the model request. Those functions query the U.S. Census Bureau TIGERweb ACS2026 service, NLR PVWatts V8 or OpenEI as described in `privacy.html`. All three API endpoints require the shared D1 quota binding and fail closed when it is unavailable. Census requires no provider key; PVWatts and OpenEI require separate server-side secrets. Preview passed live Census, PVWatts and OpenEI smoke tests on November 4, 2026. A live Production smoke test on November 8, 2026 confirmed Census exact-place lookup, signed-location proof validation, NLR PVWatts V8 and OpenEI requests with the configured Production secrets before the PR #20 Census-resilience update; secret values were not read or logged. Cloudflare reports Production merge commit `907de6f37610136572bea80bac2626051b640941` deployed successfully in deployment `815de0b3-026b-4b79-a4ea-00df771f34f6` (verified November 8, 2026 at 16:50 UTC). PR #20 then passed six-place Census -> signed proof -> PVWatts/OpenEI integration validation on Preview: Seattle, Phoenix, Miami, Boston, Anchorage and Urban Honolulu. This was not a six-region Production API test; a post-merge Production API smoke of the updated Census behavior remains open. A guarded AdSense bootstrap is now present in the repository, but the Production runtime `ADSENSE_ENABLED` switch is absent and no AdSense loader is injected by the current Production configuration. No manual ad-slot IDs are defined in source; the AdSense dashboard Auto ads setting has not been independently verified. Cloudflare Web Analytics is configured at project level. Real Chromium QA on the branch Preview confirmed that the platform injected and loaded the beacon script. The Preview's telemetry POST to `cloudflareinsights.com/cdn-cgi/rum` was rejected because the Preview `pages.dev` hostname does not match the registered analytics site. Production custom-domain beacon delivery still requires a separate real-browser verification; see `privacy.html` and the owner checklist.

“Roof & Solar Toolkit” is a descriptive working title, not a cleared trademark. The owner registered `getroofsolarcalculator.online` through Hostinger. As checked November 8, 2026, Cloudflare reports the apex and `www` custom domains active on the Git-connected `roof-solar-toolkit-2026` Pages project. Production is deployed from `main` merge commit `907de6f37610136572bea80bac2626051b640941` (Cloudflare deployment `815de0b3-026b-4b79-a4ea-00df771f34f6`, active as of November 8, 2026). The Pages hostname passed live HTTP/crawler checks; the custom-domain automated probe encounters a Cloudflare JavaScript challenge, so a normal-browser check of both hosts and canonical redirects remains open. The publisher's legal identity and monitored contact details have not been supplied. Do not invent them.

## Next development phase

Read [`PHASE-1-DATA-AND-PRODUCT-PLAN.md`](PHASE-1-DATA-AND-PRODUCT-PLAN.md), [`DATA-RESEARCH-STATUS.md`](DATA-RESEARCH-STATUS.md), [`CITY-PRICE-ESTIMATION-METHOD.md`](CITY-PRICE-ESTIMATION-METHOD.md) and [`KEYWORD-DEMAND-VALIDATION.md`](KEYWORD-DEMAND-VALIDATION.md) before extending the project. The location-aware solar MVP is deployed. The November 8 Production smoke verified the Census -> signed location proof -> PVWatts/OpenEI path before the PR #20 Census-resilience update. PR #20's updated lookup code passed six representative integration checks on Preview, including Alaska and Hawaii; a post-merge Production API smoke remains open. The `main` build is indexable and Preview remains noindex; the stable Pages hostname served the homepage and all 24 sitemap URLs with expected crawler/security responses. Custom-domain real-browser verification remains open because automated CI receives a Cloudflare JavaScript challenge. The approved city/state price registry remains empty: there are no approved LBNL city/state solar price rows or AHS metro roofing price rows. OpenEI returns candidates only, not a confirmed household tariff. Editorial authorship/review, independent model/tariff validation, legal/privacy review and accessibility checks remain owner-side gates.

## Site inventory

The project contains 25 HTML documents: 24 sitemap-listed public pages and one dedicated 404 page.

- `index.html` — homepage and combined roof/solar planning calculator.
- `calculators/roof-area.html` — estimated roof surface from a supplied footprint and geometric pitch factor.
- `calculators/roof-replacement-cost.html` — area multiplied by visitor-entered low/high installed rates; no rates are prefilled, the broad national Angi reference requires explicit opt-in, and one selected HomeGuide metal style/system or base-metal category can load its corresponding reference; no local prices are fabricated.
- `calculators/solar-savings.html` — annual solar sizing and scenario valuation with separate direct-use and export flows.
- `calculators/solar-panel-count.html` — panel count from annual use, offset target, modeled production and module wattage, or a quoted system size.
- `calculators/location-solar.html` — location-based typical-year PVWatts production estimator, plus optional tariff discovery.
- `guides/roof-life-by-material.html` — factors affecting service life and inspection decisions.
- `guides/roof-replacement-cost-factors.html` — written proposal-scope comparison worksheet.
- `guides/roof-replacement-cost.html` — price-intent guide comparing separate Angi and HomeGuide national replacement-cost datasets, roof-area units and quote scope.
- `guides/roof-repair-vs-replacement.html` — evidence-linked decision framework for localized repair versus full replacement.
- `guides/roof-repair-cost.html` — separate price-intent guide for leaks, shingles, flashing, underlayment, decking and water-damage repairs; publisher datasets remain separately disclosed.
- `guides/are-solar-panels-worth-it.html` — homeowner solar investment framework covering tariff value, quote price, roof condition, financing and the current Section 25D rule.
- `guides/solar-installation-cost.html` — solar price-intent guide using EnergySage H1 2026 marketplace data, a separate DOE cost-model reference, a PV-only quote-per-watt checker and current Section 25D status.
- `guides/solar-loan-vs-lease-vs-ppa.html` — solar financing comparison covering ownership, loan fees, monthly obligations, tax-credit assumptions, home-sale transfer and a same-scope loan quote calculator.
- `guides/metal-roof-vs-asphalt-shingles.html` — comparison of published costs, estimated service life, metal panel systems and proposal scope.
- `guides/metal-roof-cost.html` — separate cost-intent guide comparing publisher-reported installed ranges by metal type and roof system.
- `guides/understanding-solar-bill-savings.html` — bill-component and solar-value worksheet.
- `guides/roof-before-solar.html` — roof/solar project sequencing and responsibility matrix.
- `electricity-prices-by-state.html` — EIA residential average-price comparison by state, January–August 2026 vs. January–August 2025.
- `methodology.html` — input definitions, formulas, examples and limitations.
- `about.html`, `editorial-policy.html`, `privacy.html`, `terms.html` — public publisher/policy pages. A separate Contact page was removed; the owner still needs to supply a monitored editorial/privacy contact method.
- `404.html` — custom missing-page response; always noindex and excluded from a production sitemap.

Other project files include shared CSS, eleven first-party JavaScript assets, a first-party SVG favicon, the EIA source CSV, QA scripts, Cloudflare Pages `_headers`, a deployment runbook, an owner launch checklist, a noindex sitemap template and this audit report.

## Run locally

To preview the project source directly:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/` for the source pages. This simple server does not execute Cloudflare Pages Functions. To create the clean public document root used for deployment:

```bash
sh scripts/prepare_deploy.sh
python -m http.server 8000 --directory dist
```

Cloudflare Pages Git integration should use build command `sh scripts/prepare_deploy.sh`, output directory `dist`, and repository root `/`. Keep `/functions` at the project root; it is compiled separately from `dist`. Do not publish the repository root, because it contains internal research and QA records. This project does not require `package.json`, `package-lock.json`, `npm install` or a Node build command. A static server does not execute `/api/*` Pages Functions. To test the API routes locally, use `npx wrangler pages dev` from the repository root with a local D1 binding for `API_QUOTA_DB` and local secrets copied from `.dev.vars.example`; see `CLOUDFLARE-DEPLOYMENT.md`. Static pages do not require a database. All three API endpoints require the shared D1 quota database; only PVWatts and OpenEI require provider API keys. The EIA table is a dated static data snapshot.

## Calculator methodology and guardrails

### Roof area

- Geometric pitch multiplier: `sqrt(1 + (rise/run)^2)`.
- When the visitor supplies measured roof surface area, the calculator uses that figure directly and does not apply a second pitch adjustment.
- In the combined calculator's home-area route, above-ground finished floor area divided by story count is only a footprint proxy. It is not measured roof area.
- The standalone tool does not include an arbitrary waste or complexity percentage. Complex roof planes, dormers, overhangs, porches and additions must be separately measured.
- The tools do not inspect the building, establish condition, assess structure or produce a roof plan.

### Roof replacement cost

- Formula: `measured roof area × visitor-entered low/high installed price per roof sq ft`.
- The combined homeowner calculator now loads two clearly labelled, editable national fallback references when no approved local record is available: a broad roof replacement range and a national PV-only solar price-per-watt reference. These are context only, not local estimates, material-specific prices or quotes. The standalone roof replacement calculator offers the broad national Angi reference only after an explicit visitor action. It clears that general reference when Metal is selected and preloads a HomeGuide reference only after one published metal category is chosen. Roof-style/system ranges and base-metal ranges are separate; the tool does not combine them into an unsupported style-by-material estimate. These references are editable and do not represent local prices; there are no automatic city multipliers, pitch premiums, complexity factors or contingency additions.
- Entered low/high rates must already reflect comparable material, local labor, tear-off, disposal, decking, flashing, access, permits, warranty and project scope. The site cannot validate whether those prices are competitive or realistic.
- The material selector is descriptive. For metal roofs, a secondary selector groups HomeGuide-published broad installed-rate references by roof style/system (corrugated sheet metal, standing seam and metal shingles) and by metal material/type (galvanized steel, Galvalume, aluminum, copper, zinc, tin/terne, stainless steel, Corten/weathering steel, metal slate and stone-coated steel). The visitor selects one category only; the source does not provide a complete style-by-material price matrix. The material-category values are converted from HomeGuide installed cost per 100-sq-ft roofing square into dollars per square foot. Provenance is shown, and editing either rate changes the result to a mixed/custom basis. The combined calculator uses only its separately disclosed broad national fallback. Neither is a local or property-specific estimate.

### Solar system size, energy flows and simple payback

- Both solar calculators require annual household electricity use in kWh from utility bills. Neither infers kWh by dividing the total bill dollars by an average rate; fixed charges, demand charges, taxes and other bill components can distort that shortcut.
- Target annual generation = visitor-entered annual household kWh × visitor-entered target percentage.
- Approximate DC size = target annual generation ÷ visitor-entered annual production per DC kW. Derive production per kW from a location-specific NLR PVWatts or equivalent run (modeled annual AC kWh divided by modeled DC kW). The separate city solar estimator can now perform a Census representative-place lookup and request a PVWatts V8 model once the owner configures the server-side key; the standalone savings calculator can receive the city + state and PVWatts yield through the hand-off; it independently checks any available approved LBNL price row before replacing its editable national fallback.
- The permitted 100–4,000 kWh/kW/year production-input range is a broad typo guard only. It is not a claim about U.S. production values. When the city-estimator handoff is used, the modeled PVWatts yield is prefilled, identified by city and model source, and remains editable.
- Self-consumed kWh = `min(annual solar generation × visitor-entered annual direct-use share, annual household kWh)`.
- Exported kWh = `max(annual solar generation − self-consumed kWh, 0)`.
- Modeled annual energy value = `(self-consumed kWh × visitor-entered marginal import rate) + (exported kWh × visitor-entered export credit)`.
- No household consumption, self-use share, actual marginal import tariff or export credit is inferred from location. A city-estimator handoff can show the EIA state-average retail price separately as contextual information. It is not inserted into the marginal import-rate field; the visitor must explicitly click an opt-in button to use it as an illustrative scenario. It is not the customer's tariff. Blank means unknown, not $0. An explicit $0 input is accepted only where the visitor's applicable tariff supports it.
- The import rate is required only when modeled direct-use kWh are positive. The export credit is required only when modeled exports are positive. System size and generation can be shown before tariff inputs are complete; total annual dollar value and payback are withheld when required inputs are missing.
- Simple cash payback = visitor-entered cash system price ÷ first-year modeled annual energy value. It is an undiscounted ratio, not ROI, NPV, IRR, a financing recommendation or a utility-bill forecast.
- This is an annual-share scenario, not an hourly/interval-meter utility-bill simulator. It does not model time-of-use periods, monthly seasonality, fixed charges, demand charges, minimum bills, batteries, export caps, curtailment, degradation, maintenance, inverter replacement, insurance, tax, incentives, financing fees or future tariff changes. The self-use share is a scenario assumption unless independently modeled.

### Field-level validation

- Eight calculator/data-entry pages load `assets/js/field-validation-1.js`. Each visible numeric field displays its range, unit and increment; required text inputs enforce length and a full-value pattern match; selects expose required/optional guidance.
- Hard limits are checked as the visitor types or leaves a field. Plausibility warnings are non-blocking. Paired ranges and mutually exclusive calculation methods have cross-field checks. Hidden conditional fields are not validated until they are shown.
- Calculate/Continue buttons rerun validation at the relevant scope and focus the first invalid field. The system does not erase user input, use modal popups or report an unusual-but-possible value as mathematically impossible.
- This behavior is covered by pure validation tests and a simulated DOM interaction test. It has not been certified in a real browser or with assistive technology.

### Panel count

- Formula: `ceiling(target DC watts ÷ module nameplate watts)`.
- Module count and module surface area are not a roof-fit plan. They omit setbacks, pathways, fire access, spacing, roof-plane geometry, obstructions, shading and structural constraints.

## Geographic installed-price references (separate from calculator inputs)

The two estimator pages now check a source-gated static registry at `data/price-benchmarks.json`. It is deliberately empty in this release: there are **zero approved city/state solar installed-price records and zero approved AHS metro roofing records**. The interface does not turn PVWatts output or EIA electricity averages into installation prices. Solar rows require Berkeley Lab source/license review and sample gates; AHS roof rows must remain metro-level, whole-project nominal-dollar survey distributions and must never be expressed as dollars per square foot or inserted into the roof rate field. The roof estimator continues to use the visitor's comparable written proposal rates. See `CITY-PRICE-ESTIMATION-METHOD.md`, `DATA-RESEARCH-STATUS.md` and `scripts/validate_price_benchmarks.py`.

The price-reference UI tests use synthetic rows to exercise both approval and withholding branches; those rows are not in the public registry and are never packaged as data.

## Official electricity-price reference (EIA)

The state comparison page uses EIA Electric Power Monthly Table 5.6.B, released October 23, 2026, comparing January–August 2026 with January–August 2025. Its 52 rows are 50 states, the District of Columbia and the U.S. total. The U.S. average is 18.19¢/kWh vs. 17.03¢/kWh (+6.8%). EIA marks 2026 data preliminary and 2025 comparison data final.

On October 31, 2026, all 52 state/DC/U.S. value pairs were separately compared against the live official EIA Table 5.6.B with no mismatches. The repeatable `scripts/audit_eia_data.py` check verifies CSV uniqueness, year-over-year arithmetic and HTML/CSV consistency; it does not retrieve EIA data or detect later revisions. EIA listed November 24, 2026 as the next scheduled release at the time of review. Recheck the live table before updating or relying on the page after that date.

EIA average retail price is revenue divided by retail electricity sales and includes generation, transmission, distribution, taxes and fees. It is **not** a homeowner's marginal import rate, current utility tariff or solar export credit. The city-estimator handoff may load it only as a clearly labelled, editable scenario fallback; it must not be described as the selected household tariff or as a verified savings rate.

Official sources: [EIA Table 5.6.B](https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_06_b) · [EIA methodology FAQ](https://www.eia.gov/tools/faqs/faq.php?id=507&t=5).

## Federal homeowner solar-tax note

As of October 31, 2026, the IRS law-change FAQ says the homeowner Residential Clean Energy Credit under Section 25D is unavailable for expenditures after December 31, 2025. For an individual item, the FAQ says the expenditure is treated as made when original installation is completed; paying by the cutoff does not preserve the credit if installation is completed afterward. The FAQ provides a separate timing rule for construction or reconstruction of a structure. The site does not determine individual tax eligibility or model provider-level treatment in leases/PPAs. Check the current IRS source and a qualified tax professional. [IRS 2025 law-change FAQ](https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb).

The DOE Homeowner's Guide to Solar remains useful for roof suitability, planning and utility/export questions, but its live financing section contains historical federal credit figures. The site's guides explicitly warn visitors not to use that section to determine current federal tax eligibility.

## Content and search status

The 12 guides contain practical worksheets and primary-source links, but they are still pre-publication drafts. They do not yet contain original homeowner field research, documented interviews, qualified technical review or named authors. The EIA state page is a source-backed public-data comparison, not original field reporting. This is not enough to claim search authority or predict traffic. Do not mass-produce thin state/city pages to chase keywords; add genuine original research and documented calculator validation instead.

Repository source HTML and `_headers` retain noindex directives for Preview safety. The `main` production build changes public HTML pages (except `404.html`) to `index,follow`, removes the global `X-Robots-Tag: noindex` header and copies `sitemap.xml` into the Production document root. On November 8, 2026, the live Production Pages-hostname smoke verified the homepage, all 24 sitemap URLs, indexable metadata, security headers, `robots.txt`, `sitemap.xml`, `ads.txt`, 404 behavior and internal-file isolation. The apex and `www` hosts remain attached to this Pages project, but automated non-browser requests receive a Cloudflare JavaScript challenge; confirm these two hosts in a normal browser before declaring custom-domain access verified.

Google's people-first guidance and publisher inventory-value rules should be rechecked before launch:
- [Google Search guidance on helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google Publisher Policies: inventory value](https://support.google.com/publisherpolicies/answer/11112688?hl=en)

## Privacy, security and advertising

- Current source has no HTML forms, quote-lead endpoint, inline JavaScript, analytics event code, manual ad tags, tracking-cookie code or local/session storage writes. It does make first-party `fetch` calls to three same-origin API routes for Census city/state place lookup, PVWatts modeling and optional OpenEI tariff discovery, plus a public same-origin static JSON file for separately approved price-reference distributions. The Cloudflare Pages project-level Web Analytics configuration is populated. A real Chromium test on November 8 confirmed that Cloudflare injected and loaded the beacon on the branch Preview; the telemetry POST to `cloudflareinsights.com/cdn-cgi/rum` failed hostname/CORS validation because the Preview used a `pages.dev` host rather than the registered custom domain. Production custom-domain beacon delivery still needs a separate browser verification. The static price file contains no visitor data; the registry currently has no approved records.
- Original roof and annual savings arithmetic is calculated in the visitor’s browser. The location estimator sends a city search term or selected city/state to this site’s API; the server queries US Census Bureau TIGERweb ACS2026 (January 1, 2026 vintage), layers 28 and 30, for incorporated places and Census-designated places. Autocomplete pages the results in bounded 1,000-record requests, returns up to 60 suggestions and discloses when a broad prefix has more matches than can be returned. If a Census source is incomplete, the interface withholds an exact total rather than presenting a partial count as complete. It does not cover every neighbourhood or informal locality. After exact Census verification, PVWatts and OpenEI receive the selected representative coordinates plus the short-lived signed location proof. Both reject arbitrary or altered coordinates before provider quota reservation and upstream requests. The proof is not a property/address check or a user identity. `privacy.html` describes these flows; confirm provider terms, logging and deployment settings before launch.
- Cloudflare `_headers` sets noindex, `nosniff`, a strict referrer policy, frame denial, a restrictive Permissions Policy and a CSP limited to first-party scripts plus the exact Cloudflare Web Analytics beacon URL (`https://static.cloudflareinsights.com/beacon.min.js`); `connect-src` permits same-origin telemetry and Cloudflare's documented manual endpoint. Inline style attributes remain, so `style-src 'unsafe-inline'` is allowed. These are configuration files, not proof of deployed headers.
- HSTS is not enabled. The Production Pages-hostname smoke verified deployed security headers. The apex/`www` browser path and canonical redirect still require a normal-browser check; do not disable Cloudflare Browser Integrity Check solely to satisfy non-browser CI.
No AdSense ad serving is active in the current Production deployment. The main branch contains a guarded loader behind separate build-time and runtime switches. The Production runtime `ADSENSE_ENABLED` variable is absent, and the production build defaults to `/api/*`-only routing unless `ADSENSE_MIDDLEWARE_ENABLED=true` is explicitly supplied at build time. The guarded loader is limited to guides and the EIA reference page; it excludes the homepage and calculators. No manual ad-slot IDs are defined in source, and the AdSense dashboard Auto ads setting has not been independently verified. The repository contains `ads.txt` with publisher ID `pub-6193507831935325`. The current `index.html` contains the AdSense verification meta tag for `ca-pub-6193507831935325`, and `ads.txt` declares the matching publisher ID `pub-6193507831935325`. The owner has confirmed this publisher ID. The tag and ads.txt entry are configured in source; live HTTP accessibility and AdSense dashboard verification/review status are separate checks. No AdSense approval or consent-management readiness is established; do not enable either loader switch before the site and privacy/consent gates are satisfied.
- If advertising/analytics/CMP/contact tools are later added, update the privacy notice, CSP, consent controls and opt-out handling to describe the actual providers, identifiers, cookies, recipients and visitor rights. Qualified legal review is required for the actual publisher and audience jurisdictions.

## Repeatable local QA

Run from the project root:

```bash
python scripts/run_all_checks.py
python scripts/build_release.py
```

The current local QA suite checks 25 HTML pages, unique page titles/descriptions, one H1 per page, labelled controls, skip links and main landmarks, internal links/fragments/assets, explicit numeric input min/max/step attributes, malformed table openings, `target="_blank"` links with `rel="noopener"`, zero inline JS blocks and Node syntax for eleven first-party JS files. Eight calculator/data-entry pages load the shared field validator, which checks each visible input as the visitor edits it, gives inline hard errors and non-blocking plausibility warnings, checks paired fields, and reruns validation before calculation. This is source/DOM test coverage, not browser rendering or usability certification. It also validates the source-gated geographic price-reference registry and UI using empty and synthetic test fixtures; synthetic rows are test-only and are not included in the published registry. It also runs EIA consistency, standalone calculator, combined calculator, privacy guardrail and site-configuration integration tests.

Latest local test counts: roof-area/roof-cost/panel-count 18/18; solar quote-checker regression scenarios 4/4; solar-loan checker regression scenarios 4/4; standalone solar model 10/10; combined calculator 9/9. The separate manual EIA comparison matched all 52 rows on October 31, 2026. A separate lxml HTML parser pass previously read the then-current 26 HTML files with zero parser-recovery errors after four malformed worksheet table openings were fixed; the public inventory has since been reduced to 25 HTML files.

**Browser testing status (November 8, 2026):** GitHub Actions ran the full QA suite, a real Chromium regression covering all 24 public pages, the reported Metal -> second selector behavior, standalone calculator scenarios, the combined homepage calculator's roof/solar/loan flows, and 390px overflow checks on four calculator screens. These tests passed. They do not certify real iOS/Android devices, keyboard-only use, screen readers, WCAG 2.2 AA, 200%/400% zoom, Lighthouse performance, production network behavior through a normal custom-domain browser, or field Core Web Vitals. The separate live Production Pages-hostname smoke passed; apex/`www` automated requests received a Cloudflare JavaScript challenge. Do not overstate browser or accessibility coverage.

## Reproducible release package

`python scripts/build_release.py` builds a ZIP beside the project folder using the folder name, writes `RELEASE-MANIFEST.sha256` and verifies ZIP CRC integrity, unique paths, checksum coverage and exclusions. The package excludes Python caches, Git/OS metadata, temporary audit files, owner-only `launch-readiness.json` and generated `sitemap.xml`. The manifest covers every included project file except the manifest itself.

## Launch blockers that require the real owner or external professionals

1. Supply the legal publisher/owner name, operating entity and jurisdiction, and monitored privacy/editorial contact details.
2. Clear the working brand and domain legally. `getroofsolarcalculator.online` is registered through Hostinger and the apex/`www` hosts are attached to the current Git-connected `roof-solar-toolkit-2026` Pages project. Domain registration and Cloudflare attachment are not trademark clearance. Use USPTO and common-law review and obtain qualified trademark advice.
3. Assign real authors and obtain genuine roofing/PV review. Record actual qualifications, review scope and date; do not fabricate bylines or credentials.
4. Validate solar assumptions against actual utility tariffs, interval/load profiles and real bills; validate roof estimates against measured properties and comparable written proposals.
5. Obtain qualified legal review of Privacy, Terms, advertising disclosures, copyright/IP, accessibility and applicable U.S. federal/state laws for the actual publisher, technology and audience jurisdictions.
6. Cloudflare Pages is configured as the free-first host. Both custom domains are attached to `roof-solar-toolkit-2026`; Production deployment commit `907de6f37610136572bea80bac2626051b640941` (Cloudflare deployment `815de0b3-026b-4b79-a4ea-00df771f34f6`) is the current canonical deployment (checked November 8, 2026). Do not change DNS or custom-domain attachment without an approved reason and rollback plan. The Pages-hostname crawler smoke passed; normal-browser verification of apex/`www` and canonical redirects remains open. Cloudflare Web Analytics is configured at project level, but active beacon delivery remains unverified. AdSense/CMP activation remains conditional on Google approval and legal/consent review.
7. Run real desktop/mobile browser, keyboard-only, screen-reader, zoom, touch-target and production-header checks. Measure lab performance after deployment and field Core Web Vitals when traffic exists.
8. Add original reporting and practical evidence that makes each guide/tool materially more useful than generic summaries.
9. Production indexing is already enabled by the current `main` build script. Verify live robots metadata, response headers, `robots.txt` and `sitemap.xml` before Search Console submission; if any release gate requires suppression, make that a deliberate, separately reviewed change rather than assuming indexing is still disabled.

**Current decision (November 8, 2026):** Production is deployed and indexable. The stable Pages hostname's crawler-facing output and all 24 sitemap pages passed live smoke checks; the custom apex/`www` normal-browser path remains unverified. The owner reports that the AdSense review request has been submitted, but approval is not established. Real publisher identity/contact, named authors and qualified reviewers, independent calculator/tariff validation, legal/privacy/consent review, manual accessibility checks, Search Console monitoring and a representative Functions/D1 usage review remain unresolved. Ad-serving code and ad placements remain disabled.


## Location-aware solar MVP (deployed)

A city-based solar production estimator is now included at `calculators/location-solar.html`.

- City-first lookup uses a same-origin Cloudflare Pages Function and US Census Bureau TIGERweb ACS2026 (January 1, 2026 vintage), querying Incorporated Places (layer 28) and Census Designated Places (layer 30). Suggestions show the state/territory, handle same-name places, and page up to 5,000 records per layer before warning the visitor to narrow broad prefixes. The visitor selects the relevant place; a manual state/territory fallback still requires exact Census verification. This is not a complete address or every-locality search. The returned internal representative point is not a property coordinate.
- NLR PVWatts V8 is called through a server-side Pages Function. Visitors explicitly enter DC capacity, array tilt, azimuth and system losses. The output displays annual and monthly AC production, assumptions, source, response timestamp, limitations and model-station distance converted from NLR metres to miles.
- A hand-off can prefill the combined calculator and standalone solar tools with PVWatts annual production per kW. It also passes EIA state-average price context, but that value is not applied to the marginal tariff input unless the visitor explicitly opts in to an illustrative scenario. An approved LBNL city/state installed-price distribution, if and only if a record passes all publication gates, can replace the national solar-price fallback; the registry currently has no approved records. These values remain editable. Household consumption, self-use share, actual marginal tariff, export compensation and property-specific quotes are not inferred.
- Optional OpenEI URDB lookup returns nearby residential tariff records for manual verification only. It does not automatically identify the correct utility or calculate bill savings.
- `PVWATTS_API_KEY` and `OPENEI_API_KEY` are server-side secrets. All three API routes additionally require the `API_QUOTA_DB` D1 binding and migrations `0001` and `0002`; they fail closed without it. Preview passed live API requests on November 4, 2026. The HMAC proof is issued only after exact Census location verification and is required by both provider proxies. On November 8, 2026 the Production live smoke verified the full Census -> signed proof -> PVWatts/OpenEI path; secret values were not read or logged. Preview and Production reference the same D1 database ID, so quota usage is aggregated across environments. This is a known monitoring/attribution constraint; do not change database bindings without a tested plan. Do not put API keys or signing material in client-side code.
- `_routes.json` limits Function invocation to `/api/*`; this protects free static asset delivery from unnecessarily invoking a Function on every page request.

See `CLOUDFLARE-DEPLOYMENT.md` for configuration, cost limits, local testing and launch cautions.

## Live Preview smoke verification

The local QA suite uses mocked upstream responses. For a real network check, `.github/workflows/qa.yml` has an opt-in `live-preview-smoke` job. It runs after the local suite only when a push commit message contains `[live-smoke]`. It waits for the audit-branch Pages alias to expose the ACS2026 Census build, checks live city autocomplete and exact Census coordinates, then requests one real NLR PVWatts V8 calculation and one OpenEI candidate lookup. The November 4, 2026 Preview test passed all four live checks: Census autocomplete, exact Austin coordinates, PVWatts (1,483 kWh/year for 1 kW DC) and OpenEI (49 nearby residential tariff candidates). This confirms API integration, not tariff applicability. The test consumes quota reservations. A passing smoke test does not replace browser, accessibility, privacy, tariff or production testing.

## Data research scripts

Two optional local analysis scripts are included:

- `scripts/analyze_berkeley_solar.py`: screens LBNL Tracking the Sun public CSV rows (2024–2025 installation years by default) and creates city/state descriptive summaries of nominal installed dollars per DC watt. It uses a strict host-owned residential PV-only rooftop cohort, requires explicit non-TPO flags, excludes self-installed, expansion and multi-phase systems, suppresses low-sample groups and writes research-only output. It does not publish raw records and blocks commercial use pending current LBNL licence confirmation and independent review.
- `scripts/analyze_ahs_roof.py`: analyzes the 2023 AHS National PUF relational PROJECT/HOUSEHOLD files and joins them by `CONTROL`. The official Value Labels package confirms `JOBTYPE=16` is Added or replaced roofing. It uses the C-16-OO owner-occupied/interviewed universe (`TENURE=1`, `INTSTATUS=1`), `JOBDIY=1/2`, `JOBCOST>0` for median/mean and `JOBCOST>=0` for total expenditure. A real PUF run reproduces the C-16 PUF point estimates at displayed precision: weighted project count 8,300,625, median $10,000, mean $11,610 and total $93.526 billion. Its Fay-BRR 90% margins differ modestly from Table Creator MOEs and remain under review. Top 15 National-PUF subgroup outputs are research-only diagnostics, not cleared metro estimates. The script does not calculate individual-city pricing or dollars per square foot; no AHS figures are in the public registry.

These scripts do not download source datasets. The source microdata files are not bundled in this ZIP. No LBNL city/state price values have yet been computed from the real file or approved for publication. See `DATA-RESEARCH-STATUS.md`.


## City-level market data (partially wired; price registry still withheld)

- Solar: Berkeley Lab's official August 2026 release record describes roughly 5.3 million systems overall through end-2025. The 2026 user guide (eight pages) has been downloaded and text-inspected; it documents the current cohort's key fields. Its public CSV link redirects through Google Drive, and retrieval is being handled by a temporary-runner downloader. The actual public CSV row count, value codes and strict cohort output remain pending. Commercial reuse rights must be confirmed in writing or by a clear current licence before any derived commercial price table is used. The live registry remains empty; no solar price output is approved. If no approved local row is available, the combined calculator uses a clearly labelled national EnergySage H1 2026 reference of $2.62/W as editable context—not a city estimate or quote.
- Roofing: there is no complete nationwide official city-level roof replacement price file. The 2023 AHS supports selected metro-level project-cost analysis (Top 15 major metros in the National PUF), but the PUF calculations, code mapping, weighted estimates and margins must first be reconciled to official Census Table C-16. The runtime registry/handoff supports only approved metro records as contextual whole-project spending distributions; it deliberately does not turn those values into $/sq-ft. The combined calculator currently uses a broad editable Angi national $4–$11 per roof-surface sq-ft reference when no better comparable quote/rate is entered. It is not local, material-specific or a guaranteed installed price. Municipal permit valuations are not verified final invoices.
- City selection: the solar estimator uses the Census TIGERweb 2026 Incorporated Places and Census Designated Places layers. It resolves a city/state to a Census representative point; that point is a location proxy for PVWatts, not a citywide mean or the visitor's roof coordinates.


Census/HUD's 2023 AHS infographic reports a $10,000 national median roofing expenditure for 2021–2023. This is an owner-reported national home-improvement statistic, not a current contractor quote, local estimate or $/sq-ft benchmark.

The research script uses the 2023 relational PUF's `PROJECT` and `HOUSEHOLD` CSV files. It expects generic PUF project fields (`JOBTYPE`, `JOBCOST`, `JOBDIY`) and household keys/weights (`CONTROL`, `TENURE`, `INTSTATUS`, `WEIGHT`, `REPWEIGHT1` through `REPWEIGHT160`). It does not use the similarly named questionnaire fields such as `ROOFAM` or `ROOFWK`.

Example after downloading and extracting the matching 2023 National PUF relational files from Census:

```bash
python scripts/analyze_ahs_roof.py \
  --project-input /path/to/project.csv \
  --household-input /path/to/household.csv \
  --roof-job-type-code VERIFIED_ROOF_JOBTYPE_CODE \
  --output /path/to/ahs-roof-research.csv
```

The script is diagnostic/research-only. It includes Census-edited/imputed values, outputs approximate weighted percentiles/replicate intervals, and must be reconciled to Census's Table Specifications and PUF Estimates workbook before any figures are published. The official PUF file was not available in the build environment, so synthetic test fixtures are not evidence of actual survey results.


## November 1, 2026 — metal vs. asphalt comparison guide

Added `guides/metal-roof-vs-asphalt-shingles.html` around the homeowner comparison intent. It keeps HomeGuide and Angi cost ranges separate, labels their publisher methodologies, uses HUD 2015 estimated service-life ranges with limitations, and includes a quote-scope comparison checklist. It links to the roof cost calculator, roof lifespan guide and repair-vs-replacement guide. Page remains noindex in Preview; Production indexing is controlled by `scripts/prepare_deploy.sh`.


## Editable source-backed starting values

- The standalone solar savings calculator starts with an editable $2.62/W DC national solar-only marketplace reference (EnergySage H1 2026, published October 7, 2026). It is not represented as a local price or an installer quote. A selected city/state can replace it only when the public benchmark registry contains a matching approved LBNL record and the browser independently rechecks the publication, sample, date, source and licence-review gates. Any visitor edit takes ownership of the displayed value.
- The standalone roof replacement calculator starts with no rates; the visitor may explicitly load the Angi national $4–$11/roof-sq-ft reference. It is cleared when Metal is selected; choosing one metal style/system or base-metal category loads its matching disclosed HomeGuide reference. It is not a local roof price.
- The city/state PVWatts handoff now carries location context into the standalone savings calculator. Personal household use, direct-use share, and export compensation remain unfilled because the website cannot know those household-specific facts without a bill or load analysis.
