#!/usr/bin/env python3
"""Guard shared navigation, breadcrumb layout/semantics, and stylesheet cache versioning."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


class HeaderLinks(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_header = False
        self.in_nav = False
        self.in_anchor = False
        self.href = ""
        self.text = ""
        self.anchor_class = ""
        self.links: list[tuple[str, str]] = []
        self.nav_links: list[tuple[str, str, str]] = []
        self.nav_labels: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "header":
            self.in_header = True
        elif self.in_header and tag == "nav":
            self.in_nav = True
            self.nav_labels.append(values.get("aria-label") or "")
        elif self.in_nav and tag == "a":
            self.in_anchor = True
            self.href = values.get("href") or ""
            self.anchor_class = values.get("class") or ""
            self.text = ""

    def handle_data(self, data: str) -> None:
        if self.in_anchor:
            self.text += data

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.in_anchor:
            label = self.text.strip()
            self.links.append((label, self.href))
            self.nav_links.append((label, self.href, self.anchor_class))
            self.in_anchor = False
        elif tag == "nav" and self.in_nav:
            self.in_nav = False
        elif tag == "header":
            self.in_header = False


def main() -> int:
    shared_css = (ROOT / "assets/site.css").read_text(encoding="utf-8")
    if ".links a:not(.btn):hover" not in shared_css:
        raise AssertionError("Shared nav hover must exclude CTA buttons")
    if ".links a.btn:hover{color:#172b40}" not in shared_css:
        raise AssertionError("Shared CTA hover must preserve readable navy text")
    if re.search(r"\.links a:hover\s*\{", shared_css):
        raise AssertionError("Generic shared nav hover still overrides CTA text")
    if not re.search(
        r"\.wrap\.crumbs\{width:min\(1120px,calc\(100% - 36px\)\);margin:20px auto\}",
        shared_css,
    ):
        raise AssertionError("Breadcrumbs must use the shared centered desktop content width")
    if not re.search(
        r"@media\(max-width:600px\)\{\.wrap\.crumbs\{width:calc\(100% - 28px\)\}\}",
        shared_css,
    ):
        raise AssertionError("Breadcrumb width must retain the mobile page gutter")

    if not re.search(r"@media\\s*\\(min-width:1440px\\)\\s*\\{\\s*\\.wrap\\s*\\{width:min\\(1320px,calc\\(100% - 48px\\)\\)\\}\\s*\\.wrap\\.crumbs\\s*\\{width:min\\(1320px,calc\\(100% - 48px\\)\\)\\}\\s*\\}", shared_css):
        raise AssertionError("Wide desktop containers and breadcrumbs must expand together to 1320px")
    if not re.search(r"\\.article>:where\\(p,ul,ol,h2,h3\\)\\{max-width:78ch\\}", shared_css):
        raise AssertionError("Article text measure must remain readable when the desktop container expands")

    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    for required in (
        ".nav-links a:not(.btn):hover",
        ".nav-links a.btn-primary:hover { color: #172b40; }",
        '<a href="/about">About</a>',
    ):
        if required not in homepage:
            raise AssertionError(f"Homepage UI contract missing: {required}")

    expected_primary = [
        ("Tools", "/#tools"),
        ("Guides", "/#guides"),
        ("How it works", "/#how"),
        ("About", "/about"),
    ]
    pages = sorted(page for page in ROOT.rglob("*.html") if "dist" not in page.relative_to(ROOT).parts)
    checked = 0
    breadcrumb_pages = 0
    for page in pages:
        if page.name == "404.html":
            continue
        source = page.read_text(encoding="utf-8")
        if page.name != "index.html" and "assets/site.css?v=20261120-1" not in source:
            raise AssertionError(
                f"Shared stylesheet must be cache-busted on every internal page: {page.relative_to(ROOT)}"
            )
        if re.search(r'class=["\'][^"\']*\bcrumbs\b[^"\']*["\']', source):
            breadcrumb_pages += 1
            if not re.search(
                r"<nav\b(?=[^>]*class=[\"'][^\"']*\bcrumbs\b[^\"']*[\"'])(?=[^>]*aria-label=[\"']Breadcrumb[\"'])",
                source,
                re.I,
            ):
                raise AssertionError(
                    f"Visible breadcrumbs must be a semantic nav landmark: {page.relative_to(ROOT)}"
                )
        parser = HeaderLinks()
        parser.feed(source)
        if parser.nav_labels != ["Main navigation"]:
            raise AssertionError(
                f"Header navigation must have exactly one aria-label='Main navigation': {page.relative_to(ROOT)}"
            )
        nav_pairs = [(label, href) for label, href, _ in parser.nav_links]
        if len(nav_pairs) != 5 or nav_pairs[:4] != expected_primary:
            raise AssertionError(
                f"Header navigation order/labels must be consistent: {page.relative_to(ROOT)}: {nav_pairs}"
            )
        cta_label, cta_href, cta_class = parser.nav_links[-1]
        if not cta_label or "btn" not in cta_class.split() or not cta_href.startswith("/"):
            raise AssertionError(
                f"Rightmost header item must be a styled, root-relative CTA: {page.relative_to(ROOT)}"
            )
        about_links = [(label, href) for label, href in parser.links if label.lower() == "about"]
        if not about_links or any(href != "/about" for _, href in about_links):
            raise AssertionError(f"About navigation must target /about: {page.relative_to(ROOT)}: {about_links}")
        checked += 1

    if breadcrumb_pages != 27:
        raise AssertionError(f"Expected breadcrumbs on all 27 content pages, found {breadcrumb_pages}")
    print(
        f"PASS: consistent labeled navigation and rightmost CTA on {checked} public pages; "
        f"semantic centered breadcrumbs on {breadcrumb_pages} pages; cache-busted stylesheet on all internal pages"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
