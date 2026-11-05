#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeElement {
  constructor(id, value = '', labels = {}) {
    this.id = id;
    this.value = value;
    this.labels = labels;
    this.hidden = id === 'metalSystemField' || id === 'referenceStatus';
    this.disabled = false;
    this.textContent = '';
    this.innerHTML = '';
    this.handlers = {};
  }
  get selectedOptions() {
    return [{ textContent: this.labels[this.value] || (this.value ? this.value : 'Not specified') }];
  }
  addEventListener(type, callback) { this.handlers[type] = callback; }
  emit(type) {
    assert.equal(typeof this.handlers[type], 'function', 'missing ' + type + ' handler for #' + this.id);
    return this.handlers[type]({ target: this });
  }
}

const labels = {
  material: {
    '': 'Select material (optional label)',
    asphalt: 'Asphalt shingles',
    metal: 'Metal',
    tile: 'Concrete / clay tile',
    slate: 'Slate',
    wood: 'Wood shake / shingle',
    flat: 'Flat / membrane',
  },
  metalSystem: {
    '': 'Choose the closest published metal category',
    corrugated: 'Corrugated / standard sheet metal',
    standing_seam: 'Standing seam',
    metal_shingles: 'Metal shingles',
    metal_slate: 'Metal slate',
    stone_coated_steel: 'Stone-coated steel',
    galvanized_steel: 'Galvanized steel',
    galvalume_steel: 'Galvalume steel',
    aluminum: 'Aluminum',
    copper: 'Copper',
    zinc: 'Zinc',
    tin_terne: 'Tin / terne',
    stainless_steel: 'Stainless steel',
    corten_steel: 'Corten / weathering steel',
  },
};

const elements = {
  material: new FakeElement('material', '', labels.material),
  metalSystemField: new FakeElement('metalSystemField'),
  metalSystem: new FakeElement('metalSystem', '', labels.metalSystem),
  area: new FakeElement('area', '2000'),
  low: new FakeElement('low'),
  high: new FakeElement('high'),
  result: new FakeElement('result'),
  loadReference: new FakeElement('loadReference'),
  referenceStatus: new FakeElement('referenceStatus'),
  run: new FakeElement('run'),
  reset: new FakeElement('reset'),
};
const document = {
  getElementById(id) {
    assert.ok(elements[id], 'unexpected DOM lookup: #' + id);
    return elements[id];
  },
};
const pageHtml = fs.readFileSync(new URL('../calculators/roof-replacement-cost.html', import.meta.url), 'utf8');
assert.match(pageHtml, /<optgroup label="By roof style \/ system">/);
assert.match(pageHtml, /<optgroup label="By base metal \/ material">/);
for (const value of ['corrugated', 'standing_seam', 'metal_shingles', 'metal_slate', 'stone_coated_steel', 'galvanized_steel', 'galvalume_steel', 'aluminum', 'copper', 'zinc', 'tin_terne', 'stainless_steel', 'corten_steel']) {
  assert.match(pageHtml, new RegExp('value="' + value + '"'), 'missing published metal category option: ' + value);
}
const source = fs.readFileSync(new URL('../assets/js/roof-replacement-cost-1.js', import.meta.url), 'utf8');
vm.runInNewContext(source, { document, Intl, Number, Set, Array, String, Math }, { filename: 'roof-replacement-cost-1.js' });

const chooseMaterial = (value) => {
  elements.material.value = value;
  elements.material.emit('change');
};
const chooseMetalSystem = (value) => {
  elements.metalSystem.value = value;
  elements.metalSystem.emit('change');
};
const calculate = () => elements.run.emit('click');
const reload = () => elements.loadReference.emit('click');

function assertRates(low, high, label) {
  assert.equal(elements.low.value, String(low), label + ' low rate');
  assert.equal(elements.high.value, String(high), label + ' high rate');
}

assert.equal(elements.metalSystemField.hidden, true, 'metal selector starts hidden');
assert.equal(elements.low.value, '');
assert.equal(elements.high.value, '');
assert.equal(elements.loadReference.disabled, false);
console.log('PASS initial state: no prices prefilled and metal-system selector hidden');

// The metal selector appears only for Metal, and no metal reference loads until an exact system is selected.
chooseMaterial('metal');
assert.equal(elements.metalSystemField.hidden, false, 'metal selector appears for Metal');
assert.equal(elements.metalSystem.value, '');
assert.equal(elements.low.value, '');
assert.equal(elements.high.value, '');
assert.equal(elements.loadReference.disabled, true, 'reference button is disabled until a metal system is selected');
assert.ok(elements.loadReference.textContent.includes('Choose a metal category'));

// Every published metal-system range is loaded and the source follows the selected system.
const systems = [
  ['corrugated', '5', '12', 'corrugated / standard sheet metal'],
  ['standing_seam', '9', '16', 'standing seam'],
  ['metal_shingles', '6', '14', 'metal shingles'],
  ['metal_slate', '6', '14', 'metal slate'],
  ['stone_coated_steel', '7', '13', 'stone-coated steel'],
  ['galvanized_steel', '5', '13', 'galvanized steel'],
  ['galvalume_steel', '5', '13', 'Galvalume steel'],
  ['aluminum', '7', '17', 'aluminum'],
  ['copper', '13', '30', 'copper'],
  ['zinc', '10', '20', 'zinc'],
  ['tin_terne', '6', '18', 'tin / terne'],
  ['stainless_steel', '10', '21', 'stainless steel'],
  ['corten_steel', '6', '11', 'Corten / weathering steel'],
];
for (const [key, low, high, label] of systems) {
  chooseMetalSystem(key);
  assertRates(low, high, label);
  assert.ok(elements.referenceStatus.textContent.toLowerCase().includes(label.toLowerCase()));
  assert.ok(elements.referenceStatus.textContent.includes('HomeGuide'));
  assert.equal(elements.loadReference.disabled, false);
  calculate();
  assert.ok(elements.result.innerHTML.includes('HomeGuide'));
  assert.ok(elements.result.innerHTML.toLowerCase().includes(('Metal reference category: ' + label).toLowerCase()));
}
console.log('PASS all 13 metal style/material categories load their own disclosed HomeGuide ranges');

// Changing between systems without editing automatically refreshes both endpoints.
chooseMetalSystem('corrugated');
assertRates('5', '12', 'corrugated reload from unedited reference');
chooseMetalSystem('standing_seam');
assertRates('9', '16', 'standing seam reload from unedited reference');

// Editing only one endpoint must not cause an old endpoint to masquerade as the new system's reference.
elements.low.value = '10';
elements.low.emit('input');
assert.ok(elements.referenceStatus.textContent.includes('high endpoint remains from the original'));
chooseMetalSystem('corrugated');
assertRates('10', '16', 'mixed range retained after changing system');
assert.ok(elements.referenceStatus.textContent.includes('standing seam'));
assert.ok(elements.referenceStatus.textContent.includes('not a published range for corrugated / standard sheet metal'));
assert.ok(elements.loadReference.textContent.includes('Reload corrugated / standard sheet metal reference'));
calculate();
assert.ok(elements.result.innerHTML.includes('Mixed/custom rate pair'));
assert.ok(elements.result.innerHTML.includes('not a published range'));
reload();
assertRates('5', '12', 'explicit reload for newly selected system');
assert.ok(elements.referenceStatus.textContent.includes('corrugated sheet metal'));
calculate();
assert.ok(elements.result.innerHTML.includes('HomeGuide published installed range for corrugated / standard sheet metal'));
console.log('PASS edited reference never silently becomes another system reference; explicit reload replaces both endpoints');

// A material change clears any reference-derived values, including partially edited published ranges.
elements.low.value = '10';
elements.low.emit('input');
chooseMaterial('asphalt');
assert.equal(elements.metalSystemField.hidden, true);
assert.equal(elements.metalSystem.value, '');
assert.equal(elements.low.value, '');
assert.equal(elements.high.value, '');
assert.ok(elements.referenceStatus.textContent.includes('rates were cleared because the roof material changed'));
console.log('PASS changing away from Metal clears its source-derived rate pair and hides the system selector');

// Generic national reference requires explicit opt-in and is cleared when Metal is selected.
reload();
assertRates('4', '11', 'explicit Angi national opt-in');
assert.ok(elements.referenceStatus.textContent.includes('not a local or material-specific price'));
elements.low.value = '5';
elements.low.emit('input');
chooseMaterial('metal');
assert.equal(elements.low.value, '');
assert.equal(elements.high.value, '');
assert.equal(elements.metalSystemField.hidden, false);
assert.equal(elements.loadReference.disabled, true);
chooseMetalSystem('standing_seam');
assertRates('9', '16', 'metal system after national reference cleared');
console.log('PASS generic Angi range cannot carry into Metal, even after one endpoint is edited');

// Manually entered rates are preserved across material/system changes but explicitly flagged as visitor-entered.
chooseMaterial('tile');
elements.low.value = '5.5';
elements.low.emit('input');
elements.high.value = '8.5';
elements.high.emit('input');
chooseMaterial('metal');
assertRates('5.5', '8.5', 'manual values retained on material change');
assert.ok(elements.referenceStatus.textContent.toLowerCase().includes('visitor-entered rates were retained'));
chooseMetalSystem('metal_shingles');
assertRates('5.5', '8.5', 'manual values retained on system change');
assert.ok(elements.referenceStatus.textContent.includes('not a published reference for the new system'));
reload();
assertRates('6', '14', 'manual values intentionally replaced by reload');
calculate();
assert.ok(elements.result.innerHTML.includes('HomeGuide published installed range for metal shingles'));
console.log('PASS manual visitor rates are preserved but never presented as the new system reference');

// Reset clears values and all hidden/visible state.
chooseMaterial('asphalt');
elements.low.value = '5';
elements.high.value = '8';
elements.reset.emit('click');
assert.equal(elements.area.value, '');
assert.equal(elements.material.value, '');
assert.equal(elements.metalSystem.value, '');
assert.equal(elements.metalSystemField.hidden, true);
assert.equal(elements.low.value, '');
assert.equal(elements.high.value, '');
assert.equal(elements.referenceStatus.hidden, true);
assert.equal(elements.loadReference.disabled, false);
console.log('PASS reset clears rate provenance, both selectors, values and status');

// Calculation still rejects inverted rate ranges.
elements.area.value = '2000';
elements.material.value = 'asphalt';
elements.low.value = '9';
elements.high.value = '8';
calculate();
assert.ok(elements.result.innerHTML.includes('Check inputs'));
console.log('PASS inverted low/high rate range is rejected');
console.log('All roof reference-state regression checks passed.');
