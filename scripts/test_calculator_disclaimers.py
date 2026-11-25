#!/usr/bin/env python3
"""Keep shared calculator disclaimers concise without deleting page-specific caveats."""
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PAGES = (
    "calculators/location-solar.html",
    "calculators/roof-area.html",
    "calculators/roof-replacement-cost.html",
    "calculators/solar-panel-count.html",
    "calculators/solar-savings.html",
)
EXPECTED = (
    "For planning only. Estimates are not quotes, guarantees or professional advice. "
    "Verify measurements, site conditions, prices, utility rules and eligibility with qualified local sources."
)
PAGE_SPECIFIC = {
    "calculators/location-solar.html": (
        "The city point is a Census representative location, not a property address.",
        "PVWatts V8 models typical-year production",
    ),
    "calculators/roof-area.html": (
        "living area is not necessarily the same as building footprint",
    ),
    "calculators/solar-panel-count.html": (
        "The estimate is arithmetic, not a roof layout or final system design.",
    ),
    "calculators/solar-savings.html": (
        "A blank export credit is unknown, not zero.",
        "The Residential Clean Energy Credit under Section 25D",
    ),
}

def fail(message: str) -> None:
    raise SystemExit("FAIL: " + message)

for relative in PAGES:
    source = (ROOT / relative).read_text(encoding="utf-8")
    matches = re.findall(
        '<div class="wrap disclaimer">(.+?)</div>',
        source,
        flags=re.I | re.S,
    )
    if len(matches) != 1:
        fail(f"{relative} must have exactly one shared footer disclaimer; found {len(matches)}")
    plain = re.sub("<[^>]+>", "", matches[0])
    plain = " ".join(plain.split())
    if plain != EXPECTED:
        fail(f"{relative} shared footer disclaimer is not the concise approved text: {plain!r}")
    for required in PAGE_SPECIFIC.get(relative, ()):
        if required not in source:
            fail(f"{relative} lost a page-specific warning: {required}")

print(f"PASS all {len(PAGES)} standalone calculators use one concise shared footer disclaimer.")
print("PASS page-specific location, roof-area, panel-layout and solar-model limitations remain in place.")
