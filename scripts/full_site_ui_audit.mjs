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
const base = (process.env.PREVIEW_BASE_URL || '').replace(/\/+$/, '');
const expectedSha = process.env.EXPECTED_PREVIEW_SHA || '';
const outputDir = process.env.QA_SCREENSHOT_DIR || 'browser-qa-output';
if (!base) throw new Error('PREVIEW_BASE_URL is required.');

const routes = [
  '/',
  '/calculators/location-solar',
  '/calculators/roof-area',
  '/calculators/roof-replacement-cost',
  '/calculators/solar-panel-count',
  '/calculators/solar-savings',
  '/guides/are-solar-panels-worth-it',
  '/guides/metal-roof-cost',
  '/guides/metal-roof-vs-asphalt-shingles',
  '/guides/roof-before-solar',
  '/guides/roof-life-by-material',
  '/guides/roof-repair-cost',
  '/guides/roof-repair-vs-replacement',
  '/guides/roof-replacement-cost-factors',
  '/guides/roof-replacement-cost',
  '/guides/solar-installation-cost',
  '/guides/solar-loan-vs-lease-vs-ppa',
  '/guides/understanding-solar-bill-savings',
  '/about',
  '/contact',
  '/editorial-policy',
  '/electricity-prices-by-state',
  '/methodology',
  '/privacy',
  '/terms',
  '/sitemap',
  '/404.html'
];

const browserErrors = [];
const failedSameOriginRequests = [];
const severeAxe = [];
const moderateAxe = [];
const mobileNavFindings = [];
let navigationCount = 0;

async function waitForExactPreview() {
  let last = 'no response';
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(base + '/build-info.json?ui-audit=' + attempt, { cache: 'no-store' });
      last = 'HTTP ' + response.status;
      if (response.ok) {
        const identity = await response.json();
        if (!expectedSha || identity.commit === expectedSha) {
          console.log('PREVIEW_IDENTITY ' + JSON.stringify(identity));
          return;
        }
        last = 'wrong commit ' + (identity.commit || 'missing') + ', expected ' + expectedSha;
      }
    } catch (error) {
      last = error.message;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Preview identity was not ready for ' + expectedSha + ': ' + last);
}

function slug(route) {
  return (route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-')).toLowerCase();
}

async function scanAxe(page, route, viewportName) {
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  for (const violation of report.violations) {
    const entry = {
      route,
      viewport: viewportName,
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
      help: violation.help
    };
    if (violation.impact === 'critical' || violation.impact === 'serious') severeAxe.push(entry);
    else moderateAxe.push(entry);
  }
}

async function inspectRoute(page, route, viewportName, width, height, capture) {
  await page.setViewportSize({ width, height });
  const target = new URL(route, base);
  target.searchParams.set('__full_ui_audit', String(++navigationCount));
  const response = await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  assert.ok(response, route + ' returned no HTTP response');
  assert.equal(response.status(), 200, route + ' returned HTTP ' + response.status());
  const headers = response.headers();
  assert.match((headers['x-robots-tag'] || '').toLowerCase(), /noindex/, route + ' must remain noindex on Preview');

  const headingCount = await page.locator('h1').count();
  assert.equal(headingCount, 1, route + ' must have exactly one H1');
  assert.ok(await page.locator('main#main-content').count(), route + ' must expose the main-content landmark');
  assert.equal(await page.locator('a.skip-link[href="#main-content"]').count(), 1, route + ' must expose the skip link');
  assert.ok(await page.locator('header nav').count(), route + ' must expose primary navigation');

  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  const maxWidth = Math.max(layout.document, layout.body);
  assert.ok(maxWidth <= width + 1, route + ' horizontal overflow at ' + width + 'px: ' + JSON.stringify(layout));

  if (width <= 600) {
    const nav = page.locator('header nav').first();
    const state = await nav.evaluate(element => {
      const visible = Array.from(element.querySelectorAll('a')).filter(anchor => {
        const style = getComputedStyle(anchor);
        const rect = anchor.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      }).map(anchor => ({
        text: (anchor.textContent || '').trim(),
        href: anchor.getAttribute('href'),
        isCta: anchor.classList.contains('btn')
      }));
      const menuControls = element.querySelectorAll('button,[role="button"],[aria-haspopup="menu"]').length;
      return { visible, menuControls };
    });
    const visiblePrimaryLinks = state.visible.filter(link => !link.isCta);
    if (visiblePrimaryLinks.length === 0 && state.menuControls === 0) {
      mobileNavFindings.push(route);
    }
  }

  if (capture) {
    const dir = path.join(outputDir, 'full-site-ui-audit');
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({
      path: path.join(dir, slug(route) + '-' + viewportName + '.png'),
      fullPage: false
    });
  }
  await scanAxe(page, route, viewportName);
}

await waitForExactPreview();
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', error => browserErrors.push(error.message));
page.on('requestfailed', request => {
  if (request.url().startsWith(base)) {
    failedSameOriginRequests.push(request.method() + ' ' + request.url() + ' :: ' + (request.failure()?.errorText || 'request failed'));
  }
});

try {
  for (const route of routes) {
    await inspectRoute(page, route, 'desktop', 1365, 900, true);
    await inspectRoute(page, route, 'mobile', 390, 844, true);
    await page.setViewportSize({ width: 768, height: 900 });
    const tablet = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    assert.ok(Math.max(tablet.document, tablet.body) <= 769, route + ' horizontal overflow at 768px: ' + JSON.stringify(tablet));
  }

  const missing = await page.goto(base + '/__full-site-ui-audit-route-that-does-not-exist', {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });
  const missingHeading = (await page.locator('h1').first().textContent().catch(() => '')) || '';
  assert.match(missingHeading, /could not find|page not found/i, 'Unknown routes must display the custom 404 content');
  console.log('CUSTOM_404_STATUS ' + (missing?.status() ?? 'no response'));

  console.log('FULL_SITE_ROUTE_COUNT ' + routes.length);
  console.log('MOBILE_PRIMARY_NAV_MISSING ' + JSON.stringify(mobileNavFindings));
  console.log('AXE_MODERATE_OR_MINOR ' + JSON.stringify(moderateAxe));
  console.log('AXE_CRITICAL_OR_SERIOUS ' + JSON.stringify(severeAxe));
  console.log('BROWSER_ERRORS ' + JSON.stringify(browserErrors));
  console.log('SAME_ORIGIN_REQUEST_FAILURES ' + JSON.stringify(failedSameOriginRequests));

  assert.deepEqual(browserErrors, [], 'No uncaught browser JavaScript errors should occur on public pages');
  assert.deepEqual(failedSameOriginRequests, [], 'No same-origin requests should fail on public pages');
  assert.deepEqual(severeAxe, [], 'No critical or serious axe violations should remain');
  console.log('PASS: every public route and the custom 404 page rendered at desktop/mobile; mobile/tablet overflow and desktop/mobile accessibility checks completed.');
} finally {
  await browser.close();
}
