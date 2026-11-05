#!/usr/bin/env python3
"""Synthetic tests for the fail-closed geographic price publication gate."""
from __future__ import annotations
import copy
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("price_gate", ROOT / "scripts" / "validate_price_benchmarks.py")
mod = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(mod)


def solar_row(n=125):
    return {
        "record_type": "solar_installed_price", "publication_status": "approved",
        "geography_level": "city", "city": "Austin", "state": "TX", "sample_n": n,
        "installation_year_min": 2024, "installation_year_max": 2025,
        "metric": "usd_per_w_dc", "p25": 2.45, "median": 2.9, "p75": 3.4,
        "source_title": "Berkeley Lab Tracking the Sun 2026", "source_url": "https://eta.lbl.gov/publications/example",
        "methodology_url": "https://example.org/methodology",
        "approval": {k: True for k in mod.SOLAR_APPROVALS}
    }


def roof_row(n=44):
    return {
        "record_type": "ahs_metro_roofing_job_cost", "publication_status": "approved",
        "geography_level": "metro", "metro_omb13cbsa": "17140", "metro_name": "Cincinnati, OH-KY-IN",
        "sample_n": n, "source_puf": "metropolitan", "weighted_response_rate_pct": 62.9,
        "project_n": n + 6, "positive_cost_project_n": n + 2, "positive_cost_housing_units_n": n,
        "jobdiy_scope": "professional",
        "mean_cv": 0.08, "median_cv": 0.11, "p25_cv": 0.17, "p75_cv": 0.16,
        "precision_review_note": "Professional-only positive-cost sample uses 160 Fay-BRR replicate estimates. Mean, median and both quartiles have finite CV values below 30 percent; metric-specific precision and suppression decisions have been independently reviewed.",
        "nonsampling_risk_note": "Census Table 2.2 reports a 62.9 percent weighted response rate for Cincinnati. The report separately gives 59.2 percent survey-wide unit nonresponse; the two are not interchangeable and both are retained for risk review.",
        "period_start_year": 2021, "period_end_year": 2023,
        "metric": "nominal_usd_whole_project", "p25": 6100, "median": 10500, "p75": 16900,
        "source_title": "Census Bureau 2023 AHS", "source_url": "https://www.census.gov/programs-surveys/ahs/data.2023.html",
        "methodology_url": "https://example.org/methodology",
        "scope_note": "Homeowner-reported roofing additions or replacements; not a uniform full tear-off scope or a verified contractor invoice.",
        "imputation_note": "JOBCOST and JOBDIY may include Census-edited or imputed values; imputation limitations are disclosed.",
        "approval": {k: True for k in mod.ROOF_APPROVALS}
    }


def expect(condition, label):
    if not condition:
        raise SystemExit(f"FAIL: {label}")
    print(f"PASS {label}")

# Current registry must be accepted but publish no numeric rows.
current = json.loads((ROOT / "data" / "price-benchmarks.json").read_text(encoding="utf-8"))
expect(mod.validate_registry(current) == [], "empty source-gated registry is valid and withheld")

# Correct rows pass their own source/geography/sample rules.
expect(mod.validate_record(solar_row()) == [], "eligible city solar distribution passes gates")
expect(mod.validate_record(solar_row(500) | {"geography_level": "state", "city": None}) == [], "eligible state solar fallback passes stricter sample threshold")
expect(mod.validate_record(roof_row()) == [], "eligible AHS metro whole-project distribution passes gates")

# Failure cases must not be published.
row = solar_row(99)
expect(any("at least 100" in e for e in mod.validate_record(row)), "undersized city solar sample is suppressed")
row = solar_row(); row["approval"]["current_dataset_license_confirmed"] = False
expect(any("current_dataset_license_confirmed" in e for e in mod.validate_record(row)), "unconfirmed solar reuse rights block publication")
row = roof_row(); row["geography_level"] = "city"
expect(any("metro-level" in e for e in mod.validate_record(row)), "AHS data cannot be published as city price")
row = roof_row(); row["metric"] = "usd_per_sq_ft"
expect(any("no $/sq-ft" in e for e in mod.validate_record(row)), "AHS whole-project spend cannot be converted to $/sq-ft")
row = roof_row(); row["p75"] = 9000
expect(any("ascending order" in e for e in mod.validate_record(row)), "misordered quartiles are rejected")
row = roof_row(); row["approval"]["census_table_c16_reconciled"] = False
expect(any("census_table_c16_reconciled" in e for e in mod.validate_record(row)), "unreconciled AHS estimates are withheld")
row = roof_row(29)
expect(any("at least 30 distinct owner-occupied housing units" in e for e in mod.validate_record(row)), "AHS fewer than 30 distinct positive-cost housing units is withheld")
row = roof_row(); row["jobdiy_scope"] = "professional_and_diy"
expect(any("JOBDIY='2' professional projects only" in e for e in mod.validate_record(row)), "AHS contractor benchmark cannot mix DIY and professional jobs")
row = roof_row(); row["median_cv"] = 0.30
expect(any("below the 30% Table Creator suppression threshold" in e for e in mod.validate_record(row)), "AHS median CV at or above 30% is suppressed")
row = roof_row(); row.pop("p25_cv")
expect(any("requires finite mean_cv, median_cv, p25_cv and p75_cv" in e for e in mod.validate_record(row)), "AHS missing precision metric is suppressed")
row = roof_row(); row["precision_review_note"] = "too short"
expect(any("metric-specific precision and suppression review" in e for e in mod.validate_record(row)), "AHS requires a documented metric-specific precision review")
row = roof_row(); row["nonsampling_risk_note"] = "too short"
expect(any("unit-nonresponse and nonsampling-risk review" in e for e in mod.validate_record(row)), "AHS requires a documented nonresponse-risk review")
row = roof_row(); row["source_puf"] = "unknown"
expect(any("source_puf" in e for e in mod.validate_record(row)), "AHS source PUF provenance is mandatory")
row = roof_row(); row["weighted_response_rate_pct"] = 59.2
expect(any("must match 2023 Census Table 2.2 (62.9%)" in e for e in mod.validate_record(row)), "Next-5 response rate must match the area-specific Census value")
row = roof_row(); row["metro_omb13cbsa"] = "12420"; row["metro_name"] = "Austin-Round Rock-Georgetown, TX"
expect(any("five Next-10 CBSA areas actually interviewed" in e for e in mod.validate_record(row)), "2023 Metro PUF cannot publish an unsampled metro")
row = roof_row(); row["metro_name"] = "Cincinnati"
expect(any("official 2013 OMB CBSA label" in e for e in mod.validate_record(row)), "Next-5 metro label must match the official 2013 CBSA geography label")
row = roof_row(); row["metro_name"] = "Cincinnati, OH"
expect(any("official 2013 OMB CBSA label" in e for e in mod.validate_record(row)), "abbreviated city-only label cannot pass the Next-5 CBSA geography gate")
row = roof_row(); row["source_puf"] = "national"; row["metro_omb13cbsa"] = "12060"; row["metro_name"] = "Atlanta-Sandy Springs-Roswell, GA"; row.pop("weighted_response_rate_pct")
expect(mod.validate_record(row) == [], "National PUF row may use an integrated Top-15 code without Metro-PUF response metadata")
row = roof_row(); row["source_puf"] = "national"; row["metro_omb13cbsa"] = "17140"; row["metro_name"] = "Cincinnati, OH-KY-IN"; row.pop("weighted_response_rate_pct")
expect(any("15 integrated Top-15" in e for e in mod.validate_record(row)), "National PUF must not be used for the separately sampled Next-5 areas")
row = roof_row(); row["approval"]["statistical_precision_reviewed"] = False
expect(any("statistical_precision_reviewed" in e for e in mod.validate_record(row)), "AHS precision approval is mandatory")
row = roof_row(); row["approval"]["nonsampling_risk_reviewed"] = False
expect(any("nonsampling_risk_reviewed" in e for e in mod.validate_record(row)), "AHS nonsampling-risk approval is mandatory")

# Registry status must agree with whether rows are actually published.
fixture = copy.deepcopy(current)
fixture["records"] = [solar_row()]
expect(any("must be 'published'" in e for e in mod.validate_registry(fixture)), "registry cannot claim withheld when public rows are present")
fixture["source_status"]["solar_installed_price"]["status"] = "published"
expect(mod.validate_registry(fixture) == [], "published source status and approved rows are consistent")

print("All synthetic source-gate tests passed. Synthetic rows were not added to the live registry.")
