#!/usr/bin/env python3
"""Normalize primary navigation and footer destinations in the staged site."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
NAV = [
    ("Tools", "/#tools"),
    ("Guides", "/#guides"),
    ("About", "/about"),
    ("Methodology", "/methodology"),
    ("Contact", "/contact"),
]
FOOT = [("Calculation methodology", "/methodology"), ("Contact", "/contact")]

class Anchors(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []
        self.active = None
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.active = {"attrs": dict(attrs), "text": ""}
    def handle_data(self, data):
        if self.active is not None:
            self.active["text"] += data
    def handle_endtag(self, tag):
        if tag == "a" and self.active is not None:
            self.items.append(self.active)
            self.active = None

def parse_anchors(fragment):
    parser = Anchors()
    parser.feed(fragment)
    return parser.items

def normalize_nav_body(body, rel):
    # Keep one canonical link per destination. The homepage's "How it works"
    # link is intentionally removed from primary navigation; its section remains
    # available in the page content.
    aliases = {
        "#tools": ("Tools", "/#tools"),
        "/#tools": ("Tools", "/#tools"),
        "#guides": ("Guides", "/#guides"),
        "/#guides": ("Guides", "/#guides"),
        "/about": ("About", "/about"),
        "/methodology": ("Methodology", "/methodology"),
        "/contact": ("Contact", "/contact"),
        "#calculator": ("Calculator", "#calculator"),
        "/#calculator": ("Calculator", "/#calculator"),
    }
    seen = set()
    def replace_anchor(match):
        tag = match.group(0)
        href_match = re.search(r'\\bhref=["\\']([^"\\']+)["\\']', tag, re.I)
        if not href_match:
            return tag
        href = href_match.group(1)
        if href in ("#how", "/#how"):
            return ""
        canonical = aliases.get(href)
        if not canonical:
            return tag
        label, target = canonical
        if label in seen:
            return ""
        seen.add(label)
        # Preserve CTA styling and arrow decoration, but standardize its label.
        suffix = ' <span aria-hidden="true">→</span>' if re.search(r'<span[^>]*>\\s*→\\s*</span>', tag) else ""
        opening = re.match(r"<a\\b[^>]*>", tag, re.I).group(0)
        opening = re.sub(r'\\bhref=(["\\'])[^"\\']+\\1', f'href="{target}"', opening, flags=re.I)
        return opening + label + suffix + "</a>"
    body = re.sub(r"<a\\b[^>]*>[\\s\\S]*?</a>", replace_anchor, body, flags=re.I)
    for label, href in NAV:
        if label not in seen:
            body += f'<a href="{href}">{label}</a>'
    if "Calculator" not in seen:
        body += '<a class="btn btn-dark btn-small" href="/#calculator">Calculator <span aria-hidden="true">→</span></a>'
    return body

def header_nav(doc, rel):
    h = re.search(r"<header\\b[\\s\\S]*?</header>", doc, re.I)
    if not h:
        raise SystemExit(f"Missing header: {rel}")
    n = re.search(r"<nav\\b([^>]*)>([\\s\\S]*?)</nav>", h.group(), re.I)
    if not n:
        raise SystemExit(f"Missing nav: {rel}")
    attrs, body = n.group(1), n.group(2)
    if not re.search(r"\\baria-label\\s*=", attrs, re.I):
        attrs += ' aria-label="Main navigation"'
    body = normalize_nav_body(body, rel)
    replacement = f"<nav{attrs}>{body}</nav>"
    new_header = h.group()[:n.start()] + replacement + h.group()[n.end():]
    return doc[:h.start()] + new_header + doc[h.end():]

def footer_links(doc, rel):
    f = re.search(r"<footer\\b[\\s\\S]*?</footer>", doc, re.I)
    if not f:
        raise SystemExit(f"Missing footer: {rel}")
    body = f.group()
    found = {item["text"].strip().lower() for item in parse_anchors(body)}
    add = "".join(f'<a href="{url}">{name}</a>' for name, url in FOOT if name.lower() not in found)
    if not add:
        return doc
    g = re.search(r'<div\\b[^>]*class=["\\'][^"\\']*footer-links[^"\\']*["\\'][^>]*>([\\s\\S]*?)</div>', body, re.I)
    if g:
        at = g.end(1)
    else:
        g = re.search(r"<div\\b[^>]*>\\s*(?=<a\\b)", body, re.I)
        if not g:
            raise SystemExit(f"Cannot identify footer link group: {rel}")
        at = body.find("</div>", g.start())
        if at < 0:
            raise SystemExit(f"Unclosed footer link group: {rel}")
    body = body[:at] + add + body[at:]
    return doc[:f.start()] + body + doc[f.end():]

def main():
    pages = sorted(DIST.rglob("*.html"))
    if not pages:
        raise SystemExit("No staged public HTML pages")
    for page in pages:
        rel = page.relative_to(DIST).as_posix()
        doc = page.read_text(encoding="utf-8")
        doc = header_nav(doc, rel)
        doc = footer_links(doc, rel)
        page.write_text(doc, encoding="utf-8")
    print(f"PASS: standardized primary navigation and footer links on {len(pages)} public pages")

if __name__ == "__main__":
    main()
