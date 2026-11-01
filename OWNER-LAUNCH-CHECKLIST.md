# Owner-side launch gates

This checklist deliberately separates what can be built in code from facts that only the actual publisher can supply. Do not invent an identity, registered business, address, email, professional qualification, legal review or trademark clearance.

## A. Publisher identity and ownership — must be supplied by the owner

- [ ] Legal publisher name (individual or registered entity).
- [ ] Country of establishment and actual operating location.
- [ ] Monitored editorial/privacy contact email on a domain the publisher controls.
- [ ] Business mailing address or another legally adequate contact method, as applicable.
- [ ] Confirm the publisher owns or controls the domain and can edit the HTML source needed for AdSense verification.
- [ ] Document any commercial, contractor, installer, lender, affiliate or manufacturer relationships. Disclose them where required.

## B. Brand and domain clearance — cannot be certified by a quick web search

- [x] Working domain selected and registered: `getroofsolarcalculator.online` (Hostinger; not yet connected to hosting). Final brand/legal clearance remains open.
- [ ] Search the USPTO Trademark Search system for exact, phonetic and confusingly similar marks in relevant classes; inspect live applications and registrations in TSDR.
- [ ] Search common-law use, corporate names, state business registries, search engines, social accounts and relevant industry directories.
- [x] Domain purchased through Hostinger; verify exact expiry date and renewal terms in hPanel before the end of the current paid year.
- [ ] Have a trademark professional assess likely confusion and the actual goods/services. A domain being available does not mean the name is legally clear.
- [ ] Do not revive **Roofwise** as the brand without fresh clearance; an existing U.S. roofing business was found using that name during the previous audit. The current **Roof & Solar Toolkit** label remains a working title, not a cleared mark.

Official starting points: https://tmsearch.uspto.gov/ and https://tsdr.uspto.gov/ . A search result absence is not a legal clearance opinion.

## C. Editorial and technical accountability

- [ ] Put a genuine named author on each guide, with a factual biography and relevant experience.
- [ ] Obtain review of roofing statements by a qualified roofing professional where technical judgments are made.
- [ ] Obtain review of PV modeling and electrical statements by a qualified solar/PV professional.
- [ ] Record the reviewer's actual qualification, scope of review and review date. No review should be claimed until it occurred.
- [ ] Recheck every tax, incentive, code, tariff and price claim against an official source immediately before publication.
- [ ] Keep a source/change log. Use source-specific dates and identify preliminary data.
- [ ] Add original value before indexing: documented test cases, quote-scope normalization, original analysis or data derived transparently from official sources. Do not spin up thin city/state pages just to target keywords.
- [ ] Create an editorial correction process and monitor the contact channel.

## D. Current data and calculator boundaries

- [ ] Update the EIA state-average electricity price page from the next EIA release. The current dataset is January–August 2026 and is preliminary for 2026.
- [ ] Never use EIA statewide average prices as a homeowner's utility tariff or as the default solar savings import/export rate.
- [ ] Have the annual solar model independently checked against several real tariff structures and example bills, including TOU and different export rules. The current model is annual and does not reproduce hourly billing.
- [ ] Validate the roof pitch geometry and cost-input experience with measured examples. The site deliberately contains no generic national roof-price rate.
- [ ] Reconcile calculator results against independent tools or professional proposals and publish test methodology, not just screenshots.

## E. Privacy, advertising and consumer law

- [ ] Select the real host, ad network, analytics provider, consent-management platform and any embedded third parties before finalizing the Privacy Notice.
- [ ] Obtain qualified legal review of privacy, terms, advertising disclosures, IP/copyright, accessibility and applicable federal/state law.
- [ ] Assess privacy-law applicability by thresholds, processing activities, consumer location and business role. State privacy laws differ; do not assume that a small traffic volume automatically exempts every ad-tech activity.
- [ ] Determine whether targeted advertising, cookies, identifiers, IP handling, Global Privacy Control or other opt-out signals require controls for the audience served.
- [ ] If Google personalized ads are served to EEA, UK or Switzerland visitors, confirm Google's then-current certified CMP and IAB TCF requirements are implemented.
- [ ] If affiliate links, sponsorships or paid reviews are introduced, disclose material relationships clearly and near the recommendation.
- [ ] Review native-advertising formats against the FTC requirement that commercial content not mislead readers about its nature; keep disclosures clear, prominent and close to the ad content. Official starting point: https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses .
- [ ] Set a children/audience policy. Do not knowingly collect children's personal information without the required assessment and controls.
- [ ] Make the Privacy Notice accurately describe hosting logs, ad tags, cookies, identifiers, recipients, retention and rights after each technology change.
- [ ] Test all privacy links, opt-outs and consent choices from a visitor's browser.

## F. Production engineering and accessibility

- [ ] Deploy through the runbook in `CLOUDFLARE-DEPLOYMENT.md` or a deliberately selected equivalent.
- [ ] Confirm HTTPS, HTTP-to-HTTPS redirect, canonical host and security headers.
- [ ] Test desktop, tablet and mobile browsers with real rendering. Check no horizontal overflow or clipped calculator results.
- [ ] Test keyboard-only operation, focus visibility, zoom at 200%/400%, screen reader form labels, result announcements and table navigation.
- [ ] Check WCAG 2.2 AA criteria with automated and manual testing; a passing automated scan alone is not conformance.
- [ ] Measure Core Web Vitals with field data after traffic exists; lab Lighthouse runs are useful but are not CrUX field data.
- [ ] Scan production network requests, cookies, storage, scripts and security headers after ad/analytics/CMP changes.
- [ ] Add error monitoring only after it is selected and disclosed in the Privacy Notice.

## G. Search and advertising launch

- [ ] Use `scripts/audit_site.py` and fix every error.
- [ ] Run the EIA and calculator scenario tests, plus `scripts/test_configure_site.py`, from the project root; keep the safe noindex mode until every release gate is closed.
- [ ] Use `scripts/configure_site.py --domain https://YOUR-DOMAIN` while retaining noindex.
- [ ] Ensure every indexed page provides original, useful, complete content—not just an ad slot or a template.
- [ ] Publish completed About, Contact, Editorial Policy, Privacy and Terms pages.
- [ ] Only then remove noindex with `--enable-indexing`, submit the generated sitemap in Search Console and monitor coverage/manual actions.
- [ ] Add ad code only when the ad network approves the domain and the site meets its current policies.
- [ ] Never buy traffic, incentivize clicks or place ads where they can be mistaken for calculator buttons or navigation.

## Release decision

**Current state: NOT READY for public indexing or ad-network application.** The static website, data reference page, deployment configuration and repeatable QA scripts are ready for owner review. The unresolved boxes above are real dependencies, not cosmetic checklist items. Do not remove noindex until every applicable gate is closed.


## Location API release gate

- [ ] Obtain free NLR PVWatts and (only if useful) OpenEI API keys; do not buy API access.
- [ ] Before adding either provider API key, create the `roof-solar-quota` D1 database with a U.S. primary-location hint (initially `ENAM`), apply `migrations/0001_create_api_quota.sql`, bind it to the Pages project as `API_QUOTA_DB` in Preview and Production, and redeploy. All three API endpoints fail closed without this shared global quota guard; PVWatts and OpenEI additionally require provider keys.
- [ ] Optionally add tested per-IP WAF rate limiting for `/api/*` as a secondary defense only; Free-plan counters are not global and do not replace D1.
- [ ] Set Pages **Settings → Runtime → Fail open / closed** to Fail open so static pages remain served if the Free Functions quota is exhausted.
- [ ] Confirm Pages Functions usage remains within the current Workers Free daily request allowance (currently 100,000/day) and D1 stays below 100,000 rows written/day / 5 million rows read/day; recheck live Cloudflare limits. The site-side guards cap Census at 10,000 lookups/day and 300/hour, PVWatts at 15,000/day and 900/hour, and OpenEI at 5,000/day and 300/hour.
- [ ] Run a real PVWatts API test using the owner's key, verify the selected station distance is within 100 miles, verify annual and monthly output, then remove test logs containing sensitive operational data.
- [ ] If no climate station is available within 100 miles, keep the calculation unavailable for that location rather than expanding to an unrestricted distant station.
- [ ] Verify current OpenEI candidate records against actual utility tariff documents and a sample customer bill; do not auto-apply a candidate rate to dollar savings.

## H. Public build packaging and deployment method

- [x] Production canonical/OG URLs configured for `https://getroofsolarcalculator.online` while retaining page-level noindex and the global noindex response header. This is not a live DNS/HTTPS check.
- [x] Clean public staging script added: `sh scripts/prepare_deploy.sh`; generates `dist/` with 26 visitor-facing HTML documents and only their public static dependencies. Internal Markdown research, QA scripts, migrations and owner notes are excluded.
- [x] Deployment-stage regression test added: verifies 482 local references, no internal-file leakage and retained noindex.
- [ ] For Cloudflare Pages Git integration, set root directory `/`, build command `sh scripts/prepare_deploy.sh`, build output directory `dist`, framework preset `None`. Keep `/functions` in the repository root. No `package.json` or `package-lock.json` is required.
- [ ] If selecting Direct Upload instead, run `sh scripts/prepare_deploy.sh` and deploy with Wrangler CLI from the repository root so `/functions` is compiled. Do not use dashboard drag-and-drop for this project because it does not compile Pages Functions. Direct Upload cannot later be converted to Git integration for the same Pages project.
- [ ] Create/configure the Cloudflare account and Pages project, D1 database and binding; only then add any provider secrets. No Cloudflare account or project is currently connected.
- [ ] After deployment, verify Pages Functions compile, public static URLs work, `_headers` are live, 404 responses are correct, HTTPS and canonical-host redirects work, and no `scripts/`, Markdown research files, migrations or owner records are exposed.
