#!/usr/bin/env python3
"""Guard the minimal, contextual-disclosure policy for homeowner tools."""
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CALCULATORS = (
    "calculators/location-solar.html",
    "calculators/roof-area.html",
    "calculators/roof-replacement-cost.html",
    "calculators/solar-panel-count.html",
    "calculators/solar-savings.html",
)
GENERIC_NOTICE = (
    "Planning estimates only. Results depend on the inputs and assumptions shown; "
    "they are not quotes, inspections, engineering designs, or guarantees."
)


def fail(message: str) -> None:
    raise SystemExit("FAIL: " + message)


def matching_div_end(source: str, opening_pos: int) -> int:
    """Return the end of a div, accounting for nested divs."""
    depth = 0
    for match in re.finditer(r"</?div\\b[^>]*>", source[opening_pos:], re.IGNORECASE):
        token = match.group(0)
        if token.startswith("</"):
            depth -= 1
            if depth == 0:
                return opening_pos + match.end()
        elif not token.rstrip().endswith("/>"):
            depth += 1
    fail("could not locate matching closing div")
    raise AssertionError("unreachable")


def check_result_method_note(relative: str, source: str, result_id: str = "result") -> None:
    marker = 'class="calculator-method-note"'
    if source.count(marker) != 1:
        fail(f"{relative} must have one concise method note")
    result_pos = source.find(f'id="{result_id}"')
    if result_pos < 0:
        fail(f"{relative} is missing its result container")
    result_tag = source.rfind("<div", 0, result_pos)
    result_end = matching_div_end(source, result_tag)
    note_pos = source.find('<div class="calculator-method-note"', result_end)
    if note_pos < 0 or source[result_end:note_pos].strip():
        fail(f"{relative} method note must immediately follow the result")
    if GENERIC_NOTICE in source:
        fail(f"{relative} still contains the generic site-wide disclaimer")
    if '<div class="wrap disclaimer">' in source:
        fail(f"{relative} still has a repeated footer disclaimer")


def check_calculator(relative: str) -> str:
    source = (ROOT / relative).read_text(encoding="utf-8")
    if 'class="calculator-notice"' in source:
        fail(f"{relative} must not display a generic warning banner")
    if "Educational resource · Estimates only" in source:
        fail(f"{relative} still uses an unnecessary estimates-only label")
    check_result_method_note(relative, source)

    required = {
        "calculators/location-solar.html": (
            "representative city point",
            "PVWatts V8 estimates typical-year output",
            "Production is not bill savings",
        ),
        "calculators/roof-area.html": (
            "Estimate = building footprint × pitch factor",
            "Measure separate roof planes for complex layouts and overhangs",
        ),
        "calculators/roof-replacement-cost.html": (
            "Published U.S. cost references",
            "Historical Census roofing expenditure",
            "Match the rate to the work scope",
        ),
        "calculators/solar-panel-count.html": (
            "Quoted-size path",
            "annual production is not calculated by this method",
            "Check the panel layout against your roof",
        ),
        "calculators/solar-savings.html": (
            "System size = target annual generation",
            "Model assumptions",
            "Enter an export credit to value surplus generation",
            "December 31, 2025",
        ),
    }[relative]
    for detail in required:
        if detail not in source:
            fail(f"{relative} lost useful input or calculation context: {detail}")

    if relative == "calculators/solar-panel-count.html" and "Federal Section 25D" in source:
        fail("panel-count calculator must not carry irrelevant tax-credit disclosure")
    if relative == "calculators/solar-savings.html":
        if source.count('href="https://www.irs.gov/') != 1:
            fail("solar-savings tax-credit note must link to IRS guidance once")
        if "not a guarantee" in source.lower():
            fail("solar-savings page repeats generic guarantee language")
    return source


def main() -> None:
    for page in CALCULATORS:
        check_calculator(page)
        print(f"PASS {page}: concise method note, no generic banner, relevant detail retained")

    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    if 'class="calculator-notice"' in homepage or ".calculator-notice {" in homepage:
        fail("homepage still has generic calculator-notice markup or styling")
    if GENERIC_NOTICE in homepage or "resultWarning" in homepage:
        fail("homepage still contains a generic or dynamically generated warning block")
    if homepage.count('class="calculator-method-note"') != 1:
        fail("homepage must show one compact combined-calculator method note")
    check_result_method_note("index.html", homepage, result_id="results")
    homepage_js = (ROOT / "assets/js/homepage-1.js").read_text(encoding="utf-8")
    if "resultWarning" in homepage_js or "warnings.join(" in homepage_js:
        fail("combined calculator must not append a global warning paragraph after calculation")
    if "Roof fit is not assessed" in homepage_js:
        fail("combined calculator must not repeat roof-fit warnings in result descriptions")
    if "December 31, 2025" not in homepage:
        fail("homepage solar-incentive FAQ must retain the current federal credit cutoff")
    print("PASS homepage: no banner or post-calculation warning paragraph; one method note and relevant tax FAQ")

    state_page = (ROOT / "electricity-prices-by-state.html").read_text(encoding="utf-8")
    if "statewide average" not in state_page.lower() or "utility tariff" not in state_page.lower():
        fail("state-price page must clearly distinguish the EIA average from a utility tariff")
    if '<div class="wrap disclaimer">' in state_page:
        fail("state-price page repeats its tariff explanation in the footer")
    print("PASS electricity-price page: one useful statewide-average versus tariff distinction")

    contact = (ROOT / "contact.html").read_text(encoding="utf-8")
    if "passwords" not in contact or "unredacted utility bill" not in contact:
        fail("contact page must retain the concise sensitive-information warning")
    if "reply or correction is not guaranteed" in contact.lower():
        fail("contact page still has defensive response disclaimers")
    print("PASS contact page: useful privacy protection retained without defensive response disclaimer")

    terms = (ROOT / "terms.html").read_text(encoding="utf-8")
    for legal_detail in ("not inspections", "financial or tax advice", "Check important decisions independently"):
        if legal_detail not in terms:
            fail(f"Terms of Use lost important legal detail: {legal_detail}")
    print("PASS Terms of Use: substantive legal protections remain centralized")

    print("PASS minimal contextual-disclosure policy across the audited public pages")


if __name__ == "__main__":
    main()
