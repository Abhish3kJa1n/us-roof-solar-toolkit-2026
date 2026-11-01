(() => {
  'use strict';

  const solarPanel = document.getElementById('solarInstalledBenchmark');
  const roofSelect = document.getElementById('roofMetroBenchmark');
  const roofResult = document.getElementById('roofMetroBenchmarkResult');
  if (!solarPanel && !roofSelect && !roofResult) return;

  const registryUrl = new URL('../../data/price-benchmarks.json', document.currentScript.src);
  const state = { registry: null, requestPending: null, selectedPlace: null };

  const text = (tag, value, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  };
  const money = (value, digits = 0) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits
  }).format(value);
  const normalize = (value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const officialHost = (url, suffix) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return parsed.protocol === 'https:' && (host === suffix || host.endsWith(`.${suffix}`));
    } catch (_) { return false; }
  };
  const sourceReleased = (registry, type) => registry && registry.source_status &&
    registry.source_status[type] && registry.source_status[type].status === 'published';
  const approved = (record) => {
    if (!record || record.publication_status !== 'approved' || !Number.isInteger(record.sample_n)) return false;
    const p25 = Number(record.p25), median = Number(record.median), p75 = Number(record.p75);
    if (![p25, median, p75].every(Number.isFinite) || !(p25 > 0 && p25 <= median && median <= p75)) return false;
    const approval = record.approval || {};
    if (record.record_type === 'solar_installed_price') {
      const threshold = record.geography_level === 'city' ? 100 : record.geography_level === 'state' ? 500 : Infinity;
      return Number.isInteger(record.sample_n) && record.sample_n >= threshold &&
        record.metric === 'usd_per_w_dc' && officialHost(record.source_url, 'lbl.gov') &&
        Number.isInteger(record.installation_year_min) && Number.isInteger(record.installation_year_max) &&
        record.installation_year_min >= 2024 && record.installation_year_min <= record.installation_year_max && record.installation_year_max <= 2025 &&
        (record.geography_level !== 'city' || (typeof record.city === 'string' && record.city.trim() && /^[A-Z]{2}$/.test(record.state || ''))) &&
        (record.geography_level !== 'state' || /^[A-Z]{2}$/.test(record.state || '')) &&
        ['current_dataset_license_confirmed', 'real_dataset_reviewed', 'cohort_filters_reviewed', 'independent_method_reviewed'].every((key) => approval[key] === true);
    }
    if (record.record_type === 'ahs_metro_roofing_job_cost') {
      return record.geography_level === 'metro' && record.metric === 'nominal_usd_whole_project' && record.sample_n >= 30 &&
        /^\d{5}$/.test(record.metro_omb13cbsa || '') && Number(record.period_start_year) === 2021 && Number(record.period_end_year) === 2023 &&
        officialHost(record.source_url, 'census.gov') &&
        ['job_type_code_verified', 'census_table_c16_reconciled', 'variance_method_validated', 'metro_geography_verified', 'scope_and_imputation_disclosed'].every((key) => approval[key] === true);
    }
    return false;
  };
  const safeSource = (url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' ? parsed.href : null;
    } catch (_) { return null; }
  };
  const link = (url, label) => {
    const href = safeSource(url);
    if (!href) return null;
    const node = text('a', label);
    node.href = href;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  };
  const withRegistry = async () => {
    if (!state.requestPending) {
      state.requestPending = fetch(registryUrl.href, { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' } })
        .then(async (response) => {
          if (!response.ok) throw new Error('Benchmark data file is unavailable.');
          const data = await response.json();
          if (data.schema_version !== 1 || !Array.isArray(data.records)) throw new Error('Benchmark data schema is invalid.');
          state.registry = data;
          return data;
        })
        .catch((error) => { state.requestPending = null; throw error; });
    }
    return state.requestPending;
  };

  function notifySolarPriceBenchmark(place, row) {
    if (typeof CustomEvent !== 'function') return;
    const detail = row && place ? {
      available: true,
      city: place.city,
      state: String(place.state || '').toUpperCase(),
      geographyLevel: row.geography_level,
      metric: row.metric,
      p25: Number(row.p25),
      median: Number(row.median),
      p75: Number(row.p75),
      sampleN: Number(row.sample_n),
      installationYearMin: Number(row.installation_year_min),
      installationYearMax: Number(row.installation_year_max),
      sourceTitle: row.source_title || 'Berkeley Lab Tracking the Sun 2026',
      sourceUrl: row.source_url,
      methodologyUrl: row.methodology_url || ''
    } : { available: false, city: place?.city || '', state: String(place?.state || '').toUpperCase() };
    document.dispatchEvent(new CustomEvent('roofsolar:solar-price-benchmark', { detail }));
  }

  function renderSolar(place, registry) {
    if (!solarPanel) return;
    solarPanel.replaceChildren();
    if (!place) {
      solarPanel.append(text('strong', 'Installed solar price reference'), text('p', 'Select a Census place to check for a source-reviewed historical city or state price distribution. The PVWatts model estimates energy production; it does not estimate installation cost.'));
      return;
    }
    const rows = sourceReleased(registry, 'solar_installed_price') ? registry.records.filter((row) => approved(row) && row.record_type === 'solar_installed_price') : [];
    const city = rows.find((row) => row.geography_level === 'city' && normalize(row.city) === normalize(place.city) && String(row.state || '').toUpperCase() === String(place.state || '').toUpperCase());
    const stateRow = rows.find((row) => row.geography_level === 'state' && String(row.state || '').toUpperCase() === String(place.state || '').toUpperCase());
    const row = city || stateRow;
    solarPanel.append(text('strong', 'Installed solar price reference'));
    if (!row) {
      notifySolarPriceBenchmark(place, null);
      solarPanel.append(text('p', 'No approved installed-price distribution is available for this city or state. The underlying project-price dataset and commercial reuse review have not passed the publication gates. Use a current written cash quote in the savings calculator; no local price is inferred from solar production or electricity rates.'));
      return;
    }
    notifySolarPriceBenchmark(place, row);
    const geographyLabel = row.geography_level === 'city' ? `${row.city}, ${row.state}` : `${row.state_name || row.state} state-wide (not city-specific)`;
    solarPanel.append(text('p', `Historical observed project prices · ${geographyLabel}`));
    solarPanel.append(text('p', `${money(Number(row.p25), 2)}–${money(Number(row.p75), 2)} per W DC (25th–75th percentiles); median ${money(Number(row.median), 2)} per W DC.`));
    solarPanel.append(text('p', `Sample: ${row.sample_n.toLocaleString('en-US')} projects · installation years ${row.installation_year_min}–${row.installation_year_max} · nominal pre-incentive dollars. Historical distribution, not a current contractor quote or guaranteed price.`));
    solarPanel.append(text('p', 'Cohort excludes known battery/storage, ground-mounted, third-party-owned, self-installed, expansion and multi-phase records. Price fields may include reported or inconsistently verified values; the sample is not a census of every installation.'));
    const source = link(row.source_url, `Source: ${row.source_title || 'Berkeley Lab dataset'}`);
    if (source) solarPanel.append(source);
    if (row.methodology_url) {
      const method = link(row.methodology_url, 'Read the dataset and filtering methodology');
      if (method) solarPanel.append(method);
    }
  }

  function renderRoof(registry) {
    if (!roofSelect || !roofResult) return;
    const rows = (sourceReleased(registry, 'ahs_metro_roofing_job_cost') ? registry.records.filter((row) => approved(row) && row.record_type === 'ahs_metro_roofing_job_cost') : [])
      .sort((a, b) => String(a.metro_name).localeCompare(String(b.metro_name)));
    roofSelect.replaceChildren(new Option('Choose an available AHS metro reference', ''));
    roofSelect.disabled = rows.length === 0;
    rows.forEach((row, index) => {
      const option = new Option(`${row.metro_name} · AHS 2013 metro geography`, String(index));
      roofSelect.add(option);
    });
    roofResult.replaceChildren();
    if (!rows.length) {
      roofResult.append(text('strong', 'No metro roofing distribution is approved for display yet.'), text('p', 'The AHS relational microdata have not passed the required codebook, weighted-estimate, variance and Census Table C-16 reconciliation checks. The $10,000 national AHS figure shown above is historical survey context only; it is not a metro range, current quote or input to this calculator. Use comparable written local proposals for the calculation.'));
      return;
    }
    const update = () => {
      const index = roofSelect.value === '' ? -1 : Number(roofSelect.value);
      const row = Number.isInteger(index) && index >= 0 && index < rows.length ? rows[index] : null;
      roofResult.replaceChildren();
      if (!row) {
        roofResult.append(text('p', 'Choose a metro to view its historical AHS roofing-job spending distribution.'));
        return;
      }
      roofResult.append(text('strong', `Historical AHS roofing-job spending · ${row.metro_name}`));
      roofResult.append(text('p', `${money(Number(row.p25))}–${money(Number(row.p75))} (weighted 25th–75th percentiles); median ${money(Number(row.median))}.`));
      roofResult.append(text('p', `Sample: ${row.sample_n.toLocaleString('en-US')} unweighted projects · reference period ${row.period_label || '2021–2023'} · nominal survey dollars.`));
      roofResult.append(text('p', 'This is a metro-level homeowner-reported whole-project spending distribution, not a verified contractor invoice or a $/sq-ft rate. It does not establish a full tear-off, material, roof area or identical project scope. Census-edited/imputed values are included and disclosed. Do not use it as the rate in the roof-area calculator.'));
      const source = link(row.source_url, `Source: ${row.source_title || 'U.S. Census Bureau / HUD American Housing Survey'}`);
      if (source) roofResult.append(source);
    };
    roofSelect.addEventListener('change', update);
    update();
  }

  if (solarPanel) {
    renderSolar(null, { records: [] });
    document.addEventListener('roofsolar:place-selected', async (event) => {
      const place = event.detail && event.detail.city && event.detail.state ? event.detail : null;
      state.selectedPlace = place;
      if (!place) {
        renderSolar(null, { records: [] });
        return;
      }
      solarPanel.replaceChildren(text('strong', 'Installed solar price reference'), text('p', 'Checking for an approved historical price distribution. No estimate is displayed until the source and sample gates pass.'));
      try {
        const registry = await withRegistry();
        if (state.selectedPlace === place) renderSolar(place, registry);
      } catch (_) {
        if (state.selectedPlace === place) {
          notifySolarPriceBenchmark(place, null);
          solarPanel.replaceChildren(text('strong', 'Installed solar price reference'), text('p', 'The price-reference file could not be checked. No installed-price range is shown. Use a current written cash quote; PVWatts output is not an installation-price estimate.'));
        }
      }
    });
  }

  if (roofSelect && roofResult) {
    withRegistry().then(renderRoof).catch(() => {
      roofSelect.disabled = true;
      roofResult.replaceChildren(text('p', 'The benchmark file could not be checked. No metro price range is shown; use comparable written proposals in the calculator above.'));
    });
  }
})();
