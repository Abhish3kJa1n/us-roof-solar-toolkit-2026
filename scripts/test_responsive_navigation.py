#!/usr/bin/env python3
"""Regression checks for responsive navigation, footer links and policy contrast."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import os,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]; DIST=ROOT/"dist"
class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.header=self.nav=self.footer=self.anchor=False; self.current=""; self.nav_labels=[]; self.footer_labels=[]
    def handle_starttag(self,tag,attrs):
        if tag=="header": self.header=True
        elif tag=="nav" and self.header: self.nav=True
        elif tag=="footer": self.footer=True
        elif tag=="a": self.anchor=True; self.current=""
    def handle_data(self,data):
        if self.anchor: self.current+=data
    def handle_endtag(self,tag):
        if tag=="a" and self.anchor:
            label=" ".join(self.current.split()).lower()
            if self.nav:self.nav_labels.append(label)
            if self.footer:self.footer_labels.append(label)
            self.anchor=False
        elif tag=="nav":self.nav=False
        elif tag=="header":self.header=False
        elif tag=="footer":self.footer=False
def fail(msg): print("FAIL: "+msg,file=sys.stderr); raise SystemExit(1)
def main():
    env=os.environ.copy(); env["CF_PAGES_BRANCH"]="preview"; env["CF_PAGES_COMMIT_SHA"]="responsive-nav-test"
    subprocess.run(["sh",str(ROOT/"scripts/prepare_deploy.sh")],cwd=ROOT,env=env,check=True)
    pages=sorted(DIST.rglob("*.html"))
    if len(pages)!=27: fail(f"Expected 27 HTML pages, found {len(pages)}")
    for page in pages:
        p=Links(); p.feed(page.read_text(encoding="utf-8"))
        missing={"tools","guides","about","methodology","contact"}-set(p.nav_labels)
        if missing: fail(f"{page.relative_to(DIST)} missing nav links: {sorted(missing)}")
        missing={"contact","calculation methodology"}-set(p.footer_labels)
        if missing: fail(f"{page.relative_to(DIST)} missing footer links: {sorted(missing)}")
    css=(DIST/"assets/site.css").read_text(encoding="utf-8")
    if ".article > .eyebrow{color:#8b5c0f}" not in css: fail("Contrast-safe article eyebrow rule missing")
    mobile=re.search(r"@media\(max-width:600px\)\{([\s\S]*?)\}",css)
    if not mobile: fail("Mobile breakpoint missing")
    for rule in (".nav .links a:not(.btn){display:inline-flex}",".nav .nav-links","flex-wrap:wrap"):
        if rule not in mobile.group(1): fail(f"Responsive navigation rule missing: {rule}")
    print(f"PASS: {len(pages)} pages expose five primary nav destinations and consistent footer links.")
    print("PASS: mobile navigation wraps visibly; policy metadata uses contrast-safe styling.")
if __name__=="__main__": main()
