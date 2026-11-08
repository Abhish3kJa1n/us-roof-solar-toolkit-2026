#!/usr/bin/env node
import assert from "node:assert/strict";

const base = process.env.PREVIEW_BASE_URL;
if (!base || !/^https:\/\/[a-z0-9-]+\.roof-solar-toolkit-2026\.pages\.dev$/i.test(base)) {
  throw new Error("PREVIEW_BASE_URL must be this project's HTTPS Cloudflare Pages Preview host.");
}

async function get(path) {
  const response = await fetch(new URL(path, base), {
    headers: { Accept: "text/html,application/json", "Cache-Control": "no-cache" },
    redirect: "follow",
  });
  return response;
}

async function getReady() {
  let lastError;
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    try {
      const response = await get("/");
      if (response.status === 200) return response;
      lastError = new Error(`Preview returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Preview did not become ready: ${lastError?.message || "unknown error"}`);
}

function readNonce(response, html, path) {
  assert.equal(response.status, 200, `${path}: expected HTTP 200`);
  assert.match(response.headers.get("content-type") || "", /^text\/html\b/i, `${path}: expected HTML`);
  const enforced = response.headers.get("content-security-policy") || "";
  const reportOnly = response.headers.get("content-security-policy-report-only") || "";
  assert.ok(reportOnly.includes("'strict-dynamic'"), `${path}: report-only CSP header missing`);
  const eligible = path.startsWith("/guides/") || path === "/electricity-prices-by-state" || path === "/electricity-prices-by-state.html";
  const policy = eligible ? enforced : reportOnly;
  if (eligible) {
    assert.ok(enforced.includes("'strict-dynamic'"), `${path}: eligible pages must enforce strict nonce CSP`);
    assert.ok(enforced.includes("base-uri 'none'"), `${path}: strict CSP base-uri restriction missing`);
  } else {
    assert.ok(enforced.includes("script-src 'self'"), `${path}: noneligible pages must retain existing CSP`);
  }
  const nonceMatch = policy.match(/'nonce-([A-Za-z0-9+/]{22}==)'/);
  assert.ok(nonceMatch, `${path}: CSP nonce missing`);
  const nonce = nonceMatch[1];
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)];
  for (const [, attributes] of scriptTags) {
    const tagNonce = attributes.match(/\bnonce=["']([^"']+)["']/i)?.[1];
    assert.equal(tagNonce, nonce, `${path}: script nonce must match response CSP`);
  }
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/i, `${path}: Preview must remain noindex`);
  assert.match(response.headers.get("cache-control") || "", /private.*no-store|no-store.*private/i, `${path}: nonce HTML must not be cached`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.ok(!/adsbygoogle\.js/i.test(html), `${path}: Preview must never load AdSense`);
  return nonce;
}

const home = await getReady();
const homeHtml = await home.text();
const firstNonce = readNonce(home, homeHtml, "/");
assert.ok((homeHtml.match(/<script\b/gi) || []).length > 0, "homepage should exercise actual script nonce rewriting");

for (const path of [
  "/index.html",
  "/about.html",
  "/calculators/roof-area.html",
  "/guides/solar-installation-cost.html",
  "/electricity-prices-by-state",
  "/privacy.html",
]) {
  const response = await get(path);
  const html = await response.text();
  readNonce(response, html, path);
  assert.equal(
    new URL(response.url).pathname,
    path === "/index.html" ? "/" : path.replace(/\.html$/, ""),
    `${path}: Pages should redirect .html to its extensionless canonical path`,
  );
}

const secondHome = await get("/");
const secondNonce = readNonce(secondHome, await secondHome.text(), "/ (second request)");
assert.notEqual(firstNonce, secondNonce, "a fresh HTML response must receive a fresh nonce");

const adsTxtResponse = await fetch(new URL("/ads.txt", base), {
  headers: { Accept: "text/plain" },
});
assert.equal(adsTxtResponse.status, 200, "Preview should publish the ads.txt file at the web root");
const adsTxt = (await adsTxtResponse.text()).trim();
assert.equal(adsTxt, "google.com, pub-6193507831935325, DIRECT, f08c47fec0942fa0");
assert.match(
  homeHtml,
  /<meta\s+name=["']google-adsense-account["']\s+content=["']ca-pub-6193507831935325["']/i,
  "homepage AdSense site-verification meta tag should match ads.txt publisher ID",
);

const apiResponse = await fetch(new URL("/api/location?search=xy", base), {
  headers: { Accept: "application/json" },
});
assert.equal(apiResponse.status, 400, "API route should reach the existing location Function validation");
assert.match(apiResponse.headers.get("content-type") || "", /application\/json/i);
const apiBody = await apiResponse.json();
assert.match(apiBody.error || "", /at least 3 letters/i);

console.log("PASS: live Preview serves HTML with matching CSP and script nonces.");
console.log("PASS: nonce changes between requests; HTML remains no-store and Preview remains noindex.");
console.log("PASS: existing API routing still reaches the Location Function without consuming lookup quota.");
console.log("PASS: no AdSense loader is active in this stage.");
