const annualUseEl = document.getElementById('annualUse');
const offsetEl = document.getElementById('offset');
const productionEl = document.getElementById('production');
const targetKwEl = document.getElementById('kw');
const panelWattEl = document.getElementById('watt');
const moduleAreaEl = document.getElementById('panelArea');
const panelResult = document.getElementById('result');
const runButton = document.getElementById('run');
const resetButton = document.getElementById('reset');
const productionContextEl = document.getElementById('productionContext');

// Accept a production value only when it arrives from the companion city-model link.
if (typeof window !== 'undefined' && window.location) {
  const handoff = new URLSearchParams(window.location.search);
  const incomingProduction = Number(handoff.get('production'));
  const incomingLocation = handoff.get('location');
  if (handoff.has('production') && Number.isFinite(incomingProduction) && incomingProduction >= 100 && incomingProduction <= 4000) {
    productionEl.value = incomingProduction.toFixed(1);
    productionContextEl.hidden = false;
    productionContextEl.textContent = `Modeled production loaded: ${fmt(incomingProduction, 1)} kWh per kW DC${incomingLocation ? ` for ${incomingLocation}` : ''}. This is a representative-place typical-year model, not a property-specific roof assessment.`;
  }
}

function showError(message) {
  panelResult.innerHTML = `<div class="big">Check inputs</div><p>${message}</p>`;
}

function fmt(value, digits = 0) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

runButton.addEventListener('click', () => {
  const raw = {
    annualUse: annualUseEl.value.trim(),
    offset: offsetEl.value.trim(),
    production: productionEl.value.trim(),
    targetKw: targetKwEl.value.trim(),
    watt: panelWattEl.value.trim(),
    area: moduleAreaEl.value.trim()
  };
  const usageFields = [raw.annualUse, raw.offset, raw.production];
  const anyUsage = usageFields.some(value => value !== '');
  const allUsage = usageFields.every(value => value !== '');
  const hasTargetKw = raw.targetKw !== '';
  const panelWatt = raw.watt === '' ? NaN : Number(raw.watt);
  const moduleArea = raw.area === '' ? null : Number(raw.area);

  if (anyUsage && hasTargetKw) {
    showError('Choose one method: either enter all three usage-based inputs and leave quoted system size blank, or enter only the quoted DC system size.');
    return;
  }
  if (anyUsage && !allUsage) {
    showError('For the usage-based method, enter annual electricity use, target offset and modeled annual production per kW DC.');
    return;
  }
  if (!anyUsage && !hasTargetKw) {
    showError('Enter the three usage-based inputs, or enter a quoted/target system size using the alternative method.');
    return;
  }
  if (!(Number.isFinite(panelWatt) && panelWatt >= 200 && panelWatt <= 800)) {
    showError('Enter a panel nameplate rating from 200 to 800 watts using the actual module datasheet or proposal.');
    return;
  }
  if (moduleArea !== null && !(Number.isFinite(moduleArea) && moduleArea >= 10 && moduleArea <= 35)) {
    showError('Module area is optional. When entered, use a value from 10 to 35 square feet.');
    return;
  }

  let targetKw;
  let targetGeneration = null;
  let generationOffset = null;
  let method;
  if (allUsage) {
    const annualUse = Number(raw.annualUse);
    const offset = Number(raw.offset);
    const production = Number(raw.production);
    if (!(Number.isFinite(annualUse) && annualUse >= 1 && annualUse <= 200000)) {
      showError('Enter annual household electricity use from 1 to 200,000 kWh.');
      return;
    }
    if (!(Number.isFinite(offset) && offset >= 1 && offset <= 100)) {
      showError('Enter a target annual generation offset from 1% to 100%.');
      return;
    }
    if (!(Number.isFinite(production) && production >= 100 && production <= 4000)) {
      showError('Enter modeled annual production from 100 to 4,000 kWh per kW DC. This broad range is a typo check, not a location benchmark.');
      return;
    }
    targetGeneration = annualUse * offset / 100;
    targetKw = targetGeneration / production;
    generationOffset = offset;
    method = 'usage-based';
  } else {
    targetKw = Number(raw.targetKw);
    if (!(Number.isFinite(targetKw) && targetKw >= 0.5 && targetKw <= 50)) {
      showError('Enter a quoted or target system size from 0.5 to 50 kW DC.');
      return;
    }
    method = 'quoted system size';
  }

  const panels = Math.ceil(targetKw * 1000 / panelWatt);
  const actualKw = panels * panelWatt / 1000;
  const totalModuleArea = moduleArea === null ? null : panels * moduleArea;
  const estimatedGeneration = method === 'usage-based' ? actualKw * Number(raw.production) : null;
  const areaText = totalModuleArea === null
    ? 'Not calculated — module area was not entered'
    : `${fmt(totalModuleArea)} sq ft of module surface only, before spacing and access requirements`;

  if (method === 'usage-based') {
    const difference = estimatedGeneration - targetGeneration;
    panelResult.innerHTML = `<div class="kicker">Estimated panel count · ${fmt(generationOffset)}% annual generation target</div><div class="big">${fmt(panels)} panels</div><p>Calculated array capacity: ${fmt(actualKw, 2)} kW DC · Target annual generation: ${fmt(targetGeneration)} kWh · Approximate modeled annual generation after rounding to whole panels: ${fmt(estimatedGeneration)} kWh.</p><p>Module surface area: ${areaText}. Whole-panel rounding adds approximately ${fmt(difference)} kWh/year above the requested generation target in this simplified model.</p>`;
  } else {
    panelResult.innerHTML = `<div class="kicker">Estimated panel count · quoted system size</div><div class="big">${fmt(panels)} panels</div><p>Quoted target capacity: ${fmt(targetKw, 2)} kW DC · Approximate whole-module capacity: ${fmt(actualKw, 2)} kW DC · Module surface area: ${areaText}.</p><p>Annual production was not calculated because this method uses a system size from an existing proposal, not an annual generation assumption.</p>`;
  }
});

resetButton.addEventListener('click', () => {
  [annualUseEl, offsetEl, productionEl, targetKwEl, panelWattEl, moduleAreaEl].forEach(element => { element.value = ''; });
  panelResult.innerHTML = '<div class="kicker">Estimated module count</div><div class="big">Ready to calculate</div><p>Enter annual usage, target offset, modeled production and module wattage—or use a quoted system size as the alternative method.</p>';
});
