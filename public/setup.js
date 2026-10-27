import {countries,countryInfo,countryCoverage} from '/countries.mjs';
const $=selector=>document.querySelector(selector);
const option=(value,label)=>{const node=document.createElement('option');node.value=value;node.textContent=label;return node;};
export function createSetup({current,api,onSave}){
 let step=0,owner=null,token=0,catalog=[],connection=null,testing=false;
 const dialog=$('#setup-dialog'),form=$('#setup-form');
 $('#setup-country').replaceChildren(option('','Choose a country…'),...countries.map(c=>option(c.code,c.name)));
 for(const key of ['role','level'])$('#setup-'+key).innerHTML=$('#preferences').elements.namedItem(key).innerHTML;
 function preview(){
  const value=form.elements.country.value,c=value?countryInfo(value):null;
  $('#setup-preview-country').textContent=c?.name||'Choose a country';
  const area=form.elements.area;area.options[0].textContent=(c?.name||'Country')+' + remote';area.options[1].textContent=(c?.name||'Country')+' only';
  $('#setup-preview-area').textContent=value?area.selectedOptions[0].textContent:'Location comes first.';
  $('#setup-preview-coverage').textContent=c?countryCoverage(c.code):'Country-specific coverage will appear here.';
  $('#setup-cities').replaceChildren(...(c?.cities||[]).map(city=>option(city,city)));
  const recommended=c?.code==='CY'?catalog.map(s=>s.name):['Remotive','Jobicy','Himalayas','Remote OK'];
  $('#setup-source-detail').textContent=c?(c.code==='CY'?'All available feeds, including Cyprus employers.':recommended.join(', ')+'.'):'Set up sources for this country.';
 }
 function move(next,check=true){
  if(check&&next>step&&!validStep())return;
  step=next;document.querySelectorAll('[data-setup-panel]').forEach((node,i)=>node.hidden=i!==step);
  document.querySelectorAll('[data-setup-step]').forEach((node,i)=>{node.classList.toggle('selected',i===step);if(i===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
  $('#setup-back').disabled=step===0;$('#setup-next').textContent=step===2?'Save setup & search ↗':'Continue →';$('#setup-step-count').textContent='Step '+(step+1)+' of 3';$('#setup-message').textContent='';
  dialog.scrollTop=0;document.querySelector('[data-setup-panel="'+step+'"] h3').setAttribute('tabindex','-1');document.querySelector('[data-setup-panel="'+step+'"] h3').focus({preventScroll:true});
 }
 function validStep(){if(!form.elements.country.value){move(0,false);form.elements.country.reportValidity();return false;}if(!form.elements.years.validity.valid){if(step!==1)move(1,false);form.elements.years.reportValidity();return false;}return true;}
 function modelUI(keep){
  const models=connection?.models||[],select=$('#setup-model');select.replaceChildren(option('','Server default · '+(connection?.model||'qwen3:4b')),...models.map(m=>option(m.name,m.name+' · '+(m.size/1e9).toFixed(1)+' GB')));
  if(keep&&!models.some(m=>m.name===keep))select.append(option(keep,keep+' · not detected'));
  select.value=keep||'';
  $('#setup-ai-state').textContent=connection?.online?'Ollama detected':'Ollama is offline';
  $('#setup-ai-note').textContent=connection?.online?models.length+' downloaded local model'+(models.length===1?'':'s')+' detected. Test your choice before a review.':'Open Ollama, then refresh. You can finish setup and search without AI.';
  $('#setup-test').disabled=!connection?.online||!models.length||testing||connection.busy;
 }
 async function refresh(){const mine=token;$('#setup-refresh').disabled=true;$('#setup-ai-state').textContent='Checking Ollama…';try{const d=await api('/api/status');if(mine!==token)return;connection=d;modelUI($('#setup-model').value);}catch{if(mine===token){connection=null;modelUI($('#setup-model').value);$('#setup-ai-note').textContent='Could not reach JobScout. Check the local server and retry.';}}finally{if(mine===token)$('#setup-refresh').disabled=false;}}
 async function open(){
  token++;owner=current().id;const p=current();catalog=[];connection=null;testing=false;
  $('#setup-profile').textContent=p.name+' · '+(p.setupComplete?'Update your preferences in one place.':'Three short steps. Everything can be changed later.');
  for(const key of ['country','area','city','role','level','years','skills','background'])form.elements[key].value=p.preferences[key]||'';
  if(!p.setupComplete)form.elements.country.value='';if(form.elements.city.value==='Any city')form.elements.city.value='';
  $('#setup-model').replaceChildren(option('', 'Use server default'));if(p.preferences.model)$('#setup-model').append(option(p.preferences.model,p.preferences.model));$('#setup-model').value=p.preferences.model||'';
  $('#setup-sources').checked=!p.setupComplete;$('#setup-test-result').textContent='The test sends a small sample prompt. It does not use your CV.';
  step=0;preview();move(0);dialog.showModal();$('#setup-country').focus();refresh();
  const mine=token;try{const data=await api('/api/sources');if(mine===token){catalog=data.sources;preview();}}catch{/* Saving existing sources remains available. */}
 }
 $('#setup-country').onchange=()=>{form.elements.city.value='';preview();};$('#setup-area').onchange=preview;
 document.querySelectorAll('[data-setup-step]').forEach(button=>button.onclick=()=>move(Number(button.dataset.setupStep)));
 $('#setup-back').onclick=()=>move(step-1);$('#setup-refresh').onclick=refresh;
 $('#setup-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{token++;});
 $('#setup-model').onchange=()=>{$('#setup-test-result').textContent='Model changed. Test it before starting a review.';};
 $('#setup-test').onclick=async()=>{const mine=token,model=$('#setup-model').value;testing=true;$('#setup-test').disabled=true;$('#setup-test-result').textContent='Testing a small local response… First startup can take a minute.';try{const result=await api('/api/ai/test',{model});if(mine===token)$('#setup-test-result').textContent='✓ '+result.model+' responded in '+result.seconds+' seconds. Local AI is ready.';}catch(error){if(mine===token)$('#setup-test-result').textContent=error.message;}finally{if(mine===token){testing=false;refresh();}}};
 $('#setup-next').onclick=async()=>{
  if(!validStep())return;if(step<2){move(step+1);return;}
  const button=$('#setup-next'),mine=token;button.disabled=true;
  try{let enabledSources;if($('#setup-sources').checked){const data=await api('/api/sources?country='+encodeURIComponent(form.elements.country.value));enabledSources=data.recommended;if(!Array.isArray(enabledSources)||!enabledSources.length)throw Error('Recommended sources are unavailable. Retry or keep your current sources.');}
   if(mine!==token||owner!==current().id)return;
   const preferences=Object.fromEntries(new FormData(form));preferences.city=preferences.city.trim()||'Any city';
   const saved=onSave({preferences,...(enabledSources?{enabledSources}:{})},owner);if(saved)dialog.close();
  }catch(error){if(mine===token)$('#setup-message').textContent=error.message;}finally{button.disabled=false;}
 };
 form.onsubmit=event=>{event.preventDefault();$('#setup-next').click();};
 return {open};
}
