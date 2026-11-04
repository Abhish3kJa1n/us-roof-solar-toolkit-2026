# Data research and validation status

**Research source review: November 4, 2026. Runtime integration update: November 4, 2026.** This report records what has been verified from primary-source documentation, what has been implemented, and what remains blocked. No raw source microdata are bundled in the site and no local price outputs have been computed. The current Cloudflare Preview has working live Census, PVWatts and OpenEI integrations; the local-price registry remains withheld.

## Solar production: NLR PVWatts V8

**Verified from NLR documentation**

- V8 is the current API and the same version used by the NLR PVWatts Calculator.
- The NSRDB dataset options include 2020 typical-meteorological-year data for covered locations. Availability can vary by geography.
- Inputs used by this MVP are system capacity, module type, losses, roof-mounted fixed array, tilt, azimuth, latitude and longitude; it requests monthly output.
- API key required; documentation lists a standard ceiling of 1,000 requests/hour.
- Response provides annual and monthly AC output and may include station information and warnings.

**Implemented**

- Same-origin Cloudflare Function at `/api/pvwatts` validates input ranges and forwards only required model inputs.
- API key is read from server-side `PVWATTS_API_KEY`; it is not included in the client response.
- Response is reduced to the annual/monthly results, selected station metadata, inputs, warnings, source and retrieval timestamp.
- The calculator uses the visitor-entered representative coordinates, DC capacity, tilt, azimuth and losses.
- The location workflow can hand the modeled `kWh per kW DC` into the combined and dedicated savings calculators. An EIA state-average rate is passed only as separate context and is never automatically inserted into the marginal import-rate field; a visitor must explicitly opt in to use it as an illustrative scenario. An approved city/state PV price distribution can be passed only when an installed-price record has passed the current publication gates. Household annual usage, self-use, actual marginal tariff, export compensation and property-specific quote values remain user-specific. The runtime registry currently has zero approved solar-price rows.

**Live Preview test and remaining verification**

- A live Preview request succeeded on November 4, 2026: the Austin 1 kW DC smoke scenario returned 1,483 kWh/year, monthly output and weather-station ID 677404. This proves the Preview secret and route work; it does not validate model accuracy across the United States.
- No controlled multi-location comparison against the official PVWatts Calculator has been completed. Before launch, compare several US climate regions and a grid of orientations/loss assumptions using identical settings.
- Verify station distances and model/data coverage across representative regions. The current smoke log records station ID 677404 but not its distance. Production has no PVWatts secret configured; this is Preview-only verification.

NLR documentation: https://developer.nlr.gov/docs/solar/pvwatts/v8/

## City/state place lookup

**Verified from US Census Bureau TIGERweb service documentation and current layer schema**

The location endpoint queries the Census TIGERweb ACS2026 MapServer (January 1, 2026 vintage), using the Incorporated Places layer (28) and Census Designated Places layer (30). It filters by exact place basename and state FIPS, and returns `INTPTLAT` / `INTPTLON`, `GEOID`, place name and type. These coordinates are Census internal representative points, not roof, parcel or necessarily city-centre coordinates. The visitor selects a city and state; ZIP is not required.

**Implemented**

- `/api/location?city=Austin&state=TX` validates a 2–80 character city/place name and a supported state/territory abbreviation.
- The endpoint queries both place layers in parallel; the visitor chooses among multiple matches.
- The user interface clearly labels the coordinate as a Census representative point and separately warns that it does not establish utility service territory, tariff, permit jurisdiction or rooftop position.
- The state-level EIA electricity-price benchmark is loaded separately after a place is selected. It is contextual state average data, not the homeowner’s actual tariff.

**Limitations**

A Census place point cannot identify a parcel, roof plane, utility service territory, tariff plan, permit jurisdiction or exact property weather conditions. City boundaries may not align with municipal utility service areas. Place names can collide within a state and a chosen Census geography may not match the visitor’s colloquial understanding of a city. The UI therefore allows the user to select the exact returned geography.

Census TIGERweb service: https://tigerweb.geo.census.gov/tigerweb/

## Utility tariffs: OpenEI URDB

**Verified from OpenEI documentation**

- The `/utility_rates` endpoint supports lookup by latitude/longitude, radius, sector and detail level.
- An API key is required; OpenEI says a key can be requested for free.
- Residential candidate records can be discovered by geographic proximity.

**Implemented**

- `/api/tariffs` is an optional same-origin discovery endpoint. It requests nearby residential rate records within 10 miles of the selected Census representative place coordinate and returns only candidate metadata and source links.
- The page never chooses a candidate automatically, never applies an OpenEI rate to the savings result and instructs users to compare against their actual bill and current official tariff.

**Live integration verified — November 4, 2026**

- The current Cloudflare Pages Preview has `OPENEI_API_KEY` configured as a server-side secret.
- A real request through the deployed `/api/tariffs` route succeeded for the Austin, Texas smoke-test location and returned 49 nearby residential tariff candidate records.
- The same deployment also passed Census ACS2026 autocomplete/exact lookup and NLR PVWatts V8 live requests.
- This verifies that the Preview secret is readable by the server-side Function and that the OpenEI route can authenticate and return records. It does **not** verify that any candidate is the homeowner's utility, service territory, active tariff or applicable marginal rate. Candidate selection remains manual and no rate is automatically applied to savings.
- Record freshness, utility-by-utility completeness, overlapping service territories, tariff effective dates, provider limits and commercial reuse/redistribution terms remain unverified. Production has no OpenEI secret configured; this is Preview-only verification.

OpenEI docs: https://apps.openei.org/services/doc/rest/util_rates/

## Roof pricing: 2023 American Housing Survey

**Verified facts from Census / HUD primary sources**

- The 2023 Census/HUD AHS Home Improvements infographic reports a **$10,000 median roofing expenditure** for its 2021–2023 reference period, rounded to the nearest $100. It also reports about 8.3 million roofing projects and $93.5 billion in total roofing expenditures. These are national owner-reported home-improvement statistics, not contractor invoice medians or local replacement quotes.
- The questionnaire contains roof-specific items such as `ROOFAM`, `ROOFWK`, `ROOFCMP`, `ROOFYR` and `ROOFYRCST`. Those are instrument variables. The relational Public Use File (PUF) instead stores home-improvement jobs in generic project records, joined to the household file by `CONTROL`; its project variables include `JOBTYPE`, `JOBCOST` and `JOBDIY`.
- The Census documentation states that `JOBCOST` is hot-deck imputed for some records and `JOBDIY` is imputed using a logistic-regression model. AHS PUF data also use edit/imputation flags. Thus PUF-derived estimates must be described as including Census-edited/imputed values unless a correctly coded sensitivity analysis excludes them.
- The AHS home-improvement module is for owner-occupied units and covers projects in the two years before interview. The data are nominal survey dollars for roughly 2021–2023; the published infographic's $10,000 median is a primary-source anchor, not a 2026 quote.
- The AHS does not provide a roof-size denominator, a consistent material/scope breakdown, or a clean $/roofing-square rate. It cannot support local $/sq-ft estimates.
- The 2023 National PUF includes the 2013 OMB CBSA identifier for the 15 largest metropolitan areas; the 2023 National and Metropolitan PUFs are separate releases. For the Top 15, AHS holds the February 2013 OMB CBSA definitions constant through the 2023 survey. This supports metro—not city—benchmarking. A selected current city can only inherit a metro reference after a defensible spatial crosswalk to those 2013 CBSA boundaries; city-name matching or a current-2026 CBSA code is not sufficient. The PUF summary still has to be reconciled against Census-published C-16 estimates and margins of error.

**Implemented research script (corrected PUF schema)**

- `scripts/analyze_ahs_roof.py` reads the relational 2023 **National** PUF PROJECT and HOUSEHOLD CSVs and joins them by `CONTROL`. The official National PUF mini-codebook lists `OMB13CBSA`, `WEIGHT` and `REPWEIGHTXXX` fields; the current script uses `WEIGHT` and `REPWEIGHT1..160` and emits exploratory national and Top 15 metro summaries. The script filters owner-occupied interviewed households (`TENURE=1`, `INTSTATUS=1`), a user-supplied `JOBTYPE` code, `JOBDIY` in {1,2}, and nonnegative `JOBCOST`. The numeric roofing `JOBTYPE` code must be verified from the official 2023 Value Labels Package. The codebook confirms field names exist; it does not by itself prove the selected weights and universe reproduce Table C-16.
- It includes zero-cost and Census-edited/imputed PUF values under an intended broad AHS Table C-16-OO-style PUF universe; exact equivalence has not been proven. It reports overall roofing jobs plus the two `JOBDIY` groups. Those groups are **not** labelled contractor vs DIY because “household did not do most work” is not identical to a verified professional invoice, and the status itself is imputed for some cases.
- It joins `WEIGHT` and `REPWEIGHT1`–`REPWEIGHT160`, then outputs weighted percentiles and exploratory Fay-BRR standard errors / approximate 90% intervals. The interval and quantile calculations still require independent reconciliation to Census's Table Specifications workbook before any publication.
- The test suite now uses PUF-style `JOBTYPE` / `JOBCOST` / `JOBDIY` records, not questionnaire-only `ROOFAM` / `ROOFWK` / `ROOFYRCST` fields.

**Not yet verified / launch blockers**

- The official 124 MB National PUF relational archive could not be downloaded and processed in this environment. Census publishes separate 2023 National and Metropolitan PUFs; the current script is designed for the National PUF because it uses the National PUF's `OMB13CBSA` geography field. No real AHS PUF calculation has been executed here; synthetic fixtures verify script mechanics only. The selected-city-to-2013-CBSA crosswalk has not been implemented; the live calculator must not display an AHS metro benchmark merely from a current city selection.
- The $10,000 Census infographic number is from the AHS Table Creator / Internal Use File; a PUF calculation is expected to differ slightly because the PUF applies confidentiality protection. The PUF output must be reconciled against the official Table Specifications and PUF Estimates workbook, not forced to match the infographic.
- The AHS survey does not ensure the roof job was a full tear-off and replacement; it covers roof additions/replacements as described by the instrument. Costs can include different scope and household work. PUF-derived metro estimates are research-only until checked against the Census Table C-16 metro output and its margins of error. No individual-city, ZIP or cost-per-square-foot values are supported by this source. A city-to-metro association remains a separate spatial crosswalk task; the live city lookup does not currently select an AHS metro automatically.
- The weighted quantile/replicate interval method remains research-only; reconcile the exact C-16 universe, final weight, replicate-weight treatment and variance method against the Table Specifications/PUF Estimates workbook and official AHS variance guidance before use. The codebook lists the standard and replicate-weight fields, but the correct C-16 selection has not been proven. The exact roofing `JOBTYPE` numeric value remains unverified because the 2023 Value Labels Package could not be downloaded in this environment. The test fixture's code `16` is synthetic only, not a confirmed roofing code.

Sources:

- 2023 Home Improvements Infographic (Census/HUD; $10,000 roofing median, 2021–2023): https://www.census.gov/content/dam/Census/library/visualizations/2024/demo/2023%20Home%20Improvements%20Infographic.pdf
- 2023 National PUF and relational file documentation: https://www.census.gov/programs-surveys/ahs/data/2023/ahs-2023-public-use-file--puf-/ahs-2023-national-public-use-file--puf-.html
- AHS PUF codebook and documentation: https://www.census.gov/programs-surveys/ahs/tech-documentation.html
- Getting Started with the PUF: https://www.census.gov/content/dam/Census/programs-surveys/ahs/tech-documentation/2015/Getting%20Started%20with%20the%20AHS%20PUF%202015%20and%20Beyond.pdf
- 2023 AHS imputation guidance: https://www.census.gov/programs-surveys/ahs/tech-documentation.html
- 2023 AHS items booklet (questionnaire labels, not PUF project-field names): https://www2.census.gov/programs-surveys/ahs/2023/2023__AHS_Items_Booklet.pdf
- AHS replicate-weight variance guide: https://www2.census.gov/programs-surveys/ahs/tech-documentation/2015/Quick_Guide_to_Estimating_Variance_Using_Replicate_Weights_2009_to_Current.pdf


**Additional primary-source file and table checks — November 4, 2026**

- Census publishes separate 2023 National and Metropolitan relational PUFs. The National PUF v1.1 CSV archive is listed at 124 MB; the Metropolitan PUF v1.1 CSV archive is listed at 20 MB. The current roof analysis script is designed for the **National** relational PROJECT and HOUSEHOLD files, not the Metropolitan PUF.
- The official National and Metropolitan mini-codebooks list `OMB13CBSA`, `WEIGHT` and `REPWEIGHTXXX` fields and the project-level `JOBTYPE`, `JOBCOST` and `JOBDIY` fields. This confirms the variables exist; the Table Specifications and PUF Estimates workbook must still establish the exact C-16 selection, weights and universe.
- Census describes Table C-16 as job/project-level: it counts each home-improvement project and includes the professional/do-it-yourself variable, whereas C-15 is housing-unit-level and counts improvement types once per housing unit. This supports analyzing project records rather than household-level counts.
- Do not treat the script's synthetic test value `JOBTYPE=16` as verified. The official Value Labels Package must be inspected to identify the roofing category and any relevant distinctions.
- The standard and replicate-weight field presence does not prove the script's exact weight choice. AHS has separate weights for certain rotating topical modules; the correct weight for the Home Improvement C-16 table must be checked against the 2023 Table Specifications/PUF Estimates and methodology before publication.

Sources:

- 2023 National and Metropolitan PUF landing page: https://www.census.gov/programs-surveys/ahs/data/2023/ahs-2023-public-use-file--puf-.html
- 2023 Metropolitan PUF details and file sizes: https://www.census.gov/programs-surveys/ahs/data/2023/ahs-2023-public-use-file--puf-/2023-ahs-metropolitan-puf-microdata.html
- AHS 2023 National PUF mini-codebook: https://www.census.gov/data-tools/demo/data/uccb/ahsdict/minicodebooks/ahs_mini_2023National.pdf
- AHS 2023 Metropolitan PUF mini-codebook: https://www.census.gov/data-tools/demo/data/uccb/ahsdict/minicodebooks/ahs_mini_2023Metro.pdf
- 2023 Table Creator release notes (C-15 vs C-16 project-level distinction): https://www.census.gov/programs-surveys/ahs/tech-documentation/user-notes/ahs-table-creator-release-notes.html
- AHS technical documentation and weighting references: https://www.census.gov/programs-surveys/ahs/tech-documentation.html
- 2023 topical content variable reference file: https://www2.census.gov/programs-surveys/ahs/documentation/2023%20AHS%20Topical%20Content%20Variable%20Reference%20File.pdf
- 2023 Metropolitan PUF Table Specifications and Value Labels Package are linked from the Metropolitan PUF page above.

## Solar installed-price context: Berkeley Lab Tracking the Sun

**Verified from Berkeley Lab's official August 2026 publication record; current file-level details still need inspection**

- The official 2026 update record says Berkeley Lab's dataset contains roughly **5.3 million individual systems installed through year-end 2025** and includes project-level technical characteristics, installed prices, financing and customer-segment fields. This is the overall dataset count, not a confirmed row count for the downloadable public CSV.
- The Tracking the Sun landing page still contains older update text in places. Use the August 2026 publication record as the current release reference; do not repeat the prior claim that the current public CSV has exactly 4.0 million rows or 81 fields until the actual 2026 file is counted and its guide is checked.
- Berkeley Lab defines distributed solar to include residential systems, roof-mounted non-residential systems and qualifying ground-mounted systems. The homeowner benchmark therefore requires a strict residential, rooftop, PV-only host-owned cohort rather than using the full dataset indiscriminately.
- The current 2026 user-guide link is listed in Berkeley Lab's 2026 publication record, but the PDF and public CSV were not successfully downloaded and inspected in this audit environment. Prior-year guide field names, missing-value codes and price semantics must be revalidated against the 2026 guide before processing.

**Implemented research pipeline**

- `scripts/analyze_berkeley_solar.py` accepts the LBNL CSV and defaults to a 2024–2025 residential single-family (`RES`/`RES_SF`), PV-only, non-ground-mounted 1–25 kW DC cohort. It requires both reported and inferred third-party-ownership flags to explicitly say host/customer-owned, and explicitly excludes self-installed, expansion and multi-phase systems. Rows missing critical cohort fields are excluded rather than assumed.
- It calculates city/state nominal $/W DC distributions (median, p10, p25, p75 and p90), includes the state column in city output, records city spelling variants, creates city coverage diagnostics, and suppresses city groups below n=100 and state groups below n=500 by default. Thresholds are minimum data-quality gates, not proof that samples are representative.
- City names receive only case/Unicode/whitespace normalization; genuine aliases are not merged. Outputs are research-only and do not include record-level rows.

**Not yet verified**

- The 2026 public CSV was not downloaded in this environment and no statistics have been computed. Count the downloaded file and verify every field, filter and missing-value rule against the 2026 guide before using the existing analysis script. The 2024–2025 installation window reduces stale-price mixing but does not inflation-adjust values or make the dataset a representative census of every local installation.
- Licence caution: the older Data.gov CC BY 4.0 catalogue record does not establish the licence for the August 2026 public CSV. Berkeley Lab's general copyright terms reserve rights unless a different licence is expressly designated. Obtain written confirmation from LBNL or a clear current dataset licence before commercial reuse of the file or derived commercial price tables.
- Even with permission, the dataset is not a probability sample of every installed system and self-reported pricing is heterogeneous. City descriptive percentiles may support a labelled historical installed-price reference only when sample count, period, filters and limitations are visible; they must not be portrayed as guaranteed quotes or a complete census of the local cash market.

Sources:

- Tracking the Sun landing page: https://emp.lbl.gov/tracking-the-sun
- Official 2026 update publication record: https://emp.lbl.gov/publications/us-distributed-solar-and-storage-0
- 2026 user guide (listed with the official 2026 record): https://eta-publications.lbl.gov/sites/default/files/2026-08/lbnl_publicdatafile_userguide_8.07.26.pdf
- 2026 public data-file link listed in the guide: https://bit.ly/trackingthesun2026
- Older Data.gov catalogue record (CC BY 4.0; not proof of the 2026 file licence): https://catalog.data.gov/dataset/tracking-the-sun
- Berkeley Lab general copyright terms: https://www.lbl.gov/terms-and-conditions/copyright/


## City-level roofing evidence: municipal permit records

**Verified primary-source examples**

- **Miami-Dade County:** the official ArcGIS permit table schema exposes `PermitIssuedDate`, `ApplicationDate`, `PermitType`, `ResidentialCommercial`, `EstimatedValue`, `ApplicationTypeDescription`, `DetailDescriptionComments`, `SquareFootage`, structure fields, `City` and `State`. However, `SquareFootage` is a text field with no exposed definition proving it is the roof-plan area; a reroof record sample from a secondary mirror showed zero in this field. County roofing applications require roof plans and total roofing area, but we have not established that this field exports that area. A secondary analysis claims a 5,305-permit cohort and material-specific value per square foot, but its denominator is not independently traced to an official roof-area field. Do not use its $/sq-ft figures or imply local installed rates until that provenance is proven.
- **Cape Coral, Florida:** the official City ArcGIS Building Permits layer exposes permit status, application/issue/final dates, `permitvalue`, description, occupancy and city fields. The schema inspected does not expose a matching explicit roof-area field, so declared job value can be summarised but cannot be converted into a reliable $/sq-ft estimate from this layer alone.
- **San Francisco PermitSF:** the City's permit dataset includes a `Reroofing permit` type and a `valuation` field, but the portal began rolling out digital permits in February 2026. The valuation's completeness among reroof permits must be measured; no roof-area field was identified in the schema inspected.
- Other cities publish construction permits with valuation fields, but schemas, licences, record histories and roofing classifications vary. Some permit datasets may have restrictions on commercial reuse.

**Current decision**

- Municipal permit data can support selected-city, clearly labelled *declared permit valuation* indicators if their jurisdiction-specific schema, licence, sample count and record status pass review.
- They are not sufficient by themselves to state the homeowner's expected installed roof price. Do not divide permit valuation by a generic roof area, combine incomplete jurisdictions, or call it an average contractor quote.
- The live roof estimator therefore remains a transparent scenario model with user-entered comparable installed rates/quotes. The best next authoritative reference is AHS metro-level data for the 15 major metro areas, but it must be validated first; outside that geography it remains national/context-only. Unsupported cities must not be assigned fake local prices.

Sources:

- San Francisco PermitSF / data.gov dataset listing: https://catalog.data.gov/dataset/permitsf-permitting-data
- Census 2023 Top 15 metro Home Improvement Costs Table C-16: https://www.census.gov/programs-surveys/ahs/data/interactive/ahstablecreator.html?areas=00100&bygroup1=COL_TOP_15&bygroup2=1&filtergroup1=01&tablename=TABLE16&year=2023
- Census PUF geography guidance: https://www.census.gov/content/dam/Census/programs-surveys/ahs/tech-documentation/2015/Getting%20Started%20with%20the%20AHS%20PUF%202015%20and%20Beyond.pdf
- Census metro area histories and OMB13CBSA codes: https://www.census.gov/content/dam/Census/programs-surveys/ahs/tech-documentation/2015/Metro%20Area%20Histories%202015%20and%20Beyond.pdf
- San Francisco PermitSF public dataset: https://data.sf.gov/d/tyz3-vt28 (PDDL 1.0 listed in the catalogue; field-level checks remain necessary)
- Miami-Dade County permit ArcGIS layer: https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/miamidade_permit_data/FeatureServer/0
- Cape Coral building-permit ArcGIS layer: https://capeims.capecoral.gov/arcgis/rest/services/OpenData/OpenData/MapServer/1
- Census/HUD 2023 AHS: https://www.census.gov/content/dam/Census/library/visualizations/2024/demo/2023%20Home%20Improvements%20Infographic.pdf

## Current release decision

**No local roof-price or solar-price number is approved for public display from these datasets yet.** The live solar estimator can use PVWatts after the owner configures a key. The research pipeline is ready to evaluate LBNL city-level solar price distributions, but the real CSV and a commercial-reuse licence clearance are still missing. The live roof cost estimator remains based on visitor-entered comparable prices/quotes; selected-city permit data may become a separately labelled local benchmark after each jurisdiction is validated. Do not create city pages with invented multipliers or thin text.


## November 1 publication gate implementation

- Added a deliberately empty public registry at `data/price-benchmarks.json`, plus a client-side display module. It can render LBNL historical city/state installed-price percentiles or selected AHS metro whole-project cost percentiles only when each record passes explicit sample, source, unit, geography, period, scope and publication-approval checks. The AHS figure is never treated as price per roof square foot and does not feed the roof-cost calculator.
- Added `scripts/validate_price_benchmarks.py`, `scripts/test_price_benchmark_gates.py` and `scripts/test_price_benchmarks.py`. Synthetic data are used only inside tests to verify both positive and negative branches. No real benchmark values were computed or added to the public registry.
- Current statuses remain: LBNL = withheld pending real CSV review and commercial reuse clearance; AHS metro = withheld pending codebook/JOBTYPE, weighted estimates, replicate variance, C-16 reconciliation and geography validation. The registry's `records` array is empty.
- A same-origin static JSON GET is used to load the registry. It sends no visitor-provided values and is not an API to a third party.
- Search-market review is summarised in `KEYWORD-DEMAND-VALIDATION.md`. It found established general-purpose roof and solar calculators and community demand for clear proposal-scope comparisons, but did not establish numeric search volume or ranking opportunity. The initial product thesis is now a quote-comparison and roof/solar sequencing workflow; no city-page expansion is approved.

## November 1, 2026 — current prefill and field-validation wiring

- The combined calculator, standalone roof replacement calculator and standalone solar savings calculator now use disclosed editable fallback references. The roof tool preloads Angi's broad national $4–$11/roof-sq-ft range; selecting Metal clears the generic reference and selecting an exact metal system loads its HomeGuide reference. The savings tool preloads the EnergySage H1 2026 national solar-only median of $2.62/W DC. These are context references, never represented as city prices or quotes.
- The standalone solar savings tool receives city/state with the PVWatts handoff and independently checks the static public price registry before replacing the national fallback with a matching approved LBNL row. It enforces source host, registry release state, metric, sample, 2024–2025 installation period, quantile ordering and approval flags. A visitor edit during the lookup is preserved.
- The source-gated price registry remains deliberately empty. Approved city/state solar installed-price rows: 0. Approved AHS metro whole-project roof spending rows: 0. No city roofing prices or synthetic benchmark rows are published.
- Field-level validation is shared across eight calculator/data-entry pages. It performs inline hard-error checks and non-blocking warnings, shows per-field ranges/units/precision, handles paired/conditional fields and repeats validation at calculation time.
- Full local QA passed after these changes. This remains deterministic code/DOM testing only; no live API, actual local pricing, browser/device, professional, legal or production validation is implied.
