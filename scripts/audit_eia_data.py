#!/usr/bin/env python3
"""Validate the published EIA state-price CSV against the static HTML table."""
from __future__ import annotations

import csv
import re
from decimal import Decimal, ROUND_HALF_UP
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_FILE = ROOT / "data" / "eia-residential-electricity-prices-2026-08-ytd.csv"
HTML_FILE = ROOT / "electricity-prices-by-state.html"

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_data_row = False
        self.in_cell = False
        self.cell_text = ""
        self.row = []
        self.rows = []
        self.capture_target = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "table" and attrs.get("id") == "stateTable":
            self.capture_target = True
        if not self.capture_target:
            return
        if tag == "tr" and attrs.get("data-state") is not None:
            self.in_data_row = True
            self.row = []
        elif self.in_data_row and tag in {"th", "td"}:
            self.in_cell = True
            self.cell_text = ""

    def handle_data(self, data):
        if self.capture_target and self.in_data_row and self.in_cell:
            self.cell_text += data

    def handle_endtag(self, tag):
        if not self.capture_target:
            return
        if self.in_data_row and tag in {"th", "td"} and self.in_cell:
            self.row.append(re.sub(r"\s+", " ", self.cell_text).strip())
            self.in_cell = False
        elif self.in_data_row and tag == "tr":
            if self.row:
                self.rows.append(self.row)
            self.in_data_row = False
        elif tag == "table" and self.capture_target:
            self.capture_target = False


def main() -> int:
    with CSV_FILE.open(newline="", encoding="utf-8") as handle:
        records = list(csv.DictReader(handle))
    expected = 52  # 50 states, DC and U.S. total
    if len(records) != expected:
        raise SystemExit(f"FAIL: CSV has {len(records)} rows, expected {expected}")
    codes = [r["code"] for r in records]
    names = [r["area"] for r in records]
    if len(set(codes)) != expected or len(set(names)) != expected:
        raise SystemExit("FAIL: duplicate state/area names or codes")
    for r in records:
        p26 = Decimal(r["jan_aug_2026_ytd_cents_per_kwh"])
        p25 = Decimal(r["jan_aug_2025_ytd_cents_per_kwh"])
        actual = (p26 - p25) / p25 * Decimal(100)
        expected_pct = Decimal(r["yoy_change_percent"])
        if abs(actual - expected_pct) > Decimal("0.02"):
            raise SystemExit(f"FAIL: YoY calculation mismatch for {r['area']}: {actual} vs {expected_pct}")
        if r["source"] != "EIA Electric Power Monthly Table 5.6.B" or r["data_release_date"] != "2026-10-23":
            raise SystemExit(f"FAIL: source/release metadata mismatch for {r['area']}")

    parser = TableParser()
    parser.feed(HTML_FILE.read_text(encoding="utf-8"))
    if len(parser.rows) != expected:
        raise SystemExit(f"FAIL: HTML table has {len(parser.rows)} rows, expected {expected}")
    html_by_name = {r[0]: r for r in parser.rows}
    for r in records:
        cells = html_by_name.get(r["area"])
        if not cells or len(cells) != 4:
            raise SystemExit(f"FAIL: HTML row missing/malformed for {r['area']}")
        v26 = Decimal(re.sub(r"[^0-9.]", "", cells[1]))
        v25 = Decimal(re.sub(r"[^0-9.]", "", cells[2]))
        yoy = Decimal(re.sub(r"[^0-9.-]", "", cells[3]))
        e26 = Decimal(r["jan_aug_2026_ytd_cents_per_kwh"])
        e25 = Decimal(r["jan_aug_2025_ytd_cents_per_kwh"])
        eyoy = ((e26 - e25) / e25 * Decimal(100)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        if v26 != e26 or v25 != e25 or yoy != eyoy:
            raise SystemExit(f"FAIL: CSV/HTML mismatch for {r['area']}: {cells}")

    print(f"PASS: {len(records)} unique EIA rows validated (50 states + DC + U.S. total).")
    print("PASS: YoY percentages reconcile to the rounded source data.")
    print("PASS: every static HTML table row matches the CSV reference file.")
    print("Limit: verifies internal consistency, not the underlying EIA source extraction or future revisions.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
