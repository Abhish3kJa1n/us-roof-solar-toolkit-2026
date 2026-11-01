const stateSearch=document.getElementById('stateSearch');
const stateRows=[...document.querySelectorAll('#stateTable tbody tr')];
const rowCount=document.getElementById('rowCount');
stateSearch.addEventListener('input',()=>{
 const q=stateSearch.value.trim().toLowerCase();let visible=0;
 for(const row of stateRows){const match=row.dataset.state.includes(q);row.hidden=!match;if(match)visible++;}
 rowCount.textContent=`Showing ${visible} of ${stateRows.length} areas.`;
});
