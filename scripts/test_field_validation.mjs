import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = {
  document: { querySelectorAll: () => [], addEventListener: () => {} },
  window: {},
  console,
};
vm.runInNewContext(
  fs.readFileSync(new URL('../assets/js/field-validation-1.js', import.meta.url), 'utf8'),
  context,
  { filename: 'field-validation-1.js' },
);
const { assessValue, assessPair } = context.window.FieldValidation;

const number = (value, options = {}) => assessValue({
  value,
  type: 'number',
  min: 0,
  max: 100,
  step: '0.1',
  required: false,
  ...options,
});

assert.equal(number('', { required: true }).valid, false, 'required blank values must fail');
assert.equal(number('').valid, true, 'optional blank values must remain valid');
assert.equal(number('-0.1').valid, false, 'values below the hard minimum must fail');
assert.equal(number('100.1').valid, false, 'values above the hard maximum must fail');
assert.equal(number('10.05').valid, false, 'step precision must be enforced');
assert.equal(number('10.1').valid, true, 'valid step increments must pass');
assert.equal(number('0', { min: 0, max: 5, step: '0.0001' }).valid, true, 'zero must remain valid where explicitly allowed');
assert.equal(number('0.1819', { min: 0, max: 5, step: '0.0001' }).valid, true, 'fractional utility tariffs must pass at 4 decimal places');
const wholeDollar = (value) => assessValue({
  value, type: 'number', min: 1, max: 2000000, step: '1', required: true,
});
assert.equal(wholeDollar('30000').valid, true, 'ordinary whole-dollar solar cash prices must pass');
assert.equal(wholeDollar('30000.5').valid, false, 'whole-dollar quote fields must reject fractional dollars consistently');
const unusual = number('35', { warningMax: 20 });
assert.equal(unusual.valid, true, 'plausibility warnings must not block legitimate unusual values');
assert.match(unusual.warning, /Unusually high/);
assert.equal(assessValue({ value: 'A', type: 'text', required: true, minLength: 2, maxLength: 10 }).valid, false);
assert.equal(assessValue({ value: 'Austin', type: 'text', required: true, minLength: 2, maxLength: 10, pattern: "[A-Za-z]+" }).valid, true);
assert.equal(assessValue({ value: 'Austin1', type: 'text', required: true, pattern: "^[A-Za-z]+$" }).valid, false);
assert.equal(assessValue({ value: 'Austin!!', type: 'text', required: true, minLength: 2, maxLength: 80, pattern: "[A-Za-z0-9 .’'-]+" }).valid, false, 'patterns must validate the entire text value, not just a matching substring');
assert.equal(assessValue({ value: 'A'.repeat(81), type: 'text', required: true, minLength: 2, maxLength: 80 }).valid, false, 'text length limit must be enforced');
assert.equal(assessPair('4', '8', true).valid, true);
assert.equal(assessPair('8', '4', true).valid, false, 'paired high values must not be below low values');
assert.equal(assessPair('4', '', true).valid, false, 'paired optional ranges require both values after one is entered');
assert.equal(assessPair('', '', true).valid, true, 'blank optional ranges remain optional');

console.log('PASS: required/optional, hard ranges, step precision, zero values, text format, pair ordering and non-blocking plausibility warnings.');
