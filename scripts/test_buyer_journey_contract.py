#!/usr/bin/env python3
"""Guard buyer-journey links, conditional result guidance and the existing quote checker."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://getroofsolarcalculator.online"

class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.in_related = False
        self.related_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        classes = (attr.get("class") or "").split()
        if tag == "div" and "related" in classes:
            self.in_related = True
            self.related_depth = 1
            return
        if self.in_related:
            if tag == "div":
                self.related_depth += 1
            elif tag == "a" and attr.get("href"):
                self.links.append(attr["href"])

    def handle_endtag(self, tag: str) -> None:
        if self.in_related and tag == "div":
            self.related_depth -= 1
            if self.related_depth <= 0:
                self.in_related = False

def related_links(path: str) -> set[str]:
    parser = LinkParser()
    parser.feed((ROOT / path).read_text(encoding="utf-8"))
    if not parser.links:
        raise AssertionError(f"No related links found in {path}")
    return {urljoin(f"{SITE}/{path.removesuffix('.html')}", href) for href in parser.links}

def main() -> int:
    contracts = {
        "calculators/roof-area.html": [
            "/calculators/roof-replacement-cost", "/guides/roof-replacement-cost-factors", "/guides/roof-before-solar"],
        "calculators/roof-replacement-cost.html": [
            "/calculators/roof-area", "/guides/roof-replacement-cost-factors",
            "/guides/roof-repair-vs-replacement", "/guides/roof-before-solar"],
        "calculators/solar-panel-count.html": [
            "/calculators/location-solar", "/calculators/solar-savings",
            "/guides/solar-installation-cost#checker", "/guides/are-solar-panels-worth-it"],
        "calculators/solar-savings.html": [
            "/calculators/location-solar", "/guides/solar-installation-cost#checker",
            "/guides/solar-loan-vs-lease-vs-ppa", "/guides/roof-before-solar"],
    }
    for page, expected in contracts.items():
        links = related_links(page)
        own_path = "/" + page.removesuffix(".html")
        if any(urlparse(link).path == own_path for link in links):
            raise AssertionError(f"Related-content block links to itself: {page}")
        for path in expected:
            if SITE + path not in links:
                raise AssertionError(f"{page} is missing next-step destination {path}")
            target = path.split("#", 1)[0].lstrip("/")
            if not (ROOT / (target + ".html")).exists():
                raise AssertionError(f"Related destination does not exist: {target}.html")

    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    js = (ROOT / "assets/js/homepage-1.js").read_text(encoding="utf-8")
    quote = (ROOT / "guides/solar-installation-cost.html").read_text(encoding="utf-8")
    if len(re.findall(r'<article class="journey-card\b', homepage)) != 4:
        raise AssertionError("Homepage should expose four starting paths, including written-quote review")
    if 'href="guides/solar-installation-cost#checker"' not in homepage:
        raise AssertionError("Homepage quote path must use the existing quote checker")
    for token in ('class="next-steps"', 'id="nextStepTitle"', 'id="nextStepLinks"'):
        if token not in homepage:
            raise AssertionError(f"Homepage results are missing {token}")
    for token in ("function renderNextSteps(items)", "items.slice(0, 3)",
                  "if (condition === 'poor')", "else if (condition === 'fair')",
                  "if (!importedCityLabel)", "if (finance === 'loan')",
                  "else if (annualSavings === null)", "renderNextSteps(nextSteps)",
                  "guides/roof-before-solar", "calculators/location-solar",
                  "guides/understanding-solar-bill-savings", "guides/solar-loan-vs-lease-vs-ppa",
                  "guides/solar-installation-cost#checker"):
        if token not in js:
            raise AssertionError(f"Missing conditional next-step rule: {token}")
    for token in ('id="checker"', 'id="solarQuoteFields"'):
        if token not in quote:
            raise AssertionError(f"Existing quote checker element missing: {token}")
    if not re.search(r'id="(?:checkSolarQuote|calculateQuote|runQuoteCheck|quoteCheck)"', quote):
        if "pricePerWatt" not in quote and "price per watt" not in quote.lower():
            raise AssertionError("Existing quote-checker action/result no longer appears")
    location_js = (ROOT / "assets/js/location-solar-1.js").read_text(encoding="utf-8")
    for token in ("solar-savings.html", "solar-panel-count.html", "combinedLink.href"):
        if token not in location_js:
            raise AssertionError(f"Existing production handoff missing: {token}")

    print("PASS: four homepage routes, conditional result recommendations, page-specific calculator navigation,")
    print("      no related self-links, quote checker preserved and PV handoffs retained.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
