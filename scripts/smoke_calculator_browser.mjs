#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.PREVIEW_BASE_URL;
if (!base || !/^https:\/\/[a-z0-9-]+\.roof-solar-toolkit-2026\.pages\.dev$/i.test(base)) {
  throw new Error("PREVIEW_BASE_URL must be this project's HTTPS Cloudflare Pages Preview hostname.");
}

const pagePaths = [
  "/",
  "/about.html",
  "/editorial-policy.html",
  "/electricity-prices-by-state.html",
  "/methodology.html",
  "/privacy.html",
  "/terms.html",
  "/calculators/location-solar.html",
  "/calculators/roof-area.html",
  "/calculators/roof-replacement-cost.html",
  "/calculators/solar-panel-count.html",
  "/calculators/solar-savings.html",
  "/guides/are-solar-panels-worth-it.html",
  "/guides/metal-roof-cost.html",
  "/guides/metal-roof-vs-asphalt-shingles.html",
  "/guides/roof-before-solar.html",
  "/guides/roof-life-by-material.html",
  "/guides/roof-repair-cost.html",
  "/guides/roof-repair-vs-replacement.html",
  "/guides/roof-replacement-cost-factors.html",
  "/guides/roof-replacement-cost.html",
  "/guides/solar-installation-cost.html",
  "/guides/solar-loan-vs-lease-vs-ppa.html",
  "/guides/understanding-solar-bill-savings.html",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const pageErrors = [];
const failedSameOriginRequests = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("requestfailed", (request) => {
  if (request.url().startsWith(base)) {
    failedSameOriginRequests.push(request.url() + " :: " + (request.failure()?.errorText || "request failed"));
  }
});

async function navigate(path) {
  let lastStatus = "no response";
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    try {
      const target = new URL(path, base);
      // Cloudflare branch aliases can be served through edge caches. Give every
      // navigation a unique query key so this run tests the current preview build.
      target.searchParams.set("__qa_cache_bust", String(Date.now()) + "-" + attempt);
      const response = await page.goto(target.href, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      lastStatus = response ? String(response.status()) : "no response";
      if (response?.status() === 200) return response;
    } catch (error) {
      lastStatus = error.message;
    }
    await sleep(5000);
  }
  throw new Error("Preview did not serve " + path + " with HTTP 200: " + lastStatus);
}

try {
  for (const path of pagePaths) {
    const response = await navigate(path);
    assert.equal(response.status(), 200, path + " must return HTTP 200");
    const heading = await page.locator("h1").first().textContent();
    assert.ok(heading?.trim(), path + " must render a page heading");
  }

  // Regression for the owner's previously reported Metal -> second selector issue.
  await navigate("/calculators/roof-replacement-cost.html");
  const material = page.locator("#material");
  const metalField = page.locator("#metalSystemField");
  const metalSystem = page.locator("#metalSystem");
  const referenceButton = page.locator("#loadReference");
  const low = page.locator("#low");
  const high = page.locator("#high");
  const result = page.locator("#result");

  await material.selectOption("metal");
  assert.equal(await metalField.isVisible(), true, "Metal selection must reveal the second selector");
  assert.equal(await referenceButton.isDisabled(), true, "A metal category is required before loading a metal reference");

  await metalSystem.selectOption("standing_seam");
  assert.equal(await referenceButton.isDisabled(), false, "Selecting a metal category must enable its reference button");
  assert.match(await referenceButton.textContent(), /standing seam reference \(\$9–\$16/i);
  assert.equal(await low.inputValue(), "9", "Standing seam selection should load its low rate");
  assert.equal(await high.inputValue(), "16", "Standing seam selection should load its high rate");

  await metalSystem.selectOption("aluminum");
  assert.equal(await low.inputValue(), "7", "Changing an untouched metal reference should refresh the low endpoint");
  assert.equal(await high.inputValue(), "17", "Changing an untouched metal reference should refresh the high endpoint");

  await low.fill("8");
  await metalSystem.selectOption("copper");
  assert.equal(await low.inputValue(), "8", "A visitor-edited endpoint must not be silently overwritten on category change");
  assert.equal(await high.inputValue(), "17", "The unedited endpoint must remain visible as a mixed/custom value");
  assert.match(await page.locator("#referenceStatus").textContent(), /Mixed\/custom/i);

  await referenceButton.click();
  assert.equal(await low.inputValue(), "13");
  assert.equal(await high.inputValue(), "30");
  await page.locator("#area").fill("2000");
  await page.locator("#run").click();
  const roofText = await result.innerText();
  assert.match(roofText, /\$26,000/);
  assert.match(roofText, /\$60,000/);
  assert.match(roofText, /copper/i);

  await material.selectOption("asphalt");
  assert.equal(await metalField.isVisible(), false, "Metal selector must hide after changing to a non-metal material");
  assert.equal(await low.inputValue(), "", "A published metal reference must be cleared after changing material");
  assert.equal(await high.inputValue(), "", "A published metal reference must be cleared after changing material");

  await material.selectOption("metal");
  assert.equal(await metalField.isVisible(), true);
  assert.equal(await referenceButton.isDisabled(), true, "Changing back to metal must require a new category selection");
  await metalSystem.selectOption("corrugated");
  assert.equal(await low.inputValue(), "5");
  assert.equal(await high.inputValue(), "12");
  await referenceButton.click();
  assert.equal(await low.inputValue(), "5");
  assert.equal(await high.inputValue(), "12");

  // Roof-area geometry: 2,000 sq ft footprint × 1.118 (6:12) = 2,236 sq ft.
  await navigate("/calculators/roof-area.html");
  await page.locator("#footprint").fill("2000");
  await page.locator("#pitch").selectOption("1.118");
  await page.locator("#run").click();
  assert.match(await page.locator("#result").innerText(), /2,236 sq ft/);

  // Usage-based panel count: 12,000 kWh × 100% ÷ 1,500 = 8 kW DC,
  // then ceil(8,000 W ÷ 400 W/module) = 20 modules.
  await navigate("/calculators/solar-panel-count.html");
  await page.locator("#annualUse").fill("12000");
  await page.locator("#offset").fill("100");
  await page.locator("#production").fill("1500");
  await page.locator("#watt").fill("400");
  await page.locator("#panelArea").fill("20");
  await page.locator("#run").click();
  const panelText = await page.locator("#result").innerText();
  assert.match(panelText, /20 panels/);
  assert.match(panelText, /8\.00 kW DC/);
  assert.match(panelText, /12,000 kWh/);

  // Annual solar value: 6,000 kWh direct × $0.20 + 6,000 kWh export × $0.05 = $1,500.
  // $20,960 installed cost ÷ $1,500/year = 13.97 years, displayed as 14.0.
  await navigate("/calculators/solar-savings.html");
  const selfUseField = page.locator("#selfUse");
  const selfUsePlaceholder = await selfUseField.getAttribute("placeholder");
  assert.equal(
    selfUsePlaceholder,
    "Enter a modeled annual share",
    "Solar Savings Preview must serve the current source revision, not stale cached HTML",
  );
  const selfUseVisibility = await selfUseField.evaluate((element) => {
    const chain = [];
    for (let node = element; node && node instanceof HTMLElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      chain.push({
        tag: node.tagName,
        id: node.id,
        className: node.className,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    return chain;
  });
  assert.equal(
    await selfUseField.isVisible(),
    true,
    "Self-use field must be visible; ancestor visibility diagnostics: " + JSON.stringify(selfUseVisibility),
  );
  await page.locator("#annualUse").fill("12000");
  await page.locator("#importRate").fill("0.20");
  await page.locator("#offset").fill("100");
  await page.locator("#production").fill("1500");
  await page.locator("#selfUse").fill("50");
  await page.locator("#exportRate").fill("0.05");
  await page.locator("#price").fill("2.62");
  await page.locator("#run").click();
  const solarText = await page.locator("#result").innerText();
  assert.match(solarText, /\$1,500/);
  assert.match(solarText, /14\.0 years/);

  // Main combined homepage calculator: home-area conversion, roof condition,
  // annual-energy value, payback and financing toggle.
  await navigate("/");
  assert.equal(await page.locator("#roofType").inputValue(), "", "Roof material should start optional, not block a combined estimate");
  await page.locator("#roofAge").fill("12");
  await page.locator("#condition").selectOption("poor");
  await page.locator("#areaHome").check();
  await page.locator("#homeArea").fill("3200");
  await page.locator("#stories").selectOption("2");

  // Home-area mode must require a pitch before continuing.
  await page.locator('[data-next="2"]').click();
  assert.equal(
    await page.locator("#pitch").evaluate((element) => element.checkValidity()),
    false,
    "Pitch must be browser-required in home-area mode",
  );
  assert.equal(await page.locator('[data-panel="1"]').isVisible(), true);
  assert.equal(await page.locator('[data-panel="2"]').isVisible(), false);

  const combinedPitchOptions = await page.locator("#pitch option").evaluateAll((options) => options.map((option) => option.value));
  assert.ok(combinedPitchOptions.includes("moderateLow"), "Combined estimator must offer 4:12 pitch");
  assert.ok(combinedPitchOptions.includes("verySteep"), "Combined estimator must offer 12:12 pitch");
  await page.locator("#pitch").selectOption("moderate");
  // Roof-price assumptions are intentionally collapsed by default; expand them before interacting.
  await page.locator("#roofPriceAssumptions > summary").click();
  assert.equal(await page.locator("#loadNationalRoofReference").isVisible(), true);
  await page.locator("#loadNationalRoofReference").click();
  await page.locator('[data-next="2"]').click();
  assert.equal(await page.locator('[data-panel="2"]').isVisible(), true);

  await page.locator("#annualKwh").fill("12000");
  await page.locator("#rate").fill("0.20");
  // Solar value assumptions are intentionally collapsed in the combined calculator.
  await page.locator("#solarCostAssumptions > summary").click();
  assert.equal(await page.locator("#solarCostAssumptions").evaluate((element) => element.open), true);
  // Loan illustrations require an installed price; load the national reference explicitly.
  await page.locator("#loadNationalSolarReference").click();
  assert.equal(await page.locator("#solarPricePerWatt").inputValue(), "2.62");
  await page.locator("#selfUse").fill("50");
  await page.locator("#exportRate").fill("0.05");
  await page.locator("#productionPerKw").fill("1500");
  await page.locator("#offset").fill("100");

  // Switch to loan: APR and term fields must become visible and required.
  await page.locator("#loan").check();
  assert.equal(await page.locator("#aprField").isVisible(), true);
  assert.equal(await page.locator("#termField").isVisible(), true);
  await page.locator("#apr").fill("7");
  await page.locator("#term").fill("20");
  await page.locator("#calculateButton").click();

  assert.equal(await page.locator("#results").isVisible(), true);
  assert.match(await page.locator("#roofStatus").innerText(), /prompt inspection/i);
  assert.match(await page.locator("#roofAreaResult").innerText(), /1,789 sq ft/);
  assert.match(await page.locator("#roofCost").innerText(), /\$7,155.*\$19,677/);
  assert.match(await page.locator("#systemSize").innerText(), /8\.0 kW/);
  assert.match(await page.locator("#production").innerText(), /12,000 kWh \/ yr/);
  assert.match(await page.locator("#annualSavings").innerText(), /\$1,500 \/ yr/);
  assert.match(await page.locator("#monthlySavings").innerText(), /\$125/);
  assert.match(await page.locator("#payback").innerText(), /14\.0 years/);
  assert.match(await page.locator("#solarCost").innerText(), /\$20,960/);
  assert.match(await page.locator("#loanTerms").innerText(), /7\.0% \/ 20 yrs/);
  const expectedLoanPayment = (() => {
    const principal = 20960;
    const monthlyRate = 0.07 / 12;
    const months = 20 * 12;
    return principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  })();
  const actualLoanPayment = Number((await page.locator("#loanPayment").innerText()).replace(/[^0-9.]/g, ""));
  assert.ok(Math.abs(actualLoanPayment - expectedLoanPayment) < 0.51, "Combined calculator loan payment should match amortization formula");
  // The detailed assumptions list is intentionally disclosed in a collapsed section.
  await page.locator(".assumption-details > summary").click();
  const assumptions = await page.locator("#assumptionList").innerText();
  assert.match(assumptions, /floor area ÷ 2 stories/);
  assert.match(assumptions, /1\.118/);
  assert.match(await page.locator("#roofStatusDesc").innerText(), /leaks or visible damage/i);

  // Recalculate at the newly supported 12:12 and 4:12 pitches.
  await page.locator("#editInputs").click();
  await page.locator("#pitch").selectOption("verySteep");
  await page.locator('[data-next="2"]').click();
  assert.equal(await page.locator('[data-panel="2"]').isVisible(), true);
  await page.locator("#calculateButton").click();
  assert.match(await page.locator("#roofAreaResult").innerText(), /2,262 sq ft/);
  await page.locator("#editInputs").click();
  await page.locator("#pitch").selectOption("moderateLow");
  await page.locator('[data-next="2"]').click();
  assert.equal(await page.locator('[data-panel="2"]').isVisible(), true);
  await page.locator("#calculateButton").click();
  assert.match(await page.locator("#roofAreaResult").innerText(), /1,686 sq ft/);

  // Unknown export credit must withhold total value and payback, never silently assume $0.
  await page.locator("#editInputs").click();
  await page.locator('[data-next="2"]').click();
  await page.locator("#exportRate").fill("");
  await page.locator("#calculateButton").click();
  assert.match(await page.locator("#annualSavings").innerText(), /Inputs needed/);
  assert.match(await page.locator("#payback").innerText(), /Not modeled/);
  assert.match(await page.locator("#resultWarning").innerText(), /No export credit was entered/i);

  // Missing import price must also remain unknown, not appear as $0.000/kWh.
  await page.locator("#editInputs").click();
  await page.locator('[data-next="2"]').click();
  await page.locator("#rate").fill("");
  await page.locator("#exportRate").fill("0.05");
  await page.locator("#calculateButton").click();
  assert.match(await page.locator("#annualSavings").innerText(), /Inputs needed/);
  assert.match(await page.locator("#savingsDesc").innerText(), /import rate is unknown/i);
  assert.doesNotMatch(await page.locator("#savingsDesc").innerText(), /0\.000\/kWh/);

  // Check the key calculator screens at a narrow viewport for horizontal overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/calculators/roof-replacement-cost.html",
    "/calculators/roof-area.html",
    "/calculators/solar-panel-count.html",
    "/calculators/solar-savings.html",
  ]) {
    await navigate(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, path + " must not overflow horizontally at 390px width");
  }

  assert.deepEqual(pageErrors, [], "No uncaught JavaScript errors should occur while opening the public pages and using calculators");
  assert.deepEqual(failedSameOriginRequests, [], "No same-origin assets or data requests should fail");

  console.log("PASS: " + pagePaths.length + " public HTML pages rendered with no uncaught JavaScript errors.");
  console.log("PASS: Metal material selection reveals the second selector; reference switching, mixed-rate preservation, reload, recalculation and material reset work.");
  console.log("PASS: roof area, panel count and annual solar savings/payback match deterministic test cases.");
  console.log("PASS: four calculator screens have no horizontal overflow at 390px width.");
} finally {
  await browser.close();
}
