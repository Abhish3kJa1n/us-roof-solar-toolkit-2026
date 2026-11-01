#!/usr/bin/env python3
"""Fail-closed validator for geographic price rows eligible for public display.

The public JSON may remain empty while sources are withheld. Any future numeric
row must pass its source-specific geography, sample, quartile and approval gates.
"""
from __future__ import annotations
import argparse
import json
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "data" / "price-benchmarks.json"
SOLAR_APPROVALS = (
    "current_dataset_license_confirmed",
    "real_dataset_reviewed",
    "cohort_filters_reviewed",
    "independent_method_reviewed",
)
ROOF_APPROVALS = (
    "job_type_code_verified",
    "census_table_c16_reconciled",
    "variance_method_validated",
    "metro_geography_verified",
    "scope_and_imputation_disclosed",
)


def _official_host(url: object, suffix: str) -> bool:
    if not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (host == suffix or host.endswith("." + suffix))


def _valid_quartiles(row: dict) -> bool:
    try:
        p25, median, p75 = (float(row[k]) for k in ("p25", "median", "p75"))
    except (KeyError, TypeError, ValueError):
        return False
    return all(map(lambda x: x > 0 and x < float("inf"), (p25, median, p75))) and p25 <= median <= p75


def validate_record(row: object) -> list[str]:
    errors: list[str] = []
    if not isinstance(row, dict):
        return ["record must be an object"]
    kind = row.get("record_type")
    if row.get("publication_status") != "approved":
        return ["record is not marked approved; non-approved numeric records must not be in the public registry"]
    if not _valid_quartiles(row):
        errors.append("p25, median and p75 must be positive finite values in ascending order")
    try:
        n = row["sample_n"]
        if isinstance(n, bool) or not isinstance(n, int) or n <= 0:
            raise ValueError
    except (KeyError, TypeError, ValueError):
        n = 0
        errors.append("sample_n must be a positive integer")
    approvals = row.get("approval") if isinstance(row.get("approval"), dict) else {}

    if kind == "solar_installed_price":
        level = row.get("geography_level")
        minimum = 100 if level == "city" else 500 if level == "state" else None
        if minimum is None:
            errors.append("solar geography_level must be city or state")
        elif n < minimum:
            errors.append(f"solar {level} sample_n must be at least {minimum}")
        if row.get("metric") != "usd_per_w_dc":
            errors.append("solar metric must be usd_per_w_dc")
        if not isinstance(row.get("state"), str) or len(row["state"]) != 2 or not row["state"].isalpha() or row["state"] != row["state"].upper():
            errors.append("solar state must be a two-letter uppercase abbreviation")
        if level == "city" and not str(row.get("city", "")).strip():
            errors.append("city-level solar row requires a city name")
        try:
            y0, y1 = int(row["installation_year_min"]), int(row["installation_year_max"])
            if not (2024 <= y0 <= y1 <= 2025):
                errors.append("solar installation years must be within the documented 2024–2025 cohort")
        except (KeyError, TypeError, ValueError):
            errors.append("solar row requires valid installation_year_min and installation_year_max")
        if not _official_host(row.get("source_url"), "lbl.gov"):
            errors.append("solar source_url must be an HTTPS Berkeley Lab domain")
        for key in SOLAR_APPROVALS:
            if approvals.get(key) is not True:
                errors.append(f"solar approval gate missing: {key}")
    elif kind == "ahs_metro_roofing_job_cost":
        if row.get("geography_level") != "metro":
            errors.append("AHS roof records must be metro-level, never city-level")
        if row.get("metric") != "nominal_usd_whole_project":
            errors.append("AHS roof metric must be nominal_usd_whole_project; no $/sq-ft conversion")
        if n < 30:
            errors.append("AHS metro sample_n must be at least 30 unweighted projects")
        code = str(row.get("metro_omb13cbsa", ""))
        if len(code) != 5 or not code.isdigit():
            errors.append("AHS metro row requires the five-digit 2013 OMB CBSA code")
        if not str(row.get("metro_name", "")).strip():
            errors.append("AHS metro row requires a metro_name")
        if (row.get("period_start_year"), row.get("period_end_year")) != (2021, 2023):
            errors.append("AHS roof period must be stated as the 2021–2023 reference window")
        if not _official_host(row.get("source_url"), "census.gov"):
            errors.append("AHS source_url must be an HTTPS Census Bureau domain")
        for key in ROOF_APPROVALS:
            if approvals.get(key) is not True:
                errors.append(f"AHS roof approval gate missing: {key}")
        if len(str(row.get("scope_note", "")).strip()) < 40:
            errors.append("AHS roof row requires a substantial scope limitation disclosure")
        if len(str(row.get("imputation_note", "")).strip()) < 25:
            errors.append("AHS roof row must disclose the treatment of Census-edited/imputed data")
    else:
        errors.append(f"unsupported record_type: {kind!r}")
    if not str(row.get("source_title", "")).strip():
        errors.append("source_title is required")
    if not str(row.get("methodology_url", "")).startswith("https://"):
        errors.append("methodology_url must be an HTTPS link")
    return errors


def validate_registry(data: object) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["registry root must be an object"]
    if data.get("schema_version") != 1:
        errors.append("schema_version must equal 1")
    try:
        date.fromisoformat(str(data.get("last_updated", "")))
    except ValueError:
        errors.append("last_updated must be an ISO date YYYY-MM-DD")
    if data.get("currency") != "USD":
        errors.append("currency must be USD")
    records = data.get("records")
    if not isinstance(records, list):
        errors.append("records must be an array")
        return errors
    seen: set[tuple] = set()
    counts = {"solar_installed_price": 0, "ahs_metro_roofing_job_cost": 0}
    for i, row in enumerate(records):
        record_errors = validate_record(row)
        errors.extend(f"records[{i}]: {message}" for message in record_errors)
        if isinstance(row, dict):
            kind = row.get("record_type")
            if kind in counts:
                counts[kind] += 1
            identity = (kind, row.get("geography_level"), row.get("city"), row.get("state"), row.get("metro_omb13cbsa"))
            if identity in seen:
                errors.append(f"records[{i}]: duplicate geography record")
            seen.add(identity)
    status = data.get("source_status") if isinstance(data.get("source_status"), dict) else {}
    for kind, count in counts.items():
        expected = "published" if count else "withheld"
        actual = (status.get(kind) or {}).get("status") if isinstance(status.get(kind), dict) else None
        if actual != expected:
            errors.append(f"source_status.{kind}.status must be {expected!r} when record count is {count}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=REGISTRY)
    args = parser.parse_args()
    try:
        data = json.loads(args.registry.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"FAIL: cannot read benchmark registry: {error}")
        return 1
    errors = validate_registry(data)
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    counts = {kind: sum(1 for row in data["records"] if row["record_type"] == kind) for kind in ("solar_installed_price", "ahs_metro_roofing_job_cost")}
    print("PASS price benchmark registry structure and source-specific publication gates.")
    print(f"Approved solar city/state records: {counts['solar_installed_price']}")
    print(f"Approved AHS metro roofing records: {counts['ahs_metro_roofing_job_cost']}")
    if not data["records"]:
        print("PASS empty registry: no unsupported price number can be displayed by the benchmark UI.")
    print("LIMIT: this validates stated gates and metadata; it does not independently verify underlying source data or legal permissions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
