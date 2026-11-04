# Phase 1 — Data feasibility and product architecture

**Prepared:** November 1, 2026  
**Project:** Roof & Solar Toolkit  
**Business model:** U.S.-focused free homeowner tools, primarily monetized through display advertising  
**Status:** The isolated Cloudflare Preview is deployed and its Census, PVWatts and OpenEI routes have passed a live smoke test. Production deployment, custom-domain cutover, indexing, ad activation and paid services are not authorized.

## Executive decision

Do not begin by generating city pages. Build one location-aware calculation workflow and prove the data quality before scaling geography.

The current static website is a usable foundation. Keep its calculator formulas, transparent-input philosophy, EIA state-price page, privacy guardrails, and offline QA. The key product gap is not the number of pages: it is reliable geographic context and source-backed assumptions.

### Product sequence

1. **Location resolver:** currently accepts a U.S. city/place name and state abbreviation, then queries Census incorporated-place and Census-designated-place layers. It resolves to a representative place point—not a parcel, rooftop, utility territory or permit jurisdiction. This is the current selected workflow; ZIP lookup is not required for the MVP.
2. **Solar production engine:** use NLR PVWatts V8 as the first production model. Return annual and monthly AC kWh, model inputs, climate-station details, warnings, and an uncertainty note.
3. **Utility/tariff resolver:** identify candidate utilities/rates, show the source and effective date, and require user confirmation where multiple tariffs or rate plans are plausible. Never substitute an EIA state average for the user's marginal import price or export compensation.
4. **Solar economics:** calculate direct-use and export value separately. Add a more realistic tariff path for time-of-use, fixed charges, minimum bills and export credits before presenting bill-savings claims as personalized.
5. **Roof-cost evidence layer:** begin with a national/metro AHS reference after validating the PUF workflow. Add selected-city declared permit-value indicators only where official municipal records, commercial-use terms, scope definitions and sample sizes pass review. Keep visitor-entered comparable installed rates/quotes as the actual pricing input where local invoice-quality evidence is absent.
6. **Combined roof + solar decision tool:** compare roof-now, solar-now, and roof-plus-solar sequencing using user-supplied quotes and explicit assumptions.
7. **Only then:** select a small number of city/metro pages using search-demand evidence and unique local data. Keep unsubstantiated or thin pages out of the index.

## Source feasibility register

| Data need | Candidate source | What it can support | Limitations / decision |
|---|---|---|---|
| Solar generation | NLR PVWatts V8 API | Modelled monthly and annual AC output using coordinates and system assumptions; response includes warnings and station information | Requires API key. Official docs state a 1,000-request/hour limit. It is a model, not roof inspection or a property-specific shade survey. **Use as the production baseline.** |
| Utility rates | OpenEI U.S. Utility Rate Database (URDB) | Candidate utility tariffs and complex rate structures; API supports utility, location, sector and EIA utility ID lookups | Requires a free API key; docs allow up to 500 records per response. Rate completeness, tariff vintage, utility mapping and residential applicability must be validated record-by-record. **Use as a discovery source, not an unquestioned default.** |
| Electricity benchmark | EIA Electric Power Monthly / API | State and national average retail prices; useful for comparison and context | Average retail price is not a household marginal rate, tariff, or solar export credit. Keep as a labelled benchmark only. |
| Housing / local context | Census ACS 5-year API | Owner-occupancy, housing age, housing characteristics, household and geographic context down to ZIP Code Tabulation Areas and smaller geographies | Latest data page reviewed is 2024 ACS 5-year. API now requires a key. Estimates have margins of error and are not roof-level facts. **Use for market/context scoring, not individual property claims.** |
| Solar installed-price evidence | Berkeley Lab 2026 U.S. Distributed Solar and Storage dataset | Official August 2026 publication record: roughly 5.3 million systems through end-2025 overall. Exact downloadable public-CSV row count and current field schema have not been independently verified. | Existing script targets a strict 2024–2025 residential PV-only host-owned rooftop cohort with sample suppression, but it has not yet been validated against the 2026 CSV/user guide. City spellings are inconsistent, coverage uneven and prices heterogeneous. Commercial reuse terms remain unresolved. No price output is approved until the 2026 file is reviewed, current reuse permission is confirmed and results are independently validated. |
| Roofing cost evidence | Census 2023 American Housing Survey (AHS), national PUF with Top 15 `OMB13CBSA` metro codes / Table Creator | Explicit roofing replacement/addition question and associated whole-job cost; national and Top 15 metro estimates can be produced, with survey weighting and margins of error, after PUF-to-Table-C-16 reconciliation | Self-reported cost, not an invoice; the instrument says a roof was added or replaced and records total roofing-job cost, not a clean tear-off-only sample. No roof size, material or exact scope; metro sample sizes and margins must be checked. The 2023 expense-year field allows a same-year subset, but this may sharply reduce N. Do not extrapolate to every city/ZIP. |
| Roofing local project evidence | Public municipal/county permit datasets (e.g. San Francisco PermitSF) | Selected-city reroof permit records and applicant/permit declared valuation | No national standard. Permit valuation is not a verified final invoice; scope, status, material and valuation completion differ. Use only as a separately labelled local permit indicator after jurisdiction-specific validation, not as the estimator's installed price. |
| Roofing labour input | BLS OEWS and relevant price indexes | Regional wage context and inflation inputs | Wages are not installed roof prices. They can inform a transparent model but cannot alone justify a city quote estimate. |
| Weather / hazards | NOAA Storm Events, FEMA National Risk Index and official local sources | Historical hail/wind/flood hazard context | Reporting lag, geography and hazard methodology differ. These should inform educational context, not claim property-level risk or quote premiums. |
| Incentives / law | Official federal, state, utility and local programme administrators; DSIRE as discovery aid | Programme existence, eligibility, dates and official application rules | Verify every displayed programme against the administrator. Do not surface expired federal residential Section 25D credit as currently available for post-2025-12-31 expenditures. |

## Important new finding: roofing data is not a binary yes/no

There is no single complete official, current, machine-readable installed-roof-price dataset covering every U.S. city. However, the evidence landscape is better than a simple "no data" conclusion:

- The Census/HUD 2023 AHS infographic reports a $10,000 national median roofing expenditure for the 2021–2023 reference period. The corrected research script uses generic relational PUF fields (`JOBTYPE`, `JOBCOST`, `JOBDIY`) joined to owner-occupied HOUSEHOLD records by `CONTROL`; it includes Census-edited/imputed values and uses the 160 replicate weights. It remains research-only: the official PUF archive was not downloaded, no real PUF summary was generated, and this source has no roof-size denominator or local $/sq-ft data.
- Some local governments publish permit records with declared reroof project values. San Francisco's official PermitSF dataset identifies reroof permits and includes valuation, but its field is not a final paid invoice. This is a local research indicator, not a city cost benchmark until the subset, value completeness, scope and permit status have been audited. Other jurisdictions require separate licensing and schema checks.
- Commercial and publisher datasets exist, but their methodologies, source access and reuse rights vary. Do not scrape or republish proprietary estimates without permission.

**Proposed roof pricing policy:** show a benchmark range only when its source, scope, geography, sample size, period and limitations can be stated. Otherwise ask the user for a comparable local quote or their own per-square/per-square-foot range. Do not conceal a modelled city multiplier as an observed market average.

## Solar calculation rules

- Separate system production from financial value. PVWatts can estimate generation; it cannot know the customer's actual bill structure.
- Separate self-consumed kWh from exported kWh. Value each using the applicable marginal import and export compensation rules.
- Do not calculate a bill-dollar savings estimate from total monthly bill dollars divided by EIA average prices.
- Where time-of-use, demand charges, minimum bills, fixed charges, export caps or monthly netting rules materially affect the result, label the simple annual-share result as a scenario and expose the omitted factors.
- Display PVWatts model version, coordinates/geography used, system inputs, dataset/station information, retrieval date, and API warnings.
- Do not present a single production number as a guaranteed range. PVWatts' own calculator warns that predictions contain assumptions and uncertainties and do not capture all site-specific conditions.

## Geography and SEO gate

Do not select a city because it is sunny, populous, or has a high electricity price alone. Build a weighted opportunity score using:

- search demand and commercial intent (keyword data, not guessed volumes);
- owner-occupied housing and detached-home stock;
- roof age / housing age proxies;
- electricity rates and tariff complexity;
- PV production potential;
- roofing hazard and replacement drivers (with careful interpretation);
- advertiser competition / likely monetization, validated after traffic exists;
- search competition and the quality of incumbent pages;
- availability of genuinely distinct local data.

Start with a limited metro pilot only after comparing candidates. Each indexed location page must provide a distinct calculator experience, data and local explanation—not a city-name substitution. Keep noindex until launch gates pass.

## Monetization reality check

Display-ad revenue is driven by monetized pageviews, geography, viewability, session depth, advertiser demand, consent, and actual RPM. High commercial intent does not automatically mean high display-ad RPM. The initial product should therefore optimize for usefulness and repeat engagement, not intrusive ads or forced pageviews.

Track, once legally and technically ready: U.S. organic clicks, U.S. share of sessions, calculator starts/completions, return visits, engaged sessions, page RPM, revenue per 1,000 sessions, revenue by tool and geography, and data freshness. Do not forecast income until real data exists.

## Free-first implementation constraints

- Retain static-first delivery on Cloudflare Pages as the current hosting candidate.
- Add Cloudflare Pages Functions only where secrets, caching or API mediation genuinely require a server-side layer.
- Keep API keys in server-side environment variables; never put them in browser JavaScript or a public repository.
- Cache stable, non-personal model responses to reduce API calls and protect free-tier limits; do not cache user-identifiable inputs.
- Avoid a general-purpose visitor database. A narrowly scoped Cloudflare D1 table is now justified as atomic global quota counters for the Census place lookup, NLR PVWatts key and OpenEI discovery key; it stores up to four aggregate quota-scope rows, no IPs, coordinates, city names or visitor identifiers. Versioned static data files remain preferable for slowly changing reference datasets.
- No paid API, hosting upgrade, domain transfer, new domain, paid keyword tool or paid data purchase without explicit owner approval.

## Immediate engineering backlog

### Gate A — source validation (next)
1. The official Berkeley Lab 2026 update record confirms roughly 5.3 million systems overall through end-2025. The current downloadable CSV row count and 2026 guide's field definitions have not been inspected. Obtain the 2026 guide and CSV, count rows, validate current field names and cohort filters, and obtain explicit current commercial-reuse permission. Do not rely on the older Data.gov CC BY record as proof of the 2026 file's licence.
2. Obtain the AHS 2023 relational PUF and official value-label/Table Specifications files; verify the roofing `JOBTYPE` code, the exact C-16-OO universe, replicate-weight calculation, and reconcile p25/median/p75 against Census before any publication. Do not apply a 2023-only `JOBWORKYR` filter to the 2021–2023 national benchmark without a separate analytical reason.
3. Prototype PVWatts V8 requests for a small set of test coordinates and compare outputs to the official calculator. Test API error/warning handling, station distance and model assumptions.
4. Test OpenEI candidate-rate retrieval for overlapping service territories and multiple residential tariffs; compare against the utility's official tariff sheet and current effective date.
5. Download the 2023 National PUF and official Value Labels / Table Specifications; verify `JOBTYPE`, `OMB13CBSA`, project universe and weight fields, then reconcile national and Top 15 metro estimates against Census Table C-16 and its margins of error. The AHS Top 15 use the February 2013 OMB CBSA geography held constant through 2023; build a matching-vintage spatial crosswalk before associating a selected current city with one of those metro summaries.
6. Compare selected municipal permit datasets against AHS estimates. Do not use Miami-Dade `SquareFootage` as roof area until the County confirms its meaning or a record-level audit proves it. Document data refresh cadence, fallback behavior and attribution for every source.

### Gate B — location-aware MVP
1. City/state-to-Census representative-place lookup is implemented; keep the disclosure that place points do not identify the property, utility or permit jurisdiction.
2. The server-side Census, PVWatts and OpenEI routes are deployed in the isolated Cloudflare Preview. They use key protection, input bounds, caching where applicable and a shared D1 counter that is required for all three public API routes. The live database has migrations `0001` and `0002` applied and is bound as `API_QUOTA_DB`. Preview secrets `PVWATTS_API_KEY` and `OPENEI_API_KEY` are configured. The November 4, 2026 smoke test passed live Census, PVWatts and OpenEI calls. Exact Census lookup is capped at 60 reservations per 15-minute bucket and 10,000 per UTC day; nationwide Census autocomplete has a separate 120 per bucket / 20,000 per day cap; PVWatts is capped at 180 per bucket (at most 900 in any rolling hour) and 15,000 per day; OpenEI is separately capped at 60 per bucket and 5,000 per day pending provider-limit confirmation. Production still has no provider secrets and production deployment remains disabled. Optional per-IP WAF throttling is secondary only.
3. Nearby OpenEI residential rate-candidate discovery is implemented and live-tested. The November 4, 2026 Austin Preview request returned 49 candidate records. This is a connectivity test, not a utility/service-territory accuracy study; exact rate confirmation against a customer bill and the utility's current tariff sheet is still required. No automatic tariff application is permitted.
4. Connect modelled production to the existing calculator without changing the existing validated calculation path until regression tests pass.
5. Add test fixtures for multiple climates, utility tariffs, export rules, missing data and upstream API failure.

### Gate C — roof evidence and pilot market
1. Score metro candidates using search demand, data coverage, monetization intent and competition; do not generate city pages simply because a city is in the location lookup.
2. Build one roofing benchmark with transparent sample and scope, or explicitly retain manual quote inputs if the evidence is weak.
3. Publish only a small pilot set after original local analysis and expert review.

### Gate D — launch and monetization
Only after owner identity/contact, qualified review, legal review, browser/accessibility testing, production privacy/CSP, domain/HTTPS and original content gates are complete should the site be considered for indexing or an ad-network application.

## Primary references reviewed

- NLR, [PVWatts V8 API documentation](https://developer.nlr.gov/docs/solar/pvwatts/v8/).
- OpenEI, [Utility Rate Database API documentation](https://apps.openei.org/services/doc/rest/util_rates/).
- U.S. Census Bureau, [2024 ACS 5-year API datasets and geography coverage](https://www.census.gov/data/developers/data-sets/acs-5year.html).
- U.S. Census Bureau, [2023 American Housing Survey data](https://www.census.gov/programs-surveys/ahs/data.2023.html), [2023 public-use files](https://www.census.gov/programs-surveys/ahs/data/2023/ahs-2023-public-use-file--puf-.html), and [AHS roof-replacement definition](https://www2.census.gov/programs-surveys/ahs/2023/2023%20AHS%20Definitions.pdf).
- Berkeley Lab, [U.S. Distributed Solar and Storage Data: 2026 Update](https://emp.lbl.gov/publications/us-distributed-solar-and-storage-0), [2026 user guide](https://eta-publications.lbl.gov/sites/default/files/2026-08/lbnl_publicdatafile_userguide_8.07.26.pdf), and [2026 public CSV](https://bit.ly/trackingthesun2026).
- Google Search Central, [Spam policies: scaled content abuse](https://developers.google.com/search/docs/essentials/spam-policies).
- NLR, [PVWatts calculator limitations and uncertainty notice](https://pvwatts.nlr.gov/pvwatts.php/).
- EnergySage, [2026 H1 marketplace report (September 30, 2026)](https://www.energysage.com/press/energysage-intel-home-electrification-marketplace-report-23/). Industry marketplace data; not a neutral government estimate.
- Journal of Light Construction, [2025 Cost vs. Value methodology](https://www.jlconline.com/cost-vs-value/2025/methodology/). It describes use of BLS price/wage indexes and Verisk local building-cost data, illustrating why local pricing data access is a competitive moat.
- Reddit, [homeowner discussion of sharply different roofing quotes](https://www.reddit.com/r/Roofing/comments/1sgwqn0/getting_roof_quotes_and_the_price_difference_is/). Anecdotal community evidence only; supports showing scope comparisons rather than pretending all quotes are directly comparable.

## What this plan does not claim

It does not establish search volume, keyword difficulty, AdSense RPM, likely revenue, Google ranking potential, legal compliance, technical certification, or guaranteed API/data availability. Those remain separate validation tasks.


## API quota and production guardrails

- NLR documents a default quota of 1,000 API requests per key per rolling hour. The D1 global counter limits this site to 900 PVWatts requests in any rolling hour and 15,000 per UTC day; Exact Census place lookup allows 60 reservations per fixed 15-minute bucket (up to 300 in a sliding 60-minute interval when a window spans five buckets) and 10,000/day; Census autocomplete allows 120 per 15 minutes and 20,000/day; OpenEI allows 60 per 15 minutes and 5,000/day. All three fail closed when D1 is missing or unavailable. Keep the NLR key dedicated to this site, server-side only, and handle upstream HTTP 429 explicitly.
- Current Cloudflare Free documentation lists 100,000 Workers/Pages Function requests/day and D1 allowances of 100,000 rows written/day, 5 million rows read/day and 5 GB total storage. The combined application reservation caps total 30,000 D1 writes/day, leaving headroom; monitor actual usage and recheck live plan limits before launch. Static assets do not invoke Functions. Free-plan WAF rate-limit counters are per-IP and data-center-local, so WAF is optional secondary defense, not a global quota control.
- The PVWatts request is constrained to broad U.S./territory coordinate bounds from Census city/place points and residential-scale array capacity, uses a 100-mile climate-station search radius, and exposes returned station distance to visitors after converting NLR's documented metre units into miles. If no eligible station is available, show an error rather than silently modeling from a distant station.
- Current local tests use mocked upstream responses. The current Preview has a server-side NLR key and a live smoke-test workflow is available for Census and PVWatts; OpenEI still requires an owner-created key. Mocked tests do not by themselves prove live upstream availability.
