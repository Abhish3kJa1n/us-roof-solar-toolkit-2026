#!/usr/bin/env python3
"""Exercise the actual standalone solar calculator JavaScript with DOM stubs.

These are deterministic calculation tests, not browser/UI end-to-end tests.
Requires Python 3 and Node.js.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS_FILE = ROOT / "assets" / "js" / "solar-savings-1.js"

HARNESS = r"""
const ids=['annualUse','importRate','offset','production','selfUse','exportRate','price','run','result'];
const elements={};
for (const id of ids) elements[id]={id,value:'',innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
global.document={getElementById(id){return elements[id] || (elements[id]={id,value:'',innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}})}};
"""

CASES = [
    ("no_share_no_tariff", {"annualUse": "10800", "offset": "80", "production": "1200", "price": "3"}, ["7.2 kW DC system", "Not modeled — enter an annual direct-use share", "Not calculated — missing annual direct-use share"]),
    ("share_but_export_unknown", {"annualUse": "10800", "offset": "80", "production": "1200", "selfUse": "50", "importRate": "0.20", "price": "3"}, ["4,320 kWh", "avoided import charges", "export value requires both", "Not calculated — missing utility export credit"]),
    ("complete_export_tariff", {"annualUse": "10800", "offset": "80", "production": "1200", "selfUse": "50", "importRate": "0.20", "exportRate": "0.04", "price": "3"}, ["8,640 kWh", "1,037", "20.8 years"]),
    ("all_generation_used_directly", {"annualUse": "10800", "offset": "80", "production": "1200", "selfUse": "100", "importRate": "0.20", "price": "3"}, ["8,640 kWh", "1,728", "12.5 years"]),
    ("zero_export_credit_explicit", {"annualUse": "10800", "offset": "80", "production": "1200", "selfUse": "50", "importRate": "0.20", "exportRate": "0", "price": "3"}, ["8,640 kWh", "864", "25.0 years"]),
    ("zero_direct_use", {"annualUse": "10800", "offset": "80", "production": "1200", "selfUse": "0", "importRate": "0.20", "exportRate": "0.03", "price": "3"}, ["0 kWh", "259", "83.3 years"]),
    ("export_only_without_import_rate", {"annualUse": "10800", "offset": "80", "production": "1200", "selfUse": "0", "exportRate": "0.03", "price": "3"}, ["0 kWh in this scenario", "259", "83.3 years"]),
    ("zero_import_rate_explicit", {"annualUse": "10800", "offset": "80", "production": "1200", "selfUse": "50", "importRate": "0", "exportRate": "0.06", "price": "3"}, ["$0.000/kWh", "259", "83.3 years"]),
    ("missing_import_rate", {"annualUse": "10800", "offset": "80", "production": "1200", "selfUse": "50", "exportRate": "0.04", "price": "3"}, ["Not calculated — missing marginal import rate"]),
    ("import_rate_missing_but_export_not_needed", {"annualUse": "10800", "offset": "80", "production": "1200", "selfUse": "100", "price": "3"}, ["Not calculated — missing marginal import rate", "0 kWh" ]),
]


def main() -> int:
    if not JS_FILE.exists():
        raise SystemExit(f"Missing calculator source: {JS_FILE}")
    js = JS_FILE.read_text(encoding="utf-8")
    passed = 0
    for name, values, expected in CASES:
        runner = HARNESS + js + "\n" + (
            f"for (const [k,v] of Object.entries({json.dumps(values, ensure_ascii=False)})) "
            "elements[k].value=v; elements.run.handlers.click(); "
            "console.log(elements.result.innerHTML);"
        )
        with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as handle:
            handle.write(runner)
            temp_path = Path(handle.name)
        try:
            result = subprocess.run(["node", str(temp_path)], capture_output=True, text=True, check=False)
        finally:
            temp_path.unlink(missing_ok=True)
        if result.returncode:
            print(f"FAIL {name}: {result.stderr.strip()}")
            return 1
        missing = [term for term in expected if term not in result.stdout]
        if missing:
            print(f"FAIL {name}: expected output did not contain {missing}")
            print(result.stdout)
            return 1
        print(f"PASS {name}")
        passed += 1
    print(f"Passed {passed}/{len(CASES)} standalone solar calculation scenarios.")
    print("Limit: DOM stubs exercise calculation logic, not real browser rendering, accessibility or utility tariff accuracy.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
