#!/usr/bin/env python3
"""Repeatable static QA for the Roof & Solar Toolkit project (no network required)."""
from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.titles = 0
        self.descriptions = 0
        self.h1 = 0
        self.ids = []
        self.refs = []
        self.skip_links = 0
        self.main_ids = []
        self.scripts = []
        self.current_script = False
        self.script_buffer = []
        self.scripts_completed = []
        self.images_missing_alt = 0
        self.form_controls = []
        self.labels_for = set()
        self.label_open = 0
        self.label_text = []
        self.current_label_for = None
        self.title_depth = False
        self.meta_robots = []
        self.meta_description = []
        self.canonicals = []
        self.html_lang = None
        self.viewport_count = 0
        self.table_accessibility = []
        self.current_table = None
        self.numeric_controls = []
        self.unsafe_blank_links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html": self.html_lang = attrs.get("lang")
        if tag == "title": self.title_depth = True
        if tag == "h1": self.h1 += 1
        if "id" in attrs: self.ids.append(attrs["id"])
        if tag == "a":
            href = attrs.get("href", "")
            if href.startswith("#main-content"): self.skip_links += 1
            if href: self.refs.append(("href", href))
            if attrs.get("target", "").lower() == "_blank":
                rel_tokens = set((attrs.get("rel") or "").lower().split())
                if "noopener" not in rel_tokens:
                    self.unsafe_blank_links.append(href)
        if tag in ("img",):
            if "alt" not in attrs: self.images_missing_alt += 1
            src = attrs.get("src", "")
            if src: self.refs.append(("src", src))
        if tag in ("script",):
            src = attrs.get("src")
            if src: self.refs.append(("src", src))
            else:
                self.current_script = True
                self.script_buffer = []
        if tag == "main" and attrs.get("id"): self.main_ids.append(attrs["id"])
        if tag == "meta":
            if attrs.get("name", "").lower() == "description": self.descriptions += 1
            if attrs.get("name", "").lower() == "viewport": self.viewport_count += 1
            if attrs.get("name", "").lower() == "robots": self.meta_robots.append(attrs.get("content", ""))
            if attrs.get("name", "").lower() == "description": self.meta_description.append(attrs.get("content", ""))
        if tag == "link":
            rel = attrs.get("rel", "").lower().split()
            href = attrs.get("href", "")
            if "canonical" in rel: self.canonicals.append(href)
            if href and any(token in rel for token in ("stylesheet", "icon", "manifest", "preload")):
                self.refs.append(("href", href))
        if tag == "table":
            self.current_table = {
                "aria_label": attrs.get("aria-label"),
                "aria_labelledby": attrs.get("aria-labelledby"),
                "caption": False,
            }
        if tag == "caption" and self.current_table is not None:
            self.current_table["caption"] = True
        if tag == "label":
            self.label_open += 1
            self.current_label_for = attrs.get("for")
        if tag in ("input", "select", "textarea", "button"):
            if tag != "button" or attrs.get("type", "submit") != "button":
                self.form_controls.append((tag, attrs.get("id"), attrs.get("aria-label"), attrs.get("aria-labelledby")))
            if tag == "input" and attrs.get("type", "text").lower() == "number":
                self.numeric_controls.append((attrs.get("id"), attrs.get("min"), attrs.get("max"), attrs.get("step")))

    def handle_endtag(self, tag):
        if tag == "title": self.title_depth = False
        if tag == "script" and self.current_script:
            self.scripts_completed.append("".join(self.script_buffer))
            self.current_script = False
        if tag == "label":
            if self.current_label_for: self.labels_for.add(self.current_label_for)
            self.current_label_for = None
        if tag == "table" and self.current_table is not None:
            self.table_accessibility.append(self.current_table)
            self.current_table = None

    def handle_data(self, data):
        if self.current_script: self.script_buffer.append(data)


def is_external(url: str) -> bool:
    return bool(urlsplit(url).scheme or url.startswith("//") or url.startswith("mailto:") or url.startswith("tel:"))


def main() -> int:
    # dist/ is generated public output and intentionally mirrors source HTML; audit source pages once.
    pages = sorted(p for p in ROOT.rglob("*.html") if "dist" not in p.relative_to(ROOT).parts)
    issues = []
    titles = []
    descriptions = []
    controls = 0
    inline_scripts = 0
    external_script_refs = set()
    for page in pages:
        rel = page.relative_to(ROOT)
        parser = PageParser()
        source = page.read_text(encoding="utf-8")
        # Catch a common malformed table opening that HTMLParser otherwise tolerates.
        if re.search(r"<table\b[^>]*<thead\b", source, re.I | re.S):
            issues.append(f"{rel}: malformed <table> opening; missing > before <thead>")
        parser.feed(source)
        title_match = re.search(r"<title[^>]*>(.*?)</title>", source, re.I | re.S)
        title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else ""
        titles.append(title)
        descriptions.extend(parser.meta_description)
        if not title: issues.append(f"{rel}: missing title")
        if parser.descriptions != 1 or not parser.meta_description[0].strip(): issues.append(f"{rel}: missing/duplicate description")
        if parser.html_lang != "en": issues.append(f"{rel}: root html lang must be en")
        if parser.viewport_count != 1: issues.append(f"{rel}: expected exactly one viewport meta tag")
        if parser.h1 != 1: issues.append(f"{rel}: expected 1 H1, found {parser.h1}")
        if "noindex" not in " ".join(parser.meta_robots).lower(): issues.append(f"{rel}: noindex missing (prelaunch mode expected)")
        if rel.as_posix() == "404.html" and parser.canonicals:
            issues.append("404.html: error page must not declare a canonical URL")
        if parser.skip_links != 1 or parser.main_ids.count("main-content") != 1: issues.append(f"{rel}: skip link/main landmark mismatch")
        duplicate_ids = [k for k,v in Counter(parser.ids).items() if v > 1]
        if duplicate_ids: issues.append(f"{rel}: duplicate IDs {duplicate_ids}")
        if parser.images_missing_alt: issues.append(f"{rel}: {parser.images_missing_alt} images missing alt")
        if parser.unsafe_blank_links: issues.append(f"{rel}: target=_blank links missing rel=noopener: {parser.unsafe_blank_links}")
        for control_id, minimum, maximum, step in parser.numeric_controls:
            if minimum is None or maximum is None or step is None:
                issues.append(f"{rel}: numeric input #{control_id or '(no id)'} must declare min, max and step explicitly")
                continue
            try:
                if float(minimum) < 0 or float(maximum) <= float(minimum) or (step != "any" and float(step) <= 0):
                    issues.append(f"{rel}: numeric input #{control_id or '(no id)'} has invalid min/max/step")
            except ValueError:
                issues.append(f"{rel}: numeric input #{control_id or '(no id)'} has non-numeric min/max/step")
        for table_index, table in enumerate(parser.table_accessibility, start=1):
            if not (table["caption"] or table["aria_label"] or table["aria_labelledby"]):
                issues.append(f"{rel}: table {table_index} has no accessible name (caption, aria-label or aria-labelledby required)")
        controls += len(parser.form_controls)
        for tag, cid, aria, labelledby in parser.form_controls:
            if not cid and not aria and not labelledby:
                # Buttons are excluded for type=button, but input/select/textarea should be named.
                issues.append(f"{rel}: unnamed {tag} control")
            elif cid and cid not in parser.labels_for and not aria and not labelledby:
                issues.append(f"{rel}: control #{cid} has no matching label")
        for kind, ref in parser.refs:
            if kind == "src" and ref.lower().endswith(".js"):
                if is_external(ref):
                    issues.append(f"{rel}: third-party JavaScript is not permitted by the current CSP: {ref}")
                else:
                    external_script_refs.add((page.parent / ref).resolve())
            if is_external(ref) or ref.startswith("#") or ref.startswith("data:"):
                if ref.startswith("#") and ref[1:] and ref[1:] not in parser.ids:
                    issues.append(f"{rel}: broken fragment {ref}")
                continue
            parsed_ref = urlsplit(ref)
            path_part = parsed_ref.path
            frag = parsed_ref.fragment
            if not path_part:
                target = page.resolve()
            elif path_part.startswith("/"):
                target = (ROOT / path_part.lstrip("/")).resolve()
            else:
                target = (page.parent / path_part).resolve()
            if target.is_dir():
                target = target / "index.html"
            if not target.exists() and not target.suffix:
                extensionless_target = target.with_suffix(".html")
                if extensionless_target.exists():
                    target = extensionless_target
            try: target.relative_to(ROOT.resolve())
            except ValueError:
                issues.append(f"{rel}: reference escapes project: {ref}")
                continue
            if not target.exists():
                issues.append(f"{rel}: missing local target {ref}")
            elif frag and target.suffix.lower() == ".html":
                target_parser = PageParser()
                target_parser.feed(target.read_text(encoding="utf-8"))
                if frag not in target_parser.ids: issues.append(f"{rel}: broken cross-page fragment {ref}")
        for idx, script in enumerate(parser.scripts_completed):
            inline_scripts += 1
            tmp = ROOT / f".audit-inline-{page.stem}-{idx}.js"
            tmp.write_text(script, encoding="utf-8")
            try:
                check = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
                if check.returncode: issues.append(f"{rel}: inline JS syntax error: {check.stderr.strip()}")
            finally:
                tmp.unlink(missing_ok=True)
    js_files = sorted(p for p in (ROOT / "assets" / "js").rglob("*.js") if p.is_file()) if (ROOT / "assets" / "js").exists() else []
    for js_file in js_files:
        check = subprocess.run(["node", "--check", str(js_file)], capture_output=True, text=True)
        if check.returncode:
            issues.append(f"JavaScript syntax error in {js_file.relative_to(ROOT)}: {check.stderr.strip()}")
    for script_ref in external_script_refs:
        if script_ref.suffix.lower() == ".js" and script_ref not in js_files:
            try:
                label = str(script_ref.relative_to(ROOT))
            except ValueError:
                label = str(script_ref)
            issues.append(f"script source is not under assets/js or missing from syntax audit: {label}")
    for js_file in js_files:
        if js_file.resolve() not in external_script_refs:
            issues.append(f"unreferenced JavaScript file: {js_file.relative_to(ROOT)}")
    for page in pages:
        source = page.read_text(encoding="utf-8")
        if re.search(r"<form\b", source, re.I):
            issues.append(f"{page.relative_to(ROOT)}: HTML form present; verify a genuine endpoint and privacy disclosure before allowing submission")
        if re.search(r"<script\b(?![^>]*\bsrc\s*=)[^>]*>\s*[^<]", source, re.I):
            issues.append(f"{page.relative_to(ROOT)}: inline script found; deployment CSP requires external first-party JS")
    duplicate_titles = [k for k,v in Counter(titles).items() if k and v > 1]
    if duplicate_titles: issues.append(f"duplicate page titles: {duplicate_titles}")
    duplicate_descriptions = [k for k,v in Counter(descriptions).items() if k and v > 1]
    if duplicate_descriptions: issues.append(f"duplicate page descriptions: {duplicate_descriptions}")

    headers_path = ROOT / "_headers"
    if not headers_path.exists():
        issues.append("missing Cloudflare _headers file")
    else:
        headers = headers_path.read_text(encoding="utf-8")
        required_headers = [
            (r"(?im)^\s*X-Robots-Tag:\s*noindex,\s*follow\s*$", "prelaunch X-Robots-Tag noindex, follow"),
            (r"(?im)^\s*X-Content-Type-Options:\s*nosniff\s*$", "X-Content-Type-Options nosniff"),
            (r"(?im)^\s*Referrer-Policy:\s*strict-origin-when-cross-origin\s*$", "strict Referrer-Policy"),
            (r"(?im)^\s*X-Frame-Options:\s*DENY\s*$", "X-Frame-Options DENY"),
            (r"(?im)^\s*Content-Security-Policy:.*script-src 'self'", "first-party-only script CSP"),
            (r"(?im)^\s*Content-Security-Policy:.*object-src 'none'", "CSP object-src none"),
            (r"(?im)^\s*Content-Security-Policy:.*frame-ancestors 'none'", "CSP frame-ancestors none"),
        ]
        for pattern, label in required_headers:
            if not re.search(pattern, headers): issues.append(f"_headers: missing {label}")
        csp_lines = [line for line in headers.splitlines() if line.lower().lstrip().startswith("content-security-policy:")]
        if any("script-src 'self' 'unsafe-inline'" in line for line in csp_lines):
            issues.append("_headers: script-src must not allow unsafe-inline")
    css_file = ROOT / "assets" / "site.css"
    if css_file.exists():
        css_text = css_file.read_text(encoding="utf-8")
        for css_url in re.findall(r"url\((?:\s*['\"]?)([^)'\"]+)", css_text, flags=re.I):
            css_url = css_url.strip()
            if not css_url or css_url.startswith(("data:", "http:", "https:", "//")):
                continue
            target = (css_file.parent / css_url).resolve()
            if not target.exists(): issues.append(f"assets/site.css: missing local CSS asset {css_url}")
    else:
        issues.append("missing assets/site.css")
    favicon = ROOT / "assets" / "favicon.svg"
    if not favicon.exists(): issues.append("missing assets/favicon.svg")
    if not (ROOT / "404.html").exists():
        issues.append("missing custom 404.html error page")
    robots_path = ROOT / "robots.txt"
    if not robots_path.exists() or "Allow: /" not in robots_path.read_text(encoding="utf-8"):
        issues.append("robots.txt must exist and leave prelaunch pages crawlable for noindex discovery")
    if robots_path.exists() and "Sitemap:" in robots_path.read_text(encoding="utf-8"):
        issues.append("prelaunch robots.txt must not advertise a production sitemap")

    print(f"HTML pages: {len(pages)}")
    print(f"Unique page titles: {len(set(titles))}/{len(titles)}")
    print(f"Unique meta descriptions: {len(set(descriptions))}/{len(descriptions)}")
    print(f"Labelled interactive controls: {controls}")
    print(f"Inline JS blocks found: {inline_scripts}")
    print(f"External first-party JS files syntax-checked: {len(js_files)}")
    print(f"Local anchors, CSS/script/icon references, fragments, page structure and prelaunch headers: checked")
    if issues:
        print(f"ISSUES ({len(issues)}):")
        for issue in issues: print(" -", issue)
        return 1
    print("PASS: no static QA issues found.")
    print("LIMIT: this is not browser, assistive-technology, production-header, privacy-law or professional engineering validation.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
