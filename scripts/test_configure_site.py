#!/usr/bin/env python3
"""Integration tests for the canonical/indexing configuration helper."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(project: Path, *args: str, expect: int = 0) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["python", str(project / "scripts" / "configure_site.py"), *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != expect:
        raise AssertionError(
            f"Command returned {result.returncode}, expected {expect}: {args}\n"
            f"stdout={result.stdout}\nstderr={result.stderr}"
        )
    return result


def clone(destination: Path) -> Path:
    shutil.copytree(
        ROOT,
        destination,
        ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", "*.pyc", "sitemap.xml", "dist", ".wrangler"),
    )
    return destination


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="roofsolar-config-test-") as tmp:
        base = Path(tmp)
        project = clone(base / "site")
        html_files = sorted(project.rglob("*.html"))
        if len(html_files) != 25:
            raise AssertionError(f"Expected 25 HTML pages including 404, found {len(html_files)}")

        # Initial safe setup: canonical tags are written, index is blocked, no sitemap.
        run(project, "--domain", "https://www.example.com")
        for page in project.rglob("*.html"):
            source = page.read_text(encoding="utf-8")
            if '<meta name="robots" content="noindex,follow" />' not in source:
                raise AssertionError(f"Safe mode did not keep noindex: {page.relative_to(project)}")
            if page.name == "404.html":
                if "canonical" in source.lower() or "og:url" in source.lower():
                    raise AssertionError("404 page must not receive canonical or OG URL tags")
            elif "https://www.example.com" not in source:
                raise AssertionError(f"Canonical/OG URL missing: {page.relative_to(project)}")
        headers = (project / "_headers").read_text(encoding="utf-8")
        if not re.search(r"^\s*X-Robots-Tag:\s*noindex,\s*follow\s*$", headers, re.I | re.M):
            raise AssertionError("Safe mode missing X-Robots-Tag")
        if (project / "sitemap.xml").exists():
            raise AssertionError("Safe mode must not create sitemap.xml")
        error_page = (project / "404.html").read_text(encoding="utf-8")
        if "canonical" in error_page.lower() or "og:url" in error_page.lower():
            raise AssertionError("404 page must not have a canonical URL")
        if "Sitemap:" in (project / "robots.txt").read_text(encoding="utf-8"):
            raise AssertionError("Safe mode must not advertise a sitemap")

        # Indexing must be blocked without a readiness attestation and must not mutate files.
        blocked = run(project, "--domain", "https://www.example.com", "--enable-indexing", expect=2)
        if "Indexing blocked" not in blocked.stderr:
            raise AssertionError("Indexing without readiness attestation was not clearly blocked")
        if (project / "sitemap.xml").exists():
            raise AssertionError("Blocked indexing attempt unexpectedly generated sitemap.xml")
        if 'content="noindex,follow"' not in (project / "index.html").read_text(encoding="utf-8"):
            raise AssertionError("Blocked indexing attempt unexpectedly removed noindex")

        # A complete, dated attestation is required before indexing is enabled.
        gates = [
            "publisher_identity_verified",
            "domain_and_brand_clearance_verified",
            "authorship_and_expert_reviews_verified",
            "original_content_review_complete",
            "calculator_validation_complete",
            "legal_privacy_and_terms_review_complete",
            "accessibility_manual_testing_complete",
            "production_deployment_verified",
            "official_data_rechecked",
        ]
        readiness = {
            "version": 1,
            "attested_by": "Test Release Reviewer",
            "attested_on": "2026-10-31",
            "checks": {gate: True for gate in gates},
            "evidence": {gate: "Test evidence record reference for automated release-gate test." for gate in gates},
        }
        readiness_path = project / "launch-readiness.test.json"
        readiness_path.write_text(json.dumps(readiness), encoding="utf-8")

        # Indexing is opt-in and generates a complete, current list without fake lastmod dates.
        run(project, "--domain", "https://www.example.com", "--enable-indexing", "--readiness-file", readiness_path.name)
        sitemap = (project / "sitemap.xml").read_text(encoding="utf-8")
        if sitemap.count("<url><loc>") != 24:
            raise AssertionError("Sitemap must contain 24 content URLs and exclude 404")
        if "404.html" in sitemap:
            raise AssertionError("Sitemap must never include the 404 page")
        if '<meta name="robots" content="noindex,follow" />' not in (project / "404.html").read_text(encoding="utf-8"):
            raise AssertionError("404 must remain noindex after indexing is enabled")
        if "<lastmod>" in sitemap:
            raise AssertionError("Sitemap must not fabricate last-modified dates")
        for page in project.rglob("*.html"):
            source = page.read_text(encoding="utf-8")
            expected_robots = 'noindex,follow' if page.name == "404.html" else 'index,follow'
            if f'<meta name="robots" content="{expected_robots}" />' not in source:
                raise AssertionError(f"Indexing mode has wrong robots meta: {page.relative_to(project)}")
        headers = (project / "_headers").read_text(encoding="utf-8")
        if re.search(r"^\s*X-Robots-Tag:\s*noindex", headers, re.I | re.M):
            raise AssertionError("Indexing mode left X-Robots-Tag noindex in place")
        if "Sitemap: https://www.example.com/sitemap.xml" not in (project / "robots.txt").read_text(encoding="utf-8"):
            raise AssertionError("Indexing mode did not add sitemap URL to robots.txt")

        # A false or empty gate must block indexing.
        readiness["checks"]["calculator_validation_complete"] = False
        readiness_path.write_text(json.dumps(readiness), encoding="utf-8")
        run(project, "--domain", "https://www.example.com", "--enable-indexing", "--readiness-file", readiness_path.name, expect=2)

        # Reverting to safe mode must restore both HTML and the response-header noindex.
        run(project, "--domain", "https://www.example.com")
        headers = (project / "_headers").read_text(encoding="utf-8")
        if not re.search(r"^\s*X-Robots-Tag:\s*noindex,\s*follow\s*$", headers, re.I | re.M):
            raise AssertionError("Returning to safe mode failed to restore X-Robots-Tag")
        if (project / "sitemap.xml").exists():
            raise AssertionError("Returning to safe mode did not remove sitemap.xml")

        # Domain validation rejects paths, HTTP, credentials, unsafe ports and malformed names.
        bad_domains = [
            "http://www.example.com",
            "https://www.example.com/path",
            "https://user:pass@www.example.com",
            "https://www.example.com:8443",
            "https://bad_domain.example",
            "https://ex ample.com",
        ]
        for domain in bad_domains:
            run(project, "--domain", domain, expect=2)

        # Default HTTPS port and IDN should normalize to stable ASCII HTTPS origins.
        from importlib.util import spec_from_file_location, module_from_spec
        spec = spec_from_file_location("configure_site", project / "scripts" / "configure_site.py")
        assert spec and spec.loader
        module = module_from_spec(spec)
        spec.loader.exec_module(module)
        if module.validate_domain("https://WWW.Example.com:443/") != "https://www.example.com":
            raise AssertionError("Default HTTPS port/host normalization failed")
        if module.validate_domain("https://bücher.example") != "https://xn--bcher-kva.example":
            raise AssertionError("IDN normalization failed")

    print("PASS: safe mode, attestation-required index mode, incomplete-gate rejection, revert-to-safe mode, sitemap, robots, canonical tags and invalid-domain cases.")
    print("Limit: tests script behavior on a temporary local copy, not live DNS, HTTPS, host headers or search engine crawling.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
