#!/usr/bin/env python3
"""Run mocked Cloudflare Pages Function tests with Node.js."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
node = subprocess.run(
    ["node", "--experimental-default-type=module", str(ROOT / "scripts" / "test_location_api.mjs")],
    cwd=ROOT, text=True, capture_output=True,
)
if node.stdout:
    print(node.stdout, end="")
if node.stderr:
    print(node.stderr, end="", file=sys.stderr)
raise SystemExit(node.returncode)
