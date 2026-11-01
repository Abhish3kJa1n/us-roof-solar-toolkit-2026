#!/usr/bin/env python3
"""Exercise homepage combined-calculator calculation flow with deterministic DOM stubs."""
from __future__ import annotations
import json, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/"assets/js/homepage-1.js").read_text(encoding="utf-8")

HARNESS=r'''
const ids=[...new Set([...__IDS__,'year','calculatorForm','progressValue','stepCount','stepProgress','calculator','error1','error2','roofAreaField','homeAreaField','storiesField','aprField','termField','offsetValue','results','resultWarning','assumptionList'])];
const all={};
let createdCount=0;
global.window={location:{search:''}};
function makeEl(id){return all[id]||(all[id]={id,value:'',textContent:'',innerHTML:'',hidden:false,required:false,checked:false,dataset:{},style:{},attrs:{},handlers:{},selectedOptions:[{text:'Asphalt shingles'}],classList:{toggle(){},add(){},remove(){}},addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},scrollIntoView(){},remove(){},append(){},closest(){return {append(){}}}})};
ids.forEach(makeEl);
const modeRoof=makeEl('modeRoof'); modeRoof.value='roof'; modeRoof.checked=true;
const modeHome=makeEl('modeHome'); modeHome.value='home'; modeHome.checked=false;
const financeCash=makeEl('financeCash'); financeCash.value='cash'; financeCash.checked=true;
const financeLoan=makeEl('financeLoan'); financeLoan.value='loan'; financeLoan.checked=false;
const testPanels=[1,2,3].map(n=>{const e=makeEl('panel'+n);e.dataset.panel=String(n);return e;});
const testLabels=[1,2,3].map(n=>{const e=makeEl('label'+n);e.dataset.stepLabel=String(n);return e;});
global.testAreaMode='roof';
global.document={
 createElement(tag){const el=makeEl('created:'+tag+':'+(++createdCount));el.tagName=tag.toUpperCase();return el;},
 getElementById(id){return makeEl(id)},
 querySelector(q){if(q.includes('areaMode'))return global.testAreaMode==='home'?modeHome:modeRoof;if(q.includes('financing'))return financeCash;return makeEl('query:'+q)},
 querySelectorAll(q){if(q==='.step-panel')return testPanels;if(q==='[data-step-label]')return testLabels;if(q==='input[name="areaMode"]')return [modeRoof,modeHome];if(q==='input[name="financing"]')return [financeCash,financeLoan];return [];}
};
'''.replace('__IDS__',json.dumps(['roofType','roofAge','pitch','roofArea','homeArea','roofRateLow','roofRateHigh','annualKwh','rate','offset','selfUse','exportRate','productionPerKw','solarPricePerWatt','apr','term','condition','stories','roofStatus','roofStatusDesc','roofAgeResult','roofAreaResult','roofCost','roofRate','systemSize','systemDesc','production','roofCapacity','annualSavings','monthlySavings','savingsDesc','payback','solarCost','loanPayment','loanDesc','loanTerms','resultsLocation','assumptionList','resultWarning','calculateButton','editInputs']))

DEFAULTS={
 'roofType':'asphalt','roofAge':'','pitch':'moderate','roofArea':'1800','homeArea':'2000','roofRateLow':'','roofRateHigh':'',
 'annualKwh':'10800','rate':'0.20','offset':'80','selfUse':'','exportRate':'','productionPerKw':'1200','solarPricePerWatt':'3',
 'apr':'','term':'','condition':'good','stories':''
}
CASES=[
 ('unknown_use_share',{},['Inputs needed','No annual self-consumption share was entered','not split between self-use and exports'],['Rate needed','50%']),
 ('unknown_export_rate',{'selfUse':'50'},['Inputs needed','No export credit was entered','not assumed to be worth $0'],['Rate needed']),
 ('complete_scenario',{'selfUse':'50','exportRate':'0.04'},['$1,037 / yr','4,320 kWh self-used','$0.040/kWh','20.8 years'],['Inputs needed']),
 ('zero_import_rate_explicit',{'selfUse':'50','rate':'0','exportRate':'0.04'},['$173 / yr','0.000/kWh'],['No import rate was entered']),
 ('all_direct_use_export_not_required',{'selfUse':'100'},['$1,728 / yr','12.5 years','8,640 kWh self-used'],['No export credit was entered']),
 ('export_only_without_import_rate',{'selfUse':'0','exportRate':'0.04','rate':''},['$346 / yr','0 kWh self-consumed','no import-rate input is needed'],['Inputs needed'])
]

def main():
 for name,overrides,yes,no in CASES:
  values={**DEFAULTS,**overrides}
  code=HARNESS+JS+'\n'+f"for(const [k,v] of Object.entries({json.dumps(values)})) makeEl(k).value=v; makeEl('calculateButton').handlers.click(); console.log(JSON.stringify({{annual:makeEl('annualSavings').textContent,desc:makeEl('savingsDesc').textContent,payback:makeEl('payback').textContent,warning:makeEl('resultWarning').textContent,assumptions:makeEl('assumptionList').innerHTML,error:makeEl('error1').textContent}}));"
  with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:f.write(code);temp=Path(f.name)
  try:r=subprocess.run(['node',str(temp)],capture_output=True,text=True)
  finally:temp.unlink(missing_ok=True)
  if r.returncode:raise SystemExit(f'FAIL {name}: {r.stderr}')
  out=json.loads(r.stdout)
  combined=' '.join(str(v) for v in out.values())
  missing=[x for x in yes if x not in combined]
  present=[x for x in no if x in combined]
  if missing or present:raise SystemExit(f'FAIL {name}: missing={missing}; unwanted={present}; output={out}')
  print('PASS',name)
 # Home-area conversion must not silently assume a one-storey footprint.
 values={**DEFAULTS,'roofArea':'','homeArea':'2000','pitch':'moderate','stories':''}
 code=HARNESS+JS+'\n'+f"for(const [k,v] of Object.entries({json.dumps(values)})) makeEl(k).value=v; global.testAreaMode='home'; makeEl('calculateButton').handlers.click(); console.log(makeEl('error1').textContent);"
 with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:f.write(code);temp=Path(f.name)
 try:r=subprocess.run(['node',str(temp)],capture_output=True,text=True)
 finally:temp.unlink(missing_ok=True)
 if r.returncode or 'Select the number of above-ground stories' not in r.stdout:
  raise SystemExit(f'FAIL home mode story-count validation: {r.stderr} {r.stdout}')
 print('PASS home_mode_requires_story_count')
 values={**DEFAULTS,'roofArea':'','homeArea':'2000','pitch':'moderate','stories':'2'}
 code=HARNESS+JS+'\n'+f"for(const [k,v] of Object.entries({json.dumps(values)})) makeEl(k).value=v; global.testAreaMode='home'; makeEl('annualKwh').value='10800'; makeEl('calculateButton').handlers.click(); console.log(makeEl('roofAreaResult').textContent);"
 with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:f.write(code);temp=Path(f.name)
 try:r=subprocess.run(['node',str(temp)],capture_output=True,text=True)
 finally:temp.unlink(missing_ok=True)
 if r.returncode or '1,118' not in r.stdout:
  raise SystemExit(f'FAIL explicit two-story conversion: {r.stderr} {r.stdout}')
 print('PASS explicit_two_story_footprint_conversion')
 # Target generation is now a deliberate visitor input, not a prefilled 80% default.
 values={**DEFAULTS,'offset':''}
 code=HARNESS+JS+'\n'+f"for(const [k,v] of Object.entries({json.dumps(values)})) makeEl(k).value=v; makeEl('calculateButton').handlers.click(); console.log(makeEl('error2').textContent);"
 with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:f.write(code);temp=Path(f.name)
 try:r=subprocess.run(['node',str(temp)],capture_output=True,text=True)
 finally:temp.unlink(missing_ok=True)
 if r.returncode or 'Choose a solar offset between 5% and 100%' not in r.stdout:
  raise SystemExit(f'FAIL target percentage required: {r.stderr} {r.stdout}')
 print('PASS target_percentage_required')

 # The combined calculator starts with transparent, editable national fallbacks when there is no approved local price record.
 code=HARNESS+JS+"\nconsole.log(JSON.stringify({roofLow:makeEl('roofRateLow').value,roofHigh:makeEl('roofRateHigh').value,solarPrice:makeEl('solarPricePerWatt').value,roofStatus:makeEl('roofReferenceStatus').textContent,solarStatus:makeEl('solarReferenceStatus').textContent}));"
 with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:f.write(code);temp=Path(f.name)
 try:r=subprocess.run(['node',str(temp)],capture_output=True,text=True)
 finally:temp.unlink(missing_ok=True)
 if r.returncode:raise SystemExit(f'FAIL national fallback prefill: {r.stderr}')
 prefill=json.loads(r.stdout)
 if (prefill['roofLow'],prefill['roofHigh'],prefill['solarPrice']) != ('4','11','2.62'):
  raise SystemExit(f'FAIL national fallback values: {prefill}')
 if 'not city-specific' not in prefill['roofStatus'].lower() or 'not city-specific' not in prefill['solarStatus'].lower():
  raise SystemExit(f'FAIL national fallback provenance disclosure: {prefill}')
 print('PASS editable national fallback prefill and provenance disclosure')

 # An approved city-level historical solar record must replace the national reference and retain its provenance.
 city_query='?productionPerKw=1575.0&city=Austin&state=TX&cityModelSource=PVWatts+V8&stateAverageRate=0.1651&stateAverageSource=EIA+Electric+Power+Monthly+Table+5.6.B&stateAverageRelease=2026-10-23&solarPricePerWatt=2.75&solarPriceSource=Berkeley+Lab+Tracking+the+Sun+2026&solarPriceGeography=city&solarPriceP25=2.35&solarPriceP75=3.08&solarPriceSampleN=140&solarPriceYearMin=2024&solarPriceYearMax=2025'
 code=HARNESS.replace("search:''", f"search:'{city_query}'")+JS+"\nconsole.log(JSON.stringify({production:makeEl('productionPerKw').value,rate:makeEl('rate').value,solarPrice:makeEl('solarPricePerWatt').value,city:makeEl('resultsLocation').textContent,solarStatus:makeEl('solarReferenceStatus').textContent}));"
 with tempfile.NamedTemporaryFile('w',suffix='.js',encoding='utf-8',delete=False) as f:f.write(code);temp=Path(f.name)
 try:r=subprocess.run(['node',str(temp)],capture_output=True,text=True)
 finally:temp.unlink(missing_ok=True)
 if r.returncode:raise SystemExit(f'FAIL city benchmark prefill: {r.stderr}')
 city=json.loads(r.stdout)
 if (city['production'],city['rate'],city['solarPrice']) != ('1575.0','0.1651','2.75'):
  raise SystemExit(f'FAIL city-based hybrid values: {city}')
 if 'Berkeley Lab' not in city['solarStatus'] or '140 records' not in city['solarStatus']:
  raise SystemExit(f'FAIL city-price provenance not preserved: {city}')
 print('PASS city-based PVWatts/EIA/LBNL prefill overrides national fallback and remains editable')

 print(f'Passed {len(CASES)+3}/{len(CASES)+3} combined calculator scenarios.')
 print('Limit: deterministic DOM stubs exercise the real homepage JavaScript, not browser rendering, tariff accuracy or engineering validation.')
 return 0
if __name__=='__main__':raise SystemExit(main())
