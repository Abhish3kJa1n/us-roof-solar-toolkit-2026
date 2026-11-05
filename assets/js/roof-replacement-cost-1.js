const roofMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const roofRateMoney=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const materialEl=document.getElementById('material');
const metalSystemField=document.getElementById('metalSystemField');
const metalSystemEl=document.getElementById('metalSystem');
const areaEl=document.getElementById('area');
const lowEl=document.getElementById('low');
const highEl=document.getElementById('high');
const resultEl=document.getElementById('result');
const referenceButton=document.getElementById('loadReference');
const referenceStatus=document.getElementById('referenceStatus');

const nationalReference={
  type:'national',
  key:'angi-national',
  label:'broad national Angi roof-replacement reference',
  low:'4',
  high:'11',
  source:'Angi national roof-replacement cost guide (updated October 22, 2026)',
  basis:'Angi broad national $4–$11 per roof sq ft reference (updated October 22, 2026); not local, material-specific or property-specific.'
};
const metalReferences={
  corrugated:{type:'metal',key:'corrugated',low:'5',high:'12',label:'corrugated sheet metal',source:'HomeGuide metal roof cost guide (November 21, 2025)'},
  standing_seam:{type:'metal',key:'standing_seam',low:'9',high:'16',label:'standing seam',source:'HomeGuide metal roof cost guide (November 21, 2025)'},
  metal_shingles:{type:'metal',key:'metal_shingles',low:'6',high:'14',label:'metal shingles',source:'HomeGuide metal roof cost guide (November 21, 2025)'},
  steel:{type:'metal',key:'steel',low:'5',high:'13',label:'galvanized / Galvalume steel',source:'HomeGuide metal roof cost guide (November 21, 2025)'}
};

let activeReference=null;
let carriedReference=null;
let editedEndpoints=new Set();
let manualRatesEntered=false;
let customNotice='';
let previousMaterial=materialEl.value;
let previousMetalSystem=metalSystemEl.value;

const hasAnyRate=()=>lowEl.value.trim()!==''||highEl.value.trim()!=='';
const referenceBasis=reference=>reference.basis||(reference.type==='metal'?'HomeGuide published installed range for '+reference.label+' ('+reference.source+'); not local or property-specific.':(reference.source||'Publisher reference; not local or property-specific.'));
const setStatus=message=>{
  referenceStatus.textContent=message||'';
  referenceStatus.hidden=!message;
};
const clearRateState=()=>{
  activeReference=null;
  carriedReference=null;
  editedEndpoints.clear();
  manualRatesEntered=false;
  customNotice='';
};
const endpointDescription=(name,reference)=>{
  const value=name==='low'?lowEl.value:highEl.value;
  if(editedEndpoints.has(name)) return name+' endpoint was edited by the visitor to '+(value===''?'blank':'$'+value);
  return name+' endpoint remains '+(value===''?'blank':'$'+value)+' from '+reference.label;
};
const carriedNotice=(nextLabel)=>{
  if(!carriedReference) return customNotice;
  return 'Your rate values were retained after changing from '+carriedReference.label+' to '+nextLabel+'. '+endpointDescription('low',carriedReference)+'; '+endpointDescription('high',carriedReference)+'. These values are not a published range for '+nextLabel+'. Original source: '+referenceBasis(carriedReference)+' Click the reload button to replace both values with the selected system reference, or edit both rates to match your written proposal.';
};
const rateBasis=()=>{
  if(activeReference){
    if(editedEndpoints.size===0) return activeReference.basis;
    return 'Mixed/custom rate pair. '+endpointDescription('low',activeReference)+'; '+endpointDescription('high',activeReference)+'. This is no longer the publisher’s complete published interval. Original reference: '+referenceBasis(activeReference);
  }
  if(carriedReference) return carriedNotice(materialEl.value==='metal'&&metalReferences[metalSystemEl.value]?metalReferences[metalSystemEl.value].label:'the selected material');
  if(customNotice) return customNotice;
  return 'Visitor-entered rates; source not asserted.';
};
const setReference=(reference,message)=>{
  reference.basis=referenceBasis(reference);
  lowEl.value=reference.low;
  highEl.value=reference.high;
  activeReference=reference;
  carriedReference=null;
  editedEndpoints.clear();
  manualRatesEntered=false;
  customNotice='';
  setStatus(message);
};
const clearReferenceValues=(message)=>{
  lowEl.value='';
  highEl.value='';
  clearRateState();
  setStatus(message);
};

function updateReferenceControls(){
  const isMetal=materialEl.value==='metal';
  metalSystemField.hidden=!isMetal;
  if(isMetal){
    const ref=metalReferences[metalSystemEl.value];
    referenceButton.disabled=!ref;
    referenceButton.textContent=ref
      ?'Reload '+ref.label+' reference ($'+ref.low+'–$'+ref.high+' / sq ft)'
      :'Choose a metal system to load its reference';
  }else{
    referenceButton.disabled=false;
    referenceButton.textContent='Load broad national reference ($4–$11 / sq ft)';
  }
}

function applyNationalReference(force=false){
  if(!force&&(hasAnyRate()||activeReference||carriedReference||manualRatesEntered)) return;
  setReference(nationalReference,
    'Loaded Angi’s broad national $4–$11 per roof sq ft reference. It is not a local or material-specific price. Both endpoints are editable; changing one makes the pair mixed/custom. Reload to restore this published range.');
}
function applyMetalReference(force=false){
  const ref=metalReferences[metalSystemEl.value];
  if(!ref) return;
  if(!force&&(hasAnyRate()||activeReference||carriedReference||manualRatesEntered)) return;
  setReference(ref,
    'Loaded HomeGuide’s '+ref.label+' range of $'+ref.low+'–$'+ref.high+' per roof sq ft ('+ref.source+'). This is a broad publisher estimate, not a local quote or guarantee. Both endpoints are editable; changing one makes the pair mixed/custom.');
}

function handleRateEdit(endpoint){
  if(lowEl.value.trim()===''&&highEl.value.trim()===''){
    clearRateState();
    setStatus('Both rate fields are blank. Enter comparable rates or deliberately load a published reference.');
    return;
  }
  if(activeReference){
    editedEndpoints.add(endpoint);
    const other=endpoint==='low'?'high':'low';
    setStatus('You edited the '+endpoint+' rate. The '+other+' endpoint remains from the original '+activeReference.label+' reference. The pair is now mixed/custom, not the published range. Click Reload to restore the complete reference.');
    return;
  }
  if(carriedReference){
    editedEndpoints.add(endpoint);
    const nextLabel=materialEl.value==='metal'&&metalReferences[metalSystemEl.value]?metalReferences[metalSystemEl.value].label:'the selected material';
    setStatus(carriedNotice(nextLabel));
    return;
  }
  manualRatesEntered=true;
  customNotice='These are visitor-entered rates; the site does not source or verify them. Confirm both endpoints match the selected material/system and the written project scope.';
  setStatus(customNotice);
}

function handleMaterialChange(){
  const nextMaterial=materialEl.value;
  if(nextMaterial===previousMaterial) return;
  const oldMaterial=previousMaterial||'unspecified material';
  previousMaterial=nextMaterial;
  metalSystemEl.value='';
  previousMetalSystem='';
  const oldReference=activeReference||carriedReference;
  if(oldReference){
    clearReferenceValues('The '+oldReference.label+' rates were cleared because the roof material changed from '+oldMaterial+' to '+(nextMaterial||'unspecified material')+'. Choose the exact metal system if applicable, or enter rates for the newly selected material.');
  }else if(hasAnyRate()){
    manualRatesEntered=true;
    customNotice='Visitor-entered rates were retained after changing the material from '+oldMaterial+' to '+(nextMaterial||'unspecified material')+'. Verify that both rates match the newly selected material and project scope; they are not a published reference.';
    setStatus(customNotice);
  }else{
    clearRateState();
    setStatus('');
  }
  updateReferenceControls();
}

function handleMetalSystemChange(){
  const nextKey=metalSystemEl.value;
  if(nextKey===previousMetalSystem) return;
  previousMetalSystem=nextKey;
  updateReferenceControls();
  if(materialEl.value!=='metal') return;
  const nextReference=metalReferences[nextKey];
  if(!nextReference){
    if(activeReference||carriedReference){
      const oldReference=activeReference||carriedReference;
      clearReferenceValues('The '+oldReference.label+' reference was cleared because no metal system is selected. Choose a system to load its matching reference.');
    }
    return;
  }
  if(activeReference&&activeReference.type==='metal'&&editedEndpoints.size===0){
    setReference(nextReference,
      'Metal system changed. Loaded HomeGuide’s '+nextReference.label+' range of $'+nextReference.low+'–$'+nextReference.high+' per roof sq ft ('+nextReference.source+').');
    return;
  }
  if(activeReference&&editedEndpoints.size>0){
    carriedReference=activeReference;
    activeReference=null;
    manualRatesEntered=false;
    setStatus(carriedNotice(nextReference.label));
    return;
  }
  if(carriedReference){
    setStatus(carriedNotice(nextReference.label));
    return;
  }
  if(hasAnyRate()||manualRatesEntered){
    manualRatesEntered=true;
    customNotice='Your visitor-entered rates were retained after changing the metal system to '+nextReference.label+'. They are not a published reference for the new system. Verify both values or click Reload to apply its HomeGuide reference.';
    setStatus(customNotice);
    return;
  }
  applyMetalReference(true);
}

lowEl.addEventListener('input',()=>handleRateEdit('low'));
highEl.addEventListener('input',()=>handleRateEdit('high'));
materialEl.addEventListener('change',handleMaterialChange);
metalSystemEl.addEventListener('change',handleMetalSystemChange);
referenceButton.addEventListener('click',()=>{
  if(materialEl.value==='metal'){
    const ref=metalReferences[metalSystemEl.value];
    if(!ref){
      setStatus('Choose an exact metal system before loading a metal price reference.');
      return;
    }
    applyMetalReference(true);
    return;
  }
  applyNationalReference(true);
});
document.getElementById('run').addEventListener('click',()=>{
  const area=Number(areaEl.value);
  const low=Number(lowEl.value);
  const high=Number(highEl.value);
  if(!(Number.isFinite(area)&&area>=100&&area<=100000&&Number.isFinite(low)&&low>=0.1&&low<=100&&Number.isFinite(high)&&high>=low&&high<=100)){
    resultEl.innerHTML='<div class="big">Check inputs</div><p>Enter an area of 100–100,000 sq ft, a low installed rate of $0.10–$100 per sq ft, and a high rate at least as large as the low rate.</p>';
    return;
  }
  const totalLow=area*low,totalHigh=area*high;
  const materialLabel=materialEl.value?materialEl.selectedOptions[0].textContent:'not specified';
  const systemLabel=materialEl.value==='metal'&&metalSystemEl.value?' · Metal system: '+metalSystemEl.selectedOptions[0].textContent:'';
  resultEl.innerHTML='<div class="kicker">Illustrative roof replacement range</div><div class="big">'+roofMoney(totalLow)+' – '+roofMoney(totalHigh)+'</div><p>'+area.toLocaleString('en-US')+' sq ft × '+roofRateMoney(low)+'–'+roofRateMoney(high)+' installed per sq ft. Material label: '+materialLabel+systemLabel+'.</p><p>Rate basis: '+rateBasis()+' It does not verify local labor, material, roof complexity or proposal scope.</p>';
});
document.getElementById('reset').addEventListener('click',()=>{
  areaEl.value='';
  lowEl.value='';
  highEl.value='';
  materialEl.value='';
  metalSystemEl.value='';
  previousMaterial='';
  previousMetalSystem='';
  clearRateState();
  setStatus('');
  resultEl.innerHTML='<div class="kicker">Estimated range</div><div class="big">Ready to calculate</div><p>Enter comparable low and high installed rates, or deliberately load a published reference, then calculate.</p>';
  updateReferenceControls();
});
updateReferenceControls();
if(materialEl.value==='metal'&&metalSystemEl.value) applyMetalReference();
