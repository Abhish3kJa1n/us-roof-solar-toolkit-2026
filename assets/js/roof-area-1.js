const footprintEl=document.getElementById('footprint');
const roofPitchEl=document.getElementById('pitch');
const roofAreaResult=document.getElementById('result');

document.getElementById('run').addEventListener('click',()=>{
  const footprint=Number(footprintEl.value);
  const pitchFactor=Number(roofPitchEl.value);
  if(!(Number.isFinite(footprint)&&footprint>=100&&footprint<=50000&&Number.isFinite(pitchFactor)&&pitchFactor>1&&pitchFactor<=Math.SQRT2)){
    roofAreaResult.innerHTML='<div class="big">Check inputs</div><p>Enter a building footprint from 100 to 50,000 sq ft and choose a known roof pitch.</p>';
    return;
  }
  const estimatedArea=footprint*pitchFactor;
  roofAreaResult.innerHTML=`<div class="kicker">Estimated roof surface</div><div class="big">${Math.round(estimatedArea).toLocaleString('en-US')} sq ft</div><p>Building footprint: ${footprint.toLocaleString('en-US')} sq ft × pitch multiplier ${pitchFactor.toFixed(3)}. No complexity or material-waste allowance is added.</p>`;
});
