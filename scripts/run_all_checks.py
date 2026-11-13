#!/usr/bin/env python3
"""Run the complete local QA suite for the static website."""
from __future__ import annotations

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CHECKS = [
    "audit_site.py",
    "test_prepare_deploy.py",
    "test_preview_csp.mjs",
    "audit_eia_data.py",
    "test_standalone_calculators.py",
    "test_roof_cost_reference_state.mjs",
    "test_solar_calculator.py",
    "test_combined_calculator.py",
    "test_privacy_guardrails.py",
    "test_location_api.py",
    "test_api_quota_sql.py",
    "test_location_solar_ui.py",
    "test_hybrid_input_contract.py",
    "test_field_validation.mjs",
    "test_field_validation_dom.mjs",
    "test_hybrid_prefill.mjs",
    "test_research_scripts.py",
    "test_price_benchmark_gates.py",
    "test_price_benchmarks.py",
    "test_price_benchmark_event.mjs",
    "validate_price_benchmarks.py",
    "test_configure_site.py",
    "test_navigation_ui_contract.py",
]


def main() -> int:
    for script in CHECKS:
        path = ROOT / "scripts" / script
        print(f"\n{'=' * 12} {script} {'=' * 12}", flush=True)
        command = ["node", str(path)] if path.suffix == ".mjs" else [sys.executable, str(path)]
        result = subprocess.run(command, cwd=ROOT)
        if result.returncode:
            print(f"\nFAIL: {script} exited with status {result.returncode}", file=sys.stderr)
            return result.returncode
    print("\nALL LOCAL QA CHECKS PASSED.")
    print("This suite does not replace browser/device, legal, expert, real-tariff or production testing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
