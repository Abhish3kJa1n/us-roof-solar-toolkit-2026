const ORIGIN = "https://roof-solar-toolkit-2026.pages.dev";
const CANONICAL = "https://getroofsolarcalculator.online";

// Keep this list aligned with the canonical production sitemap in the site repo.
// The Worker probes the Pages origin and excludes paths that no longer return 200.
const PAGES = [
  "/",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/editorial-policy",
  "/methodology",
  "/electricity-prices-by-state",
  "/calculators/location-solar",
  "/calculators/roof-area",
  "/calculators/roof-replacement-cost",
  "/calculators/solar-panel-count",
  "/calculators/solar-savings",
  "/guides/are-solar-panels-worth-it",
  "/guides/metal-roof-cost",
  "/guides/metal-roof-vs-asphalt-shingles",
  "/guides/roof-before-solar",
  "/guides/roof-life-by-material",
  "/guides/roof-repair-cost",
  "/guides/roof-repair-vs-replacement",
  "/guides/roof-replacement-cost",
  "/guides/roof-replacement-cost-factors",
  "/guides/solar-installation-cost",
  "/guides/solar-loan-vs-lease-vs-ppa",
  "/guides/understanding-solar-bill-savings"
];

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function livePath(path) {
  try {
    const r = await fetch(ORIGIN + path, { method: "GET", redirect: "follow", cf: { cacheTtl: 300, cacheEverything: true } });
    if (r.status === 200) return path;
  } catch (e) {}
  if (path === "/") return null;
  const alt = path + ".html";
  try {
    const r2 = await fetch(ORIGIN + alt, { method: "GET", redirect: "follow", cf: { cacheTtl: 300, cacheEverything: true } });
    if (r2.status === 200) return alt;
  } catch (e) {}
  return null;
}

async function buildSitemap() {
  const results = await Promise.all(PAGES.map(livePath));
  let live = results.filter(Boolean);
  if (live.length === 0) live = ["/"];
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
    // Bump this version when sitemap/robots output changes to bypass stale edge-cache entries.
    const cacheKey = new Request(url.toString() + "?v=20261109-2", request);

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