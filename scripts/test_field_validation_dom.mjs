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
    this.required = false; this.disabled = false; this.hidden = false;
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
  querySelectorAll() { return this.children.filter((item) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(item.tagName)); }
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
const nodes = { '#root': root, '#amount': amount, '#contextValue': contextValue };
const documentListeners = {};
const document = {
  querySelector: (selector) => nodes[selector] || null,
  querySelectorAll: () => [amount, contextValue],
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

console.log('PASS: live inline hard errors, correction clearing, non-blocking plausibility warnings, required-on-blur feedback, and final click blocking/focus behavior.');
