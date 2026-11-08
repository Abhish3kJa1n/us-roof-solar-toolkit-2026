#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStrictCsp, buildStrictCspReportOnly, createNonce } from "../functions/_shared/csp.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function walk(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "dist", "node_modules"].includes(entry.name)) return [];
      return walk(path);
    }
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  });
}

const nonceA = createNonce();
const nonceB = createNonce();
assert.match(nonceA, /^[A-Za-z0-9+/]{22}==$/);
assert.notEqual(nonceA, nonceB, "independent page nonces must not repeat");

const reportOnly = buildStrictCspReportOnly(nonceA);
const enforced = buildStrictCsp(nonceA);
for (const directive of [
  "default-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `script-src 'nonce-${nonceA}'`,
  "'strict-dynamic'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "upgrade-insecure-requests",
]) {
  assert.ok(reportOnly.includes(directive), `missing report-only directive: ${directive}`);
  assert.ok(enforced.includes(directive), `missing enforced directive: ${directive}`);
}
assert.throws(() => buildStrictCspReportOnly("not-a-nonce"), TypeError);
assert.throws(() => buildStrictCsp("not-a-nonce"), TypeError);
assert.ok(enforced.includes("upgrade-insecure-requests"), "enforced policy must upgrade insecure requests");
assert.ok(!reportOnly.includes("upgrade-insecure-requests"), "report-only policy must not emit an ignored upgrade-insecure-requests warning");
const staticHeaders = readFileSync(join(root, "_headers"), "utf8");
assert.ok(staticHeaders.includes("https://static.cloudflareinsights.com/beacon.min.js"), "static CSP must allow only the documented Cloudflare beacon script URL");
assert.ok(staticHeaders.includes("connect-src 'self' https://cloudflareinsights.com"), "static CSP must allow same-origin and Cloudflare telemetry destinations");

const middleware = readFileSync(join(root, "functions/_middleware.js"), "utf8");
assert.ok(middleware.includes('url.pathname.startsWith("/api/")'), "API routes must bypass HTML rewriting");
assert.ok(middleware.includes('new HTMLRewriter()'), "Preview HTML must be rewritten by HTMLRewriter");
assert.ok(middleware.includes('element.setAttribute("nonce", nonce)'), "every script tag must receive the generated nonce");
assert.ok(middleware.includes('eligible ? buildStrictCsp(nonce) : CURRENT_ENFORCED_CSP'), "existing enforced CSP must remain in place");
assert.ok(middleware.includes("https://static.cloudflareinsights.com/beacon.min.js"), "middleware CSP must allow the exact Cloudflare beacon script URL");
assert.ok(middleware.includes("connect-src 'self' https://cloudflareinsights.com"), "middleware CSP must allow Cloudflare telemetry destinations");
assert.ok(middleware.includes('headers.set("Content-Security-Policy-Report-Only"'), "candidate policy must be report-only");
assert.ok(middleware.includes('headers.set("Cache-Control", "private, no-store, max-age=0")'), "nonce-bearing Preview HTML must not be cached");
assert.ok(middleware.includes("adsbygoogle.js?client="), "guarded AdSense loader must exist");
assert.ok(middleware.includes('String(context.env?.ADSENSE_ENABLED || "").toLowerCase() !== "true"'), "runtime ad switch must default off");
assert.ok(middleware.includes("PRODUCTION_HOSTS.has(url.hostname)"), "loader must require exact custom domain");
assert.ok(middleware.includes('url.protocol !== "https:"'), "loader must require HTTPS even on an allowlisted host");
assert.ok(middleware.includes('!slug.includes("/")'), "guide eligibility must not spill into unexpected nested routes");
assert.ok(middleware.includes("return isGuideDocumentPath(pathname) || isEiaReferencePath(pathname);"), "only guide and EIA reference pages may be ad eligible");

const htmlFiles = walk(root);
assert.equal(htmlFiles.length, 25, "expected all 25 public HTML documents");
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const rel = relative(root, file);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const [, attributes, body] of scripts) {
    if (!/\bsrc\s*=/i.test(attributes) && body.trim()) {
      throw new Error(`${rel}: inline script must be reviewed before nonce policy enforcement`);
    }
  }
  if (/\son[a-z]+\s*=/i.test(html)) {
    throw new Error(`${rel}: inline event handler found`);
  }
  if (/(?:href|src)\s*=\s*["']\s*javascript:/i.test(html)) {
    throw new Error(`${rel}: javascript: URL found`);
  }
}

console.log("PASS: cryptographic nonce generation and Google-compatible report-only CSP.");
console.log("PASS: Preview middleware preserves the enforced CSP, skips APIs, and prevents nonce-bearing HTML caching.");
console.log(`PASS: audited ${htmlFiles.length} HTML pages; no inline scripts, inline event handlers or javascript: URLs found.`);
