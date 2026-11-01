#!/usr/bin/env python3
"""Research-only national and Top 15 metro roofing summaries from the 2023 AHS relational PUF.

Use the 2023 National PUF PROJECT and HOUSEHOLD CSV files from the same release. The
HOUSEHOLD file must include OMB13CBSA; only the 15 named 2013 CBSA codes are
reported as metro groups. This is metro geography, not individual-city geography.
The PUF stores home-improvement jobs as generic JOBTYPE/JOBCOST/JOBDIY records;
the questionnaire-specific ROOFAM/ROOFWK fields are not the PUF project schema.

Pass --roof-job-type-code only after verifying the code in the official 2023
Value Labels Package. The research script deliberately mirrors an AHS
C-16-OO-style PUF universe: interviewed owner-occupied households,
JOBDIY in {1,2}, and JOBCOST >= 0. It includes Census-edited/imputed values and
therefore is not a raw-response-only contractor-price sample.

Outputs are exploratory weighted summaries with Fay-BRR replicate SEs and
approximate 90% normal intervals. Do not publish the PUF estimates until they
are independently reconciled against Census's Table Specifications workbook.
"""
from __future__ import annotations
import argparse
import csv
import math
from pathlib import Path

MISSING = {"", "-1", "-1.0", "-9", "-9.0", "-6", "-6.0", "na", "n/a", "null", "none"}
REPLICATE_COUNT = 160
BRR_FAY_FACTOR = 4.0 / REPLICATE_COUNT
Z_90 = 1.6448536269514722

# 2013 OMB CBSA codes used by the 2023 AHS National PUF for the Top 15 metros.
# Source: Census Bureau, Metropolitan Area Histories: 2015 to 2023.
METRO_NAMES = {
    "12060": "Atlanta-Sandy Springs-Roswell, GA",
    "14460": "Boston-Cambridge-Newton, MA-NH",
    "16980": "Chicago-Naperville-Elgin, IL-IN-WI",
    "19100": "Dallas-Fort Worth-Arlington, TX",
    "19820": "Detroit-Warren-Dearborn, MI",
    "26420": "Houston-The Woodlands-Sugar Land, TX",
    "31080": "Los Angeles-Long Beach-Anaheim, CA",
    "33100": "Miami-Fort Lauderdale-West Palm Beach, FL",
    "35620": "New York-Newark-Jersey City, NY-NJ-PA",
    "37980": "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD",
    "38060": "Phoenix-Mesa-Scottsdale, AZ",
    "40140": "Riverside-San Bernardino-Ontario, CA",
    "41860": "San Francisco-Oakland-Hayward, CA",
    "42660": "Seattle-Tacoma-Bellevue, WA",
    "47900": "Washington-Arlington-Alexandria, DC-VA-MD-WV",
}


def clean_token(raw: str | None) -> str:
    value = (raw or "").strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1].strip()
    return value


def to_num(raw: str | None) -> float | None:
    token = clean_token(raw).lower()
    if token in MISSING:
        return None
    try:
        value = float(token)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def wquantile(pairs: list[tuple[float, float]], q: float) -> float | None:
    ordered = sorted((value, weight) for value, weight in pairs if weight > 0)
    total = sum(weight for _, weight in ordered)
    if not ordered or not math.isfinite(total) or total <= 0:
        return None
    target = total * q
    cumulative = 0.0
    for value, weight in ordered:
        cumulative += weight
        if cumulative >= target:
            return value
    return ordered[-1][0]


def weighted_mean_with_brr(
    records: list[tuple[float, float, tuple[float, ...]]]
) -> tuple[float, float, float, float] | None:
    total_weight = sum(weight for _, weight, _ in records if weight > 0)
    if not records or total_weight <= 0:
        return None
    point = sum(cost * weight for cost, weight, _ in records if weight > 0) / total_weight
    replicate_estimates: list[float] = []
    for replicate_index in range(REPLICATE_COUNT):
        rep_total = sum(rep[replicate_index] for _, _, rep in records if rep[replicate_index] > 0)
        if rep_total <= 0:
            return None
        rep_mean = sum(cost * rep[replicate_index] for cost, _, rep in records if rep[replicate_index] > 0) / rep_total
        replicate_estimates.append(rep_mean)
    variance = BRR_FAY_FACTOR * sum((estimate - point) ** 2 for estimate in replicate_estimates)
    se = math.sqrt(max(0.0, variance))
    return point, se, max(0.0, point - Z_90 * se), point + Z_90 * se


def weighted_quantile_with_brr(
    records: list[tuple[float, float, tuple[float, ...]]], q: float
) -> tuple[float, float, float, float] | None:
    point = wquantile([(cost, weight) for cost, weight, _ in records], q)
    if point is None:
        return None
    replicate_estimates: list[float] = []
    for replicate_index in range(REPLICATE_COUNT):
        estimate = wquantile([
            (cost, replicate_weights[replicate_index])
            for cost, _, replicate_weights in records
        ], q)
        if estimate is None:
            return None
        replicate_estimates.append(estimate)
    variance = BRR_FAY_FACTOR * sum((estimate - point) ** 2 for estimate in replicate_estimates)
    se = math.sqrt(max(0.0, variance))
    return point, se, max(0.0, point - Z_90 * se), point + Z_90 * se


def read_household_weights(path: Path, weight_field: str, replicate_prefix: str, metro_field: str) -> dict[str, tuple[float, tuple[float, ...], bool, str]]:
    replicate_fields = [f"{replicate_prefix}{index}" for index in range(1, REPLICATE_COUNT + 1)]
    weights: dict[str, tuple[float, tuple[float, ...], bool, str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        fields = set(reader.fieldnames or [])
        required = {"CONTROL", "TENURE", "INTSTATUS", weight_field, metro_field, *replicate_fields}
        missing = required - fields
        if missing:
            raise ValueError("Household CSV is missing required fields: " + ", ".join(sorted(missing)))
        for row in reader:
            control = clean_token(row.get("CONTROL"))
            if not control:
                continue
            if control in weights:
                raise ValueError(f"Duplicate CONTROL in household file: {control}")
            tenure = to_num(row.get("TENURE"))
            interview_status = to_num(row.get("INTSTATUS"))
            is_eligible_owner = tenure == 1 and interview_status == 1
            weight = to_num(row.get(weight_field))
            if weight is None or weight <= 0:
                # Retain the household key so an eligible project cannot silently
                # be counted as a mere unmatched household.
                weights[control] = (0.0, tuple(), False, clean_token(row.get(metro_field)))
                continue
            replicate_values: list[float] = []
            for field in replicate_fields:
                value = to_num(row.get(field))
                if value is None or value < 0:
                    raise ValueError(f"Household {control} has a missing/invalid {field}; refusing incomplete BRR variance.")
                replicate_values.append(value)
            weights[control] = (weight, tuple(replicate_values), is_eligible_owner, clean_token(row.get(metro_field)))
    return weights


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-input", required=True, type=Path, help="2023 National PUF relational PROJECT CSV")
    parser.add_argument("--household-input", required=True, type=Path, help="Matching 2023 National PUF relational HOUSEHOLD CSV (must include OMB13CBSA)")
    parser.add_argument("--output", default=Path("ahs-roof-national-research.csv"), type=Path)
    parser.add_argument("--metro-output", default=Path("ahs-roof-metro-research.csv"), type=Path, help="Research-only Top 15 metro summaries using OMB13CBSA")
    parser.add_argument("--metro-field", default="OMB13CBSA", help="2013 OMB CBSA code field in the household file")
    parser.add_argument("--minimum-metro-unweighted-n", type=int, default=30, help="Suppress metro/group rows below this raw project count")
    parser.add_argument("--weight-field", default="WEIGHT", help="Household final weight; verify against the 2023 codebook")
    parser.add_argument("--replicate-prefix", default="REPWEIGHT", help="Household replicate weight prefix (default REPWEIGHT1..160)")
    parser.add_argument("--roof-job-type-code", type=int, required=True, help="AHS JOBTYPE code for roofing, verified against the official 2023 Value Labels Package")
    parser.add_argument("--minimum-unweighted-n", type=int, default=100)
    args = parser.parse_args()
    for path in (args.project_input, args.household_input):
        if not path.exists():
            parser.error(f"Input file not found: {path}")
    if args.minimum_unweighted_n < 30:
        parser.error("--minimum-unweighted-n must be at least 30 for exploratory screening")
    if args.minimum_metro_unweighted_n < 30:
        parser.error("--minimum-metro-unweighted-n must be at least 30")
    if not args.metro_field or not args.metro_field.replace("_", "").isalnum():
        parser.error("--metro-field must be a valid alphanumeric PUF field name")
    if args.roof_job_type_code < 1:
        parser.error("--roof-job-type-code must be a positive code verified from the official AHS value labels")

    try:
        weights = read_household_weights(args.household_input, args.weight_field, args.replicate_prefix, args.metro_field)
    except ValueError as error:
        parser.error(str(error))

    required = {"CONTROL", "JOBTYPE", "JOBCOST", "JOBDIY"}
    groups: dict[str, list[tuple[float, float, tuple[float, ...]]]] = {
        "all_roofing_projects": [],
        "household_did_most_work_JOBDIY_1": [],
        "household_did_not_do_most_work_JOBDIY_2": [],
    }
    metro_groups: dict[str, dict[str, list[tuple[float, float, tuple[float, ...]]]]] = {}
    metro_project_counts: dict[str, int] = {code: 0 for code in METRO_NAMES}
    counters = {
        "project_rows": 0, "other_job_types": 0, "jobdiy_not_1_or_2": 0,
        "missing_or_negative_cost": 0, "zero_cost": 0, "owner_occupancy_or_interview_excluded": 0,
        "missing_or_invalid_household_weight": 0, "unmatched_household": 0,
    }

    with args.project_input.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        fields = set(reader.fieldnames or [])
        missing = sorted(required - fields)
        if missing:
            parser.error("Project CSV is missing required PUF fields: " + ", ".join(missing) + ". Use relational PROJECT.csv.")
        for row in reader:
            counters["project_rows"] += 1
            job_type = to_num(row.get("JOBTYPE"))
            if job_type != args.roof_job_type_code:
                counters["other_job_types"] += 1
                continue
            diy_status = to_num(row.get("JOBDIY"))
            if diy_status not in (1, 2):
                counters["jobdiy_not_1_or_2"] += 1
                continue
            cost = to_num(row.get("JOBCOST"))
            if cost is None or cost < 0:
                counters["missing_or_negative_cost"] += 1
                continue
            if cost == 0:
                counters["zero_cost"] += 1
            control = clean_token(row.get("CONTROL"))
            joined = weights.get(control)
            if not control or joined is None:
                counters["unmatched_household"] += 1
                continue
            weight, replicate_weights, eligible_owner, metro_code = joined
            if not eligible_owner:
                counters["owner_occupancy_or_interview_excluded"] += 1
                continue
            if weight <= 0 or len(replicate_weights) != REPLICATE_COUNT:
                counters["missing_or_invalid_household_weight"] += 1
                continue
            record = (cost, weight, replicate_weights)
            groups["all_roofing_projects"].append(record)
            if diy_status == 1:
                groups["household_did_most_work_JOBDIY_1"].append(record)
            else:
                groups["household_did_not_do_most_work_JOBDIY_2"].append(record)

            if metro_code in METRO_NAMES:
                metro_project_counts[metro_code] += 1
                if metro_code not in metro_groups:
                    metro_groups[metro_code] = {
                        "all_roofing_projects": [],
                        "household_did_most_work_JOBDIY_1": [],
                        "household_did_not_do_most_work_JOBDIY_2": [],
                    }
                metro_groups[metro_code]["all_roofing_projects"].append(record)
                if diy_status == 1:
                    metro_groups[metro_code]["household_did_most_work_JOBDIY_1"].append(record)
                else:
                    metro_groups[metro_code]["household_did_not_do_most_work_JOBDIY_2"].append(record)

    out_fields = ["group", "unweighted_n", "weighted_project_count"]
    for label in ("mean", "median", "p25", "p75"):
        out_fields.extend([f"{label}_nominal_survey_usd", f"{label}_replicate_se_usd", f"{label}_90ci_low_usd", f"{label}_90ci_high_usd"])
    out_fields.append("publication_status")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=out_fields)
        writer.writeheader()
        for group, records in groups.items():
            if len(records) < args.minimum_unweighted_n:
                continue
            out: dict[str, object] = {
                "group": group,
                "unweighted_n": len(records),
                "weighted_project_count": round(sum(weight for _, weight, _ in records)),
                "publication_status": "RESEARCH_ONLY_INCLUDES_CENSUS_EDITED_OR_IMPUTED_VALUES_NOT_RECONCILED",
            }
            metric_results = [("mean", weighted_mean_with_brr(records))]
            metric_results.extend((label, weighted_quantile_with_brr(records, q)) for label, q in (("median", .5), ("p25", .25), ("p75", .75)))
            for label, result in metric_results:
                if result is None:
                    for suffix in ("nominal_survey_usd", "replicate_se_usd", "90ci_low_usd", "90ci_high_usd"):
                        out[f"{label}_{suffix}"] = ""
                else:
                    point, se, low, high = result
                    out[f"{label}_nominal_survey_usd"] = round(point, 0)
                    out[f"{label}_replicate_se_usd"] = round(se, 0)
                    out[f"{label}_90ci_low_usd"] = round(low, 0)
                    out[f"{label}_90ci_high_usd"] = round(high, 0)
            writer.writerow(out)

    metro_fields = ["metro_omb13cbsa", "metro_name", *out_fields]
    args.metro_output.parent.mkdir(parents=True, exist_ok=True)
    with args.metro_output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=metro_fields)
        writer.writeheader()
        for metro_code, metro_name in METRO_NAMES.items():
            for group, records in metro_groups.get(metro_code, {}).items():
                if len(records) < args.minimum_metro_unweighted_n:
                    continue
                out: dict[str, object] = {
                    "metro_omb13cbsa": metro_code,
                    "metro_name": metro_name,
                    "group": group,
                    "unweighted_n": len(records),
                    "weighted_project_count": round(sum(weight for _, weight, _ in records)),
                    "publication_status": "RESEARCH_ONLY_INCLUDES_CENSUS_EDITED_OR_IMPUTED_VALUES_NOT_RECONCILED",
                }
                metric_results = [("mean", weighted_mean_with_brr(records))]
                metric_results.extend((label, weighted_quantile_with_brr(records, q)) for label, q in (("median", .5), ("p25", .25), ("p75", .75)))
                for label, result in metric_results:
                    if result is None:
                        for suffix in ("nominal_survey_usd", "replicate_se_usd", "90ci_low_usd", "90ci_high_usd"):
                            out[f"{label}_{suffix}"] = ""
                    else:
                        point, se, low, high = result
                        out[f"{label}_nominal_survey_usd"] = round(point, 0)
                        out[f"{label}_replicate_se_usd"] = round(se, 0)
                        out[f"{label}_90ci_low_usd"] = round(low, 0)
                        out[f"{label}_90ci_high_usd"] = round(high, 0)
                writer.writerow(out)

    print(f"Project rows scanned: {counters['project_rows']:,}; JOBTYPE {args.roof_job_type_code} eligible roofing jobs summarized: {len(groups['all_roofing_projects']):,}")
    print(f"Top 15 AHS metro codes with eligible roofing projects: {sum(1 for count in metro_project_counts.values() if count):,}; metro summary: {args.metro_output}")
    print(f"Zero-cost projects included: {counters['zero_cost']:,}; missing/negative costs: {counters['missing_or_negative_cost']:,}; JOBDIY outside 1/2: {counters['jobdiy_not_1_or_2']:,}")
    for name, count in counters.items():
        if name != "project_rows":
            print(f"{name}: {count:,}")
    print("RESEARCH LIMITS:")
    print("- The AHS 2023 Census infographic reports a $10,000 national roofing median for projects in 2021-2023; this PUF output must be reconciled against the official Table Specifications workbook before use.")
    print("- The roofing JOBTYPE code is supplied explicitly and must be verified against the official 2023 Value Labels Package; this script does not assume code 16.")
    print("- JOBDIY groups are descriptive and include Census-edited/imputed responses; JOBDIY itself is imputed for some records.")
    print("- JOBCOST is Census hot-deck imputed for some records. This is not a raw-response-only sample or a contractor-invoice dataset.")
    print("- Costs are whole-project nominal survey dollars for the AHS two-year reference window, roughly 2021-2023; no inflation conversion is applied.")
    print("- This survey does not provide roof size, material, pitch, tear-off layers, or cost per roofing square; do not convert the amount to $/sq ft.")
    print("- Weighted quantile and Fay-BRR intervals remain exploratory until reconciled with Census's official output and variance method.")
    print("- The optional metro output groups only the 15 named 2013 OMB CBSA codes in the 2023 National PUF; it is metro geography, not city pricing.")
    print("- Metro groups below the configured raw project threshold are suppressed; an unweighted n threshold is not proof of estimate precision.")
    print("- Do not publish the national or metro PUF outputs until reconciled against official Census Table C-16 estimates and margins of error.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
