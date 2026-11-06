# City-level price estimation policy

**Version:** November 4, 2026  
**Product objective:** Give homeowners a useful *planning estimate* without presenting a weak proxy as an observed local market price.  
**Commercial model:** Free tools and independently useful content, primarily funded by display ads. No contractor leads or quote-selling.

## 1. Required result labels

Every displayed price must be labelled as one of:

1. **Observed local project-price distribution** — derived from a sufficiently large, documented sample of local projects with a defensible field definition and reuse rights.
2. **Local permit-declared value** — based on government permit applicant/declared valuation, not a verified final paid invoice.
3. **Modelled local planning estimate** — a national or metro benchmark adjusted using disclosed local factors. Must list the factors and uncertainty; never call it an observed local average.
4. **User-entered estimate** — calculated from the visitor's own measurements, assumptions or contractor quote.

Do not combine these categories or make them look equally reliable.

## 2. Solar installed-price method

### Best candidate source

Berkeley Lab's official August 2026 publication record states that the update contains roughly 5.3 million systems through year-end 2025 overall; that is not the row count of its non-confidential public CSV. The official 2026 user guide has now been downloaded and text-extracted on a temporary runner (926,394 bytes; SHA-256 `1a287692b6abe5532c53b6a8117d9be4dece4edf66978f88b1a2ea20c29da298`). It documents the cohort's core fields, including system size, installed price, customer segment, ground-mounted status, technology type and ownership/scope flags. The public CSV link redirects to a Google Drive file preview; the first attempt retrieved HTML rather than the CSV. A temporary-runner downloader now handles that redirect; actual row count, value codes and analyzer compatibility remain unverified. The dataset includes residential, roof-mounted non-residential and qualifying ground-mounted projects, not only residential rooftop PV.

### Current research cohort

`scripts/analyze_berkeley_solar.py` currently applies:

- Installation years 2024–2025; nominal pre-incentive dollars, not inflation-adjusted.
- Residential `RES` / `RES_SF` segments; excludes multi-family and non-residential.
- PV-only, not ground-mounted.
- DC size 1–25 kW.
- Both reported and inferred third-party-ownership flags must explicitly be false.
- Self-installed, expansion and multi-phase records must explicitly be false.
- Positive reported installed price and valid system size, city and state.
- City output is withheld below n=100; state output below n=500 by default.

These filters create a cleaner *host-owned residential rooftop* cohort, not a representative probability sample of every installation. Minimum n is a suppression gate, not a statistical confidence guarantee. City spellings are normalized only for case/Unicode/whitespace; real aliases are not merged.

### Proposed live-estimator use (not yet implemented or approved)

After LBNL confirms written commercial reuse rights, the current public CSV is successfully downloaded, and a reviewer validates every field/value against the 2026 guide and real rows (the cohort script has not yet been run against this release):

- City + state historical median and p25/p75 may be displayed as a historical local-price reference, with visible `n`, installation years, nominal-dollar basis, cohort filters and date.
- A DOE/NREL national residential system benchmark may be shown as a separate national planning anchor. Do not imply it is a city quote.
- Do not silently inflation-adjust 2024–2025 prices. Either show the original-dollar basis or apply a documented, relevant adjustment series with the original figure retained.
- If city data fail the minimum sample, fall back to a qualifying state cohort. If that fails, show a national benchmark or let the visitor enter a quote. Clearly state which geography supplied the number.
- Do not automatically include battery storage, financing, tax incentives, roof work, electrical upgrades or service-panel replacement in a PV-only benchmark.

**Licence gate:** The older Data.gov CC BY listing does not establish the licence of the August 2026 public CSV. Written confirmation from Berkeley Lab or an explicit current dataset licence is required before commercial reuse of the dataset or its derived commercial price table.

## 3. Roofing installed-price method

There is no complete national primary-source file of final residential roof replacement invoices by city. A stronger statistical fallback is the Census/HUD 2023 American Housing Survey (AHS), which publishes home-improvement job costs for selected metropolitan areas. The 2023 National PUF includes a 2013 OMB CBSA code for the Top 15 metros. This supports exploratory metro-level distributions, not individual-city prices. The AHS Top 15 metro definitions use the February 2013 OMB CBSA boundaries and were held constant through the 2023 survey. If the visitor selects a city, the site may show the matching metro benchmark only after a tested spatial crosswalk assigns that city to the matching 2013 CBSA. Do not match by metro name alone, use a current-vintage CBSA code, or label the result as a city price. Cities outside the 15 supported metros receive no metro-specific AHS estimate. Municipal permits can provide a separate declared-value signal for selected jurisdictions.

### What a city permit dataset must contain

Prefer completed/closed residential single-family reroof permits with:

- Application/issue/completion date;
- Reroof/replacement classification (not repair-only, new construction or general alteration);
- Declared job value;
- Roof area in square feet or roofing squares;
- Material/scope indicators where available;
- Residential/single-family classification;
- Stable permit identifier and status.

For a jurisdiction with a documented roof-area field and adequate sample, calculate declared value per roof square/area and show sample count, date window, scope, material mix, median and quartiles. The output must be labelled **permit-declared local value**, not paid invoice. If roof area is not explicitly defined and validated, do not calculate $/sq-ft; summarize only the declared permit values and counts, clearly separated from actual homeowner costs.

### Primary-source examples found

- **Miami-Dade County:** its official ArcGIS table schema includes `PermitIssuedDate`, `PermitType`, `ResidentialCommercial`, `EstimatedValue`, `ApplicationTypeDescription`, `DetailDescriptionComments`, `PropertyAddress`, `SquareFootage`, inspection dates and city/state. Crucially, both `EstimatedValue` and `SquareFootage` are typed as text. A secondary methodology audit reports filtering 5,305 single-family reroofs from October 2024–October 2026 with declared values per area; this number is **not independently reproduced**. Before any use, the actual query, exact permit/category filters, numeric parsing, address-to-municipality assignment, project/status semantics, duplicate/master permit handling, data-quality rates and current reuse terms must be audited. Schema presence is not enough.
- **Cape Coral, Florida:** the City ArcGIS building-permit layer has permit status, application/issue/final dates, `permitvalue`, description, occupancy and city fields. The schema does not expose the same explicit roof-area field in the metadata inspected, so it cannot be directly converted to price per roof square without additional records.
- **San Francisco:** the City/Data.gov catalog says PermitSF began rolling out in February 2026 and is refreshed four times daily. Its November 1, 2026 column metadata lists 11,581 total records, of which 1,725 have `recordtype = Reroofing permit`. The `valuation` field is text and is non-null for 10,946 records across all permit types—not specifically the reroof cohort. The inspected column schema did not expose a roof-area/square-footage field. The `status_detail` field description also conflicts with its cached values (which include `Complete`). It is potentially useful for a labelled permit-activity count or a future permit-declared-value study after status/valuation semantics are confirmed; it is **not** a credible $/sq-ft price source today. The Data.gov catalog lists PDDL 1.0; verify publisher terms before reuse.

### Fallback policy

- If a city has validated permit-level roof area + declared value and an adequate sample, show a separate local permit-declared reference.
- If it has permit records but no roof area, show only counts/trend or a labelled declared-value distribution; do not convert to $/sq ft.
- If city data are insufficient, use a nationally sourced AHS spending benchmark as context only, after real PUF outputs are reconciled to Census tables. Keep the live cost calculation user-entered by default.
- A separate modelled estimate may be developed later using national benchmark + regional BLS roofer wages + documented material-price series, but city factors and the labour share need validation against independent city permit/quote samples. Do not invent multipliers.

## 4. City location is not city pricing

The Census TIGERweb city/state resolver supplies a representative place coordinate for the PVWatts production model. It does not prove that the whole municipal boundary shares one solar resource, utility, tariff, permit authority or cost structure. The UI must not imply that location lookup itself supplies local project prices.

## 5. Current implementation status

| Component | Status |
|---|---|
| City/state Census lookup | Implemented; API tests mocked; live request not executed from this environment |
| PVWatts city-point production model | Implemented; Preview secret/D1 configured; live Austin smoke test passed (1,483 kWh/year for 1 kW DC); multi-region and station-distance validation remain pending |
| LBNL city/state solar-price aggregation script | Implemented and synthetic-test passed; 2026 guide retrieved and key fields confirmed; public CSV retrieval/row count and live cohort compatibility still pending; commercial reuse gate open |
| AHS 2023 National PUF | Real PUF processed; national C-16 point estimates reconcile; margin-of-error and metro/city crosswalk remain open; no site pricing rows approved |
| Roof local-permit research | San Francisco PermitSF metadata and Miami-Dade ArcGIS schema inspected; no row-level cohort, price distribution or commercial estimator validated |
| Live city installed-price estimates | Not enabled; solar data licence/real CSV review is outstanding; roofing has no city price dataset |
| City-to-AHS metro crosswalk | Not implemented; must use the AHS-matching February 2013 CBSA geography and disclose metro—not city—scope |

## 6. Commercial/SEO guardrail

A city page should exist only when it adds genuinely distinct local information: qualifying price data, utility/tariff facts, code/permitting information, incentives, climate hazards or original documented analysis. Do not generate hundreds of city pages by substituting a city name into the same template or multiplying a national cost by an undisclosed index. Search visibility and ad revenue remain unproven until a small batch is published, indexed after approval, and measured in Search Console/AdSense.

## Source links

- [LBNL Tracking the Sun](https://emp.lbl.gov/tracking-the-sun)
- [Official Berkeley Lab 2026 update record](https://emp.lbl.gov/publications/us-distributed-solar-and-storage-0)
- [2026 public-data user guide listed with the official 2026 record](https://eta-publications.lbl.gov/sites/default/files/2026-08/lbnl_publicdatafile_userguide_8.07.26.pdf)
- [2026 public CSV link listed in the guide](https://bit.ly/trackingthesun2026)
- [NLR PVWatts V8](https://developer.nlr.gov/docs/solar/pvwatts/v8/)
- [US Census TIGERweb](https://tigerweb.geo.census.gov/tigerweb/)
- [Miami-Dade County ArcGIS permit layer](https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/miamidade_permit_data/FeatureServer/0)
- [Cape Coral building-permit layer](https://capeims.capecoral.gov/arcgis/rest/services/OpenData/OpenData/MapServer/1)
- [San Francisco PermitSF dataset](https://data.sf.gov/d/tyz3-vt28)
- [Census/HUD 2023 AHS Home Improvements](https://www.census.gov/content/dam/Census/library/visualizations/2024/demo/2023%20Home%20Improvements%20Infographic.pdf)
- [Census AHS 2023 Top 15 metro Table C-16](https://www.census.gov/programs-surveys/ahs/data/interactive/ahstablecreator.html?areas=00100&bygroup1=COL_TOP_15&bygroup2=1&filtergroup1=01&tablename=TABLE16&year=2023)
- [Census AHS 2015–2023 PUF geography guide](https://www.census.gov/content/dam/Census/programs-surveys/ahs/tech-documentation/2015/Getting%20Started%20with%20the%20AHS%20PUF%202015%20and%20Beyond.pdf)
- [Census 2015–2023 metro oversample codes and definitions](https://www.census.gov/content/dam/Census/programs-surveys/ahs/tech-documentation/2015/Metro%20Area%20Histories%202015%20and%20Beyond.pdf)
- [BLS OEWS](https://www.bls.gov/oes/)
