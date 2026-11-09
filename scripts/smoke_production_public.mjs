#!/usr/bin/env node
import assert from "node:assert/strict";

const PAGES_ORIGIN = "https://roof-solar-toolkit-2026.pages.dev";
const APEX = "https://getroofsolarcalculator.online";
const WWW = "https://www.getroofsolarcalculator.online";
const PUBLISHER_ID = "ca-pub-6193507831935325";
const ADS_TXT_RECORD = "google.com, pub-6193507831935325, DIRECT, f08c47fec0942fa0";

async function get(url, accept = "*/*") {
  return fetch(url, {
    headers: {
      Accept: accept,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
}

async function getText(url, accept) {
  const response = await get(url, accept);
  return { response, body: await response.text() };
}

function assertSecurityHeaders(response, path) {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", path + ": missing nosniff header");
  const xfo = (response.headers.get("x-frame-options") || "").toUpperCase();
  const csp = response.headers.get("content-security-policy") || "";
  // The Pages hostname returns DENY while the proxied custom domain currently
  // returns SAMEORIGIN. Both block cross-origin framing; CSP frame-ancestors
  // none is the authoritative modern-browser control and also blocks same-origin
  // framing. Keep the edge discrepancy visible as a warning rather than masking
  // it or failing before the rest of the production checks can run.
  assert.ok(xfo === "DENY" || xfo === "SAMEORIGIN", path + ": missing or permissive X-Frame-Options");
  assert.match(csp, /(?:^|;)\s*frame-ancestors\s+'none'(?:;|$)/i, path + ": CSP must block all framing");
  if (xfo !== "DENY") console.warn("WARN: " + path + " returns X-Frame-Options " + xfo + "; CSP frame-ancestors 'none' still blocks framing in CSP-capable browsers.");
  const referrerPolicy = (response.headers.get("referrer-policy") || "").toLowerCase();
  assert.ok(
    referrerPolicy === "strict-origin-when-cross-origin" || referrerPolicy === "same-origin",
    path + ": missing or unexpectedly permissive Referrer-Policy",
  );
  if (referrerPolicy !== "strict-origin-when-cross-origin") {
    console.warn("WARN: " + path + " returns Referrer-Policy " + referrerPolicy + "; this is more restrictive cross-origin than strict-origin-when-cross-origin.");
  }
  assert.ok(csp.includes("script-src 'self'"), path + ": Production CSP missing or unexpectedly changed");
}

function isCloudflareBrowserChallenge(response, body) {
  return response.status === 403
    && response.headers.get("server") === "cloudflare"
    && Boolean(response.headers.get("cf-ray"))
    && /<title>Just a moment\.\.\.<\/title>/i.test(body)
    && /challenges\.cloudflare\.com/i.test(body);
}

// A Pages project hostname is used for content verification because it bypasses
// the zone's Browser Integrity Check. The custom-domain probe below records
// whether a real non-browser runner is challenged at the edge.
const home = await getText(PAGES_ORIGIN + "/", "text/html");
assert.equal(home.response.status, 200, "Production Pages project hostname must return HTTP 200");
assert.match(home.response.headers.get("content-type") || "", /^text\/html\b/i);
assertSecurityHeaders(home.response, "Pages project /");
assert.match(home.body, /<meta\s+name=["']robots["']\s+content=["']index,follow["']/i, "Production homepage must be indexable");
assert.doesNotMatch(home.body, /<meta\s+name=["']robots["'][^>]*noindex/i);
assert.doesNotMatch(home.response.headers.get("x-robots-tag") || "", /noindex/i);
assert.match(
  home.body,
  new RegExp("<meta\\s+name=[\"']google-adsense-account[\"']\\s+content=[\"']" + PUBLISHER_ID + "[\"']", "i"),
  "AdSense verification meta tag must use the configured publisher ID",
);
assert.match(home.body, /<link\s+rel=["']canonical["']\s+href=["']https:\/\/getroofsolarcalculator\.online\//i);
assert.doesNotMatch(home.body, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/i, "Ad-serving loader must remain absent until approval and privacy/CSP activation");

for (const host of [APEX, WWW]) {
  const probe = await getText(host + "/", "text/html");
  if (probe.response.status === 200) {
    assert.match(probe.body, /<link\s+rel=["']canonical["']\s+href=["']https:\/\/getroofsolarcalculator\.online\//i, host + ": canonical host mismatch");
    assertSecurityHeaders(probe.response, host + " /");
    console.log("PASS: " + host + " returned HTTP 200 to the non-browser runner.");
  } else if (isCloudflareBrowserChallenge(probe.response, probe.body)) {
    console.log("WARN: " + host + " returned a Cloudflare JavaScript challenge to the non-browser runner (CF-Ray " + probe.response.headers.get("cf-ray") + "). This does not establish how a real Chrome visitor is served.");
  } else {
    throw new Error(host + " returned unexpected HTTP " + probe.response.status + "; body=" + probe.body.slice(0, 600));
  }
}

const ads = await getText(PAGES_ORIGIN + "/ads.txt", "text/plain");
assert.equal(ads.response.status, 200, "Production /ads.txt must be published");
assert.equal(ads.body.trim(), ADS_TXT_RECORD);
assert.match(ads.response.headers.get("content-type") || "", /text\/plain/i);

const robots = await getText(PAGES_ORIGIN + "/robots.txt", "text/plain");
assert.equal(robots.response.status, 200, "Production /robots.txt must be published");
assert.match(robots.body, /^User-agent:\s*\*/m);
assert.match(robots.body, /^Allow:\s*\//m);
assert.match(robots.body, /^Sitemap:\s*https:\/\/getroofsolarcalculator\.online\/sitemap\.xml\s*$/m);

const sitemap = await getText(PAGES_ORIGIN + "/sitemap.xml", "application/xml,text/xml");
assert.equal(sitemap.response.status, 200, "Production /sitemap.xml must be published");
assert.match(sitemap.body, /<urlset\b/i);
const urls = [...sitemap.body.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/gi)].map((match) => match[1].trim());
assert.equal(urls.length, 25, "Sitemap must contain the 25 intended content URLs");
assert.ok(urls.every((url) => url.startsWith(APEX + "/")), "Sitemap URLs must use the canonical apex domain");
assert.ok(!urls.some((url) => /404\.html?$/i.test(url)));

for (const url of urls) {
  const path = new URL(url).pathname;
  const response = await get(PAGES_ORIGIN + path, "text/html");
  assert.equal(response.status, 200, "Sitemap URL must resolve on the deployed Pages build: " + url);
  assert.match(response.headers.get("content-type") || "", /^text\/html\b/i, url + ": expected HTML response");
  assertSecurityHeaders(response, url);
  assert.doesNotMatch(response.headers.get("x-robots-tag") || "", /noindex/i, url + ": unexpected crawler block");
  const html = await response.text();
  assert.match(html, /<meta\s+name=["']robots["']\s+content=["']index,follow["']/i, url + ": page must be indexable");
  assert.doesNotMatch(html, /<meta\s+name=["']robots["'][^>]*noindex/i, url + ": page has noindex meta");
}

const privacy = await getText(PAGES_ORIGIN + "/privacy.html", "text/html");
assert.equal(privacy.response.status, 200);
assert.match(privacy.body, /no AdSense ad-serving script or display ads are active/i, "Privacy Notice must state that AdSense delivery is inactive");
assert.match(privacy.body, /Cloudflare Web Analytics is configured in the Pages project/i, "Privacy Notice must disclose configured Cloudflare Web Analytics");

const notFound = await get(PAGES_ORIGIN + "/__production-smoke-not-found-20261108", "text/html");
assert.equal(notFound.status, 404, "Unknown paths must return a real HTTP 404");
assert.match(await notFound.text(), /not found|page not found/i);

// Build-internal files must never be served from the public document root.
for (const path of [
  "/README.md",
  "/OWNER-LAUNCH-CHECKLIST.md",
  "/scripts/run_all_checks.py",
  "/scripts/smoke_production_providers.mjs",
  "/functions/api/location.js",
  "/functions/_shared/location-token.js",
  "/migrations/0001_create_api_quota.sql",
  "/.github/workflows/qa.yml",
  "/.git/config",
  "/_headers",
  "/_routes.json",
]) {
  const response = await get(PAGES_ORIGIN + path, "*/*");
  assert.equal(response.status, 404, "Internal build file must not be publicly served: " + path);
}

const api = await get(PAGES_ORIGIN + "/api/location?search=xy", "application/json");
assert.equal(api.status, 400, "Invalid short city suggestions should be rejected before reserving a D1 quota unit");
assert.match(api.headers.get("content-type") || "", /application\/json/i);
const apiBody = await api.json();
assert.match(apiBody.error || "", /at least 3 letters/i);

console.log("PASS: Production Pages build returns HTTP 200 and expected security/indexability headers.");
console.log("PASS: publisher meta and root ads.txt match; robots.txt and sitemap.xml are present.");
console.log("PASS: all " + urls.length + " sitemap pages return HTTP 200 and are indexable on the Production Pages build.");
console.log("PASS: Privacy Notice distinguishes inactive AdSense delivery from configured Cloudflare Web Analytics.");
console.log("PASS: 404 and validation-only API behavior are correct.");
console.log("NOTE: custom-domain HTTP verification is limited by the zone's Cloudflare Browser Integrity Check challenge; confirm apex and www in a real browser.");
