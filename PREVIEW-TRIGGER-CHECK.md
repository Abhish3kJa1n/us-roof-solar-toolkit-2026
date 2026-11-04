# Preview and AHS source audit trigger

Updated November 4, 2026.

This documentation-only change requests:
- a fresh live Census ACS2026, NLR PVWatts V8 and OpenEI URDB Preview smoke test; and
- a research-only run of the official 2023 AHS National PUF roofing analysis against the source Value Labels and C-16 Table Specifications.

The AHS audit downloads official Census files to a temporary GitHub Actions runner, prints only schemas and aggregate statistics, and removes temporary files when the job exits. No raw records, ZIP archives or generated price registry rows are committed or uploaded as workflow artifacts.

It does not change runtime code, calculator behavior, provider secrets, Production settings, DNS or custom-domain routing.
