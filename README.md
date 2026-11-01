# Roof & Solar Toolkit — pre-launch website

**Review date:** November 1, 2026  
**Release status:** Pre-launch prototype. Do not index publicly or apply to an ad network yet.

## Purpose and business model

This project is intended to become a free, U.S.-focused informational website funded primarily through display advertising. It is **not** a roofing or solar contractor, installer marketplace, quote-lead funnel, contractor directory, lender, utility or government service.

The current build has:
- Roof area, roof replacement cost, solar panel count, solar savings, and location-solar calculators
- City/state hybrid price estimation method + EIA residential electricity data
- Guides on roof life, repair vs replacement, metal vs asphalt, solar loan/lease/PPA, etc.
- Cloudflare Pages + Functions ready structure (location, pvwatts, tariffs APIs with quota)
- Full test suite and research/audit docs from the 2026-11-01 city-hybrid rebuild

## Source package

The complete 92-file source from `roof_solar_toolkit_city_hybrid_rebuild_20261101.zip` is intended for this repository.

Because of practical payload limits when uploading large multi-file trees from this interface, the full tree is not yet materialized here.

**Fastest way for you (recommended):**
1. Download the original zip you uploaded in the chat
2. `git clone https://github.com/Abhish3kJa1n/us-roof-solar-toolkit-2026.git`
3. Unzip the contents into the repo root (overwrite README if needed)
4. `git add -A && git commit -m "Import full city-hybrid rebuild source" && git push`

Or reply and tell me to continue uploading file-by-file (I can do README + key calculators/JS first, then the rest across messages).

## Repo status

- Public
- Created 2026-11-01 specifically for this package
- Default branch: main

Once the full source is in, deploy to Cloudflare Pages following the included `CLOUDFLARE-DEPLOYMENT.md`.
