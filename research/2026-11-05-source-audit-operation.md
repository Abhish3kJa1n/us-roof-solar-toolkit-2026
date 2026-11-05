# Research-only source audit operation — 2026-11-05

## Scope

This operation is limited to the isolated `audit/stage1-20261103` branch and its Cloudflare Pages Preview.

It triggers existing research-only GitHub Actions checks for the official 2023 AHS source package and Berkeley Lab August 2026 source package, plus the existing local QA, real-browser Preview QA, and live Preview API smoke checks.

## AHS questions to resolve from primary source files

1. Inspect the 2023 National and Metropolitan PUF packages independently.
2. Identify the actual PROJECT and HOUSEHOLD relational files from their observed schemas; do not infer file names.
3. Record the Metropolitan PUF's observed household geography, final-weight and replicate-weight fields, and inspect the official value-label package.
4. Inspect the Table Specifications workbook for the relevant C-16 metro estimates, exact variables, universe, weight, and variance/precision metadata.
5. Do not run the National-PUF estimator against Metropolitan-PUF rows unless each input field and survey design assumption is independently validated.
6. Do not publish a metro estimate from a Top-15 subset of the National PUF as though it came from the independent Metropolitan sample.
7. Keep all computed summaries in the ephemeral CI runner. Do not commit, deploy, or publish source microdata or price aggregates.

## Berkeley Lab questions to resolve from primary source files

1. Retrieve the August 2026 guide and exact public CSV linked by Berkeley Lab.
2. Verify the actual file signature, schema, row count, missing-value codes, flag values, year coverage, and geographic label behavior.
3. Test the documented residential, PV-only, rooftop, host-owned, non-self-installed, non-expansion and single-phase cohort against actual rows.
4. Report city/state sample coverage after all filters, not just the overall 5.3-million-system announcement figure.
5. Treat the 2026 dataset's commercial reuse rights as unresolved unless an explicit applicable licence or written permission is established.

## Release guardrails

- The public benchmark registry remains empty and withheld.
- No fabricated or synthetic price rows may be added to the public registry.
- No change to calculator formulas, production configuration, DNS, custom domains, indexing, ad code or paid services is authorized by this research operation.
- A successful workflow means the audit script ran; it does not itself certify statistical validity, commercial reuse rights, local price accuracy, SEO demand or AdSense economics.

## Primary source references

- Census 2023 Metropolitan PUF: https://www.census.gov/programs-surveys/ahs/data/2023/ahs-2023-public-use-file--puf-/2023-ahs-metropolitan-puf-microdata.html
- Census 2023 Metropolitan Sample Design, Weighting and Error Estimation: https://www2.census.gov/programs-surveys/ahs/2023/2023%20AHS%20Metropolitan%20Sample%20Design%2C%20Weighting%2C%20and%20Error%20Estimation.pdf
- Census AHS PUF discrepancy FAQ: https://www.census.gov/help/topics/faq.why-dont-my-tabulations-using-the-ahs-puf-match-census-numbers.html
- Berkeley Lab 2026 data update: https://emp.lbl.gov/publications/us-distributed-solar-and-storage-0
- Berkeley Lab 2026 user guide: https://eta-publications.lbl.gov/sites/default/files/2026-08/lbnl_publicdatafile_userguide_8.07.26.pdf
