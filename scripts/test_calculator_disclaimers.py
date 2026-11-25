#!/usr/bin/env python3
"""Enforce the two-part disclosure layout without deleting calculator-specific limits."""
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
NOTICE = "Planning estimates only. Results depend on the inputs and assumptions shown; they are not quotes, inspections, engineering designs, or guarantees."
PAGES = (
    "calculators/location-solar.html",
    "calculators/roof-area.html",
    "calculators/roof-replacement-cost.html",
    "calculators/solar-panel-count.html",
    "calculators/solar-savings.html",
)
REQUIRED_PAGE_DETAILS = {
    "calculators/location-solar.html": (
        "selected Census city point",
        "not a roof-level assessment",
    ),
    "calculators/roof-area.html": (
        "building footprint",
        "complex geometry and overhangs need separate measurement",
    ),
    "calculators/roof-replacement-cost.html": (
        "Published national cost references",
        "Historical Census survey context",
        "What may not be included in the installed rate?",
    ),
    "calculators/solar-panel-count.html": (
        "Neither path assesses roof fit",
        "Panel count is not a roof-fit calculation",
    ),
    "calculators/solar-savings.html": (
        "A blank export credit is unknown, not zero.",
        "Assumptions and limitations",
    ),
}
SOLAR_PAGES_WITH_TAX_NOTE = (
    "calculators/solar-panel-count.html",
    "calculators/solar-savings.html",
)
IRS_TIMING_DETAILS = (
    "original installation of the item is completed",
    "original use of the constructed or reconstructed structure",
    "after December 31, 2025",
)


def fail(message: str) -> None:
    raise SystemExit("FAIL: " + message)


def matching_div_end(source: str, opening_pos: int) -> int:
    """Return the end offset of a div element, accounting for nested divs."""
    depth = 0
    for match in re.finditer(r"</?div\b[^>]*>", source[opening_pos:], re.IGNORECASE):
        token = match.group(0)
        if token.startswith("</"):
            depth -= 1
            if depth == 0:
                return opening_pos + match.end()
        elif not token.rstrip().endswith("/>"):
            depth += 1
    fail("could not locate matching closing div for result element")
    raise AssertionError("unreachable")


def check_tax_timing(source: str, label: str) -> None:
    note = re.search(r'<div class="calculator-method-note" role="note">([\s\S]*?)</div>', source)
    if not note or "Federal Section 25D" not in note.group(1):
        fail(f"{label} must disclose Section 25D timing in the methodology note")
    for detail in IRS_TIMING_DETAILS:
        if detail not in note.group(1):
            fail(f"{label} Section 25D disclosure is missing IRS timing detail: {detail}")
    if source.count("Federal Section 25D") != 1:
        fail(f"{label} repeats the Section 25D timing disclosure")
    if note.group(1).count('href="https://www.irs.gov/') != 1:
        fail(f"{label} Section 25D disclosure must link to the IRS source once")


def check_page(relative: str) -> None:
    source = (ROOT / relative).read_text(encoding="utf-8")
    if source.count('class="calculator-notice"') != 1:
        fail(f"{relative} must have exactly one top planning notice")
    if NOTICE not in source:
        fail(f"{relative} is missing the approved universal notice wording")
    if "2026 public benchmarks" in source:
        fail(f"{relative} must not imply every calculator is based on 2026 public benchmarks")
    hero_start = source.find('<section class="page-hero">')
    hero_end = source.find("</section>", hero_start)
    notice_pos = source.find('class="calculator-notice"')
    result_pos = source.find('id="result"')
    if hero_start < 0 or hero_end < 0 or not hero_end < notice_pos < result_pos:
        fail(f"{relative} planning notice must sit after the hero and before the calculator")
    if source.count('class="calculator-method-note"') != 1:
        fail(f"{relative} must have exactly one result-adjacent methodology note")
    result_tag_pos = source.rfind("<div", 0, result_pos)
    result_end = matching_div_end(source, result_tag_pos)
    note_pos = source.find('<div class="calculator-method-note"', result_end)
    if note_pos < 0 or source[result_end:note_pos].strip():
        fail(f"{relative} methodology note must immediately follow the result element")
    if '<div class="wrap disclaimer">' in source:
        fail(f"{relative} still repeats a shared footer disclaimer")
    if '<aside class="sidecol">' in source:
        fail(f"{relative} still repeats the generic Important sidebar")
    if "Calculation notes: see" in source or 'aria-label="Calculation documentation"' in source:
        fail(f"{relative} retains a duplicate methodology preamble")
    for detail in REQUIRED_PAGE_DETAILS[relative]:
        if detail not in source:
            fail(f"{relative} lost a page-specific explanation: {detail}")
    if relative == "calculators/solar-panel-count.html":
        note = re.search(r'<div class="calculator-method-note" role="note">([\s\S]*?)</div>', source)
        if not note:
            fail(f"{relative} is missing its methodology note")
        for detail in (
            "quoted DC system size",
            "× 1,000 ÷ module wattage",
            "rounded up",
            "annual production is not calculated by this method",
        ):
            if detail not in note.group(1):
                fail(f"{relative} methodology omits its alternative input path: {detail}")
    if relative in SOLAR_PAGES_WITH_TAX_NOTE:
        check_tax_timing(source, relative)


for page in PAGES:
    check_page(page)

index = (ROOT / "index.html").read_text(encoding="utf-8")
if index.count('class="calculator-notice"') != 1 or NOTICE not in index:
    fail("index.html must have exactly one approved universal planning notice")
if "2026 public benchmarks" in index:
    fail("index.html must not imply every calculation uses 2026 public benchmarks")
homepage_notice_pos = index.find('class="calculator-notice"')
journey_pos = index.find('<section class="journey-section"')
calculator_pos = index.find('<section class="section calculator-section"')
if journey_pos < 0 or calculator_pos < 0 or not homepage_notice_pos < journey_pos < calculator_pos:
    fail("index.html planning notice must appear below the hero and above the main page sections")
if index.count('class="calculator-method-note"') != 1:
    fail("index.html must have exactly one combined methodology/Section 25D note")
check_tax_timing(index, "index.html")
if '<div class="disclaimer"><strong>Planning estimates:' in index:
    fail("index.html still repeats the footer planning disclaimer")
if '<div class="hero-note">' in index:
    fail("index.html still repeats the planning disclosure in the hero")
if "See the Section 25D note below the results" in index:
    fail("index.html still repeats the tax-credit warning before results")
if index.find('class="calculator-method-note"') < index.find('id="results"'):
    fail("index.html methodology note must follow the combined estimator results")

print("PASS homepage and all five standalone calculators use one universal notice and one result-adjacent method note.")
print("PASS repeated footer and generic sidebar disclaimers are removed.")
print("PASS both solar panel-count methods and IRS Section 25D timing details are disclosed.")
print("PASS page-specific technical limits and source context remain.")
