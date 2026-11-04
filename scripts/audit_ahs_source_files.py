#!/usr/bin/env python3
"""Research-only audit of the official 2023 AHS National PUF source package.

Downloads the public Census National PUF CSV archive, Value Labels package and
Table Specifications workbook. It prints schemas and aggregate diagnostics only:
no microdata rows are printed, committed or uploaded as workflow artifacts.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

BASE = "https://www2.census.gov/programs-surveys/ahs/2023/"
SOURCES = {
    "national_puf": BASE + "AHS%202023%20National%20PUF%20v1.1%20CSV.zip",
    "value_labels": BASE + "AHS%202023%20Value%20Labels%20Package.zip",
    "table_specs": BASE + "AHS%202023%20Table%20Specifications%20and%20PUF%20Estimates%20for%20User%20Verification.xlsx",
}
CHUNK = 1024 * 1024


def download(name: str, url: str, target: Path) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "roof-solar-toolkit-AHS-source-audit/1.0 (research-only)",
            "Accept": "*/*",
        },
    )
    last_error: Exception | None = None
    for attempt in range(6):
        digest = hashlib.sha256()
        total = 0
        try:
            with urllib.request.urlopen(request, timeout=180) as response, target.open("wb") as out:
                status = getattr(response, "status", 200)
                if status != 200:
                    raise RuntimeError(f"{name}: Census returned HTTP {status}")
                while True:
                    block = response.read(CHUNK)
                    if not block:
                        break
                    out.write(block)
                    digest.update(block)
                    total += len(block)
            print(f"DOWNLOAD {name}: {total:,} bytes; sha256={digest.hexdigest()}")
            return total, digest.hexdigest()
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in {429, 500, 502, 503, 504} or attempt == 5:
                raise
            retry_after = error.headers.get("Retry-After") if error.headers else None
            delay = min(30, int(retry_after)) if retry_after and retry_after.isdigit() else min(20, 2 ** attempt)
            print(f"RETRY {name}: transient HTTP {error.code}; attempt {attempt + 1}/6 in {delay}s")
            target.unlink(missing_ok=True)
            time.sleep(delay)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            last_error = error
            if attempt == 5:
                raise
            delay = min(20, 2 ** attempt)
            print(f"RETRY {name}: transient connection error; attempt {attempt + 1}/6 in {delay}s")
            target.unlink(missing_ok=True)
            time.sleep(delay)
    raise RuntimeError(f"{name}: download failed after retries") from last_error


def zip_entries(path: Path, label: str) -> list[str]:
    if not zipfile.is_zipfile(path):
        raise RuntimeError(f"{label}: downloaded content is not a ZIP archive")
    with zipfile.ZipFile(path) as archive:
        names = [n for n in archive.namelist() if not n.endswith("/")]
    print(f"{label} archive entries ({len(names)}):")
    for name in names[:100]:
        print(f"  {name}")
    if len(names) > 100:
        print(f"  ... {len(names) - 100} additional entries omitted")
    return names


def csv_header(archive: zipfile.ZipFile, name: str) -> list[str]:
    with archive.open(name) as binary:
        text = io.TextIOWrapper(binary, encoding="utf-8-sig", newline="")
        reader = csv.reader(text)
        return next(reader, [])


def locate_relational_csvs(puf_zip: Path) -> tuple[str, str, list[str], list[str]]:
    with zipfile.ZipFile(puf_zip) as archive:
        candidates = [n for n in archive.namelist() if n.lower().endswith(".csv")]
        project = None
        household = None
        project_header: list[str] = []
        household_header: list[str] = []
        for name in candidates:
            header = csv_header(archive, name)
            fields = {x.strip().strip('"').upper() for x in header}
            if {"CONTROL", "JOBTYPE", "JOBCOST", "JOBDIY"} <= fields:
                project, project_header = name, header
            if {"CONTROL", "TENURE", "INTSTATUS", "WEIGHT", "OMB13CBSA"} <= fields:
                replicate_count = sum(
                    1 for field in fields if re.fullmatch(r"REPWEIGHT\d{1,3}", field)
                )
                if replicate_count >= 100:
                    household, household_header = name, header
        if not project or not household:
            raise RuntimeError(
                "Could not identify relational PROJECT/HOUSEHOLD CSVs by required headers. "
                f"Candidate CSVs: {candidates}"
            )
        return project, household, project_header, household_header


def project_jobtype_counts(puf_zip: Path, project_name: str) -> None:
    type_rows: Counter[str] = Counter()
    diy_rows: dict[str, Counter[str]] = defaultdict(Counter)
    cost_valid: Counter[str] = Counter()
    cost_missing: Counter[str] = Counter()
    total = 0
    with zipfile.ZipFile(puf_zip) as archive, archive.open(project_name) as binary:
        text = io.TextIOWrapper(binary, encoding="utf-8-sig", newline="")
        reader = csv.DictReader(text)
        for row in reader:
            total += 1
            job_type = str(row.get("JOBTYPE", "")).strip().strip("'\"")
            diy = str(row.get("JOBDIY", "")).strip().strip("'\"")
            cost = str(row.get("JOBCOST", "")).strip().strip("'\"")
            type_rows[job_type] += 1
            diy_rows[job_type][diy] += 1
            try:
                value = float(cost)
                if value >= 0:
                    cost_valid[job_type] += 1
                else:
                    cost_missing[job_type] += 1
            except (TypeError, ValueError):
                cost_missing[job_type] += 1
    print(f"PROJECT rows: {total:,}")
    print("JOBTYPE aggregate frequency / JOBDIY split / JOBCOST validity:")
    for code, count in sorted(type_rows.items(), key=lambda item: item[0]):
        print(
            f"  JOBTYPE={code!r}: n={count:,}; "
            f"JOBDIY={dict(sorted(diy_rows[code].items()))}; "
            f"nonnegative_cost={cost_valid[code]:,}; "
            f"missing_or_negative_cost={cost_missing[code]:,}"
        )


def inspect_household(puf_zip: Path, household_name: str, header: list[str]) -> None:
    fields = {x.strip().strip('"').upper() for x in header}
    replicates = sorted(
        (x for x in fields if re.fullmatch(r"REPWEIGHT\d{1,3}", x)),
        key=lambda x: int(re.search(r"\d+", x).group(0)),  # type: ignore[union-attr]
    )
    print("HOUSEHOLD schema checks:")
    print(f"  Required base fields present: {all(x in fields for x in ['CONTROL','TENURE','INTSTATUS','WEIGHT','OMB13CBSA'])}")
    print(f"  Replicate-weight fields found: {len(replicates)}")
    print(f"  Replicate field range: {replicates[0] if replicates else 'none'} .. {replicates[-1] if replicates else 'none'}")
    print(f"  Split-sample weights present: SP1WEIGHT={'SP1WEIGHT' in fields}, SP2WEIGHT={'SP2WEIGHT' in fields}")
    count = 0
    with zipfile.ZipFile(puf_zip) as archive, archive.open(household_name) as binary:
        text = io.TextIOWrapper(binary, encoding="utf-8-sig", newline="")
        for _ in csv.DictReader(text):
            count += 1
    print(f"HOUSEHOLD rows: {count:,}")


def inspect_value_labels(labels_zip: Path) -> None:
    print("Value-label files containing JOBTYPE / roofing terminology:")
    total_matches = 0
    with zipfile.ZipFile(labels_zip) as archive:
        for name in archive.namelist():
            if name.endswith("/") or not name.lower().endswith((".sas", ".txt", ".csv", ".sps", ".r")):
                continue
            try:
                raw = archive.read(name)
                text = raw.decode("utf-8-sig", errors="replace")
            except Exception:
                continue
            lines = text.splitlines()
            hit_indexes = [
                i for i, line in enumerate(lines)
                if re.search(r"JOBTYPE|JOB.?TYPE|ROOF(?:ING)?", line, re.I)
            ]
            if not hit_indexes:
                continue
            print(f"  FILE: {name}")
            selected: set[int] = set()
            for index in hit_indexes[:30]:
                selected.update(range(max(0, index - 2), min(len(lines), index + 4)))
            for index in sorted(selected)[:180]:
                print(f"    {index + 1}: {lines[index][:260]}")
            total_matches += len(hit_indexes)
    if total_matches == 0:
        print("  No plain-text JOBTYPE/roofing label was found; inspect package formats manually.")


def inspect_table_specs(path: Path) -> None:
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise RuntimeError("openpyxl is required to inspect the Census Table Specifications workbook") from exc
    workbook = load_workbook(path, read_only=True, data_only=True)
    print(f"Table Specifications sheets: {workbook.sheetnames}")
    if "Home Improvement Costs" in workbook.sheetnames:
        c16_sheet = workbook["Home Improvement Costs"]
        for row_number in range(1, 16):
            values = [str(value).strip() for value in next(c16_sheet.iter_rows(min_row=row_number, max_row=row_number, values_only=True)) if value is not None]
            if values:
                print(f"  C-16 header/context row {row_number}: {' | '.join(values)[:900]}")
        for row_number in range(100, 105):
            values = [str(value).strip() for value in next(c16_sheet.iter_rows(min_row=row_number, max_row=row_number, values_only=True)) if value is not None]
            if values:
                print(f"  C-16 roofing row {row_number}: {' | '.join(values)[:900]}")
    total_matches = 0
    for sheet in workbook.worksheets:
        rows_to_print: list[tuple[int, str]] = []
        for row_number, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            values = [str(value).strip() for value in row if value is not None]
            if not values:
                continue
            joined = " | ".join(values)
            if re.search(r"C[- ]?16|HOME IMPROVEMENT COST|JOBTYPE|JOBCOST|JOBDIY|ROOF", joined, re.I):
                rows_to_print.append((row_number, joined[:650]))
        if rows_to_print:
            print(f"  SHEET: {sheet.title}; relevant rows={len(rows_to_print)}")
            for row_number, joined in rows_to_print[:100]:
                print(f"    row {row_number}: {joined}")
            total_matches += len(rows_to_print)
    if total_matches == 0:
        print("  No C-16 / roofing / job variable rows found by text search; inspect workbook manually.")
    workbook.close()


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="ahs-audit-") as temp_dir:
        root = Path(temp_dir)
        files: dict[str, Path] = {}
        for name, url in SOURCES.items():
            suffix = ".xlsx" if name == "table_specs" else ".zip"
            target = root / f"{name}{suffix}"
            download(name, url, target)
            files[name] = target

        puf_names = zip_entries(files["national_puf"], "National PUF")
        label_names = zip_entries(files["value_labels"], "Value Labels")
        print(f"Table Specifications workbook size: {files['table_specs'].stat().st_size:,} bytes")
        project_name, household_name, project_header, household_header = locate_relational_csvs(files["national_puf"])
        print(f"Identified relational PROJECT CSV: {project_name}")
        print(f"PROJECT schema: {', '.join(project_header[:80])}")
        print(f"Identified relational HOUSEHOLD CSV: {household_name}")
        print(f"HOUSEHOLD schema fields: {len(household_header)}")
        inspect_household(files["national_puf"], household_name, household_header)
        project_jobtype_counts(files["national_puf"], project_name)
        inspect_value_labels(files["value_labels"])
        inspect_table_specs(files["table_specs"])

        # Run the existing estimator on the real public PUF while source files
        # remain in this temporary runner. Only aggregate output rows are logged;
        # no raw microdata is uploaded or retained as an Actions artifact.
        puf_dir = root / "national-puf"
        puf_dir.mkdir()
        with zipfile.ZipFile(files["national_puf"]) as archive:
            project_path = Path(archive.extract(project_name, puf_dir))
            household_path = Path(archive.extract(household_name, puf_dir))
        national_output = root / "ahs-roof-national-research.csv"
        metro_output = root / "ahs-roof-metro-research.csv"
        analyzer = Path(__file__).with_name("analyze_ahs_roof.py")
        command = [
            sys.executable, str(analyzer),
            "--project-input", str(project_path),
            "--household-input", str(household_path),
            "--output", str(national_output),
            "--metro-output", str(metro_output),
            "--roof-job-type-code", "16",
        ]
        print("\nRunning the corrected AHS research estimator against the actual National PUF...")
        completed = subprocess.run(command, check=True, text=True, capture_output=True)
        print(completed.stdout)
        with national_output.open(encoding="utf-8", newline="") as stream:
            national_rows = list(csv.DictReader(stream))
        all_roofing = next((row for row in national_rows if row["group"] == "all_roofing_projects"), None)
        if all_roofing is None:
            raise RuntimeError("Actual PUF estimator produced no national all-roofing row.")
        for field in (
            "unweighted_n", "weighted_project_count", "positive_cost_unweighted_n",
            "zero_cost_unweighted_n", "nonnegative_cost_unweighted_n",
            "mean_nominal_survey_usd", "median_nominal_survey_usd",
            "mean_replicate_se_usd", "median_replicate_se_usd",
            "total_expenditure_nominal_survey_usd", "total_expenditure_replicate_se_usd",
        ):
            print(f"ACTUAL PUF NATIONAL {field}: {all_roofing.get(field, '')}")
        print("\nAHS SOURCE AUDIT AND REAL-PUF RESEARCH CALCULATION COMPLETED. No raw files or record-level data were uploaded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
