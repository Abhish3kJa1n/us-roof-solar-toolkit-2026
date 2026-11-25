#!/usr/bin/env python3
"""Enforce the two-part disclosure layout without deleting calculator-specific limits."""
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
NOTICE = "Planning estimates based on 2026 public benchmarks — not a contractor quote or engineering inspection."
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
        "does not assess roof fit",
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

def fail(message: str) -> None:
    raise SystemExit("FAIL: " + message)

def check_page(relative: str) -> None:
    source = (ROOT / relative).read_text(encoding="utf-8")
    if source.count('class="calculator-notice"') != 1:
        fail(f"{relative} must have exactly one top planning notice")
    if NOTICE not in source:
        fail(f"{relative} is missing the approved top notice wording")
    if source.count('class="calculator-method-note"') != 1:
        fail(f"{relative} must have exactly one result-adjacent methodology note")
    result_pos = source.find('id="result"')
    note_pos = source.find('class="calculator-method-note"')
    if result_pos < 0 or note_pos < result_pos:
        fail(f"{relative} methodology note must follow the calculator result")
    if '<div class="wrap disclaimer">' in source:
        fail(f"{relative} still repeats a shared footer disclaimer")
    if '<aside class="sidecol">' in source:
        fail(f"{relative} still repeats the generic Important sidebar")
    if "Calculation notes: see" in source or 'aria-label="Calculation documentation"' in source:
        fail(f"{relative} retains a duplicate methodology preamble")
    for detail in REQUIRED_PAGE_DETAILS[relative]:
        if detail not in source:
            fail(f"{relative} lost a page-specific explanation: {detail}")
    if relative in SOLAR_PAGES_WITH_TAX_NOTE:
        note = re.search(r'<div class="calculator-method-note" role="note">([\s\S]*?)</div>', source)
        if not note or "Federal Section 25D" not in note.group(1) or "December 31, 2025" not in note.group(1):
            fail(f"{relative} must disclose the current Section 25D timing rule once, below results")
        if source.count("Federal Section 25D") != 1:
            fail(f"{relative} repeats the Section 25D timing disclosure")

for page in PAGES:
    check_page(page)

index = (ROOT / "index.html").read_text(encoding="utf-8")
if index.count('class="calculator-notice"') != 1 or NOTICE not in index:
    fail("index.html must have exactly one approved top planning notice")
if index.count('class="calculator-method-note"') != 1:
    fail("index.html must have exactly one combined methodology/Section 25D note")
if index.count("Federal Section 25D") != 1:
    fail("index.html must disclose Section 25D timing once")
if '<div class="disclaimer"><strong>Planning estimates:' in index:
    fail("index.html still repeats the footer planning disclaimer")
if '<div class="hero-note">' in index:
    fail("index.html still repeats the planning disclosure in the hero")
if "See the Section 25D note below the results" in index:
    fail("index.html still repeats the tax-credit warning before results")
if index.find('class="calculator-method-note"') < index.find('id="results"'):
    fail("index.html methodology note must follow the combined estimator results")

print("PASS homepage and all five standalone calculators use one top notice and one result-adjacent method note.")
print("PASS repeated footer and generic sidebar disclaimers are removed.")
print("PASS page-specific technical limits and the relevant Section 25D notice remain.")
