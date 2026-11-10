// Explicit scenario assumptions only. Nothing here is a live local lookup or market benchmark.
    const CONFIG = {
      pitchFactors: { low: 1.014, moderate: 1.118, steep: 1.250 } // 2:12, 6:12, 9:12 geometric slope multipliers
    };
    document.getElementById('year').textContent = new Date().getFullYear();


    let currentStep = 1;
    const panels = [...document.querySelectorAll('.step-panel')];
    const progress = document.getElementById('progressValue');
    const stepCount = document.getElementById('stepCount');
    function setStep(step) {
      currentStep = step;
      panels.forEach(p => p.classList.toggle('active', Number(p.dataset.panel) === step));
      document.querySelectorAll('[data-step-label]').forEach(el => {
        const n = Number(el.dataset.stepLabel);
        el.classList.toggle('active', n === step);
        el.classList.toggle('done', n < step);
      });
      progress.style.width = `${step / 3 * 100}%`;
      document.getElementById("stepProgress").setAttribute("aria-valuenow", String(step));
      document.querySelectorAll("[data-step-label]").forEach(el => { if (Number(el.dataset.stepLabel) === step) el.setAttribute("aria-current", "step"); else el.removeAttribute("aria-current"); });
      stepCount.textContent = `STEP ${step} OF 3`;
      if (step < 3) document.getElementById('calculator').scrollIntoView({behavior:'smooth', block:'start'});
    }
    function showError(step, message) { const box = document.getElementById(`error${step}`); box.textContent = message; box.classList.add('show'); }
    function clearError(step) { const box = document.getElementById(`error${step}`); box.textContent = ''; box.classList.remove('show'); }
    function validateStep1() {
      clearError(1);
      const ageText = document.getElementById('roofAge').value.trim();
      const age = ageText === '' ? NaN : Number(ageText);
      const material = document.getElementById('roofType').value;
      const pitch = document.getElementById('pitch').value;
      const mode = document.querySelector('input[name="areaMode"]:checked').value;
      const areaText = document.getElementById(mode === 'roof' ? 'roofArea' : 'homeArea').value.trim();
      const area = areaText === '' ? NaN : Number(areaText);
      const lowText = document.getElementById('roofRateLow').value.trim();
      const highText = document.getElementById('roofRateHigh').value.trim();
      const low = lowText === '' ? null : Number(lowText);
      const high = highText === '' ? null : Number(highText);
      if (!material) return showError(1, 'Select a roof material.'), false;
      if (ageText !== '' && (!Number.isFinite(age) || age < 0 || age > 100)) return showError(1, 'Enter a roof age between 0 and 100 years, or leave it blank if unknown.'), false;
      if (mode === 'home' && !pitch) return showError(1, 'Select the closest roof pitch category when converting home floor area to roof surface area.'), false;
      if (mode === 'home' && !document.getElementById('stories').value) return showError(1, 'Select the number of above-ground stories before using total finished floor area as a footprint estimate.'), false;
      if (!Number.isFinite(area) || area < 100 || area > (mode === 'roof' ? 100000 : 50000)) return showError(1, 'Enter a valid roof surface or total home area within the displayed limits.'), false;
      if ((lowText !== '' || highText !== '') && (!Number.isFinite(low) || !Number.isFinite(high) || low < 0.10 || high < 0.10 || high < low || low > 100 || high > 100)) return showError(1, 'For a roof cost range, enter both local rates from $0.10 to $100 per roof sq ft and ensure the high rate is at least the low rate.'), false;
      return true;
    }
    function validateStep2() {
      clearError(2);
      const annualText = document.getElementById('annualKwh').value.trim();
      const annual = annualText === '' ? null : Number(annualText);
      const rateText = document.getElementById('rate').value.trim();
      const rate = rateText === '' ? null : Number(rateText);
      const offset = Number(document.getElementById('offset').value);
      const selfUseText = document.getElementById('selfUse').value.trim();
      const selfUse = selfUseText === '' ? null : Number(selfUseText);
      const exportText = document.getElementById('exportRate').value.trim();
      const exportRate = exportText === '' ? null : Number(exportText);
      const production = Number(document.getElementById('productionPerKw').value);
      const priceText = document.getElementById('solarPricePerWatt').value.trim();
      const price = priceText === '' ? null : Number(priceText);
      const finance = document.querySelector('input[name="financing"]:checked').value;
      if (annualText === '' || !Number.isFinite(annual) || annual <= 0 || annual > 200000) return showError(2, 'Annual electricity use must be between 1 and 200,000 kWh. Use the kWh totals from the last 12 months of utility bills.'), false;
      if (rateText !== '' && (!Number.isFinite(rate) || rate < 0 || rate > 5)) return showError(2, 'Enter a marginal electricity rate from $0 to $5 per kWh, or leave it blank. A rate is not needed if modeled direct use is zero.'), false;
      if (offset < 5 || offset > 100) return showError(2, 'Choose a solar offset between 5% and 100%.'), false;
      if (selfUse !== null && (!Number.isFinite(selfUse) || selfUse < 0 || selfUse > 100)) return showError(2, 'Self-consumption share must be between 0% and 100%, or left blank until a modeled value is available.'), false;
      if (exportRate !== null && (!Number.isFinite(exportRate) || exportRate < 0 || exportRate > 5)) return showError(2, 'Export compensation must be between $0 and $5 per kWh, or left blank when unknown. Enter $0 only when the applicable tariff confirms zero compensation.'), false;
      if (!Number.isFinite(production) || production < 100 || production > 4000) return showError(2, 'Enter an annual production assumption between 100 and 4,000 kWh per kW. Use a PVWatts result divided by its modeled system kW.'), false;
      if (price !== null && (!Number.isFinite(price) || price <= 0 || price > 20)) return showError(2, 'Installed solar price must be between $0.10 and $20 per watt, or left blank.'), false;
      if (finance === 'loan') {
        const aprText = document.getElementById('apr').value.trim(), termText = document.getElementById('term').value.trim();
        const apr = aprText === '' ? NaN : Number(aprText), term = termText === '' ? NaN : Number(termText);
        if (price === null) return showError(2, 'Enter the installed solar price per watt before calculating a loan illustration.'), false;
        if (!Number.isFinite(apr) || apr < 0 || apr > 35 || !Number.isFinite(term) || term < 1 || term > 30) return showError(2, 'Enter the quoted APR (0–35%) and loan term (1–30 years).'), false;
      }
      return true;
    }
    document.querySelectorAll('[data-next]').forEach(btn => btn.addEventListener('click', () => { if (validateStep1()) setStep(2); }));
    document.querySelectorAll('[data-back]').forEach(btn => btn.addEventListener('click', () => setStep(1)));
    function syncAreaMode() {
      const homeMode = document.querySelector('input[name="areaMode"]:checked').value === 'home';
      document.getElementById('roofAreaField').hidden = homeMode;
      document.getElementById('homeAreaField').hidden = !homeMode;
      document.getElementById('storiesField').hidden = !homeMode;
      document.getElementById('roofArea').required = !homeMode;
      document.getElementById('roofArea').setAttribute('aria-required', String(!homeMode));
      document.getElementById('homeArea').required = homeMode;
      document.getElementById('homeArea').setAttribute('aria-required', String(homeMode));
      document.getElementById('pitch').required = homeMode;
      document.getElementById('pitch').setAttribute('aria-required', String(homeMode));
      document.getElementById('stories').required = homeMode;
      document.getElementById('stories').setAttribute('aria-required', String(homeMode));
      ['roofArea', 'homeArea', 'pitch', 'stories'].forEach((id) => {
        const field = document.getElementById(id);
        if (window.FieldValidation && typeof window.FieldValidation.refreshHint === 'function') window.FieldValidation.refreshHint(field);
      });
    }
    document.querySelectorAll('input[name="areaMode"]').forEach(el => el.addEventListener('change', syncAreaMode));
    syncAreaMode();
    function syncFinancingFields() {
      const loanMode = document.querySelector('input[name="financing"]:checked').value === 'loan';
      document.getElementById('aprField').hidden = !loanMode;
      document.getElementById('termField').hidden = !loanMode;
      document.getElementById('apr').required = loanMode;
      document.getElementById('term').required = loanMode;
      ['apr', 'term'].forEach((id) => {
        const field = document.getElementById(id);
        if (window.FieldValidation && typeof window.FieldValidation.refreshHint === 'function') window.FieldValidation.refreshHint(field);
      });
    }
    document.querySelectorAll('input[name="financing"]').forEach(el => el.addEventListener('change', syncFinancingFields));
    syncFinancingFields();

    const money = (v, digits=0) => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:digits,minimumFractionDigits:digits}).format(v);
    const number = v => new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(v);
    function loanPayment(principal, annualRate, years) {
      const n = years * 12, r = annualRate / 100 / 12;
      if (n <= 0) return 0;
      return r === 0 ? principal/n : principal * r / (1 - Math.pow(1+r, -n));
    }

    // Source-labelled, editable handoffs. Property-specific facts are never guessed.
    const roofLowInput = document.getElementById('roofRateLow');
    const roofHighInput = document.getElementById('roofRateHigh');
    const solarRateInput = document.getElementById('solarPricePerWatt');
    const importRateInput = document.getElementById('rate');
    const productionInput = document.getElementById('productionPerKw');
    const roofReferenceStatus = document.getElementById('roofReferenceStatus');
    const solarReferenceStatus = document.getElementById('solarReferenceStatus');
    let roofRateBasis = 'No roof-price reference loaded; roof cost is not estimated.';
    let solarPriceBasis = 'User-entered quote.';
    let importRateBasis = 'User-entered marginal tariff rate.';
    let importedCityLabel = '';

    function addFieldNote(input, id, message, sourceUrl) {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
      const note = document.createElement('small');
      note.id = id;
      note.className = 'field-import-note';
      note.textContent = `${message} `;
      if (sourceUrl) {
        const link = document.createElement('a');
        link.href = sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Source';
        note.append(link);
      }
      input.closest('.field').append(note);
    }
    function refreshField(input) {
      if (window.FieldValidation && typeof window.FieldValidation.refresh === 'function') window.FieldValidation.refresh(input);
    }

    const handoff = new URLSearchParams(window.location.search);
    const incomingProduction = Number(handoff.get('productionPerKw'));
    if (handoff.get('cityModelSource') === 'PVWatts V8' && Number.isFinite(incomingProduction) && incomingProduction >= 100 && incomingProduction <= 4000) {
      productionInput.value = incomingProduction.toFixed(1);
      importedCityLabel = [handoff.get('city'), handoff.get('state')].filter(Boolean).join(', ');
      const modelTimestamp = Date.parse(handoff.get('pvwattsFetchedAt') || '');
      const modelDateNote = Number.isFinite(modelTimestamp) ? ` Retrieved ${new Date(modelTimestamp).toLocaleDateString('en-US')}.` : '';
      addFieldNote(productionInput, 'productionCityPrefillNote', `Prefilled from NLR PVWatts V8 using a representative Census place point for ${importedCityLabel || 'the selected city'}.${modelDateNote} Model assumptions and property-specific shading may differ. This value is editable.`, 'https://developer.nlr.gov/docs/solar/pvwatts/v8/');
      refreshField(productionInput);
    }
    const incomingStateRate = Number(handoff.get('stateAverageRate'));
    if (handoff.get('stateAverageSource') === 'EIA Electric Power Monthly Table 5.6.B' && Number.isFinite(incomingStateRate) && incomingStateRate > 0 && incomingStateRate <= 5) {
      const stateLabel = handoff.get('state') || 'the selected state';
      const note = document.createElement('small');
      note.id = 'importRatePrefillNote';
      note.className = 'field-import-note';
      note.textContent = `EIA state-average residential electricity price for ${stateLabel}: ${incomingStateRate.toFixed(4)} $/kWh. This is a statewide average, not your marginal utility tariff. It has not been applied.`;
      const source = document.createElement('a');
      source.href = 'https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_06_b';
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = ' Source';
      note.append(source);
      const appliedNote = document.createElement('small');
      appliedNote.className = 'field-import-note';
      appliedNote.id = 'eiaScenarioApplied';
      appliedNote.hidden = true;
      const useButton = document.createElement('button');
      useButton.type = 'button';
      useButton.className = 'btn btn-outline eia-opt-in';
      useButton.id = 'useEiaStateAverage';
      useButton.textContent = 'Use EIA average as an illustrative scenario';
      useButton.addEventListener('click', () => {
        importRateInput.value = incomingStateRate.toFixed(4);
        importRateBasis = `EIA state-average residential price used by explicit visitor choice for ${stateLabel}; illustrative scenario only, not the household marginal tariff.`;
        appliedNote.textContent = `Applied ${incomingStateRate.toFixed(4)} $/kWh EIA state average for ${stateLabel}. This remains an illustrative scenario, not your household tariff.`;
        appliedNote.hidden = false;
        useButton.disabled = true;
        useButton.textContent = 'EIA scenario value applied';
        refreshField(importRateInput);
      });
      importRateInput.closest('.field').append(note, useButton, appliedNote);
    }

    function loadNationalRoofReference() {
      roofLowInput.value = '4';
      roofHighInput.value = '11';
      roofRateBasis = 'Angi broad national reference range (updated October 22, 2026); not city-specific, material-specific or a contractor quote.';
      roofReferenceStatus.hidden = false;
      roofReferenceStatus.textContent = `${roofRateBasis} This is an optional national planning reference, not a local or material-specific price. Replace both rates with comparable local quotes; both values remain editable.`;
      refreshField(roofLowInput); refreshField(roofHighInput);
    }
    function loadNationalSolarReference() {
      solarRateInput.value = '2.62';
      solarPriceBasis = 'EnergySage H1 2026 solar-only marketplace median; national marketplace reference, not city-specific or an installer quote.';
      solarReferenceStatus.hidden = false;
      solarReferenceStatus.textContent = `${solarPriceBasis} It is prefilled only as a planning fallback. Replace with a comparable written cash quote; the value remains editable.`;
      refreshField(solarRateInput);
    }
    document.getElementById('loadNationalRoofReference').addEventListener('click', loadNationalRoofReference);
    document.getElementById('loadNationalSolarReference').addEventListener('click', loadNationalSolarReference);
    // A national source is an explicit fallback where city-level installed-price records
    // have not passed publication gates. City-specific approved records can override it
    // through the location-data handoff; neither fallback is presented as a local quote.
    // Do not silently anchor roof-cost estimates to a broad national range. Visitors
    // must deliberately load it; otherwise the roof-cost component stays unestimated.
    loadNationalSolarReference();

    // An approved city/state historical LBNL distribution overrides the national
    // EnergySage fallback. The project registry remains empty until data licensing,
    // sample, cohort and methodology publication gates are met.
    const incomingSolarPrice = Number(handoff.get('solarPricePerWatt'));
    const incomingSolarP25 = Number(handoff.get('solarPriceP25'));
    const incomingSolarP75 = Number(handoff.get('solarPriceP75'));
    const incomingSolarSampleN = Number(handoff.get('solarPriceSampleN'));
    const incomingSolarYearMin = Number(handoff.get('solarPriceYearMin'));
    const incomingSolarYearMax = Number(handoff.get('solarPriceYearMax'));
    const incomingSolarGeography = handoff.get('solarPriceGeography');
    const minimumSolarSample = incomingSolarGeography === 'city' ? 100 : incomingSolarGeography === 'state' ? 500 : Infinity;
    const incomingSolarDataIsValid = handoff.get('solarPriceSource') === 'Berkeley Lab Tracking the Sun 2026' &&
      Number.isFinite(incomingSolarPrice) && incomingSolarPrice > 0.1 && incomingSolarPrice <= 20 &&
      Number.isFinite(incomingSolarP25) && Number.isFinite(incomingSolarP75) && incomingSolarP25 > 0 &&
      incomingSolarP25 <= incomingSolarPrice && incomingSolarPrice <= incomingSolarP75 &&
      Number.isInteger(incomingSolarSampleN) && incomingSolarSampleN >= minimumSolarSample &&
      incomingSolarYearMin >= 2024 && incomingSolarYearMax <= 2025 && incomingSolarYearMin <= incomingSolarYearMax &&
      ['city', 'state'].includes(incomingSolarGeography);
    if (incomingSolarDataIsValid) {
      solarRateInput.value = incomingSolarPrice.toFixed(2);
      const geography = incomingSolarGeography === 'city' ? importedCityLabel : `${handoff.get('state') || 'Selected'} state-wide`;
      solarPriceBasis = `Berkeley Lab Tracking the Sun 2026 historical ${incomingSolarGeography}-level median for ${geography}; ${incomingSolarSampleN.toLocaleString('en-US')} records, installation years ${incomingSolarYearMin}–${incomingSolarYearMax}, nominal pre-incentive USD/W DC.`;
      solarReferenceStatus.hidden = false;
      solarReferenceStatus.textContent = `${solarPriceBasis} Published p25–p75: $${incomingSolarP25.toFixed(2)}–$${incomingSolarP75.toFixed(2)}/W DC. Historical distribution, not a current contractor quote. The median input is editable; compare the dataset scope with your written proposal.`;
      addFieldNote(solarRateInput, 'solarCityPricePrefillNote', solarPriceBasis, 'https://emp.lbl.gov/tracking-the-sun');
      refreshField(solarRateInput);
    }

    roofLowInput.addEventListener('input', () => {
      if (roofRateBasis.startsWith('Angi')) {
        roofRateBasis = 'User-edited roof rates after loading a national Angi reference; no longer the unchanged publisher range.';
        roofReferenceStatus.textContent = roofRateBasis;
      }
    });
    roofHighInput.addEventListener('input', () => {
      if (roofRateBasis.startsWith('Angi')) {
        roofRateBasis = 'User-edited roof rates after loading a national Angi reference; no longer the unchanged publisher range.';
        roofReferenceStatus.textContent = roofRateBasis;
      }
    });
    solarRateInput.addEventListener('input', () => {
      if (solarPriceBasis.startsWith('EnergySage') || solarPriceBasis.startsWith('Berkeley Lab')) {
        solarPriceBasis = 'User-edited solar price after loading a published benchmark; no longer the unchanged source statistic.';
        solarReferenceStatus.textContent = solarPriceBasis;
      }
    });
    importRateInput.addEventListener('input', () => {
      if (importRateBasis.startsWith('EIA')) {
        importRateBasis = 'User-edited import rate after loading the EIA state-average scenario; verify against the actual tariff.';
        const note = document.getElementById('importRatePrefillNote');
        if (note) note.textContent = importRateBasis;
      }
    });

    function calculate() {
      const material = document.getElementById('roofType').value;
      const ageText = document.getElementById('roofAge').value.trim();
      const age = ageText === '' ? null : Number(ageText);
      const condition = document.getElementById('condition').value;
      const pitch = document.getElementById('pitch').value;
      const mode = document.querySelector('input[name="areaMode"]:checked').value;
      const rawArea = Number(document.getElementById(mode === 'roof' ? 'roofArea' : 'homeArea').value);
      const stories = mode === 'home' ? Number(document.getElementById('stories').value) : 1;
      const roofArea = mode === 'roof' ? rawArea : (rawArea / stories) * CONFIG.pitchFactors[pitch];
      const lowRateText = document.getElementById('roofRateLow').value.trim();
      const highRateText = document.getElementById('roofRateHigh').value.trim();
      const roofRateLow = lowRateText === '' ? null : Number(lowRateText);
      const roofRateHigh = highRateText === '' ? null : Number(highRateText);
      let status, statusDesc;
      if (condition === 'poor') { status = 'Prompt inspection'; statusDesc = 'You reported leaks or visible damage. Arrange a qualified inspection promptly; this does not by itself prove full replacement is required.'; }
      else if (condition === 'unknown') { status = 'Assessment needed'; statusDesc = 'Condition is unknown. Age alone cannot establish remaining service life or replacement urgency.'; }
      else if (condition === 'fair') { status = 'Monitor and assess'; statusDesc = 'You reported aging or minor wear. Document the condition and arrange an assessment, especially before a solar installation.'; }
      else { status = 'No issue reported'; statusDesc = 'You reported no known issues. This is not a condition certification; hidden defects and structural issues cannot be screened online.'; }
      const roofLow = roofRateLow === null ? null : roofArea * roofRateLow;
      const roofHigh = roofRateHigh === null ? null : roofArea * roofRateHigh;
      const annualText = document.getElementById('annualKwh').value.trim();
      const annualInput = annualText === '' ? null : Number(annualText);
      const rateEntered = document.getElementById('rate').value.trim() !== '';
      const rate = rateEntered ? Number(document.getElementById('rate').value) : null;
      const annualKwh = annualInput;
      const offset = Number(document.getElementById('offset').value) / 100;
      const productionPerKW = Number(document.getElementById('productionPerKw').value);
      const targetKwh = annualKwh * offset;
      const targetKW = targetKwh / productionPerKW;
      // Size to the visitor's annual-energy offset target only. Roof area alone cannot
      // establish an installable array without plane dimensions, obstructions, setbacks,
      // shading, orientation, fire-access rules and structural review.
      const systemKW = targetKW;
      const production = systemKW * productionPerKW;
      const selfUseText = document.getElementById('selfUse').value.trim();
      const selfUseShare = selfUseText === '' ? null : Number(selfUseText) / 100;
      const selfConsumedKwh = selfUseShare === null ? null : Math.min(production * selfUseShare, annualKwh);
      const exportedKwh = selfConsumedKwh === null ? null : Math.max(0, production - selfConsumedKwh);
      const exportText = document.getElementById('exportRate').value.trim();
      const exportRate = exportText === '' ? null : Number(exportText);
      const selfSavings = selfConsumedKwh === null ? null : (selfConsumedKwh < 0.01 ? 0 : (rate === null ? null : selfConsumedKwh * rate));
      const exportNotRequired = exportedKwh !== null && exportedKwh < 0.01;
      const exportSavings = exportedKwh === null || (exportRate === null && !exportNotRequired) ? null : exportedKwh * (exportRate ?? 0);
      const annualSavings = selfSavings === null || exportSavings === null ? null : selfSavings + exportSavings;
      const monthlySavings = annualSavings === null ? null : annualSavings / 12;
      const solarPriceText = document.getElementById('solarPricePerWatt').value.trim();
      const solarPricePerWatt = solarPriceText === '' ? null : Number(solarPriceText);
      const solarCost = solarPricePerWatt === null ? null : systemKW * 1000 * solarPricePerWatt;
      const payback = solarCost !== null && annualSavings !== null && annualSavings > 0 ? solarCost / annualSavings : null;
      const finance = document.querySelector('input[name="financing"]:checked').value;
      let payment = null, loanDesc = 'No installed price entered; financing is not calculated.', loanTerms = 'Not entered';
      if (finance === 'loan' && solarCost !== null) {
        const apr = Number(document.getElementById('apr').value), term = Number(document.getElementById('term').value);
        payment = loanPayment(solarCost, apr, term);
        loanDesc = 'Illustrative principal-and-interest payment only. Excludes fees, dealer charges, taxes and lender-specific terms; no offer or approval is implied.';
        loanTerms = `${apr.toFixed(1)}% / ${term} yrs`;
      } else if (finance === 'cash') {
        loanDesc = 'Cash selected. No financing approval or offer is implied.';
      }
      document.getElementById('roofStatus').textContent = status;
      document.getElementById('roofStatusDesc').textContent = statusDesc;
      document.getElementById('roofAgeResult').textContent = age === null ? 'Not entered' : `${age} years`;
      document.getElementById('roofAreaResult').textContent = `${number(roofArea)} sq ft`;
      document.getElementById('roofCost').textContent = roofLow === null ? 'Not estimated' : `${money(roofLow)}–${money(roofHigh)}`;
      document.getElementById('roofRate').textContent = roofRateLow === null ? 'Enter local rates' : `${money(roofRateLow,2)}–${money(roofRateHigh,2)} / sq ft`;
      document.getElementById('systemSize').textContent = `${systemKW.toFixed(1)} kW`;
      document.getElementById('systemDesc').textContent = 'Sized to the annual-energy offset target and visitor-entered production assumption. Roof fit is not assessed.';
      document.getElementById('production').textContent = `${number(production)} kWh / yr`;
      document.getElementById('roofCapacity').textContent = 'Layout required';
      document.getElementById('annualSavings').textContent = annualSavings === null ? 'Inputs needed' : `${money(annualSavings)} / yr`;
      document.getElementById('monthlySavings').textContent = monthlySavings === null ? '—' : money(monthlySavings);
      document.getElementById('savingsDesc').textContent = annualSavings === null ? 'Enter an annual direct-use share and the tariff inputs needed for the modeled energy flows. Unknown tariff inputs are not treated as zero.' : selfConsumedKwh < 0.01 ? `${number(exportedKwh)} kWh exported × ${money(exportRate,3)}/kWh. No import-rate input is needed because modeled direct use is zero.` : `${number(selfConsumedKwh)} kWh self-used × ${money(rate,3)}/kWh + ${number(exportedKwh)} kWh exported × ${money(exportRate ?? 0,3)}/kWh${exportRate === null ? ' (no export credit needed because modeled exports are zero)' : ''}.`;
      document.getElementById('payback').textContent = payback === null ? 'Not modeled' : payback > 50 ? '>50 years' : `${payback.toFixed(1)} years`;
      document.getElementById('solarCost').textContent = solarCost === null ? 'Enter installed price' : money(solarCost);
      document.getElementById('loanPayment').textContent = payment === null ? 'Not calculated' : `${money(payment)} / mo`;
      document.getElementById('loanDesc').textContent = loanDesc;
      document.getElementById('loanTerms').textContent = loanTerms;
      document.getElementById('resultsLocation').textContent = importedCityLabel ? `City-model context: ${importedCityLabel}. Solar yield is from a representative Census place point. The EIA state average is not used as your tariff unless you explicitly apply it as an illustrative scenario.` : 'Based on visitor-entered assumptions. No address or ZIP lookup is performed.';
      const assumptions = [
        `Roof material: ${document.getElementById('roofType').selectedOptions[0].text}. Roof age: ${age === null ? 'not entered' : `${age} years`} (descriptive input only; age does not diagnose condition or determine replacement urgency). Roof area: ${number(roofArea)} sq ft. ${mode === 'roof' ? 'You supplied a roof-surface area; pitch is not applied again.' : `Approximate building footprint = above-ground finished floor area ÷ ${stories} stories; surface multiplier for the selected ${pitch} pitch is ${CONFIG.pitchFactors[pitch].toFixed(3)}. This simplified method does not model overhangs or complex roof geometry.`}`,
        roofRateLow === null ? 'Roof replacement cost is not estimated because no local low/high installed rates were entered. The calculator does not invent city prices.' : `Roof material: ${document.getElementById('roofType').selectedOptions[0].text}. Roof cost = ${number(roofArea)} sq ft × ${money(roofRateLow,2)}–${money(roofRateHigh,2)} per roof sq ft. Rate basis: ${roofRateBasis} Confirm both rates match this material, measurement basis and project scope.`,
        'Roof-space fit is not calculated. Roof surface area does not establish how many modules fit; a site-specific layout must account for roof-plane dimensions, setbacks, fire access, obstructions, shading, orientation and structural condition.',
        `Annual electricity usage: ${number(annualKwh)} kWh/year entered by you from utility-bill consumption data.`,
        rate === null ? 'Import rate: not entered. It is required to value self-consumed kWh, but not when the entered direct-use share is zero.' : `Import rate: ${money(rate,3)}/kWh. Basis: ${importRateBasis} Use the marginal energy rate, not necessarily the all-in average bill amount.`,
        `Production assumption: ${number(productionPerKW)} kWh per kW DC per year. Basis: ${importedCityLabel ? 'city-based NLR PVWatts V8 estimate using a representative Census place point; verify roof-plane and shading differences' : 'visitor-entered or modelled elsewhere; no automatic property-specific estimate'}. The value is editable.`,
        selfUseShare === null ? 'Energy flow: not split between self-use and exports because no annual direct-use share was entered. No direct-use or export dollar value is calculated.' : selfConsumedKwh < 0.01 ? `Energy flow: 0 kWh self-consumed and ${number(exportedKwh)} kWh exported. Export-only value can be calculated with the visitor-entered export credit; no import-rate input is needed.` : rate === null ? `Energy flow: ${number(selfConsumedKwh)} kWh self-consumed and ${number(exportedKwh)} kWh exported using your ${Math.round(selfUseShare*100)}% scenario input. Dollar value still requires a marginal import rate${exportedKwh >= 0.01 ? ' and an export credit' : ''}.` : exportRate === null && exportedKwh >= 0.01 ? `Energy flow: ${number(selfConsumedKwh)} kWh self-consumed and ${number(exportedKwh)} kWh exported. Self-use value is ${money(selfConsumedKwh * rate)}; total annual energy value and payback are withheld because the export credit is unknown.` : `Savings model: ${number(selfConsumedKwh)} kWh self-consumed at the visitor-entered import rate plus ${number(exportedKwh)} kWh exported at ${money(exportRate ?? 0,3)}/kWh. Self-consumption share = ${Math.round(selfUseShare*100)}%; this is an annual scenario share, not an hourly load simulation.`,
        solarPricePerWatt === null ? 'Solar installed cost, payback and loan payment are not calculated because no installed price per DC watt was entered.' : `Installed price: ${money(solarPricePerWatt,2)}/W; total modeled cash price ${money(solarCost)}. Price basis: ${solarPriceBasis} Simple payback divides this amount by first-year modeled annual energy value.`,
        'The model excludes fixed utility charges, time-of-use billing, batteries, degradation, maintenance, inverter replacement, insurance, taxes, incentives, financing fees and future rate changes. It does not determine tax eligibility or include a tax-credit amount; verify current federal, state and utility programs independently.'
      ];
      document.getElementById('assumptionList').innerHTML = assumptions.map(x => `<li>${x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</li>`).join('');
      const warnings = [];
      if (condition === 'poor') warnings.push('Reported poor condition: have the roof inspected before solar design or installation.');
      if (condition === 'unknown') warnings.push('Roof condition is unknown; do not interpret the age or this screen as a replacement decision.');
      warnings.push('Roof-space fit is not assessed. The energy-target system size may not fit the usable roof area after setbacks, obstructions, fire access, shading and structural review.');
      if (!rateEntered && selfConsumedKwh !== null && selfConsumedKwh >= 0.01) warnings.push('No import rate was entered. The value of self-consumed electricity and total payback cannot be calculated.');
      if (selfUseText === '') warnings.push('No annual self-consumption share was entered. Energy flows, dollar value and payback are not calculated.');
      if (exportText === '' && exportedKwh !== null && exportedKwh >= 0.01) warnings.push('No export credit was entered. Export value, total annual energy value and payback are not calculated; exported electricity is not assumed to be worth $0.');
      if (solarPricePerWatt === null) warnings.push('No installed solar price was entered; cost and payback are not calculated.');
      warnings.push('The target annual generation percentage is visitor-entered; it is not a recommendation or a promise of the same reduction in the total utility bill. No self-consumption or export-credit defaults are supplied. Local incentives, utility tariff rules, shading, orientation, structural condition, professional measurements and local prices can change results.');
      document.getElementById('resultWarning').textContent = warnings.join(' ');
      document.getElementById('results').classList.add('show');
      setStep(3);
      document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});
    }
    document.getElementById('calculateButton').addEventListener('click', () => {
      const firstOk = validateStep1();
      if (!firstOk) { setStep(1); return; }
      if (!validateStep2()) return;
      calculate();
    });
        document.getElementById('editInputs').addEventListener('click', () => { document.getElementById('results').classList.remove('show'); setStep(1); });


    // Preserve only calculator inputs in this tab while the visitor uses the city PV model.
    // No address, name, contact detail or account data is stored.
    const combinedFormStateKey = 'roof-solar-toolkit:combined-form:v1';
    function saveCombinedFormState() {
      const values = {};
      document.querySelectorAll('#calculatorForm input, #calculatorForm select, #calculatorForm textarea').forEach((field) => {
        if (field.type === 'radio') {
          if (field.checked) values[`radio:${field.name}`] = field.value;
        } else if (field.type === 'checkbox') {
          values[`checkbox:${field.id}`] = field.checked;
        } else if (field.id) {
          values[field.id] = field.value;
        }
      });
      const state = {
        savedAt: Date.now(),
        values,
        meta: {
          roofRateBasis, solarPriceBasis, importRateBasis, importedCityLabel,
          roofReferenceStatus: roofReferenceStatus.textContent,
          roofReferenceStatusHidden: roofReferenceStatus.hidden,
          solarReferenceStatus: solarReferenceStatus.textContent,
          solarReferenceStatusHidden: solarReferenceStatus.hidden
        }
      };
      try { sessionStorage.setItem(combinedFormStateKey, JSON.stringify(state)); } catch (_) {}
    }
    function restoreCombinedFormState() {
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(combinedFormStateKey) || 'null'); } catch (_) {}
      if (!saved || !saved.values || Date.now() - Number(saved.savedAt || 0) > 60 * 60 * 1000) {
        try { sessionStorage.removeItem(combinedFormStateKey); } catch (_) {}
        return false;
      }
      document.querySelectorAll('#calculatorForm input, #calculatorForm select, #calculatorForm textarea').forEach((field) => {
        if (field.type === 'radio') {
          const value = saved.values[`radio:${field.name}`];
          if (value !== undefined) field.checked = field.value === value;
        } else if (field.type === 'checkbox') {
          const value = saved.values[`checkbox:${field.id}`];
          if (value !== undefined) field.checked = Boolean(value);
        } else if (field.id && Object.prototype.hasOwnProperty.call(saved.values, field.id)) {
          field.value = saved.values[field.id];
        }
      });
      syncAreaMode();
      syncFinancingFields();
      const meta = saved.meta || {};
      if (typeof meta.roofRateBasis === 'string') roofRateBasis = meta.roofRateBasis;
      if (typeof meta.solarPriceBasis === 'string') solarPriceBasis = meta.solarPriceBasis;
      if (typeof meta.importRateBasis === 'string') importRateBasis = meta.importRateBasis;
      if (typeof meta.importedCityLabel === 'string') importedCityLabel = meta.importedCityLabel;
      if (typeof meta.roofReferenceStatus === 'string') {
        roofReferenceStatus.textContent = meta.roofReferenceStatus;
        roofReferenceStatus.hidden = Boolean(meta.roofReferenceStatusHidden);
      }
      if (typeof meta.solarReferenceStatus === 'string') {
        solarReferenceStatus.textContent = meta.solarReferenceStatus;
        solarReferenceStatus.hidden = Boolean(meta.solarReferenceStatusHidden);
      }
      try { sessionStorage.removeItem(combinedFormStateKey); } catch (_) {}
      const restoredNote = document.getElementById('combinedRestoreStatus');
      if (restoredNote) {
        restoredNote.textContent = 'Your previous answers were restored. City-based solar production has been added.';
        restoredNote.hidden = false;
      }
      setStep(2);
      return true;
    }
    const cityLookupLink = document.querySelector('.city-data-bridge a[href*="return=combined"]');
    if (cityLookupLink) cityLookupLink.addEventListener('click', saveCombinedFormState);
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        try { sessionStorage.removeItem(combinedFormStateKey); } catch (_) {}
      }
    });
    restoreCombinedFormState();

