/* Shared, low-friction field validation for every calculator.
   Hard limits come from each field's min/max/step/required attributes.
   Soft plausibility limits use data-warning-min/max and never block a calculation. */
(function () {
  'use strict';

  function assessValue(spec) {
    const value = String(spec.value ?? '').trim();
    const required = spec.required === true;
    if (value === '') return required
      ? { valid: false, message: 'This field is required.', warning: '' }
      : { valid: true, message: '', warning: '' };

    if (spec.type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number)) return { valid: false, message: 'Enter a valid number.', warning: '' };
      if (spec.min !== null && spec.min !== undefined && number < Number(spec.min)) {
        return { valid: false, message: `Enter at least ${spec.min}.`, warning: '' };
      }
      if (spec.max !== null && spec.max !== undefined && number > Number(spec.max)) {
        return { valid: false, message: `Enter no more than ${spec.max}.`, warning: '' };
      }
      if (spec.step && spec.step !== 'any') {
        const step = Number(spec.step);
        if (Number.isFinite(step) && step > 0) {
          const base = spec.min !== null && spec.min !== undefined ? Number(spec.min) : 0;
          const quotient = (number - base) / step;
          if (Math.abs(quotient - Math.round(quotient)) > 1e-7) {
            return { valid: false, message: `Use increments of ${spec.step}.`, warning: '' };
          }
        }
      }
      let warning = '';
      if (spec.warningMin !== null && spec.warningMin !== undefined && number < Number(spec.warningMin)) warning = `Unusually low. Check the source and unit; values below ${spec.warningMin} may be valid, but deserve review.`;
      if (spec.warningMax !== null && spec.warningMax !== undefined && number > Number(spec.warningMax)) warning = `Unusually high. Check the source and unit; values above ${spec.warningMax} may be valid, but deserve review.`;
      return { valid: true, message: '', warning };
    }

    if (spec.minLength && value.length < Number(spec.minLength)) {
      return { valid: false, message: `Enter at least ${spec.minLength} characters.`, warning: '' };
    }
    if (spec.maxLength && value.length > Number(spec.maxLength)) {
      return { valid: false, message: `Use no more than ${spec.maxLength} characters.`, warning: '' };
    }
    if (spec.pattern) {
      try {
        // HTML pattern semantics require a full-value match, not a substring match.
        if (!(new RegExp(`^(?:${spec.pattern})$`, 'u')).test(value)) return { valid: false, message: spec.patternMessage || 'Use the accepted format.', warning: '' };
      } catch (_) {
        return { valid: false, message: 'This field has an invalid validation rule. Contact the site owner.', warning: '' };
      }
    }
    return { valid: true, message: '', warning: '' };
  }

  function assessPair(a, b, bothRequired) {
    const aHas = String(a ?? '').trim() !== '';
    const bHas = String(b ?? '').trim() !== '';
    if (bothRequired && (aHas || bHas) && !(aHas && bHas)) {
      return { valid: false, messageA: aHas ? '' : 'Enter this value because the paired field is filled.', messageB: bHas ? '' : 'Enter this value because the paired field is filled.' };
    }
    if (aHas && bHas && Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(a) > Number(b)) {
      return { valid: false, messageA: 'This value must not exceed the paired high value.', messageB: 'The high value must be at least the low value.' };
    }
    return { valid: true, messageA: '', messageB: '' };
  }

  const ids = new WeakMap();
  let counter = 0;
  const touched = new WeakSet();

  function visible(element) {
    if (!element || element.disabled) return false;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
    }
    return true;
  }

  function unitLabel(element) {
    if (element.dataset.validationUnit) return ` ${element.dataset.validationUnit}`;
    const field = element.closest('.field');
    if (!field) return '';
    const suffix = field.querySelector('.input-with-suffix span:last-child');
    if (suffix && suffix.textContent.trim()) return ` ${suffix.textContent.trim()}`;
    const label = field.querySelector('label');
    const text = label ? label.textContent.replace(/\s+/g, ' ').trim() : '';
    const match = text.match(/\(([^)]+)\)/);
    return match ? ` ${match[1]}` : '';
  }

  function inputSpec(element) {
    return {
      value: element.value,
      type: element.type === 'number' ? 'number' : element.tagName === 'SELECT' ? 'select' : 'text',
      min: element.hasAttribute('min') ? element.getAttribute('min') : null,
      max: element.hasAttribute('max') ? element.getAttribute('max') : null,
      step: element.getAttribute('step'),
      required: element.required || element.dataset.validationRequired === 'true',
      minLength: element.minLength > 0 ? element.minLength : null,
      maxLength: element.maxLength > 0 ? element.maxLength : null,
      pattern: element.getAttribute('pattern'),
      patternMessage: element.dataset.patternMessage,
      warningMin: element.dataset.warningMin,
      warningMax: element.dataset.warningMax
    };
  }

  function updateHint(element, hint) {
    const spec = inputSpec(element);
    if (element.type === 'number') {
      const min = spec.min === null ? null : spec.min;
      const max = spec.max === null ? null : spec.max;
      const range = min !== null && max !== null ? `${min}–${max}` : min !== null ? `at least ${min}` : max !== null ? `up to ${max}` : 'a valid number';
      const step = spec.step && spec.step !== 'any' ? ` · increments of ${spec.step}` : '';
      const requiredText = spec.required ? 'Required' : 'Optional; leave blank when unknown';
      hint.textContent = `${requiredText} · Allowed: ${range}${unitLabel(element)}${step}.`;
    } else if (element.tagName === 'SELECT') {
      hint.textContent = spec.required ? 'Required · Choose one of the listed options.' : 'Choose from the available options; leave blank or keep the default when not applicable.';
    } else {
      const min = spec.minLength || 1;
      const max = spec.maxLength;
      const formatHint = element.dataset.validationHint ? ` ${element.dataset.validationHint}` : '';
      hint.textContent = max ? `Enter ${min}–${max} characters.${formatHint}` : `Enter the requested text.${formatHint}`;
    }
  }

  function ensureUI(element) {
    if (ids.has(element)) {
      const existing = ids.get(element);
      updateHint(element, existing.hint);
      return existing;
    }
    const id = element.id || `field-check-${++counter}`;
    const hintId = `${id}-checker-hint`;
    const messageId = `${id}-checker-message`;
    const field = element.closest('.field') || element.parentElement;
    const hint = document.createElement('small');
    hint.className = 'field-checker-hint';
    hint.id = hintId;
    const message = document.createElement('small');
    message.className = 'field-checker-message';
    message.id = messageId;
    message.setAttribute('aria-live', 'polite');
    message.hidden = true;
    updateHint(element, hint);
    field.append(hint, message);
    const describedBy = new Set((element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    describedBy.add(hintId);
    describedBy.add(messageId);
    element.setAttribute('aria-describedby', [...describedBy].join(' '));
    ids.set(element, { hint, message });
    return { hint, message };
  }

  function assessElement(element) {
    const base = assessValue(inputSpec(element));
    if (!base.valid) return base;

    const minPeer = element.dataset.validationMinPeer ? document.querySelector(element.dataset.validationMinPeer) : null;
    if (minPeer && element.value.trim() !== '' && minPeer.value.trim() !== '' && Number(element.value) < Number(minPeer.value)) {
      return { valid: false, message: 'This value must be at least the paired low value.', warning: '' };
    }
    const maxPeer = element.dataset.validationMaxPeer ? document.querySelector(element.dataset.validationMaxPeer) : null;
    if (maxPeer && element.value.trim() !== '' && maxPeer.value.trim() !== '' && Number(element.value) > Number(maxPeer.value)) {
      return { valid: false, message: 'This value must not exceed the paired high value.', warning: '' };
    }
    const groupSelector = element.dataset.validationRequiredIfAny;
    if (groupSelector) {
      const groupFields = [...document.querySelectorAll(groupSelector)];
      const anyEntered = groupFields.some((item) => String(item.value ?? '').trim() !== '');
      if (anyEntered && String(element.value ?? '').trim() === '') {
        return { valid: false, message: 'Complete the other fields in this calculation method, or clear them and use the alternative method.', warning: '' };
      }
    }
    const exclusiveSelector = element.dataset.validationExclusiveWith;
    if (exclusiveSelector) {
      const conflicting = [...document.querySelectorAll(exclusiveSelector)].some((item) => String(item.value ?? '').trim() !== '');
      if (conflicting && String(element.value ?? '').trim() !== '') {
        return { valid: false, message: 'Use one calculation method at a time. Clear the fields for the other method.', warning: '' };
      }
    }
    const peerSelector = element.dataset.validationRequiredWithPeer;
    if (peerSelector) {
      const peer = document.querySelector(peerSelector);
      if (peer && (element.value.trim() !== '' || peer.value.trim() !== '') && element.value.trim() === '') {
        return { valid: false, message: 'Enter this value because its paired field is filled.', warning: '' };
      }
    }
    return base;
  }

  function refreshHint(element) {
    if (!element) return;
    const ui = ensureUI(element);
    updateHint(element, ui.hint);
  }

  function render(element, force) {
    if (!visible(element)) return { valid: true, message: '', warning: '' };
    const result = assessElement(element);
    const ui = ensureUI(element);
    const shouldShow = force || touched.has(element) || String(element.value ?? '').trim() !== '';
    element.setAttribute('aria-invalid', result.valid ? 'false' : 'true');
    ui.message.classList.toggle('is-warning', Boolean(result.valid && result.warning));
    ui.message.textContent = result.valid ? result.warning : result.message;
    ui.message.hidden = !(shouldShow && (!result.valid || result.warning));
    element.classList.toggle('field-invalid', shouldShow && !result.valid);
    element.classList.toggle('field-warning', shouldShow && result.valid && Boolean(result.warning));
    return result;
  }

  function allFields(root) {
    return [...(root || document).querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="radio"]):not([type="checkbox"]), select, textarea')];
  }

  function validateScope(rootOrSelector) {
    const root = typeof rootOrSelector === 'string' ? document.querySelector(rootOrSelector) : rootOrSelector;
    if (!root) return { valid: false, invalid: [] };
    const fields = allFields(root).filter(visible);
    const invalid = [];
    fields.forEach((field) => {
      touched.add(field);
      if (!render(field, true).valid) invalid.push(field);
    });
    // Cross-field ordering and paired optional fields are always checked together.
    fields.forEach((field) => {
      const peerSelector = field.dataset.validationRequiredWithPeer || field.dataset.validationMinPeer || field.dataset.validationMaxPeer || field.dataset.validationRequiredIfAny || field.dataset.validationExclusiveWith;
      if (!peerSelector) return;
      const peer = document.querySelector(peerSelector);
      if (peer && visible(peer)) {
        touched.add(peer);
        if (!render(peer, true).valid && !invalid.includes(peer)) invalid.push(peer);
      }
    });
    if (invalid.length) {
      invalid[0].focus({ preventScroll: false });
      return { valid: false, invalid };
    }
    return { valid: true, invalid: [] };
  }

  function init() {
    const fields = allFields(document);
    fields.forEach((field) => {
      ensureUI(field);
      field.addEventListener('input', () => {
        if (touched.has(field) || String(field.value ?? '').trim() !== '') touched.add(field);
        render(field, false);
        const peerSelectors = [field.dataset.validationRequiredWithPeer, field.dataset.validationMinPeer, field.dataset.validationMaxPeer, field.dataset.validationRequiredIfAny, field.dataset.validationExclusiveWith].filter(Boolean);
        peerSelectors.forEach((selector) => { const peer = document.querySelector(selector); if (peer) render(peer, false); });
      });
      field.addEventListener('change', () => { touched.add(field); render(field, true); });
      field.addEventListener('blur', () => { touched.add(field); render(field, true); });
    });

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-field-validation-scope]');
      if (!button) return;
      const result = validateScope(button.dataset.fieldValidationScope);
      if (!result.valid) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  window.FieldValidation = { assessValue, assessPair, validateScope, refresh: (element) => render(element, true), refreshHint, init };
  init();
})();
