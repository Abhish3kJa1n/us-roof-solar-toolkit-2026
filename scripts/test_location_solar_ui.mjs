import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeNode {
  constructor(tag = 'div', value = '') {
    this.tagName = tag.toUpperCase();
    this.value = value;
    this.textContent = '';
    this.className = '';
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.hidden = false;
    this.disabled = false;
    this.href = '';
    this.target = '';
    this.rel = '';
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  emit(name) { return this.listeners[name]?.({ target: this }); }
  replaceChildren(...children) { this.children = [...children]; }
  append(...children) { this.children.push(...children); }
  add(child) { this.children.push(child); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'href') this.href = ''; }
}

const ids = [
  'city','state','place','placeField','lookup','estimate','tariffs','result','locationStatus',
  'modelStatus','tariffStatus','tariffResults','savingsLink','panelCountLink','combinedLink','stateBenchmark','capacity','tilt','azimuth','losses',
];
const nodes = Object.fromEntries(ids.map((id) => [id, new FakeNode(id === 'place' ? 'select' : 'div')]));
nodes.savingsLink.hidden = true;
nodes.panelCountLink.hidden = true;
nodes.combinedLink.hidden = true;
const calls = [];
let pendingResolve;
let useDeferredModel = false;
const locationPayload = {
  city: 'Austin', state: 'TX', places: [{ placeName: 'Austin', stateAbbreviation: 'TX', geographyType: 'Incorporated place', latitude: 30.2672, longitude: -97.7431 }],
};
const modelPayload = {
  model: 'NLR PVWatts V8',
  inputs: { systemCapacityKwDc: 4, tiltDegrees: 20, azimuthDegrees: 180, systemLossesPercent: 14 },
  outputs: {
    annualAcKwh: 6200, monthlyAcKwh: [400,420,500,530,590,610,630,600,520,490,450,460],
    annualSolarRadiationKwhM2Day: 5.1, capacityFactorPercent: 11.79, annualKwhPerKwDc: 1550,
  },
  stationInfo: { location: 'Example weather station', state: 'Texas', weather_data_source: 'NSRDB TMY', distance: 32980.8 },
  climateDataset: 'NSRDB typical meteorological year', source: 'NLR PVWatts V8',
  warnings: [], fetchedAt: '2026-11-01T00:00:00.000Z',
};

const documentListeners = {};
class TestCustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }

const context = {
  CustomEvent: TestCustomEvent,
  document: {
    getElementById: (id) => nodes[id],
    createElement: (tag) => new FakeNode(tag),
    addEventListener: (name, callback) => { (documentListeners[name] ||= []).push(callback); },
    dispatchEvent: (event) => { (documentListeners[event.type] || []).forEach((callback) => callback(event)); return true; },
  },
  Option: class Option extends FakeNode {
    constructor(text, value) { super('option', value); this.textContent = text; }
  },
  URLSearchParams,
  window: { location: { search: '' } },
  Intl,
  Date,
  setTimeout,
  clearTimeout,
  encodeURIComponent,
  fetch: async (url) => {
    calls.push(String(url));
    if (String(url).includes('/api/location?')) return { ok: true, json: async () => locationPayload };
    if (String(url).includes('eia-residential-electricity-prices-2026-08-ytd.csv')) {
      return { ok: true, text: async () => 'area,code,jan_aug_2026_ytd_cents_per_kwh,jan_aug_2025_ytd_cents_per_kwh,yoy_change_percent,source,data_release_date\nTexas,TX,16.51,16.01,3.12,EIA Electric Power Monthly Table 5.6.B,2026-10-23\n' };
    }
    if (String(url).includes('/api/pvwatts?')) {
      if (useDeferredModel) return new Promise((resolve) => { pendingResolve = resolve; });
      return { ok: true, json: async () => modelPayload };
    }
    throw new Error('Unexpected endpoint in UI test: ' + url);
  },
};

const source = fs.readFileSync(new URL('../assets/js/location-solar-1.js', import.meta.url), 'utf8');
vm.runInNewContext(source, context, { filename: 'location-solar-1.js' });

// A city/state lookup selects a Census representative place, not a roof/address coordinate.
nodes.city.value = 'Austin';
nodes.state.value = 'TX';
await nodes.city.emit('input');
await nodes.state.emit('change');
await nodes.lookup.emit('click');
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(nodes.estimate.disabled, false);
assert.match(nodes.locationStatus.textContent, /Representative coordinates loaded/);
assert.match(calls.find((call) => call.includes('/api/location?')), /city=Austin/);
assert.match(calls.find((call) => call.includes('/api/location?')), /state=TX/);
assert.equal(nodes.stateBenchmark.hidden, false);
assert.match(nodes.stateBenchmark.children.map((n) => n.textContent).join(' '), /16.51¢\/kWh/);
assert.match(nodes.stateBenchmark.children.map((n) => n.textContent).join(' '), /not your utility’s marginal energy charge/);
assert.match(nodes.stateBenchmark.children.map((n) => n.textContent).join(' '), /2026 year-to-date values preliminary/);
assert.match(nodes.stateBenchmark.children.map((n) => n.textContent).join(' '), /Monthly estimates can be revised/);

// Synthetic fixture only: emit the approved city record shortly after PVWatts responds,
// simulating the public price registry completing after the production request.
// Blank inputs must not silently become zero or trigger a PVWatts request.
const beforeBlank = calls.length;
await nodes.estimate.emit('click');
assert.equal(calls.length, beforeBlank);
assert.match(nodes.modelStatus.textContent, /System size is required/);

// A valid request should retain the NLR capacity factor as percent units (11.79%, not 1,179%).
nodes.capacity.value = '4';
nodes.tilt.value = '20';
nodes.azimuth.value = '180';
nodes.losses.value = '14';
const delayedPriceEvent = setTimeout(() => context.document.dispatchEvent(new TestCustomEvent('roofsolar:solar-price-benchmark', { detail: {
  available: true, city: 'Austin', state: 'TX', geographyLevel: 'city', metric: 'usd_per_w_dc',
  p25: 2.35, median: 2.75, p75: 3.08, sampleN: 140,
  installationYearMin: 2024, installationYearMax: 2025,
  sourceTitle: 'Berkeley Lab Tracking the Sun 2026', sourceUrl: 'https://emp.lbl.gov/tracking-the-sun',
} })), 15);
await nodes.estimate.emit('click');
clearTimeout(delayedPriceEvent);
assert.match(nodes.result.children.map((n) => n.textContent).join(' '), /6,200 kWh\/year/);
assert.match(nodes.result.children.map((n) => n.textContent).join(' '), /11\.8%/);
assert.match(nodes.result.children.map((n) => n.textContent).join(' '), /20\.5 miles/);
assert.equal(nodes.savingsLink.hidden, false);
assert.match(nodes.savingsLink.href, /production=1550\.0/);
assert.match(nodes.savingsLink.href, /city=Austin/);
assert.match(nodes.savingsLink.href, /state=TX/);
assert.equal(nodes.panelCountLink.hidden, false);
assert.match(nodes.panelCountLink.href, /production=1550\.0/);
assert.match(nodes.panelCountLink.href, /location=Austin%2C\+TX/);
assert.equal(nodes.combinedLink.hidden, false);
assert.match(nodes.combinedLink.href, /productionPerKw=1550.0/);
assert.match(nodes.combinedLink.href, /city=Austin/);
assert.match(nodes.combinedLink.href, /state=TX/);
assert.match(nodes.combinedLink.href, /stateAverageRate=0.1651/);
assert.match(nodes.combinedLink.href, /stateAverageSource=EIA/);
assert.match(nodes.combinedLink.href, /pvwattsFetchedAt=2026-11-01/);
assert.match(nodes.combinedLink.href, /solarPricePerWatt=2.75/);
assert.match(nodes.combinedLink.href, /solarPriceSource=Berkeley\+Lab\+Tracking\+the\+Sun\+2026/);
assert.match(nodes.combinedLink.href, /solarPriceSampleN=140/);

// Editing an assumption removes the now-stale model hand-off.
nodes.capacity.value = '8';
await nodes.capacity.emit('input');
assert.equal(nodes.savingsLink.hidden, true);
assert.equal(nodes.savingsLink.href, '');
assert.equal(nodes.panelCountLink.hidden, true);
assert.equal(nodes.panelCountLink.href, '');
assert.equal(nodes.combinedLink.hidden, true);
assert.equal(nodes.combinedLink.href, '');
assert.match(nodes.result.children.map((n) => n.textContent).join(' '), /Model needs updating/);

// A response to an old model request must not overwrite the page after the city changes.
nodes.capacity.value = '4';
nodes.tilt.value = '20';
nodes.azimuth.value = '180';
nodes.losses.value = '14';
useDeferredModel = true;
const inFlight = nodes.estimate.emit('click');
await Promise.resolve();
assert.equal(typeof pendingResolve, 'function');
nodes.city.value = 'Dallas';
await nodes.city.emit('input');
assert.equal(nodes.stateBenchmark.hidden, true, 'changing city must clear the previous state benchmark');
pendingResolve({ ok: true, json: async () => modelPayload });
await inFlight;
assert.match(nodes.result.children.map((n) => n.textContent).join(' '), /Model needs updating/);
assert.equal(nodes.savingsLink.hidden, true);
assert.equal(nodes.panelCountLink.hidden, true);
assert.equal(nodes.combinedLink.hidden, true);

// A city change after PVWatts has returned but while the secondary benchmark
// hand-off is still pending must not publish links for the now-stale location.
useDeferredModel = false;
nodes.city.value = 'Austin';
await nodes.city.emit('input');
await nodes.lookup.emit('click');
assert.equal(nodes.estimate.disabled, false);
const staleSecondaryHandoff = nodes.estimate.emit('click');
await new Promise((resolve) => setTimeout(resolve, 0));
nodes.city.value = 'Dallas';
await nodes.city.emit('input');
await staleSecondaryHandoff;
assert.equal(nodes.savingsLink.hidden, true, 'a stale secondary wait must not re-create the savings link');
assert.equal(nodes.savingsLink.href, '');
assert.equal(nodes.panelCountLink.hidden, true, 'a stale secondary wait must not re-create the panel-count link');
assert.equal(nodes.panelCountLink.href, '');
assert.equal(nodes.combinedLink.hidden, true, 'a stale secondary wait must not re-create the combined-calculator link');
assert.equal(nodes.combinedLink.href, '');
assert.match(nodes.result.children.map((n) => n.textContent).join(' '), /Model needs updating/);

console.log('PASS: location estimator validation, PVWatts output units, editable handoffs, invalidation, stale PVWatts response protection, and stale secondary-benchmark race protection.');
