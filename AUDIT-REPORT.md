# Roof & Solar Toolkit — comprehensive pre-launch audit

**Audit date:** November 1, 2026 (engineering follow-up)  
**Status:** Corrected static prototype. **Not ready for public indexing or ad-network application.**  
**Scope:** legal/factual accuracy, calculator arithmetic, defaults, source quality, SEO, editorial trust, ad policy, privacy, accessibility, security, performance and deployment readiness.

## Executive decision

This is now a more defensible prototype, but it is not a finished publisher. The audit found real contradictions between code and previous audit notes: a 50% self-use default and an 80% solar-generation default were still present; old methodology text said blank export credit meant zero; the solar input logic did not handle export-only and zero-import-rate edge cases correctly; the homepage had an inline form submission path and a story-count default; and the homepage script did not match the external script targeted by the deployment CSP. Those defects have been corrected and the documentation consolidated to one current version.

A second markup pass found four malformed worksheet table openings (the `<table>` start tag was missing its closing `>` before `<thead>`); all four were corrected. A separate lxml parse initially processed the 17-page build with zero recovery errors; the location-aware addition increases the current inventory to 18 HTML documents. The owner has since supplied a registered working domain (`getroofsolarcalculator.online`, Hostinger); it has not been connected or deployed. The largest remaining risks cannot be solved by adding more HTML: no real publisher identity, bylines, expert review, legal advice, live tariff validation, utility-bill validation, deployed site or completed real visitor/device testing exists yet.

## 1. Legal and factual source audit

### Federal residential solar credit

- The build describes only the homeowner Residential Clean Energy Credit under Section 25D. The IRS 2025 law-change FAQ says the credit is not allowed for expenditures after December 31, 2025.
- For an individual item, the IRS FAQ says the expenditure is treated as made when original installation is completed; payment by the cutoff does not preserve the credit if installation is completed afterward. The FAQ states a separate timing rule for construction/reconstruction of a structure.
- The site does not determine a person's eligibility, does not calculate tax credits and does not claim that the tax treatment of a third-party lease/PPA is identical to homeowner ownership.
- **Source conflict discovered:** the IRS general consumer page contains the updated cutoff but still includes older phase-out wording elsewhere on that same page. The build relies on the detailed 2025 law-change FAQ for timing instead of repeating the inconsistent legacy language. Source: [IRS FAQ for the 2025 law change](https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb).

### DOE guide carries stale federal tax figures

The live DOE Homeowner's Guide to Solar page is useful for roof suitability, project planning, utility export/net-metering questions and basic savings factors. However, its financing section still displays historical 26%/22% tax-credit figures for 2020–2023 and says the credit expires starting in 2024. That is stale for a 2026 reader. The site now warns readers that the DOE page is cited only for suitability/planning/utility topics and must not be used to determine current federal tax eligibility. Current Section 25D timing is linked to the IRS FAQ above. Source: [DOE Homeowner's Guide to Solar](https://www.energy.gov/cmei/systems/homeowners-guide-solar).

### Electricity prices

- The static reference page uses EIA Electric Power Monthly Table 5.6.B, released October 23, 2026, with January–August 2026 compared with January–August 2025.
- It includes 52 entries: 50 states, DC and U.S. total. 2026 data are labelled preliminary; 2025 comparisons final as EIA identifies them.
- U.S. YTD comparison in this snapshot: 18.19¢/kWh versus 17.03¢/kWh (+6.8%). EIA average retail price includes generation, transmission, distribution, taxes and fees; it is not a utility tariff, marginal import rate or export credit.
- On October 31, 2026, all 52 state/DC/U.S. CSV value pairs were separately compared against the live official EIA Table 5.6.B; no value mismatches were found. This was a one-time manual source cross-check, separate from the repeatable CSV-to-HTML test.
- The repeatable CSV-to-HTML QA checks internal consistency only; it cannot independently retrieve EIA values or detect later source revisions. EIA listed November 24, 2026 as the next scheduled release at audit time. Recheck the live table before any update or publication after that date.
- Sources: [EIA Table 5.6.B](https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_06_b) and [EIA FAQ on average prices versus utility rates](https://www.eia.gov/tools/faqs/faq.php?id=507&t=5).

### Roofing and solar source limitations

- NRCA homeowner materials are used for the need to compare written proposal scopes and the variability of roof service life/project costs. No universal service-life range or national price is asserted as a property-specific fact. [NRCA homeowner resources](https://www.nrca.net/roofing-guidelines/resources).
- DOE sources are used for solar economic variables and roof replacement coordination, not as a live local tariff or professional design. Utility rules, codes, tariffs and licensing are local and must be confirmed with the actual authority/utility/professional.
- PVWatts is a visitor-directed planning model; its output is not a site-specific engineering design or guarantee. [NLR PVWatts](https://pvwatts.nlr.gov/pvwatts.php).

### Legal clearance remains open

Privacy, Terms and publisher pages remain templates. No US/state privacy-law, consumer-protection, accessibility, tax or advertising-law opinion has been obtained. The actual legal publisher identity, country/entity, domain, host, ad-tech stack, visitor jurisdictions, contact channel and operational rights process are not known. Qualified counsel must review the real service and actual data practices. No invented owner name, address, credential, date or legal assurance has been inserted.

## 2. Calculator engineering and numerical assumptions

### Defaults removed

- Main combined calculator: no default roof material, roof area, home-area story count, roof pitch, local roof cost rates, annual electricity kWh, marginal import tariff, direct-use share, export credit, solar production assumption, installed price, APR or loan term. The visitor must enter a target solar generation percentage; it no longer pre-fills 80%.
- Standalone solar calculator: no default annual kWh, target generation percentage, production-per-kW, direct-use share, import rate, export credit or installed price.
- Standalone roof area: no default footprint or pitch; applies only the geometric pitch multiplier. No arbitrary complexity or waste percentage is added; additional roof planes must be separately measured.
- Standalone roof cost and panel-count tools have no sample roof area, target DC kW, panel wattage or panel area prefilled.
- Descriptive UI choices such as “condition unknown” do not change a numerical estimate.

### Roof area and replacement

- Pitch factor = `sqrt(1 + (rise/run)^2)`. Approximate values: 2:12 = 1.014; 4:12 = 1.054; 6:12 = 1.118; 9:12 = 1.250; 12:12 = 1.414.
- If measured roof surface is supplied, it is used directly; pitch is not applied twice.
- When floor area is used as a footprint proxy, a story count is required. Floor area divided by stories is still not a measured footprint.
- Roof replacement cost = measured roof area × visitor-entered low/high installed rate. There are no national/local price defaults, material multipliers, pitch premiums, unexplained complexity factors or automatic contingencies. Entered rates must already match the intended material and comparable written project scope.
- The roof-area tool cannot measure complex geometry. Neither roof calculator diagnoses structural condition or replacement need.

### Solar system sizing and annual energy value

- Both tools require annual household kWh from utility bills; neither divides total bill dollars by a price per kWh because fixed charges, taxes and demand charges can distort that inference.
- Target annual generation = annual household kWh × visitor-entered target share. The main combined calculator validates 5%–100%; the standalone solar calculator validates 1%–100%.
- DC size = target annual generation ÷ visitor-entered annual production per DC kW. Production input should come from a location-specific PVWatts or equivalent model; the site's broad 100–4,000 kWh/kW validation is a typo guard, not a U.S. benchmark.
- Self-consumed kWh = `min(annual generation × visitor-entered annual direct-use share, annual household kWh)`.
- Exported kWh = `max(annual generation − self-consumed kWh, 0)`.
- Modeled annual energy value = `(self-consumed kWh × visitor-entered marginal import rate) + (exported kWh × visitor-entered export credit)`.
- Blank direct-use share or tariff field means unknown. A blank export credit is **not** $0. Explicit $0 is valid where the actual tariff supports it. A marginal import rate is required only when self-consumed kWh are positive; an export-only scenario does not need an import-rate input. An export credit is required only when exports occur.
- Both solar tools can show system size and annual generation before the tariff inputs are complete, but withhold a total annual dollar value and simple payback where required inputs remain unknown.
- Simple cash payback = entered cash price ÷ modeled first-year annual energy value. It is an undiscounted ratio, not ROI, NPV, IRR, an electricity-bill projection or financing recommendation.
- This is an annual-share scenario, not interval-meter/hourly modeling. It omits time-of-use periods, seasonality, demand charges, fixed charges, minimum bills, battery dispatch, export caps, curtailment, degradation, maintenance, inverter replacement, insurance, tax, incentives and future tariffs. Actual tariff and load-shape validation by a solar/PV professional remains necessary.

### Panel count

Panel count = ceiling(target DC watts ÷ module nameplate watts). Module surface area is not a roof-fit plan and excludes gaps, access, fire setbacks, roof planes, obstructions, shade and structure.

## 3. SEO and search intent

- All 18 current HTML documents use `noindex,follow` (the 404 remains noindex even when indexing is enabled); `_headers` also sends `X-Robots-Tag: noindex, follow`.
- There are 17 unique titles and 17 unique non-empty meta descriptions, exactly one H1 per page, English `lang`, one viewport declaration, unique IDs and valid skip-link/main landmarks.
- No production canonical URLs or valid sitemap exist because no real domain was provided. `sitemap.template.xml` is an example only.
- The state-price page is a useful public-data reference but is not original field research. Four homeowner guides and calculators are not yet differentiated enough to establish strong search competitiveness. Real authorship, expert review, original tests/analysis and documented updates are missing.
- Google people-first guidance asks for useful, reliable, original content and clear experience/expertise; page count and tool count are not a substitute. [Google Search Central guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).
- Do not mass-produce thin ZIP/city pages. A better path is original documented comparisons, quote-scope education, real tariff case studies and transparent calculator validation.

## 4. Advertising and monetization

- Ad blocks are placeholders; no ad network, publisher ID, `ads.txt`, tracking, analytics or consent-management platform is connected.
- Google disallows ads on low-value-content and under-construction screens. The current draft should not be submitted for AdSense approval. [Google inventory-value policy](https://support.google.com/publisherpolicies/answer/11112688?hl=en).
- The FTC says native-ad disclosures should be clear, prominent and close to the content they identify. Any later sponsorship, affiliate or native-ad arrangement must be disclosed conspicuously and not disguised as editorial content. [FTC Native Advertising guide](https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses).
- Recent Reddit reports from calculator/tool publishers are anecdotal and mixed. They are not policy thresholds or approval evidence. They reinforce that functional tools or page count alone do not ensure acceptance.
- No RPM, traffic estimate, revenue projection or approval guarantee is made. Real revenue requires audience, geography, pageviews, viewability, advertiser demand, content quality and network eligibility.

## 5. Privacy, user data and legal policies

- The location-aware solar MVP adds three documented same-origin API routes and a public same-origin static JSON price-reference registry. The static registry contains no visitor data; it is fetched without credentials and has no third-party calls. The browser sends city/state inputs to the site location route and sends selected Census representative coordinates plus array inputs to the PVWatts route; the optional OpenEI route receives representative coordinates. Pages Functions query Census TIGERweb, NLR PVWatts and OpenEI. Original roof/savings arithmetic remains in the browser. There are no lead forms, quote submissions, customer database, analytics, ad tags, third-party browser scripts, cookies or local/session-storage writes.
- A host may still process IP/browser/request logs. Once ads, analytics, CMP, email/contact forms, embedded content or other third-party technology is added, disclosures and CSP must be updated to match the actual services.
- Privacy and Terms remain drafts. The privacy notice now describes the Census city/place, PVWatts and OpenEI server-side data flows, but the owner must verify provider terms, server logs, retention and applicable rights/opt-outs for the actual deployment. No blanket “no data collection” guarantee is made.
- Legal review is required after the actual publisher, host and ad stack are known. The website cannot certify compliance with US federal/state privacy, advertising, accessibility or consumer laws in the abstract.

## 6. Accessibility and usability

- The latest static audit detected 47 labelled interactive controls. The homepage calculator and standalone location estimator use labelled controls, not submitting HTML forms.
- Each of the 18 HTML documents is checked for a skip link and a matching `main#main-content` landmark. The four malformed worksheet table openings found in the prior markup review were corrected. A fresh strict lxml parse of the current 18-page source completed with zero recovery errors before packaging.
- Radio groups have programmatic names; shared CSS includes focus-visible and reduced-motion rules; comparison tables are horizontally scrollable labelled regions.
- Static contrast/markup review is not WCAG certification. No real browser keyboard-only, screen-reader, voice-control, magnification, touch-target or physical-device evaluation has been completed.

## 7. Security, performance and code quality

- Eight first-party JavaScript files are externalized; no inline JS remains. Node syntax checks pass.
- `_headers` includes `nosniff`, a strict referrer policy, frame denial, a restrictive permissions policy, a CSP that permits first-party scripts only and pre-launch noindex.
- Inline style attributes remain, so `style-src 'unsafe-inline'` is retained; JavaScript is not granted `unsafe-inline` or `unsafe-eval`.
- The browser CSP permits same-origin API connections only and no third-party scripts or frames. Upstream API calls occur server-side from Pages Functions; future ad/analytics/CMP browser origins require a narrowly scoped CSP and matching privacy disclosure.
- HSTS is not configured until a final domain and HTTPS are confirmed. Header files are not evidence of deployed HTTP headers.
- The environment blocked Chromium navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; therefore browser rendering, responsive layout, network waterfall, Lighthouse, field Core Web Vitals and deployed response headers are not certified.

## 8. Deployment readiness

- A Cloudflare Pages static-site deployment runbook and `_headers` configuration are included. Current Cloudflare Pages docs (checked October 31, 2026) state the Free plan permits 500 builds/month, 20,000 files and 25 MiB per file; this project is far below those limits. Git integration cannot later be switched to Direct Upload for the same project, so that choice is documented. Sources: [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) and [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).
- `scripts/configure_site.py` inserts canonical/OG URLs in safe noindex mode. Indexing is a separate explicit opt-in that also generates `sitemap.xml` and changes `robots.txt`/headers; the custom `404.html` stays noindex and is excluded from the sitemap. Integration tests use a temporary copy.
- No GitHub repository, Cloudflare account, real domain, DNS, HTTPS, Search Console, ad network, CMP or analytics provider has been configured.

## 9. Repeatable QA run

Commands executed from the project root:

```bash
python scripts/run_all_checks.py
python scripts/build_release.py
```

Latest recorded results after current edits:

- Historical October 31 baseline: 17 HTML documents, 17 unique titles/descriptions, 39 labelled interactive controls and six JS files syntax-checked. Current November 1 inventory: 18 HTML documents, 18 unique titles/descriptions, 47 labelled interactive controls, zero inline JS blocks and eight first-party JS files syntax-checked.
- EIA audit: 52 unique entries; Y/Y arithmetic and CSV-to-HTML matches passed. Separately, all 52 state/DC/U.S. data pairs were manually matched to the live EIA table on October 31, 2026 with zero mismatches.
- Standalone solar logic: 10/10 scenarios passed.
- Combined calculator logic: 9/9 scenarios passed.
- Roof-area, roof-cost and panel-count logic: 12/12 cases passed.
- Site-configuration integration tests passed safe mode, canonical/OG insertion, enable-indexing, revert-to-safe, sitemap/robots changes and invalid-domain cases.
- Privacy guardrail tests passed: no HTML forms, external scripts, inline JavaScript, browser storage/cookie APIs, direct third-party browser API calls, prefilled self-use/export assumptions, unselected story-count default or obsolete publisher placeholders. The location estimator's three first-party API routes are explicitly allowlisted and documented; their server-side upstream data flows are described in `privacy.html`. A fourth first-party static JSON fetch serves the price-reference registry and carries no visitor inputs.
- Release builder passed: ZIP CRC, unique paths, expected file inventory, SHA-256 manifest coverage and exclusion of cache/owner-only files.

These calculator tests use deterministic DOM stubs to execute the actual JavaScript. They do not reproduce full browser behavior, actual tariffs, electrical design, structural engineering or a professional quote. The repeatable EIA audit checks internal consistency against the stored CSV; the separate manual comparison to the live EIA table is a dated one-time check and does not guarantee against later EIA revisions. Chromium navigation was blocked with `ERR_BLOCKED_BY_ADMINISTRATOR`, so no end-to-end browser/device test or Lighthouse run is claimed.

## 10. Release packaging

- `scripts/build_release.py` creates a deterministic ZIP with a SHA-256 checksum manifest, verifies every packaged file and excludes Python caches, Git/OS metadata, temporary audit files, owner-only launch attestation and generated sitemap.
- `scripts/run_all_checks.py` runs the offline QA suite in a fixed order and stops on the first failure.
- The checksum manifest covers all project files in the ZIP except the manifest itself; the builder verifies the manifest coverage against ZIP members.
- The release builder uses fixed ZIP timestamps and a SHA-256 manifest. The current archive is rebuilt and checked at the end of this run; its exact member count, byte size and SHA-256 are recorded from the generated file rather than reusing the October 31 package figures.
- A strict lxml parse of all 18 HTML documents is run on the current source before release packaging. A successful parse is still not a substitute for a browser's HTML/CSS/DOM behavior.

## 11. Outstanding owner/professional launch gates

1. Actual legal publisher/owner name, operating entity/location and monitored contact details.
2. Final brand and domain; live domain registration plus trademark/common-law clearance. “Roof & Solar Toolkit” is not cleared.
3. Genuine author identities, biographies, publication dates and qualified roofing/PV technical review performed and dated.
4. Independent validation against real roof measurements, written roof proposals, solar proposals, interval/load profiles and actual utility tariffs.
5. Qualified legal review of Privacy, Terms, advertising disclosures, IP/copyright, accessibility and applicable US/state consumer and privacy law.
6. Selected host, domain, DNS/HTTPS, Git repository, Search Console, ad network, analytics and (where required) CMP; all production privacy and CSP changes tested.
7. Real desktop/mobile/keyboard/screen-reader/magnification tests, deployed header/security checks and Core Web Vitals.
8. More original reporting and practical evidence than the current generic guides and public data transcription.
9. Owner decision to enable indexing only after applicable gates pass; separate ad-network eligibility decision.

**Final verdict:** all currently reproducible source-level checks pass, but the project remains a pre-launch prototype. It is not legally certified, professionally engineered, browser-certified, search-competitive or ad-network-approved. Do not index or apply for ads yet.


## 10. November 1 engineering follow-up

- Added a Census city/state representative-place lookup, server-side PVWatts V8 proxy, optional OpenEI nearby-rate candidate discovery, EIA state-average benchmark display, and explicit result limitations. API keys remain server-side and endpoints return a not-configured response until the owner adds secrets.
- Corrected PVWatts `capacity_factor` handling: V8 returns percent units (e.g. 11.79 means 11.79%), so the output is not multiplied by 100. Corrected climate-station distance handling: NLR reports metres, and the interface now converts that value to miles before display.
- Corrected OpenEI effective-date formatting to support the documented Unix timestamp representation, while tolerating YYYYMMDD and ISO-date strings.
- Hardened the location estimator against blank numeric fields, stale requests and outdated savings-calculator hand-offs.
- Rebuilt the AHS research script around the relational PUF project schema (`JOBTYPE`, `JOBCOST`, `JOBDIY`) rather than questionnaire-only `ROOFAM` / `ROOFWK` / `ROOFYRCST` fields. It joins to interviewed owner-occupied HOUSEHOLD records by `CONTROL`, uses `WEIGHT` and 160 replicate weights, includes zero-cost and Census-edited/imputed PUF values under an intended C-16-OO-style exploratory universe, and labels all output research-only. Exact universe equivalence has not been demonstrated. Census/HUD’s official 2023 infographic reports a $10,000 national median roofing expenditure for 2021–2023. The official PUF archive could not be downloaded here, so no PUF estimates have been generated or reconciled. The weighted quantiles/intervals and roofing `JOBTYPE` code remain unverified; the script now requires an explicit code rather than silently assuming `16`, and the code must be reconciled against the official Census value-label package and PUF verification workbook.
- Re-ran all local checks on November 1: 18 HTML pages, source/asset/anchor/header audit, EIA consistency, 12 standalone roof/panel tests, 10 standalone solar cases, 9 combined-calculator cases, privacy checks, mocked API tests, location UI tests, SQLite-simulated D1 quota SQL tests, research-script synthetic fixtures and site-configuration tests all passed. The AHS synthetic fixture covers PUF-style `JOBTYPE` / `JOBCOST` / `JOBDIY` fields, owner/interview filters, quote-wrapped CSV tokens, 160 replicate weights, zero-cost inclusion, invalid statuses/costs and unmatched projects. Synthetic fixtures do not establish real PUF data accuracy.
- Added D1-backed, fail-closed shared quota reservations: Census place lookup is limited to 60 requests per fixed 15-minute bucket and 10,000 per UTC day; PVWatts is limited to 180 per bucket (no more than 900 in any rolling hour) and 15,000 per day; OpenEI is limited to 60 per bucket and 5,000 per day pending confirmation of any provider limit. The migration creates at most three aggregate rows (Census, PVWatts and OpenEI) with no visitor identifiers. The exact UPSERT is exercised against local SQLite for caps and rollovers; this is not a live D1 binding or cross-edge concurrency test. Census and OpenEI caps are 60 per fixed 15-minute bucket (which can permit up to 300 in a sliding hour spanning five buckets). Owner must still create the D1 database, apply the migration and bind `API_QUOTA_DB`.
- Browser/device visual QA and live provider API tests remain uncompleted. Chromium headless smoke testing could not complete in this execution environment. No owner API keys or D1 database were available.
- No deployment, DNS change, indexing, advertising integration, domain transfer or paid service was activated.

- Berkeley Lab licensing check: Data.gov lists CC BY 4.0 on an older Tracking the Sun catalog record last updated in 2024, while Berkeley Lab's general terms reserve copyright unless a different license is explicitly designated. This is not sufficient evidence that the 2026 CSV carries CC BY. Written confirmation or a current explicit dataset license is still required before commercial reuse.


## November 1 city-market data follow-up

- Replaced the earlier ZIP-postal place resolver with the official US Census TIGERweb Current 2026 Incorporated Places and Census Designated Places layers. The endpoint accepts city + state, returns Census internal representative points and clearly distinguishes incorporated places from CDPs. It does not resolve a parcel or roof. The live Census REST request was not executed from this environment; mocked endpoint tests pass and the live service schema was checked from the official metadata.
- Reworked `scripts/analyze_berkeley_solar.py` to create city/state descriptive installed-price distributions from the 2026 LBNL public CSV when the owner obtains it. The default cohort is 2024–2025, residential single-family/RES, PV-only, non-ground-mounted, 1–25 kW DC, explicitly host-owned in both ownership fields, not self-installed, not expanded and not multi-phase. City groups require at least 100 records by default; states require 500. The test fixture verifies case-only city spelling aggregation, state identification, coverage thresholds and exclusion of unknown/third-party ownership and other edge cases. No real LBNL data has been downloaded or analyzed.
- Commercial reuse remains blocked pending explicit confirmation of the August 2026 public CSV's licence. City data are not guaranteed complete or representative; any eventual outputs must include sample count, installation years, nominal-dollar basis, exclusions, and a prominent historical-not-quote label.
- Roof permit feasibility: San Francisco's official PermitSF dataset includes reroof permit records and a `valuation` field, but that field is a declared permit valuation, not a verified final invoice. Municipal permit data may support carefully labelled local permitting indicators in selected cities; it is not a nationwide homeowner-price database and cannot currently be used as an installed-price estimator without jurisdiction-specific validation.
- Updated the Berkeley synthetic research fixture to test city/state outputs and stricter cohort filters. All new tests pass.


## November 1 municipal permit source verification

- The official City of San Francisco PermitSF dataset was checked through its DataSF/Data.gov metadata on November 1, 2026. The catalogue says the PermitSF portal began rolling out in February 2026, the dataset is updated four times per day, and the published type set includes “Reroofing permit (no plans)”. The current column metadata reports 11,581 total records and 1,725 records with `recordtype = Reroofing permit`; these are portal records, not 1,725 completed single-family roof replacements.
- The `valuation` field is text, with 10,946 non-null values across the *entire* 11,581-record dataset. This is not a reroof-only completeness rate, and no reroof-only median or price distribution has been computed. The `status_detail` column's description lists a set of statuses that conflicts with its cached values, which include “Complete”. That needs a source-owner clarification before status-based cohort selection.
- The inspected PermitSF column schema did not expose a roof-area/square-footage field, so it cannot currently support a credible roof $/sq-ft estimate. A declared permit valuation is not a final paid invoice. The Data.gov catalogue lists PDDL 1.0 for this dataset; check the live publisher terms before any reuse.
- Extended `scripts/analyze_ahs_roof.py` to produce exploratory Top 15 metro outputs using the household `OMB13CBSA` field in addition to national summaries. Census documentation states these AHS Top 15 areas use February 2013 OMB CBSA boundaries held constant through 2023. The script is still unrun on real PUF data; the roofing `JOBTYPE` code, project universe, quantile/replicate variance and metro values require reconciliation against Census Table C-16. A current-city-to-2013-CBSA spatial crosswalk has not been implemented, so no metro estimate can yet be attached to a selected city in the live tool. Synthetic fixture test passes only.
- The official Miami-Dade ArcGIS schema exposes `SquareFootage` and `EstimatedValue` as text fields, but the `SquareFootage` field has no published definition proving it contains roof-plan area; a reroof sample from a secondary mirror showed zero. The county requires roof-area information in some permit application materials, but this does not establish that the public layer exports it. Do not calculate $/sq-ft from this field without confirmation or a record-level validation. We have not validated actual reroof permit categories, completed-project definitions, municipality assignment, sample size or redistribution terms.
- Primary references: [San Francisco PermitSF metadata](https://catalog.data.gov/dataset/permitsf-permitting-data), [San Francisco PermitSF column metadata](https://data.sf.gov/api/views/tyz3-vt28/columns.json), [Miami-Dade official permit layer schema](https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/miamidade_permit_data/FeatureServer/layers).


## November 1 price-reference gate and search-demand follow-up

- Added `data/price-benchmarks.json` as a deliberately empty publication registry. No local solar or roof price is approved for display. Added client-side display logic for historical LBNL city/state installed-price distributions and AHS 2013-CBSA metro whole-project roofing-cost distributions, but records render only if every source, sample, unit, period and disclosure gate passes. The AHS output is expressly not a $/sq-ft rate and is not fed into the roof-cost calculator.
- Added `scripts/validate_price_benchmarks.py`, source-gate tests and UI tests. The test-only synthetic rows exercise approved and rejected states; they are not included in the JSON registry or release data. The live registry has zero records and both source statuses remain withheld.
- The location solar page checks for a historical solar installed-price distribution only after a Census place is selected. The roof cost page's AHS metro selector remains disabled until approved metro records exist. User-entered comparable quotes remain the calculator inputs.
- Public web search found multiple existing solar cost/payback tools (including GreenCalculus, Solar Melon, RoofPayback and Green Energy Calculators) and roof replacement cost tools (including CostSquared, RoofingCalculatorUSA, NewRoofCalc and Toolwick). This confirms the generic calculator format is competitive; it does not reveal rank positions, traffic or market share.
- Public Reddit discussions showed repeated homeowner questions about quote scope differences and the treatment of flashing, underlayment, ventilation, roof area, permits, warranties, export credits and fixed charges. These are qualitative, anecdotal pain-point signals—not market-size evidence. See `KEYWORD-DEMAND-VALIDATION.md` for URLs and the limits of the search review.
- Exact keyword volumes and Search Console data were not obtained. Google documents Keyword Planner volumes as rounded, location/date-range dependent averages and requires billing setup for basic keyword ideas. No billing details or paid tools were used. The website is not deployed or Search Console verified. Search demand remains unvalidated; no traffic, RPM or revenue forecast is claimed.
- Product recommendation: prioritise a homeowner quote-comparison workflow and roof/solar sequencing tool using actual proposal inputs. Do not build mass city pages or compete solely through another generic price calculator.


## November 1, 2026 — roof repair vs. replacement content-cluster addition

- Added `guides/roof-repair-vs-replacement.html` as a pre-publication, noindex decision guide. It separates localized repair, recover/overlay and full replacement; explains why age alone is not a decision rule; and gives homeowners a written inspection/proposal comparison checklist.
- Claims are grounded in current NRCA consumer guidance and the ARMA asphalt-shingle recover/replacement technical bulletin. The page deliberately does not repeat one-size-fits-all percentage rules or supply unsupported prices. It warns against homeowner roof-walking and requires a qualified site-specific assessment.
- Added homepage entry points and contextual internal links from the existing roof lifespan and replacement-cost guides. Added the page to the sitemap template and corrected the template's previously omitted location-solar calculator URL. The production sitemap generator discovers all content pages dynamically; the 404 remains excluded.
- Updated deterministic inventory expectations from 18 to 19 HTML documents and 17 to 18 sitemap content URLs. Existing noindex and X-Robots-Tag prelaunch protections remain in place.
- This is an editorial draft, not cleared for indexing: no author or qualified roofing reviewer has been assigned. No deployment, indexing, DNS, analytics, ad activation or paid service was initiated.


## November 1, 2026 — solar investment decision content-cluster addition

- Added `guides/are-solar-panels-worth-it.html` as a pre-publication, noindex solar investment guide. It connects annual kWh use, production estimates, direct self-consumption, utility export compensation, full cash price, financing, roof condition and current incentive verification. It links to the existing solar calculators and bill-savings explainer.
- Added a date-checked federal tax note based on current IRS guidance: the homeowner Section 25D credit is not allowed for expenditures made after December 31, 2025; IRS installation-completion timing is described. The page avoids assuming any homeowner credit or treating a provider's tax treatment as a consumer credit. Tax statements must be rechecked before launch.
- The article explains why EIA state averages are not household marginal tariffs or export-credit schedules and why PVWatts production predictions are estimates with assumptions/uncertainties. It avoids fabricated system prices, savings claims and payback forecasts.
- Added homepage discovery and contextual links from the solar bill and roof-before-solar guides. Added the guide to the sitemap template and updated inventory safeguards to 20 HTML documents / 19 content URLs. Prelaunch noindex protection remains active.
- This remains an editorial draft without an assigned author, qualified PV reviewer or tax reviewer. No deployment, indexing, DNS, analytics, advertising activation or paid service was initiated.


## November 1 — Solar panel-count search-intent upgrade

- Reworked `calculators/solar-panel-count.html` around the homeowner query intent “How many solar panels do I need?” The usage-based method takes annual household kWh, visitor-selected annual generation offset, modeled annual AC production per kW DC, and actual module wattage. It rounds up to a whole module count and reports calculated DC capacity and generation after rounding.
- Preserved an alternative calculation path for a quoted/target DC system size. The two paths cannot be combined in one calculation, to avoid ambiguous or double-counted inputs. Added a reset action.
- Added a direct workflow link to the city PVWatts production estimator, which exposes annual kWh per kW DC. The page explains that the model uses a representative Census place point, not the property, and that generation offset is not the same as bill reduction.
- Updated the homepage discovery card and local calculator test cases. The tool does not invent typical production, panel wattage or module area defaults.
- QA scope: deterministic calculation tests only; still requires browser/device, accessibility and user testing before launch. Page remains noindex and the site remains unpublished.

- Follow-up UX refinement: PVWatts city-model output now offers a second hand-off to the panel-count calculator, carrying the modeled annual kWh per kW DC and the selected city/state label in the query string. The receiving tool accepts only a bounded numeric yield, displays a representative-place caveat, and still requires the visitor's annual kWh, target offset and actual module wattage. Editing upstream assumptions invalidates both hand-off links. Automated DOM-stub tests cover both links and stale-result invalidation.


## November 1, 2026 — opt-in roof replacement price reference

- Updated the roof replacement calculator to offer an explicitly optional national reference scenario of $4–$11 per roof-surface sq ft, based on Angi's cost guide updated October 22, 2026. The range loads only after a visitor clicks the button; it is never silently prefilled.
- The result records its source basis and states that the published range is not local, not material-specific and not a contractor quote. If the visitor edits either rate after loading, the result changes its provenance to visitor-edited assumptions and no longer attributes the output to Angi.
- Added a separate contextual HomeGuide reference ($5,700–$16,000 typical total-cost range; $10,800 reported average) as an independent publisher dataset. It is not pooled with Angi's per-square-foot range because the sources use different methods and units.
- Retained the historical Census AHS $10,000 median roofing expenditure as dated national survey context only; it is not a current replacement quote or a $/sq-ft rate.
- Local prices remain user-entered. No city- or metro-level prices were fabricated or added to the publication registry. New deterministic tests verify that the optional range requires deliberate user action, carries source disclosure, and switches to visitor-owned provenance after a rate edit.
- Sources reviewed: Angi (October 22, 2026) and HomeGuide (November 7, 2025); these are publisher-sourced cost summaries rather than official government price indexes. They are broad planning context, not verified project-specific prices.


## November 1, 2026 — roof lifespan search-intent refinement

- Repositioned the existing `guides/roof-life-by-material.html` page around the direct homeowner query “How Long Does a Roof Last?” instead of creating a near-duplicate lifespan article. Updated title, description, H1, introduction and homepage labels.
- Added a material-by-material estimated service-life table from HUD's 2015 *Durability by Design*, Table 4–2. The table's source note explains that the underlying estimates combine industry data with a 2007 NAHB / Bank of America component-life study; it labels all values as older broad planning estimates, not current guarantees.
- Kept the NRCA general statement that most new roofs are designed to provide useful service for about 20 years and disclosed that the Metal Roofing Alliance is a metal-roofing trade association when citing its alternative ranges. The values are not averaged or presented as directly comparable field measurements.
- Added FAQs on warranties, repair versus replacement, roof-before-solar sequencing and inspection cadence. Links route users to the existing cost calculator and decision guides.
- Existing page remains `noindex,follow`; no new URL, deployment, indexing or paid service was added. Technical review and accountable author assignment remain launch requirements.


## November 1, 2026 — metal vs. asphalt comparison page

- Added `guides/metal-roof-vs-asphalt-shingles.html` for the material-comparison search cluster. The article distinguishes common asphalt shingles from standing-seam, exposed-fastener and other metal systems rather than treating “metal” as one product.
- Cost ranges from HomeGuide (dated November 6, 2025) and Angi (updated August 3, 2026) are shown in separate rows and explicitly not pooled. Their published rates vary materially; the page warns that source methods and product mixes are not standardized and that these are not local quotes.
- HUD's 2015 *Durability by Design* estimated service-life ranges are used with the report's source basis and uncertainty caveat. NRCA contractor-proposal guidance is used for a like-for-like comparison checklist. Metal system installation details are linked to IBHS guidance.
- Recent Reddit threads are used only as anecdotal examples of quote-scope confusion (panel/fastener design, tear-off and product gauge), not as price or prevalence evidence.
- Added homepage discovery card, contextual internal links and sitemap-template URL. Updated static inventory expectations from 20 to 21 HTML documents and 19 to 20 sitemap content URLs. No live sitemap was generated because the site remains unpublished and blocked from indexing.


## November 1, 2026 — metal-roof cost intent page

- Added `guides/metal-roof-cost.html` as a separate cost-intent page rather than folding it into the existing metal-vs-asphalt comparison. The page separates HomeGuide's Nov 21, 2025 installed-rate/system data from Angi's Sep 25, 2026 project and material data; it does not average the two datasets or present them as local quotes.
- Added internal links from the homepage roof-planning section, the metal-vs-asphalt comparison and the roof replacement cost factors guide. Added the page to the noindex sitemap template; it remains noindex and unpublished.
- The page states that actual roof surface area differs from home living area, separates publisher methodologies, and directs users to compare written quotes with identical metal/system/scope details.
- Source URLs: HomeGuide metal roof cost; Angi metal roof cost 2026; Angi standing-seam cost 2026. No city-specific price is approved or displayed.


## November 1, 2026 — metal-roof rate presets in the roof cost calculator

- Added a metal-system selector shown only when the material is set to Metal. The user may deliberately load one of four HomeGuide installed-rate references: corrugated sheet metal ($5–$12/sq ft), standing seam ($9–$16), metal shingles ($6–$14), or galvanized/Galvalume steel ($5–$13), based on HomeGuide's November 21, 2025 cost guide.
- The existing broad Angi national roof reference remains a separate opt-in for non-metal/general scenarios. Metal-system presets are not prefilled, are explicitly labeled as publisher-level/nonlocal estimates, and switching material/system clears a loaded preset. Editing a loaded range changes provenance to visitor-entered rates.
- Added regression coverage for the standing-seam preset and edited-rate provenance. These references are not local prices, and no city/metro metal-rate database is approved.


## November 1, 2026 — roof repair cost intent page

- Added `guides/roof-repair-cost.html` to target the price-checking intent around roof repair and roof leak repair. Third-party SEO sources report directional US volumes of roughly 2,000 searches/month for “roof repair cost” and 2,900 for “roof leak repair cost”; these are not verified Google Search Console or independently reproduced Keyword Planner figures. Service-intent terms such as “roof repair near me” are not treated as addressable publisher traffic.
- Separates Angi's October 14, 2026 report ($1,174 reported average; most projects $395–$1,967; stated basis 32,999 verified Angi Pro projects) from HomeGuide's February 9, 2026 damage-severity tiers ($150–$1,000 minor; $1,000–$3,000 moderate; $3,000–$6,000+ major). The article does not average these sources. It labels unit-specific repair rates and explains differences in scope and method.
- Adds a repair-scope checklist and links to the repair-vs-replacement framework and full-replacement cost calculator. It does not invent a repair-cost calculator or treat replacement-rate inputs as repair prices.
- The article remains `noindex,follow`, requires an accountable author and qualified roofing technical review, and is not yet cleared for publication.
- Sources checked: Angi roof repair cost guide (updated October 14, 2026); HomeGuide roof repair cost guide (February 9, 2026); Relay roofing keyword map (September 10, 2026); roofing keyword analysis by SEO Brothers (2026); a July 2026 r/Roofing homeowner discussion used only as an anecdotal example. The keyword figures are third-party directional estimates; there is no project Search Console dataset, verified traffic forecast or AdSense RPM evidence.


## November 1, 2026 — roof replacement cost search page

- Added `guides/roof-replacement-cost.html` to address the informational/price-checking intent for “roof replacement cost” separately from the existing interactive calculator and cost-factors worksheet. A September 2026 Relay/ DataForSEO keyword map reports 18,100 monthly US searches for this query; this is a third-party directional estimate, not verified Search Console or independently reproduced Keyword Planner data.
- The guide separates Angi's October 22, 2026 reported $9,610 average / $5,903–$13,378 most-project range / $4–$11 per sq. ft. (Angi says the average is based on 32,999 verified Angi Pro projects) from HomeGuide's November 7, 2025 reported $10,800 average / $5,700–$16,000 average range / $3–$6 general per-sq.-ft. range (HomeGuide says it draws on research and member-reported project costs). The page does not average or imply the data are methodologically equivalent.
- Material-specific HomeGuide ranges are shown as broad publisher references with system qualifications. Examples applying per-sq.-ft. figures to measured roof surface are labelled arithmetic illustrations, not quote forecasts. The article distinguishes house floor area from sloped roof surface area and links to the existing roof-area and roof-cost calculators.
- Added contextual navigation from the homepage, replacement-cost-factor guide and metal-roof-cost guide; added a sitemap-template URL. Updated static release expectations to 24 HTML documents (23 content pages plus 404) and 23 sitemap content URLs. All site pages remain `noindex,follow`; no production sitemap was generated.
- Source review: Angi [How Much Does Roof Replacement Cost?](https://www.angi.com/articles/how-much-does-roof-replacement-cost.htm), updated October 22, 2026; HomeGuide [How Much Does a Roof Replacement Cost?](https://homeguide.com/costs/roof-replacement-cost), dated November 7, 2025; Relay September 10, 2026 DataForSEO/Google Ads keyword map. Price datasets are commercial publisher inputs, not official government price statistics.
- Editorial draft only. Named author, qualified roofing review, pricing recheck and final prepublication review are outstanding.


## November 1, 2026 — solar installation cost search page and PV quote checker

- Added `guides/solar-installation-cost.html` as a distinct informational/price-intent page for solar panel / solar installation cost. This is separate from `are-solar-panels-worth-it.html` (financial decision intent), the solar savings calculator (user-input annual energy-value scenarios), the location PVWatts estimator (site-specific production), and the panel-count calculator (system sizing).
- Added a PV-only quote-per-watt checker. It requires a visitor-entered comparable PV-only installed cash price and DC nameplate system size, calculates $/W and shows the arithmetic amount at the published benchmark. The output explicitly states that the comparison is not a fair-price verdict. Batteries, roof replacement, unrelated electrical upgrades and financing charges must be separated before using it. Added regression cases for benchmark matching ($2.62/W), a 25%-above example ($3.28/W), missing values and invalid system size.
- Pricing reference: EnergySage's October 7, 2026 H1 report says its median solar-only price was $2.62/W before incentives; the report describes a wider median solar price of $2.57/W for the broader mix. EnergySage's data page states that its H1 2026 report analyzes millions of homeowner marketplace shopping transactions from Jan–Jun 2026 and that marketplace data include quotes, equipment selections and financing choices. The guide labels the $2.62/W figure as a marketplace median, not an audited invoice average or property-specific quote. EnergySage's consumer cost page separately displays about $2.60/W as an average; the page explains the average/median distinction rather than combining them.
- Independent contextual benchmark: DOE's 2025Q1 cost model gives an 8 kW DC residential rooftop PV-only representative system an MSP of $2.78/W and MMP of $2.95/W, in 2024 U.S. dollars. DOE describes its methodology as national-laboratory analysis of cost data and a modeled system. The guide deliberately keeps this separate from marketplace quote data and does not average them.
- 2026 tax statement checked against IRS official sources: Section 25D is not allowed for expenditures made after Dec 31, 2025. The guide does not subtract the former 30% homeowner credit from new 2026 price examples.
- Community spot-check: Sep–Oct 2026 Reddit discussions show anecdotal confusion when comparing DIY scope, battery-inclusive totals and PV-only contractor quotes. Those posts are used only to shape the quote-comparison UX and are not used as price estimates or prevalence evidence.
- Keyword signal: Azuqe's October 2026 SEO page reports 12,000 average monthly U.S. searches for “solar panel cost” (Google Ads data via DataForSEO) and 74,000 for “solar panel installation”; those are third-party estimates, not site Search Console or an independently reproduced Keyword Planner export. The broader installation term may have mixed/transactional intent; the page specifically targets cost-information intent.
- Added page and JS asset to homepage navigation, solar planning guide cluster and related guide links; added sitemap template URL. Updated static expectations to 25 HTML docs (24 content/information pages plus 404), 24 content sitemap URLs, and nine first-party JS assets.
- QA on current source: all local tests passed; 25 HTML docs, unique titles/descriptions, 53 labelled controls, zero inline JS, and nine first-party JS files syntax-checked. Solar quote checker regression cases passed. Deterministic tests do not replace real browser/device, assistive technology, production API, tariff, technical or professional validation.
- The site remains `noindex,follow` and unpublished. No Search Console or real AdSense data exists; this page adds no traffic or RPM forecast. Author, qualified solar technical reviewer and final editorial review remain launch gates.

Sources checked:
- EnergySage, [H1 2026 marketplace report summary](https://www.energysage.com/news/home-energy-market-h1-2026-highlights/) (Oct 7, 2026).
- EnergySage, [Home electrification data and public reports](https://www.energysage.com/data/) (H1 2026 coverage / methodology).
- EnergySage, [Solar panel cost in 2026](https://www.energysage.com/local-data/solar-panel-cost/) (separate average measure).
- U.S. DOE, [Solar Photovoltaic System Cost Benchmarks](https://www.energy.gov/cmei/systems/solar-photovoltaic-system-cost-benchmarks) (2025Q1).
- IRS, [Residential Clean Energy Credit](https://www.irs.gov/credits-deductions/residential-clean-energy-credit) and [OBBB energy-credit FAQs](https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb).
- Azuqe, [SEO for Solar Installers: 2026 Strategy & Keywords](https://azuqe.com/seo-for/solar) (October 2026; third-party keyword dataset).
- Reddit: [solar system price per watt](https://www.reddit.com/r/solar/comments/1wpsd2n/solar_system_price_per_watt/), [is my quote reasonable](https://www.reddit.com/r/solar/comments/1wf5f0f/is_my_quote_reasonable/), and [prices post tax-credit era](https://www.reddit.com/r/solar/comments/1uucylu/what_prices_are_we_seeing_post_tax_credit_era/). Anecdotal only.


## November 1, 2026 — solar loan vs. lease vs. PPA comparison

- Added `guides/solar-loan-vs-lease-vs-ppa.html` as a solar financing and contract-comparison page, distinct from the price-intent solar installation cost guide and the financial “are solar panels worth it?” guide. It compares cash purchase, solar loan, lease and PPA ownership/payment/service/home-sale obligations; adds a PACE warning; and links the CFPB, FTC and IRS primary sources.
- Historical CFPB context is dated and caveated: its August 2024 Issue Spotlight documented solar-specific financing fees that raised loan principal above cash price, often 10%–30% in its review and sometimes higher, and some contracts that re-amortized when expected tax-credit prepayments were not made. The page explicitly does not treat this as current market prevalence or as a statement that every current loan has these provisions.
- Tax wording is updated for current 2026 law: the IRS states Section 25D is not allowed for expenditures after December 31, 2025. The page warns against relying on the former 30% credit in a new 2026 homeowner loan illustration and requires lender/installer to disclose full payment schedules and any tax-credit-based prepayment or re-amortization clause.
- Added an interactive fixed-rate loan calculator requiring cash price, principal, APR and term, with optional down payment. It calculates standard amortizing monthly payment, total payments and interest. It only calculates principal-plus-downpayment versus cash price when the visitor confirms both proposals have identical scope. The output explicitly says the difference is not automatically a dealer fee and may reflect different scope, equipment, add-ons or charges. This is not a lender disclosure or full contract model.
- Regression tests cover a $30,000 cash / $39,000 principal example at 7.99% over 20 years, scope-comparison guard, zero APR and invalid APR.
- Added homepage discovery and links from the solar cost and solar investment guide clusters; updated sitemap template and release checks to 26 HTML docs (25 content pages plus 404), 25 content sitemap URLs and ten JS assets.
- Search-demand signals are vendor-provided and unverified: Azuqe's October 2026 solar SEO map reports 720 US monthly searches for “solar lease vs buy” (KD 20). The page is intended to cover broader finance intent with lease/loan/PPA, but the volume is not a Search Console measure or independently reproduced Keyword Planner export.
- Community check: recent 2026 r/solar and real-estate forum threads report anecdotal lease transfer, buyout, buyer-assumption and disclosure friction at home sale. Used only to shape the transfer checklist—not as prevalence or legal evidence.
- All pages remain noindex and unpublished. Author, qualified financial/legal/solar review, production testing and all other launch gates remain outstanding. No plugin, paid tool, service, domain change or advertising account was activated.


## November 1, 2026 — solar financing guide QA follow-up

- Latest source audit: 26 HTML documents; 26 unique titles and descriptions; 59 labelled interactive controls; zero inline JavaScript blocks; ten first-party JS assets syntax-checked.
- Full suite passed after correcting the checkbox label association and APR display precision. Standalone roof/area/panel/price-checker/loan-checker tests: 20/20; solar standalone model: 10/10; combined calculator: 9/9; location API and UI, privacy, site-configuration and price-registry guard tests passed.
- Loan checker example: $30,000 same-scope cash price; $39,000 principal; $0 down; 7.99% APR; 20 years. At a fixed fully amortizing monthly rate it calculates approximately $326/month, $78,233 scheduled instalments and $39,233 interest. The same-scope box is required before it reports the $9,000 principal-vs-cash difference (30%). It expressly does not label that difference as a dealer fee.
- Remaining limitations: DOM stubs are not browser, mobile, accessibility or live lender-disclosure testing; no finance/legal/tax professional has reviewed the page; all content remains noindex and unpublished.


## November 1, 2026 — pre-launch hardening and clean deployment root

- Applied production canonical and `og:url` metadata for `https://getroofsolarcalculator.online` to all 25 non-404 HTML pages using `scripts/configure_site.py` in safe mode. All 26 pages retain `noindex,follow`; `_headers` retains `X-Robots-Tag: noindex, follow`; no generated `sitemap.xml` is present and `robots.txt` does not advertise a sitemap. This is a source configuration only—not evidence that DNS, HTTPS or the domain is live.
- Added `scripts/prepare_deploy.sh` to stage a clean `dist/` folder with only public HTML, CSS, JavaScript, first-party data JSON/CSV, `_headers`, `_routes.json` and `robots.txt`. The build excludes internal research Markdown, QA scripts, migrations, owner checklists and example secrets. Cloudflare Pages Functions remain in the repository-root `functions/` directory and are deployed separately from static `dist/` assets.
- Removed two links from the public methodology page that pointed to internal Markdown research records. Those internal records remain in the source repository and are not copied to `dist/`.
- Changed the Cloudflare Pages Git build configuration instructions to use `sh scripts/prepare_deploy.sh` with output directory `dist`, not repository root. Confirmed there is no need for `package.json`, `package-lock.json`, `npm install` or a Node build step for this project. Added a Wrangler Direct Upload alternative and a warning that Cloudflare dashboard drag-and-drop does not compile the `/functions` directory; Wrangler CLI must be run from the repository root to include Pages Functions.
- Added `scripts/test_prepare_deploy.py` to the full QA suite. It verifies 26 HTML pages, 43 public files, 482 resolvable local references, no internal Markdown/QA/migration/Functions leakage into `dist/`, and retained noindex protections. The QA, privacy and site-configuration scripts now ignore the generated `dist/` copy to avoid double-auditing mirrored HTML.
- Fresh full local QA run: **all checks passed**. Source audit: 26 HTML documents, 26 unique titles, 26 unique meta descriptions, 59 labelled controls, zero inline JavaScript blocks and ten first-party JavaScript files syntax-checked. EIA table: 52 rows and internal arithmetic/CSV-to-HTML checks passed. Roof/area/panel/quote/loan calculator scenarios: 20/20; standalone solar: 10/10; combined calculator: 9/9. Mocked Pages Function tests, quota SQL simulation, location estimator UI, price publication gates, privacy guardrails, safe indexing configuration and new deployment-stage tests passed.
- Additional strict lxml parsing passed for all 26 source HTML documents. A separate static accessibility/structure heuristic check found zero duplicate IDs, unnamed form controls or links, missing image alt attributes, missing page language/title or incorrect H1 counts. This is not WCAG 2.2 AA conformance, keyboard testing, screen-reader testing or manual zoom testing.
- Browser smoke test was attempted with Chromium against both `http://127.0.0.1` and local `file://` content, but the execution environment returned `ERR_BLOCKED_BY_ADMINISTRATOR`. No visual, mobile-rendering, console/network, Lighthouse or accessibility certification is claimed.
- Domain reachability could not be verified in this environment: the sandbox resolver/curl attempt returned a name-resolution failure. This does not establish whether the Hostinger account has active DNS records from another network. No Cloudflare account/repository/D1 binding/API keys, DNS changes, HTTPS certificate, Search Console property or AdSense account were connected or configured.
- The live publication blockers are unchanged: real publisher identity/contact, domain/brand review, genuine authors and qualified technical reviewers, legal/privacy review, real tariff and PVWatts validation, D1 creation/binding, actual browser/device/accessibility QA, DNS/HTTPS production verification, Search Console setup, content quality review and subsequent AdSense site approval.
- Current release remains **pre-launch only**. Do not remove noindex or apply for AdSense until the owner/professional gates are closed. Google AdSense's current eligibility guidance requires the publisher to have original, high-quality content and control over the site's HTML; Google lists insufficient/original-content and navigation problems among common site-review issues. A passing code test is not AdSense approval.

References checked for deployment policy on November 1, 2026:
- Cloudflare Pages [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) (updated April 21, 2026): Wrangler and dashboard upload paths differ; Dashboard drag-and-drop does not compile a `/functions` directory, while Wrangler CLI deploys Functions when run from the project root.
- Cloudflare Pages [Functions getting started](https://developers.cloudflare.com/pages/functions/get-started/) (updated April 21, 2026): `/functions` is located at the Pages project root.
- Google AdSense [Eligibility requirements](https://support.google.com/adsense/answer/9724?hl=en), [Common approval issues](https://support.google.com/adsense/answer/81904?hl=en), and [Site ownership verification](https://support.google.com/adsense/answer/91205?hl=en).


## November 1, 2026 — city-hybrid and field-validation rebuild

- Added a shared field-level validation module across all eight calculator/data-entry pages. Each visible input displays range/unit/precision and required/optional guidance; hard errors are shown inline during entry/blur, plausibility warnings remain non-blocking, paired and mutually exclusive input logic is checked, hidden conditional fields are skipped, and Calculate/Continue revalidates the active scope and focuses the first invalid field.
- Corrected numeric increments to match source-derived handoff precision (including $/W DC cents and fractional PVWatts kWh/kW values). Added pure and simulated-DOM tests for invalid, corrected, optional, warning, paired and final-click cases.
- Changed the standalone roof-cost calculator from click-to-load national pricing to editable automatic reference prefill: Angi $4–$11/roof-sq-ft for general roofing; selection of Metal clears the generic assumption; choosing a specific metal system preloads the matching HomeGuide reference. Visitor edits change provenance to visitor-entered assumptions.
- Added an editable $2.62/W DC EnergySage H1 2026 national solar-only marketplace reference to the standalone solar savings calculator. City + state PVWatts handoff carries city/state context, and the savings calculator independently rechecks the public registry before replacing the national fallback with an approved LBNL city/state price row. It checks release state, source host, geography, sample threshold, year range and approval flags. Visitor edits made during an asynchronous lookup are not overwritten.
- Retained the empty local-price registry: no unsupported city solar prices or metro roofing prices were invented or added. Household usage, direct-use share, actual marginal tariff, export credit, roof measurement and actual contractor quote remain visitor-specific inputs.
- Added/expanded tests for standalone fallback provenance, metal system fallback, fractional PVWatts handoff, registry approval/sample/license/source-host gates and async visitor-edit protection. Updated the privacy guard to permit only the disclosed public same-origin benchmark-registry read, with credentials omitted and no visitor household inputs sent.
- Full local QA result: **ALL LOCAL QA CHECKS PASSED**. Inventory: 26 HTML documents, 26 unique titles and descriptions, 59 labelled interactive controls, 11 first-party JavaScript files syntax-checked, 492 local references resolved, clean deploy output of 26 HTML / 44 files, and noindex protections retained.
- Limitations remain: current price registry has zero approved LBNL city/state solar rows and zero AHS metro roof rows; LBNL data and commercial reuse permission remain unprocessed/unconfirmed; AHS roof PUF and metro reconciliation remain unverified; D1 binding and live PVWatts/OpenEI keys are not configured; no real browser/device/accessibility, professional, legal, production or ad-network review is claimed. The destination GitHub repository is not claimed as updated by this local rebuild.
