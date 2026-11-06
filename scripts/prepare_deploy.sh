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
if [ -f "$ROOT/ads.txt" ]; then cp "$ROOT/ads.txt" "$OUT/"; fi
# Keep every Preview noindex. The public sitemap and indexing are enabled only
# for the main-branch Production build after the owner requested launch indexing.
if [ "${CF_PAGES_BRANCH:-}" = "main" ]; then
  find "$OUT" -type f -name '*.html' ! -name '404.html' -exec sed -i 's/<meta name="robots" content="noindex,follow"/<meta name="robots" content="index,follow"/g' {} \;
  sed -i '/^[[:space:]]*X-Robots-Tag:/Id' "$OUT/_headers"
  cp "$ROOT/sitemap.xml" "$OUT/"
  printf '\nSitemap: https://getroofsolarcalculator.online/sitemap.xml\n' >> "$OUT/robots.txt"
fi
# Deliberately do not copy scripts, migrations, audit notes, source-status records,
# owner launch checklists, or example secrets. Production receives the reviewed sitemap.





