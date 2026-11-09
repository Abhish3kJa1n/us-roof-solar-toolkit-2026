const ORIGIN = "https://roof-solar-toolkit-2026.pages.dev";
const CANONICAL = "https://getroofsolarcalculator.online";

// These paths mirror the canonical URLs in the repository's sitemap.xml.
// Keep the .html suffixes: the page-level rel=canonical tags use these URLs.
const PAGES = [
  "/",
  "/about.html",
  "/contact.html",
  "/editorial-policy.html",
  "/electricity-prices-by-state.html",
  "/methodology.html",
  "/privacy.html",
  "/terms.html",
  "/calculators/location-solar.html",
  "/calculators/roof-area.html",
  "/calculators/roof-replacement-cost.html",
  "/calculators/solar-panel-count.html",
  "/calculators/solar-savings.html",
  "/guides/are-solar-panels-worth-it.html",
  "/guides/metal-roof-cost.html",
  "/guides/metal-roof-vs-asphalt-shingles.html",
  "/guides/roof-before-solar.html",
  "/guides/roof-life-by-material.html",
  "/guides/roof-repair-cost.html",
  "/guides/roof-repair-vs-replacement.html",
  "/guides/roof-replacement-cost-factors.html",
  "/guides/roof-replacement-cost.html",
  "/guides/solar-installation-cost.html",
  "/guides/solar-loan-vs-lease-vs-ppa.html",
  "/guides/understanding-solar-bill-savings.html"
];

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function livePath(path) {
  try {
    const r = await fetch(ORIGIN + path, { method: "GET", redirect: "follow", cf: { cacheTtl: 300, cacheEverything: true } });
    if (r.status === 200) return path;
  } catch (e) {}
  return null;
}

async function buildSitemap() {
  const results = await Promise.all(PAGES.map(livePath));
  const live = results.filter(Boolean);
  const urls = live.map(p => "  <url><loc>" + esc(CANONICAL + p) + "</loc></url>").join("\n");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
         '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
         urls + '\n</urlset>\n';
}

async function buildRobots() {
  let base = "";
  try {
    const r = await fetch(ORIGIN + "/robots.txt", { redirect: "follow", cf: { cacheTtl: 300, cacheEverything: true } });
    if (r.status === 200) base = await r.text();
  } catch (e) {}
  // Drop any existing Sitemap: directives, then append the canonical one.
  base = base.split(/\r?\n/).filter(l => !/^\s*Sitemap:/i.test(l)).join("\n").replace(/\s+$/, "");
  const header = base && base.length ? base : "User-agent: *\nAllow: /";
  return header + "\n\nSitemap: " + CANONICAL + "/sitemap.xml\n";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cache = caches.default;
    // Bump this version whenever sitemap/robots output changes to bypass stale Cache API entries.
    const cacheKey = new Request(url.toString() + "?v=20261109-3", request);

    if (url.pathname === "/sitemap.xml") {
      let res = await cache.match(cacheKey);
      if (!res) {
        const xml = await buildSitemap();
        res = new Response(xml, {
          headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" }
        });
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }
      return res;
    }

    if (url.pathname === "/robots.txt") {
      let res = await cache.match(cacheKey);
      if (!res) {
        const txt = await buildRobots();
        res = new Response(txt, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" }
        });
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }
      return res;
    }

    return new Response("Not found", { status: 404 });
  }
};