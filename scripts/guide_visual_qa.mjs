#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || '/tmp/roofsolar-playwright/node_modules/playwright');
const axeModule = require(process.env.AXE_PLAYWRIGHT_PACKAGE || '/tmp/roofsolar-playwright/node_modules/@axe-core/playwright');
const AxeBuilder = axeModule.default || axeModule;
const base = (process.env.PREVIEW_BASE_URL || '').replace(/\/+$/, '');
const expectedSha = process.env.EXPECTED_PREVIEW_SHA || '';
const out = process.env.QA_GUIDE_SCREENSHOT_DIR || 'browser-qa-output/guide-pages';
const guides = [
  'are-solar-panels-worth-it','metal-roof-cost','metal-roof-vs-asphalt-shingles','roof-before-solar',
  'roof-life-by-material','roof-repair-cost','roof-repair-vs-replacement','roof-replacement-cost-factors',
  'roof-replacement-cost','solar-installation-cost','solar-loan-vs-lease-vs-ppa','understanding-solar-bill-savings'
];
assert.ok(base, 'PREVIEW_BASE_URL is required');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1365,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
try {
  const identity=await fetch(base+'/build-info.json',{cache:'no-store'});
  assert.equal(identity.status,200,'Preview build identity unavailable');
  const build=await identity.json();
  assert.equal(build.commit,expectedSha,'Preview alias does not serve the expected PR commit');
  for (const slug of guides) {
    const route='/guides/'+slug;
    const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:60000});
    assert.ok(response,route+' gave no response');
    assert.equal(response.status(),200,route+' HTTP status');
    assert.match((response.headers()['x-robots-tag']||'').toLowerCase(),/noindex/,route+' Preview must remain noindex');
    await page.locator('h1').waitFor({state:'visible'});
    const h1=(await page.locator('h1').innerText()).trim();
    assert.ok(h1.length>10,route+' missing meaningful H1');
    const bodyText=await page.locator('body').innerText();
    assert.match(bodyText,/Here is the real-world catch:/,route+' missing required Pro Tip lead-in');
    assert.match(bodyText,/My take:/,route+' missing editorial takeaway');
    for (const width of [1365,768,390]) {
      await page.setViewportSize({width,height:900});
      await page.waitForTimeout(100);
      const dimensions=await page.evaluate(()=>({viewport:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      assert.ok(Math.max(dimensions.doc,dimensions.body)<=width+1,route+' horizontal overflow at '+width+': '+JSON.stringify(dimensions));
      const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      const serious=report.violations.filter(v=>v.impact==='critical'||v.impact==='serious');
      assert.equal(serious.length,0,route+' serious/critical accessibility findings at '+width+': '+JSON.stringify(serious.map(v=>({id:v.id,help:v.help,nodes:v.nodes.length}))));
      const suffix=width===1365?'desktop':width===768?'tablet-768':'mobile-390';
      await page.screenshot({path:path.join(out,slug+'-'+suffix+'.png'),fullPage:true});
    }
    console.log('GUIDE_VISUAL_QA_PASS '+route+' | '+h1);
  }
  assert.equal(pageErrors.length,0,'Uncaught page errors: '+JSON.stringify(pageErrors));
  console.log('ALL 12 GUIDE PAGES PASSED at desktop, 768px tablet and 390px mobile. 36 full-page screenshots captured.');
} finally { await browser.close(); }
