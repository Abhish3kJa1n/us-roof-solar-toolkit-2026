#!/bin/sh
# Build a clean public document root. Pages Functions remain at the repository root.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT="$ROOT/dist"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$ROOT"/*.html "$OUT/"
cp -R "$ROOT/assets" "$ROOT/calculators" "$ROOT/guides" "$ROOT/data" "$OUT/"
cp "$ROOT/robots.txt" "$ROOT/_headers" "$ROOT/_routes.json" "$OUT/"
# Deliberately do not copy scripts, migrations, audit notes, source-status records,
# owner launch checklists, example secrets, or the sitemap template into public assets.
