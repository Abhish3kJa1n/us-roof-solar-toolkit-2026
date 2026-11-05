const roofMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const roofRateMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const materialEl=document.getElementById('material'),metalSystemField=document.getElementById('metalSystemField'),metalSystemEl=document.getElementById('metalSystem'),areaEl=document.getElementById('area'),lowEl=document.getElementById('low'),highEl=document.getElementById('high'),resultEl=document.getElementById('result');
const referenceButton=document.getElementById('loadReference'),referenceStatus=document.getElementById('referenceStatus');
const metalReferences={
  corrugated:{low:'5',high:'12',label:'corrugated sheet metal',source:'HomeGuide metal roof cost guide (November 21, 2025)'},
  standing_seam:{low:'9',high:'16',label:'standing seam',source:'HomeGuide metal roof cost guide (November 21, 2025)'},
  metal_shingles:{low:'6',high:'14',label:'metal shingles',source:'HomeGuide metal roof cost guide (November 21, 2025)'},
  steel:{low:'5',high:'13',label:'galvanized / Galvalume steel',source:'HomeGuide metal roof cost guide (November 21, 2025)'}
};
let rateBasis='Visitor-entered rates; source not asserted.';
const customRateEdit=()=>{if(rateBasis.startsWith('Angi')||rateBasis.startsWith('HomeGuide')){rateBasis='Visitor-edited rates after loading a published reference.';referenceStatus.textContent='You edited at least one rate. The calculation now uses your custom values, not the original publisher range.';}};
function clearLoadedReference(){
  if(!rateBasis.startsWith('Angi')&&!rateBasis.startsWith('HomeGuide')) return;
  lowEl.value='';highEl.value='';rateBasis='Visitor-entered rates; source not asserted.';
  referenceStatus.hidden=true;referenceStatus.textContent='';
}
function setReference(low,high,basis,message){
  lowEl.value=low;highEl.value=high;rateBasis=basis;
  referenceStatus.hidden=false;referenceStatus.textContent=message;
}
function applyNationalReference(force=false){
  if(rateBasis.startsWith('Visitor-edited') || (!force && (lowEl.value.trim()!=='' || highEl.value.trim()!==''))) return;
  setReference('4','11',
    'Angi national published reference range (article updated October 22, 2026), not local or material-specific.',
    'Prefilled Angi’s broad national $4–$11 per roof sq ft reference. This is not a city estimate, material-specific quote or project prediction. Both rates are editable; replace them with comparable local proposals.');
}
function applyMetalReference(force=false){
  if(rateBasis.startsWith('Visitor-edited') || (!force && (lowEl.value.trim()!=='' || highEl.value.trim()!==''))) return;
  const ref=metalReferences[metalSystemEl.value];
  if(!ref){
    clearLoadedReference();
    referenceStatus.hidden=false;
    referenceStatus.textContent='The broad general-roofing reference was cleared because Metal is selected. Choose the exact metal system to prefill its published range, or enter your own comparable rates.';
    return;
  }
  setReference(ref.low,ref.high,
    `HomeGuide published installed range for ${ref.label} (${ref.source}); not local or property-specific.`,
    `Prefilled HomeGuide’s ${ref.label} range of $${ref.low}–$${ref.high} per roof sq ft (${ref.source}). This is a broad publisher estimate, not a local quote or guarantee. Both rates are editable.`);
}
function updateReferenceControls(){
  const isMetal=materialEl.value==='metal';
  metalSystemField.hidden=!isMetal;
  if(isMetal){
    const ref=metalReferences[metalSystemEl.value];
    referenceButton.disabled=!ref;
    referenceButton.textContent=ref?`Reload ${ref.label} reference ($${ref.low}–$${ref.high} / sq ft)`:'Choose a metal system to load its reference';
  }else{
    referenceButton.disabled=false;
    referenceButton.textContent='Load broad national reference ($4–$11 / sq ft)';
  }
}
lowEl.addEventListener('input',customRateEdit);highEl.addEventListener('input',customRateEdit);
materialEl.addEventListener('change',()=>{
  clearLoadedReference();
  updateReferenceControls();
  if(materialEl.value==='metal') applyMetalReference();
});
metalSystemEl.addEventListener('change',()=>{
  clearLoadedReference();
  updateReferenceControls();
  if(materialEl.value==='metal') applyMetalReference();
});
updateReferenceControls();
if(materialEl.value==='metal') applyMetalReference();
referenceButton.addEventListener('click',()=>{
  if(materialEl.value==='metal'){
    const ref=metalReferences[metalSystemEl.value];
    if(!ref){referenceStatus.hidden=false;referenceStatus.textContent='Choose a metal system first. You can also enter your own comparable written-quote rates.';return;}
    applyMetalReference(true);
    return;
  }
  applyNationalReference(true);
});
document.getElementById('run').addEventListener('click',()=>{const area=Number(areaEl.value),low=Number(lowEl.value),high=Number(highEl.value);if(!(Number.isFinite(area)&&area>=100&&area<=100000&&Number.isFinite(low)&&low>=0.1&&low<=100&&Number.isFinite(high)&&high>=low&&high<=100)){resultEl.innerHTML='<div class="big">Check inputs</div><p>Enter an area of 100–100,000 sq ft, a low installed rate of $0.10–$100 per sq ft, and a high rate at least as large as the low rate.</p>';return;}const totalLow=area*low,totalHigh=area*high;const systemLabel=materialEl.value==='metal'&&metalSystemEl.value?` · Metal system: ${metalSystemEl.selectedOptions[0].textContent}`:'';resultEl.innerHTML=`<div class="kicker">Illustrative roof replacement range</div><div class="big">${roofMoney(totalLow)} – ${roofMoney(totalHigh)}</div><p>${area.toLocaleString('en-US')} sq ft × ${roofRateMoney(low)}–${roofRateMoney(high)} installed per sq ft. Material label: ${materialEl.value ? materialEl.selectedOptions[0].textContent : 'not specified'}${systemLabel}.</p><p>Rate basis: ${rateBasis} It does not verify local labor, material, roof complexity or proposal scope.</p>`;});
document.getElementById('reset').addEventListener('click',()=>{areaEl.value='';materialEl.value='';metalSystemEl.value='';lowEl.value='';highEl.value='';rateBasis='Visitor-entered rates; source not asserted.';referenceStatus.hidden=true;referenceStatus.textContent='';resultEl.innerHTML='<div class="kicker">Estimated range</div><div class="big">Ready to calculate</div><p>Enter comparable low and high installed rates, or deliberately load a published reference, then calculate.</p>';updateReferenceControls();});
