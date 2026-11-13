#!/usr/bin/env python3
"""Normalize public navigation and footer destinations in the staged site."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
NAV = [("Tools", "/#tools"), ("Guides", "/#guides"), ("About", "/about"), ("Methodology", "/methodology"), ("Contact", "/contact")]
FOOT = [("Calculation methodology", "/methodology"), ("Contact", "/contact")]
class Labels(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.active=False; self.current=""; self.values=[]
    def handle_starttag(self, tag, attrs):
        if tag=="a": self.active=True; self.current=""
    def handle_data(self, data):
        if self.active: self.current += data
    def handle_endtag(self, tag):
        if tag=="a" and self.active: self.values.append(" ".join(self.current.split()).lower()); self.active=False
def labels(fragment):
    p=Labels(); p.feed(fragment); return set(p.values)
def header_nav(doc, rel):
    h=re.search(r"<header\b[\s\S]*?</header>",doc,re.I)
    if not h: raise SystemExit(f"Missing header: {rel}")
    n=re.search(r"<nav\b([^>]*)>([\s\S]*?)</nav>",h.group(),re.I)
    if not n: raise SystemExit(f"Missing nav: {rel}")
    attrs,body=n.group(1),n.group(2); found=labels(body)
    add="".join(f'<a href="{url}">{name}</a>' for name,url in NAV if name.lower() not in found)
    if not add: return doc
    if not re.search(r"\baria-label\s*=",attrs,re.I): attrs+=' aria-label="Main navigation"'
    replacement=f"<nav{attrs}>{body}{add}</nav>"
    newh=h.group()[:n.start()]+replacement+h.group()[n.end():]
    return doc[:h.start()]+newh+doc[h.end():]
def footer_links(doc, rel):
    f=re.search(r"<footer\b[\s\S]*?</footer>",doc,re.I)
    if not f: raise SystemExit(f"Missing footer: {rel}")
    body=f.group(); found=labels(body)
    add="".join(f'<a href="{url}">{name}</a>' for name,url in FOOT if name.lower() not in found)
    if not add: return doc
    g=re.search(r'<div\b[^>]*class=["\'][^"\']*footer-links[^"\']*["\'][^>]*>([\s\S]*?)</div>',body,re.I)
    if g: at=g.end(1)
    else:
        g=re.search(r"<div\b[^>]*>\s*(?=<a\b)",body,re.I)
        if not g: raise SystemExit(f"Cannot identify footer link group: {rel}")
        at=body.find("</div>",g.start())
        if at<0: raise SystemExit(f"Unclosed footer link group: {rel}")
    body=body[:at]+add+body[at:]
    return doc[:f.start()]+body+doc[f.end():]
def main():
    pages=sorted(DIST.rglob("*.html"))
    if not pages: raise SystemExit("No staged public HTML pages")
    for p in pages:
        rel=p.relative_to(DIST).as_posix(); doc=p.read_text(encoding="utf-8")
        doc=header_nav(doc,rel); doc=footer_links(doc,rel); p.write_text(doc,encoding="utf-8")
    print(f"PASS: normalized responsive navigation and footer links on {len(pages)} public pages")
if __name__=="__main__": main()
