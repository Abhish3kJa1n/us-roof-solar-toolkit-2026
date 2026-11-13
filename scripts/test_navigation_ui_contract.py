#!/usr/bin/env python3
"""Guard shared navigation CTA contrast and canonical About destinations."""
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
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "header":
            self.in_header = True
        elif self.in_header and tag == "nav":
            self.in_nav = True
        elif self.in_nav and tag == "a":
            self.in_anchor = True
            self.href = values.get("href") or ""
            self.text = ""

    def handle_data(self, data: str) -> None:
        if self.in_anchor:
            self.text += data

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.in_anchor:
            self.links.append((self.text.strip(), self.href))
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

    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    for required in (
        ".nav-links a:not(.btn):hover",
        ".nav-links a.btn-dark:hover { color: #fff; background: #193b5c; }",
        '<a href="/about">About</a>',
    ):
        if required not in homepage:
            raise AssertionError(f"Homepage UI contract missing: {required}")

    pages = sorted(page for page in ROOT.rglob("*.html") if "dist" not in page.relative_to(ROOT).parts)
    checked = 0
    for page in pages:
        if page.name in {"404.html", "about.html"}:
            continue
        parser = HeaderLinks()
        parser.feed(page.read_text(encoding="utf-8"))
        about_links = [(label, href) for label, href in parser.links if label.lower() == "about"]
        if not about_links:
            raise AssertionError(f"Missing About link in main navigation: {page.relative_to(ROOT)}")
        if any(href != "/about" for _, href in about_links):
            raise AssertionError(f"About navigation must target /about: {page.relative_to(ROOT)}: {about_links}")
        checked += 1

    print(f"PASS: shared CTA hover contrast and About navigation on {checked} public pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
