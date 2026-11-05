#!/usr/bin/env python3
"""Test data research scripts against small synthetic CSV fixtures (not source data)."""
from __future__ import annotations
import csv
import runpy
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(args):
    result = subprocess.run([sys.executable, *map(str, args)], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        print(result.stdout); print(result.stderr, file=sys.stderr)
        raise SystemExit(result.returncode)
    return result.stdout

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    berkeley = tmp / "berkeley.csv"
    berkeley_fields = [
        "PV_system_size_DC", "total_installed_price", "customer_segment",
        "ground_mounted", "technology_type", "state", "city", "installation_date",
        "third_party_owned", "third_party_owned_inferred", "self_installed",
        "expansion_system", "multiple_phase_system",
    ]
    with berkeley.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=berkeley_fields)
        w.writeheader()
        # Two city spelling variants normalize to one city/state group.
        records = []
        for i in range(100):
            records.append({
                "PV_system_size_DC": str(5 + (i % 3)),
                "total_installed_price": str(15000 + (i % 3) * 1000),
                "customer_segment": "RES_SF", "ground_mounted": "0",
                "technology_type": "PV-only", "state": "TX",
                "city": "Austin" if i < 50 else "AUSTIN",
                "installation_date": "2024-06-15",
                "third_party_owned": "0", "third_party_owned_inferred": "0",
                "self_installed": "0", "expansion_system": "0", "multiple_phase_system": "0",
            })
        # Strict filter edge cases: missing/unknown ownership, TPO, self-install,
        # expansion, multi-phase, ground-mount, non-residential, stale and missing date.
        base = dict(records[0])
        cases = [
            {**base, "ground_mounted": "1"},
            {**base, "customer_segment": "COM"},
            {**base, "installation_date": "2022-06-15"},
            {**base, "installation_date": "-1"},
            {**base, "third_party_owned": "1"},
            {**base, "third_party_owned": "-1", "third_party_owned_inferred": "-1"},
            {**base, "third_party_owned": "0", "third_party_owned_inferred": "-1"},
            {**base, "self_installed": "1"},
            {**base, "expansion_system": "1"},
            {**base, "multiple_phase_system": "1"},
            {**base, "city": ""},
        ]
        w.writerows(records + cases)
    output = tmp / "berkeley-city-out.csv"
    state_output = tmp / "berkeley-state-out.csv"
    coverage_output = tmp / "berkeley-coverage-out.csv"
    stdout = run([
        ROOT / "scripts/analyze_berkeley_solar.py", "--input", berkeley,
        "--output", output, "--state-output", state_output,
        "--coverage-output", coverage_output, "--min-city-sample", "50",
        "--min-state-sample", "100",
    ])
    with output.open(encoding="utf-8") as f:
        city_rows = list(csv.DictReader(f))
    with state_output.open(encoding="utf-8") as f:
        state_rows = list(csv.DictReader(f))
    with coverage_output.open(encoding="utf-8") as f:
        coverage_rows = list(csv.DictReader(f))
    assert len(city_rows) == 1 and city_rows[0]["city"] in {"Austin", "AUSTIN"}
    assert city_rows[0]["state"] == "TX" and city_rows[0]["n"] == "100"
    assert city_rows[0]["source_city_spelling_variants"] == "2"
    assert city_rows[0]["installation_year_min"] == "2024" and city_rows[0]["installation_year_max"] == "2025"
    assert city_rows[0]["publication_status"] == "RESEARCH_ONLY_LICENSE_AND_EXTERNAL_VALIDATION_HOLD"
    assert len(state_rows) == 1 and state_rows[0]["state"] == "TX"
    assert len(coverage_rows) == 1 and coverage_rows[0]["meets_minimum_sample"] == "True"
    assert "third_party_owned_confirmed: 1" in stdout
    assert "third_party_ownership_unknown: 2" in stdout
    assert "self_install_true_or_unknown: 1" in stdout
    assert "expansion_true_or_unknown: 1" in stdout
    assert "multiple_phase_true_or_unknown: 1" in stdout
    assert "outside_installation_year_window: 1" in stdout
    assert "missing_or_invalid_installation_date: 1" in stdout

    project = tmp / "ahs-project.csv"
    household = tmp / "ahs-household.csv"
    replicate_fields = [f"REPWEIGHT{i}" for i in range(1, 161)]
    project_fields = ["CONTROL", "JOBTYPE", "JOBCOST", "JOBDIY"]
    project_rows = []
    household_rows = []
    # AHS relational PUF structure: generic project fields, not questionnaire
    # fields such as ROOFAM/ROOFWK/ROOFCMP/ROOFYRCST.
    for i in range(60):
        control = f"'h{i:03d}'"
        project_rows.append({
            "CONTROL": control,
            "JOBTYPE": "'16'",
            "JOBCOST": f"'{10000 + i * 1000}'",
            "JOBDIY": "'2'" if i < 30 else "'1'",
        })
        household_rows.append({
            "CONTROL": control, "TENURE": "'1'", "INTSTATUS": "'1'", "WEIGHT": "'1'", "OMB13CBSA": "'12060'",
            **{field: "'1'" for field in replicate_fields},
        })
    # C-16 counts eligible projects regardless of cost validity. Mean/median
    # and quartiles use positive costs only; total expenditures use nonnegative
    # costs. Give the zero-cost record a dominant weight to prove it cannot
    # contaminate the positive-cost median/mean.
    project_rows.extend([
        {"CONTROL": "h060", "JOBTYPE": "16", "JOBCOST": "0", "JOBDIY": "2"},
        {"CONTROL": "h061", "JOBTYPE": "17", "JOBCOST": "5000", "JOBDIY": "2"},
        {"CONTROL": "h062", "JOBTYPE": "16", "JOBCOST": "-6", "JOBDIY": "2"},
        {"CONTROL": "h063", "JOBTYPE": "16", "JOBCOST": "5000", "JOBDIY": "9"},
        {"CONTROL": "h064", "JOBTYPE": "16", "JOBCOST": "5000", "JOBDIY": "2"},
        {"CONTROL": "h065", "JOBTYPE": "16", "JOBCOST": "5000", "JOBDIY": "2"},
        {"CONTROL": "unmatched", "JOBTYPE": "16", "JOBCOST": "25000", "JOBDIY": "2"},
    ])
    household_rows.extend([
        {"CONTROL": "h060", "TENURE": "1", "INTSTATUS": "1", "WEIGHT": "1000", "OMB13CBSA": "12060", **{field: "1000" for field in replicate_fields}},
        {"CONTROL": "h062", "TENURE": "1", "INTSTATUS": "1", "WEIGHT": "1", "OMB13CBSA": "12060", **{field: "1" for field in replicate_fields}},
        {"CONTROL": "h064", "TENURE": "2", "INTSTATUS": "1", "WEIGHT": "1", **{field: "1" for field in replicate_fields}},
        {"CONTROL": "h065", "TENURE": "1", "INTSTATUS": "2", "WEIGHT": "1", **{field: "1" for field in replicate_fields}},
    ])
    with project.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=project_fields)
        w.writeheader(); w.writerows(project_rows)
    with household.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["CONTROL", "TENURE", "INTSTATUS", "WEIGHT", "OMB13CBSA", *replicate_fields])
        w.writeheader(); w.writerows(household_rows)
    output = tmp / "ahs-out.csv"
    stdout = run([ROOT / "scripts/analyze_ahs_roof.py", "--project-input", project, "--household-input", household, "--output", output, "--metro-output", tmp / "ahs-metro-out.csv", "--minimum-unweighted-n", "30", "--minimum-metro-unweighted-n", "30", "--roof-job-type-code", "16"])
    with output.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    with (tmp / "ahs-metro-out.csv").open(encoding="utf-8") as f:
        metro_rows = list(csv.DictReader(f))
    assert {row["group"] for row in rows} == {"all_roofing_projects", "household_did_not_do_most_work_JOBDIY_2", "household_did_most_work_JOBDIY_1"}
    metro_all = next(row for row in metro_rows if row["group"] == "all_roofing_projects")
    assert metro_all["metro_omb13cbsa"] == "12060"
    assert metro_all["metro_name"] == "Atlanta-Sandy Springs-Roswell, GA"
    assert metro_all["unweighted_n"] == "62"
    all_rows = next(row for row in rows if row["group"] == "all_roofing_projects")
    assert all_rows["unweighted_n"] == "62"
    assert all_rows["weighted_project_count"] == "1061"
    assert all_rows["positive_cost_unweighted_n"] == "60"
    assert all_rows["zero_cost_unweighted_n"] == "1"
    assert all_rows["nonnegative_cost_unweighted_n"] == "61"
    assert all_rows["mean_nominal_survey_usd"] == "39500.0"
    assert all_rows["median_nominal_survey_usd"] == "39000.0", "zero-cost jobs must not enter the C-16 median"
    assert float(all_rows["total_expenditure_nominal_survey_usd"]) == 2370000, "total must include nonnegative-cost jobs"
    assert all(row["publication_status"] == "RESEARCH_ONLY_C16_RECONCILIATION_AND_VARIANCE_REVIEW_PENDING" for row in rows)
    assert all(float(row["median_replicate_se_usd"]) == 0 for row in rows)
    assert all(float(row["mean_replicate_se_usd"]) == 0 for row in rows)
    assert "JOBTYPE 16 owner-occupied/interviewed projects: 62" in stdout
    assert "zero-cost records retained in count/total: 1" in stdout
    assert "missing_or_negative_cost: 1" in stdout
    assert "owner_occupancy_or_interview_excluded: 2" in stdout
    assert "unmatched_household: 1" in stdout


# The source audit must identify National and Metropolitan PUF relational files
# independently. The Metro PUF geography field must not be assumed to be OMB13CBSA.
audit = runpy.run_path(str(ROOT / "scripts/audit_ahs_source_files.py"))
locate_relational_csvs = audit["locate_relational_csvs"]
replicate_fields = [f"REPWEIGHT{i}" for i in range(1, 161)]
project_csv = "CONTROL,JOBTYPE,JOBCOST,JOBDIY\nh1,16,10000,2\n"
for filename, geography_field, require_omb in [
    ("national-source.zip", "OMB13CBSA", True),
    ("metro-source.zip", "METRO", False),
]:
    source_zip = Path(tempfile.gettempdir()) / filename
    household_fields = ["CONTROL", "TENURE", "INTSTATUS", "WEIGHT", geography_field, *replicate_fields]
    household_csv = ",".join(household_fields) + "\nh1,1,1,1,12060," + ",".join(["1"] * 160) + "\n"
    with zipfile.ZipFile(source_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("PROJECT.csv", project_csv)
        archive.writestr("HOUSEHOLD.csv", household_csv)
    project_name, household_name, project_header, household_header = locate_relational_csvs(source_zip, require_omb13cbsa=require_omb)
    assert project_name == "PROJECT.csv" and household_name == "HOUSEHOLD.csv"
    assert geography_field in household_header
    source_zip.unlink()

print("PASS: Berkeley/AHS research scripts on synthetic fixtures, including separate National/Metro PUF schema discovery.")
