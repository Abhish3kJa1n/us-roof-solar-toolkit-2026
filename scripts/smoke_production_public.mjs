#!/usr/bin/env node
import assert from "node:assert/strict";

const ORIGIN = "https://getroofsolarcalculator.online";
const WWW = "https://www.getroofsolarcalculator.online";
const PUBLISHER_ID = "ca-pub-6193507831935325";
const ADS_TXT_RECORD = "google.com, pub-6193507831935325, DIRECT, f08c47fec0942fa0";

async function get(url, accept = "*/*") {
  return fetch(url, {
    headers: {
      Accept: accept,
      "User-Agent": "RoofSolarToolkit-ProductionSmokeTest/1.0",
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
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${path}: missing nosniff header`);
  assert.equal(response.headers.get("x-frame-options"), "DENY", `${path}: missing frame protection`);
  assert.equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
    `${path}: unexpected Referrer-Policy`,
  );
  const csp = response.headers.get("content-security-policy") || "";
  assert.ok(csp.includes("script-src 'self'"), `${path}: Production CSP missing or unexpectedly changed`);
}

const home = await getText(`${ORIGIN}/`, "text/html");
assert.equal(home.response.status, 200, "Apex homepage must return HTTP 200");
assert.match(home.response.headers.get("content-type") || "", /^text\/html\b/i);
assertSecurityHeaders(home.response, "/");
assert.match(home.body, /<meta\s+name=["']robots["']\s+content=["']index,follow["']/i, "Production homepage must be indexable");
assert.doesNotMatch(home.body, /<meta\s+name=["']robots["'][^>]*noindex/i);
assert.doesNotMatch(home.response.headers.get("x-robots-tag") || "", /noindex/i);
assert.match(
  home.body,
  new RegExp(`<meta\\s+name=["']google-adsense-account["']\\s+content=["']${PUBLISHER_ID}["']`, "i"),
  "AdSense verification meta tag must use the configured publisher ID",
);
assert.match(home.body, /<link\s+rel=["']canonical["']\s+href=["']https:\/\/getroofsolarcalculator\.online\//i);
assert.doesNotMatch(home.body, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/i, "Ad-serving loader must remain absent until approval and privacy/CSP activation");
assertSecurityHeaders(home.response, "/");

const www = await getText(`${WWW}/`, "text/html");
assert.equal(www.response.status, 200, "www hostname must serve the site or redirect to the canonical host");
assert.match(www.response.headers.get("content-type") || "", /^text\/html\b/i);
assertSecurityHeaders(www.response, "www /");
assert.match(www.body, /<link\s+rel=["']canonical["']\s+href=["']https:\/\/getroofsolarcalculator\.online\//i);

const ads = await getText(`${ORIGIN}/ads.txt`, "text/plain");
assert.equal(ads.response.status, 200, "/ads.txt must be publicly accessible");
assert.equal(ads.body.trim(), ADS_TXT_RECORD);
assert.match(ads.response.headers.get("content-type") || "", /text\/plain/i);

const robots = await getText(`${ORIGIN}/robots.txt`, "text/plain");
assert.equal(robots.response.status, 200, "/robots.txt must be publicly accessible");
assert.match(robots.body, /^User-agent:\s*\*/m);
assert.match(robots.body, /^Allow:\s*\//m);
assert.match(robots.body, /^Sitemap:\s*https:\/\/getroofsolarcalculator\.online\/sitemap\.xml\s*$/m);

const sitemap = await getText(`${ORIGIN}/sitemap.xml`, "application/xml,text/xml");
assert.equal(sitemap.response.status, 200, "/sitemap.xml must be publicly accessible");
assert.match(sitemap.body, /<urlset\b/i);
const urls = [...sitemap.body.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/gi)].map((match) => match[1].trim());
assert.equal(urls.length, 24, "Sitemap must contain the 24 intended content URLs");
assert.ok(urls.every((url) => url.startsWith(ORIGIN + "/")), "Sitemap URLs must use the canonical apex domain");
assert.ok(!urls.some((url) => /404\.html?$/i.test(url)));

for (const url of urls) {
  const response = await get(url, "text/html");
  assert.equal(response.status, 200, `Sitemap URL must resolve: ${url}`);
  assert.match(response.headers.get("content-type") || "", /^text\/html\b/i, `${url}: expected HTML response`);
  assertSecurityHeaders(response, url);
  assert.doesNotMatch(response.headers.get("x-robots-tag") || "", /noindex/i, `${url}: unexpected crawler block`);
  const html = await response.text();
  assert.match(html, /<meta\s+name=["']robots["']\s+content=["']index,follow["']/i, `${url}: page must be indexable`);
  assert.doesNotMatch(html, /<meta\s+name=["']robots["'][^>]*noindex/i, `${url}: page has noindex meta`);
}

const privacy = await getText(`${ORIGIN}/privacy.html`, "text/html");
assert.equal(privacy.response.status, 200);
assert.match(privacy.body, /No AdSense ad-serving script, display ads or analytics script is active/i);
assert.doesNotMatch(privacy.body, /AdSense ad-serving script is active/i);

const notFound = await get(`${ORIGIN}/__production-smoke-not-found-20261108`, "text/html");
assert.equal(notFound.status, 404, "Unknown paths must return a real HTTP 404");
assert.match(await notFound.text(), /not found|page not found/i);

const api = await get(`${ORIGIN}/api/location?search=xy`, "application/json");
assert.equal(api.status, 400, "Invalid short city suggestions should be rejected before reserving a D1 quota unit");
assert.match(api.headers.get("content-type") || "", /application\/json/i);
const apiBody = await api.json();
assert.match(apiBody.error || "", /at least 3 letters/i);

console.log("PASS: Production apex and www hosts serve the canonical site.");
console.log("PASS: homepage indexability, canonical URL, security headers and AdSense verification ID are correct.");
console.log("PASS: root ads.txt, robots.txt and sitemap.xml are publicly accessible and consistent.");
console.log(`PASS: all ${urls.length} sitemap pages return HTTP 200.`);
console.log("PASS: Privacy Notice matches the current no-ad-serving state; no AdSense loader is active.");
console.log("PASS: unknown paths return HTTP 404 and invalid API input is rejected without reserving a quota unit.");
