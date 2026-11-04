# Preview and AHS source audit trigger

Updated November 4, 2026 for national C-16 point-estimate reconciliation and Top 15 metro diagnostics.

This documentation-only change requests:
- a fresh live Census ACS2026, NLR PVWatts V8 and OpenEI URDB Preview smoke test; and
- a research-only run of the official 2023 AHS National PUF roofing analysis against the source Value Labels and C-16 Table Specifications.

The AHS audit downloads official Census files to a temporary GitHub Actions runner, prints only schemas and aggregate statistics, and removes temporary files when the job exits. No raw records, ZIP archives or generated price registry rows are committed or uploaded as workflow artifacts.

It does not change runtime code, calculator behavior, provider secrets, Production settings, DNS or custom-domain routing.


## Berkeley Lab source audit

A temporary-runner audit also downloads the official August 2026 Berkeley Lab user guide and the linked public CSV, checks the actual public-file row count and field schema, and runs the existing strict residential rooftop cohort only if the required fields match. It emits only aggregate diagnostics. Commercial reuse rights remain unverified; no derived price rows are published.


The LBNL 2026 source audit now follows the public Google Drive download redirect with a temporary-runner downloader and then validates the downloaded file signature before reading it.


The latest source audit uses gdown's ID-based public-file retrieval and PyMuPDF rendering of the first three official guide pages; only guide-page PNG previews are retained briefly as a workflow artifact.
