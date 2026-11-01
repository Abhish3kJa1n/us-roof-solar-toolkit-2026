# Roof & Solar Toolkit — rebuild acceptance and release audit

**Audit date:** November 1, 2026  
**Release status:** Updated source package; pre-launch only. Do not remove `noindex` or apply for advertising approval.

## What changed in this rebuild

### 1. City-based hybrid workflow

- The location workflow uses **city + state**, not ZIP code, and resolves Census incorporated-place / Census-designated-place representative coordinates.
- PVWatts production handoff now carries modeled yield and the selected city/state into the standalone savings calculator as well as the combined and panel-count tools.
- The standalone savings calculator starts with an editable EnergySage H1 2026 national solar-only marketplace reference of **$2.62/W DC**. It only replaces that reference when it independently verifies a matching city/state row in the public price registry, including publication status, source host, sample threshold, installation period and approval flags.
- A visitor edit made while the registry lookup is pending is not overwritten.
- The state EIA average may be prefilled only as an editable scenario reference. It is not presented as the customer's marginal tariff.
- The combined calculator keeps the national roof and solar references clearly labelled and editable. Personal annual electricity use, direct-use share, export credit, exact roof measurement and actual contractor quote are not inferred.

### 2. Roof-price prefill

- The standalone roof calculator preloads Angi's broad national **$4–$11 per roof-surface sq ft** range as an editable planning reference.
- Selecting Metal clears the generic reference. Selecting a specific metal system preloads the corresponding HomeGuide range; that value is also editable.
- Provenance changes to visitor-entered assumptions after the user edits a prefilled rate.
- These are publisher-level national references, not city-specific or property-specific pricing. No city roof rates or arbitrary city multipliers were added.

### 3. Field-level validation

- A shared validator is loaded by all eight calculator/data-entry pages.
- Numeric fields display allowed range, unit and precision; required/optional status is explicit.
- Text inputs with declared constraints enforce length and full-value pattern checks.
- Hard errors appear inline as the visitor types or leaves a field. Plausibility warnings do not block legitimate unusual values.
- Paired low/high values, exclusive calculation methods and conditional requirements are checked together.
- Final validation runs again before Calculate/Continue; the first invalid field receives focus. The system does not erase inputs or use modal popups.

## Automated verification performed

The full local suite `python scripts/run_all_checks.py` passed on the rebuilt source.

| Check | Result |
|---|---:|
| HTML documents | 26; all unique titles and descriptions |
| Labelled interactive controls | 59 |
| First-party JavaScript syntax | 11 assets checked |
| Local links/assets/fragments | 492 references resolved |
| Standalone roof/area/panel/quote/loan cases | 21/21 |
| Standalone solar calculation cases | 10/10 |
| Combined calculator cases | 9/9 |
| Field validation pure + simulated DOM tests | Pass |
| Hybrid prefill source/sample/license/race tests | Pass |
| City PVWatts UI/handoff tests | Pass |
| EIA internal consistency | 52 rows reconciled internally |
| Price-registry approval gates | Pass; current live registry contains 0 approved city/state solar rows and 0 approved AHS metro roofing rows |
| Clean deploy output | 26 HTML pages, 44 files; 492 local references; no internal QA/research files leaked |
| Indexing protections | `noindex,follow` and `X-Robots-Tag: noindex, follow` retained; no sitemap advertised |

## Important limitations — not passed / not performed

1. **No approved local price data is populated.** The public registry is intentionally empty. No Berkeley Lab 2026 source CSV has been processed for this release and current commercial reuse permission has not been confirmed. AHS roofing microdata have not been reconciled to the Census metro tables. The site therefore does not claim to know city-specific roof or solar prices.
2. **Live API services have not been exercised.** Census, PVWatts and OpenEI function tests use mocked/test inputs. The owner still needs Cloudflare Pages configuration, the D1 quota binding/schema and the PVWatts/OpenEI server-side keys. Until then, live model/tariff calls fail closed.
3. **No real browser/device inspection was completed.** The prior Chromium smoke-test environment blocked navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. Automated DOM tests are not a substitute for desktop/mobile visual review, keyboard-only review, screen-reader evaluation or WCAG certification.
4. **No external professional/legal review has been completed.** Roof and solar technical review, tax/legal review, privacy review and named editorial authors remain launch gates.
5. **No production setup has occurred.** DNS/HTTPS, Search Console, analytics, consent management, ad publisher account and ads are not configured. The site remains noindex and the ad placements are placeholders.
6. **No GitHub push is certified by this audit.** This report covers the local rebuilt source package and does not claim that the destination GitHub repository contains this release.

## Release decision

The source now implements the requested field-level validation and the available portion of the city-based hybrid prefill design. It is materially more complete than the earlier package, but it remains a **pre-launch prototype**, not a data-complete local pricing service or production-certified website.
