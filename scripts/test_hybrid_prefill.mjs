import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'calculators/solar-savings.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'assets/js/solar-savings-1.js'), 'utf8');
assert.match(html, /id="price"[^>]*value="2\.62"/);
assert.match(html, /id="price"[^>]*step="0\.01"/);

const approvals = {
  current_dataset_license_confirmed: true,
  real_dataset_reviewed: true,
  cohort_filters_reviewed: true,
  independent_method_reviewed: true
};
const approvedRegistry = {
  schema_version: 1,
  source_status: { solar_installed_price: { status: 'published' } },
  records: [{
    record_type: 'solar_installed_price', publication_status: 'approved', metric: 'usd_per_w_dc',
    geography_level: 'city', city: 'Austin', state: 'TX', sample_n: 154,
    p25: 2.80, median: 3.12, p75: 3.45,
    installation_year_min: 2024, installation_year_max: 2025,
    source_url: 'https://emp.lbl.gov/tracking-the-sun', approval: approvals
  }]
};

async function runScenario({ search = '', registry = approvedRegistry, editDuringFetch = false } = {}) {
  const ids = ['annualUse','importRate','offset','production','selfUse','exportRate','price','result','priceContext','run'];
  const elements = Object.fromEntries(ids.map(id => [id, {
    id, value: id === 'price' ? '2.62' : '', innerHTML: '', textContent: '', hidden: false,
    handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; },
    closest() { return { append() {} }; },
    append() {}
  }]));
  const created = [];
  const document = {
    getElementById(id) { return elements[id] || (elements[id] = {id,value:'',innerHTML:'',textContent:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},closest(){return {append(){}};}}); },
    createElement(tag) { const node={tag,className:'',textContent:'',append(){}}; created.push(node); return node; }
  };
  let releaseFetch;
  const fetchPromise = new Promise(resolve => { releaseFetch = resolve; });
  const context = {
    document, window: { location: { search } }, URLSearchParams, URL, Intl, Number, String, Math, Array,
    fetch: async () => fetchPromise,
    console
  };
  vm.runInNewContext(script, context, { filename: 'solar-savings-1.js' });
  if (editDuringFetch) {
    elements.price.value = '3.87';
    elements.price.handlers.input();
  }
  releaseFetch({ ok: true, async json() { return registry; } });
  await new Promise(resolve => setTimeout(resolve, 0));
  return { elements, created };
}

// A city handoff is checked against the public approval-gated registry; matching numbers in a URL are not trusted.
const city = await runScenario({ search: '?city=Austin&state=TX&production=1550.4&location=Austin%2C%20TX' });
assert.equal(city.elements.price.value, '3.12');
assert.match(city.elements.priceContext.textContent, /approved Berkeley Lab historical city/);
assert.match(city.elements.priceContext.textContent, /sample 154/);
assert.equal(city.elements.production.value, '1550.4');

// If no approved record exists, the editable national planning fallback remains.
const empty = await runScenario({
  search: '?city=Austin&state=TX&production=1550.4',
  registry: { schema_version: 1, source_status: { solar_installed_price: { status: 'withheld' } }, records: [] }
});
assert.equal(empty.elements.price.value, '2.62');
assert.match(empty.elements.priceContext.textContent, /EnergySage H1 2026/);

// A visitor edit made while the async registry lookup is in flight must never be overwritten.
const edited = await runScenario({ search: '?city=Austin&state=TX', editDuringFetch: true });
assert.equal(edited.elements.price.value, '3.87');
assert.match(edited.elements.priceContext.textContent, /You edited the price/);


// A weak sample is withheld even when the source/license metadata looks approved.
const weakSample = structuredClone(approvedRegistry);
weakSample.records[0].sample_n = 99;
const weak = await runScenario({ search: '?city=Austin&state=TX', registry: weakSample });
assert.equal(weak.elements.price.value, '2.62');
assert.match(weak.elements.priceContext.textContent, /EnergySage H1 2026/);

// A lookalike domain is not an LBNL source.
const lookalike = structuredClone(approvedRegistry);
lookalike.records[0].source_url = 'https://emp.lbl.gov.attacker.example/tracking-the-sun';
const spoofed = await runScenario({ search: '?city=Austin&state=TX', registry: lookalike });
assert.equal(spoofed.elements.price.value, '2.62');
assert.match(spoofed.elements.priceContext.textContent, /EnergySage H1 2026/);

// Missing license approval must also block the override.
const unlicensed = structuredClone(approvedRegistry);
unlicensed.records[0].approval.current_dataset_license_confirmed = false;
const noLicense = await runScenario({ search: '?city=Austin&state=TX', registry: unlicensed });
assert.equal(noLicense.elements.price.value, '2.62');
assert.match(noLicense.elements.priceContext.textContent, /EnergySage H1 2026/);

console.log('PASS hybrid solar prefill: editable national fallback, approval-gated city override, PV yield handoff, visitor-edit race protection, minimum sample, source-domain and license safeguards.');
