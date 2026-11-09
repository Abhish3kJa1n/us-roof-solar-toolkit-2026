const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const rateMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:3,maximumFractionDigits:3}).format(value);
const whole=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
const annualUseEl=document.getElementById('annualUse');
const importRateEl=document.getElementById('importRate');
const offsetEl=document.getElementById('offset');
const productionEl=document.getElementById('production');
const selfUseEl=document.getElementById('selfUse');
const selfUseLowEl=document.getElementById('selfUseLow');
const selfUseHighEl=document.getElementById('selfUseHigh');
const exportRateEl=document.getElementById('exportRate');
const priceEl=document.getElementById('price');
const resultEl=document.getElementById('result');
const priceContextEl=document.getElementById('priceContext');
let priceBasis='EnergySage H1 2026 national solar-only marketplace median: $2.62/W DC (published October 7, 2026); not a city quote or a property-specific price.';
let priceEdited=false;
if(priceContextEl) priceContextEl.textContent='Prefilled with EnergySage H1 2026 solar-only marketplace median: $2.62/W DC (published October 7, 2026). This is a national planning reference, not your quote or a city price. It is editable; replace it with a comparable written cash quote.';
priceEl.addEventListener('input',()=>{
  priceEdited=true;
  priceBasis='Visitor-entered price; source not asserted.';
  if(priceContextEl) priceContextEl.textContent='You edited the price. The calculation now uses your value, not the national reference. Use a comparable PV-only cash price per DC watt.';
});
function validApprovedSolarRow(row, registry){
  if(!row || row.record_type!=='solar_installed_price' || row.publication_status!=='approved' || row.metric!=='usd_per_w_dc') return false;
  if(!registry || registry.schema_version!==1 || registry.source_status?.solar_installed_price?.status!=='published') return false;
  const n=Number(row.sample_n), p25=Number(row.p25), median=Number(row.median), p75=Number(row.p75);
  const cityLevel=row.geography_level==='city', stateLevel=row.geography_level==='state';
  const threshold=cityLevel?100:stateLevel?500:Infinity;
  let host=''; try { host=new URL(row.source_url).hostname.toLowerCase(); } catch (_) { return false; }
  const approval=row.approval||{};
  return Number.isInteger(n)&&n>=threshold&&[p25,median,p75].every(Number.isFinite)&&p25>0&&p25<=median&&median<=p75&&
    Number.isInteger(row.installation_year_min)&&Number.isInteger(row.installation_year_max)&&row.installation_year_min>=2024&&row.installation_year_max<=2025&&row.installation_year_min<=row.installation_year_max&&
    (host==='lbl.gov'||host.endsWith('.lbl.gov'))&&
    ['current_dataset_license_confirmed','real_dataset_reviewed','cohort_filters_reviewed','independent_method_reviewed'].every(key=>approval[key]===true)&&
    ((cityLevel&&typeof row.city==='string'&&row.city.trim()&&/^[A-Z]{2}$/.test(row.state||''))||(stateLevel&&/^[A-Z]{2}$/.test(row.state||'')));
}
async function applyApprovedCityPrice(city,state){
  if(!city||!state||priceEdited) return;
  try{
    const response=await fetch('../data/price-benchmarks.json',{headers:{Accept:'application/json'},credentials:'omit'});
    if(!response.ok) return;
    const registry=await response.json();
    if(registry.schema_version!==1||!Array.isArray(registry.records)||registry.source_status?.solar_installed_price?.status!=='published') return;
    const normalized=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
    const rows=registry.records.filter(row=>validApprovedSolarRow(row,registry));
    const row=rows.find(item=>item.geography_level==='city'&&normalized(item.city)===normalized(city)&&String(item.state||'').toUpperCase()===String(state).toUpperCase())||
      rows.find(item=>item.geography_level==='state'&&String(item.state||'').toUpperCase()===String(state).toUpperCase());
    if(!row||priceEdited) return;
    priceEl.value=Number(row.median).toFixed(2);
    const geography=row.geography_level==='city'?`${row.city}, ${row.state}`:`${row.state_name||row.state} state-wide (not city-specific)`;
    priceBasis=`Berkeley Lab Tracking the Sun 2026 historical ${row.geography_level} distribution for ${geography}; median $${Number(row.median).toFixed(2)}/W DC; n=${row.sample_n}; installations ${row.installation_year_min}–${row.installation_year_max}. Not a current quote.`;
    if(priceContextEl) priceContextEl.textContent=`Prefilled from approved Berkeley Lab historical ${row.geography_level} installed-price data for ${geography}: median $${Number(row.median).toFixed(2)}/W DC; 25th–75th percentile $${Number(row.p25).toFixed(2)}–$${Number(row.p75).toFixed(2)}; sample ${row.sample_n}; installation years ${row.installation_year_min}–${row.installation_year_max}. Not a current quote. Editable; replace with a comparable written cash quote.`;
  }catch(_){ /* Keep the disclosed national fallback when the registry cannot be verified. */ }
}

// Optional hand-off from the city/PVWatts estimator. URL parameters only prefill this one field.
const queryString = typeof window !== 'undefined' && window.location ? window.location.search : '';
const handoff = new URLSearchParams(queryString);
const importedProduction = handoff.get('production');
const selectedCity = handoff.get('city');
const selectedState = handoff.get('state');
if(selectedCity && /^[A-Z]{2}$/i.test(selectedState || '')) applyApprovedCityPrice(selectedCity.slice(0,80), selectedState.toUpperCase());
if (importedProduction !== null) {
  const value = Number(importedProduction);
  if (Number.isFinite(value) && value >= 100 && value <= 4000) {
    productionEl.value = value.toFixed(1);
    const note = document.createElement('small');
    note.className = 'field-import-note';
    const location = handoff.get('location');
    note.textContent = `Prefilled from NLR PVWatts V8${location ? ` using a representative Census place point for ${location}` : ''}. The model inputs are editable; confirm roof-plane assumptions and model date.`;
    productionEl.closest('.field').append(note);
  }
}
const importedStateRate = Number(handoff.get('stateAverageRate'));
if (
  handoff.get('stateAverageSource') === 'EIA Electric Power Monthly Table 5.6.B' &&
  Number.isFinite(importedStateRate) && importedStateRate > 0 && importedStateRate <= 5
) {
  const stateLabel = handoff.get('state') || 'the selected state';
  const field = importRateEl.closest('.field');
  const note = document.createElement('small');
  note.className = 'field-import-note';
  note.id = 'eiaStateAverageNote';
  note.textContent = `EIA state-average residential electricity price for ${stateLabel}: ${importedStateRate.toFixed(4)} $/kWh. This is not your marginal utility tariff and has not been applied.`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-outline eia-opt-in';
  button.id = 'useEiaStateAverage';
  button.textContent = 'Use EIA average as an illustrative scenario';
  button.addEventListener('click', () => {
    importRateEl.value = importedStateRate.toFixed(4);
    note.textContent = `Applied ${importedStateRate.toFixed(4)} $/kWh EIA state average for ${stateLabel}. This remains an illustrative scenario, not your household tariff.`;
    button.disabled = true;
    button.textContent = 'EIA scenario value applied';
  });
  field.append(note, button);
}

const showError=message=>{resultEl.innerHTML=`<div class="big">Check inputs</div><p>${message}</p>`;};
document.getElementById('run').addEventListener('click',()=>{
  const annualUse=Number(annualUseEl.value);
  const importRateText=importRateEl.value.trim();
  const importRate=importRateText===''?null:Number(importRateText);
  const offset=Number(offsetEl.value)/100;
  const productionPerKw=Number(productionEl.value);
  const selfUseText=selfUseEl.value.trim();
  const selfUseShare=selfUseText===''?null:Number(selfUseText)/100;
  const selfUseLowText=selfUseLowEl.value.trim();
  const selfUseHighText=selfUseHighEl.value.trim();
  const selfUseLow=selfUseLowText===''?null:Number(selfUseLowText)/100;
  const selfUseHigh=selfUseHighText===''?null:Number(selfUseHighText)/100;
  const exportText=exportRateEl.value.trim();
  const exportRate=exportText===''?null:Number(exportText);
  const priceText=priceEl.value.trim();
  const pricePerWatt=priceText===''?null:Number(priceText);
  if(!Number.isFinite(annualUse)||annualUse<1||annualUse>200000) return showError('Enter annual electricity use from 1 to 200,000 kWh, using your utility bills.');
  if(importRate!==null&&(!Number.isFinite(importRate)||importRate<0||importRate>5)) return showError('Enter a marginal import energy rate from $0 to $5 per kWh, or leave it blank. A rate is not needed when modeled direct use is zero.');
  if(!Number.isFinite(offset)||offset<0.01||offset>1) return showError('Enter a target annual generation percentage from 1% to 100%.');
  if(!Number.isFinite(productionPerKw)||productionPerKw<100||productionPerKw>4000) return showError('Enter a production assumption from 100 to 4,000 kWh per kW DC per year, based on a site-specific model. These limits are typo checks, not a US range.');
  if(selfUseShare!==null&&(!Number.isFinite(selfUseShare)||selfUseShare<0||selfUseShare>1)) return showError('Enter a direct-use share from 0% to 100%, or leave it blank until you have a modeled value.');
  if((selfUseLow===null)!==(selfUseHigh===null)) return showError('For a self-consumption sensitivity comparison, enter both low and high scenario shares or leave both blank.');
  if(selfUseLow!==null&&(!Number.isFinite(selfUseLow)||!Number.isFinite(selfUseHigh)||selfUseLow<0||selfUseHigh>1||selfUseLow>selfUseHigh)) return showError('Enter valid low and high direct-use shares from 0% to 100%, with the low value no greater than the high value.');
  if(exportRate!==null&&(!Number.isFinite(exportRate)||exportRate<0||exportRate>5)) return showError('Enter export compensation from $0 to $5 per kWh, or leave blank when unknown. Enter $0 only when your tariff confirms zero compensation.');
  if(pricePerWatt!==null&&(!Number.isFinite(pricePerWatt)||pricePerWatt<0.1||pricePerWatt>20)) return showError('Enter an installed cash price from $0.10 to $20 per DC watt, or leave it blank to skip cost and payback.');
  const targetGeneration=annualUse*offset;
  const systemKw=targetGeneration/productionPerKw;
  const annualProduction=systemKw*productionPerKw;
  const selfConsumed=selfUseShare===null?null:Math.min(annualProduction*selfUseShare,annualUse);
  const exported=selfConsumed===null?null:Math.max(0,annualProduction-selfConsumed);
  const avoidedImportValue=selfConsumed===null?null:(selfConsumed<0.01?0:(importRate===null?null:selfConsumed*importRate));
  const exportValue=exportRate===null||exported===null?null:exported*exportRate;
  const exportIsNotNeeded=exported!==null&&exported<0.01;
  const annualValue=avoidedImportValue!==null&&(exportValue!==null||exportIsNotNeeded)?avoidedImportValue+(exportValue??0):null;
  const solarCost=pricePerWatt===null?null:systemKw*1000*pricePerWatt;
  const scenarioValue=share=>{
    const used=Math.min(annualProduction*share,annualUse);
    const sent=Math.max(0,annualProduction-used);
    if(used>=0.01&&importRate===null) return null;
    if(sent>=0.01&&exportRate===null) return null;
    return (used>=0.01?used*importRate:0)+(sent>=0.01?sent*exportRate:0);
  };
  const lowScenarioValue=selfUseLow===null?null:scenarioValue(selfUseLow);
  const highScenarioValue=selfUseHigh===null?null:scenarioValue(selfUseHigh);
  const payback=solarCost!==null&&annualValue!==null&&annualValue>0?solarCost/annualValue:null;
  const missingEnergyInputs=[];
  if(selfUseShare===null){missingEnergyInputs.push('annual direct-use share');}
  else{
    if(selfConsumed>=0.01&&importRate===null) missingEnergyInputs.push('marginal import rate');
    if(exported>=0.01&&exportRate===null) missingEnergyInputs.push('utility export credit');
  }
  resultEl.innerHTML=`<div class="kicker">Illustrative annual scenario</div>
    <div class="big">${systemKw.toFixed(1)} kW DC system</div>
    <p><strong>Estimated annual generation:</strong> ${whole(annualProduction)} kWh (${Math.round(offset*100)}% of annual use target)</p>
    <p><strong>Estimated used directly:</strong> ${selfConsumed===null?'Not modeled — enter an annual direct-use share':selfConsumed<0.01?'0 kWh in this scenario; no avoided-import value':avoidedImportValue===null?`${whole(selfConsumed)} kWh — enter the marginal import rate to value avoided purchases`:`${whole(selfConsumed)} kWh × ${rateMoney(importRate)}/kWh = ${money(avoidedImportValue)} avoided import charges`}</p>
    <p><strong>Estimated exported:</strong> ${exported===null?'Not modeled — enter an annual direct-use share':`${whole(exported)} kWh`}${exported===null||exportRate===null?' — export value requires both an energy-flow share and your tariff credit':` × ${rateMoney(exportRate)}/kWh = ${money(exportValue)} export credits`}</p>
    <p><strong>Modeled annual energy value:</strong> ${annualValue===null?`Not calculated — missing ${missingEnergyInputs.join(' and ')}`:`${money(annualValue)} (${money(annualValue/12)}/month average)`}</p>
    ${selfUseLow===null?'':`<p><strong>User-selected self-consumption sensitivity (not a forecast):</strong> ${Math.round(selfUseLow*100)}% low case: ${lowScenarioValue===null?'not calculated — required tariff input missing':money(lowScenarioValue)+' annual energy value'}; ${Math.round(selfUseHigh*100)}% high case: ${highScenarioValue===null?'not calculated — required tariff input missing':money(highScenarioValue)+' annual energy value'}. These are two what-if assumptions, not statistical bounds.</p>`}
    <p><strong>Modeled installed cash price:</strong> ${solarCost===null?'Not entered':money(solarCost)}. Basis: ${priceBasis}</p>
    <p><strong>Simple pre-incentive cash payback:</strong> ${payback===null?'Not calculated — requires a complete energy-value model and installed price':payback.toFixed(1)+' years'}</p>
    <p><strong>Assumptions:</strong> ${selfUseShare===null?'Direct-use share not entered':`${Math.round(selfUseShare*100)}% of generation used directly`}; ${importRate===null?(selfConsumed!==null&&selfConsumed<0.01?'marginal import rate not needed because modeled direct use is zero':'marginal import rate not entered'):`${rateMoney(importRate)}/kWh marginal import rate`}; ${exportRate===null?'export compensation unknown':`${rateMoney(exportRate)}/kWh export compensation`}; ${whole(annualUse)} kWh annual consumption. No fixed utility charges are removed.</p>`;
});
