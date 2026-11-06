#!/usr/bin/env python3
"""Research-only audit of Berkeley Lab's 2026 distributed solar public data.

Downloads the official 2026 user guide and public CSV to a temporary runner.
Prints aggregate schema/row-count/cohort diagnostics only. It does not publish
prices, commit raw source data, or upload datasets as workflow artifacts.
"""
from __future__ import annotations

import csv
import hashlib
import io
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
import gzip
from collections import Counter
from pathlib import Path

GUIDE_URL = "https://eta-publications.lbl.gov/sites/default/files/2026-08/lbnl_publicdatafile_userguide_8.07.26.pdf"
CSV_URL = "https://bit.ly/trackingthesun2026"
CHUNK = 1024 * 1024
VALID_US_STATE_CODES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
    "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
    "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI",
    "WY", "AS", "GU", "MP", "PR", "VI",
}
MISSING_GEO = {"", "-1", "-1.0", "na", "n/a", "null", "none", "unknown"}
NEEDED = {
    "PV_system_size_DC", "total_installed_price", "customer_segment",
    "ground_mounted", "technology_type", "state", "city", "installation_date",
    "third_party_owned", "third_party_owned_inferred", "self_installed",
    "expansion_system", "multiple_phase_system",
}


def download(name: str, url: str, target: Path) -> tuple[int, str, str]:
    request = urllib.request.Request(url, headers={
        "User-Agent": "roof-solar-toolkit-LBNL-source-audit/1.0 (research-only)",
        "Accept": "*/*",
    })
    last_error: Exception | None = None
    for attempt in range(6):
        total = 0
        digest = hashlib.sha256()
        try:
            with urllib.request.urlopen(request, timeout=240) as response, target.open("wb") as out:
                final_url = response.geturl()
                status = getattr(response, "status", 200)
                if status != 200:
                    raise RuntimeError(f"{name}: HTTP {status}")
                content_type = response.headers.get("Content-Type", "")
                while True:
                    block = response.read(CHUNK)
                    if not block:
                        break
                    out.write(block)
                    digest.update(block)
                    total += len(block)
            print(f"DOWNLOAD {name}: bytes={total:,}; sha256={digest.hexdigest()}; content-type={content_type}; final-url={final_url}")
            return total, digest.hexdigest(), final_url
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in {429, 500, 502, 503, 504} or attempt == 5:
                raise
            delay = min(30, 2 ** attempt)
            print(f"RETRY {name}: transient HTTP {error.code}; attempt={attempt + 1}/6; delay={delay}s")
            target.unlink(missing_ok=True)
            import time
            time.sleep(delay)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            last_error = error
            if attempt == 5:
                raise
            delay = min(30, 2 ** attempt)
            print(f"RETRY {name}: transient connection error; attempt={attempt + 1}/6; delay={delay}s")
            target.unlink(missing_ok=True)
            import time
            time.sleep(delay)
    raise RuntimeError(f"{name}: download failed") from last_error


def inspect_guide(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("pypdf is required to inspect the official LBNL guide") from exc
    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    text = "\n".join(pages)
    compact = re.sub(r"[ \t]+", " ", text)
    print(f"GUIDE pages={len(reader.pages)}; extracted characters={len(text):,}")
    for term in ("Version Date", "What is Included in the Public Data File", "Missing data", "PV_system_size_DC", "total_installed_price", "customer_segment", "ground_mounted", "technology_type", "third_party_owned", "self_installed", "expansion_system", "multiple_phase_system", "city", "state", "license", "copyright"):
        match = re.search(re.escape(term), compact, re.I)
        print(f"GUIDE TERM {term}: {'FOUND' if match else 'NOT FOUND'}")
        if match:
            start = max(0, match.start() - 200)
            end = min(len(compact), match.end() + 650)
            print("  " + compact[start:end])
    # Render the first three pages with PyMuPDF. The workflow retains only
    # these small public guide-page images for visual preflight; the PDF itself,
    # the public CSV and all price outputs remain in the temporary directory.
    try:
        import fitz
        render_dir = Path(os.environ.get("GITHUB_WORKSPACE", ".")) / "lbnl-guide-renders"
        render_dir.mkdir(parents=True, exist_ok=True)
        visual_doc = fitz.open(str(path))
        for page_index in range(min(3, len(visual_doc))):
            page = visual_doc[page_index]
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            image_path = render_dir / f"guide-page-{page_index + 1}.png"
            pix.save(str(image_path))
            print(f"GUIDE_RENDER page={page_index + 1}; width={pix.width}; height={pix.height}; bytes={image_path.stat().st_size:,}")
        visual_doc.close()
    except Exception as error:
        print(f"GUIDE_RENDER unavailable: {type(error).__name__}: {error}")
    return text


def _file_chunks(path: Path):
    """Yield non-empty chunks from a ZIP file without loading the archive at once."""
    with path.open("rb") as stream:
        while True:
            block = stream.read(CHUNK)
            if not block:
                return
            yield block


def locate_data_file(path: Path, root: Path) -> Path:
    with path.open("rb") as probe:
        archive_prefix = probe.read(4)
    looks_like_zip = archive_prefix.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"))
    is_zip = zipfile.is_zipfile(path)
    if looks_like_zip and not is_zip:
        raise RuntimeError("Input has a ZIP signature but is malformed or truncated; refusing to treat it as CSV.")
    if is_zip:
        try:
            from stream_unzip import NO_ENCRYPTION, stream_unzip
        except ImportError as exc:
            raise RuntimeError(
                "stream-unzip==0.0.101 is required: the official Berkeley Lab archive uses ZIP Deflate64."
            ) from exc

        # zipfile can read central-directory metadata even when it cannot
        # decompress the member. Validate method, encryption and expected size
        # before streaming the multi-gigabyte CSV to a temporary path.
        with zipfile.ZipFile(path) as archive:
            candidates = [
                info for info in archive.infolist()
                if info.filename.lower().endswith(".csv") and not info.is_dir()
            ]
            if len(candidates) != 1:
                raise RuntimeError(f"Expected exactly one CSV in archive, found {len(candidates)}")
            info = candidates[0]
            if info.flag_bits & 0x1:
                raise RuntimeError("The Berkeley Lab public CSV member is encrypted; refusing unexpected encrypted input.")
            method_names = {
                0: "Stored", 8: "Deflate", 9: "Deflate64", 12: "BZip2",
                20: "Zstandard (deprecated method ID)", 93: "Zstandard",
            }
            method_name = method_names.get(info.compress_type, "Unknown")
            print(
                f"CSV_ARCHIVE_MEMBER: {info.filename}; compression_method={info.compress_type} ({method_name}); "
                f"compressed_bytes={info.compress_size:,}; uncompressed_bytes={info.file_size:,}"
            )
            if info.compress_type not in {0, 8, 9, 12}:
                raise RuntimeError(
                    f"Unsupported ZIP compression method {info.compress_type} ({method_name}); "
                    "stream-unzip==0.0.101 supports Stored, Deflate, Deflate64 and BZip2 only."
                )
            expected_name = info.filename
            safe_basename = Path(expected_name.replace(chr(92), "/")).name
            extracted = root / safe_basename
            if extracted.exists():
                raise RuntimeError(f"Refusing to overwrite temporary extraction target: {extracted.name}")

        member_count = 0
        written = 0
        digest = hashlib.sha256()
        for member_name, declared_size, member_chunks in stream_unzip(
            _file_chunks(path),
            chunk_size=CHUNK,
            allow_zip64=True,
            allowed_encryption_mechanisms=(NO_ENCRYPTION,),
        ):
            name = member_name.decode("utf-8", errors="replace")
            if name == expected_name:
                member_count += 1
                if member_count > 1:
                    raise RuntimeError("The public ZIP contains more than one matching CSV member.")
                with extracted.open("xb") as target:
                    for block in member_chunks:
                        target.write(block)
                        digest.update(block)
                        written += len(block)
                if declared_size is not None and written != declared_size:
                    raise RuntimeError(
                        f"Deflate64 output size mismatch: member declared {declared_size:,}, wrote {written:,} bytes."
                    )
            else:
                # stream-unzip requires every yielded member generator to be
                # fully consumed before the next member can be requested.
                for _ in member_chunks:
                    pass

        if member_count != 1:
            raise RuntimeError(f"stream-unzip yielded the selected CSV {member_count} times; expected exactly once.")
        if written != info.file_size:
            raise RuntimeError(
                f"Deflate64 output size mismatch: central directory declared {info.file_size:,}, wrote {written:,} bytes."
            )
        print(
            f"CSV_ARCHIVE_ENTRY: {expected_name}; compression_method={info.compress_type}; "
            f"uncompressed_bytes={written:,}; sha256={digest.hexdigest()}; "
            "stream-unzip CRC32 and size verification completed."
        )
        return extracted
    magic = archive_prefix[:2]
    if path.suffix.lower() == ".gz" or magic == b"\x1f\x8b":
        extracted = root / "public-data.csv"
        with gzip.open(path, "rb") as source, extracted.open("wb") as target:
            while True:
                block = source.read(CHUNK)
                if not block:
                    break
                target.write(block)
        return extracted
    return path


def value(raw: str | None) -> str:
    return (raw or "").strip()


def valid_state_code(raw: str | None) -> bool:
    return value(raw).strip().upper() in VALID_US_STATE_CODES


def valid_city_label(raw: str | None) -> bool:
    token = value(raw).strip()
    return bool(token) and token.lower() not in MISSING_GEO


def ownership_flag_state(raw: str | None) -> str:
    token = value(raw).lower()
    if token in {"0", "0.0", "false", "no", "n"}:
        return "no"
    if token in {"1", "1.0", "true", "yes", "y"}:
        return "yes"
    return "unknown"


def ownership_evidence_bucket(reported: str, inferred: str) -> str:
    states = {reported, inferred}
    if "yes" in states:
        return "contains_positive_tpo_evidence"
    if states == {"no"}:
        return "both_flags_explicitly_non_tpo"
    if "no" in states and "unknown" in states:
        return "one_explicit_non_tpo_other_unknown"
    return "both_flags_unknown"


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="lbnl-2026-audit-") as tmp:
        root = Path(tmp)
        guide_path = root / "lbnl-2026-user-guide.pdf"
        source_path = root / "lbnl-2026-public-data.download"
        download("2026_user_guide", GUIDE_URL, guide_path)
        guide_text = inspect_guide(guide_path)
        _, _, csv_final_url = download("2026_public_data", CSV_URL, source_path)
        with source_path.open("rb") as probe:
            prefix = probe.read(4096).lstrip()
        if prefix.startswith(b"<!DOCTYPE html") or prefix.startswith(b"<html") or b"Google Drive" in prefix:
            match = re.search(r"/file/d/([A-Za-z0-9_-]+)", csv_final_url)
            if not match:
                raise RuntimeError("The LBNL public-data short link redirected to HTML, but no public Google Drive file ID was detected.")
            file_id = match.group(1)
            print(f"CSV_REDIRECT: Google Drive file ID detected ({file_id}); retrying through the public file download endpoint.")
            source_path.unlink(missing_ok=True)
            try:
                import gdown
            except ImportError as exc:
                raise RuntimeError("gdown is required to retrieve the public LBNL Google Drive file.") from exc
            downloaded = gdown.download(id=file_id, output=str(source_path), quiet=False)
            if not downloaded or not source_path.exists() or source_path.stat().st_size < 1024:
                raise RuntimeError("Google Drive public CSV download did not return a plausible file.")
            with source_path.open("rb") as probe:
                file_magic = probe.read(8)
            print(f"CSV_GOOGLE_DRIVE_DOWNLOAD: bytes={source_path.stat().st_size:,}; magic={file_magic!r}")
        csv_path = locate_data_file(source_path, root)
        print(f"PUBLIC_CSV size_bytes={csv_path.stat().st_size:,}; suffix={csv_path.suffix}")

        row_count = 0
        missing_counts: Counter[str] = Counter()
        segment_counts: Counter[str] = Counter()
        tech_counts: Counter[str] = Counter()
        ground_counts: Counter[str] = Counter()
        city_state_counts: Counter[tuple[str, str]] = Counter()
        year_counts: Counter[str] = Counter()
        filter_counts: Counter[str] = Counter()
        sample_candidates = Counter()
        ownership_scope_n = 0
        ownership_pairs: Counter[tuple[str, str, str]] = Counter()
        ownership_buckets: Counter[str] = Counter()
        ownership_state_counts: dict[str, Counter[str]] = {
            name: Counter() for name in ("strict", "sensitivity")
        }
        ownership_city_counts: dict[str, Counter[tuple[str, str]]] = {
            name: Counter() for name in ("strict", "sensitivity")
        }
        headers: list[str] = []
        required_missing: set[str] = set()
        first_rows: list[dict[str, str]] = []

        with csv_path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            headers = list(reader.fieldnames or [])
            required_missing = NEEDED - set(headers)
            print(f"CSV_COLUMNS count={len(headers)}")
            print("CSV_HEADERS: " + ", ".join(headers))
            print("REQUIRED_FIELD_CHECK:")
            for field in sorted(NEEDED):
                print(f"  {field}: {'PRESENT' if field in headers else 'MISSING'}")
            if required_missing:
                print("STOP: existing cohort script is incompatible with this CSV schema.")
            else:
                for row in reader:
                    row_count += 1
                    if len(first_rows) < 3:
                        first_rows.append(row)
                    segment = value(row.get("customer_segment")).upper()
                    technology = value(row.get("technology_type")).upper()
                    ground = value(row.get("ground_mounted"))
                    state = value(row.get("state")).upper()
                    city = value(row.get("city"))
                    date = value(row.get("installation_date"))
                    segment_counts[segment or "<blank>"] += 1
                    tech_counts[technology or "<blank>"] += 1
                    ground_counts[ground or "<blank>"] += 1
                    year_match = re.match(r"^(19\d{2}|20\d{2})", date)
                    year = year_match.group(1) if year_match else "<missing>"
                    year_counts[year] += 1
                    state_is_valid = valid_state_code(state)
                    city_is_valid = valid_city_label(city)
                    if state_is_valid and city_is_valid:
                        city_state_counts[(state, city)] += 1
                    for field in NEEDED:
                        if not value(row.get(field)) or value(row.get(field)) in {"-1", "-1.0"}:
                            missing_counts[field] += 1

                    is_res = segment in {"RES", "RES_SF"}
                    is_pv = technology == "PV-ONLY"
                    is_roof = ground.lower() in {"0", "0.0", "false", "no", "n"}
                    if is_res:
                        sample_candidates["residential_or_single_family"] += 1
                    if is_res and is_pv:
                        sample_candidates["residential_pv_only"] += 1
                    if is_res and is_pv and is_roof:
                        sample_candidates["residential_pv_only_rooftop"] += 1
                    if year in {"2024", "2025"}:
                        sample_candidates["installation_2024_2025"] += 1
                    tpo = value(row.get("third_party_owned")).lower()
                    tpoi = value(row.get("third_party_owned_inferred")).lower()
                    self_install = value(row.get("self_installed")).lower()
                    expansion = value(row.get("expansion_system")).lower()
                    multi = value(row.get("multiple_phase_system")).lower()

                    # Measure a sensitivity universe with every non-ownership
                    # cohort filter held constant; this does not change the
                    # strict calculator benchmark cohort.
                    try:
                        dc_kw = float(value(row.get("PV_system_size_DC")))
                        installed_price = float(value(row.get("total_installed_price")))
                    except (TypeError, ValueError):
                        dc_kw = installed_price = float("nan")
                    other_scope_ok = (
                        is_res
                        and year in {"2024", "2025"}
                        and is_pv
                        and is_roof
                        and state_is_valid
                        and 1.0 <= dc_kw <= 25.0
                        and installed_price > 0
                        and ownership_flag_state(row.get("self_installed")) == "no"
                        and ownership_flag_state(row.get("expansion_system")) == "no"
                        and ownership_flag_state(row.get("multiple_phase_system")) == "no"
                    )
                    if other_scope_ok:
                        ownership_scope_n += 1
                        reported_state = ownership_flag_state(row.get("third_party_owned"))
                        inferred_state = ownership_flag_state(row.get("third_party_owned_inferred"))
                        confidence = value(row.get("third_party_owned_confidence")).upper() or "<blank>"
                        ownership_pairs[(reported_state, inferred_state, confidence)] += 1
                        bucket = ownership_evidence_bucket(reported_state, inferred_state)
                        ownership_buckets[bucket] += 1
                        policy = {
                            "both_flags_explicitly_non_tpo": "strict",
                            "one_explicit_non_tpo_other_unknown": "sensitivity",
                        }.get(bucket)
                        if policy:
                            ownership_state_counts[policy][state] += 1
                            if city_is_valid:
                                ownership_city_counts[policy][(state, city.casefold().strip())] += 1

                    if tpo not in {"0", "0.0", "false", "no", "n"} or tpoi not in {"0", "0.0", "false", "no", "n"}:
                        filter_counts["ownership_not_proven_host_owned_or_tpo"] += 1
                    elif self_install not in {"0", "0.0", "false", "no", "n"}:
                        filter_counts["self_install_true_or_unknown"] += 1
                    elif expansion not in {"0", "0.0", "false", "no", "n"}:
                        filter_counts["expansion_true_or_unknown"] += 1
                    elif multi not in {"0", "0.0", "false", "no", "n"}:
                        filter_counts["multiple_phase_true_or_unknown"] += 1
                    else:
                        filter_counts["host_owned_non_self_non_expansion_single_phase"] += 1

        print(f"PUBLIC_CSV_ROWS: {row_count:,}")
        print(f"UNIQUE_VALID_STATE_CITY_LABELS: {len(city_state_counts):,}")
        print("INSTALLATION_YEARS (top 30): " + str(year_counts.most_common(30)))
        print("CUSTOMER_SEGMENT: " + str(segment_counts.most_common(30)))
        print("TECHNOLOGY_TYPE: " + str(tech_counts.most_common(20)))
        print("GROUND_MOUNTED: " + str(ground_counts.most_common(20)))
        print("COHORT_STAGE_COUNTS:")
        for name, count in sample_candidates.most_common():
            print(f"  {name}: {count:,}")
        print("OWNERSHIP_AND_SCOPE_FILTER COUNTS:")
        for name, count in filter_counts.most_common():
            print(f"  {name}: {count:,}")
        print("OWNERSHIP_FLAG_SENSITIVITY — identical non-ownership filters; only TPO-flag evidence differs:")
        print(f"  candidate_rows_before_TPO_decision: {ownership_scope_n:,}")
        print("  joint_reported_inferred_confidence_counts:")
        for (reported, inferred, confidence), count in sorted(ownership_pairs.items(), key=lambda item: (-item[1], item[0])):
            print(f"    reported={reported}; inferred={inferred}; inferred_confidence={confidence}: n={count:,}")
        print("  ownership_evidence_buckets:")
        for name, count in sorted(ownership_buckets.items()):
            print(f"    {name}: {count:,}")
        strict_n = ownership_buckets["both_flags_explicitly_non_tpo"]
        sensitivity_n = ownership_buckets["one_explicit_non_tpo_other_unknown"]
        print(f"  strict_both_explicitly_non_tpo_n: {strict_n:,}")
        print(f"  sensitivity_one_explicit_non_tpo_other_unknown_n: {sensitivity_n:,}")
        print(f"  sensitivity_additional_rows_if_accepted: {sensitivity_n:,}")
        for policy in ("strict", "sensitivity"):
            state_counts = ownership_state_counts[policy]
            city_counts = ownership_city_counts[policy]
            print(f"  {policy}_state_counts: {dict(sorted(state_counts.items(), key=lambda item: (-item[1], item[0])))}")
            print(f"  {policy}_state_groups_meeting_n500: {sum(1 for n in state_counts.values() if n >= 500)}")
            print(f"  {policy}_city_groups_meeting_n100: {sum(1 for n in city_counts.values() if n >= 100)}")
        print("  NOTE: sensitivity rows have one explicit non-TPO flag and one unknown flag; they remain separate from strict results.")
        print("MISSING_SENTINELS IN REQUIRED FIELDS:")
        for field in sorted(NEEDED):
            print(f"  {field}: {missing_counts[field]:,} of {row_count:,}")
        print("GUIDE_CONTAINS_FIELD_NAMES:")
        for field in sorted(NEEDED):
            print(f"  {field}: {'YES' if re.search(re.escape(field), guide_text) else 'NO'}")
        print("RAW PROJECT RECORDS OMITTED: no row-level data are printed or retained as workflow artifacts.")
        if required_missing:
            print("LBNL SOURCE AUDIT INCOMPATIBLE WITH EXISTING ANALYZER; do not process prices.")
            return 2

        # Run the established research filter on the actual CSV only after the
        # required 2026 schema has been confirmed. Outputs stay in this temp dir.
        city_out = root / "berkeley-city-research.csv"
        state_out = root / "berkeley-state-research.csv"
        coverage_out = root / "berkeley-city-coverage.csv"
        analyzer = Path(__file__).with_name("analyze_berkeley_solar.py")
        completed = subprocess.run([
            sys.executable, str(analyzer), "--input", str(csv_path),
            "--output", str(city_out), "--state-output", str(state_out),
            "--coverage-output", str(coverage_out),
        ], check=True, capture_output=True, text=True)
        print("EXISTING COHORT ANALYZER OUTPUT:")
        for line in completed.stdout.splitlines():
            print("  " + line)

        with city_out.open(encoding="utf-8", newline="") as stream:
            city_rows = list(csv.DictReader(stream))
        with state_out.open(encoding="utf-8", newline="") as stream:
            state_rows = list(csv.DictReader(stream))
        with coverage_out.open(encoding="utf-8", newline="") as stream:
            coverage_rows = list(csv.DictReader(stream))
        eligible_city_n = [int(row["n"]) for row in city_rows]
        eligible_state_n = [int(row["n"]) for row in state_rows]
        print(f"COHORT_OUTPUT city_rows_meeting_n100={len(city_rows):,}; state_rows_meeting_n500={len(state_rows):,}; city-coverage-rows={len(coverage_rows):,}")
        if eligible_city_n:
            print(f"COHORT_OUTPUT largest_city_sample={max(eligible_city_n):,}; median_city_sample={sorted(eligible_city_n)[len(eligible_city_n)//2]:,}")
        if eligible_state_n:
            print(f"COHORT_OUTPUT smallest_published_state_sample={min(eligible_state_n):,}; largest_state_sample={max(eligible_state_n):,}")

        print("LBNL 2026 SOURCE AUDIT AND TEMPORARY COHORT ANALYSIS COMPLETED. No source data or price aggregates were uploaded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

