import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeNode {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.textContent = ''; this.className = ''; this.hidden = false; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener() {}
  setAttribute() {}
}
class TestCustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
const listeners = {};
const solarPanel = new FakeNode('div');
let emitted = null;
const registry = {
  schema_version: 1,
  source_status: { solar_installed_price: { status: 'published' } },
  records: [{
    record_type: 'solar_installed_price', publication_status: 'approved', geography_level: 'city',
    city: 'Austin', state: 'TX', metric: 'usd_per_w_dc', p25: 2.35, median: 2.75, p75: 3.08,
    sample_n: 140, installation_year_min: 2024, installation_year_max: 2025,
    source_url: 'https://emp.lbl.gov/tracking-the-sun', source_title: 'Berkeley Lab Tracking the Sun 2026',
    methodology_url: 'https://emp.lbl.gov/tracking-the-sun',
    approval: { current_dataset_license_confirmed: true, real_dataset_reviewed: true, cohort_filters_reviewed: true, independent_method_reviewed: true },
  }],
};
const document = {
  currentScript: { src: 'https://example.test/calculators/price-benchmarks-1.js' },
  getElementById: (id) => id === 'solarInstalledBenchmark' ? solarPanel : null,
  createElement: (tag) => new FakeNode(tag),
  addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); },
  dispatchEvent: (event) => {
    if (event.type === 'roofsolar:solar-price-benchmark') emitted = event.detail;
    (listeners[event.type] || []).forEach((fn) => fn(event));
    return true;
  },
};
const context = {
  document, CustomEvent: TestCustomEvent, URL, Intl,
  fetch: async () => ({ ok: true, json: async () => registry }),
};
vm.runInNewContext(fs.readFileSync(new URL('../assets/js/price-benchmarks-1.js', import.meta.url), 'utf8'), context, { filename: 'price-benchmarks-1.js' });
document.dispatchEvent(new TestCustomEvent('roofsolar:place-selected', { detail: { city: 'Austin', state: 'TX' } }));
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(emitted?.available, true);
assert.equal(emitted?.city, 'Austin');
assert.equal(emitted?.state, 'TX');
assert.equal(emitted?.median, 2.75);
assert.equal(emitted?.sampleN, 140);
assert.match(solarPanel.children.map((item) => item.textContent).join(' '), /historical observed project prices/i);
console.log('PASS: only a source-approved city-level LBNL record is emitted for downstream editable price prefill; source/sample/period metadata are retained.');
