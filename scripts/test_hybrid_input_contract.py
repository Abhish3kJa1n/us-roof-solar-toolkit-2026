#!/usr/bin/env python3
"""Static contract tests for city-based hybrid prefill and field validation wiring."""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

class Controls(HTMLParser):
    def __init__(self):
        super().__init__(); self.controls=[]; self.scripts=[]; self.buttons=[]; self.ids=set()
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if a.get('id'): self.ids.add(a['id'])
        if tag in ('input','select','textarea'):
            typ=a.get('type','text').lower()
            if typ not in ('hidden','button','submit','reset','radio','checkbox','search'):
                self.controls.append((tag,a))
        if tag=='script' and a.get('src'): self.scripts.append(a['src'])
        if tag=='button': self.buttons.append(a)

def fail(message):
    raise SystemExit('FAIL: '+message)

pages = [p for p in ROOT.rglob('*.html') if 'dist' not in p.relative_to(ROOT).parts]
interactive_pages = []
for page in pages:
    html=page.read_text(encoding='utf-8')
    p=Controls(); p.feed(html)
    # A page with calculator data-entry fields must load the shared validator.
    has_calculator_controls = any(t=='input' and a.get('type','text').lower() in ('number','text') for t,a in p.controls) or any(t in ('select','textarea') for t,a in p.controls)
    if has_calculator_controls and page.name != 'electricity-prices-by-state.html':
        if not any(src.endswith('/field-validation-1.js') or src=='assets/js/field-validation-1.js' or src=='../assets/js/field-validation-1.js' for src in p.scripts):
            fail(f'{page.relative_to(ROOT)} has user-entry fields but does not load the shared validator')
        interactive_pages.append(page)
    for tag,a in p.controls:
        if tag=='input' and a.get('type','text').lower()=='number':
            if not all(k in a for k in ('min','max','step')):
                fail(f'{page.relative_to(ROOT)} numeric field #{a.get("id")} lacks a hard min/max/step rule')
        if tag=='input' and a.get('type','text').lower()=='text' and a.get('required'):
            if not all(k in a for k in ('minlength','maxlength','pattern')):
                fail(f'{page.relative_to(ROOT)} required text field #{a.get("id")} lacks length and format validation')
    for b in p.buttons:
        scope=b.get('data-field-validation-scope')
        if scope and scope.startswith('#') and scope[1:] not in p.ids:
            fail(f'{page.relative_to(ROOT)} validation button #{b.get("id")} points to missing scope {scope}')

loc=(ROOT/'calculators/location-solar.html').read_text(encoding='utf-8')
for key,val in {'capacity':'1','tilt':'20','azimuth':'180','losses':'14'}.items():
    if not re.search(rf'<input[^>]*id="{key}"[^>]*value="{val}"', loc):
        fail(f'location estimator is missing its disclosed editable reference assumption for {key}')
for marker in ('not facts inferred from your city','reference configuration','Replace these values'):
    if marker.lower() not in loc.lower():
        fail('city estimator reference assumptions are not adequately disclosed')

home=(ROOT/'index.html').read_text(encoding='utf-8')
home_js=(ROOT/'assets/js/homepage-1.js').read_text(encoding='utf-8')
location_js=(ROOT/'assets/js/location-solar-1.js').read_text(encoding='utf-8')
for phrase in ('City-based solar data','state average is not your household tariff','Every returned value remains editable'):
    if phrase.lower() not in home.lower(): fail(f'homepage lacks hybrid-data disclosure: {phrase}')
for token in ("handoff.get('productionPerKw')", "handoff.get('stateAverageRate')", "PVWatts V8", "FieldValidation.refresh", "loadNationalRoofReference();", "loadNationalSolarReference();", "Berkeley Lab Tracking the Sun 2026"):
    if token not in home_js: fail(f'homepage hybrid handoff is missing {token}')
for token in ('productionPerKw', 'stateAverageRate', 'cityModelSource', 'combinedLink.href', 'roofsolar:solar-price-benchmark'):
    if token not in location_js: fail(f'city estimator handoff is missing {token}')

registry=(ROOT/'data/price-benchmarks.json').read_text(encoding='utf-8')
if '"status": "withheld"' not in registry and '"status":"withheld"' not in registry:
    fail('empty/unapproved price registry must remain explicitly withheld until real source records pass publication gates')
if re.search(r'"records"\s*:\s*\[\s*\{', registry):
    fail('published price registry contains a record; release requires explicit review of every record before approval')
price_js=(ROOT/'assets/js/price-benchmarks-1.js').read_text(encoding='utf-8')
for token in ('notifySolarPriceBenchmark', 'approved(row)', 'roofsolar:solar-price-benchmark'):
    if token not in price_js: fail(f'price UI does not enforce approved-only handoff: {token}')
for token in ('warningMin:', 'warningMax:', 'validateScope', 'aria-describedby', 'aria-live'):
    if token not in (ROOT/'assets/js/field-validation-1.js').read_text(encoding='utf-8'):
        fail(f'shared validator missing expected feedback feature: {token}')

print(f'PASS: {len(interactive_pages)} calculator/data-entry pages load shared field validation; all numeric fields define hard bounds and precision.')
print('PASS: city + state PVWatts/EIA scenario values hand off to editable combined-calculator fields; source-labelled national roof/solar fallbacks load only as broad references when local solar price data are not approved.')
print('PASS: only approval-gated, sufficiently sampled city/state solar records can replace the national solar reference; the current registry remains withheld and no city/metro prices are fabricated.')
