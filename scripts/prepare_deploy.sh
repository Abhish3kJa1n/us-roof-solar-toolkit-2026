#!/bin/sh
# Build a clean public document root. Pages Functions remain at the repository root.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT="$ROOT/dist"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$ROOT"/*.html "$OUT/"
cp -R "$ROOT/assets" "$ROOT/calculators" "$ROOT/guides" "$ROOT/data" "$OUT/"
cp "$ROOT/robots.txt" "$ROOT/_headers" "$OUT/"
if [ -f "$ROOT/ads.txt" ]; then cp "$ROOT/ads.txt" "$OUT/"; fi
# Keep every Preview noindex. The public sitemap and indexing are enabled only
# for the main-branch Production build after the owner requested launch indexing.
if [ "${CF_PAGES_BRANCH:-}" = "main" ]; then
  # Production stays API-only unless this explicit build-time gate is enabled.
  if [ "${ADSENSE_MIDDLEWARE_ENABLED:-false}" = "true" ]; then
    cp "$ROOT/_routes.json" "$OUT/_routes.json"
  else
    printf '{\\n  "version": 1,\\n  "include": ["/api/*"],\\n  "exclude": []\\n}\\n' > "$OUT/_routes.json"
  fi
  find "$OUT" -type f -name '*.html' ! -name '404.html' -exec sed -i 's/<meta name="robots" content="noindex,follow"/<meta name="robots" content="index,follow"/g' {} \;
  sed -i '/X-Robots-Tag:/d' "$OUT/_headers"
  cp "$ROOT/sitemap.xml" "$OUT/"
  printf '\nSitemap: https://getroofsolarcalculator.online/sitemap.xml\n' >> "$OUT/robots.txt"
else
  # Exercise nonce-based CSP only on Preview HTML routes. Production keeps static
  # delivery for HTML and invokes Pages Functions only for the existing /api/* routes.
  {
    printf '{\n  "version": 1,\n  "include": ["/api/*", "/"'
    find "$OUT" -type f -name '*.html' ! -name '404.html' -print | LC_ALL=C sort | while IFS= read -r page; do
      route="/${page#"$OUT"/}"
      route="${route%.html}"
      [ "$route" = "/index" ] && route="/"
      [ "$route" = "/" ] && continue
      printf ',\n    "%s"' "$route"
    done
    printf '\n  ],\n  "exclude": []\n}\n'
  } > "$OUT/_routes.json"
fi
# Deliberately do not copy scripts, migrations, audit notes, source-status records,
# owner launch checklists, or example secrets. Production receives the reviewed sitemap.





