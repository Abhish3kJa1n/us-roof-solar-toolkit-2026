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
const previewBeaconCorsErrors = [];
const beaconScriptResponses = [];
const previewOrigin = new URL(base).origin;
const results = [];

async function waitForPreview() {
  let lastStatus = 'no response';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(base + '/index.html', { redirect: 'follow' });
      lastStatus = 'HTTP ' + response.status;
      if (response.status === 200 && /noindex/i.test(response.headers.get('x-robots-tag') || '')) {
        const roofResponse = await fetch(base + '/calculators/roof-replacement-cost.html', { redirect: 'follow' });
        const roofHtml = roofResponse.ok ? await roofResponse.text() : '';
        if (roofResponse.status === 200 && roofHtml.includes('data-qa="metal-reference-state-v2"')) {
          console.log('PREVIEW_READY_WITH_ROOF_REFERENCE_STATE_V2: ' + base);
          return;
        }
        lastStatus = 'Preview is reachable but the roof reference-state v2 build is not deployed yet';
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
  if (message.type() !== 'error') return;
  const text = message.text();
  // Cloudflare validates Web Analytics against the registered hostname. This
  // branch runs on a pages.dev alias, not the registered production hostname.
  const previewAnalyticsCors = text.includes("Access to XMLHttpRequest at 'https://cloudflareinsights.com/cdn-cgi/rum'")
    && text.includes("from origin '" + previewOrigin + "'")
    && text.includes('blocked by CORS policy');
  if (previewAnalyticsCors) {
    previewBeaconCorsErrors.push(text);
    return;
  }
  if (text === 'Failed to load resource: net::ERR_FAILED' && previewBeaconCorsErrors.length > 0) return;
  browserErrors.push(text);
});
page.on('response', response => {
  if (response.url().startsWith('https://static.cloudflareinsights.com/beacon.min.js')) {
    beaconScriptResponses.push({ url: response.url(), status: response.status() });
  }
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
  const csp = headers['content-security-policy'] || '';
  const eligibleCspRoute = pathname.startsWith('/guides/') || pathname === '/electricity-prices-by-state' || pathname === '/electricity-prices-by-state.html';
  const nonceValues = await page.locator('script').evaluateAll(nodes => nodes.map(node => node.nonce));
  if (eligibleCspRoute) {
    assert.match(csp, /'strict-dynamic'/, pathname + ' must enforce strict nonce CSP');
    assert.match(csp, /base-uri 'none'/, pathname + ' must block base URL injection');
    assert.match((headers['cache-control'] || '').toLowerCase(), /private.*no-store/, pathname + ' nonce HTML must not be cached');
    const scriptDirective = csp.split(';').map(value => value.trim()).find(value => value.startsWith('script-src '));
    const nonceMatch = scriptDirective && scriptDirective.match(/'nonce-([^']+)'/);
    assert.ok(nonceMatch && nonceValues.length > 0 && nonceValues.every(value => value === nonceMatch[1]), pathname + ' all scripts must carry the matching nonce');
  } else {
    assert.match(csp, /script-src 'self'/, pathname + ' must retain current enforced CSP');
  }
  assert.equal(await page.locator('script[src*="adsbygoogle.js"]').count(), 0, pathname + ' Preview must never load AdSense');
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

  // Editorial/reference pages exercise strict nonce CSP; Preview ads remain disabled.
  await open('/electricity-prices-by-state');
  results.push('EIA reference strict CSP and Preview ad gate: PASS');
  await open('/guides/are-solar-panels-worth-it.html');
  results.push('guide strict CSP and Preview ad gate: PASS');

  // Homepage and combined calculator: real browser rendering and browser-side math.
  await open('/index.html');
  await page.screenshot({ path: path.join(screenshotDir, 'homepage-desktop.png'), fullPage: true });
  await assertNoHorizontalOverflow('homepage');
  await accessibilityScan('homepage');

  // Roof-price defaults must remain blank until the visitor explicitly requests the national reference.
  assert.equal(await page.locator('#roofRateLow').inputValue(), '', 'combined calculator must not silently prefill broad national roof rates');
  assert.equal(await page.locator('#roofRateHigh').inputValue(), '', 'combined calculator must not silently prefill broad national roof rates');
  await page.locator('#loadNationalRoofReference').click();
  assert.equal(await page.locator('#roofRateLow').inputValue(), '4');
  assert.equal(await page.locator('#roofRateHigh').inputValue(), '11');
  assert.match(await page.locator('#roofReferenceStatus').innerText(), /not a local or material-specific price/i);

  // The shared validator must mark each blank required field inline and block the next step.
  await page.locator('button[data-next="2"]').click();
  const roofTypeMessage = page.locator('#roofType-checker-message');
  assert.equal(await page.locator('#roofType').getAttribute('aria-invalid'), 'true', 'blank roof material must be marked invalid');
  assert.ok((await roofTypeMessage.innerText()).trim().length > 0, 'blank roof material must show an inline field-level error');
  assert.ok(await roofTypeMessage.isVisible(), 'the inline roof-material error must be visible');
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

  // Standalone roof-cost calculator: AHS availability state, material changes and all metal-system references.
  await open('/calculators/roof-replacement-cost.html');
  await page.screenshot({ path: path.join(screenshotDir, 'roof-cost-desktop.png'), fullPage: true });
  await assertNoHorizontalOverflow('roof-cost');
  await accessibilityScan('roof-cost');
  await page.waitForFunction(() => {
    const node = document.querySelector('#roofMetroBenchmarkResult');
    return Boolean(node && /national point estimates reproduce the Census Table C-16/i.test(node.innerText));
  }, undefined, { timeout: 15000 });
  assert.equal(await page.locator('#roofMetroBenchmarkField').isVisible(), false, 'empty AHS registry must hide the unavailable dropdown field');
  const ahsStatus = await page.locator('#roofMetroBenchmarkResult').innerText();
  assert.match(ahsStatus, /No AHS metro roofing distribution is currently approved/i);
  assert.match(ahsStatus, /national point estimates reproduce the Census Table C-16/i);

  const styleValues = await page.locator('#metalSystem optgroup[label="By roof style / system"] option').evaluateAll(options => options.map(option => option.value));
  const materialValues = await page.locator('#metalSystem optgroup[label="By base metal / material"] option').evaluateAll(options => options.map(option => option.value));
  assert.deepEqual(styleValues, ['corrugated', 'standing_seam', 'metal_shingles'], 'style/system group must contain only HomeGuide style ranges');
  assert.deepEqual(materialValues, ['galvanized_steel', 'galvalume_steel', 'aluminum', 'copper', 'zinc', 'tin_terne', 'stainless_steel', 'corten_steel', 'metal_slate', 'stone_coated_steel'], 'material group must contain HomeGuide metal-type ranges');


  assert.equal(await page.locator('#low').inputValue(), '', 'standalone roof calculator must not auto-load general national rates');
  assert.equal(await page.locator('#high').inputValue(), '', 'standalone roof calculator must not auto-load general national rates');
  await page.locator('#area').fill('1800');
  await page.locator('#loadReference').click();
  assert.equal(await page.locator('#low').inputValue(), '4');
  assert.equal(await page.locator('#high').inputValue(), '11');
  assert.match(await page.locator('#referenceStatus').innerText(), /not a local or material-specific price/i);
  await page.locator('#run').click();
  assert.match(await page.locator('#result').innerText(), /\$7,200|\$19,800/);

  // A generic national roof range must be cleared when Metal is selected.
  await page.locator('#material').selectOption('metal');
  assert.equal(await page.locator('#metalSystemField').isVisible(), true);
  assert.equal(await page.locator('#low').inputValue(), '');
  assert.equal(await page.locator('#high').inputValue(), '');
  assert.equal(await page.locator('#metalSystem').inputValue(), '');
  assert.equal(await page.locator('#loadReference').isDisabled(), true, 'a metal reference cannot be loaded before choosing a system');

  const metalSystems = [
    // Roof style / system references
    ['corrugated', '5', '12', /corrugated sheet metal/i],
    ['standing_seam', '9', '16', /standing seam/i],
    ['metal_shingles', '6', '14', /metal shingles/i],
    // Base-metal material/type references
    ['galvanized_steel', '5', '13', /galvanized steel/i],
    ['galvalume_steel', '5', '13', /Galvalume steel/i],
    ['aluminum', '7', '17', /aluminum/i],
    ['copper', '13', '30', /copper/i],
    ['zinc', '10', '20', /zinc/i],
    ['tin_terne', '6', '18', /tin \/ terne/i],
    ['stainless_steel', '10', '21', /stainless steel/i],
    ['corten_steel', '6', '11', /Corten \/ weathering steel/i],
    ['metal_slate', '6', '14', /metal slate/i],
    ['stone_coated_steel', '7', '13', /stone-coated steel/i],
  ];
  for (const [system, low, high, label] of metalSystems) {
    await page.locator('#metalSystem').selectOption(system);
    assert.equal(await page.locator('#low').inputValue(), low, system + ' low reference');
    assert.equal(await page.locator('#high').inputValue(), high, system + ' high reference');
    assert.match(await page.locator('#referenceStatus').innerText(), label);
    await page.locator('#run').click();
    const resultText = await page.locator('#result').innerText();
    assert.match(resultText, /HomeGuide/);
    assert.match(resultText, /Metal reference category:/, system + ' result must identify the selected reference category');
  }
  results.push('AHS empty state and all 13 metal style/material references: PASS');

  // A visitor edit creates a mixed range. Changing system preserves it as custom and does not mislabel it.
  await page.locator('#metalSystem').selectOption('standing_seam');
  await page.locator('#low').fill('10');
  assert.match(await page.locator('#referenceStatus').innerText(), /high endpoint remains from the original/i);
  await page.locator('#metalSystem').selectOption('corrugated');
  assert.equal(await page.locator('#low').inputValue(), '10');
  assert.equal(await page.locator('#high').inputValue(), '16');
  const mixedStatus = await page.locator('#referenceStatus').innerText();
  assert.match(mixedStatus, /standing seam/i);
  assert.match(mixedStatus, /not a published range for corrugated sheet metal/i);
  assert.match(await page.locator('#loadReference').innerText(), /Reload corrugated sheet metal reference/i);
  await page.locator('#run').click();
  const mixedResult = await page.locator('#result').innerText();
  assert.match(mixedResult, /Mixed\/custom rate pair/i);
  assert.match(mixedResult, /Original source: HomeGuide published installed range for standing seam/i);
  assert.match(mixedResult, /not a published range for corrugated sheet metal/i);
  await page.locator('#loadReference').click();
  assert.equal(await page.locator('#low').inputValue(), '5');
  assert.equal(await page.locator('#high').inputValue(), '12');
  assert.match(await page.locator('#referenceStatus').innerText(), /corrugated sheet metal/i);

  // Changing material clears source-derived rates and hides the metal selector.
  await page.locator('#material').selectOption('tile');
  assert.equal(await page.locator('#metalSystemField').isVisible(), false);
  assert.equal(await page.locator('#metalSystem').inputValue(), '');
  assert.equal(await page.locator('#low').inputValue(), '');
  assert.equal(await page.locator('#high').inputValue(), '');
  assert.match(await page.locator('#referenceStatus').innerText(), /rates were cleared because the roof material changed/i);

  // Manually entered values remain editable but are not silently promoted to a system reference.
  await page.locator('#low').fill('5.5');
  await page.locator('#high').fill('8.5');
  await page.locator('#material').selectOption('metal');
  assert.equal(await page.locator('#low').inputValue(), '5.5');
  assert.equal(await page.locator('#high').inputValue(), '8.5');
  assert.match(await page.locator('#referenceStatus').innerText(), /visitor-entered rates were retained/i);
  await page.locator('#metalSystem').selectOption('metal_shingles');
  assert.equal(await page.locator('#low').inputValue(), '5.5');
  assert.equal(await page.locator('#high').inputValue(), '8.5');
  assert.match(await page.locator('#referenceStatus').innerText(), /not a published reference for the new category/i);
  await page.locator('#loadReference').click();
  assert.equal(await page.locator('#low').inputValue(), '6');
  assert.equal(await page.locator('#high').inputValue(), '14');

  // Switching away from Metal clears the selected metal reference; Reset clears everything.
  await page.locator('#material').selectOption('asphalt');
  assert.equal(await page.locator('#metalSystemField').isVisible(), false);
  assert.equal(await page.locator('#low').inputValue(), '');
  assert.equal(await page.locator('#high').inputValue(), '');
  await page.locator('#reset').click();
  assert.equal(await page.locator('#low').inputValue(), '');
  assert.equal(await page.locator('#high').inputValue(), '');
  assert.equal(await page.locator('#metalSystemField').isVisible(), false);
  results.push('metal reference edits, system switching, material switching and reset: PASS');
  results.push('roof reference-state v2 regression coverage: PASS');
  await page.screenshot({ path: path.join(screenshotDir, 'roof-cost-metal-reference.png'), fullPage: true });

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
    const text = node?.innerText || '';
    return Boolean(text) && !/Waiting for location and inputs|Model needs updating|Calculating(?:…|\.\.\.)?/i.test(text);
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

  assert.ok(beaconScriptResponses.some(item => item.status === 200), 'Cloudflare Web Analytics beacon script must load successfully; observed: ' + JSON.stringify(beaconScriptResponses));
  assert.equal(browserErrors.length, 0, 'Unexpected browser console/page errors: ' + JSON.stringify(browserErrors));
  assert.equal(requestFailures.length, 0, 'Failed site/API requests: ' + JSON.stringify(requestFailures));
  console.log('Cloudflare Web Analytics beacon loaded. Preview pages.dev hostname CORS responses observed: ' + previewBeaconCorsErrors.length);
  console.log('BROWSER PREVIEW QA COMPLETED.');
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
