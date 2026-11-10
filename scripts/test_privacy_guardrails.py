#!/usr/bin/env python3
"""Static privacy guardrails for this non-lead-generation site and its serverless APIs."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

class Tags(HTMLParser):
    def __init__(self):
        super().__init__(); self.forms = 0; self.scripts = []; self.inputs = {}; self.select_options = {}; self.numeric_inputs = []
        self.current_select = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "form": self.forms += 1
        if tag == "script": self.scripts.append(a.get("src"))
        if tag == "input" and a.get("id"): self.inputs[a["id"]] = a
        if tag == "input" and a.get("type", "text").lower() == "number": self.numeric_inputs.append((a.get("id"), a))
        if tag == "select" and a.get("id"):
            self.current_select = a["id"]; self.select_options[self.current_select] = []
        if tag == "option" and self.current_select:
            self.select_options[self.current_select].append(a)
    def handle_endtag(self, tag):
        if tag == "select": self.current_select = None


def fail(message: str):
    raise SystemExit("FAIL: " + message)

pages = sorted(p for p in ROOT.rglob("*.html") if "dist" not in p.relative_to(ROOT).parts)
all_scripts = []
for page in pages:
    source = page.read_text(encoding="utf-8")
    parser = Tags(); parser.feed(source)
    if parser.forms:
        fail(f"{page.relative_to(ROOT)} contains an HTML form without a configured submission service")
    if any(src is None for src in parser.scripts):
        fail(f"{page.relative_to(ROOT)} contains inline JavaScript")
    for control_id, attrs in parser.numeric_inputs:
        if "value" in attrs:
            page_name = page.relative_to(ROOT).as_posix()
            allowed_defaults = {
                "calculators/location-solar.html": {"capacity": "1", "tilt": "20", "azimuth": "180", "losses": "14"},
                "calculators/solar-savings.html": {"price": "2.62"},
            }
            expected = allowed_defaults.get(page_name, {}).get(control_id)
            if expected != attrs.get("value"):
                fail(f"{page_name} numeric input #{control_id or '(no id)'} has an unapproved prefilled value")
            if page_name == "calculators/solar-savings.html" and control_id == "price":
                if "EnergySage H1 2026" not in source or "not your quote or a city price" not in source:
                    fail("solar savings national $2.62/W prefill lacks its visible source and nonlocal caveat")
    for src in parser.scripts:
        if not src.startswith("/") and not re.match(r"https?://", src):
            all_scripts.append((page, src))
        else:
            fail(f"{page.relative_to(ROOT)} references a non-local script: {src}")

for js in (ROOT / "assets" / "js").rglob("*.js"):
    source = js.read_text(encoding="utf-8")
    allowed_location_api = js.name == "location-solar-1.js"
    allowed_public_benchmark_feed = js.name == "price-benchmarks-1.js"
    allowed_solar_savings_registry = js.name == "solar-savings-1.js"
    allowed_combined_form_session = js.name == "homepage-1.js"
    for pattern, label in [
        (r"\bfetch\s*\(", "fetch"),
        (r"\bXMLHttpRequest\b", "XMLHttpRequest"),
        (r"\bnavigator\.sendBeacon\b", "sendBeacon"),
        (r"\blocalStorage\b", "localStorage"),
        (r"\bsessionStorage\b", "sessionStorage"),
        (r"\bdocument\.cookie\b", "document.cookie"),
        (r"\bindexedDB\b", "IndexedDB"),
    ]:
        allowed_fetch = (allowed_location_api or allowed_public_benchmark_feed or allowed_solar_savings_registry) and label == "fetch"
        allowed_tab_session = allowed_combined_form_session and label == "sessionStorage"
        if re.search(pattern, source) and not (allowed_fetch or allowed_tab_session):
            fail(f"{js.relative_to(ROOT)} uses {label}; review and disclose before launch")
    if allowed_combined_form_session:
        for marker in (
            "roof-solar-toolkit:combined-form:v1",
            "#calculatorForm input, #calculatorForm select, #calculatorForm textarea",
            "60 * 60 * 1000",
            "field.id !== 'productionPerKw'",
            "sessionStorage.removeItem(combinedFormStateKey)",
            "No address, name, contact detail or account data is stored.",
        ):
            if marker not in source:
                fail(f"combined-calculator tab storage is missing its guardrail: {marker}")
    if allowed_solar_savings_registry:
        if "../data/price-benchmarks.json" not in source or "credentials:'omit'" not in source:
            fail("solar savings may only verify approved city/state price references against the public same-origin registry without credentials")
        if re.search(r"fetch\s*\([^)]*https?://", source) or re.search(r"method:\s*['\"]POST", source, re.I):
            fail("solar savings registry verification must not send visitor data externally or use write requests")
        if re.search(r"fetch\s*\([^)]*(annualUse|annualKwh|roofArea|priceEl|importRate)", source, re.I):
            fail("solar savings household inputs appear to be sent in the public registry request")
    if allowed_public_benchmark_feed:
        if "../../data/price-benchmarks.json" not in source or "credentials: 'omit'" not in source:
            fail("price benchmark UI must request only its public same-origin JSON registry without credentials")
        if re.search(r"fetch\s*\([^)]*https?://", source) or re.search(r"method:\s*['\"]POST", source, re.I):
            fail("price benchmark UI must not send data to external services or use a write request")
        if re.search(r"fetch\s*\([^)]*(city|state|address|zip|roofArea|annualUse)", source, re.I):
            fail("visitor-entered location or household inputs must not be sent in benchmark requests")
    if allowed_location_api:
        for endpoint in ("../api/location?", "../api/pvwatts?", "../api/tariffs?"):
            if endpoint not in source: fail("location-aware JS is missing an expected first-party endpoint")
        if re.search(r"fetch\s*\([^`]*https?://", source):
            fail("location-aware JS must not call third-party APIs directly from the browser")
        if re.search(r"fetch\s*\([^`]*(annualUse|annualKwh|roofArea|priceEl|importRate)", source):
            fail("household calculator inputs appear to be sent over the network")

home = ROOT / "index.html"
p = Tags(); p.feed(home.read_text(encoding="utf-8"))
for field in ("selfUse", "exportRate"):
    attrs = p.inputs.get(field)
    if not attrs or "value" in attrs:
        fail(f"homepage {field} unexpectedly has a default numerical value")
story_options = p.select_options.get("stories", [])
if not story_options or story_options[0].get("value") != "" or "selected" not in story_options[0]:
    fail("homepage story-count select does not start with an explicit blank option")

privacy_notice = (ROOT / "privacy.html").read_text(encoding="utf-8").lower()
for required_disclosure in (
    "not currently displaying advertising or loading an adsense ad-serving script",
    "cloudflare web analytics",
    "browser performance timing metrics",
    "does not collect or use visitors' personal data",
    "or track individual end users across customers' internet properties",
    "calculator inputs are not sent to the site's calculation apis",
    "temporarily kept in this browser tab so they can be restored when you return",
    "cleared after restoration or when the tab is closed",
    "does not ask for your street address",
    "openei utility rate database",
    "if advertising is introduced, this notice will be updated to describe the relevant advertising technologies",
):
    if required_disclosure not in privacy_notice:
        fail(f"Privacy Notice is missing current visitor-facing disclosure: {required_disclosure}")

source_all = "\n".join(f.read_text(encoding="utf-8") for f in pages)
for stale_public_phrase in (
    "static demo",
    "location-aware solar model · preview",
    "site owner may not yet have configured",
    "site owner must add",
    "not yet independently reviewed and remains noindex before site launch",
    "independent technical validation: pending",
    "real chromium test of the deployed preview",
    "this code change",
):
    if stale_public_phrase in source_all.lower():
        fail(f"unfinished or internal operational wording remains in public HTML: {stale_public_phrase}")
if "Replace the bracketed items" in source_all:
    fail("privacy notice still contains an obsolete bracketed-placeholder instruction")
if re.search(r"\[(?:AUTHOR|REVIEWER|DATE|EMAIL|DOMAIN|PUBLISHER)[A-Z_ ]*\]", source_all, re.I):
    fail("unfilled editorial/publisher placeholder remains in public HTML")
methodology = (ROOT / "methodology.html").read_text(encoding="utf-8")
readme = (ROOT / "README.md").read_text(encoding="utf-8")
for stale in (
    "prefill the annual self-consumption share at 50%",
    "50% starting self-consumption value",
    "A blank export rate is treated as $0",
    "blank export credit is treated as $0",
):
    if stale.lower() in methodology.lower() or stale.lower() in readme.lower():
        fail(f"stale calculator methodology claim remains: {stale}")
if re.search(r"googletag|adsbygoogle|gtag\s*\(|google-analytics|facebook\.net|hotjar", source_all, re.I):
    fail("unexpected ad/analytics/third-party tracking code found in HTML")
if "Independent educational resource" in source_all:
    fail("premature publisher independence claim remains")

print(f"PASS {len(pages)} HTML pages have no form submission endpoint, no inline JS, and only first-party scripts.")
print(f"PASS JS assets contain no localStorage, cookies or IndexedDB; only the combined estimator uses disclosed, tab-scoped sessionStorage for the city lookup handoff, with a one-hour restoration limit and no identifying fields. API requests do not send household calculator inputs.")
print("PASS literal defaults are limited to the four editable PVWatts reference-model assumptions and the source-labelled $2.62/W national solar price reference. The combined calculator may load disclosed, editable national roof/solar references at runtime; household consumption, actual bill usage, self-consumption and export credit remain visitor-specific and unprefilled.")
print("PASS README and methodology contain no obsolete 50% self-use or blank-export-as-zero claim.")
print("PASS no ad-serving or analytics script is embedded in repository HTML source; Cloudflare project-level Web Analytics configuration is disclosed separately and live beacon execution remains unverified.")
print("LIMIT: static source inspection does not detect host-level logs, server/CDN processing, browser extensions or third-party scripts added after deployment.")
