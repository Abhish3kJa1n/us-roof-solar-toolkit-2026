#!/usr/bin/env python3
"""Configure canonical URLs and indexing for a static Roof & Solar Toolkit site.

Safe default: retain noindex and do not create a sitemap. Indexing is opt-in and
should only be enabled after the owner checklist is complete. The 404 page remains
noindex and is excluded from the sitemap in either mode.
"""
from __future__ import annotations

import argparse
from datetime import date
from html import escape
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_RELEASE_GATES = {
    "publisher_identity_verified": "Publisher identity and monitored contact are accurate",
    "domain_and_brand_clearance_verified": "Final domain and brand clearance are complete",
    "authorship_and_expert_reviews_verified": "Real authors and qualified reviewers are confirmed",
    "original_content_review_complete": "Every indexable page has been reviewed for original user value",
    "calculator_validation_complete": "Calculators are independently validated against real examples",
    "legal_privacy_and_terms_review_complete": "Privacy, terms and advertising disclosures have qualified review",
    "accessibility_manual_testing_complete": "Keyboard, screen-reader, zoom and mobile tests are complete",
    "production_deployment_verified": "Production HTTPS, redirects, headers and assets are verified",
    "official_data_rechecked": "All time-sensitive official data and claims are rechecked",
}


def validate_readiness_file(path: Path) -> None:
    """Require explicit owner sign-off before changing a site from noindex to index."""
    if not path.is_file():
        raise ValueError(
            f"Readiness file not found: {path}. Copy launch-readiness.template.json "
            "to launch-readiness.json and complete it only after each gate is genuinely met."
        )
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read valid JSON from readiness file: {exc}") from exc
    if not isinstance(data, dict) or data.get("version") != 1:
        raise ValueError("Readiness file must be a JSON object with version: 1")
    reviewer = data.get("attested_by")
    if not isinstance(reviewer, str) or len(reviewer.strip()) < 3 or "placeholder" in reviewer.lower():
        raise ValueError("Readiness file must identify the real person attesting to launch readiness")
    attested_on = data.get("attested_on")
    try:
        attestation_date = date.fromisoformat(attested_on) if isinstance(attested_on, str) else None
    except ValueError:
        attestation_date = None
    if not attestation_date or attestation_date > date.today():
        raise ValueError("attested_on must be a valid ISO date no later than today")
    checks = data.get("checks")
    evidence = data.get("evidence")
    if not isinstance(checks, dict) or not isinstance(evidence, dict):
        raise ValueError("Readiness file must contain checks and evidence objects")
    incomplete = []
    for key, description in REQUIRED_RELEASE_GATES.items():
        note = evidence.get(key)
        if checks.get(key) is not True or not isinstance(note, str) or len(note.strip()) < 12:
            incomplete.append(description)
    if incomplete:
        raise ValueError("Launch readiness is incomplete. Outstanding gates: " + "; ".join(incomplete))


def validate_domain(raw: str) -> str:
    value = raw.strip().rstrip("/")
    if not value.startswith("https://"):
        raise ValueError("Use the final HTTPS origin, e.g. https://www.example.com")
    parts = urlsplit(value)
    if not parts.netloc or parts.path or parts.query or parts.fragment or parts.username or parts.password:
        raise ValueError("Pass only the HTTPS origin; do not include a path, query, or credentials")
    try:
        port = parts.port
    except ValueError as exc:
        raise ValueError("Domain has an invalid port") from exc
    if port not in (None, 443):
        raise ValueError("Production canonical origin must use the default HTTPS port")
    host = parts.hostname or ""
    if not host or host.endswith("."):
        host = host.rstrip(".")
    try:
        host = host.encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise ValueError("Provide a valid internationalized domain name") from exc
    labels = host.split(".")
    if len(labels) < 2 or any(
        not label or len(label) > 63
        or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", label)
        for label in labels
    ):
        raise ValueError("Provide a valid fully-qualified DNS hostname")
    if len(host) > 253:
        raise ValueError("Hostname is too long")
    # Default HTTPS port is normalized away so canonical URLs are stable.
    return f"https://{host}"


def upsert_meta(html: str, *, name: str, content: str) -> str:
    pattern = re.compile(r"<meta\b(?=[^>]*\bname\s*=\s*(['\"])" + re.escape(name) + r"\1)[^>]*>", re.I)
    replacement = f'<meta name="{name}" content="{escape(content, quote=True)}" />'
    if pattern.search(html):
        return pattern.sub(replacement, html, count=1)
    return re.sub(r"</head>", replacement + "\n</head>", html, count=1, flags=re.I)


def upsert_property(html: str, *, prop: str, content: str) -> str:
    pattern = re.compile(r"<meta\b(?=[^>]*\bproperty\s*=\s*(['\"])" + re.escape(prop) + r"\1)[^>]*>", re.I)
    replacement = f'<meta property="{prop}" content="{escape(content, quote=True)}" />'
    if pattern.search(html):
        return pattern.sub(replacement, html, count=1)
    return re.sub(r"</head>", replacement + "\n</head>", html, count=1, flags=re.I)


def upsert_canonical(html: str, url: str) -> str:
    pattern = re.compile(r"<link\b(?=[^>]*\brel\s*=\s*(['\"])canonical\1)[^>]*>", re.I)
    replacement = f'<link rel="canonical" href="{escape(url, quote=True)}" />'
    if pattern.search(html):
        return pattern.sub(replacement, html, count=1)
    return re.sub(r"</head>", replacement + "\n</head>", html, count=1, flags=re.I)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain", required=True, help="Final HTTPS origin, e.g. https://www.example.com")
    parser.add_argument("--enable-indexing", action="store_true", help="Remove noindex and generate sitemap.xml; requires a completed launch attestation")
    parser.add_argument("--readiness-file", default="launch-readiness.json", help="Owner-completed JSON attestation file required with --enable-indexing (default: launch-readiness.json)")
    args = parser.parse_args()

    try:
        origin = validate_domain(args.domain)
    except ValueError as exc:
        parser.error(str(exc))

    if args.enable_indexing:
        readiness_path = Path(args.readiness_file)
        if not readiness_path.is_absolute():
            readiness_path = ROOT / readiness_path
        try:
            validate_readiness_file(readiness_path)
        except ValueError as exc:
            print(f"Indexing blocked: {exc}", file=sys.stderr)
            return 2

    pages = sorted(p for p in ROOT.rglob("*.html") if "dist" not in p.relative_to(ROOT).parts)
    if not pages:
        print("No HTML pages found", file=sys.stderr)
        return 2

    page_urls: list[str] = []
    for page in pages:
        rel = page.relative_to(ROOT).as_posix()
        is_error_page = rel == "404.html"
        path = "/" if rel == "index.html" else "/" + rel
        canonical_url = origin + path
        html = page.read_text(encoding="utf-8")
        # A 404 document is an error response, not an indexable landing page.
        # Keep it noindex and out of the sitemap even after indexing is enabled.
        if not is_error_page:
            html = upsert_canonical(html, canonical_url)
            html = upsert_property(html, prop="og:url", content=canonical_url)
        html = upsert_meta(
            html,
            name="robots",
            content="noindex,follow" if (is_error_page or not args.enable_indexing) else "index,follow",
        )
        page.write_text(html, encoding="utf-8")
        if not is_error_page:
            page_urls.append(canonical_url)

    robots_path = ROOT / "robots.txt"
    base_robots = "User-agent: *\nAllow: /\n"
    robots_text = base_robots
    if args.enable_indexing:
        base_robots += f"\nSitemap: {origin}/sitemap.xml\n"
        entries = "\n".join(
            f"  <url><loc>{escape(url)}</loc></url>" for url in page_urls
        )
        sitemap = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{entries}\n"
            "</urlset>\n"
        )
        (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8")
        headers_path = ROOT / "_headers"
        if headers_path.exists():
            headers_text = headers_path.read_text(encoding="utf-8")
            headers_text = re.sub(r"^\s*X-Robots-Tag:\s*noindex,?\s*follow\s*\n", "", headers_text, flags=re.I | re.M)
            headers_path.write_text(headers_text, encoding="utf-8")
        print(f"Indexing enabled after launch attestation. Generated sitemap.xml with {len(page_urls)} URLs.")
    else:
        (ROOT / "sitemap.xml").unlink(missing_ok=True)
        headers_path = ROOT / "_headers"
        if headers_path.exists():
            headers_text = headers_path.read_text(encoding="utf-8")
            if not re.search(r"^\s*X-Robots-Tag:", headers_text, flags=re.I | re.M):
                headers_text = re.sub(
                    r"^(\s*/\*\s*\n)",
                    r"\1  X-Robots-Tag: noindex, follow\n",
                    headers_text,
                    count=1,
                )
            else:
                headers_text = re.sub(
                    r"^\s*X-Robots-Tag:.*$",
                    "  X-Robots-Tag: noindex, follow",
                    headers_text,
                    count=1,
                    flags=re.I | re.M,
                )
            headers_path.write_text(headers_text, encoding="utf-8")
        robots_text = base_robots
        print("Safe mode: noindex retained; no sitemap.xml generated.")

    if args.enable_indexing:
        robots_text = base_robots
    robots_path.write_text(robots_text, encoding="utf-8")
    print(f"Configured {len(page_urls)} canonical URLs for {origin}")
    if not args.enable_indexing:
        print("To enable indexing later, complete launch-readiness.template.json as launch-readiness.json and rerun with --enable-indexing only after every gate is genuinely met.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
