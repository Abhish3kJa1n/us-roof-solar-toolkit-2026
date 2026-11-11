import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) { const on = force === undefined ? !this.values.has(name) : Boolean(force); if (on) this.values.add(name); else this.values.delete(name); return on; }
  add(name) { this.values.add(name); }
  remove(name) { this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}
class FakeNode {
  constructor(tag = 'div', id = '') {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.id = id;
    this.value = ''; this.type = tag === 'input' ? 'number' : '';
    this.required = false; this.disabled = false; this.hidden = false; this.open = false;
    this.minLength = -1; this.maxLength = -1; this.dataset = {};
    this.attributes = {}; this.children = []; this.handlers = {};
    this.parentElement = null; this.parent = null; this.className = '';
    this.classList = new FakeClassList(); this.textContent = '';
    this.focused = false;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return Object.hasOwn(this.attributes, k) ? this.attributes[k] : null; }
  hasAttribute(k) { return Object.hasOwn(this.attributes, k); }
  removeAttribute(k) { delete this.attributes[k]; }
  append(...items) { for (const item of items) { item.parentElement = this; this.children.push(item); } }
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  dispatch(type) { for (const fn of (this.handlers[type] || [])) fn({ target: this }); }
  closest(selector) { if (selector === '.field') return this.fieldWrapper || null; return null; }
  querySelector(selector) { return null; }
  querySelectorAll() { const found=[]; const visit=node=>node.children.forEach(item=>{if(['INPUT','SELECT','TEXTAREA'].includes(item.tagName)) found.push(item); visit(item);}); visit(this); return found; }
  getAttributeSafe(k) { return this.getAttribute(k); }
  focus() { this.focused = true; }
}

const root = new FakeNode('section', 'root');
const fieldWrapper = new FakeNode('div');
const makeInput = (id, { min = null, max = null, step = null, required = false, warningMax = null } = {}) => {
  const input = new FakeNode('input', id);
  input.type = 'number'; input.required = required; input.value = '';
  if (min !== null) input.setAttribute('min', min);
  if (max !== null) input.setAttribute('max', max);
  if (step !== null) input.setAttribute('step', step);
  if (warningMax !== null) input.dataset.warningMax = String(warningMax);
  input.parentElement = fieldWrapper; input.fieldWrapper = fieldWrapper;
  fieldWrapper.append(input); root.append(input);
  return input;
};
const amount = makeInput('amount', { min: 1, max: 10, step: 1, required: true });
const contextValue = makeInput('contextValue', { min: 0, max: 100, step: 1, warningMax: 20 });
const details = new FakeNode('details'); details.open = false; root.append(details);
const advanced = new FakeNode('input', 'advanced');
advanced.type = 'number'; advanced.value = '101'; advanced.setAttribute('min', '0'); advanced.setAttribute('max', '100'); advanced.setAttribute('step', '1');
advanced.fieldWrapper = fieldWrapper; details.append(advanced);
const nodes = { '#root': root, '#amount': amount, '#contextValue': contextValue, '#advanced': advanced };
const documentListeners = {};
const document = {
  querySelector: (selector) => nodes[selector] || null,
  querySelectorAll: () => [amount, contextValue, advanced],
  createElement: (tag) => new FakeNode(tag),
  addEventListener: (type, fn) => { (documentListeners[type] ||= []).push(fn); },
};
const window = {};
vm.runInNewContext(fs.readFileSync(new URL('../assets/js/field-validation-1.js', import.meta.url), 'utf8'), { document, window }, { filename: 'field-validation-1.js' });

const amountHint = fieldWrapper.children.find((node) => node.className === 'field-checker-hint');
assert.match(amountHint.textContent, /Required/);
assert.match(amountHint.textContent, /1–10/);

amount.value = '11'; amount.dispatch('input');
const amountMessage = fieldWrapper.children.find((node) => node.className === 'field-checker-message');
assert.equal(amount.getAttribute('aria-invalid'), 'true');
assert.equal(amountMessage.hidden, false);
assert.match(amountMessage.textContent, /no more than 10/i);

amount.value = '7'; amount.dispatch('input');
assert.equal(amount.getAttribute('aria-invalid'), 'false');
assert.equal(amountMessage.hidden, true, 'correcting a value must clear its inline error without another Calculate click');

contextValue.value = '35'; contextValue.dispatch('input');
const contextMessage = fieldWrapper.children.filter((node) => node.className === 'field-checker-message').at(-1);
assert.equal(contextValue.getAttribute('aria-invalid'), 'false', 'a plausibility warning must not mark a legitimate unusual value invalid');
assert.equal(contextValue.classList.contains('field-warning'), true);
assert.match(contextMessage.textContent, /Unusually high/i);

amount.value = ''; amount.dispatch('blur');
assert.equal(amount.getAttribute('aria-invalid'), 'true');
assert.match(amountMessage.textContent, /required/i);

let prevented = false, stopped = false;
const button = new FakeNode('button', 'calculate');
button.dataset.fieldValidationScope = '#root';
button.closest = (selector) => selector === '[data-field-validation-scope]' ? button : null;
const event = { target: button, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } };
for (const listener of documentListeners.click || []) listener(event);
assert.equal(prevented, true, 'invalid scope must prevent the calculator action');
assert.equal(stopped, true, 'invalid scope must stop later Calculate handlers');
assert.equal(amount.focused, true, 'first invalid field should receive focus');

amount.value = '7'; amount.dispatch('input');
assert.equal(window.FieldValidation.validateScope(root).valid, true, 'invalid controls inside a collapsed details section must not block the calculator');
details.open = true;
const openedDetailsValidation = window.FieldValidation.validateScope(root);
assert.equal(openedDetailsValidation.valid, false, 'opening a details section must make its invalid fields subject to validation');
assert.equal(advanced.focused, true, 'the first invalid field in an opened details section should receive focus');

console.log('PASS: inline validation, correction clearing, warnings, click blocking, and collapsed-details validation behavior.');
