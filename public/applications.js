import {normalizePlan} from '/workspace.mjs';
import {FEEDBACK_REASONS,feedbackAdvice,normalizeFeedback,normalizeDrafts} from '/application-tools.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
export function createApplicationTools({current,getProfile,context,commit,api,toast,applyFilters,editFilters,onAiChange}){
 let running=null;const cvChoices=new Map();
 const visible=(owner,id)=>current().id===owner&&context().owner===owner&&context().job?.id===id;
 const replaceEntry=(map,id,value)=>({...Object.fromEntries(Object.entries(map||{}).filter(([key])=>key!==id)),[id]:value});
 function feedbackHTML(job){
  const recorded=current().feedback[job.id],reason=recorded?.reason||'',advice=reason?feedbackAdvice(reason,current().preferences):null;
  const labels={remoteScope:'Remote eligibility: explicit country / worldwide leads',experienceMode:'Experience check: hide higher requirements',level:'Experience level: Intern / Junior'};
  return `<section id="poor-match" class="application-panel"><span class="method-label method-manual">YOUR FEEDBACK · NO AI</span><h3>Not the right match?</h3><p>Tell JobScout why. Feedback stays in this profile; it does not train the model or silently hide jobs.</p><label>What is wrong?<select id="match-reason"><option value="">Choose a reason</option>${Object.entries(FEEDBACK_REASONS).map(([key,label])=>`<option value="${key}" ${reason===key?'selected':''}>${label}</option>`).join('')}</select></label>${advice?`<div role="status"><p>${esc(advice.explanation)}</p>${Object.keys(advice.patch).length?`<p><strong>Suggested changes:</strong></p><ul>${Object.keys(advice.patch).map(key=>`<li>${labels[key]}</li>`).join('')}</ul><button id="apply-match-advice" class="secondary">Apply these filters & search</button>`:'<p>No automatic change is suggested. Review your role, country and experience preferences.</p><button id="edit-match-filters" class="secondary">Edit search filters</button>'}<button id="clear-match-feedback" class="text-button">Clear feedback</button><p class="small muted">Clearing feedback does not undo filters you already applied.</p></div>`:''}</section>`;
 }
 function bindFeedback(job){
  $('#match-reason').onchange=()=>{
   const reason=$('#match-reason').value,owner=current().id;
   const next={...current().feedback};delete next[job.id];if(reason)next[job.id]={reason,createdAt:new Date().toISOString()};
   if(!commit({feedback:normalizeFeedback(next)},owner))return;
   $('#poor-match').outerHTML=feedbackHTML(job);bindFeedback(job);
  };
  if($('#clear-match-feedback'))$('#clear-match-feedback').onclick=()=>{$('#match-reason').value='';$('#match-reason').dispatchEvent(new Event('change'));};
  if($('#apply-match-advice'))$('#apply-match-advice').onclick=()=>applyFilters(feedbackAdvice(current().feedback[job.id].reason,current().preferences).patch);
  if($('#edit-match-filters'))$('#edit-match-filters').onclick=editFilters;
 }
 function draftHTML(job){
  const d=current().drafts[job.id],mine=running?.owner===current().id&&running.id===job.id,includeCv=cvChoices.get(current().id+':'+job.id)??d?.cvUsed??false;
  return `<section id="application-draft-panel" class="application-panel"><span class="method-label method-ai">LOCAL AI · DRAFT ONLY</span><h3>Prepare your application</h3><p>Create a cover letter and suggestions for tailoring your CV. Nothing is sent to the employer. Creating a draft also saves this job to My applications so you can find it later.</p><p class="notice">AI can make mistakes. Check every claim, replace placeholders and review the original listing before using a draft. Source quotations do not prove every sentence is accurate.</p><label class="draft-cv-choice"><input id="draft-use-cv" type="checkbox" ${current().cv.text?(includeCv?'checked':''):'disabled'}> Include my saved CV ${current().cv.text?'':'(no CV saved)'}</label><p class="small muted">Uses this job description plus your profile skills and background. Including your CV sends its text only to your local Ollama model.</p><div class="draft-actions"><button id="generate-application" class="primary" ${running?'disabled':''}>${mine?'Writing draft…':d?'Generate a replacement':'Create application draft'}</button>${mine?'<button id="cancel-application" class="secondary">Cancel</button>':''}</div><p id="application-message" role="status" class="small muted">${mine?'You can keep browsing. First model startup may take a few minutes.':d?'Saved locally. Generating a replacement requires confirmation.':'Add skills or background in Settings, or include a CV. Ollama must be running.'}</p>${d?`<div class="draft-output"><p class="small muted">Created ${esc(new Date(d.createdAt).toLocaleString())} · ${esc(d.model)} · ${d.cvUsed?'CV included':'Profile context only'}</p><p class="small">This is a snapshot. Review or regenerate after changing your profile, CV or the job description.</p><label>Cover letter - save edits before closing<textarea id="application-letter" rows="14" maxlength="8000" ${mine?'readonly':''}>${esc(d.coverLetter)}</textarea></label><div class="draft-actions"><button id="save-application-edit" class="secondary" ${mine?'disabled':''}>Save edits</button><button id="copy-application" class="secondary">Copy letter</button><button id="download-application" class="secondary">Download letter</button><button id="delete-application" class="text-button" ${mine?'disabled':''}>Delete draft</button></div><h4>CV improvement suggestions</h4><ul>${d.cvSuggestions.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>No suggestions supplied.</li>'}</ul><h4>Questions to resolve</h4><ul>${d.questions.map(x=>`<li>${esc(x)}</li>`).join('')||'<li>Verify all claims and remove placeholders before sending.</li>'}</ul><details><summary>Candidate evidence used</summary><p class="small">Exact quotations checked against the supplied candidate context. They are not independently verified qualifications.</p><ul>${d.evidence.map(e=>`<li><strong>${esc(e.source)}:</strong> “${esc(e.quote)}”</li>`).join('')}</ul></details></div>`:''}</section>`;
 }
 function refresh(job,owner){if(visible(owner,job.id)&&$('#application-draft-panel')){$('#application-draft-panel').outerHTML=draftHTML(job);bindDraft(job);}}
 function bindDraft(job){
  const owner=current().id;
  $('#draft-use-cv').onchange=()=>cvChoices.set(owner+':'+job.id,$('#draft-use-cv').checked);
  $('#generate-application').onclick=async()=>{
   if(running)return;
   if(!current().drafts[job.id]&&Object.keys(current().drafts).length>=50){toast('You have 50 saved drafts. Delete an older draft before creating another.');return;}
   if(current().drafts[job.id]&&!confirm('Replace the existing draft and any unsaved edits after generation succeeds?'))return;
   const includeCv=$('#draft-use-cv').checked,profile={...current().preferences},cv=includeCv?{...current().cv}:undefined;
   const task={owner,id:job.id,controller:new AbortController()};running=task;refresh(job,owner);onAiChange();let message='';
   try{
    const {draft}=await api('/api/application/draft',{job:Object.fromEntries(['title','company','location','description'].map(k=>[k,job[k]])),profile,includeCv,cv},task.controller.signal);
    task.controller.signal.throwIfAborted();const target=getProfile(owner);
    if(target){const drafts=normalizeDrafts(replaceEntry(target.drafts,job.id,{...draft,url:job.url}));const saved=target.saved[job.id]?target.saved:{...target.saved,[job.id]:{job:Object.fromEntries(['id','title','company','location','description','url','source','remote','work','date','dateLabel','salary','tags','sourceLinks','descriptionBlocks','manual','expiresAt','fetchedAt'].filter(k=>job[k]!==undefined).map(k=>[k,job[k]])),...normalizePlan(),stage:'Saved',notes:'',savedAt:new Date().toISOString()}};if(!commit({drafts,saved},owner))throw Error('Draft could not be saved. Free browser storage and retry.');message='Draft saved. Review every claim before using it.';}
   }catch(error){message=task.controller.signal.aborted?'Draft cancelled. Any previous saved draft is unchanged.':error.message;}
   finally{if(running===task)running=null;refresh(job,owner);if(visible(owner,job.id)&&$('#application-message'))$('#application-message').textContent=message;onAiChange();}
  };
  if($('#cancel-application'))$('#cancel-application').onclick=()=>running?.controller.abort();
  if($('#save-application-edit'))$('#save-application-edit').onclick=()=>{if(!visible(owner,job.id))return;const draft={...current().drafts[job.id],coverLetter:$('#application-letter').value,editedAt:new Date().toISOString()};if(commit({drafts:normalizeDrafts(replaceEntry(current().drafts,job.id,draft))},owner))toast('Draft edits saved.');};
  if($('#copy-application'))$('#copy-application').onclick=async()=>{try{await navigator.clipboard.writeText($('#application-letter').value);toast('Letter copied. Review it before sending.');}catch{$('#application-letter').select();toast('Select and copy the letter manually.');}};
  if($('#download-application'))$('#download-application').onclick=()=>{const url=URL.createObjectURL(new Blob([$('#application-letter').value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='JobScout-application-draft.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  if($('#delete-application'))$('#delete-application').onclick=()=>{if(!confirm('Delete this saved draft?'))return;const drafts={...current().drafts};delete drafts[job.id];if(commit({drafts},owner))refresh(job,owner);};
 }
 return {feedbackHTML,draftHTML,bind(job){bindFeedback(job);bindDraft(job);},cancel(){running?.controller.abort();}};
}
