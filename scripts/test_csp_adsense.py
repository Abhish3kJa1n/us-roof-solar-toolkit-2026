#!/usr/bin/env python3
"""Static regression tests for the nonce CSP and gated AdSense bootstrap."""
from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise SystemExit("FAIL: " + message)


routes = json.loads((ROOT / "_routes.json").read_text(encoding="utf-8"))
includes = set(routes.get("include", []))
excludes = set(routes.get("exclude", []))
required_routes = {"/api/*", "/guides/*", "/electricity-prices-by-state", "/electricity-prices-by-state.html"}
if not required_routes.issubset(includes):
    fail(f"HTML middleware/API routes missing: {sorted(required_routes - includes)}")
if not {"/assets/*", "/data/*"}.issubset(excludes):
    fail("static assets and public data must bypass Pages middleware")
if {"/", "/*.html", "/calculators/*"}.intersection(includes):
    fail("homepage, calculators and general HTML must stay outside the added middleware route")


# Prove that merely merging the code cannot add document Function invocations
# to Production. Only an explicit build-time switch may add the nonce routes.
def staged_routes(branch_name: str, enable_middleware: bool = False) -> dict:
    env = os.environ.copy()
    env["CF_PAGES_BRANCH"] = branch_name
    if enable_middleware:
        env["ADSENSE_MIDDLEWARE_ENABLED"] = "true"
    else:
        env.pop("ADSENSE_MIDDLEWARE_ENABLED", None)
    result = subprocess.run(
        ["sh", str(ROOT / "scripts" / "prepare_deploy.sh")],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        fail("prepare_deploy.sh failed while checking Production/Preview route gates: " + result.stderr)
    return json.loads((ROOT / "dist" / "_routes.json").read_text(encoding="utf-8"))


production_default = staged_routes("main")
if production_default.get("include") != ["/api/*"] or production_default.get("exclude") != []:
    fail("Production build must remain API-only until ADSENSE_MIDDLEWARE_ENABLED=true")
production_enabled = staged_routes("main", enable_middleware=True)
if not required_routes.issubset(set(production_enabled.get("include", []))):
    fail("explicitly enabled Production build is missing the editorial nonce routes")
preview_routes = staged_routes("audit/adsense-nonce-csp-20261108")
if not required_routes.issubset(set(preview_routes.get("include", []))):
    fail("Preview build must include editorial nonce routes for browser testing")

middleware = (ROOT / "functions" / "_middleware.js").read_text(encoding="utf-8")
for token, label in [
    ("crypto.getRandomValues(bytes)", "cryptographically random nonce"),
    ("new Uint8Array(16)", "128-bit nonce entropy"),
    ("'strict-dynamic'", "strict-dynamic CSP"),
    ("'unsafe-eval'", "Google-documented AdSense CSP compatibility"),
    ("'unsafe-inline'", "Google-documented AdSense CSP compatibility"),
    ("'nonce-${nonce}'", "nonce-bound script-src directive"),
    ('element.setAttribute("nonce", nonce)', "nonce on existing script elements"),
    ("new HTMLRewriter()", "HTML response rewriting"),
    ('context.env?.ADSENSE_ENABLED', "explicit opt-in flag"),
    ('"getroofsolarcalculator.online"', "canonical host gate"),
    ('"www.getroofsolarcalculator.online"', "www host gate"),
    ('"/guides/"', "guide-only initial ad scope"),
    ('"/electricity-prices-by-state.html"', "state reference page ad scope"),
    ('"private, no-store, max-age=0"', "browser no-store cache protection"),
    ('"CDN-Cache-Control", "no-store"', "CDN no-store cache protection"),
    ('"X-Content-Type-Options", "nosniff"', "nosniff response header"),
    ('"Referrer-Policy", "strict-origin-when-cross-origin"', "referrer policy"),
    ('"X-Frame-Options", "DENY"', "frame denial"),
]:
    if token not in middleware:
        fail(f"middleware missing {label}: {token}")

if 'context.env?.ADSENSE_ENABLED || ""' not in middleware:
    fail("AdSense must default to disabled when the environment variable is absent")
if "function isGuideDocumentPath(pathname)" not in middleware:
    fail("middleware must normalize extensionless guide URLs as well as .html source paths")
if 'pathname === "/electricity-prices-by-state"' not in middleware:
    fail("middleware must match Cloudflare's extensionless EIA reference URL")
if 'pathname === "/electricity-prices-by-state.html"' not in middleware:
    fail("middleware must also cover the explicit .html EIA request")
if "PUBLISHER_ID = \"ca-pub-6193507831935325\"" not in middleware:
    fail("loader publisher ID does not match the verified publisher")
if "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" not in middleware:
    fail("AdSense loader URL is missing")
if "crossorigin=\"anonymous\"" not in middleware:
    fail("AdSense loader must use crossorigin=anonymous")

# Check that the publisher ID agrees across the ownership meta, ads.txt and loader.
home = (ROOT / "index.html").read_text(encoding="utf-8")
ads_txt = (ROOT / "ads.txt").read_text(encoding="utf-8").strip()
if 'name="google-adsense-account" content="ca-pub-6193507831935325"' not in home:
    fail("homepage AdSense verification meta tag is missing or mismatched")
if ads_txt != "google.com, pub-6193507831935325, DIRECT, f08c47fec0942fa0":
    fail("ads.txt record is missing or mismatched")

# Ad code must remain server-injected and inactive by default, not hard-coded in HTML.
pages = sorted(p for p in ROOT.rglob("*.html") if "dist" not in p.relative_to(ROOT).parts)
for page in pages:
    source = page.read_text(encoding="utf-8")
    if re.search(r"adsbygoogle\.js|<ins[^>]+adsbygoogle", source, re.I):
        fail(f"{page.relative_to(ROOT)} embeds an AdSense loader/ad unit outside the runtime gate")
    if re.search(r"\son[a-z]+\s*=", source, re.I):
        fail(f"{page.relative_to(ROOT)} contains an inline event handler that nonce CSP would block")

privacy = (ROOT / "privacy.html").read_text(encoding="utf-8")
for phrase in [
    "AdSense ad serving is disabled",
    "page URL and IP address",
    "cookies, web beacons, IP addresses and other identifiers",
    "Third parties may place and read cookies",
    "policies.google.com/technologies/partner-sites",
    "adssettings.google.com",
    "www.aboutads.info/choices",
]:
    if phrase.lower() not in privacy.lower():
        fail(f"Privacy Notice is missing the ad-tech disclosure: {phrase}")

print("PASS: nonce CSP middleware is scoped to guide/EIA HTML; homepage, calculators, assets and data bypass the added Function route.")
print("PASS: AdSense is default-off, custom-host-only, publisher-ID-matched and limited to editorial/reference pages.")
print("PASS: HTML cannot be served from a cache with a reused nonce; Privacy Notice describes Google's ad data flows.")
