#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE || "/tmp/roofsolar-playwright/node_modules/playwright";
const axePath = process.env.AXE_PLAYWRIGHT_PACKAGE || "/tmp/roofsolar-playwright/node_modules/@axe-core/playwright";
const { chromium } = require(playwrightPath);
const axeModule = require(axePath);
const AxeBuilder = axeModule.default || axeModule;

const HOSTS = [
  { label: "apex", origin: "https://getroofsolarcalculator.online" },
  { label: "www", origin: "https://www.getroofsolarcalculator.online" },
];
const screenshotDir = process.env.QA_SCREENSHOT_DIR || "production-browser-output";
fs.mkdirSync(screenshotDir, { recursive: true });

const browserErrors = [];
const cspErrors = [];
const beaconResponses = [];
const rumResponses = [];
const rumFailures = [];
const pageResults = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1365, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});

function challengeDescription(title, body, status) {
  const challenge = /just a moment|checking your browser|attention required|verify you are human/i.test(title + "\n" + body)
    || /cf-challenge|cf-browser-verification|challenges\.cloudflare\.com/i.test(body);
  return challenge ? "Cloudflare browser/security challenge (HTTP " + status + ")" : null;
}

async function openPage(page, origin, pathname, label) {
  const response = await page.goto(origin + pathname, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert.ok(response, label + ": navigation returned no HTTP response");
  await page.waitForTimeout(2500);
  const title = await page.title();
  const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 8000);
  const challenge = challengeDescription(title, body, response.status());
  if (challenge) {
    throw new Error(label + ": " + challenge + "; title=" + title + "; finalURL=" + page.url());
  }
  assert.equal(response.status(), 200, label + ": expected HTTP 200, got " + response.status() + "; title=" + title);
  assert.match(title, /Roof|Solar/i, label + ": unexpected document title " + title);
  await page.locator("body").waitFor({ state: "visible" });
  return response;
}

function assertProductionHeaders(response, label) {
  const headers = response.headers();
  assert.equal(headers["x-content-type-options"], "nosniff", label + ": X-Content-Type-Options");
  assert.equal(headers["x-frame-options"], "DENY", label + ": X-Frame-Options");
  assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin", label + ": Referrer-Policy");
  const csp = headers["content-security-policy"] || "";
  assert.ok(csp.includes("script-src 'self'"), label + ": Production should retain first-party script policy");
  assert.ok(csp.includes("https://static.cloudflareinsights.com/beacon.min.js"), label + ": CSP must permit the Cloudflare Analytics beacon script");
  assert.ok(csp.includes("connect-src 'self' https://cloudflareinsights.com"), label + ": CSP must permit same-origin/Cloudflare telemetry connections");
  return csp;
}

async function assertNoAds(page, label) {
  const count = await page.locator('script[src*="adsbygoogle.js"]').count();
  assert.equal(count, 0, label + ": Production AdSense loader must remain inactive during this review");
}

async function assertNoHorizontalOverflow(page, label) {
  for (const width of [390, 768, 1365]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    const total = Math.max(layout.document, layout.body);
    assert.ok(total <= width + 1, label + ": horizontal overflow at " + width + "px: " + JSON.stringify(layout));
  }
  await page.setViewportSize({ width: 1365, height: 900 });
}

async function scanAccessibility(page, label) {
  const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = report.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length, help: item.help }));
  console.log("AXE " + label + ": " + JSON.stringify(summary));
  const blockers = report.violations.filter(item => item.impact === "critical" || item.impact === "serious");
  assert.equal(blockers.length, 0, label + ": critical/serious accessibility violations: " + JSON.stringify(summary));
}

pageResults.push("Read-only Production browser QA started; no API endpoints are called.");
const page = await context.newPage();
page.on("pageerror", error => browserErrors.push(error.message));
page.on("console", message => {
  if (message.type() !== "error") return;
  const value = message.text();
  if (/content security policy|refused to (load|execute)/i.test(value)) cspErrors.push(value);
  else browserErrors.push(value);
});
page.on("response", response => {
  const url = response.url();
  if (url.startsWith("https://static.cloudflareinsights.com/beacon.min.js")) {
    beaconResponses.push({ url, status: response.status() });
  }
  if (/\/cdn-cgi\/rum(?:\?|$)/.test(url)) {
    rumResponses.push({ url, status: response.status(), method: response.request().method() });
  }
});
page.on("requestfailed", request => {
  if (/\/cdn-cgi\/rum(?:\?|$)/.test(request.url())) {
    rumFailures.push({ url: request.url(), error: request.failure()?.errorText || "request failed" });
  } else if (/getroofsolarcalculator\.online/.test(request.url())) {
    browserErrors.push(request.method() + " " + request.url() + ": " + (request.failure()?.errorText || "request failed"));
  }
});

try {
  for (const host of HOSTS) {
    const response = await openPage(page, host.origin, "/", host.label + " homepage");
    const csp = assertProductionHeaders(response, host.label + " homepage");
    assert.ok(!/noindex/i.test(response.headers()["x-robots-tag"] || ""), host.label + ": Production must not have X-Robots-Tag noindex");
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content") || "", /index,follow/i, host.label + ": homepage must be indexable");
    assert.match(await page.locator('link[rel="canonical"]').getAttribute("href") || "", /^https:\/\/getroofsolarcalculator\.online\//i, host.label + ": canonical should use the apex domain");
    await assertNoAds(page, host.label + " homepage");
    await assertNoHorizontalOverflow(page, host.label + " homepage");
    if (host.label === "apex") {
      await page.screenshot({ path: screenshotDir + "/production-homepage-desktop.png", fullPage: true });
      await scanAccessibility(page, "Production homepage");
      // Exercise the combined roof + solar calculator without submitting any location/API request.
      await page.locator("#roofType").selectOption("asphalt");
      await page.locator("#roofArea").fill("1800");
      await page.locator("#roofRateLow").fill("5");
      await page.locator("#roofRateHigh").fill("8");
      await page.locator('button[data-next="2"]').click();
      await page.locator('[data-panel="2"]').waitFor({ state: "visible" });
      await page.locator("#annualKwh").fill("10800");
      await page.locator("#rate").fill("0.18");
      await page.locator("#selfUse").fill("40");
      await page.locator("#exportRate").fill("0.04");
      await page.locator("#productionPerKw").fill("1300");
      await page.locator("#solarPricePerWatt").fill("2.62");
      await page.locator("#offset").fill("80");
      await page.locator("#calculateButton").click();
      await page.locator("#results.show").waitFor({ state: "visible", timeout: 15000 });
      assert.match((await page.locator("#systemSize").innerText()).trim(), /^\d+\.\d+ kW$/i);
      assert.match(await page.locator("#roofCost").innerText(), /\$/);
      await page.screenshot({ path: screenshotDir + "/production-calculator-results.png", fullPage: true });
      console.log("PASS: Production combined roof + solar calculator interaction.");
    }
    console.log("PASS: " + host.label + " homepage HTTP, canonical, indexability, CSP, no-ad gate and responsive layout; CSP bytes=" + csp.length);
    pageResults.push(host.label + " homepage: PASS");
  }

  await openPage(page, HOSTS[0].origin, "/guides/are-solar-panels-worth-it.html", "Production guide");
  await assertNoAds(page, "Production guide");
  await assertNoHorizontalOverflow(page, "Production guide");
  await page.screenshot({ path: screenshotDir + "/production-guide.png", fullPage: true });
  console.log("PASS: Production editorial guide renders; AdSense loader remains inactive.");
  pageResults.push("Editorial guide: PASS");

  await openPage(page, HOSTS[0].origin, "/privacy.html", "Production privacy notice");
  await assertNoAds(page, "Production Privacy Notice");
  const privacyText = await page.locator("body").innerText();
  assert.match(privacyText, /Cloudflare Web Analytics is configured in the Cloudflare Pages project/i);
  assert.match(privacyText, /no AdSense ad-serving script or display ads are active/i);
  console.log("PASS: Production Privacy Notice describes configured analytics and inactive AdSense.");
  pageResults.push("Privacy Notice: PASS");

  // Cloudflare injects its beacon at the edge. A successful script load confirms the
  // production CSP allows it. A same-origin /cdn-cgi/rum response is recorded separately.
  await page.waitForTimeout(7000);
  assert.ok(beaconResponses.some(item => item.status === 200), "Production Cloudflare Analytics beacon script did not load: " + JSON.stringify(beaconResponses));
  assert.equal(cspErrors.length, 0, "Production CSP errors: " + JSON.stringify(cspErrors));
  assert.equal(browserErrors.length, 0, "Unexpected Production browser errors: " + JSON.stringify(browserErrors));
  console.log("PASS: Production Cloudflare Analytics beacon script loaded with no observed CSP violations.");
  if (rumResponses.some(item => item.status >= 200 && item.status < 300)) {
    console.log("PASS: Production same-origin Analytics telemetry endpoint returned a successful HTTP response: " + JSON.stringify(rumResponses));
  } else if (rumResponses.length || rumFailures.length) {
    console.log("WARN: Production Analytics beacon loaded, but telemetry response was not confirmed successful: " + JSON.stringify({ responses: rumResponses, failures: rumFailures }));
  } else {
    console.log("WARN: Production Analytics beacon loaded, but no /cdn-cgi/rum response was observed during this session.");
  }
  console.log("PRODUCTION BROWSER QA COMPLETED.");
  console.log(pageResults.join("\n"));
} finally {
  await browser.close();
}
