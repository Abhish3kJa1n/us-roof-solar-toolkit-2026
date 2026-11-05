#!/usr/bin/env python3
"""Smoke-test the actual roof-area, roof-cost and panel-count JavaScript files."""
from __future__ import annotations
import json, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CASES=[
 ("roof-area-1.js", {"footprint":"1600","pitch":"1.118"}, ["1,789 sq ft","pitch multiplier 1.118","No complexity or material-waste allowance"], []),
 ("roof-area-1.js", {"footprint":"-5","pitch":"1.118"}, ["Check inputs"], ["1,789 sq ft"]),
 ("roof-area-1.js", {"footprint":"1600","pitch":""}, ["choose a known roof pitch"], ["1,600 sq ft"]),
 ("roof-area-1.js", {"footprint":"1600","pitch":"2"}, ["Check inputs"], ["3,200 sq ft"]),
 ("roof-replacement-cost-1.js", {"material":"asphalt","area":"1800","low":"5.50","high":"8.00"}, ["$9,900 – $14,400","$5.50–$8.00"], []),
 ("roof-replacement-cost-1.js", {"material":"asphalt","area":"1800","low":"8","high":"5"}, ["Check inputs"], ["$9,900"]),
 ("roof-replacement-cost-1.js", {"material":"asphalt","area":"","low":"5.50","high":"8.00"}, ["Check inputs"], ["$9,900"]),
 ("solar-panel-count-1.js", {"kw":"8","watt":"400","panelArea":"22"}, ["20 panels","8.00 kW","440 sq ft"], []),
 ("solar-panel-count-1.js", {"kw":"0.1","watt":"400","panelArea":"22"}, ["Check inputs"], ["20 panels"]),
 ("solar-panel-count-1.js", {"kw":"8","watt":"400","panelArea":""}, ["20 panels","8.00 kW","Not calculated"], ["440 sq ft"]),
 ("solar-panel-count-1.js", {"kw":"","watt":"400","panelArea":"22"}, ["Check inputs"], ["20 panels"]),
 ("solar-panel-count-1.js", {"annualUse":"12000","offset":"80","production":"1500","watt":"400","panelArea":"22"}, ["16 panels","6.40 kW","9,600 kWh"], []),
 ("solar-panel-count-1.js", {"annualUse":"12000","offset":"80","production":"1500.4","watt":"400","panelArea":"22"}, ["16 panels","6.40 kW","9,600 kWh"], []),
 ("solar-panel-count-1.js", {"annualUse":"12000","offset":"","production":"1500","watt":"400"}, ["Check inputs"], ["panels</div>"]),
 ("solar-panel-count-1.js", {"annualUse":"12000","offset":"80","production":"1500","kw":"8","watt":"400"}, ["Check inputs"], ["20 panels"]),
]

def main():
    passed=0
    for filename, values, must_contain, must_not in CASES:
        js=(ROOT/"assets/js"/filename).read_text(encoding="utf-8")
        harness=r'''
const elements={};
for(const [id,value] of Object.entries(__VALUES__)) elements[id]={id,value,innerHTML:'',selectedOptions:[{textContent:value==='asphalt'?'Asphalt shingles':'Not specified'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
elements.run=elements.run||{handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
elements.reset=elements.reset||{handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
elements.result=elements.result||{innerHTML:''};
global.document={getElementById(id){return elements[id]||(elements[id]={id,value:'',innerHTML:'',selectedOptions:[{textContent:'Not specified'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}})}};
'''.replace("__VALUES__",json.dumps(values))
        runner=harness+js+"\nelements.run.handlers.click(); console.log(elements.result.innerHTML);"
        with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8",delete=False) as f:
            f.write(runner); temp=Path(f.name)
        try: result=subprocess.run(["node",str(temp)],capture_output=True,text=True)
        finally: temp.unlink(missing_ok=True)
        if result.returncode: raise SystemExit(f"FAIL {filename}: {result.stderr}")
        out=result.stdout
        missing=[x for x in must_contain if x not in out]
        present=[x for x in must_not if x in out]
        if missing or present: raise SystemExit(f"FAIL {filename}: missing={missing}; unwanted={present}\n{out}")
        passed+=1; print(f"PASS {filename} :: {values}")
    # The broad Angi reference is not auto-loaded; the visitor must deliberately request it.
    js=(ROOT/"assets/js/roof-replacement-cost-1.js").read_text(encoding="utf-8")
    values={"material":"asphalt","area":"1800","low":"","high":""}
    harness=r"""
const elements={};
for(const [id,value] of Object.entries(__VALUES__)) elements[id]={id,value,innerHTML:'',textContent:'',hidden:true,selectedOptions:[{textContent:'Asphalt shingles'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
for(const id of ['run','reset','result','loadReference','referenceStatus']) if(!elements[id]) elements[id]={id,value:'',innerHTML:'',textContent:'',hidden:true,selectedOptions:[{textContent:'Not specified'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
global.document={getElementById(id){return elements[id]||(elements[id]={id,value:'',innerHTML:'',textContent:'',hidden:true,selectedOptions:[{textContent:'Not specified'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}})}};
""".replace("__VALUES__",json.dumps(values))
    runner=harness+js+r"""
const initial={low:elements.low.value,high:elements.high.value,status:elements.referenceStatus.textContent};
elements.loadReference.handlers.click();
elements.run.handlers.click();
const loaded={low:elements.low.value,high:elements.high.value,status:elements.referenceStatus.textContent,output:elements.result.innerHTML};
elements.low.value='5'; elements.low.handlers.input(); elements.run.handlers.click();
const edited={low:elements.low.value,high:elements.high.value,status:elements.referenceStatus.textContent,output:elements.result.innerHTML};
console.log(JSON.stringify({loaded,edited}));
"""
    with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8",delete=False) as f:
        f.write(runner); temp=Path(f.name)
    try: result=subprocess.run(["node",str(temp)],capture_output=True,text=True)
    finally: temp.unlink(missing_ok=True)
    if result.returncode: raise SystemExit(f"FAIL roof-cost national-reference preset: {result.stderr}")
    state=json.loads(result.stdout)
    loaded,edited=state["loaded"],state["edited"]
    if loaded["low"]!="4" or loaded["high"]!="11" or "not a local or material-specific price" not in loaded["status"] or "$7,200 – $19,800" not in loaded["output"] or "Angi broad national" not in loaded["output"]:
        raise SystemExit(f"FAIL roof-cost national-reference load mismatch: {loaded}")
    if "Mixed/custom rate pair" not in edited["output"] or "Original reference: Angi broad national" not in edited["output"] or "You edited the low rate" not in edited["status"]:
        raise SystemExit(f"FAIL roof-cost custom-rate provenance mismatch: {edited}")
    passed += 1; print("PASS roof-cost Angi national fallback requires explicit opt-in and provenance changes after visitor edit")

    # Metal system references are material/system-specific, opt-in, and disclose their publisher basis.
    js=(ROOT/"assets/js/roof-replacement-cost-1.js").read_text(encoding="utf-8")
    values={"material":"metal","metalSystem":"standing_seam","area":"2000","low":"","high":""}
    harness=r"""
const elements={};
for(const [id,value] of Object.entries(__VALUES__)) elements[id]={id,value,innerHTML:'',textContent:'',hidden:true,disabled:false,selectedOptions:[{textContent:'Not specified'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
for(const id of ['run','reset','result','loadReference','referenceStatus','metalSystemField']) if(!elements[id]) elements[id]={id,value:'',innerHTML:'',textContent:'',hidden:true,disabled:false,selectedOptions:[{textContent:'Not specified'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
elements.material.selectedOptions=[{textContent:'Metal'}];
elements.metalSystem.selectedOptions=[{textContent:'Standing seam'}];
global.document={getElementById(id){return elements[id]||(elements[id]={id,value:'',innerHTML:'',textContent:'',hidden:true,disabled:false,selectedOptions:[{textContent:'Not specified'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}})}};
""".replace("__VALUES__",json.dumps(values))
    runner=harness+js+r"""
elements.run.handlers.click();
const loaded={low:elements.low.value,high:elements.high.value,status:elements.referenceStatus.textContent,output:elements.result.innerHTML};
elements.low.value='10'; elements.low.handlers.input(); elements.run.handlers.click();
const edited={status:elements.referenceStatus.textContent,output:elements.result.innerHTML};
console.log(JSON.stringify({loaded,edited}));
"""
    with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8",delete=False) as f:
        f.write(runner); temp=Path(f.name)
    try: result=subprocess.run(["node",str(temp)],capture_output=True,text=True)
    finally: temp.unlink(missing_ok=True)
    if result.returncode: raise SystemExit(f"FAIL metal-roof reference preset: {result.stderr}")
    state=json.loads(result.stdout); loaded=state["loaded"]; edited=state["edited"]
    if loaded["low"]!="9" or loaded["high"]!="16" or "HomeGuide" not in loaded["status"] or "$18,000 – $32,000" not in loaded["output"]:
        raise SystemExit(f"FAIL standing-seam metal reference mismatch: {loaded}")
    if "Mixed/custom rate pair" not in edited["output"] or "low endpoint was edited by the visitor" not in edited["output"] or "Original reference: HomeGuide published installed range for standing seam" not in edited["output"]:
        raise SystemExit(f"FAIL metal reference provenance after visitor edit: {edited}")
    passed += 1; print("PASS metal-system selection preloads source-specific HomeGuide range and switches to visitor provenance after edit")

    # Reset must clear all visitor-entered values rather than reintroduce sample assumptions.
    js=(ROOT/"assets/js/roof-replacement-cost-1.js").read_text(encoding="utf-8")
    values={"material":"asphalt","area":"1800","low":"5.50","high":"8.00"}
    harness=r"""
const elements={};
for(const [id,value] of Object.entries(__VALUES__)) elements[id]={id,value,innerHTML:'',selectedOptions:[{textContent:'Asphalt shingles'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
for(const id of ['run','reset','result']) if(!elements[id]) elements[id]={id,value:'',innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
global.document={getElementById(id){return elements[id]||(elements[id]={id,value:'',innerHTML:'',selectedOptions:[{textContent:'Not specified'}],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}})}};
""".replace("__VALUES__",json.dumps(values))
    runner=harness+js+"\nelements.reset.handlers.click(); console.log(JSON.stringify({area:elements.area.value,material:elements.material.value,low:elements.low.value,high:elements.high.value,output:elements.result.innerHTML}));"
    with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8",delete=False) as f:
        f.write(runner); temp=Path(f.name)
    try: result=subprocess.run(["node",str(temp)],capture_output=True,text=True)
    finally: temp.unlink(missing_ok=True)
    if result.returncode: raise SystemExit(f"FAIL roof-cost reset: {result.stderr}")
    state=json.loads(result.stdout)
    if any(state[k] != "" for k in ("area","material","low","high")) or "Ready to calculate" not in state["output"]:
        raise SystemExit(f"FAIL roof-cost reset did not clear values: {state}")
    passed += 1; print("PASS roof-cost reset clears all fields")
    # A location-model handoff should preload the production figure without inserting untrusted HTML.
    panel_js=(ROOT/"assets/js/solar-panel-count-1.js").read_text(encoding="utf-8")
    handoff_values={"annualUse":"","offset":"","production":"","kw":"","watt":"400","panelArea":""}
    handoff_harness=r"""
const elements={};
for(const [id,value] of Object.entries(__VALUES__)) elements[id]={id,value,innerHTML:'',textContent:'',hidden:true,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
elements.result=elements.result||{innerHTML:''};
elements.run=elements.run||{handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
elements.reset=elements.reset||{handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
global.document={getElementById(id){return elements[id]||(elements[id]={id,value:'',innerHTML:'',textContent:'',hidden:true,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}})}};
global.window={location:{search:'?production=1550.0&location=Austin%2C%20TX'}};
""".replace("__VALUES__",json.dumps(handoff_values))
    runner=handoff_harness+panel_js+"\nconsole.log(JSON.stringify({production:elements.production.value,context:elements.productionContext.textContent,visible:elements.productionContext.hidden}));"
    with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8",delete=False) as f:
        f.write(runner); temp=Path(f.name)
    try: result=subprocess.run(["node",str(temp)],capture_output=True,text=True)
    finally: temp.unlink(missing_ok=True)
    if result.returncode: raise SystemExit(f"FAIL panel-count production handoff: {result.stderr}")
    handoff=json.loads(result.stdout)
    if handoff["production"] != "1550.0" or handoff["visible"] is not False or "Austin, TX" not in handoff["context"]:
        raise SystemExit(f"FAIL panel-count production handoff mismatch: {handoff}")
    passed += 1; print("PASS PVWatts production handoff preloads validated yield and location context")
    # The solar price checker compares a PV-only cash quote per DC watt with the explicit H1 2026 reference.
    js=(ROOT/"assets/js/solar-installation-cost-1.js").read_text(encoding="utf-8")
    values={"pvCashPrice":"20960","pvSystemSize":"8"}
    harness=r"""
const elements={};
for(const [id,value] of Object.entries(__VALUES__)) elements[id]={id,value,innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},focus(){}};
for(const id of ['checkSolarQuote','resetSolarQuote','solarQuoteResult']) if(!elements[id]) elements[id]={id,value:'',innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},focus(){}};
global.document={getElementById(id){return elements[id]||(elements[id]={id,value:'',innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},focus(){}})}};
""".replace("__VALUES__",json.dumps(values))
    runner=harness+js+r"""
elements.checkSolarQuote.handlers.click();
const valid=elements.solarQuoteResult.innerHTML;
elements.pvCashPrice.value='26200'; elements.pvSystemSize.value='8'; elements.checkSolarQuote.handlers.click();
const higher=elements.solarQuoteResult.innerHTML;
elements.pvCashPrice.value=''; elements.checkSolarQuote.handlers.click();
const missing=elements.solarQuoteResult.innerHTML;
elements.pvCashPrice.value='10000'; elements.pvSystemSize.value='0'; elements.checkSolarQuote.handlers.click();
const invalid=elements.solarQuoteResult.innerHTML;
console.log(JSON.stringify({valid,higher,missing,invalid}));
"""
    with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8",delete=False) as f:
        f.write(runner); temp=Path(f.name)
    try: result=subprocess.run(["node",str(temp)],capture_output=True,text=True)
    finally: temp.unlink(missing_ok=True)
    if result.returncode: raise SystemExit(f"FAIL solar-installation-cost checker: {result.stderr}")
    outputs=json.loads(result.stdout)
    if "$2.62/W" not in outputs["valid"] or "approximately equal to" not in outputs["valid"]:
        raise SystemExit(f"FAIL solar quote checker benchmark arithmetic: {outputs['valid']}")
    if "$3.28/W" not in outputs["higher"] or "25% above" not in outputs["higher"]:
        raise SystemExit(f"FAIL solar quote checker difference calculation: {outputs['higher']}")
    if "Enter both" not in outputs["missing"] or "from 0.5 to 100 kW" not in outputs["invalid"]:
        raise SystemExit(f"FAIL solar quote checker validation: {outputs}")
    passed += 1; print("PASS solar PV quote-per-watt checker: reference match, variance, missing and invalid input cases")
    # Solar financing loan calculator: test standard amortization, same-scope quote gap, zero APR and validation.
    finance_js=(ROOT/"assets/js/solar-financing-checker-1.js").read_text(encoding="utf-8")
    finance_values={"cashPrice":"30000","loanPrincipal":"39000","downPayment":"0","apr":"7.99","termYears":"20"}
    finance_harness=r"""
const elements={};
for(const [id,value] of Object.entries(__VALUES__)) elements[id]={id,value,checked:false,innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},focus(){}};
for(const id of ['sameScope','loanResult','calculateLoan','resetLoan']) if(!elements[id]) elements[id]={id,value:'',checked:false,innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},focus(){}};
global.document={getElementById(id){return elements[id]||(elements[id]={id,value:'',checked:false,innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},focus(){}})}};
""".replace("__VALUES__",json.dumps(finance_values))
    finance_runner=finance_harness+finance_js+r"""
elements.calculateLoan.handlers.click();
const unverified=elements.loanResult.innerHTML;
elements.sameScope.checked=true; elements.calculateLoan.handlers.click();
const matched=elements.loanResult.innerHTML;
elements.apr.value='0'; elements.loanPrincipal.value='12000'; elements.termYears.value='10'; elements.cashPrice.value='12000'; elements.calculateLoan.handlers.click();
const zeroApr=elements.loanResult.innerHTML;
elements.apr.value='41'; elements.calculateLoan.handlers.click();
const invalid=elements.loanResult.innerHTML;
console.log(JSON.stringify({unverified,matched,zeroApr,invalid}));
"""
    with tempfile.NamedTemporaryFile("w",suffix=".js",encoding="utf-8",delete=False) as f:
        f.write(finance_runner); temp=Path(f.name)
    try: result=subprocess.run(["node",str(temp)],capture_output=True,text=True)
    finally: temp.unlink(missing_ok=True)
    if result.returncode: raise SystemExit(f"FAIL solar-financing calculator: {result.stderr}")
    finance=json.loads(result.stdout)
    if "$326 / month" not in finance["unverified"] or "comparison not calculated" not in finance["unverified"].lower():
        raise SystemExit(f"FAIL financing amortization or unverified-scope guard: {finance['unverified']}")
    if "$9,000" not in finance["matched"] or "30%" not in finance["matched"] or "$39,233" not in finance["matched"]:
        raise SystemExit(f"FAIL financing same-scope amount comparison: {finance['matched']}")
    if "$100 / month" not in finance["zeroApr"] or "$0" not in finance["zeroApr"]:
        raise SystemExit(f"FAIL zero-APR calculation: {finance['zeroApr']}")
    if "APR from 0% to 40%" not in finance["invalid"]:
        raise SystemExit(f"FAIL APR input validation: {finance['invalid']}")
    passed+=1; print("PASS solar-financing loan checker: amortization, same-scope guard, zero APR and validation")
    print(f"Passed {passed}/{len(CASES)+6} non-solar calculator cases.")
    print("Limit: DOM stubs exercise calculation logic only; not browser UI, engineering validation or market accuracy.")
    return 0
if __name__=="__main__": raise SystemExit(main())
