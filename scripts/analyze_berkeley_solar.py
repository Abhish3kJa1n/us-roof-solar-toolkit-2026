#!/usr/bin/env python3
"""Create conservative city- and state-level research summaries from LBNL Tracking the Sun.

The public file is project-level research data, not a representative census of every
installation. This script screens a residential, rooftop, PV-only, host-owned,
non-self-installed, non-expansion, single-phase cohort and writes only aggregates.
It does not download data, publish prices, infer missing city aliases, or make quotes.

The August 7, 2026 LBNL guide says most fields are incomplete; city spellings are
not standardized; installed price can be self-reported and inconsistently verified.
Do not commercially publish derived values until the applicable current dataset
reuse terms are confirmed with LBNL and the methodology is independently reviewed.
"""
from __future__ import annotations
import argparse
import csv
import gzip
import math
import re
import statistics
import unicodedata
from array import array
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

REQUIRED = {
    "PV_system_size_DC", "total_installed_price", "customer_segment",
    "ground_mounted", "technology_type", "state", "city", "installation_date",
    "third_party_owned", "third_party_owned_inferred", "self_installed",
    "expansion_system", "multiple_phase_system",
}
FALSE_VALUES = {"0", "0.0", "false", "no", "n"}
TRUE_VALUES = {"1", "1.0", "true", "yes", "y"}
MISSING = {"", "-1", "-1.0", "na", "n/a", "null", "none", "unknown"}
VALID_US_STATE_CODES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI",
    "WY", "AS", "GU", "MP", "PR", "VI",
}


def num(raw: str | None) -> float | None:
    if raw is None or raw.strip().lower() in MISSING:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def flag(raw: str | None) -> bool | None:
    token = (raw or "").strip().lower()
    if token in TRUE_VALUES:
        return True
    if token in FALSE_VALUES:
        return False
    return None


def installation_year(raw: str | None) -> int | None:
    token = (raw or "").strip()
    if token.lower() in MISSING:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(token[:10], fmt).year
        except ValueError:
            continue
    match = re.match(r"^(19\d{2}|20\d{2})", token)
    return int(match.group(1)) if match else None


def city_key(raw: str) -> str:
    # Normalize cosmetic case/Unicode/whitespace differences only. Do not merge
    # aliases such as St. Louis/Saint Louis or city names across state boundaries.
    token = unicodedata.normalize("NFKC", raw).casefold().strip()
    token = token.replace("’", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", token)


def quantile(values: array, q: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return float("nan")
    position = (len(ordered) - 1) * q
    low = math.floor(position)
    high = math.ceil(position)
    if low == high:
        return ordered[low]
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def open_csv(path: Path):
    if path.suffix.lower() == ".gz":
        return gzip.open(path, "rt", encoding="utf-8-sig", newline="")
    return path.open("r", encoding="utf-8-sig", newline="")


def write_summary(path: Path, groups, min_sample: int, group_name: str, year_min: int, year_max: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        group_name, *( ["state"] if group_name == "city" else [] ),
        "installation_year_min", "installation_year_max", "n",
        "median_nominal_usd_per_w_dc", "p25_nominal_usd_per_w_dc",
        "p75_nominal_usd_per_w_dc", "p10_nominal_usd_per_w_dc",
        "p90_nominal_usd_per_w_dc", "source_city_spelling_variants",
        "publication_status",
    ]
    count_written = 0
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for key in sorted(groups):
            values, display_name, variants = groups[key]
            if len(values) < min_sample:
                continue
            writer.writerow({
                group_name: display_name,
                **({"state": key[0]} if group_name == "city" else {}),
                "installation_year_min": year_min,
                "installation_year_max": year_max,
                "n": len(values),
                "median_nominal_usd_per_w_dc": round(statistics.median(values), 3),
                "p25_nominal_usd_per_w_dc": round(quantile(values, .25), 3),
                "p75_nominal_usd_per_w_dc": round(quantile(values, .75), 3),
                "p10_nominal_usd_per_w_dc": round(quantile(values, .10), 3),
                "p90_nominal_usd_per_w_dc": round(quantile(values, .90), 3),
                "source_city_spelling_variants": len(variants),
                "publication_status": "RESEARCH_ONLY_LICENSE_AND_EXTERNAL_VALIDATION_HOLD",
            })
            count_written += 1
    return count_written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Locally downloaded LBNL public CSV or .csv.gz")
    parser.add_argument("--output", default=Path("berkeley-solar-city-summary.csv"), type=Path, help="City/state summary output")
    parser.add_argument("--state-output", default=Path("berkeley-solar-state-summary.csv"), type=Path)
    parser.add_argument("--coverage-output", default=Path("berkeley-solar-city-coverage.csv"), type=Path)
    parser.add_argument("--min-city-sample", type=int, default=100)
    parser.add_argument("--min-state-sample", type=int, default=500)
    parser.add_argument("--min-install-year", type=int, default=2024)
    parser.add_argument("--max-install-year", type=int, default=2025)
    parser.add_argument("--min-size-kw", type=float, default=1.0)
    parser.add_argument("--max-size-kw", type=float, default=25.0)
    args = parser.parse_args()
    if not args.input.exists():
        parser.error(f"Input file not found: {args.input}")
    if args.min_city_sample < 50:
        parser.error("--min-city-sample must be at least 50; 100+ is more prudent for city estimates.")
    if args.min_state_sample < 100:
        parser.error("--min-state-sample must be at least 100.")
    if args.min_install_year < 1990 or args.max_install_year > 2100 or args.min_install_year > args.max_install_year:
        parser.error("Installation-year range must be valid and min year must not exceed max year.")
    if not (0 < args.min_size_kw < args.max_size_kw <= 100):
        parser.error("System-size window must be positive, ordered and no larger than 100 kW DC.")

    city_groups: dict[tuple[str, str], tuple[array, str, set[str]]] = {}
    state_groups: dict[str, tuple[array, str, set[str]]] = {}
    reasons: Counter[str] = Counter()
    city_coverage: Counter[tuple[str, str]] = Counter()
    residential_candidates = 0
    residential_segment_counts: Counter[str] = Counter()
    eligible = 0
    years_seen: Counter[int] = Counter()

    with open_csv(args.input) as stream:
        reader = csv.DictReader(stream)
        fields = set(reader.fieldnames or [])
        missing = sorted(REQUIRED - fields)
        if missing:
            parser.error("The downloaded file is missing expected guide fields: " + ", ".join(missing))
        for row in reader:
            segment = (row.get("customer_segment") or "").strip().upper()
            if segment not in {"RES", "RES_SF"}:
                reasons["not_single_family_or_unspecified_residential_segment"] += 1
                continue
            residential_candidates += 1
            residential_segment_counts[segment] += 1

            year = installation_year(row.get("installation_date"))
            if year is None:
                reasons["missing_or_invalid_installation_date"] += 1
                continue
            if year < args.min_install_year or year > args.max_install_year:
                reasons["outside_installation_year_window"] += 1
                continue

            if (row.get("technology_type") or "").strip().upper() != "PV-ONLY":
                reasons["not_pv_only_or_missing_technology"] += 1
                continue
            if (row.get("ground_mounted") or "").strip().lower() not in FALSE_VALUES:
                reasons["ground_mounted_or_unknown"] += 1
                continue

            reported_tpo = flag(row.get("third_party_owned"))
            inferred_tpo = flag(row.get("third_party_owned_inferred"))
            if reported_tpo is True or inferred_tpo is True:
                reasons["third_party_owned_confirmed"] += 1
                continue
            # Require both reported and inferred ownership flags to explicitly
            # say host/customer-owned. One known-false plus one unknown is not
            # enough to prove a cash/host-owned retail price cohort.
            if reported_tpo is not False or inferred_tpo is not False:
                reasons["third_party_ownership_unknown"] += 1
                continue
            if flag(row.get("self_installed")) is not False:
                reasons["self_install_true_or_unknown"] += 1
                continue
            if flag(row.get("expansion_system")) is not False:
                reasons["expansion_true_or_unknown"] += 1
                continue
            if flag(row.get("multiple_phase_system")) is not False:
                reasons["multiple_phase_true_or_unknown"] += 1
                continue

            kw = num(row.get("PV_system_size_DC"))
            price = num(row.get("total_installed_price"))
            if kw is None or not (args.min_size_kw <= kw <= args.max_size_kw):
                reasons["missing_or_out_of_range_dc_kw"] += 1
                continue
            if price is None or price <= 0:
                reasons["missing_or_nonpositive_installed_price"] += 1
                continue
            state = (row.get("state") or "").strip().upper()
            if state not in VALID_US_STATE_CODES:
                reasons["missing_or_invalid_state"] += 1
                continue
            price_per_watt = price / (kw * 1000.0)
            if not math.isfinite(price_per_watt) or price_per_watt <= 0:
                reasons["invalid_price_per_watt"] += 1
                continue

            if state not in state_groups:
                state_groups[state] = (array("d"), state, set())
            state_groups[state][0].append(price_per_watt)

            city = (row.get("city") or "").strip()
            if city and city.lower() not in MISSING:
                key = (state, city_key(city))
                if key not in city_groups:
                    city_groups[key] = (array("d"), city, set())
                city_groups[key][0].append(price_per_watt)
                city_groups[key][2].add(city)
                city_coverage[key] += 1
            else:
                reasons["missing_city_after_other_filters"] += 1
            years_seen[year] += 1
            eligible += 1

    city_written = write_summary(args.output, city_groups, args.min_city_sample, "city", args.min_install_year, args.max_install_year)
    state_written = write_summary(args.state_output, state_groups, args.min_state_sample, "state", args.min_install_year, args.max_install_year)

    args.coverage_output.parent.mkdir(parents=True, exist_ok=True)
    with args.coverage_output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["city", "state", "n", "meets_minimum_sample", "publication_status"])
        writer.writeheader()
        for (state, key), count in sorted(city_coverage.items()):
            variants = city_groups[(state, key)][2]
            display = sorted(variants, key=str.casefold)[0]
            writer.writerow({
                "city": display,
                "state": state,
                "n": count,
                "meets_minimum_sample": count >= args.min_city_sample,
                "publication_status": "RESEARCH_ONLY_LICENSE_AND_EXTERNAL_VALIDATION_HOLD",
            })

    print(f"Residential candidates (RES/RES_SF): {residential_candidates:,}")
    print("Residential customer_segment code counts: " + str(dict(sorted(residential_segment_counts.items()))))
    print(f"Rows passing strict homeowner cohort: {eligible:,}; installation years retained: {args.min_install_year}–{args.max_install_year}")
    print(f"Installation-year counts: {dict(sorted(years_seen.items()))}")
    print(f"City/state groups with at least {args.min_city_sample} eligible rows: {city_written}")
    print(f"States with at least {args.min_state_sample} eligible rows: {state_written}")
    print(f"States with any strictly eligible project rows before state suppression: {len(state_groups)}")
    print("STATE_ELIGIBLE_SAMPLE_COUNTS_BEFORE_MINIMUM_N:")
    for state, (values, _display, _variants) in sorted(
        state_groups.items(), key=lambda item: (-len(item[1][0]), item[0])
    ):
        print(f"  {state}: n={len(values)}; meets_n{args.min_state_sample}={len(values) >= args.min_state_sample}")
    city_group_counts = [len(group[0]) for group in city_groups.values()]
    print(f"CITY_GROUPS_WITH_ANY_STRICTLY_ELIGIBLE_ROWS: {len(city_group_counts)}")
    print("CITY_SAMPLE_COVERAGE_BY_THRESHOLD: " + str({
        threshold: sum(n >= threshold for n in city_group_counts)
        for threshold in (50, 100, 200, 500)
    }))
    print("STATE_SAMPLE_COVERAGE_BY_THRESHOLD: " + str({
        threshold: sum(len(group[0]) >= threshold for group in state_groups.values())
        for threshold in (100, 250, 500, 1000)
    }))
    print(f"City summary: {args.output}")
    print(f"State fallback summary: {args.state_output}")
    print(f"City coverage diagnostics: {args.coverage_output}")
    print("Strict filters: PV-only; rooftop only; RES/RES_SF; 1–25 kW DC by default; 2024–2025 by default; explicitly non-TPO (reported or inferred); explicitly not self-installed; explicitly not expansion; explicitly not multi-phase.")
    print("RES is residential with no single-family/multifamily subtype specified by the provider; RES_SF is known residential single-family; RES_MF is excluded.")
    print("Filter counts:")
    for name, count in sorted(reasons.items()):
        print(f"  {name}: {count:,}")
    print("RESEARCH LIMITS:")
    print("- This is a filtered project-level sample from contributing programmes and utilities, not a probability sample of all U.S. installations.")
    print("- The 2026 guide defines total_installed_price as pre-incentive dollars reported by the installer, host customer or incentive applicant. It may be estimated and is not an independently verified current cash quote.")
    print("- RES includes residential with no single-family/multifamily subtype supplied; RES_SF is explicit single-family and RES_MF is explicit multifamily. RES+RES_SF is not a pure single-family cohort.")
    print("- The guide warns installation_date may be a proxy such as an incentive-claim or inspection date; the selected 2024–2025 window is therefore a provider-reported date window, not an independently verified installation-date census.")
    print("- A recent installation-year window reduces stale-price mixing but does not inflation-adjust values or make them current quotes.")
    print("- City names receive only conservative cosmetic normalization; genuine aliases are not merged. A city may have incomplete provider coverage.")
    print("- City medians/quartiles are descriptive historical reference distributions. They do not account fully for roof, equipment, utility, permitting, financing or contractor scope differences.")
    print("- Do not commercially publish derived city/state numbers until LBNL confirms the current data-file reuse terms and an independent reviewer approves the method.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
