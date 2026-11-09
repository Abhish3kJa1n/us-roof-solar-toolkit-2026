const ORIGIN = "https://roof-solar-toolkit-2026.pages.dev";
const CANONICAL = "https://getroofsolarcalculator.online";

async function buildSitemap() {
  // The Pages build publishes the repository's sitemap.xml. Read that file
  // instead of maintaining a second URL inventory in this Worker.
  const response = await fetch(ORIGIN + "/sitemap.xml", {
    method: "GET",
    redirect: "follow",
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) {
    throw new Error("Upstream sitemap returned HTTP " + response.status);
  }

  const xml = await response.text();
  if (!/<urlset\b[^>]*xmlns=["']https?:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(xml)) {
    throw new Error("Upstream response is not a valid sitemap urlset");
  }

  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim());
  if (locations.length === 0 || locations.some((url) => !url.startsWith(CANONICAL + "/"))) {
    throw new Error("Upstream sitemap is empty or contains non-canonical URLs");
  }
  if (new Set(locations).size !== locations.length) {
    throw new Error("Upstream sitemap contains duplicate URLs");
  }

  return xml;
}

async function buildRobots() {
  const response = await fetch(ORIGIN + "/robots.txt", {
    redirect: "follow",
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) {
    throw new Error("Upstream robots.txt returned HTTP " + response.status);
  }

  let base = await response.text();
  // Keep one canonical sitemap directive, regardless of the upstream copy.
  base = base.split(/\r?\n/).filter((line) => !/^\s*Sitemap:/i.test(line)).join("\n").replace(/\s+$/, "");
  return (base || "User-agent: *\nAllow: /") + "\n\nSitemap: " + CANONICAL + "/sitemap.xml\n";
}

function unavailable(message) {
  return new Response("Temporary SEO file generation failure: " + message, {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": "300",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== "/sitemap.xml" && url.pathname !== "/robots.txt") {
      return new Response("Not found", { status: 404 });
    }

    const cache = caches.default;
    // Bump this version whenever the Worker response logic changes.
    const cacheKey = new Request(url.origin + url.pathname + "?v=20261110-1", request);
    let response = await cache.match(cacheKey);
    if (response) return response;

    try {
      if (url.pathname === "/sitemap.xml") {
        const xml = await buildSitemap();
        response = new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      } else {
        const txt = await buildRobots();
        response = new Response(txt, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      }
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return unavailable(error instanceof Error ? error.message : "unknown upstream error");
    }
  },
};
