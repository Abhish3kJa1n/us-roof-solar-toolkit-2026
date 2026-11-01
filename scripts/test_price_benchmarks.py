#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[1]
result = subprocess.run(["node", str(ROOT / "scripts" / "test_price_benchmarks.mjs")], cwd=ROOT, text=True, capture_output=True)
if result.stdout:
    print(result.stdout, end="")
if result.stderr:
    print(result.stderr, end="", file=sys.stderr)
raise SystemExit(result.returncode)
