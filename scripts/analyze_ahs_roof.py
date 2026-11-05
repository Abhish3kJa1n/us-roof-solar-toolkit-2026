#!/usr/bin/env python3
"""Research-only AHS 2023 whole-project roofing summaries from relational PUFs.

Run the integrated National PUF for National/Top-15 analysis and the separate
Metropolitan PUF for the five Next-10 areas actually sampled in 2023. Never
pool their PROJECT/HOUSEHOLD records or weights. Join each PUF's project rows
to its own household table by CONTROL.

The official 2023 Value Labels package identifies JOBTYPE='16' as added or
replaced roofing, JOBDIY='1' as Do-It-Yourself and JOBDIY='2' as Professional.
The C-16-OO owner-occupied/interviewed universe uses TENURE=1 and INTSTATUS=1.
Project counts, positive-cost statistics and total expenditures use different
JOBCOST universes and are kept separate.

A household can contribute multiple project records (up to 26 in the PUF).
Therefore outputs distinguish project rows from distinct respondent housing units.
Fay-BRR estimates use the 160 replicate weights and multiplier 4/160. Results
remain research-only: whole-project nominal survey dollars, not contractor
invoices, consistent full tear-off scope or $/sq-ft costs. Census identifies
material 2023 nonresponse risk in the independent Metro sample."""
from __future__ import annotations
import argparse
import csv
import math
from pathlib import Path

MISSING = {"", "-1", "-1.0", "-9", "-9.0", "-6", "-6.0", "na", "n/a", "null", "none"}
REPLICATE_COUNT = 160
BRR_FAY_FACTOR = 4.0 / REPLICATE_COUNT
Z_90 = 1.6448536269514722

# 2013 OMB CBSA codes used by the National PUF Top 15 and the five Next-10
# metropolitan areas actually sampled in the separate 2023 Metropolitan PUF.
# The five Next-10 names are from the 2023 Census AHS Metropolitan Sample Design.
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
    "17140": "Cincinnati, OH-KY-IN",
    "17460": "Cleveland-Elyria, OH",
    "19740": "Denver-Aurora-Lakewood, CO",
    "33340": "Milwaukee-Waukesha-West Allis, WI",
    "35380": "New Orleans-Metairie, LA",
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


def weighted_sum_with_brr(records: list[tuple[float, float, tuple[float, ...]]]) -> tuple[float, float, float, float] | None:
    valid = [(cost, weight, reps) for cost, weight, reps in records if weight > 0]
    if not valid:
        return None
    point = sum(cost * weight for cost, weight, _ in valid)
    replicate_estimates = [sum(cost * reps[index] for cost, _, reps in valid) for index in range(REPLICATE_COUNT)]
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
    parser.add_argument("--project-input", required=True, type=Path, help="2023 AHS relational PROJECT CSV from one PUF")
    parser.add_argument("--household-input", required=True, type=Path, help="Matching 2023 AHS relational HOUSEHOLD CSV with OMB13CBSA and replicate weights")
    parser.add_argument("--output", default=Path("ahs-roof-overall-research.csv"), type=Path)
    parser.add_argument("--metro-output", default=Path("ahs-roof-metro-research.csv"), type=Path, help="Research-only CBSA summaries from this PUF only")
    parser.add_argument("--sample-source", default="unspecified PUF", help="Explicit provenance label for the PUF used by this run")
    parser.add_argument("--metro-field", default="OMB13CBSA", help="2013 OMB CBSA code field in the household file")
    parser.add_argument("--minimum-metro-unweighted-n", type=int, default=30, help="Exploratory minimum distinct respondent housing units per metro/group")
    parser.add_argument("--weight-field", default="WEIGHT", help="Household final weight; verify against the 2023 codebook")
    parser.add_argument("--replicate-prefix", default="REPWEIGHT", help="Household replicate weight prefix (default REPWEIGHT1..160)")
    parser.add_argument("--roof-job-type-code", type=int, required=True, help="AHS JOBTYPE code for roofing, verified against the official 2023 Value Labels Package")
    parser.add_argument("--minimum-unweighted-n", type=int, default=100, help="Exploratory minimum distinct respondent housing units per overall group")
    args = parser.parse_args()
    for path in (args.project_input, args.household_input):
        if not path.exists():
            parser.error(f"Input file not found: {path}")
    if args.minimum_unweighted_n < 30:
        parser.error("--minimum-unweighted-n must be at least 30 distinct respondent housing units")
    if args.minimum_metro_unweighted_n < 30:
        parser.error("--minimum-metro-unweighted-n must be at least 30 distinct respondent housing units")
    if not args.metro_field or not args.metro_field.replace("_", "").isalnum():
        parser.error("--metro-field must be a valid alphanumeric PUF field name")
    if args.roof_job_type_code < 1:
        parser.error("--roof-job-type-code must be a positive code verified from the official AHS value labels")

    try:
        weights = read_household_weights(args.household_input, args.weight_field, args.replicate_prefix, args.metro_field)
    except ValueError as error:
        parser.error(str(error))

    required = {"CONTROL", "JOBTYPE", "JOBCOST", "JOBDIY"}
    group_names = ("all_roofing_projects", "household_did_most_work_JOBDIY_1", "household_did_not_do_most_work_JOBDIY_2")
    # C-16 project counts are independent of cost validity; cost statistics use
    # positive JOBCOST, while total expenditure uses nonnegative JOBCOST.
    count_groups: dict[str, list[tuple[float, tuple[float, ...]]]] = {name: [] for name in group_names}
    count_households: dict[str, set[str]] = {name: set() for name in group_names}
    groups: dict[str, list[tuple[float, float, tuple[float, ...]]]] = {name: [] for name in group_names}
    positive_cost_households: dict[str, set[str]] = {name: set() for name in group_names}
    total_groups: dict[str, list[tuple[float, float, tuple[float, ...]]]] = {name: [] for name in group_names}
    metro_count_groups: dict[str, dict[str, list[tuple[float, tuple[float, ...]]]]] = {}
    metro_count_households: dict[str, dict[str, set[str]]] = {}
    metro_groups: dict[str, dict[str, list[tuple[float, float, tuple[float, ...]]]]] = {}
    metro_positive_cost_households: dict[str, dict[str, set[str]]] = {}
    metro_total_groups: dict[str, dict[str, list[tuple[float, float, tuple[float, ...]]]]] = {}
    metro_project_counts: dict[str, int] = {code: 0 for code in METRO_NAMES}
    counters = {
        "project_rows": 0, "other_job_types": 0, "jobdiy_not_1_or_2": 0,
        "missing_or_negative_cost": 0, "zero_cost": 0, "owner_occupancy_or_interview_excluded": 0,
        "missing_or_invalid_household_weight": 0, "unmatched_household": 0,
        "positive_cost": 0,
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

            count_record = (weight, replicate_weights)
            selected_groups = ["all_roofing_projects"]
            selected_groups.append("household_did_most_work_JOBDIY_1" if diy_status == 1 else "household_did_not_do_most_work_JOBDIY_2")
            for group in selected_groups:
                count_groups[group].append(count_record)
                count_households[group].add(control)

            if metro_code in METRO_NAMES:
                metro_project_counts[metro_code] += 1
                if metro_code not in metro_count_groups:
                    metro_count_groups[metro_code] = {name: [] for name in group_names}
                    metro_count_households[metro_code] = {name: set() for name in group_names}
                    metro_groups[metro_code] = {name: [] for name in group_names}
                    metro_positive_cost_households[metro_code] = {name: set() for name in group_names}
                    metro_total_groups[metro_code] = {name: [] for name in group_names}
                for group in selected_groups:
                    metro_count_groups[metro_code][group].append(count_record)
                    metro_count_households[metro_code][group].add(control)

            cost = to_num(row.get("JOBCOST"))
            if cost is None or cost < 0:
                counters["missing_or_negative_cost"] += 1
                continue
            if cost == 0:
                counters["zero_cost"] += 1
            else:
                counters["positive_cost"] += 1
            record = (cost, weight, replicate_weights)
            for group in selected_groups:
                total_groups[group].append(record)
                if metro_code in METRO_NAMES:
                    metro_total_groups[metro_code][group].append(record)
                if cost > 0:
                    groups[group].append(record)
                    positive_cost_households[group].add(control)
                    if metro_code in METRO_NAMES:
                        metro_groups[metro_code][group].append(record)
                        metro_positive_cost_households[metro_code][group].add(control)

    out_fields = ["sample_source", "jobdiy_scope", "group", "unweighted_n", "unweighted_housing_units_n",
        "weighted_project_count", "positive_cost_unweighted_n", "positive_cost_housing_units_n",
        "zero_cost_unweighted_n", "nonnegative_cost_unweighted_n",
        "total_expenditure_nominal_survey_usd", "total_expenditure_replicate_se_usd", "total_expenditure_90ci_low_usd", "total_expenditure_90ci_high_usd"]
    for label in ("mean", "median", "p25", "p75"):
        out_fields.extend([
            f"{label}_nominal_survey_usd", f"{label}_replicate_se_usd",
            f"{label}_cv", f"{label}_90ci_low_usd", f"{label}_90ci_high_usd",
        ])
    out_fields.extend(["precision_screen_status", "cv_screen_threshold"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=out_fields)
        writer.writeheader()
        for group in group_names:
            count_records = count_groups[group]
            positive_records = groups[group]
            nonnegative_records = total_groups[group]
            household_n = len(count_households[group])
            positive_household_n = len(positive_cost_households[group])
            if positive_household_n < args.minimum_unweighted_n:
                continue
            total_result = weighted_sum_with_brr(nonnegative_records)
            out: dict[str, object] = {
                "sample_source": args.sample_source,
                "jobdiy_scope": "diy" if group == "household_did_most_work_JOBDIY_1" else "professional" if group == "household_did_not_do_most_work_JOBDIY_2" else "professional_and_diy",
                "group": group,
                "unweighted_n": len(count_records),
                "unweighted_housing_units_n": household_n,
                "weighted_project_count": round(sum(weight for weight, _ in count_records)),
                "positive_cost_unweighted_n": len(positive_records),
                "positive_cost_housing_units_n": len(positive_cost_households[group]),
                "zero_cost_unweighted_n": sum(1 for cost, _, _ in nonnegative_records if cost == 0),
                "nonnegative_cost_unweighted_n": len(nonnegative_records),
                "total_expenditure_nominal_survey_usd": round(total_result[0]) if total_result else "",
                "total_expenditure_replicate_se_usd": round(total_result[1]) if total_result else "",
                "total_expenditure_90ci_low_usd": round(total_result[2]) if total_result else "",
                "total_expenditure_90ci_high_usd": round(total_result[3]) if total_result else "",
                "precision_screen_status": "NOT_MANUALLY_REVIEWED",
                "cv_screen_threshold": 0.30,
            }
            metric_results = [("mean", weighted_mean_with_brr(positive_records))]
            metric_results.extend((label, weighted_quantile_with_brr(positive_records, q)) for label, q in (("median", .5), ("p25", .25), ("p75", .75)))
            for label, result in metric_results:
                if result is None:
                    for suffix in ("nominal_survey_usd", "replicate_se_usd", "cv", "90ci_low_usd", "90ci_high_usd"):
                        out[f"{label}_{suffix}"] = ""
                else:
                    point, se, low, high = result
                    out[f"{label}_nominal_survey_usd"] = round(point, 0)
                    out[f"{label}_replicate_se_usd"] = round(se, 0)
                    out[f"{label}_cv"] = round(se / abs(point), 6) if point else ""
                    out[f"{label}_90ci_low_usd"] = round(low, 0)
                    out[f"{label}_90ci_high_usd"] = round(high, 0)
            cvs = [out.get(f"{metric}_cv") for metric in ("mean", "median", "p25", "p75")]
            out["precision_screen_status"] = "PASS_CV_SCREEN_NOT_MANUAL_APPROVAL" if all(isinstance(cv, (int, float)) and 0 <= cv < 0.30 for cv in cvs) else "FAIL_OR_UNDEFINED_CV_SCREEN"
            writer.writerow(out)

    metro_fields = ["metro_omb13cbsa", "metro_name", *out_fields]
    args.metro_output.parent.mkdir(parents=True, exist_ok=True)
    with args.metro_output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=metro_fields)
        writer.writeheader()
        for metro_code, metro_name in METRO_NAMES.items():
            for group in group_names:
                count_records = metro_count_groups.get(metro_code, {}).get(group, [])
                household_n = len(metro_count_households.get(metro_code, {}).get(group, set()))
                positive_records = metro_groups.get(metro_code, {}).get(group, [])
                positive_household_n = len(metro_positive_cost_households.get(metro_code, {}).get(group, set()))
                nonnegative_records = metro_total_groups.get(metro_code, {}).get(group, [])
                if positive_household_n < args.minimum_metro_unweighted_n:
                    continue
                total_result = weighted_sum_with_brr(nonnegative_records)
                out: dict[str, object] = {
                    "sample_source": args.sample_source,
                    "jobdiy_scope": "diy" if group == "household_did_most_work_JOBDIY_1" else "professional" if group == "household_did_not_do_most_work_JOBDIY_2" else "professional_and_diy",
                    "metro_omb13cbsa": metro_code, "metro_name": metro_name, "group": group,
                    "unweighted_n": len(count_records),
                    "unweighted_housing_units_n": household_n,
                    "weighted_project_count": round(sum(weight for weight, _ in count_records)),
                    "positive_cost_unweighted_n": len(positive_records),
                    "positive_cost_housing_units_n": positive_household_n,
                    "zero_cost_unweighted_n": sum(1 for cost, _, _ in nonnegative_records if cost == 0),
                    "nonnegative_cost_unweighted_n": len(nonnegative_records),
                    "total_expenditure_nominal_survey_usd": round(total_result[0]) if total_result else "",
                    "total_expenditure_replicate_se_usd": round(total_result[1]) if total_result else "",
                    "total_expenditure_90ci_low_usd": round(total_result[2]) if total_result else "",
                    "total_expenditure_90ci_high_usd": round(total_result[3]) if total_result else "",
                    "precision_screen_status": "NOT_MANUALLY_REVIEWED",
                    "cv_screen_threshold": 0.30,
                }
                metric_results = [("mean", weighted_mean_with_brr(positive_records))]
                metric_results.extend((label, weighted_quantile_with_brr(positive_records, q)) for label, q in (("median", .5), ("p25", .25), ("p75", .75)))
                for label, result in metric_results:
                    if result is None:
                        for suffix in ("nominal_survey_usd", "replicate_se_usd", "cv", "90ci_low_usd", "90ci_high_usd"):
                            out[f"{label}_{suffix}"] = ""
                    else:
                        point, se, low, high = result
                        out[f"{label}_nominal_survey_usd"] = round(point, 0)
                        out[f"{label}_replicate_se_usd"] = round(se, 0)
                        out[f"{label}_cv"] = round(se / abs(point), 6) if point else ""
                        out[f"{label}_90ci_low_usd"] = round(low, 0)
                        out[f"{label}_90ci_high_usd"] = round(high, 0)
                cvs = [out.get(f"{metric}_cv") for metric in ("mean", "median", "p25", "p75")]
                out["precision_screen_status"] = "PASS_CV_SCREEN_NOT_MANUAL_APPROVAL" if all(isinstance(cv, (int, float)) and 0 <= cv < 0.30 for cv in cvs) else "FAIL_OR_UNDEFINED_CV_SCREEN"
                writer.writerow(out)

    print(f"SAMPLE_SOURCE: {args.sample_source}")
    print(f"Project rows scanned: {counters['project_rows']:,}; eligible roofing project records: {len(count_groups['all_roofing_projects']):,}; distinct respondent housing units: {len(count_households['all_roofing_projects']):,}")
    print(f"Supported 2013 OMB CBSA codes present in this PUF: {sum(1 for count in metro_project_counts.values() if count):,}; metro summary: {args.metro_output}")
    print(f"Positive JOBCOST rows for mean/median: {counters['positive_cost']:,}; zero-cost records retained in count/total: {counters['zero_cost']:,}; missing/negative-cost records retained in count but excluded from cost metrics: {counters['missing_or_negative_cost']:,}; JOBDIY outside 1/2: {counters['jobdiy_not_1_or_2']:,}")
    for name, count in counters.items():
        if name != "project_rows":
            print(f"{name}: {count:,}")
    print("RESEARCH LIMITS:")
    print("- The AHS 2023 Census infographic reports a $10,000 national roofing median for projects in 2021-2023; this PUF output must be reconciled against the official Table Specifications workbook before use.")
    print("- The official 2023 Value Labels package confirms JOBTYPE='16' is Added or replaced roofing.")
    print("- JOBDIY='2' is Professional; JOBDIY='1' is Do-It-Yourself. Census editing/imputation affects some records.")
    print("- JOBCOST is Census hot-deck imputed for some records. This is not a raw-response-only sample or a contractor-invoice dataset.")
    print("- Costs are whole-project nominal survey dollars for the AHS two-year reference window, roughly 2021-2023; no inflation conversion is applied.")
    print("- This survey does not provide roof size, material, pitch, tear-off layers, or cost per roofing square; do not convert the amount to $/sq ft.")
    print("- C-16 project counts include eligible projects regardless of cost validity; means/medians/quantiles use JOBCOST > 0; total expenditure uses JOBCOST >= 0.")
    print("- A household may contribute multiple project records (up to 26 in the PUF); outputs report project rows and distinct contributing households separately.")
    print("- The 30% relative-standard-error screen follows the AHS Table Creator's published cell-suppression rule; a passing PUF CV screen is not equivalent to Census Table Creator approval.")
    print("- Every PUF run is source-specific. The National PUF represents national/Top-15 use; the separate Metropolitan PUF is used for the five Next-10 metro areas sampled in 2023. Their records and household weights are never pooled.")
    print("- The 2023 independent Metro sample had a 59.2% unit nonresponse rate. Census warns that response rates below 60% may create serious nonsampling quality issues and that nonresponse weighting may not fully remove the risk.")
    print("- AHS costs are nominal whole-project survey expenditures, not verified contractor invoices or consistent full tear-off scopes. Roof area, material, pitch and $/sq-ft denominators are not provided.")
    print("- Overall and metro cost distributions are screened using distinct housing units with positive JOBCOST; raw project counts and all-project housing-unit counts remain separately reported.")
    print("- The configured distinct positive-cost housing-unit floor is an internal screen, not a Census disclosure rule or proof of statistical precision.")
    print("- No result is approved for public release. Metric-specific CVs, source-specific response risk, geography crosswalk and manual review are still required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
