#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { assertPreviewNotAccessChallenge, cloudflareAccessHeadersForUrl, fetchPreview, installCloudflareAccess } from './cloudflare_access.mjs';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE || '/tmp/roofsolar-playwright/node_modules/playwright';
const axePath = process.env.AXE_PLAYWRIGHT_PACKAGE || '/tmp/roofsolar-playwright/node_modules/@axe-core/playwright';
const { chromium } = require(playwrightPath);
const axeModule = require(axePath);
const AxeBuilder = axeModule.default || axeModule;

const base = (process.env.PREVIEW_BASE_URL || 'https://audit-stage1-20261103.roof-solar-toolkit-2026.pages.dev').replace(/\/+$/, '');
const screenshotDir = process.env.QA_SCREENSHOT_DIR || 'browser-qa-output';
const expectedPreviewSha = process.env.EXPECTED_PREVIEW_SHA || '';
fs.mkdirSync(screenshotDir, { recursive: true });

const browserErrors = [];
const requestFailures = [];
const previewBeaconCorsErrors = [];
const previewBeaconRequestFailures = [];
let previewBeaconGenericFailures = 0;
const beaconScriptResponses = [];
let expected404Navigation = false;
let expected404ConsoleErrors = 0;
let expected404Responses = 0;
const previewOrigin = new URL(base).origin;
const results = [];

async function waitForPreview() {
  let lastStatus = 'no response';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetchPreview(base + '/index.html?qa=' + Date.now(), { cache: 'no-store' }, base);
      assertPreviewNotAccessChallenge(response, 'Preview readiness request');
      lastStatus = 'HTTP ' + response.status;
      if (response.status === 200 && /noindex/i.test(response.headers.get('x-robots-tag') || '')) {
        const roofResponse = await fetchPreview(base + '/calculators/roof-replacement-cost.html?qa=' + Date.now(), { cache: 'no-store' }, base);
        assertPreviewNotAccessChallenge(roofResponse, 'Roof calculator Preview readiness request');
        const roofHtml = roofResponse.ok ? await roofResponse.text() : '';
        if (roofResponse.status === 200 && roofHtml.includes('data-qa="metal-reference-state-v2"')) {
          if (expectedPreviewSha) {
            const identityResponse = await fetchPreview(base + '/build-info.json?qa=' + Date.now(), { cache: 'no-store' }, base);
            assertPreviewNotAccessChallenge(identityResponse, 'Preview build identity request');
            if (!identityResponse.ok) {
              lastStatus = 'Preview content is ready but build identity is not available: HTTP ' + identityResponse.status;
            } else {
              const identity = await identityResponse.json();
              if (identity.commit !== expectedPreviewSha) {
                lastStatus = 'Preview alias is stale: expected commit ' + expectedPreviewSha + ', received ' + (identity.commit || 'missing');
              } else {
                console.log('PREVIEW_READY_FOR_EXACT_COMMIT ' + expectedPreviewSha + ': ' + base);
                return;
              }
            }
          } else {
            console.log('PREVIEW_READY_WITH_ROOF_REFERENCE_STATE_V2: ' + base);
            return;
          }
        } else {
          lastStatus = 'Preview is reachable but the roof reference-state v2 build is not deployed yet';
        }
      }
    } catch (error) {
      if (['CloudflareAccessError', 'CloudflareAccessConfigurationError'].includes(error?.name)) throw error;
      lastStatus = error.message;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Preview did not serve the expected commit ' + (expectedPreviewSha || '(unspecified)') + ': ' + lastStatus);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1365, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
await installCloudflareAccess(context, base);
const page = await context.newPage();
if (expectedPreviewSha) {
  const previewOrigin = new URL(base).origin;
  await page.route('**/assets/**', async (route) => {
    const assetUrl = new URL(route.request().url());
    const safeHeaders = { ...route.request().headers() };
    delete safeHeaders['cf-access-client-id'];
    delete safeHeaders['cf-access-client-secret'];
    if (assetUrl.origin !== previewOrigin) {
      return route.continue({ headers: safeHeaders });
    }
    assetUrl.searchParams.set('qa', expectedPreviewSha);
    return route.continue({
      url: assetUrl.toString(),
      headers: { ...safeHeaders, ...cloudflareAccessHeadersForUrl(assetUrl, base), 'cache-control': 'no-cache' }
    });
  });
}
page.on('pageerror', error => browserErrors.push(error.message));
page.on('console', message => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (expected404Navigation && text === 'Failed to load resource: the server responded with a status of 404 ()') {
    expected404ConsoleErrors += 1;
    return;
  }
  // Cloudflare validates Web Analytics against the registered hostname. This
  // branch runs on a pages.dev alias, not the registered production hostname.
  const previewAnalyticsCors = text.includes('https://cloudflareinsights.com/cdn-cgi/rum')
    && text.includes("from origin '" + previewOrigin + "'")
    && text.includes('blocked by CORS policy');
  if (previewAnalyticsCors) {
    previewBeaconCorsErrors.push(text);
    return;
  }
  if (text === 'Failed to load resource: net::ERR_FAILED' && previewBeaconGenericFailures < previewBeaconRequestFailures.length) {
    previewBeaconGenericFailures += 1;
    return;
  }
  browserErrors.push(text);
});
page.on('response', response => {
  if (response.status() >= 400) {
    if (expected404Navigation && response.status() === 404 && response.request().isNavigationRequest()) {
      expected404Responses += 1;
    } else {
      requestFailures.push('HTTP ' + response.status() + ' ' + response.url());
    }
  }
  if (response.url().startsWith('https://static.cloudflareinsights.com/beacon.min.js')) {
    beaconScriptResponses.push({ url: response.url(), status: response.status() });
  }
});
page.on('requestfailed', request => {
  const url = request.url();
  if (url.startsWith('https://cloudflareinsights.com/cdn-cgi/rum')) {
    previewBeaconRequestFailures.push(request.failure()?.errorText || 'telemetry request failed');
    return;
  }
  if (url.startsWith(base) || url.includes('developer.nlr.gov') || url.includes('api.openei.org') || url.includes('tigerweb.geo.census.gov')) {
    requestFailures.push(request.method() + ' ' + url + ': ' + (request.failure()?.errorText || 'request failed'));
  }
});

async function open(pathname) {
  const response = await page.goto(base + pathname, { waitUntil: 'domcontentloaded', timeout: 60000 });
  assertPreviewNotAccessChallenge(response, 'Browser navigation ' + pathname);
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
    assert.match(csp, /script-src [^;]*'self'/, pathname + ' must retain same-origin script execution');
    assert.match(csp, /https:\/\/www\.googletagmanager\.com/, pathname + ' must allow the Google tag script origin');
    assert.match(csp, /https:\/\/\*\.google-analytics\.com/, pathname + ' must allow Google Analytics measurement endpoints');
    const scriptDirective = csp.split(';').map(value => value.trim()).find(value => value.startsWith('script-src '));
    const nonceMatch = scriptDirective && scriptDirective.match(/'nonce-([^']+)'/);
    assert.ok(nonceMatch && nonceValues.length > 0 && nonceValues.every(value => value === nonceMatch[1]), pathname + ' all scripts must carry the matching nonce');
  }
  assert.equal(await page.locator('script[src*="adsbygoogle.js"]').count(), 0, pathname + ' Preview must never load AdSense');
  assert.equal(await page.locator('script[src*="googletagmanager.com/gtm.js?id=GTM-5X5DFWMW"]').count(), 0, pathname + ' Preview must never load the Production Google Analytics tag');
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
  await open('/guides/solar-installation-cost');
  const guideTocTargetHeights = await page.locator('.toc a').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  assert.ok(guideTocTargetHeights.length > 0 && guideTocTargetHeights.every(height => height >= 24), 'solar cost guide table-of-contents links must have 24px minimum touch targets');
  results.push('solar cost guide touch target sizing: PASS');

  // Public methodology copy must describe the same opt-in price behavior tested in the calculators.
  await open('/methodology.html');
  const methodologyText = await page.locator('#main-content').innerText();
  assert.match(methodologyText, /starts with blank low\/high roof-price fields/i);
  assert.match(methodologyText, /leave installed solar price blank by default/i);
  assert.match(methodologyText, /visitor must choose to apply it/i);
  assert.doesNotMatch(methodologyText, /preloads a broad Angi national roof-surface reference/i);
  assert.doesNotMatch(methodologyText, /standalone solar savings calculator pre-fills an editable/i);
  results.push('methodology and opt-in price-reference UX consistency: PASS');

  // Homepage and combined calculator: real browser rendering and browser-side math.
  await open('/index.html');
  assert.equal(await page.locator('link[rel="icon"][href="/assets/favicon.svg"]').count(), 1, 'homepage must declare its SVG favicon explicitly');
  await page.screenshot({ path: path.join(screenshotDir, 'homepage-desktop.png'), fullPage: true });
  await assertNoHorizontalOverflow('homepage');
  await accessibilityScan('homepage');
  assert.equal(await page.locator('#solarPricePerWatt').inputValue(), '', 'combined calculator must not silently prefill a national solar price');
  assert.equal(await page.locator('#roofPriceAssumptions').evaluate(node => node.open), false, 'roof price assumptions should be collapsed initially');
  assert.equal(await page.locator('#solarCostAssumptions').evaluate(node => node.open), false, 'solar cost assumptions should be collapsed initially');
  assert.equal(await page.locator('#tools .resource-card').count(), 5, 'homepage tool directory should list only the five specialist calculators');
  const guideHrefs = await page.locator('#guides .guide-list a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  assert.equal(guideHrefs.length, 16, 'homepage should retain all sixteen distinct homeowner guides');
  assert.equal(new Set(guideHrefs).size, guideHrefs.length, 'homepage guide links must not be duplicated');

  // Roof-price defaults must remain blank until the visitor explicitly requests the national reference.
  assert.equal(await page.locator('#roofRateLow').inputValue(), '', 'combined calculator must not silently prefill broad national roof rates');
  assert.equal(await page.locator('#roofRateHigh').inputValue(), '', 'combined calculator must not silently prefill broad national roof rates');
  await page.locator('#roofPriceAssumptions summary').click();
  assert.match(await page.locator('#roofPriceAssumptions').innerText(), /detach-and-reset, storage and reinstallation are not estimated/i, 'combined calculator must disclose existing solar-array removal/reinstall scope');
  assert.equal(await page.locator('#roofPriceAssumptions a[href="guides/roof-before-solar"]').count(), 1, 'combined calculator must link the roof-before-solar guide from this scope note');
  await page.locator('#loadNationalRoofReference').click();
  assert.equal(await page.locator('#roofRateLow').inputValue(), '4');
  assert.equal(await page.locator('#roofRateHigh').inputValue(), '11');
  assert.match(await page.locator('#roofReferenceStatus').innerText(), /not a local or material-specific price/i);

  // Roof material is descriptive and optional; with the required roof area supplied, it must not block progress.
  await page.locator('#roofArea').fill('1800');
  // Roof-price assumptions belong to Step 1, so enter them before advancing.
  await page.locator('#roofRateLow').fill('5');
  await page.locator('#roofRateHigh').fill('8');
  await page.locator('button[data-next="2"]').click();
  await page.locator('[data-panel="2"]').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#roofType').inputValue(), '', 'combined calculator must allow the visitor to continue without choosing roof material');
  await page.locator('#annualKwh').fill('10800');
  await page.locator('#rate').fill('0.18');
  await page.locator('#solarCostAssumptions summary').click();
  await page.locator('#selfUse').fill('40');
  await page.locator('#exportRate').fill('0.04');
  await page.locator('#productionPerKw').fill('1300');
  assert.equal(await page.locator('#solarPricePerWatt').inputValue(), '', 'solar price must remain blank until requested');
  await page.waitForFunction(() => typeof window.loadNationalSolarReference === 'function', undefined, { timeout: 10000 });
  await page.locator('#loadNationalSolarReference').click();
  await page.waitForFunction(() => document.getElementById('solarPricePerWatt')?.value === '2.62', undefined, { timeout: 5000 });
  assert.equal(await page.locator('#solarPricePerWatt').inputValue(), '2.62', 'real browser click must load the editable $2.62/W national solar reference');
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

  // Roof-area calculator: ensure the geometric estimate and its limitation note render in a real browser.
  await open('/calculators/roof-area.html');
  await page.screenshot({ path: path.join(screenshotDir, 'roof-area-disclaimer-desktop.png'), fullPage: true });
  assert.equal(await page.locator('.calculator-notice').count(), 1, 'roof-area page must render one universal planning notice');
  assert.equal((await page.locator('.calculator-notice').innerText()).trim(), 'Planning estimates only. Results depend on the inputs and assumptions shown; they are not quotes, inspections, engineering designs, or guarantees.');
  assert.equal(await page.locator('#result + .calculator-method-note').count(), 1, 'roof-area methodology note must be the immediate sibling after the result');
  await assertNoHorizontalOverflow('roof-area');
  await accessibilityScan('roof-area-desktop');
  await page.locator('#footprint').fill('1800');
  await page.locator('#pitch').selectOption('1.118');
  await page.locator('#run').click();
  await page.waitForFunction(() => /2,012 sq ft/.test(document.querySelector('#result')?.innerText || ''), undefined, { timeout: 15000 });
  const roofAreaResult = await page.locator('#result').innerText();
  assert.match(roofAreaResult, /1,800 sq ft × pitch multiplier 1\.118/);
  await page.screenshot({ path: path.join(screenshotDir, 'roof-area-calculation-result.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await accessibilityScan('roof-area-mobile');
  await page.screenshot({ path: path.join(screenshotDir, 'roof-area-disclaimer-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1365, height: 900 });
  results.push('roof-area calculator disclosure, geometric formula, result and responsive browser flow: PASS');

  // Solar panel-count calculator: verify both mutually exclusive calculation methods.
  await open('/calculators/solar-panel-count.html');
  await page.screenshot({ path: path.join(screenshotDir, 'solar-panel-count-disclaimer-desktop.png'), fullPage: true });
  assert.equal(await page.locator('.calculator-notice').count(), 1, 'solar panel-count page must render one universal planning notice');
  assert.equal(await page.locator('#result + .calculator-method-note').count(), 1, 'panel-count methodology note must immediately follow the result');
  await assertNoHorizontalOverflow('solar-panel-count');
  await accessibilityScan('solar-panel-count-desktop');
  const panelCountMethod = await page.locator('.calculator-method-note').innerText();
  assert.match(panelCountMethod, /quoted DC system size/i, 'method note must disclose the quoted-system-size alternative');
  assert.match(panelCountMethod, /annual production is not calculated by this method/i, 'method note must explain what the alternative method does not calculate');
  assert.match(panelCountMethod, /original installation of the item is completed/i, 'Section 25D timing must identify installation completion');
  assert.match(panelCountMethod, /original use of the constructed or reconstructed structure/i, 'Section 25D timing must identify the construction/reconstruction rule');
  assert.equal(await page.locator('.calculator-method-note a[href^="https://www.irs.gov/"]').count(), 1, 'panel-count Section 25D disclosure must link directly to IRS guidance');

  await page.locator('#annualUse').fill('10800');
  await page.locator('#offset').fill('80');
  await page.locator('#production').fill('1500');
  await page.locator('#watt').fill('400');
  await page.locator('#run').click();
  await page.waitForFunction(() => /15 panels/.test(document.querySelector('#result')?.innerText || ''), undefined, { timeout: 15000 });
  const usagePanelCount = await page.locator('#result').innerText();
  assert.match(usagePanelCount, /Calculated array capacity: 6\.00 kW DC/);
  assert.match(usagePanelCount, /Target annual generation: 8,640 kWh/);
  await page.screenshot({ path: path.join(screenshotDir, 'solar-panel-count-usage-method-result.png'), fullPage: true });

  await page.locator('#reset').click();
  await page.locator('#kw').fill('6.6');
  await page.locator('#watt').fill('400');
  await page.locator('#run').click();
  await page.waitForFunction(() => /17 panels/.test(document.querySelector('#result')?.innerText || ''), undefined, { timeout: 15000 });
  const quotedPanelCount = await page.locator('#result').innerText();
  assert.match(quotedPanelCount, /Quoted target capacity: 6\.60 kW DC/);
  assert.match(quotedPanelCount, /Annual production was not calculated/);
  await page.screenshot({ path: path.join(screenshotDir, 'solar-panel-count-quoted-size-method-result.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await accessibilityScan('solar-panel-count-mobile');
  await page.screenshot({ path: path.join(screenshotDir, 'solar-panel-count-disclaimer-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1365, height: 900 });
  results.push('solar panel-count usage-based and quoted-size methods, Section 25D timing and responsive browser flow: PASS');

  // Standalone solar savings: separate sizing inputs, optional tariff modelling and explicit price reference.
  await open('/calculators/solar-savings.html');
  await page.screenshot({ path: path.join(screenshotDir, 'solar-savings-progressive-desktop.png'), fullPage: true });
  await assertNoHorizontalOverflow('solar-savings');
  await accessibilityScan('solar-savings');
  assert.equal(await page.locator('#price').inputValue(), '', 'standalone solar calculator must not silently prefill a national price');
  assert.equal(await page.locator('#selfUseSensitivity').evaluate(node => node.open), false, 'self-use sensitivity should be collapsed initially');
  assert.equal(await page.locator('#assumptionDisclosure').evaluate(node => node.open), false, 'detailed limitations should be collapsed initially');
  await page.locator('#assumptionDisclosure summary').click();
  const limitationsText = await page.locator('#assumptionDisclosure').innerText();
  assert.match(limitationsText, /not a utility-bill simulator/i);
  assert.match(limitationsText, /unknown, not zero/i);
  const solarMethodNote = await page.locator('.calculator-method-note').innerText();
  assert.match(solarMethodNote, /(?:not available|unavailable) for expenditures made after December 31, 2025/i, 'solar calculator must state the current federal Section 25D termination date in the result-adjacent method note');
  assert.equal(await page.locator('.calculator-method-note a[href^="https://www.irs.gov/"]').count(), 1, 'federal credit timing note must link to the IRS source from the result-adjacent method note');
  await page.locator('#assumptionDisclosure summary').click();
  await page.locator('#annualUse').fill('12000');
  await page.locator('#offset').fill('100');
  await page.locator('#production').fill('1500');
  await page.locator('#run').click();
  let solarText = await page.locator('#result').innerText();
  assert.match(solarText, /8\.0 kW DC system/);
  assert.match(solarText, /Not modeled — enter an annual direct-use share/);
  assert.match(solarText, /Not calculated — missing annual direct-use share/);

  await page.locator('#importRate').fill('0.20');
  await page.locator('#selfUse').fill('50');
  await page.locator('#exportRate').fill('0.05');
  await page.locator('#run').click();
  solarText = await page.locator('#result').innerText();
  assert.match(solarText, /\$1,500/);
  assert.match(solarText, /Modeled installed cash price:\s*Not entered/);
  assert.match(solarText, /Not calculated — requires a complete energy-value model and installed price/);

  await page.locator('#loadNationalPriceReference').click();
  assert.equal(await page.locator('#price').inputValue(), '2.62', 'national solar-only price reference must load only after an explicit click');
  assert.match(await page.locator('#priceContext').innerText(), /before incentives/);
  await page.locator('#run').click();
  solarText = await page.locator('#result').innerText();
  assert.match(solarText, /14\.0 years/);
  assert.match(solarText, /EnergySage H1 2026 solar-only marketplace median/);

  // Closed sensitivity controls are excluded; opening them makes their values part of validation and calculation.
  await page.locator('#selfUseLow').evaluate(node => { node.value = '101'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#selfUseHigh').evaluate(node => { node.value = '110'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#run').click();
  assert.doesNotMatch(await page.locator('#result').innerText(), /User-selected self-consumption sensitivity/);
  await page.locator('#selfUseSensitivity summary').click();
  await page.locator('#run').click();
  assert.equal(await page.locator('#selfUseLow').getAttribute('aria-invalid'), 'true');
  assert.ok(await page.locator('#selfUseLow-checker-message').isVisible(), 'opened sensitivity inputs must show inline range errors');
  await page.locator('#selfUseLow').fill('30');
  await page.locator('#selfUseHigh').fill('70');
  await page.locator('#run').click();
  solarText = await page.locator('#result').innerText();
  assert.match(solarText, /30% low case: \$1,140 annual energy value/);
  assert.match(solarText, /70% high case: \$1,860 annual energy value/);
  assert.match(solarText, /14\.0 years/);
  assert.equal(await page.locator('#price').inputValue(), '2.62', 'the national reference must persist through sensitivity validation');
  await page.screenshot({ path: path.join(screenshotDir, 'solar-savings-progressive-results.png'), fullPage: true });
  await page.locator('#selfUseSensitivity summary').click();
  await page.locator('#run').click();
  solarText = await page.locator('#result').innerText();
  assert.doesNotMatch(solarText, /User-selected self-consumption sensitivity/);
  assert.match(solarText, /14\.0 years/, 'closing sensitivity must not clear the installed-price assumption');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(screenshotDir, 'solar-savings-progressive-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1365, height: 900 });
  results.push('standalone solar sizing, tariff value, explicit price reference, sensitivity disclosure and responsive layout: PASS');

  // Standalone roof-cost calculator: AHS availability state, material changes and all metal-system references.
  await open('/calculators/roof-replacement-cost.html');
  assert.match(await page.locator('#main-content').innerText(), /Visitors can deliberately load the broad range as an editable national planning reference/i);
  await page.screenshot({ path: path.join(screenshotDir, 'roof-cost-progressive-desktop.png'), fullPage: true });
  await assertNoHorizontalOverflow('roof-cost-desktop');
  await accessibilityScan('roof-cost');
  assert.equal(await page.locator('.roof-cost-step').count(), 2, 'roof calculator must present two clear tasks');
  assert.match(await page.locator('#roofDetailsHeading').innerText(), /Roof details/);
  assert.match(await page.locator('#roofPriceHeading').innerText(), /Installed price range/);
  assert.equal(await page.locator('#metalSystemField').isVisible(), false, 'metal-specific input starts hidden');
  assert.equal(await page.locator('.roof-field-details').evaluate(node => node.open), false, 'metal methodology starts collapsed');
  assert.equal(await page.locator('.roof-scope-details').evaluate(node => node.open), false, 'scope caveats start collapsed');
  await page.locator('.roof-scope-details summary').click();
  assert.match(await page.locator('.roof-scope-details').innerText(), /does not separately calculate array detach-and-reset, storage or reinstallation/i, 'roof calculator must disclose existing solar-array removal/reinstall scope');
  assert.equal(await page.locator('.roof-scope-details a[href="../guides/roof-before-solar"]').count(), 1, 'roof calculator must link the roof-before-solar guide from this scope note');
  await page.locator('.roof-scope-details summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  const roofMobileLayout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  assert.ok(Math.max(roofMobileLayout.document, roofMobileLayout.body) <= 391, 'roof-cost mobile horizontal overflow: ' + JSON.stringify(roofMobileLayout));
  await accessibilityScan('roof-cost-mobile');
  await page.screenshot({ path: path.join(screenshotDir, 'roof-cost-progressive-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.waitForFunction(() => {
    const node = document.querySelector('#roofMetroBenchmarkResult');
    return Boolean(node && /national point estimates reproduce the Census Table C-16/i.test(node.innerText));
  }, undefined, { timeout: 15000 });
  assert.equal(await page.locator('#roofMetroBenchmarkField').isVisible(), false, 'empty AHS registry must hide the unavailable dropdown field');
  const ahsStatus = await page.locator('#roofMetroBenchmarkResult').innerText();
  assert.match(ahsStatus, /No AHS metro roofing distribution is currently approved/i);
  assert.match(ahsStatus, /national point estimates reproduce the Census Table C-16/i);

  const styleValues = await page.locator('#metalSystem optgroup[label="Roof style / system"] option').evaluateAll(options => options.map(option => option.value));
  const materialValues = await page.locator('#metalSystem optgroup[label="Base metal / material"] option').evaluateAll(options => options.map(option => option.value));
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
  await page.waitForTimeout(100);
  const metalRefAfter = await page.locator('#loadReference').evaluate(button => ({
    text: button.textContent,
    disabled: button.disabled,
    material: document.querySelector('#material')?.value,
    system: document.querySelector('#metalSystem')?.value,
    low: document.querySelector('#low')?.value,
    high: document.querySelector('#high')?.value,
    status: document.querySelector('#referenceStatus')?.textContent
  }));
  assert.equal(metalRefAfter.low, '6', 'metal shingles reference button did not load the published low rate');
  assert.equal(metalRefAfter.high, '14', 'metal shingles reference button did not load the published high rate');

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
  assert.equal(await page.locator('link[rel="icon"][href="/assets/favicon.svg"]').count(), 1, 'city estimator must declare its SVG favicon explicitly');
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


  // Combined estimator -> city PV lookup -> return: preserve inputs and resume at energy step.
  await open('/index.html');
  await page.locator('#roofType').selectOption('asphalt');
  await page.locator('#roofAge').fill('12');
  await page.locator('#roofArea').fill('1800');
  await page.locator('#roofPriceAssumptions summary').click();
  await page.locator('#roofRateLow').fill('5.25');
  await page.locator('#roofRateHigh').fill('8.75');
  await page.locator('#condition').selectOption('fair');
  await page.locator('button[data-next="2"]').click();
  await page.locator('#annualKwh').fill('10800');
  await page.locator('#rate').fill('0.18');
  await page.locator('#solarCostAssumptions summary').click();
  await page.locator('#selfUse').fill('40');
  await page.locator('#exportRate').fill('0.04');
  await page.locator('#solarPricePerWatt').fill('3.05');
  await page.locator('#productionPerKw').fill('1450'); // stale manual yield must not override the city PV result
  await page.locator('#offset').fill('80');
  await page.locator('.city-data-bridge a').evaluate(anchor => {
    const url = new URL(anchor.href);
    url.searchParams.set('city', 'Austin');
    url.searchParams.set('state', 'TX');
    anchor.href = url.toString();
  });
  await page.locator('.city-data-bridge a').click();
  await page.locator('#placeField').waitFor({ state: 'visible', timeout: 30000 });
  const returnPlaceOptions = await page.locator('#place option').evaluateAll(items => items.map(item => ({ value: item.value, text: item.textContent })));
  const returnPlace = returnPlaceOptions.find(item => item.value);
  assert.ok(returnPlace, 'return-flow city lookup did not produce a Census place');
  await page.locator('#place').selectOption(returnPlace.value);
  await page.locator('#estimate').click();
  await page.waitForFunction(() => {
    const text = document.querySelector('#result')?.innerText || '';
    return Boolean(text) && !/Waiting for location and inputs|Model needs updating|Calculating(?:…|\.\.\.)?/i.test(text);
  }, undefined, { timeout: 60000 });
  await page.locator('#combinedLink').waitFor({ state: 'visible' });
  assert.match(await page.locator('#continueTitle').innerText(), /Return to your combined estimate/i);
  assert.ok(!(await page.locator('#combinedLink').getAttribute('class')).includes('btn-outline'), 'combined return action should be primary when the visitor came from the combined calculator');
  await page.locator('#combinedLink').click();
  await page.locator('[data-panel="2"]').waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await page.locator('#roofType').inputValue(), 'asphalt');
  assert.equal(await page.locator('#roofAge').inputValue(), '12');
  assert.equal(await page.locator('#roofArea').inputValue(), '1800');
  assert.equal(await page.locator('#roofRateLow').inputValue(), '5.25');
  assert.equal(await page.locator('#roofRateHigh').inputValue(), '8.75');
  assert.equal(await page.locator('#condition').inputValue(), 'fair');
  assert.equal(await page.locator('#annualKwh').inputValue(), '10800');
  assert.equal(await page.locator('#rate').inputValue(), '0.18');
  assert.equal(await page.locator('#selfUse').inputValue(), '40');
  assert.equal(await page.locator('#exportRate').inputValue(), '0.04');
  assert.equal(await page.locator('#solarPricePerWatt').inputValue(), '3.05');
  assert.equal(await page.locator('#offset').inputValue(), '80');
  assert.equal(await page.locator('#roofPriceAssumptions').evaluate(node => node.open), true, 'roof assumptions disclosure state must be restored');
  assert.equal(await page.locator('#solarCostAssumptions').evaluate(node => node.open), true, 'solar assumptions disclosure state must be restored');
  const returnedProduction = Number(await page.locator('#productionPerKw').inputValue());
  assert.ok(returnedProduction > 0 && returnedProduction !== 1450, 'fresh PVWatts production must replace the stale manually entered yield');
  assert.ok(await page.locator('#combinedRestoreStatus').isVisible(), 'restoration confirmation should be visible');
  results.push('combined calculator city-handoff state preservation and return: PASS');
  await page.screenshot({ path: path.join(screenshotDir, 'combined-calculator-return-restored.png'), fullPage: true });

  // Standalone savings calculator.
  await open('/calculators/solar-savings.html');
  await page.screenshot({ path: path.join(screenshotDir, 'solar-savings-ux-desktop.png'), fullPage: true });
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
    const text = document.querySelector('#result')?.innerText || '';
    return /6\.6 kW DC system/.test(text);
  }, undefined, { timeout: 15000 });
  const savings = await page.locator('#result').innerText();
  assert.match(savings, /6\.6 kW DC system/);
  assert.match(savings, /\$829/);
  assert.match(savings, /Modeled installed cash price:\s*Not entered/);
  assert.match(savings, /Not calculated — requires a complete energy-value model and installed price/);
  results.push('standalone solar savings calculation and blank-price behavior: PASS');
  await page.screenshot({ path: path.join(screenshotDir, 'solar-savings-ux-results.png'), fullPage: true });

  expected404Navigation = true;
  const missingResponse = await page.goto(base + '/__google-tag-browser-404-check-20261118', { waitUntil: 'domcontentloaded', timeout: 60000 });
  assertPreviewNotAccessChallenge(missingResponse, 'Preview custom 404 request');
  assert.ok(missingResponse, 'No HTTP response for the custom 404 route');
  await page.waitForLoadState('load');
  expected404Navigation = false;
  assert.equal(expected404Responses, 1, 'Only the expected main-document 404 response may be returned during the custom 404 check');
  assert.equal(missingResponse.status(), 404, 'Unknown Preview route must return HTTP 404');
  assert.match(await page.locator('main h1').innerText(), /We could not find that page/i, 'Custom 404 content must render');
  assert.equal(await page.locator('script[src*="google-tag-bootstrap-1.js"]').count(), 0, 'Custom 404 must not load the removed Google tracking bootstrap');
  assert.equal(await page.locator('script[src*="googletagmanager.com/gtm.js"]').count(), 0, 'Custom 404 must not load Google Tag Manager');
  results.push('custom 404 renders without Google tracking injection: PASS');

  // Cloudflare Pages preview deployments may not receive the production Web Analytics
  // injection. If the beacon script is present on preview, its static asset must still return 200.
  // Require the script on the registered production hostname, not on an unregistered pages.dev alias.
  const previewHost = new URL(base).hostname.endsWith('.pages.dev');
  if (!previewHost) {
    assert.ok(beaconScriptResponses.some(item => item.status === 200), 'Cloudflare Web Analytics beacon script must load on the registered production hostname; observed: ' + JSON.stringify(beaconScriptResponses));
  }
  assert.ok(beaconScriptResponses.every(item => item.status === 200), 'Cloudflare Web Analytics beacon script returned a non-200 response: ' + JSON.stringify(beaconScriptResponses));
  // Preview pages.dev hosts are not the registered analytics hostname. A failed beacon request
  // can be aborted during navigation without a matching CORS console message, so counts need not match.
  assert.ok(previewBeaconGenericFailures <= previewBeaconRequestFailures.length, 'Unmatched net::ERR_FAILED console errors must not be suppressed');
  assert.equal(browserErrors.length, 0, 'Unexpected browser console/page errors: ' + JSON.stringify(browserErrors));
  assert.equal(requestFailures.length, 0, 'Failed site/API requests: ' + JSON.stringify(requestFailures));
  console.log('Expected preview-only telemetry: CORS console errors=' + previewBeaconCorsErrors.length + ', failed beacon requests=' + previewBeaconRequestFailures.length);
  console.log('No unexpected browser errors or site/API request failures.');
  console.log('BROWSER PREVIEW QA COMPLETED.');
  console.log(results.join('\n'));
} finally {
  await browser.close();
}
