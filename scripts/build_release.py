#!/usr/bin/env python3
"""Build and verify a clean, reproducible ZIP release of the static website."""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / f"{ROOT.name}.zip"
MANIFEST = ROOT / "RELEASE-MANIFEST.sha256"
FIXED_ZIP_TIME = (2026, 11, 1, 0, 0, 0)

EXCLUDED_DIRS = {".git", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".venv", "venv", "node_modules", "dist", ".wrangler"}
EXCLUDED_FILES = {".DS_Store", "Thumbs.db", ".env", ".dev.vars", "launch-readiness.json", "sitemap.xml"}
EXCLUDED_PREFIXES = (".audit-inline-",)
EXCLUDED_SUFFIXES = (".pyc", ".pyo", ".tmp", ".swp", ".pem", ".key", "~")


def is_excluded(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    if any(part in EXCLUDED_DIRS for part in rel.parts):
        return True
    if path.name in EXCLUDED_FILES or path.name == MANIFEST.name or path.name.startswith(".env."):
        return True
    if path.name.startswith(EXCLUDED_PREFIXES):
        return True
    if path.name.endswith(EXCLUDED_SUFFIXES):
        return True
    return False


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def project_files() -> list[Path]:
    return sorted(
        (p for p in ROOT.rglob("*") if p.is_file() and not is_excluded(p)),
        key=lambda p: p.relative_to(ROOT).as_posix(),
    )


def write_manifest(files: list[Path]) -> None:
    lines = [f"{sha256(path)}  {path.relative_to(ROOT).as_posix()}" for path in files]
    MANIFEST.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def zip_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=FIXED_ZIP_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = (0o100644 & 0xFFFF) << 16
    return info


def verify_archive(archive_path: Path, expected_files: list[Path]) -> None:
    with zipfile.ZipFile(archive_path, "r") as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f"ZIP CRC check failed for {bad}")
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise RuntimeError("ZIP contains duplicate paths")
        if any("__pycache__" in name or name.endswith((".pyc", ".pyo")) for name in names):
            raise RuntimeError("ZIP unexpectedly contains Python cache files")
        expected = {p.relative_to(ROOT).as_posix() for p in expected_files} | {MANIFEST.name}
        if set(names) != expected:
            missing = sorted(expected - set(names))
            extra = sorted(set(names) - expected)
            raise RuntimeError(f"ZIP contents mismatch; missing={missing}, extra={extra}")

        manifest_content = archive.read(MANIFEST.name).decode("utf-8")
        listed: dict[str, str] = {}
        for line in manifest_content.splitlines():
            digest, relpath = line.split("  ", 1)
            listed[relpath] = digest
        actual_project_paths = expected - {MANIFEST.name}
        if set(listed) != actual_project_paths:
            raise RuntimeError("Manifest coverage does not match ZIP contents")
        for relpath, expected_digest in listed.items():
            actual_digest = hashlib.sha256(archive.read(relpath)).hexdigest()
            if actual_digest != expected_digest:
                raise RuntimeError(f"Manifest checksum mismatch: {relpath}")


def main() -> int:
    files = project_files()
    if not files:
        raise RuntimeError("No project files found")
    if not any(p.name == "index.html" and p.parent == ROOT for p in files):
        raise RuntimeError("Homepage index.html is missing")
    if len([p for p in files if p.suffix.lower() == ".html"]) != 26:
        raise RuntimeError("Expected exactly 26 HTML documents; inspect the project inventory")

    write_manifest(files)
    files = project_files()
    with zipfile.ZipFile(OUTPUT, "w") as archive:
        for path in files:
            rel = path.relative_to(ROOT).as_posix()
            archive.writestr(zip_info(rel), path.read_bytes())
        archive.writestr(zip_info(MANIFEST.name), MANIFEST.read_bytes())

    verify_archive(OUTPUT, files)
    size = OUTPUT.stat().st_size
    print(f"Release built: {OUTPUT}")
    print(f"Files in ZIP: {len(files) + 1} (including checksum manifest)")
    print(f"HTML documents: {sum(p.suffix.lower() == '.html' for p in files)}")
    print(f"ZIP size: {size:,} bytes")
    print("ZIP integrity: PASS")
    print("SHA-256 manifest coverage: PASS")
    print("Excluded caches / owner-only files: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
