# Data research and validation status

**Research source review: November 5, 2026. Runtime integration update: November 4, 2026.**

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
- The AHS home-improvement module is for owner-occupied units and covers projects in the two years before interview. The PUF HOUSEHOLD file contains one row per housing unit; the PROJECT file has one row per improvement project and a many-to-one relationship to HOUSEHOLD, with up to 26 projects per housing unit. Thus project records are not independent respondent/housing-unit counts. The data are nominal survey dollars for roughly 2021–2023; the published infographic's $10,000 median is a primary-source anchor, not a 2026 quote.
- The AHS does not provide a roof-size denominator, a consistent material/scope breakdown, or a clean $/roofing-square rate. It cannot support local $/sq-ft estimates.
- The National PUF's OMB13CBSA is populated for the Top 15 and uses February 2013 OMB CBSA geography. The separate Metropolitan PUF uses OMB13CBSA for the independent Metro sample. The official 2023 sample design says only five Next-10 areas were interviewed in 2023: Cincinnati, OH-KY-IN (17140); Cleveland-Elyria, OH (17460); Denver-Aurora-Lakewood, CO (19740); Milwaukee-Waukesha-West Allis, WI (33340); and New Orleans-Metairie, LA (35380). The actual Metropolitan PUF geography counts match the Census Sample Design Table 2.2 interviewed-unit counts exactly (1,936; 1,555; 2,057; 1,905; 1,788). These source files and their household weights must be analyzed separately. A selected city may inherit a metro-wide reference only after a defensible point-in-polygon crosswalk to the matching February 2013 OMB CBSA geography. City-name matching or a current-2026 CBSA code is not sufficient.

**Implemented research script (corrected PUF schema)**

- scripts/analyze_ahs_roof.py now accepts either PUF, but each run is source-specific and the two PUFs are never pooled. It joins each PUF's own relational PROJECT and HOUSEHOLD records by CONTROL, and uses that PUF's WEIGHT and REPWEIGHT1..160. The official Value Labels package confirms JOBTYPE='16' is Added or replaced roofing; the C-16-OO owner-occupied/interviewed universe is TENURE=1 and INTSTATUS=1. JOBDIY=1 is Do-It-Yourself and JOBDIY=2 is Professional. The real National PUF run reproduced the C-16 PUF point estimates at published precision: weighted project count 8,300,625 (~8.301 million), median $10,000, mean $11,610, and total expenditures $93,525,579,921 (~$93.526 billion).
- The estimator now follows the separate C-16 rules: project counts include eligible JOBTYPE/JOBDIY records regardless of cost validity; means/medians/percentiles use `JOBCOST > 0`; total expenditure uses `JOBCOST >= 0`. The actual National PUF contained 2,641 eligible owner-occupied/interviewed roofing jobs: 2,559 with positive costs and 82 zero-cost. The JOBDIY groups are not treated as contractor invoice vs DIY pricing; they describe who did most of the work, and JOBDIY is imputed for some records.
- The Census Bureau's AHS replicate-weight guide explicitly prescribes the Fay-BRR variance formula 4/160 × sum of squared differences between each replicate estimate and the full-sample estimate; the analyzer uses this formula for mean, median, quartiles and totals. It reports project records and distinct housing units separately, and calculates metric-specific CVs for mean, median, p25 and p75. The AHS Table Creator suppresses cells with CV ≥30%; the research workflow uses that as a screen, not automatic approval. PUF estimates can differ from Table Creator estimates because Census applies topcoding and geographic disclosure avoidance to the PUF. Do not force PUF point estimates or margins to match Table Creator outputs.
- The test suite now uses PUF-style `JOBTYPE` / `JOBCOST` / `JOBDIY` records, not questionnaire-only `ROOFAM` / `ROOFWK` / `ROOFYRCST` fields.

**Not yet verified / launch blockers**

- The official National PUF and separate Metropolitan PUF v1.1 CSV ZIPs were downloaded and inspected in temporary GitHub Actions runners. The National PUF contains the integrated national sample and Top-15 geography. The Metropolitan PUF household file has exactly the five 2023 Next-10 OMB13CBSA groups and its five frequencies match Census Table 2.2 interviewed counts. The audit now runs the Metro PUF through the same estimator using its own matched PROJECT/HOUSEHOLD records and replicate weights; computed outputs remain temporary research data. No raw source records or calculated price tables are committed or uploaded as artifacts. The selected-city-to-February-2013-CBSA crosswalk has not been implemented; the live city lookup must not display an AHS metro benchmark merely from a current city selection.
- The PUF output was reconciled against the official C-16 Table Specifications workbook's **PUF estimate** column, not against the infographic/IUF estimate. National median and mean are $10,000 and $11,610; weighted project count is 8.301 million; total expenditure is $93.526 billion. The point estimates align to the workbook's displayed precision. The PUF has confidentiality protection and values should not be forced to match IUF/Table Creator estimates.
- The AHS survey does not ensure a job was a full tear-off and replacement; it covers additions or replacement of roofing as described by the instrument. Costs can include different scope and household work, and item responses can be edited or imputed. The 2023 source report states a survey-wide 59.2% unit nonresponse rate and warns that nonresponse adjustment may not fully remove bias. Separately, Table 2.2 reports weighted response rates for the five Next-10 metros: Cincinnati 62.9%, Cleveland 51.9%, Denver 59.6%, Milwaukee 61.4% and New Orleans 61.0%. Do not substitute the survey-wide unit nonresponse figure for an area-specific weighted response rate. No individual-city, ZIP or cost-per-square-foot values are supported by AHS. A city-to-February-2013-CBSA crosswalk is still a separate requirement; the live city lookup does not currently select an AHS metro automatically.
- National point-estimate reconciliation is complete at the workbook's PUF-estimate precision. The Fay-BRR formula is verified against the Census guide; remaining publication gates are separate Top-15/Next-5 outputs, professional-only positive-cost distributions, at least 30 distinct positive-cost housing units contributing positive-cost observations to each cost distribution as an internal minimum, CV <30% for mean/median/p25/p75, manual precision and nonsampling-risk review, and the city-to-February-2013-CBSA crosswalk. The five Next-10 area weighted response rates vary from 51.9% to 62.9%; they are separate from the survey-wide 59.2% unit nonresponse figure.

Sources:

- 2023 Home Improvements Infographic (Census/HUD; $10,000 roofing median, 2021–2023): https://www.census.gov/content/dam/Census/library/visualizations/2024/demo/2023%20Home%20Improvements%20Infographic.pdf
- 2023 National PUF and relational file documentation: https://www.census.gov/programs-surveys/ahs/data/2023/ahs-2023-public-use-file--puf-/ahs-2023-national-public-use-file--puf-.html
- AHS PUF codebook and documentation: https://www.census.gov/programs-surveys/ahs/tech-documentation.html
- Getting Started with the PUF: https://www.census.gov/content/dam/Census/programs-surveys/ahs/tech-documentation/2015/Getting%20Started%20with%20the%20AHS%20PUF%202015%20and%20Beyond.pdf
- 2023 AHS imputation guidance: https://www.census.gov/programs-surveys/ahs/tech-documentation.html
- 2023 AHS items booklet (questionnaire labels, not PUF project-field names): https://www2.census.gov/programs-surveys/ahs/2023/2023__AHS_Items_Booklet.pdf
- AHS replicate-weight variance guide: https://www2.census.gov/programs-surveys/ahs/tech-documentation/2015/Quick_Guide_to_Estimating_Variance_Using_Replicate_Weights_2009_to_Current.pdf
- 2023 Independent Metropolitan Sample Design, weighting, response-rate and geography Table 2.2: https://www2.census.gov/programs-surveys/ahs/2023/2023%20AHS%20Metropolitan%20Sample%20Design%2C%20Weighting%2C%20and%20Error%20Estimation.pdf
- Getting Started with the AHS PUF (HOUSEHOLD/PROJECT relationship, PUF/IUF and geography): https://www.census.gov/content/dam/Census/programs-surveys/ahs/tech-documentation/2015/Getting%20Started%20with%20the%20AHS%20PUF%202015%20and%20Beyond.pdf
- AHS Table Creator Help Guide (CV ≥30% suppression): https://www.census.gov/content/dam/Census/programs-surveys/ahs/tech-documentation/help-guides/Table_Creator_Help_Guide.pdf


**Additional primary-source file and table checks — November 4, 2026**

- Census publishes separate 2023 National and Metropolitan relational PUFs. The National PUF v1.1 archive downloaded in the temporary runner at 129,491,194 bytes and contained `project.csv` and `household.csv`; the actual files contained 44,689 and 55,669 rows respectively. The current estimator uses the **National** PROJECT and HOUSEHOLD files and the National household file's `OMB13CBSA` field for research-only Top 15 subgroup diagnostics; this is not the same as analyzing the separate Metropolitan PUF.
- The official 2023 National PUF Value Labels package confirms `JOBTYPE='16'` means **Added or replaced roofing**. C-16-OO uses interviewed owner-occupied households (`INTSTATUS='1'` and `TENURE='1'`) and separates `JOBDIY='1'` (Do-It-Yourself) from `JOBDIY='2'` (Professional). The Table Specifications define different cost conditions: project counts include eligible projects, median/mean costs require `JOBCOST>0`, and total expenditures use `JOBCOST>=0`.
- Census describes Table C-16 as job/project-level: it counts each home-improvement project and includes the professional/do-it-yourself variable, whereas C-15 is housing-unit-level and counts improvement types once per housing unit. This supports analyzing project records rather than household-level counts.
- The actual National PUF calculation returned 2,641 eligible owner-occupied/interviewed roofing jobs: 2,559 had positive `JOBCOST`, 82 had zero cost, and none had missing/negative cost or an out-of-scope `JOBDIY` value. Synthetic regression tests also prove that zero-cost jobs affect project counts but not median/mean, while nonnegative costs feed total expenditure.
- Using standard `WEIGHT` plus `REPWEIGHT1..160`, the real National PUF calculation matched the C-16 PUF estimate column at displayed precision: weighted project count 8,300,625 (C-16: 8,301,000 rounded to nearest thousand), median $10,000, mean $11,610, and total expenditure $93,525,579,921 (C-16: $93,525,580,000). This supports the point-estimate universe/weight choice. The current Fay-BRR 90% margins differ from the workbook Table Creator margins: median $670 vs $661 (+1.4%), mean $396 vs $423 (-6.4%), and total $5.17bn vs $5.36bn (-3.7%). Do not publish calculated confidence intervals until the variance procedure is reconciled.

Sources:

- 2023 National and Metropolitan PUF landing page: https://www.census.gov/programs-surveys/ahs/data/2023/ahs-2023-public-use-file--puf-.html
- 2023 Metropolitan PUF details and file sizes: https://www.census.gov/programs-surveys/ahs/data/2023/ahs-2023-public-use-file--puf-/2023-ahs-metropolitan-puf-microdata.html
- AHS 2023 National PUF mini-codebook: https://www.census.gov/data-tools/demo/data/uccb/ahsdict/minicodebooks/ahs_mini_2023National.pdf
- AHS 2023 Metropolitan PUF mini-codebook: https://www.census.gov/data-tools/demo/data/uccb/ahsdict/minicodebooks/ahs_mini_2023Metro.pdf
- Public Use File Geography: 2015 to 2023 (official OMB13CBSA codes and names): https://www.census.gov/content/dam/Census/programs-surveys/ahs/tech-documentation/2015/PUF%20Geography%202015%20and%20Beyond.pdf
- 2023 Table Creator release notes (C-15 vs C-16 project-level distinction): https://www.census.gov/programs-surveys/ahs/tech-documentation/user-notes/ahs-table-creator-release-notes.html
- AHS technical documentation and weighting references: https://www.census.gov/programs-surveys/ahs/tech-documentation.html
- 2023 topical content variable reference file: https://www2.census.gov/programs-surveys/ahs/documentation/2023%20AHS%20Topical%20Content%20Variable%20Reference%20File.pdf
- 2023 Metropolitan PUF Table Specifications and Value Labels Package are linked from the Metropolitan PUF page above.

## Solar installed-price context: Berkeley Lab Tracking the Sun

**Verified from Berkeley Lab's official August 2026 publication record and 2026 user guide; public CSV remains under audit**

- The official 2026 update record says Berkeley Lab's dataset contains roughly **5.3 million individual systems installed through year-end 2025** and includes project-level technical characteristics, installed prices, financing and customer-segment fields. This is the overall dataset count, not a confirmed row count for the downloadable public CSV.
- The Tracking the Sun landing page still contains older update text in places. Use the August 2026 publication record as the current release reference; do not repeat the prior claim that the current public CSV has exactly 4.0 million rows or 81 fields until the actual 2026 file is counted and its guide is checked.
- Berkeley Lab defines distributed solar to include residential systems, roof-mounted non-residential systems and qualifying ground-mounted systems. The homeowner benchmark therefore requires a strict residential, rooftop, PV-only host-owned cohort rather than using the full dataset indiscriminately.
- The official 2026 user guide has now been downloaded successfully to a temporary GitHub runner (926,394 bytes; SHA-256 `1a287692b6abe5532c53b6a8117d9be4dece4edf66978f88b1a2ea20c29da298`) and its extracted text confirms the current guide documents the cohort's core field names. The public CSV shortlink redirects to a Google Drive preview page; the first attempt retrieved HTML, not data. A Google Drive-aware downloader is in the latest temporary-runner workflow, but the actual CSV row count, exact field schema/value codes and cohort compatibility are not yet verified.

**Implemented research pipeline**

- `scripts/analyze_berkeley_solar.py` accepts the LBNL CSV and defaults to a 2024–2025 residential single-family (`RES`/`RES_SF`), PV-only, non-ground-mounted 1–25 kW DC cohort. It requires both reported and inferred third-party-ownership flags to explicitly say host/customer-owned, and explicitly excludes self-installed, expansion and multi-phase systems. Rows missing critical cohort fields are excluded rather than assumed.
- It calculates city/state nominal $/W DC distributions (median, p10, p25, p75 and p90), includes the state column in city output, records city spelling variants, creates city coverage diagnostics, and suppresses city groups below n=100 and state groups below n=500 by default. Thresholds are minimum data-quality gates, not proof that samples are representative.
- Important cohort label: the 2026 guide defines RES_SF as known residential single-family, RES_MF as known residential multifamily, and RES as residential when subtype detail is not specified. The current RES + RES_SF cohort includes known single-family and unspecified residential; it is not a pure single-family sample. Known RES_MF is excluded.
- The guide warns that installation_date may be a proxy such as an incentive-claim or inspection date. The 2024–2025 window is therefore a reported/provider date window, not an independently verified installation-date census.
- City names receive only case/Unicode/whitespace normalization; genuine aliases are not merged. Outputs are research-only and do not include record-level rows.

**Not yet verified**

- The exact 2026 public CSV has now been streamed from the official public link and inspected. Its ZIP member is method-9 Deflate64; the extracted CSV is 2,423,981,133 bytes, with 3,995,665 rows and 94 columns. Berkeley Lab's public landing page describes roughly 5.3 million systems; that headline is not the actual CSV row count. The count-definition difference has not been reconciled and must not be conflated.
- The strict 2024–2025 residential/PV-only/rooftop/host-owned/non-self-installed/non-expansion/single-phase cohort produced 60,229 records. At current screens, 152 city groups pass n≥100 but only 2 states pass n≥500. The full per-state distribution and counts at city thresholds n≥50/100/200/500 are being added to the audit output before deciding whether state fallback or wider city coverage is supportable.
- LBNL's 2026 guide defines `total_installed_price` as a pre-incentive provider/host/applicant-reported price, potentially estimated; it is not an independently verified cash quote. `RES` means unspecified residential subtype; `RES_SF` is known single-family and `RES_MF` known multifamily. The current `RES` + `RES_SF` scope is not a pure single-family sample. The guide also cautions that installation_date may be an incentive-claim or inspection proxy.
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
- The live roof estimator remains a transparent scenario model with user-entered comparable installed rates/quotes. AHS national whole-project cost point estimates are validated against the PUF column of Table C-16, but they are not city rates, not $/sq-ft prices, and not local quotes. Metro-level AHS rows remain withheld pending metro-output and variance reconciliation plus a 2013 CBSA crosswalk. Unsupported cities must not be assigned fake local prices.

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

**No local roof-price or solar-price number is approved for public display from these datasets yet.** The AHS National PUF national point-estimate reconciliation is complete and the independent 2023 Metropolitan PUF's five Next-10 geography identifiers have been verified against Census interviewed-unit counts. The audit computes separate Metro PUF roofing distributions but does not publish them. Before any AHS metro reference is considered, it must pass professional-only, positive-cost distinct-housing-unit, metric-specific CV and nonsampling-risk gates, then a February-2013-CBSA city crosswalk. The five Next-10 area weighted response rates are 51.9%–62.9%; the separate survey-wide 59.2% unit nonresponse figure is not treated as a metro rate. LBNL's 2026 public file is being audited with a streaming Deflate64-capable extractor after its 252 MB ZIP exposed compression method 9; commercial reuse rights remain unconfirmed. The live roof calculator remains based on visitor-entered comparable prices/quotes and clearly labelled context references. No AHS or LBNL prices have been added to the public registry. Do not create city pages with invented multipliers or thin text.


## November 1 publication gate implementation

- Added a deliberately empty public registry at `data/price-benchmarks.json`, plus a client-side display module. It can render LBNL historical city/state installed-price percentiles or selected AHS metro whole-project cost percentiles only when each record passes explicit sample, source, unit, geography, period, scope and publication-approval checks. The AHS figure is never treated as price per roof square foot and does not feed the roof-cost calculator.
- Added `scripts/validate_price_benchmarks.py`, `scripts/test_price_benchmark_gates.py` and `scripts/test_price_benchmarks.py`. Synthetic data are used only inside tests to verify both positive and negative branches. No real benchmark values were computed or added to the public registry.
- Current statuses: LBNL = withheld pending a successful 2026 public CSV schema/cohort/coverage audit and written/current commercial-reuse clearance. AHS = withheld pending separate National Top-15 and Metropolitan five-area analysis review, professional-only positive-cost precision, CV <30% for mean/median/p25/p75, 2023 nonresponse-risk review and the city-to-2013-CBSA crosswalk. The public registry's records array is empty.
- A same-origin static JSON GET is used to load the registry. It sends no visitor-provided values and is not an API to a third party.
- Search-market review is summarised in `KEYWORD-DEMAND-VALIDATION.md`. It found established general-purpose roof and solar calculators and community demand for clear proposal-scope comparisons, but did not establish numeric search volume or ranking opportunity. The initial product thesis is now a quote-comparison and roof/solar sequencing workflow; no city-page expansion is approved.

## November 1, 2026 — current prefill and field-validation wiring

- The combined calculator, standalone roof replacement calculator and standalone solar savings calculator now use disclosed editable fallback references. The roof tool preloads Angi's broad national $4–$11/roof-sq-ft range; selecting Metal clears the generic reference and selecting an exact metal system loads its HomeGuide reference. The savings tool preloads the EnergySage H1 2026 national solar-only median of $2.62/W DC. These are context references, never represented as city prices or quotes.
- The standalone solar savings tool receives city/state with the PVWatts handoff and independently checks the static public price registry before replacing the national fallback with a matching approved LBNL row. It enforces source host, registry release state, metric, sample, 2024–2025 installation period, quantile ordering and approval flags. A visitor edit during the lookup is preserved.
- The source-gated price registry remains deliberately empty. Approved city/state solar installed-price rows: 0. Approved AHS metro whole-project roof spending rows: 0. No city roofing prices or synthetic benchmark rows are published.
- Field-level validation is shared across eight calculator/data-entry pages. It performs inline hard-error checks and non-blocking warnings, shows per-field ranges/units/precision, handles paired/conditional fields and repeats validation at calculation time.
- Full local QA passed after these changes. This remains deterministic code/DOM testing only; no live API, actual local pricing, browser/device, professional, legal or production validation is implied.
