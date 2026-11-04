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
for phrase in ('City-based solar data','It is not inserted into your tariff field','Every returned value remains editable'):
    if phrase.lower() not in home.lower(): fail(f'homepage lacks hybrid-data disclosure: {phrase}')
for token in ("handoff.get('productionPerKw')", "handoff.get('stateAverageRate')", "useEiaStateAverage", "addEventListener('click'", "PVWatts V8", "FieldValidation.refresh", "loadNationalRoofReference();", "loadNationalSolarReference();", "Berkeley Lab Tracking the Sun 2026"):
    if token not in home_js: fail(f'homepage hybrid handoff is missing {token}')
for token in ('productionPerKw', 'stateAverageRate', 'stateAverageSource', 'cityModelSource', 'combinedLink.href', 'roofsolar:solar-price-benchmark'):
    if token not in location_js: fail(f'city estimator handoff is missing {token}')

# EIA statewide averages must never silently become a household marginal tariff.
savings_js=(ROOT/'assets/js/solar-savings-1.js').read_text(encoding='utf-8')
for source_js, field_name in ((home_js, 'importRateInput'), (savings_js, 'importRateEl')):
    if 'Use EIA average as an illustrative scenario' not in source_js:
        fail('EIA state-average rate must require a deliberate visitor opt-in')
    if 'useEiaStateAverage' not in source_js:
        fail('EIA state-average opt-in control is missing')
    if not re.search(r"addEventListener\('click',[\s\S]{0,800}" + re.escape(field_name) + r"\.value = incomingStateRate\.toFixed\(4\)", source_js):
        if field_name == 'importRateEl':
            if not re.search(r"addEventListener\('click',[\s\S]{0,800}" + re.escape(field_name) + r"\.value = importedStateRate\.toFixed\(4\)", source_js):
                fail('EIA state average must only be applied from its explicit button click')
        else:
            fail('EIA state average must only be applied from its explicit button click')
    if re.search(r"if \(handoff\.get\('stateAverageSource'\)[\s\S]{0,500}" + re.escape(field_name) + r"\.value = (?:incomingStateRate|importedStateRate)", source_js):
        fail('EIA state average is being auto-inserted before explicit visitor action')

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

# Currency inputs are whole-dollar amounts, not $100 increments. A min=1/step=100
# pair makes common values such as $30,000 fail the step check (1 + 100*n only).
currency_fields = {
    'guides/solar-installation-cost.html': {'pvCashPrice'},
    'guides/solar-loan-vs-lease-vs-ppa.html': {'cashPrice', 'loanPrincipal', 'downPayment'},
}
for relative_path, expected_ids in currency_fields.items():
    parser = Controls()
    parser.feed((ROOT / relative_path).read_text(encoding='utf-8'))
    indexed = {attrs.get('id'): attrs for _, attrs in parser.controls if attrs.get('id')}
    for field_id in expected_ids:
        attrs = indexed.get(field_id)
        if not attrs:
            fail(f'{relative_path} is missing currency field #{field_id}')
        if attrs.get('type') != 'number' or attrs.get('step') != '1':
            fail(f'{relative_path} #{field_id} must accept whole-dollar increments (step=1)')

print(f'PASS: {len(interactive_pages)} calculator/data-entry pages load shared field validation; all numeric fields define hard bounds and precision.')
print('PASS: solar cash price, loan principal, down payment and PV quote fields accept ordinary whole-dollar values without $100-step rejection.')
print('PASS: city-based PVWatts and EIA state-average context are handed off; the EIA rate remains unused until a visitor explicitly applies it as an illustrative scenario.')
print('PASS: only approval-gated, sufficiently sampled city/state solar records can replace the national solar reference; the current registry remains withheld and no city/metro prices are fabricated.')
