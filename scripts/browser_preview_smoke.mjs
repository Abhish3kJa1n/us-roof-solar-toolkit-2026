#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE || '/tmp/roofsolar-playwright/node_modules/playwright';
const axePath = process.env.AXE_PLAYWRIGHT_PACKAGE || '/tmp/roofsolar-playwright/node_modules/@axe-core/playwright';
const { chromium } = require(playwrightPath);
const axeModule = require(axePath);
const AxeBuilder = axeModule.default || axeModule;

const base = (process.env.PREVIEW_BASE_URL || 'https://audit-stage1-20261103.roof-solar-toolkit-2026.pages.dev').replace(/\/+$/, '');
const screenshotDir = process.env.QA_SCREENSHOT_DIR || 'browser-qa-output';
fs.mkdirSync(screenshotDir, { recursive: true });

const browserErrors = [];
const requestFailures = [];
const results = [];

async function waitForPreview() {
  let lastStatus = 'no response';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(base + '/index.html', { redirect: 'follow' });
      lastStatus = 'HTTP ' + response.status;
      if (response.status === 200 && /noindex/i.test(response.headers.get('x-robots-tag') || '')) {
        console.log('PREVIEW_READY: ' + base);
        return;
      }
    } catch (error) {
      lastStatus = error.message;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Preview did not become ready with noindex header: ' + lastStatus);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1365, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
page.on('pageerror', error => browserErrors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(message.text());
});
page.on('requestfailed', request => {
  const url = request.url();
  if (url.startsWith(base) || url.includes('developer.nlr.gov') || url.includes('api.openei.org') || url.includes('tigerweb.geo.census.gov')) {
    requestFailures.push(request.method() + ' ' + url + ': ' + (request.failure()?.errorText || 'request failed'));
  }
});

async function open(pathname) {
  const response = await page.goto(base + pathname, { waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.ok(response, 'No HTTP response for ' + pathname);
  assert.equal(response.status(), 200, pathname + ' returned HTTP ' + response.status());
  const headers = response.headers();
  assert.match((headers['x-robots-tag'] || '').toLowerCase(), /noindex/, pathname + ' must remain noindex in Preview');
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  assert.match((robots || '').toLowerCase(), /noindex/, pathname + ' meta robots must remain noindex');
  await page.locator('body').waitFor({ state: 'visible' });
}

async function assertNoHorizontalOverflow(label) {
  for (const width of [390, 768, 1365]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(120);
    const layout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    const maxWidth = Math.max(layout.document, layout.body);
    results.push(label + ' width=' + width + ' scroll=' + maxWidth);
    assert.ok(maxWidth <= width + 1, label + ' horizontal overflow at ' + width + 'px: ' + JSON.stringify(layout));
  }
  await page.setViewportSize({ width: 1365, height: 900 });
}

async function accessibilityScan(label) {
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = report.violations.map(v => ({
    id: v.id,
    impact: v.impact,
    count: v.nodes.length,
    help: v.help,
  }));
  console.log('AXE ' + label + ': ' + JSON.stringify(summary));
  const blocking = report.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  assert.equal(blocking.length, 0, label + ' has critical/serious automated accessibility violations: ' + JSON.stringify(summary));
}

try {
  await waitForPreview();

  // Homepage and combined calculator: real browser rendering and browser-side math.
  await open('/index.html');
  await page.screenshot({ path: path.join(screenshotDir, 'homepage-desktop.png'), fullPage: true });
  await assertNoHorizontalOverflow('homepage');
  await accessibilityScan('homepage');

  // The next-step gate must reject blank required roof inputs before moving on.
  await page.locator('button[data-next="2"]').click();
  assert.ok((await page.locator('#error1').innerText()).trim().length > 0, 'blank required roof inputs should be blocked before results');
  assert.equal(await page.locator('[data-panel="2"]').isVisible(), false, 'invalid roof inputs must not advance to energy details');

  await page.locator('#roofType').selectOption('asphalt');
  await page.locator('#roofArea').fill('1800');
  await page.locator('#roofRateLow').fill('5');
  await page.locator('#roofRateHigh').fill('8');
  await page.locator('button[data-next="2"]').click();
  await page.locator('[data-panel="2"]').waitFor({ state: 'visible' });
  await page.locator('#annualKwh').fill('10800');
  await page.locator('#rate').fill('0.18');
  await page.locator('#selfUse').fill('40');
  await page.locator('#exportRate').fill('0.04');
  await page.locator('#productionPerKw').fill('1300');
  await page.locator('#solarPricePerWatt').fill('2.62');
  await page.locator('#offset').fill('80');
  await page.locator('#calculateButton').click();
  await page.locator('#results.show').waitFor({ state: 'visible', timeout: 15000 });
  const combinedResults = await page.locator('#results').innerText();
  const systemSize = (await page.locator('#systemSize').innerText()).trim();
  assert.match(systemSize, /^\d+\.\d+ kW$/i, 'combined calculator must output a calculated system size');
  assert.match(await page.locator('#roofCost').innerText(), /\$/, 'combined calculator must output a roof-cost scenario');
  assert.match(combinedResults, /kWh|solar/i);
  results.push('combined calculator: PASS');
  await page.screenshot({ path: path.join(screenshotDir, 'combined-calculator-results.png'), fullPage: true });

  // City-based solar: real Census autocomplete, exact place lookup, PVWatts and OpenEI.
  await open('/calculators/location-solar.html');
  await page.screenshot({ path: path.join(screenshotDir, 'location-solar-desktop.png'), fullPage: true });
  await assertNoHorizontalOverflow('location-solar');
  await accessibilityScan('location-solar');

  await page.locator('#city').fill('Austin');
  await page.locator('#citySuggestions button[role="option"]').first().waitFor({ state: 'visible', timeout: 30000 });
  const options = await page.locator('#citySuggestions button[role="option"]').allTextContents();
  const targetIndex = options.findIndex(text => /Austin,\s*TX/i.test(text));
  assert.ok(targetIndex >= 0, 'Austin, TX not present in Census suggestions: ' + JSON.stringify(options));
  await page.locator('#citySuggestions button[role="option"]').nth(targetIndex).click();
  assert.equal(await page.locator('#state').inputValue(), 'TX');
  await page.locator('#lookup').click();
  await page.locator('#placeField').waitFor({ state: 'visible', timeout: 30000 });
  const place = page.locator('#place');
  const placeOptions = await place.locator('option').evaluateAll(items => items.map(item => ({ value: item.value, text: item.textContent })));
  const validPlace = placeOptions.find(item => item.value);
  assert.ok(validPlace, 'Census exact lookup returned no selectable place');
  await place.selectOption(validPlace.value);
  await page.locator('#estimate').click();
  await page.waitForFunction(() => {
    const node = document.querySelector('#result');
    return node && !/Waiting for location and inputs|Model needs updating/.test(node.innerText);
  }, undefined, { timeout: 60000 });
  const pvText = await page.locator('#result').innerText();
  assert.match(pvText, /kWh/i, 'PVWatts result missing kWh output: ' + pvText);
  results.push('Census autocomplete/exact lookup and PVWatts browser flow: PASS');
  await page.screenshot({ path: path.join(screenshotDir, 'location-solar-result.png'), fullPage: true });

  await page.locator('#tariffs').click();
  await page.waitForFunction(() => {
    const node = document.querySelector('#tariffResults');
    return node && node.innerText.trim().length > 0;
  }, undefined, { timeout: 60000 });
  const tariffText = await page.locator('#tariffResults').innerText();
  assert.match(tariffText, /OpenEI|candidate|utility|tariff|rate/i);
  results.push('OpenEI browser lookup flow: PASS');

  // Standalone savings calculator.
  await open('/calculators/solar-savings.html');
  await page.screenshot({ path: path.join(screenshotDir, 'solar-savings-desktop.png'), fullPage: true });
  await assertNoHorizontalOverflow('solar-savings');
  await accessibilityScan('solar-savings');
  await page.locator('#annualUse').fill('10800');
  await page.locator('#offset').fill('80');
  await page.locator('#production').fill('1300');
  await page.locator('#selfUse').fill('40');
  await page.locator('#importRate').fill('0.18');
  await page.locator('#exportRate').fill('0.04');
  await page.locator('#run').click();
  await page.waitForFunction(() => {
    const node = document.querySelector('#result');
    return node && !/Enter your details/.test(node.innerText);
  }, undefined, { timeout: 15000 });
  const savings = await page.locator('#result').innerText();
  assert.match(savings, /kW|kWh|annual|payback/i);
  results.push('standalone solar savings calculator: PASS');
  await page.screenshot({ path: path.join(screenshotDir, 'solar-savings-results.png'), fullPage: true });

  assert.equal(browserErrors.length, 0, 'Browser console/page errors: ' + JSON.stringify(browserErrors));
  assert.equal(requestFailures.length, 0, 'Failed site/API requests: ' + JSON.stringify(requestFailures));
  console.log('BROWSER PREVIEW QA COMPLETED.');
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
