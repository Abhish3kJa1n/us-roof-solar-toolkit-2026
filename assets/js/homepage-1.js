// Explicit scenario assumptions only. Nothing here is a live local lookup or market benchmark.
    const CONFIG = {
      pitchFactors: { low: 1.014, moderateLow: 1.054, moderate: 1.118, steep: 1.250, verySteep: 1.414 } // 2:12, 4:12, 6:12, 9:12, 12:12 geometric slope multipliers
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
    let solarPriceBasis = 'No solar price entered; payback is not estimated.';
    let importRateBasis = 'No marginal tariff entered; dollar value is not estimated.';
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
      note.textContent = `EIA state-average residential electricity price for ${stateLabel}: ${incomingStateRate.toFixed(4)} $/kWh. Statewide average; not applied. Use your utility's marginal rate for a household estimate.`;
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
        appliedNote.textContent = `Applied ${incomingStateRate.toFixed(4)} $/kWh EIA state average for ${stateLabel}. Use your utility's marginal rate for a household estimate.`;
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
      roofRateBasis = 'Angi broad U.S. roof-replacement reference, updated October 22, 2026.';
      roofReferenceStatus.hidden = false;
      roofReferenceStatus.textContent = `${roofRateBasis} Broad U.S. price reference. Replace both editable rates with comparable local proposals.`;
      refreshField(roofLowInput); refreshField(roofHighInput);
    }
    function loadNationalSolarReference() {
      solarRateInput.value = '2.62';
      solarPriceBasis = 'EnergySage H1 2026 national solar-only marketplace median.';
      solarReferenceStatus.hidden = false;
      solarReferenceStatus.textContent = `${solarPriceBasis} National marketplace benchmark loaded. Replace it with a comparable written cash proposal.`;
      refreshField(solarRateInput);
    }
    document.getElementById('loadNationalRoofReference').addEventListener('click', loadNationalRoofReference);
    document.getElementById('loadNationalSolarReference').addEventListener('click', loadNationalSolarReference);
    // A national source is an explicit fallback where city-level installed-price records
    // have not passed publication gates. City-specific approved records can override it
    // through the location-data handoff; neither fallback is presented as a local quote.
    // The national solar-price reference is opt-in. It is never prefilled on page load.

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
      solarReferenceStatus.textContent = `${solarPriceBasis} Published p25–p75: $${incomingSolarP25.toFixed(2)}–$${incomingSolarP75.toFixed(2)}/W DC. Historical installation data. The median input is editable; compare its scope with a current proposal.`;
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
      if (solarRateInput.value.trim() === '') {
        solarPriceBasis = 'No solar price entered; payback is not estimated.';
        solarReferenceStatus.hidden = true;
      } else if (solarPriceBasis.startsWith('EnergySage') || solarPriceBasis.startsWith('Berkeley Lab')) {
        solarPriceBasis = 'User-edited solar price after loading a published benchmark; no longer the unchanged source statistic.';
        solarReferenceStatus.textContent = solarPriceBasis;
      } else if (!solarPriceBasis.startsWith('User-entered')) {
        solarPriceBasis = 'User-entered cash-price quote supplied by visitor.';
      }
    });
    importRateInput.addEventListener('input', () => {
      const note = document.getElementById('importRatePrefillNote');
      if (importRateInput.value.trim() === '') {
        importRateBasis = 'No marginal tariff entered; dollar value is not estimated.';
        if (note) { note.textContent = importRateBasis; note.hidden = true; }
      } else if (importRateBasis.startsWith('EIA')) {
        importRateBasis = 'User-edited import rate after loading the EIA state-average scenario; verify against the actual tariff.';
        if (note) note.textContent = importRateBasis;
      } else if (!importRateBasis.startsWith('User-entered')) {
        importRateBasis = 'User-entered marginal tariff rate supplied by visitor.';
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
      if (condition === 'poor') { status = 'Inspection recommended'; statusDesc = 'You reported leaks or visible damage. An inspection can clarify repair and replacement options.'; }
      else if (condition === 'unknown') { status = 'Needs assessment'; statusDesc = 'Roof condition was not provided. Check it before planning a major project.'; }
      else if (condition === 'fair') { status = 'Monitor'; statusDesc = 'You reported aging or minor wear. Recheck the condition before a major roof or solar project.'; }
      else { status = 'No issue reported'; statusDesc = 'Based on the condition you selected.'; }
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
      let payment = null, loanDesc = 'Enter an installed price to estimate a payment.', loanTerms = 'Not entered';
      if (finance === 'loan' && solarCost !== null) {
        const apr = Number(document.getElementById('apr').value), term = Number(document.getElementById('term').value);
        payment = loanPayment(solarCost, apr, term);
        loanDesc = 'Estimated principal and interest using your APR and term; lender fees are not included.';
        loanTerms = `${apr.toFixed(1)}% / ${term} yrs`;
      } else if (finance === 'cash') {
        loanDesc = 'Cash selected.';
      }
      document.getElementById('roofStatus').textContent = status;
      document.getElementById('roofStatusDesc').textContent = statusDesc;
      document.getElementById('roofAgeResult').textContent = age === null ? 'Not entered' : `${age} years`;
      document.getElementById('roofAreaResult').textContent = `${number(roofArea)} sq ft`;
      document.getElementById('roofCost').textContent = roofLow === null ? 'Not estimated' : `${money(roofLow)}–${money(roofHigh)}`;
      document.getElementById('roofRate').textContent = roofRateLow === null ? 'Enter local rates' : `${money(roofRateLow,2)}–${money(roofRateHigh,2)} / sq ft`;
      document.getElementById('systemSize').textContent = `${systemKW.toFixed(1)} kW`;
      document.getElementById('systemDesc').textContent = 'Based on annual electricity use, target generation and modeled production.';
      document.getElementById('production').textContent = `${number(production)} kWh / yr`;
      document.getElementById('roofCapacity').textContent = 'Energy target';
      document.getElementById('annualSavings').textContent = annualSavings === null ? 'Inputs needed' : `${money(annualSavings)} / yr`;
      document.getElementById('monthlySavings').textContent = monthlySavings === null ? '—' : money(monthlySavings);
      document.getElementById('savingsDesc').textContent = annualSavings === null
        ? (selfUseShare === null
          ? 'Add a direct-use share and utility rates to calculate annual value.'
          : selfConsumedKwh >= 0.01 && rate === null
            ? 'Add your marginal import rate to value electricity used at home.'
            : exportedKwh >= 0.01 && exportRate === null
              ? 'Add your utility export credit to value surplus generation.'
              : 'Add the rate inputs needed for this scenario.')
        : [
            selfConsumedKwh >= 0.01 ? `${number(selfConsumedKwh)} kWh used at home × ${money(rate,3)}/kWh` : '',
            exportedKwh >= 0.01 ? `${number(exportedKwh)} kWh exported × ${money(exportRate,3)}/kWh` : ''
          ].filter(Boolean).join(' · ');
      document.getElementById('payback').textContent = payback === null ? 'Not modeled' : payback > 50 ? '>50 years' : `${payback.toFixed(1)} years`;
      document.getElementById('solarCost').textContent = solarCost === null ? 'Enter installed price' : money(solarCost);
      document.getElementById('loanPayment').textContent = payment === null ? 'Not calculated' : `${money(payment)} / mo`;
      document.getElementById('loanDesc').textContent = loanDesc;
      document.getElementById('loanTerms').textContent = loanTerms;
      document.getElementById('resultsLocation').textContent = importedCityLabel ? `PVWatts production uses the selected city point: ${importedCityLabel}.` : 'Production uses your entered assumption.';
      const assumptions = [
        `Roof: ${document.getElementById('roofType').selectedOptions[0].text}; age ${age === null ? 'not entered' : `${age} years`}; area ${number(roofArea)} sq ft. ${mode === 'roof' ? 'Measured roof area was used as entered.' : `Estimated footprint = finished floor area ÷ ${stories} stories; pitch multiplier = ${CONFIG.pitchFactors[pitch].toFixed(3)}.`}`,
        roofRateLow === null ? 'Roof cost is not calculated until low and high installed rates are entered.' : `Roof cost = ${number(roofArea)} sq ft × ${money(roofRateLow,2)}–${money(roofRateHigh,2)} per sq ft. Rate basis: ${roofRateBasis}`,
        'Solar system size uses the annual generation target and modeled production. Roof layout, setbacks and structural fit are part of installation design.',
        `Annual electricity use: ${number(annualKwh)} kWh/year.`,
        rate === null ? 'Import rate: not entered.' : `Import rate: ${money(rate,3)}/kWh. Basis: ${importRateBasis}`,
        `Production assumption: ${number(productionPerKW)} kWh per kW DC per year. Basis: ${importedCityLabel ? 'NLR PVWatts V8 using a representative Census city point' : 'visitor-entered or sourced separately'}.`,
        selfUseShare === null ? 'Direct-use share: not entered.' : `Annual energy flow: ${number(selfConsumedKwh)} kWh used at home and ${number(exportedKwh)} kWh exported, using a ${Math.round(selfUseShare*100)}% direct-use scenario.`,
        solarPricePerWatt === null ? 'Payback and loan payment need an installed price per DC watt.' : `Installed price: ${money(solarPricePerWatt,2)}/W; modeled cash price ${money(solarCost)}. Simple payback divides this price by first-year modeled annual energy value.`,
        'Annual scenario excludes fixed utility charges, time-of-use billing, batteries, maintenance, financing fees, incentives and future rate changes.'
      ];
      document.getElementById('assumptionList').innerHTML = assumptions.map(x => `<li>${x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</li>`).join('');
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
        } else if (field.id && field.id !== 'productionPerKw') {
          // The fresh city PV handoff must win over any older manually entered production value.
          values[field.id] = field.value;
        }
      });
      const state = {
        savedAt: Date.now(),
        values,
        openDetails: Array.from(document.querySelectorAll('#calculatorForm details[open]')).map((detail) => detail.id),
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
      const meta = saved.meta || {};
      const incomingSolarPrice = Number(new URLSearchParams(window.location.search).get('solarPricePerWatt'));
      const savedSolarBasis = typeof meta.solarPriceBasis === 'string' ? meta.solarPriceBasis : '';
      const preferIncomingSolarPrice = incomingSolarPrice > 0 && !/user-entered|user-edited/i.test(savedSolarBasis);
      document.querySelectorAll('#calculatorForm input, #calculatorForm select, #calculatorForm textarea').forEach((field) => {
        if (field.type === 'radio') {
          const value = saved.values[`radio:${field.name}`];
          if (value !== undefined) field.checked = field.value === value;
        } else if (field.type === 'checkbox') {
          const value = saved.values[`checkbox:${field.id}`];
          if (value !== undefined) field.checked = Boolean(value);
        } else if (field.id === 'solarPricePerWatt' && preferIncomingSolarPrice) {
          // Keep the approved city price already applied from the URL.
        } else if (field.id && Object.prototype.hasOwnProperty.call(saved.values, field.id)) {
          field.value = saved.values[field.id];
        }
      });
      syncAreaMode();
      syncFinancingFields();
      const openDetails = Array.isArray(saved.openDetails) ? saved.openDetails : [];
      document.querySelectorAll('#calculatorForm details').forEach((detail) => {
        detail.open = openDetails.includes(detail.id);
      });
      if (preferIncomingSolarPrice) {
        const solarDetails = document.getElementById('solarCostAssumptions');
        if (solarDetails) solarDetails.open = true;
      }
      if (typeof meta.roofRateBasis === 'string') roofRateBasis = meta.roofRateBasis;
      if (typeof meta.solarPriceBasis === 'string' && !preferIncomingSolarPrice) solarPriceBasis = meta.solarPriceBasis;
      if (typeof meta.importRateBasis === 'string') importRateBasis = meta.importRateBasis;
      if (typeof meta.importedCityLabel === 'string') importedCityLabel = meta.importedCityLabel;
      if (typeof meta.roofReferenceStatus === 'string') {
        roofReferenceStatus.textContent = meta.roofReferenceStatus;
        roofReferenceStatus.hidden = Boolean(meta.roofReferenceStatusHidden);
      }
      if (typeof meta.solarReferenceStatus === 'string' && !preferIncomingSolarPrice) {
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
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
          try { sessionStorage.removeItem(combinedFormStateKey); } catch (_) {}
        }
      });
    }
    restoreCombinedFormState();

    // An explicitly requested, illustrative scenario gives first-time visitors a
    // complete calculation without making any household-specific value a default.
    const quickExampleButton = document.getElementById('loadTypicalExample');
    const resetCalculatorButton = document.getElementById('resetCalculator');

    function clearLocationHandoff() {
      try { sessionStorage.removeItem(combinedFormStateKey); } catch (_) {}
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, document.title, window.location.pathname);
      }
      importedCityLabel = '';
      ['productionCityPrefillNote', 'importRatePrefillNote', 'eiaScenarioApplied', 'useEiaStateAverage'].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.remove();
      });
    }

    function clearReferenceNotes() {
      roofRateBasis = 'No roof-price reference loaded; roof cost is not estimated.';
      solarPriceBasis = 'No solar price entered; payback is not estimated.';
      importRateBasis = 'No marginal tariff entered; dollar value is not estimated.';
      roofReferenceStatus.textContent = '';
      roofReferenceStatus.hidden = true;
      solarReferenceStatus.textContent = '';
      solarReferenceStatus.hidden = true;
    }

    function loadIllustrativeUsExample() {
      clearLocationHandoff();
      clearReferenceNotes();

      const values = {
        roofType: 'asphalt',
        roofAge: '',
        roofArea: '2000',
        homeArea: '',
        stories: '',
        pitch: '',
        roofRateLow: '4',
        roofRateHigh: '11',
        condition: 'unknown',
        annualKwh: '10500',
        rate: '0.1819',
        productionPerKw: '1350',
        offset: '80',
        selfUse: '40',
        exportRate: '0.08',
        solarPricePerWatt: '2.62',
        apr: '',
        term: ''
      };
      Object.entries(values).forEach(([id, value]) => {
        document.getElementById(id).value = value;
        refreshField(document.getElementById(id));
      });

      document.querySelectorAll('input[name="areaMode"]').forEach((field) => {
        field.checked = field.value === 'roof';
      });
      document.querySelectorAll('input[name="financing"]').forEach((field) => {
        field.checked = field.value === 'cash';
      });
      syncAreaMode();
      syncFinancingFields();

      roofRateBasis = 'Angi broad national roof-replacement reference range of $4–$11 per roof sq ft; national planning context, not a local quote or material-specific price.';
      solarPriceBasis = 'EnergySage H1 2026 national solar-only marketplace median of $2.62/W DC; not a local installer quote.';
      importRateBasis = 'EIA January–September 2026 U.S. average residential price of 18.19 cents/kWh, used as a comparison scenario.';
      roofReferenceStatus.hidden = false;
      roofReferenceStatus.textContent = roofRateBasis + ' National reference loaded. Replace it with comparable local proposals.';
      solarReferenceStatus.hidden = false;
      solarReferenceStatus.textContent = solarPriceBasis + ' National reference loaded. Replace it with a current written cash proposal.';
      addFieldNote(productionInput, 'productionExampleNote', 'Example yield: 1,350 kWh/kW/year. Use the city lookup for a location-based NLR PVWatts V8 estimate.', 'https://developer.nlr.gov/docs/solar/pvwatts/v8/');

      const roofDetails = document.getElementById('roofPriceAssumptions');
      const solarDetails = document.getElementById('solarCostAssumptions');
      if (roofDetails) roofDetails.open = true;
      if (solarDetails) solarDetails.open = true;
      clearError(1);
      clearError(2);
      document.getElementById('results').classList.remove('show');
      setStep(1);

      // Use the calculator's existing validation and calculation path.
      document.getElementById('calculateButton').click();
    }

    function resetCombinedCalculator() {
      clearLocationHandoff();
      clearReferenceNotes();
      const blankFields = [
        'roofAge', 'roofArea', 'homeArea', 'stories', 'pitch',
        'roofRateLow', 'roofRateHigh', 'annualKwh', 'rate', 'productionPerKw',
        'offset', 'selfUse', 'exportRate', 'solarPricePerWatt', 'apr', 'term'
      ];
      blankFields.forEach((id) => {
        document.getElementById(id).value = '';
        refreshField(document.getElementById(id));
      });
      document.getElementById('roofType').value = '';
      document.getElementById('condition').value = 'unknown';
      document.querySelectorAll('input[name="areaMode"]').forEach((field) => {
        field.checked = field.value === 'roof';
      });
      document.querySelectorAll('input[name="financing"]').forEach((field) => {
        field.checked = field.value === 'cash';
      });
      syncAreaMode();
      syncFinancingFields();
      ['productionExampleNote', 'productionCityPrefillNote'].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.remove();
      });
      const restoredNote = document.getElementById('combinedRestoreStatus');
      if (restoredNote) { restoredNote.textContent = ''; restoredNote.hidden = true; }
      const roofDetails = document.getElementById('roofPriceAssumptions');
      const solarDetails = document.getElementById('solarCostAssumptions');
      if (roofDetails) roofDetails.open = false;
      if (solarDetails) solarDetails.open = false;
      clearError(1);
      clearError(2);
      document.getElementById('results').classList.remove('show');
      document.getElementById('resultsLocation').textContent = 'Based on the details you entered.';
      setStep(1);
    }

    if (quickExampleButton) quickExampleButton.addEventListener('click', loadIllustrativeUsExample);
    if (resetCalculatorButton) resetCalculatorButton.addEventListener('click', resetCombinedCalculator);

