#!/usr/bin/env python3
"""Run browser-DOM-stub tests for the location-solar page script."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
result = subprocess.run(
    ["node", "--experimental-default-type=module", str(ROOT / "scripts" / "test_location_solar_ui.mjs")],
    cwd=ROOT, text=True, capture_output=True,
)
if result.stdout:
    print(result.stdout, end="")
if result.stderr:
    print(result.stderr, end="", file=sys.stderr)
raise SystemExit(result.returncode)
