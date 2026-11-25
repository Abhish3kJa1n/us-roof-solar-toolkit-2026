#!/usr/bin/env python3
"""Static privacy guardrails for this non-lead-generation site and its serverless APIs."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]

class Tags(HTMLParser):
    def __init__(self):
        super().__init__(); self.forms = 0; self.scripts = []; self.inputs = {}; self.select_options = {}; self.numeric_inputs = []
        self.current_select = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "form": self.forms += 1
        if tag == "script":
            # JSON-LD is a non-executable structured-data block; audit_site.py validates its JSON.
            if (a.get("type") or "").strip().lower() != "application/ld+json":
                self.scripts.append(a.get("src"))
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
    "who operates this website",
    "roof & solar toolkit",
    "information we collect",
    "calculator and home information",
    "location and place information",
    "automatically collected device and usage information",
    "information you send us",
    "how we use information",
    "third-party services and disclosures",
    "u.s. census bureau",
    "national laboratory of the rockies",
    "openei utility rate database",
    "cloudflare web analytics",
    "does not use cookies for analytics",
    "does not use localstorage or sessionstorage for analytics identifiers",
    "does not fingerprint individual visitors",
    "preceding six months of web analytics reports",
    "page url and query-string information",
    "cookies and similar technologies",
    "data retention",
    "data security",
    "international processing",
    "u.s. state privacy rights",
    "children's privacy",
    "advertising, sale and sharing",
    "not currently displaying advertising or loading an adsense ad-serving script",
    "we do not sell personal information for money",
    "we do not share personal information for cross-context behavioral advertising",
    "this site does not currently provide a first-party cookie preference center",
    "editor@getroofsolarcalculator.online",
):
    if required_disclosure not in privacy_notice:
        fail(f"Privacy Policy is missing a material generator-style section or disclosure: {required_disclosure}")

for table_heading in (
    "information category",
    "examples and source",
    "purpose and recipients",
    "retention or deletion",
):
    if table_heading not in privacy_notice:
        fail(f"Privacy Policy data-practices table is missing column: {table_heading}")

for internal_detail in (
    "gtm-5x5dfwmw",
    "server-side api credential",
    "x-location-proof",
    "request counters",
    "d1 quota",
    "authorization token",
):
    if internal_detail in privacy_notice:
        fail(f"Privacy Policy exposes an unnecessary implementation detail: {internal_detail}")



for contact_page in ("contact.html", "editorial-policy.html", "privacy.html", "terms.html"):
    contact_html = (ROOT / contact_page).read_text(encoding="utf-8")
    contact_punctuation_pattern = r"editor@getroofsolarcalculator\.online</a>\."
    if not re.search(contact_punctuation_pattern, "editor@getroofsolarcalculator.online</a>."):
        fail("contact punctuation regression pattern does not match its positive fixture")
    if re.search(contact_punctuation_pattern, contact_html, re.I):
        fail(f"contact email is followed by stray punctuation in {contact_page}")


middleware = (ROOT / "functions" / "_middleware.js").read_text(encoding="utf-8")
for active_tracker in ("googletagmanager.com", "GTM-5X5DFWMW", "gtag("):
    if active_tracker.lower() in middleware.lower():
        fail(f"production middleware still injects a Google tracking tag: {active_tracker}")
if (ROOT / "assets" / "js" / "google-tag-bootstrap-1.js").exists():
    fail("obsolete Google Tag Manager bootstrap asset still exists")
not_found = (ROOT / "404.html").read_text(encoding="utf-8")
if "google-tag-bootstrap" in not_found.lower() or "googletagmanager.com" in not_found.lower():
    fail("404 page still loads Google Tag Manager")

source_all = "\n".join(f.read_text(encoding="utf-8") for f in pages)
if "getroofsolarcalculator@gmail.com" in source_all.lower():
    fail("old Gmail address remains in a public HTML page")
if "editor@getroofsolarcalculator.online" not in source_all.lower():
    fail("replacement editorial email is missing from public HTML")
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

# Scan every tracked text file for the retired personal Gmail contact, not only public HTML.
tracked = subprocess.run(
    ["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True
).stdout.decode("utf-8").split("\0")
old_contact = "getroofsolarcalculator" + "@gmail.com"
text_suffixes = {".html", ".js", ".mjs", ".cjs", ".css", ".json", ".md", ".txt", ".xml", ".yml", ".yaml", ".toml", ".py", ".sh", ".sql"}
for relative in tracked:
    if not relative or relative == "scripts/test_privacy_guardrails.py":
        continue
    candidate = ROOT / relative
    if candidate.suffix.lower() not in text_suffixes or not candidate.is_file():
        continue
    try:
        tracked_text = candidate.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    if old_contact in tracked_text.lower():
        fail(f"old Gmail contact remains in tracked repository file: {relative}")

# Audit executable runtime payload separately. _headers is intentionally excluded:
# its legacy Google CSP origins are inert permissions and the owner forbade _headers edits.
runtime_files = list(pages)
for runtime_root in (ROOT / "assets", ROOT / "functions"):
    if runtime_root.exists():
        runtime_files.extend(
            p for p in runtime_root.rglob("*")
            if p.is_file() and p.suffix.lower() in {".js", ".mjs", ".cjs"}
        )
active_tracker_tokens = (
    "googletagmanager.com",
    "gtm-5x5dfwmw",
    "gtag(",
    "google-analytics.com",
    "google-tag-bootstrap",
)
for runtime_file in runtime_files:
    runtime_text = runtime_file.read_text(encoding="utf-8").lower()
    for token in active_tracker_tokens:
        if token in runtime_text:
            fail(f"active Google tracking reference {token!r} remains in runtime file: {runtime_file.relative_to(ROOT)}")
    if re.search(r"(?<![a-z0-9])_ga(?:_[a-z0-9]+)?(?![a-z0-9])", runtime_text):
        fail(f"Google Analytics _ga identifier remains in runtime file: {runtime_file.relative_to(ROOT)}")


print(f"PASS {len(pages)} HTML pages have no form submission endpoint, no inline JS, and only first-party scripts.")
print(f"PASS JS assets contain no localStorage, cookies or IndexedDB; only the combined estimator uses disclosed, tab-scoped sessionStorage for the city lookup handoff, with a one-hour restoration limit and no identifying fields. API requests do not send household calculator inputs.")
print("PASS literal defaults are limited to the four editable PVWatts reference-model assumptions and the source-labelled $2.62/W national solar price reference. The combined calculator may load disclosed, editable national roof/solar references at runtime; household consumption, actual bill usage, self-consumption and export credit remain visitor-specific and unprefilled.")
print("PASS README and methodology contain no obsolete 50% self-use or blank-export-as-zero claim.")
print("PASS no Google Tag Manager or Google Analytics executable is embedded in public HTML, the 404 page or production middleware; Cloudflare Web Analytics is the configured site analytics service.")
print("LIMIT: static source inspection does not detect host-level logs, server/CDN processing, browser extensions or third-party scripts added after deployment.")
