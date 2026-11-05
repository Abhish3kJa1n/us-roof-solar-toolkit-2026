# Research audit rerun — 2026-11-05

This commit triggers the isolated AHS source audit, Berkeley Lab 2026 source-file audit, Playwright Preview QA and the live Census/PVWatts/OpenEI Preview smoke test. The audit code and tests have passed the full local project QA suite on the preceding branch revision.

## AHS source handling

- The National PUF is used for the integrated National/Top-15 sample.
- The separate Metropolitan PUF is used for the five Next-10 metro areas interviewed in 2023. It is analyzed using its own matched PROJECT/HOUSEHOLD files and household weights; neither PUF is pooled with the other.
- The five observed 2013 OMB CBSA geography codes and household counts must exactly match Census 2023 Independent Metropolitan Sample Design Table 2.2 before analysis proceeds.
- Output reports project records separately from housing units, plus positive-cost project and housing-unit counts.
- For contractor-oriented screening, only JOBDIY='2' positive-cost projects are relevant. DIY and all-project distributions remain separate.
- The analyzer calculates mean, median, p25 and p75 CV values from the 160 replicate weights using Census's Fay-BRR 4/160 variance formula. CV below 30% is only a screen, not independent approval.
- Census Table 2.2 reports the five Next-10 weighted response rates: Cincinnati 62.9%, Cleveland 51.9%, Denver 59.6%, Milwaukee 61.4% and New Orleans 61.0%. The overview's separate 59.2% unit nonresponse figure is survey-wide, not an area rate. Keep them distinct; do not assume nonresponse weighting removes bias.

## Berkeley Lab 2026 source handling

- The exact public ZIP member's compression method, compressed/uncompressed sizes and extraction size are logged.
- Python 3.12's unsupported Zstandard ZIP methods (20/93) use the installed zstandard decoder. No source file or calculated price distribution is committed or uploaded as an artifact.
- The actual CSV schema, row count, missing values, geography labels, installation-year coverage, filter-stage counts, and resulting city/state coverage must be inspected from the downloaded 2026 file.
- Commercial reuse permission remains unconfirmed. Even a successful extraction/cohort audit does not authorize publication or commercial reuse.

## Release guardrails

- The public price registry remains empty and all price-source statuses remain withheld.
- This is not approval to deploy production, merge the PR, change DNS, transfer custom domains, add paid services, or publish benchmark values.
- All source microdata and derived research aggregates remain in the ephemeral CI runner. Only code, tests and this written audit plan are in the repository.
