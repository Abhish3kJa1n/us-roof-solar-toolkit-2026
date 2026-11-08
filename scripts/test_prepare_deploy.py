#!/usr/bin/env python3
"""Verify the deployment staging directory contains only public, linked assets."""
from __future__ import annotations

from html.parser import HTMLParser
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


class PublicPageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.refs: list[str] = []
        self.robots: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.add(str(values["id"]))
        if tag == "meta" and (values.get("name") or "").lower() == "robots":
            self.robots.append(values.get("content") or "")
        for key in ("href", "src"):
            value = values.get(key)
            if value:
                self.refs.append(str(value))


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def parse_page(path: Path) -> PublicPageParser:
    parser = PublicPageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def main() -> int:
    env = os.environ.copy()
    env["CF_PAGES_BRANCH"] = "preview"
    result = subprocess.run(
        ["sh", str(ROOT / "scripts" / "prepare_deploy.sh")], cwd=ROOT, env=env
    )
    if result.returncode:
        fail("prepare_deploy.sh failed for Preview")

    preview_routes = json.loads((DIST / "_routes.json").read_text(encoding="utf-8"))
    expected_preview_routes = {"/api/*", "/"}
    expected_preview_routes.update(
        "/" + page.relative_to(DIST).as_posix() for page in DIST.rglob("*.html")
    )
    if set(preview_routes.get("include", [])) != expected_preview_routes:
        fail("Preview must route every HTML document through the nonce CSP middleware and retain /api/*")
    if len(preview_routes.get("include", [])) > 100:
        fail("Preview route list exceeds Cloudflare Pages' 100-rule limit")

    # Production must retain the original static HTML path: only /api/* invokes Functions.
    env["CF_PAGES_BRANCH"] = "main"
    result = subprocess.run(
        ["sh", str(ROOT / "scripts" / "prepare_deploy.sh")], cwd=ROOT, env=env
    )
    if result.returncode:
        fail("prepare_deploy.sh failed for Production")
    production_routes = json.loads((DIST / "_routes.json").read_text(encoding="utf-8"))
    if production_routes.get("include") != ["/api/*"]:
        fail("Production must continue routing only /api/* through Pages Functions")
    production_home = (DIST / "index.html").read_text(encoding="utf-8")
    if '<meta name="robots" content="index,follow" />' not in production_home:
        fail("Production homepage must retain the main-branch indexing transformation")
    if "X-Robots-Tag:" in (DIST / "_headers").read_text(encoding="utf-8"):
        fail("Production must not retain the Preview X-Robots-Tag")

    # Restore the Preview fixture for the existing noindex and clean-public-root checks.
    env["CF_PAGES_BRANCH"] = "preview"
    result = subprocess.run(
        ["sh", str(ROOT / "scripts" / "prepare_deploy.sh")], cwd=ROOT, env=env
    )
    if result.returncode:
        fail("prepare_deploy.sh failed while restoring Preview test fixture")

    html_pages = sorted(DIST.rglob("*.html"))
    if len(html_pages) != 25:
        fail(f"expected 25 public HTML pages, found {len(html_pages)}")

    allowed_root_files = {"_headers", "_routes.json", "robots.txt", "ads.txt"}
    root_files = {p.name for p in DIST.iterdir() if p.is_file()}
    root_html = {p.name for p in html_pages if p.parent == DIST}
    if (DIST / "ads.txt").read_text(encoding="utf-8").strip() != "google.com, pub-6193507831935325, DIRECT, f08c47fec0942fa0":
        fail("AdSense seller authorization record is missing or incorrect")

    if root_files != allowed_root_files | root_html:
        fail(f"unexpected or missing root files: {sorted(root_files)}")

    all_files = {p.relative_to(DIST).as_posix() for p in DIST.rglob("*") if p.is_file()}
    forbidden = [name for name in all_files if name.endswith((".md", ".py", ".toml", ".pem", ".key")) or ".dev.vars" in name]
    if forbidden:
        fail(f"internal/source files leaked into public dist: {forbidden}")
    if any(name.startswith(("scripts/", "migrations/", "functions/")) for name in all_files):
        fail("source scripts, migrations or Functions were copied into public asset root")

    page_data: dict[str, PublicPageParser] = {}
    for page in html_pages:
        rel = page.relative_to(DIST).as_posix()
        parser = parse_page(page)
        page_data[rel] = parser
        if not any("noindex" in value.lower() for value in parser.robots):
            fail(f"prelaunch noindex missing from {rel}")

    checked_links = 0
    for page in html_pages:
        rel_page = page.relative_to(DIST).as_posix()
        for value in page_data[rel_page].refs:
            value = value.strip()
            if not value or value.startswith(("#", "//", "http://", "https://", "mailto:", "tel:", "javascript:", "data:")):
                continue
            parts = urlsplit(value)
            if parts.scheme or parts.netloc:
                continue
            path_part = unquote(parts.path)
            target_path = (page.parent / path_part).resolve() if path_part and not path_part.startswith("/") else (DIST / path_part.lstrip("/")).resolve() if path_part else page.resolve()
            try:
                target_rel = target_path.relative_to(DIST.resolve()).as_posix()
            except ValueError:
                fail(f"link escapes dist: {rel_page} -> {value}")
            if path_part and not target_path.is_file():
                fail(f"broken public path: {rel_page} -> {value}")
            if parts.fragment and target_path.suffix.lower() == ".html":
                if target_rel not in page_data:
                    target_page = parse_page(target_path)
                    page_data[target_rel] = target_page
                if unquote(parts.fragment) not in page_data[target_rel].ids:
                    fail(f"broken public fragment: {rel_page} -> {value}")
            checked_links += 1

    if "X-Robots-Tag: noindex, follow" not in (DIST / "_headers").read_text(encoding="utf-8"):
        fail("_headers lost the prelaunch noindex response header")
    if "Sitemap:" in (DIST / "robots.txt").read_text(encoding="utf-8"):
        fail("prelaunch robots.txt unexpectedly advertises an indexing sitemap")

    print(f"PASS: clean public dist contains {len(html_pages)} HTML pages and {len(all_files)} files.")
    print(f"PASS: {checked_links} local references resolve; no internal Markdown, QA scripts, migrations or Functions leaked.")
    print("PASS: noindex meta and X-Robots-Tag remain enabled; no sitemap advertised.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())



