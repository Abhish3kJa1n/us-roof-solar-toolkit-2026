import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeNode {
  constructor(tag = 'div', value = '') {
    this.tagName = tag.toUpperCase(); this.value = value; this.textContent = ''; this.className = '';
    this.children = []; this.listeners = {}; this.disabled = false; this.href = ''; this.target = ''; this.rel = '';
  }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  append(...nodes) { this.children.push(...nodes); }
  add(node) { this.children.push(node); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  emit(name, event = {}) { return this.listeners[name]?.(event); }
}
class FakeOption extends FakeNode {
  constructor(label, value) { super('option', value); this.textContent = label; }
}
const flatten = (node) => [node.textContent, ...(node.children || []).map(flatten)].join(' ');
const wait = () => new Promise((resolve) => setTimeout(resolve, 0));

const validSolar = {
  record_type: 'solar_installed_price', publication_status: 'approved', geography_level: 'city',
  city: 'Austin', state: 'TX', sample_n: 150, installation_year_min: 2024, installation_year_max: 2025,
  metric: 'usd_per_w_dc', p25: 2.45, median: 2.9, p75: 3.4,
  source_title: 'Berkeley Lab Tracking the Sun', source_url: 'https://eta.lbl.gov/publications/example',
  methodology_url: 'https://emp.lbl.gov/sites/default/files/example.pdf',
  approval: { current_dataset_license_confirmed: true, real_dataset_reviewed: true, cohort_filters_reviewed: true, independent_method_reviewed: true },
};
const validRoof = {
  record_type: 'ahs_metro_roofing_job_cost', publication_status: 'approved', geography_level: 'metro',
  metro_omb13cbsa: '12420', metro_name: 'Austin-Round Rock-Georgetown, TX', sample_n: 44,
  period_start_year: 2021, period_end_year: 2023, metric: 'nominal_usd_whole_project',
  p25: 6100, median: 10500, p75: 16900,
  source_title: 'U.S. Census Bureau / HUD 2023 AHS', source_url: 'https://www.census.gov/programs-surveys/ahs/data.2023.html',
  methodology_url: 'https://www.census.gov/programs-surveys/ahs/tech-documentation.html', period_label: '2021–2023',
  approval: { job_type_code_verified: true, census_table_c16_reconciled: true, variance_method_validated: true, metro_geography_verified: true, scope_and_imputation_disclosed: true },
};

async function boot(registry) {
  const ids = ['solarInstalledBenchmark', 'roofMetroBenchmark', 'roofMetroBenchmarkResult'];
  const nodes = Object.fromEntries(ids.map((id) => [id, new FakeNode(id === 'roofMetroBenchmark' ? 'select' : 'div')]));
  const listeners = {};
  const calls = [];
  const context = {
    document: {
      currentScript: { src: 'https://site.example/assets/js/price-benchmarks-1.js' },
      getElementById: (id) => nodes[id] || null,
      createElement: (tag) => new FakeNode(tag),
      addEventListener: (name, fn) => { listeners[name] = fn; },
    },
    URL, Intl, Option: FakeOption,
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: true, json: async () => registry };
    },
  };
  const source = fs.readFileSync(new URL('../assets/js/price-benchmarks-1.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, context, { filename: 'price-benchmarks-1.js' });
  await wait();
  return { nodes, listeners, calls };
}

// Empty registry: no estimates, no selectable metro, and a quote-based fallback.
const empty = await boot({ schema_version: 1, records: [], source_status: {} });
assert.equal(empty.nodes.roofMetroBenchmark.disabled, true);
assert.match(flatten(empty.nodes.roofMetroBenchmarkResult), /No metro roofing distribution is approved/);
await empty.listeners['roofsolar:place-selected']({ detail: { city: 'Austin', state: 'TX' } });
await wait();
assert.match(flatten(empty.nodes.solarInstalledBenchmark), /No approved installed-price distribution/);
assert.match(flatten(empty.nodes.solarInstalledBenchmark), /written cash quote/);
assert.match(empty.calls[0].url, /\/data\/price-benchmarks\.json$/);
assert.equal(empty.calls[0].options.credentials, 'omit');
console.log('PASS empty registry withholds all local price numbers and preserves quote-based fallback.');

// Approved synthetic rows: the UI renders only correctly typed price metrics and stated sample metadata.
const populated = await boot({ schema_version: 1, records: [validSolar, validRoof], source_status: { solar_installed_price: { status: 'published' }, ahs_metro_roofing_job_cost: { status: 'published' } } });
await populated.listeners['roofsolar:place-selected']({ detail: { city: 'Austin', state: 'TX' } });
await wait();
assert.match(flatten(populated.nodes.solarInstalledBenchmark), /\$2\.45–\$3\.40 per W DC/);
assert.match(flatten(populated.nodes.solarInstalledBenchmark), /150 projects/);
assert.equal(populated.nodes.roofMetroBenchmark.disabled, false);
populated.nodes.roofMetroBenchmark.value = '0';
await populated.nodes.roofMetroBenchmark.emit('change');
assert.match(flatten(populated.nodes.roofMetroBenchmarkResult), /\$6,100–\$16,900/);
assert.match(flatten(populated.nodes.roofMetroBenchmarkResult), /not a verified contractor invoice or a \$\/sq-ft rate/);
console.log('PASS approved synthetic city-solar and metro-AHS rows render with explicit units and limitations.');

// Editing a location clears an old price reference immediately.
await populated.listeners['roofsolar:place-selected']({ detail: null });
assert.match(flatten(populated.nodes.solarInstalledBenchmark), /Select a Census place/);
console.log('PASS changing the selected place clears a previously displayed solar price reference.');

// Even fully flagged synthetic rows must remain hidden unless the registry itself releases the source.
const withheld = await boot({ schema_version: 1, records: [validSolar, validRoof], source_status: { solar_installed_price: { status: 'withheld' }, ahs_metro_roofing_job_cost: { status: 'withheld' } } });
await withheld.listeners['roofsolar:place-selected']({ detail: { city: 'Austin', state: 'TX' } });
await wait();
assert.match(flatten(withheld.nodes.solarInstalledBenchmark), /No approved installed-price distribution/);
assert.equal(withheld.nodes.roofMetroBenchmark.disabled, true);
assert.doesNotMatch(flatten(withheld.nodes.solarInstalledBenchmark), /\$2\.45/);
assert.doesNotMatch(flatten(withheld.nodes.roofMetroBenchmarkResult), /\$6,100/);
console.log('PASS source-level withheld status overrides synthetic approved rows and suppresses displayed figures.');
console.log('Synthetic display rows were used only in this test and were not added to the public registry.');
