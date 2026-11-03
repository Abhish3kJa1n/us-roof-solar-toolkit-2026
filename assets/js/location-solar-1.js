(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cityEl = $('city');
  const stateEl = $('state');
  const stateDisplay = $('stateDisplay');
  const stateField = $('stateField');
  const stateHelp = $('stateHelp');
  const manualState = $('manualState');
  const manualStateFallback = $('manualStateFallback');
  const manualStateButton = $('useManualState');
  const suggestionsEl = $('citySuggestions');
  const placeEl = $('place');
  const placeField = $('placeField');
  const lookupBtn = $('lookup');
  const estimateBtn = $('estimate');
  const tariffBtn = $('tariffs');
  const resultEl = $('result');
  const locationStatus = $('locationStatus');
  const modelStatus = $('modelStatus');
  const tariffStatus = $('tariffStatus');
  const tariffResults = $('tariffResults');
  const savingsLink = $('savingsLink');
  const panelCountLink = $('panelCountLink');
  const combinedLink = $('combinedLink');
  const stateBenchmark = $('stateBenchmark');
  const assumptionInputs = ['capacity', 'tilt', 'azimuth', 'losses'].map($);

  let places = [];
  let currentPlace = null;
  let currentSolarPriceBenchmark = null;
  let solarPriceBenchmarkPromise = Promise.resolve(null);
  let resolveSolarPriceBenchmark = null;
  let requestSequence = 0;
  let locationSequence = 0;
  let tariffSequence = 0;
  let modelPending = false;
  let tariffPending = false;
  let benchmarkSequence = 0;
  let benchmarkCsvText = null;
  let benchmarkCsvPromise = null;
  let selectedCandidate = null;
  let suggestionSequence = 0;
  let suggestionTimer = null;
  let activeSuggestionIndex = -1;
  const suggestionCache = new Map();
  let currentSuggestions = [];

  // Number('') is zero. Treat blank fields as unknown, not as a valid zero.
  const number = (value) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const format = (value, digits = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const setStatus = (node, text) => { node.textContent = text || ''; };
  const resetResult = (title, text) => {
    resultEl.replaceChildren();
    resultEl.append(el('div', 'kicker', 'PV production estimate'), el('div', 'big', title), el('p', '', text));
  };
  const params = (data) => new URLSearchParams(Object.entries(data).map(([key, value]) => [key, String(value)]));

  function updateActions() {
    const hasPlace = Boolean(currentPlace);
    estimateBtn.disabled = !hasPlace || modelPending;
    tariffBtn.disabled = !hasPlace || tariffPending;
  }

  function invalidateModel(message = 'Run the model again to use the current location and assumptions.') {
    requestSequence += 1;
    modelPending = false;
    savingsLink.hidden = true;
    savingsLink.removeAttribute('href');
    savingsLink.textContent = 'Available after a production model';
    panelCountLink.hidden = true;
    panelCountLink.removeAttribute('href');
    combinedLink.hidden = true;
    combinedLink.removeAttribute('href');
    setStatus(modelStatus, '');
    resetResult('Model needs updating', message);
    updateActions();
  }

  function invalidateTariffs() {
    tariffSequence += 1;
    tariffPending = false;
    tariffResults.replaceChildren();
    setStatus(tariffStatus, '');
    updateActions();
  }

  function clearStateBenchmark() {
    benchmarkSequence += 1;
    stateBenchmark.hidden = true;
    stateBenchmark.replaceChildren();
  }

  function notifyInstalledPricePlace(place) {
    currentSolarPriceBenchmark = null;
    if (resolveSolarPriceBenchmark) resolveSolarPriceBenchmark(null);
    resolveSolarPriceBenchmark = null;
    if (place) {
      solarPriceBenchmarkPromise = new Promise((resolve) => { resolveSolarPriceBenchmark = resolve; });
    } else {
      solarPriceBenchmarkPromise = Promise.resolve(null);
    }
    if (typeof CustomEvent !== 'function') return;
    const detail = place ? { city: place.placeName, state: place.stateAbbreviation } : null;
    document.dispatchEvent(new CustomEvent('roofsolar:place-selected', { detail }));
  }

  async function waitForSolarPriceBenchmark(place) {
    if (currentSolarPriceBenchmark && currentSolarPriceBenchmark.city === place.placeName && currentSolarPriceBenchmark.state === place.stateAbbreviation) {
      return currentSolarPriceBenchmark;
    }
    // The public registry is a small same-origin JSON file. Wait briefly for its
    // approved-only event so a fast PVWatts response does not race the price lookup.
    // If that script/file is unavailable, fall back to the clearly-labelled national reference.
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
    const result = await Promise.race([solarPriceBenchmarkPromise, timeout]);
    return result && result.city === place.placeName && result.state === place.stateAbbreviation ? result : null;
  }

  // The companion benchmark script emits only rows that pass its publication gates.
  // Recheck geography, metric, sample and period before including the record in a handoff.
  document.addEventListener('roofsolar:solar-price-benchmark', (event) => {
    const benchmark = event.detail;
    if (!currentPlace || !benchmark || benchmark.city !== currentPlace.placeName || String(benchmark.state || '').toUpperCase() !== String(currentPlace.stateAbbreviation || '').toUpperCase()) return;
    const requiredN = benchmark.geographyLevel === 'city' ? 100 : benchmark.geographyLevel === 'state' ? 500 : Infinity;
    const values = [benchmark.p25, benchmark.median, benchmark.p75, benchmark.sampleN];
    const yearsValid = benchmark.installationYearMin >= 2024 && benchmark.installationYearMax <= 2025 && benchmark.installationYearMin <= benchmark.installationYearMax;
    currentSolarPriceBenchmark = benchmark.available === true && benchmark.metric === 'usd_per_w_dc' &&
      values.every(Number.isFinite) && benchmark.p25 > 0 && benchmark.p25 <= benchmark.median &&
      benchmark.median <= benchmark.p75 && benchmark.sampleN >= requiredN && yearsValid
      ? benchmark : null;
    if (resolveSolarPriceBenchmark) {
      resolveSolarPriceBenchmark(currentSolarPriceBenchmark);
      resolveSolarPriceBenchmark = null;
    }
  });

  async function loadStateBenchmark(stateAbbreviation) {
    const sequence = ++benchmarkSequence;
    stateBenchmark.hidden = true;
    stateBenchmark.replaceChildren();
    const target = String(stateAbbreviation || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(target)) return null;
    try {
      if (benchmarkCsvText === null) {
        if (!benchmarkCsvPromise) {
          benchmarkCsvPromise = fetch('../data/eia-residential-electricity-prices-2026-08-ytd.csv', { headers: { Accept: 'text/csv' } })
            .then(async (response) => {
              if (!response.ok) throw new Error('State electricity benchmark file unavailable.');
              return response.text();
            });
        }
        try {
          benchmarkCsvText = await benchmarkCsvPromise;
        } catch (error) {
          benchmarkCsvPromise = null;
          throw error;
        }
      }
      if (sequence !== benchmarkSequence) return null;
      const lines = benchmarkCsvText.trim().split(/\r?\n/);
      const headers = (lines.shift() || '').split(',');
      const idx = Object.fromEntries(headers.map((name, index) => [name, index]));
      const row = lines.map((line) => line.split(',')).find((cells) => cells[idx.code] === target);
      if (!row) throw new Error('No state benchmark was found for this place.');
      const current = Number(row[idx.jan_aug_2026_ytd_cents_per_kwh]);
      const prior = Number(row[idx.jan_aug_2025_ytd_cents_per_kwh]);
      const change = Number(row[idx.yoy_change_percent]);
      const release = row[idx.data_release_date] || 'Not stated';
      if (![current, prior, change].every(Number.isFinite)) throw new Error('The state benchmark contains invalid numeric values.');

      const heading = el('strong', '', `EIA residential electricity benchmark — ${target}`);
      const value = el('p', '', `${format(current, 2)}¢/kWh for January–August 2026, compared with ${format(prior, 2)}¢/kWh for the same months in 2025 (${change > 0 ? '+' : ''}${format(change, 2)}%).`);
      const preliminary = el('p', '', 'EIA labels the 2026 year-to-date values preliminary estimates based on a cutoff-model sample; the 2025 comparison values are final. Monthly estimates can be revised in later releases.');
      const caution = el('p', '', 'This is a state-wide average price across residential customers, not your utility’s marginal energy charge, your actual tariff, or an estimate of what each solar kWh saves. Do not use it as a substitute for your bill or export-credit rules.');
      const source = el('a', '', `Source: EIA Electric Power Monthly Table 5.6.B · data release ${release}`);
      source.href = 'https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_06_b';
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      stateBenchmark.append(heading, value, preliminary, caution, source);
      stateBenchmark.hidden = false;
      return current / 100;
    } catch (error) {
      if (sequence !== benchmarkSequence) return;
      stateBenchmark.append(el('span', '', 'State electricity benchmark could not be loaded. The solar production estimate remains available.'));
      stateBenchmark.hidden = false;
      return null;
    }
  }

  function invalidateLocationContext() {
    invalidateModel('The location or array assumptions changed. Run a new production model before using the savings calculator.');
    invalidateTariffs();
    clearStateBenchmark();
  }

  function hideCitySuggestions() {
    suggestionsEl.replaceChildren();
    suggestionsEl.hidden = true;
    cityEl.setAttribute('aria-expanded', 'false');
    cityEl.removeAttribute('aria-activedescendant');
    activeSuggestionIndex = -1;
    currentSuggestions = [];
  }

  function setActiveSuggestion(index) {
    const options = Array.from(suggestionsEl.children);
    if (!options.length) return;
    activeSuggestionIndex = Math.max(0, Math.min(index, options.length - 1));
    options.forEach((option, optionIndex) => option.setAttribute('aria-selected', String(optionIndex === activeSuggestionIndex)));
    cityEl.setAttribute('aria-activedescendant', options[activeSuggestionIndex].id);
  }

  function chooseCityCandidate(candidate) {
    if (!candidate) return;
    selectedCandidate = candidate;
    cityEl.value = candidate.placeName;
    stateEl.value = candidate.stateAbbreviation;
    stateDisplay.value = candidate.stateName + ' (' + candidate.stateAbbreviation + ')';
    stateField.hidden = false;
    stateHelp.textContent = 'The state was matched to an official Census place suggestion.';
    hideCitySuggestions();
    lookupBtn.disabled = false;
    setStatus(locationStatus, candidate.placeName + ', ' + candidate.stateAbbreviation + ' selected. Verify it with Census to load the representative location.');
  }

  function renderCitySuggestions(suggestions, partialWarning = '') {
    currentSuggestions = Array.isArray(suggestions) ? suggestions : [];
    suggestionsEl.replaceChildren();
    activeSuggestionIndex = -1;
    if (!currentSuggestions.length) {
      suggestionsEl.hidden = true;
      cityEl.setAttribute('aria-expanded', 'false');
      setStatus(locationStatus, 'No matching Census places were returned. Try a longer or different city spelling.');
      return;
    }
    currentSuggestions.forEach((candidate, index) => {
      const option = el('button', 'autocomplete-option');
      option.type = 'button';
      option.id = 'city-option-' + index;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.tabIndex = -1;
      option.append(
        el('span', 'autocomplete-name', candidate.placeName + ', ' + candidate.stateAbbreviation),
        el('span', 'autocomplete-detail', candidate.stateName + ' · ' + (Array.isArray(candidate.geographyTypes) ? candidate.geographyTypes.join(' / ') : candidate.geographyType))
      );
      option.addEventListener('click', () => chooseCityCandidate(candidate));
      option.addEventListener('mousemove', () => setActiveSuggestion(index));
      suggestionsEl.append(option);
    });
    suggestionsEl.hidden = false;
    cityEl.setAttribute('aria-expanded', 'true');
    setStatus(locationStatus, currentSuggestions.length + ' Census city/state matches. Select the correct location.' + (partialWarning ? ' ' + partialWarning : ''));
  }

  function scheduleCitySuggestions() {
    const search = cityEl.value.trim().replace(/\s+/g, ' ');
    if (search.length < 3 || search.length > 80) {
      hideCitySuggestions();
      setStatus(locationStatus, 'Type at least 3 letters of a city name to see matching cities and states.');
      return;
    }
    const sequence = ++suggestionSequence;
    if (suggestionTimer) clearTimeout(suggestionTimer);
    const cacheKey = search.toLocaleLowerCase('en-US');
    if (suggestionCache.has(cacheKey)) {
      const cached = suggestionCache.get(cacheKey);
      renderCitySuggestions(cached.suggestions, cached.partialSourceWarning || '');
      return;
    }
    setStatus(locationStatus, 'Searching US Census city records…');
    suggestionTimer = setTimeout(async () => {
      try {
        const query = params({ search });
        const response = await fetch('../api/location?' + query.toString(), { headers: { Accept: 'application/json' } });
        const data = await response.json();
        if (sequence !== suggestionSequence) return;
        if (!response.ok) throw new Error(data.error || 'City suggestions are unavailable.');
        const cached = { suggestions: Array.isArray(data.suggestions) ? data.suggestions : [], partialSourceWarning: data.partialSourceWarning || '' };
        if (suggestionCache.size >= 30) suggestionCache.delete(suggestionCache.keys().next().value);
        suggestionCache.set(cacheKey, cached);
        renderCitySuggestions(cached.suggestions, cached.partialSourceWarning);
      } catch (error) {
        if (sequence === suggestionSequence) {
          hideCitySuggestions();
          setStatus(locationStatus, error.message || 'City suggestions are unavailable. Try again.');
        }
      }
    }, 450);
  }

  // City input is the only editable location field. Suggestions come from the
  // nationwide Census place layers; state is assigned only after a user selects
  // one explicit city/state match.
  const invalidatePlaceSearch = () => {
    lookupBtn.disabled = true;
    suggestionSequence += 1;
    if (suggestionTimer) clearTimeout(suggestionTimer);
    selectedCandidate = null;
    stateEl.value = '';
    stateDisplay.value = '';
    stateField.hidden = true;
    stateHelp.textContent = 'Select a Census suggestion or use the manual state fallback.';
    manualState.value = '';
    manualStateFallback.open = false;
    locationSequence += 1;
    currentPlace = null;
    currentSolarPriceBenchmark = null;
    places = [];
    placeEl.replaceChildren(new Option('Choose a place', ''));
    placeField.hidden = true;
    hideCitySuggestions();
    notifyInstalledPricePlace(null);
    invalidateLocationContext();
    setStatus(locationStatus, 'Type at least 3 letters of a city name to see matching cities and states.');
  };
  cityEl.addEventListener('input', () => {
    invalidatePlaceSearch();
    scheduleCitySuggestions();
  });
  manualStateButton.addEventListener('click', () => {
    const city = cityEl.value.trim().replace(/\\s+/g, ' ');
    const state = manualState.value.toUpperCase();
    const option = manualState.options[manualState.selectedIndex];
    if (city.length < 2 || city.length > 80) {
      setStatus(locationStatus, 'Enter a city or locality name between 2 and 80 characters.');
      return;
    }
    if (!/^[A-Z]{2}$/.test(state) || !option || !option.textContent) {
      setStatus(locationStatus, 'Choose a state or territory first.');
      return;
    }
    selectedCandidate = { placeName: city, stateAbbreviation: state, stateName: option.textContent, manual: true };
    stateEl.value = state;
    stateDisplay.value = option.textContent + ' (' + state + ')';
    stateField.hidden = false;
    stateHelp.textContent = 'State selected manually. Exact US Census city/state verification is still required.';
    hideCitySuggestions();
    lookupBtn.disabled = false;
    setStatus(locationStatus, city + ', ' + state + ' entered manually. Verify it with Census before modeling solar production.');
  });

  cityEl.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && currentSuggestions.length) {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex + 1);
    } else if (event.key === 'ArrowUp' && currentSuggestions.length) {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex < 0 ? currentSuggestions.length - 1 : activeSuggestionIndex - 1);
    } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      chooseCityCandidate(currentSuggestions[activeSuggestionIndex]);
    } else if (event.key === 'Escape') {
      hideCitySuggestions();
    }
  });

  lookupBtn.addEventListener('click', async () => {
    const city = cityEl.value.trim().replace(/\s+/g, ' ');
    const state = stateEl.value.trim().toUpperCase();
    if (!selectedCandidate || city.toLocaleLowerCase('en-US') !== selectedCandidate.placeName.toLocaleLowerCase('en-US') || state !== selectedCandidate.stateAbbreviation) {
      setStatus(locationStatus, 'Select a city and state from the Census suggestions first.');
      return;
    }
    if (city.length < 2 || city.length > 80) {
      setStatus(locationStatus, 'Enter a city name between 2 and 80 characters.');
      return;
    }
    if (!/^[A-Z]{2}$/.test(state)) {
      setStatus(locationStatus, 'Select a valid Census city/state suggestion first.');
      return;
    }
    const lookupId = ++locationSequence;
    lookupBtn.disabled = true;
    setStatus(locationStatus, 'Searching Census place records…');
    currentPlace = null;
    currentSolarPriceBenchmark = null;
    places = [];
    placeEl.replaceChildren(new Option('Choose a place', ''));
    placeField.hidden = true;
    invalidateLocationContext();
    try {
      const query = params({ city, state });
      const response = await fetch(`../api/location?${query.toString()}`, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (lookupId !== locationSequence) return;
      if (!response.ok) throw new Error(data.error || 'Census place lookup failed.');
      places = Array.isArray(data.places) ? data.places : [];
      if (!places.length) throw new Error('The Census lookup did not return a place with usable coordinates.');
      places.forEach((place, index) => {
        const option = new Option(`${place.placeName}, ${place.stateAbbreviation} · ${place.geographyType}`, String(index));
        placeEl.add(option);
      });
      placeField.hidden = false;
      if (places.length === 1) {
        placeEl.value = '0';
        currentPlace = places[0];
        notifyInstalledPricePlace(currentPlace);
        loadStateBenchmark(currentPlace.stateAbbreviation);
      }
      const partial = data.partialSourceWarning ? ` ${data.partialSourceWarning}` : '';
      setStatus(locationStatus, `${places.length} Census place${places.length === 1 ? '' : 's'} found for ${data.city}, ${data.state}.${places.length > 1 ? ' Choose the relevant place.' : ' Representative coordinates loaded.'}${partial}`);
      resetResult('Location loaded', 'Enter the system size, tilt, azimuth and losses, then request a typical-year PVWatts model.');
    } catch (error) {
      if (lookupId === locationSequence) setStatus(locationStatus, error.message || 'Census place lookup failed.');
    } finally {
      if (lookupId === locationSequence) lookupBtn.disabled = false;
      updateActions();
    }
  });

  placeEl.addEventListener('change', () => {
    const index = placeEl.value === '' ? -1 : Number(placeEl.value);
    currentPlace = Number.isInteger(index) && index >= 0 && index < places.length ? places[index] : null;
    currentSolarPriceBenchmark = null;
    invalidateLocationContext();
    notifyInstalledPricePlace(currentPlace);
    if (currentPlace) loadStateBenchmark(currentPlace.stateAbbreviation);
    setStatus(locationStatus, currentPlace ? `${currentPlace.placeName}, ${currentPlace.stateAbbreviation} selected. Coordinates are representative, not property-specific.` : 'Choose a returned place.');
  });

  assumptionInputs.forEach((input) => input.addEventListener('input', () => {
    // An edited assumption makes an earlier model result and its hand-off stale.
    if (modelPending || !savingsLink.hidden || !panelCountLink.hidden || !combinedLink.hidden) {
      invalidateModel('One or more array assumptions changed. Run the model again before using either linked calculator.');
    }
  }));

  estimateBtn.addEventListener('click', async () => {
    if (!currentPlace || modelPending) return;
    const capacity = number($('capacity').value);
    const tilt = number($('tilt').value);
    const azimuth = number($('azimuth').value);
    const losses = number($('losses').value);
    const checks = [
      [capacity, 0.05, 100, 'System size is required and must be between 0.05 and 100 kW DC.'],
      [tilt, 0, 90, 'Tilt is required and must be between 0° and 90°.'],
      [azimuth, 0, 359.99, 'Azimuth is required and must be between 0° and 359.99°.'],
      [losses, 0, 99, 'System losses are required and must be between 0% and 99%.'],
    ];
    const invalid = checks.find(([value, min, max]) => value === null || value < min || value > max);
    if (invalid) { setStatus(modelStatus, invalid[3]); return; }

    const seq = ++requestSequence;
    const selectedPlace = { ...currentPlace };
    modelPending = true;
    savingsLink.hidden = true;
    savingsLink.removeAttribute('href');
    panelCountLink.hidden = true;
    panelCountLink.removeAttribute('href');
    combinedLink.hidden = true;
    combinedLink.removeAttribute('href');
    setStatus(modelStatus, 'Requesting NLR PVWatts V8 model…');
    resetResult('Calculating…', 'The representative location and explicit system assumptions are being sent to this site’s server endpoint.');
    updateActions();
    const query = params({ lat: selectedPlace.latitude, lon: selectedPlace.longitude, capacity, tilt, azimuth, losses });
    try {
      const response = await fetch(`../api/pvwatts?${query.toString()}`, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (seq !== requestSequence) return;
      if (!response.ok) throw new Error(data.error || 'PVWatts could not return a model.');
      renderModel(data);
      setStatus(modelStatus, `Model returned ${new Date(data.fetchedAt).toLocaleString('en-US')}.`);
      const kwhPerKw = data.outputs.annualKwhPerKwDc;
      const stateAverageRate = await loadStateBenchmark(selectedPlace.stateAbbreviation);
      if (seq !== requestSequence) return;
      const placeLabel = `${selectedPlace.placeName}, ${selectedPlace.stateAbbreviation}`;
      const priceBenchmark = await waitForSolarPriceBenchmark(selectedPlace);
      if (seq !== requestSequence) return;
      const savingsHandoff = { production: kwhPerKw.toFixed(1), location: placeLabel, city: selectedPlace.placeName, state: selectedPlace.stateAbbreviation };
      if (Number.isFinite(stateAverageRate) && stateAverageRate > 0 && stateAverageRate <= 5) savingsHandoff.stateAverageRate = stateAverageRate.toFixed(4);
      savingsLink.href = `solar-savings.html?${params(savingsHandoff).toString()}`;
      savingsLink.textContent = `Use ${format(kwhPerKw, 0)} kWh/kW in savings calculator`;
      savingsLink.hidden = false;
      panelCountLink.href = `solar-panel-count.html?${params({ production: kwhPerKw.toFixed(1), location: placeLabel }).toString()}`;
      panelCountLink.textContent = `Use ${format(kwhPerKw, 0)} kWh/kW in panel-count calculator`;
      panelCountLink.hidden = false;
      const combinedHandoff = { productionPerKw: kwhPerKw.toFixed(1), city: selectedPlace.placeName, state: selectedPlace.stateAbbreviation, cityModelSource: 'PVWatts V8', pvwattsFetchedAt: data.fetchedAt || '' };
      if (Number.isFinite(stateAverageRate) && stateAverageRate > 0 && stateAverageRate <= 5) { combinedHandoff.stateAverageRate = stateAverageRate.toFixed(4); combinedHandoff.stateAverageSource = 'EIA Electric Power Monthly Table 5.6.B'; combinedHandoff.stateAverageRelease = '2026-10-23'; }
      if (priceBenchmark && priceBenchmark.city === selectedPlace.placeName && priceBenchmark.state === selectedPlace.stateAbbreviation) {
        combinedHandoff.solarPricePerWatt = priceBenchmark.median.toFixed(2);
        combinedHandoff.solarPriceSource = 'Berkeley Lab Tracking the Sun 2026';
        combinedHandoff.solarPriceGeography = priceBenchmark.geographyLevel;
        combinedHandoff.solarPriceP25 = priceBenchmark.p25.toFixed(2);
        combinedHandoff.solarPriceP75 = priceBenchmark.p75.toFixed(2);
        combinedHandoff.solarPriceSampleN = String(priceBenchmark.sampleN);
        combinedHandoff.solarPriceYearMin = String(priceBenchmark.installationYearMin);
        combinedHandoff.solarPriceYearMax = String(priceBenchmark.installationYearMax);
      }
      combinedLink.href = `../index.html?${params(combinedHandoff).toString()}#calculator`;
      combinedLink.textContent = `Return to combined calculator with ${format(kwhPerKw, 0)} kWh/kW prefilled`;
      combinedLink.hidden = false;
    } catch (error) {
      if (seq === requestSequence) {
        resetResult('Model unavailable', error.message || 'PVWatts request failed.');
        setStatus(modelStatus, 'Check the error. The site owner may not yet have configured the server-side NLR key.');
      }
    } finally {
      if (seq === requestSequence) {
        modelPending = false;
        updateActions();
      }
    }
  });

  function renderModel(data) {
    resultEl.replaceChildren();
    const out = data.outputs;
    const title = el('div', 'big', `${format(out.annualAcKwh)} kWh/year`);
    resultEl.append(el('div', 'kicker', 'NLR PVWatts V8 · typical-year modeled AC output'), title);
    resultEl.append(el('p', '', `${format(out.annualKwhPerKwDc, 1)} kWh per kW DC · ${format(data.inputs.systemCapacityKwDc, 2)} kW DC system`));
    const tableWrap = el('div', 'table-scroll');
    const table = el('table');
    table.setAttribute('aria-label', 'Modeled monthly solar electricity production');
    const caption = el('caption', '', 'Modeled monthly AC electricity output');
    const head = el('thead');
    const headerRow = el('tr');
    ['Month', 'AC output (kWh)'].forEach((label) => headerRow.append(el('th', '', label)));
    head.append(headerRow);
    const body = el('tbody');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    out.monthlyAcKwh.forEach((amount, index) => {
      const row = el('tr');
      row.append(el('th', '', months[index]), el('td', '', format(amount)));
      body.append(row);
    });
    table.append(caption, head, body);
    tableWrap.append(table);
    resultEl.append(tableWrap);
    const meta = el('p', '', `Solar radiation: ${out.annualSolarRadiationKwhM2Day === null ? 'not returned' : `${format(out.annualSolarRadiationKwhM2Day, 2)} kWh/m²/day`} · Capacity factor: ${out.capacityFactorPercent === null ? 'not returned' : `${format(out.capacityFactorPercent, 1)}%`}`);
    resultEl.append(meta);
    const station = data.stationInfo || {};
    const stationText = [station.location, station.city, station.state].filter(Boolean).join(', ');
    const weatherText = station.weather_data_source ? ` Weather file: ${station.weather_data_source}.` : '';
    const distanceMeters = Number(station.distance);
    const distanceMiles = distanceMeters / 1609.344;
    const distanceText = Number.isFinite(distanceMiles) && distanceMiles >= 0 ? ` Distance to model climate station: ${format(distanceMiles, 1)} miles (NLR reports this distance in metres).` : '';
    resultEl.append(el('p', '', `Model source: ${data.source}. Climate dataset: ${data.climateDataset}.${weatherText} ${stationText ? `Weather station/location metadata: ${stationText}.` : ''}${distanceText}`));
    const assumptionText = `Inputs: tilt ${format(data.inputs.tiltDegrees)}°, azimuth ${format(data.inputs.azimuthDegrees)}°, losses ${format(data.inputs.systemLossesPercent, 1)}%, fixed roof-mounted array, standard module.`;
    resultEl.append(el('p', '', assumptionText));
    if (Array.isArray(data.warnings) && data.warnings.length) {
      const list = el('ul');
      data.warnings.forEach((warning) => list.append(el('li', '', warning)));
      resultEl.append(el('p', '', 'PVWatts warnings:'), list);
    }
    resultEl.append(el('p', '', 'Interpret as a modeled typical-year estimate, not a guarantee. The selected Census place point is a city-level representative coordinate; roof shading and actual site conditions are not inspected.'));
  }

  tariffBtn.addEventListener('click', async () => {
    if (!currentPlace || tariffPending) return;
    const seq = ++tariffSequence;
    const selectedPlace = { ...currentPlace };
    tariffPending = true;
    updateActions();
    setStatus(tariffStatus, 'Searching nearby residential rate records…');
    tariffResults.replaceChildren();
    const query = params({ lat: selectedPlace.latitude, lon: selectedPlace.longitude });
    try {
      const response = await fetch(`../api/tariffs?${query.toString()}`, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (seq !== tariffSequence) return;
      if (!response.ok) throw new Error(data.error || 'Tariff discovery failed.');
      setStatus(tariffStatus, `${data.returned} candidate records returned within approximately ${data.searchRadiusMiles} miles.`);
      if (!data.rates.length) {
        tariffResults.append(el('p', '', 'No nearby residential tariff records were returned. Ask your utility for the current tariff sheet.'));
      } else {
        const tableWrap = el('div', 'table-scroll');
        const table = el('table');
        table.setAttribute('aria-label', 'Nearby candidate utility tariff records');
        const cap = el('caption', '', 'Nearby candidate records — not confirmed for this property');
        const thead = el('thead');
        const hrow = el('tr');
        ['Utility', 'Rate name', 'Status / dates', 'Source'].forEach((label) => hrow.append(el('th', '', label)));
        thead.append(hrow);
        const tbody = el('tbody');
        data.rates.forEach((rate) => {
          const row = el('tr');
          row.append(el('td', '', rate.utility || 'Not listed'), el('td', '', rate.name || rate.label));
          const dates = `${rate.approved ? 'Approved' : 'Approval not confirmed'}${rate.isDefault ? ' · database default' : ''}${rate.startDate ? ` · starts ${rate.startDate}` : ''}${rate.endDate ? ` · ends ${rate.endDate}` : ''}`;
          row.append(el('td', '', dates));
          const td = el('td');
          if (rate.url) {
            const a = el('a', '', 'Open URDB record');
            a.href = rate.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
            td.append(a);
          } else td.textContent = 'No source link';
          row.append(td);
          tbody.append(row);
        });
        table.append(cap, thead, tbody);
        tableWrap.append(table);
        tariffResults.append(tableWrap, el('p', '', data.limitation));
      }
    } catch (error) {
      if (seq === tariffSequence) setStatus(tariffStatus, error.message || 'Tariff search failed.');
    } finally {
      if (seq === tariffSequence) {
        tariffPending = false;
        updateActions();
      }
    }
  });

  const incoming = new URLSearchParams(window.location.search);
  const requestedCity = incoming.get('city');
  const requestedState = incoming.get('state');
  if (requestedCity && requestedState && /^[A-Z]{2}$/i.test(requestedState) && requestedCity.length >= 3) {
    cityEl.value = requestedCity.slice(0, 80);
    const query = params({ search: cityEl.value });
    fetch('../api/location?' + query.toString(), { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'City suggestions are unavailable.');
        return data;
      })
      .then((data) => {
        const candidate = (data.suggestions || []).find((item) => item.placeName.toLocaleLowerCase('en-US') === requestedCity.toLocaleLowerCase('en-US') && item.stateAbbreviation === requestedState.toUpperCase());
        if (candidate) {
          chooseCityCandidate(candidate);
          lookupBtn.click();
        } else {
          setStatus(locationStatus, 'The linked city/state could not be matched. Select a Census suggestion manually.');
        }
      })
      .catch((error) => setStatus(locationStatus, error.message || 'The linked city/state could not be resolved.'));
  }
})();