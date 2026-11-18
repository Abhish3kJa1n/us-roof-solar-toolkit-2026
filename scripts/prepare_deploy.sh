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
# Give visitors a consistent path to the HTML sitemap from every public page footer.
find "$OUT" -type f -name '*.html' ! -name '404.html' ! -name 'index.html' -exec sed -i \
  -e 's#</div></div><div class="wrap disclaimer">#<a href="/sitemap">Site map</a></div></div><div class="wrap disclaimer">#g' \
  -e 's#</div></div></footer>#<a href="/sitemap">Site map</a></div></div></footer>#g' {} +
if [ -f "$ROOT/ads.txt" ]; then cp "$ROOT/ads.txt" "$OUT/"; fi
# Route every public HTML document through Pages Functions in both Preview and
# Production. Previously Production defaulted to API-only routing, silently
# bypassing the nonce/CSP and Google-tag middleware while Preview QA passed.
# AdSense itself remains separately gated by ADSENSE_ENABLED in the middleware.
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

# Keep every Preview noindex. The public sitemap and indexing are enabled only
# for the main-branch Production build after the owner requested launch indexing.
if [ "${CF_PAGES_BRANCH:-}" = "main" ]; then
  find "$OUT" -type f -name '*.html' ! -name '404.html' -exec sed -i 's/<meta name="robots" content="noindex,follow"/<meta name="robots" content="index,follow"/g' {} \;
  sed -i '/X-Robots-Tag:/d' "$OUT/_headers"
  cp "$ROOT/sitemap.xml" "$OUT/"
  printf '\nSitemap: https://getroofsolarcalculator.online/sitemap.xml\n' >> "$OUT/robots.txt"
fi
# A no-store identity endpoint lets browser QA verify it is testing this exact Preview commit.
if [ "${CF_PAGES_BRANCH:-}" != "main" ]; then
  PREVIEW_COMMIT="${CF_PAGES_COMMIT_SHA:-unknown}"
  PREVIEW_BRANCH="${CF_PAGES_BRANCH:-unknown}"
  printf '{"commit":"%s","branch":"%s"}\n' "$PREVIEW_COMMIT" "$PREVIEW_BRANCH" > "$OUT/build-info.json"
fi
# Deliberately do not copy scripts, migrations, audit notes, source-status records,
# owner launch checklists, or example secrets. Production receives the reviewed sitemap.
