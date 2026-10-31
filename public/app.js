import {createApplicationTools} from '/applications.js';
import {normalizeDrafts,normalizeFeedback} from '/application-tools.mjs';
import {sourceHealth} from '/source-health.mjs';
import {normalizeSavedSearches,saveSearch} from '/saved-searches.mjs';
import {normalizeAvailability,recordAvailability,availabilityKey,freshnessFor} from '/freshness.mjs';
import {countryInfo,countryListed,countryCoverage,normalizeCountryPreferences} from '/countries.mjs';
import {createSetup} from '/setup.js';
import {normalizeWatchlist,addWebsite,recordWebsiteScan,websiteUrl,roleKey,MAX_WEBSITES,runWebsiteQueue} from '/watchlist.mjs';
import {sameVacancy,canonicalListingUrl} from '/duplicates.mjs';
import {jobKey,normalizeTracking,trackSearch,activityFor,setActivity,activityMatches,createManualJob,normalizeCv,normalizeEnabled,APPLICATION_STAGES,PRIORITIES,normalizePlan,localDay,followUpStatus,followUpCounts,filterApplications,applicationsCsv} from '/workspace.mjs';
import {cvSkills,compareCv} from '/candidate.mjs';
import {descriptionExcerpt, renderDescription} from '/description.mjs';
import { makeBackup, readBackup } from '/backup.mjs';
import { experienceSignals, locationSignals } from '/matching.mjs';
import { STAGES, filterResults, paginate, pipelineCounts,createJobEnricher } from '/view-model.mjs';

// The storage key stays the same so existing profiles survive the UI upgrade.
const STORAGE_KEY = 'jobscout-v1';
const UI_KEY = 'jobscout-ui';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scanStatus={complete:'Full scan',partial:'Limited scan',failed:'Could not read',cancelled:'Cancelled'};
const defaults = {
  country:'CY', model:'', role: 'Software developer', area: 'local_remote', city: 'Any city', level: 'Any level',
  work: 'Any', skills: '', query: '', remoteScope: 'likely', background: '', years: '', experienceMode: 'strict', juniorEvidence:'all'
};
const makeProfile = (name, id = crypto.randomUUID()) => ({id, name, setupComplete:false, preferences: {...defaults}, saved: {}, reviews: {}, availability:{}, tracking:normalizeTracking(), cv:normalizeCv(), enabledSources:null,websites:[],savedSearches:[],drafts:{},feedback:{}});
function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
let state = readStorage(STORAGE_KEY, null);
if (!state?.profiles?.length) state = {active: 'default', profiles: [makeProfile('My profile', 'default')]};
for (const profile of state.profiles) {
  profile.drafts=normalizeDrafts(profile.drafts);
  profile.feedback=normalizeFeedback(profile.feedback);
  profile.savedSearches=normalizeSavedSearches(profile.savedSearches);
  profile.tracking = normalizeTracking(profile.tracking);
  profile.cv = normalizeCv(profile.cv);
  profile.enabledSources = normalizeEnabled(profile.enabledSources);
  profile.websites = normalizeWatchlist(profile.websites);
  profile.availability=normalizeAvailability(profile.availability);
  profile.saved ||= {};
  for(const entry of Object.values(profile.saved))Object.assign(entry,normalizePlan(entry));
  profile.reviews ||= {};
  profile.preferences = normalizeCountryPreferences({...defaults, ...profile.preferences});
  profile.setupComplete ??= true;
}
if (!state.profiles.some(p => p.id === state.active)) state.active = state.profiles[0].id;
let ui = readStorage(UI_KEY, {theme:'dark',layout:'grid'});
if(ui.palette!=='mono-v1'){ui={...ui,theme:'dark',palette:'mono-v1'};persistUI();}
let jobs = [], sources = [], currentView = 'discover', selectedJob = null;
let availabilityRun=null;
let busy = false, searchDone = false, searchError = '', page = 1, stage = 'all', salaryOnly = false;
let requestId = 0, searchController, applied = {...state.profiles.find(p => p.id === state.active).preferences};
let aiConnection=null, aiReview=null, selectedJobOwner=null, guideReturnJob=null, detailTab='listing';
const aiFailures=new Map();
const enrichJob=createJobEnricher();
let resultRenderTimer,scanRenderTimer,lastRenderedDay='';
const siteWorkspaces=new Map();
let siteScanRun=null,siteBatchRun=null;
let comparisonJobs=new Map(), followUpFilter='all', plannerPriority='all', plannerOrder='default';
let sourcesOwner=null,sourceRecommendations=[];
let searchEdit=null, searchSaveOwner=null;
let toastTimer, activity='all', visiblePageJobs=[], sourceCatalog=[], editingManualId=null, cvOwner=null, cvFileName='', cvRequest=0, cvController;
const current = () => state.profiles.find(p => p.id === state.active);
const applications=createApplicationTools({current,getProfile:id=>state.profiles.find(p=>p.id===id),context:()=>({job:selectedJob,owner:selectedJobOwner}),commit:commitProfile,api,toast,onAiChange:()=>{counts();toolkit();status();},applyFilters:patch=>{if(commitProfile({preferences:{...current().preferences,...patch}})){profileUI();$('#job-dialog').close();search({scroll:true});}},editFilters:()=>{$('#job-dialog').close();openFilters();}});


function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { toast('Browser storage is unavailable or full. Export a backup before closing.'); }
}
function persistUI() {
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* Appearance is optional. */ }
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
function preferences() { return Object.fromEntries(new FormData($('#preferences'))); }
function savePreferences() {
  current().preferences = {...current().preferences,...preferences()};
  persist();
  $('#country-summary').textContent=countryInfo(current().preferences.country).name+' · '+current().preferences.role;
  const dirty = JSON.stringify(current().preferences) !== JSON.stringify(applied);
  $('#preferences-status').textContent = dirty && searchDone ? 'Preferences saved. Find opportunities to apply changes.' : 'Your preferences save automatically.';
  $('#preferences-status').classList.toggle('dirty', dirty && searchDone);
}
function profileUI() {
  current().preferences=normalizeCountryPreferences({...defaults,...current().preferences});
  const c=countryInfo(current().preferences.country),form=$('#preferences');
  form.elements.area.options[0].textContent=c.name+' + remote';form.elements.area.options[1].textContent=c.name+' only';
  form.elements.remoteScope.options[0].textContent=c.name+', worldwide & region leads';form.elements.remoteScope.options[1].textContent='Explicit '+c.name+' / worldwide leads';
  $('#country-cities').innerHTML=c.cities.map(city=>'<option value="'+esc(city)+'"></option>').join('');
  $('#country-summary').textContent=current().setupComplete?c.name+' · '+current().preferences.role:'Finish your search setup';
  $('#country-coverage').textContent=countryCoverage(c.code);
  $('#stat-country-label').textContent=c.name+' listed';

  $('#profiles').innerHTML = state.profiles.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  $('#profiles').value = current().id;
  $('#profile-initial').textContent = current().name.slice(0, 1).toUpperCase();
  for (const [key, value] of Object.entries({...defaults, ...current().preferences})) {
    const element = $('#preferences').elements.namedItem(key);
    if (element) element.value = value;
  }
  renderSavedSearches();
  counts();
  toolkit();
}
function counts() {
  const saved = current().saved;
  const counts = pipelineCounts(saved);
  const total = Object.keys(saved).length;
  $('#saved-count').textContent = total;
  $('#stat-saved').textContent = total;
  $('#pipeline-caption').textContent = `${counts.Applied} applied · ${counts.Interview} interview${counts.Interview === 1 ? '' : 's'}`;
  return counts;
}
async function api(url, data, signal) {
  const response = await fetch(url, data ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data), signal} : {signal});
  const value = await response.json();
  if (!response.ok) throw Error(value.error || `Request failed (${response.status})`);
  return value;
}
function safeLink(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; }
}
function dateLabel(job) {
  const date = new Date(job.date);
  return Number.isNaN(+date) ? 'Date unavailable' : `${job.dateLabel || 'Posted'} ${date.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}`;
}
function inSelectedCountry(job) { return countryListed(job.location,applied.country); }
function enrich(job){return enrichJob(job,current().cv,(currentView==='discover'?applied:current().preferences).country,currentView==='discover'?applied:current().preferences);}
function sourceBadges(job) {
  const links = job.sourceLinks || [{name:job.source, url:job.url}];
  return `${job.duplicateCount>1?'<p class="duplicate-note">'+job.duplicateCount+' matching listings combined · all sources below</p>':''}<div class="website-badges"><span>VIA</span>${links.map(s => `<a class="website-badge" href="${esc(safeLink(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ↗</a>`).join('')}</div>`;
}
const bookmark = saved => `<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M3 1.5h10a1.5 1.5 0 0 1 1.5 1.5v15L8 14l-6.5 4V3A1.5 1.5 0 0 1 3 1.5Z" fill="${saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"/></svg>`;
function card(raw) {
  const job = enrich(raw);
  const saved = current().saved[job.id];
  const reading = activityFor(current().tracking,job);
  const skillLabel = job.score === null || job.score === undefined ? 'Add skills for keyword overlap' : `<strong>${job.score}%</strong> search keyword overlap`;
  return `<article class="card">
    <div class="card-top"><div class="avatar" aria-hidden="true">${esc(job.company.slice(0,2).toUpperCase())}</div><div class="company" title="${esc(job.company)}">${esc(job.company)}</div><button class="save ${saved ? 'saved' : ''}" data-save="${esc(job.id)}" aria-label="${saved ? 'Remove saved job' : 'Save job'}" aria-pressed="${Boolean(saved)}" title="${saved ? 'Remove saved job' : 'Save job'}">${bookmark(saved)}<span>${saved?'Saved':'Save'}</span></button></div><h3>${esc(job.title)}</h3>
    <div class="card-reading"><span class="reading-badge ${reading.isNew?'fresh':''}">${reading.isNew?'New to you':reading.seen?'Seen':'Not opened'}</span>${currentView==='discover'?`${reading.seen&&!reading.hidden?`<button class="text-button" data-activity="unseen" data-id="${esc(job.id)}">Mark unseen</button>`:''}<button class="text-button" data-activity="${reading.hidden?'restore':'hide'}" data-id="${esc(job.id)}">${reading.hidden?'Restore job':'Hide job'}</button>`:''}</div>
    ${sourceBadges(job)}${freshnessHTML(job)}
    <p class="card-location" title="${esc(job.location)}"><span aria-hidden="true">◎</span>${esc(job.location || 'Location unspecified')}</p>
    <div class="tags"><span class="tag">${esc(job.work)}</span><span class="tag location">${esc(job.locationCheck.label)}</span><span class="tag evidence-${esc(job.experience.category)}">${esc(job.experience.levelLabel)}</span><span class="tag ${job.experienceAboveProfile ? 'warning-tag' : ''}">${esc(job.experience.label)}${job.experienceAboveProfile ? ' · above your years' : ''}</span></div>
    ${job.experience.preferredLabel?`<p class="preferred-note">${esc(job.experience.preferredLabel)}</p>`:''}
    ${job.salary ? `<p class="salary-line">${esc(job.salary)}</p>` : ''}
    ${matchHTML(job)}<p class="snippet">${esc(descriptionExcerpt(job))}</p>${current().cv.text?`<p class="cv-overlap">${job.cvMatch.total?`${job.cvMatch.count} of ${job.cvMatch.total} CV skills mentioned`:'No supported technical skills found in CV text'}</p>`:''}
    ${currentView==='saved'?planPreview(saved):''}
    ${currentView === 'saved' ? `<div class="card-stage"><label class="sr-only" for="stage-${esc(job.id)}">Application stage for ${esc(job.title)}</label><span>Application stage</span><select class="saved-stage" id="stage-${esc(job.id)}" data-stage="${esc(job.id)}">${STAGES.map(s => `<option ${saved?.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>` : ''}
    <div class="card-bottom">${job.score===null||job.score===undefined?'':`<div class="score" title="The percentage of skills from your last search that appear in this listing."><span class="method-label method-auto">TEXT MATCH</span>${skillLabel}</div>`}<div class="card-actions"><button data-open="${esc(job.id)}" class="read-job">Read listing ↗</button><button class="card-ai-button" data-review="${esc(job.id)}" title="Open this role’s AI review panel. The review starts when you choose Review fit with AI.">✦ AI review</button></div></div><div class="card-tail"><p class="card-date">${esc(dateLabel(job))}</p>${compareButton(job)}</div>
  </article>`;
}
function renderChips() {
  const values = [applied.role, countryInfo(applied.country).name+(applied.area==='local_remote'?' + remote':applied.area==='remote'?' · remote':''), applied.level !== 'Any level' ? applied.level : '', applied.work !== 'Any' ? applied.work : '', ...applied.skills.split(',').map(s => s.trim()).filter(Boolean).slice(0,3)].filter(Boolean);
  $('#active-filters').innerHTML = currentView === 'discover' && searchDone ? values.map(v => `<span class="applied-chip">${esc(v)}</span>`).join('') : '';
}
function emptyState() {
  const saved = currentView === 'saved';
  const filtered = $('#quick-search').value || $('#website').value !== 'all' || salaryOnly || stage !== 'all' || activity!=='all' || followUpFilter!=='all' || plannerPriority!=='all'||$('#freshness-filter').value!=='all';
  if(!saved&&searchDone&&current().enabledSources?.length===0)return '<div class="empty"><div class="empty-icon">◎</div><h3>Choose your sources.</h3><p>No job sources are enabled for this profile. Select the websites you want to search.</p><button class="secondary" id="choose-empty-sources">Choose sources</button></div>';
  return `<div class="empty"><div class="empty-icon" aria-hidden="true">${saved ? '▤' : '↗'}</div><h3>${searchError ? 'We could not load your search.' : filtered ? 'Nothing here with these filters.' : saved ? 'Your next steps start here.' : 'Let’s widen the possibilities.'}</h3><p>${searchError ? esc(searchError) : filtered ? activity==='new'?'New highlights listings first found after your initial search, until you open them. Check back after your next search.':activity==='hidden'?'Hidden listings matching this search appear here, with a Restore button.':'Clear the result filters to see more opportunities.' : saved ? 'Save a role from Discover to track applications and keep your notes in one place.' : 'Try fewer keywords, a broader location, or another experience level. Unknown requirements remain visible.'}</p><button class="secondary" id="empty-action">${searchError ? 'Try again' : filtered ? 'Clear result filters' : saved ? 'Discover jobs ↗' : 'Edit search preferences'}</button></div>`;
}
function render() {
  lastRenderedDay=localDay();
  const original = currentView === 'saved' ? Object.values(current().saved).map(s => s.job) : jobs;
  const base = (currentView==='saved'?original:original.filter(j=>activityMatches(current().tracking,j,activity))).map(enrich);
  const selectedWebsite = $('#website').value;
  const names = [...new Set([...sources.map(s => s.name), ...base.flatMap(j => (j.sourceLinks || [{name:j.source}]).map(s => s.name))])].sort();
  $('#website').innerHTML = '<option value="all">All websites</option>' + names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  $('#website').value = names.includes(selectedWebsite) ? selectedWebsite : 'all';
  let filtered = filterResults(base, {website:$('#website').value, query:$('#quick-search').value, salaryOnly, stage:currentView === 'saved' ? stage : 'all', saved:current().saved, sort:$('#sort').value,availability:current().availability,freshness:$('#freshness-filter').value});
  if(currentView==='saved')filtered=filterApplications(filtered,current().saved,{followUp:followUpFilter,priority:plannerPriority,sort:plannerOrder});
  const slice = paginate(filtered, page, 12);
  page = slice.page;
  visiblePageJobs=slice.items;
  renderActivity();
  toolkit();
  $('#results-title').textContent = currentView === 'saved' ? 'Your application pipeline' : 'Discover opportunities';
  $('#result-meta').textContent = currentView === 'saved' ? `${filtered.length} of ${base.length} saved opportunities · stages updated by you` : busy && !searchDone ? 'Finding opportunities from your connected sources…' : searchDone ? `${filtered.length} of ${jobs.length} matching roles · skill scores use keyword overlap` : 'Set your preferences to find opportunities.';
  $('#stat-jobs').textContent = searchDone ? jobs.length : '—';
  $('#stat-cyprus').textContent = searchDone ? jobs.filter(inSelectedCountry).length : '—';
  const stageCounts = counts();
  $('#pipeline-stages').hidden = currentView !== 'saved';
  $('#pipeline-stages').innerHTML = ['all', ...STAGES].map(s => `<button class="stage-tab ${stage === s ? 'selected' : ''}" data-pipeline-stage="${s}" aria-pressed="${stage === s}">${s === 'all' ? 'All applications' : s}<span>${s === 'all' ? base.length : stageCounts[s]}</span></button>`).join('');
  const board=currentView==='saved'&&ui.applicationsLayout==='board';
  $('#cards').className = ui.layout === 'list' ? 'cards-grid list-view' : 'cards-grid';
  $('#cards').setAttribute('aria-busy', String(busy && currentView === 'discover'));
  if(board){$('#cards').innerHTML='';}
  else if (busy && !searchDone && currentView === 'discover') {
    $('#cards').innerHTML = Array.from({length:4}, () => '<div class="skeleton" aria-hidden="true"><div></div><div></div><div></div><div></div></div>').join('');
  } else {
    $('#cards').innerHTML = slice.items.length ? slice.items.map(card).join('') : emptyState();
  }
  $('#cards').hidden=board;
  $('#stage-board').hidden=!board;
  if(board)$('#stage-board').innerHTML=filtered.length?boardHTML(filtered):emptyState();
  renderPlanner();renderComparisonTray();
  $('#pagination').hidden = board || slice.pages <= 1 || (busy && !searchDone);
  $('#page-info').textContent = `${slice.start}–${slice.end} of ${slice.total} · Page ${slice.page} of ${slice.pages}`;
  $('#prev-page').disabled = page <= 1;
  $('#next-page').disabled = page >= slice.pages;
  $('#salary-only').setAttribute('aria-pressed', String(salaryOnly));
  renderChips();renderSiteScanner();renderWebsites();
  const chooseSources=$('#choose-empty-sources');if(chooseSources)chooseSources.onclick=()=>$('#open-sources').click();
  const action = $('#empty-action');
  if (action) action.onclick = () => {
    if (searchError) search();
    else if (filtered.length === 0 && ($('#quick-search').value || $('#website').value !== 'all' || salaryOnly || stage !== 'all' || activity!=='all' || followUpFilter!=='all' || plannerPriority!=='all')) clearResultFilters();
    else if (currentView === 'saved') setView('discover');
    else openFilters();
  };
}
function clearResultFilters() {
  clearTimeout(resultRenderTimer);
  $('#quick-search').value = '';
  $('#website').value = 'all';
  $('#freshness-filter').value='all';
  salaryOnly = false;
  stage = 'all';
  activity = 'all';
  followUpFilter='all';plannerPriority='all';plannerOrder='default';
  page = 1;
  render();
}
function showSources() {
  const ok = sources.filter(s => s.status === 'ok').length;
  $('#stat-sources').textContent = sources.length ? `${ok}/${sources.length}` : current().enabledSources?.length===0?'0/0':'—';
  $('#source-caption').textContent = !sources.length?(searchDone?'No sources selected':'Search to check selected websites'):`${sources.length} of ${sourceCatalog.length||14} sources enabled`;
  $('#feeds-summary').textContent = sources.length ? `· ${ok}/${sources.length} connected` : current().enabledSources?.length===0?'· no sources selected':'· checking';
  const failures=sources.filter(s=>s.status!=='ok');
  $('#source-status').innerHTML = `<div class="source-health-heading"><div><h3>Where your results come from</h3><p>${ok} available · ${failures.length} need attention. Counts are before your search filters.</p></div><button class="secondary" id="health-search" ${busy?'disabled':''}>Search again</button></div>` + sources.map(s=>{
    const h=sourceHealth(s),time=value=>value?esc(new Date(value).toLocaleString()):'Not recorded';
    const next=h.ready?'Ready to check on your next search':`Next check in about ${h.minutes<60?h.minutes+' min':Math.ceil(h.minutes/60)+' hr'}`;
    return `<article class="source-tile ${h.failed?'source-failed':''}"><div class="source-health-title"><strong>${esc(s.name)}</strong><span class="health-badge">${esc(h.label)}</span></div><span>${h.count} listings in this snapshot</span><small>Last attempt: ${time(h.checkedAt)}</small>${h.failed?`<small>Last successful download: ${time(h.lastSuccessAt)}</small><p class="small">${h.count?'Previous listings remain available. The source could not refresh.':'This source could not load. Try again when the waiting period ends, or choose another website.'}</p>`:''}<small>${next}</small>${s.coverage?`<small>${esc(s.coverage)}</small>`:''}</article>`;
  }).join('')+'<p class="small muted source-health-footnote">Checks run when you search, not automatically. Successful feeds are reused for 6 hours (Himalayas: 24 hours); failures wait 15 minutes. Search again respects these limits to reduce downloads. Feed availability does not confirm an individual job is open.</p>';
  $('#health-search').onclick=()=>search();
}
async function search({scroll = false} = {}) {
  if(!current().setupComplete){setup.open();return;}
  searchController?.abort();
  searchController = new AbortController();
  const token = ++requestId;
  const profileId = current().id;
  savePreferences();
  const snapshot = {...current().preferences};
  busy = true;
  searchError = '';
  $('#search').disabled = true;
  $('#refresh-search').disabled = true;
  if($('#health-search'))$('#health-search').disabled=true;
  $('#search').textContent = 'Finding opportunities…';
  $('#notice').hidden = true;
  render();
  try {
    const result = await api('/api/search', {...snapshot,sources:current().enabledSources}, searchController.signal);
    if (token !== requestId || profileId !== current().id) return;
    const firstTracking=!current().tracking.baselineAt;
    current().tracking=trackSearch(current().tracking,result.jobs);
    if(firstTracking)for(const item of Object.values(current().saved))current().tracking=setActivity(current().tracking,item.job,'seen',item.savedAt||new Date().toISOString());
    persist();
    jobs = result.jobs;
    sources = result.sources.map(s => ({...s, fetchedAt:s.fetchedAt || (s.status==='ok'?result.updated:null)}));
    applied = snapshot;
    searchDone = true;
    page = 1;
    showSources();
    const failed = sources.filter(s => s.status !== 'ok');
    if (failed.length) {
      $('#notice').textContent = `${failed.map(s => s.name).join(', ')} could not refresh. Cached results are included where available. See Source status for coverage.`;
      $('#notice').hidden = false;
    }
    const changedDuringSearch=JSON.stringify(current().preferences)!==JSON.stringify(snapshot);
    $('#preferences-status').textContent = changedDuringSearch?'Preferences changed during this search. Find opportunities to apply changes.':'Search up to date. Preferences saved.';
    $('#preferences-status').classList.toggle('dirty',changedDuringSearch);
    if (scroll && window.matchMedia('(max-width: 930px)').matches) {
      $('#filters-panel').classList.remove('expanded');
      $('#toggle-filters').setAttribute('aria-expanded', 'false');
      $('#toggle-filters').textContent = 'Edit filters';
      $('#results-title').scrollIntoView({block:'start'});
    }
  } catch (error) {
    if (error.name === 'AbortError' || token !== requestId) return;
    searchError = error.message;
    $('#notice').textContent = searchDone ? `Could not update the search: ${error.message}. Your previous results remain below.` : `Could not load the search: ${error.message}.`;
    $('#notice').hidden = false;
  } finally {
    if (token === requestId) {
      busy = false;
      $('#search').disabled = false;
      $('#refresh-search').disabled = false;
      if($('#health-search'))$('#health-search').disabled=false;
      $('#search').innerHTML = 'Find opportunities <span aria-hidden="true">↗</span>';
      render();
    }
  }
}
function findJob(id) { return jobs.find(j => j.id === id) || current().saved[id]?.job || (selectedJobOwner===current().id&&selectedJob?.id===id?selectedJob:null)||siteWorkspaces.get(current().id)?.report?.jobs.find(job=>job.id===id); }
function toggleSave(id) {
  const profile = current();
  const job = findJob(id);
  if (!job) return;
  if (profile.saved[id]) { delete profile.saved[id]; toast('Removed from this profile.'); }
  else { profile.saved[id] = {job,...normalizePlan(),stage:'Saved',notes:'',savedAt:new Date().toISOString()}; toast('Saved to your application pipeline.'); }
  persist();
  render();
  if ($('#job-dialog').open && selectedJob?.id === id) details(job);
}
function setView(view) {
  currentView = view;
  document.body.classList.toggle('show-applications',view==='saved');
  stage = 'all';
  page = 1;
  $('#filters-panel').hidden = view === 'saved';
  $('.workspace').classList.toggle('pipeline', view === 'saved');
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
  });
  $('#page-name').textContent = view === 'saved' ? 'Applications' : 'Discover';
  $('#refresh-search').hidden = view === 'saved';
  $('#headline').innerHTML = view === 'saved' ? 'Your <em>applications.</em>' : 'Your job <em>search.</em>';
  $('#subtitle').textContent = view === 'saved' ? 'You update the stages and notes. Open the original job website when you are ready to apply.' : 'Search job feeds, review a role with local AI, and keep track of your next steps.';
  clearResultFilters();
}
function openFilters() {
  $('#filters-panel').classList.add('expanded');
  $('#toggle-filters').setAttribute('aria-expanded','true');
  $('#toggle-filters').textContent = 'Close filters';
  $('#filters-panel').scrollIntoView({block:'start'});
}
function reviewHTML(review) {
  const oldCountry=(review.country||'CY')!==current().preferences.country;
  return `${oldCountry?'<p class="notice">This saved review used a different country. Run a new review for your current setup.</p>':''}<div class="review"><span class="review-label">AI SUGGESTION · ${review.cvUsed?'CV INCLUDED':'PROFILE CONTEXT'}</span><h4 class="review-next-label">Suggested next step</h4><p class="review-recommendation">${esc(review.recommendation)}</p><p>${esc(review.summary)}</p><div class="review-columns"><div><h4>Potential strengths</h4><ul>${review.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div><div><h4>Gaps & questions</h4><ul>${review.gaps.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div></div><p><strong>Location notes:</strong> ${esc(review.locationNote)}</p><span class="small muted">Based on your profile and CV at review time. Re-run after changing either. Confirm requirements with the employer.</span></div>`;
}
function reviewWorkbenchHTML(job) {
  return `<section class="ai-workbench" aria-labelledby="ai-review-title"><div class="ai-workbench-heading"><div><span class="method-label method-ai">2. UNDERSTAND · LOCAL AI</span><h3 id="ai-review-title">Review your fit for this role</h3></div><span class="ai-panel-state" id="review-state">Not reviewed yet</span></div><p class="ai-workbench-intro">Get a written comparison of this job with your profile: potential strengths, gaps, and location questions.</p><div class="review-inputs" id="review-inputs"></div><div class="ai-workbench-actions"><button class="review-button" id="review-job">Review fit with AI</button><button class="text-button" data-guide="ai">What information is used?</button></div><p class="ai-run-hint" id="ai-run-hint">Runs on this PC when you ask.</p><div id="review-result" aria-live="polite"></div></section>`;
}
function details(raw,section=detailTab) {
  const job = enrich(raw);
  selectedJob = job;
  selectedJobOwner=current().id;
  current().tracking=setActivity(current().tracking,job,'seen');persist();render();
  const saved = current().saved[job.id];
  $('#job-details').innerHTML = `<h2 class="dialog-title" id="dialog-job-title">${esc(job.title)}</h2><p class="dialog-company">${esc(job.company)} · ${esc(job.location)}</p>${sourceBadges(job)}<div class="tags"><span class="tag">${esc(job.work)}</span><span class="tag location">${esc(job.locationCheck.label)}</span>${job.salary?`<span class="tag">${esc(job.salary)}</span>`:''}</div>
    <div class="dialog-actions"><a href="${esc(safeLink(job.url))}" target="_blank" rel="noopener noreferrer" class="primary">Open job website ↗</a><button class="secondary" id="detail-save">${saved?'Remove saved job':'Save to My applications'}</button>${job.manual?'<button class="secondary" id="edit-manual-job">Edit manual job</button>':''}${compareButton(job)}</div>
    <p class="small muted">The original listing opens on its website. You choose whether to submit an application.</p>
    <div id="detail-sections" class="detail-sections" role="group" aria-label="Listing sections"><button id="job-section-listing" data-section="listing" aria-controls="job-pane-listing"><span>Job listing</span><small>From the employer</small></button><button id="job-section-ai" data-section="ai" aria-controls="job-pane-ai"><span>✦ AI review</span><small id="detail-ai-state">On request</small></button><button id="job-section-application" data-section="application" aria-controls="job-pane-application"><span>Application draft</span><small>Local AI · you review</small></button><button id="job-section-notes" data-section="notes" aria-controls="job-pane-notes"><span>Your notes</span><small>You update this</small></button></div>
    <section id="job-pane-listing" aria-labelledby="job-section-listing"><div id="listing-availability"></div>${matchHTML(job,true)}${applications.feedbackHTML(job)}<details class="match-evidence"><summary>Automatic text checks <span>Experience & location</span></summary><p><strong>Junior evidence:</strong> ${esc(job.experience.levelLabel)}. ${esc(job.experience.levelEvidence)}<br><strong>Experience:</strong> ${esc(job.experience.label)}${job.experience.evidence?` — “${esc(job.experience.evidence)}”`:'. Check the original requirements.'}</p>${job.experience.preferredLabel?`<p><strong>Optional experience:</strong> ${esc(job.experience.preferredLabel)} — “${esc(job.experience.preferredEvidence)}”. Preferred years do not exclude a junior search.</p>`:''}<p><strong>Location:</strong> ${esc(job.locationCheck.label)}. ${esc(job.locationCheck.note)}</p><p class="small muted">These are text checks. Confirm the requirements on the original listing.</p><button class="text-button" data-guide="matching">How matching works ↗</button></details>
    ${current().cv.text?`<section class="cv-evidence"><span class="method-label method-auto">KEYWORD OVERLAP</span><h3>Skills also mentioned in your CV</h3><div class="tags">${job.cvMatch.shared.length?job.cvMatch.shared.map(skill=>`<span class="tag">${esc(skill)}</span>`).join(''):'<span class="muted">No shared technical keywords identified.</span>'}</div><p class="small muted">A text comparison of technical keywords. An AI review adds written context.</p></section>`:''}
    <section class="role-about" aria-labelledby="about-role-title"><div class="about-heading"><div><span class="eyebrow">EMPLOYER DESCRIPTION</span><h3 id="about-role-title">About this role</h3></div><span class="about-source">From ${esc(job.source)}</span></div><div class="role-description">${renderDescription(job)}</div><div class="description-footer"><span>${esc(dateLabel(job))}</span><a href="${esc(safeLink(job.url))}" target="_blank" rel="noopener noreferrer">Read on ${esc(job.source)} ↗</a></div></section></section>
    <section id="job-pane-ai" aria-labelledby="job-section-ai" hidden>${reviewWorkbenchHTML(job)}</section>
    <section id="job-pane-application" aria-labelledby="job-section-application" hidden>${applications.draftHTML(job)}</section>${notesPaneHTML(saved,job)}`;
  if(job.manual)$('#edit-manual-job').onclick=()=>{ $('#job-dialog').close();openManual(job); };
  $('#detail-save').onclick = () => toggleSave(job.id);
  if (saved) bindApplicationPlan(job);
  $('#review-job').onclick = () => startAiReview(job);
  $('#detail-sections').onclick=event=>{const button=event.target.closest('[data-section]');if(button)setDetailTab(button.dataset.section);};
  if($('#notes-save'))$('#notes-save').onclick=()=>toggleSave(job.id);
  if($('#notes-pipeline'))$('#notes-pipeline').onclick=()=>{$('#job-dialog').close();setView('saved');};
  applications.bind(job);
  setDetailTab(section);
  updateAvailability();
  updateAiUI();
}

function resetForProfile() {
  applications.cancel();
  sourcesOwner=null;
  searchEdit=null;
  for(const id of ['saved-searches-dialog','save-search-dialog'])if($('#'+id).open)$('#'+id).close();
  comparisonJobs.clear();
  selectedJob=null;selectedJobOwner=null;guideReturnJob=null;
  for(const id of ['job-dialog','comparison-dialog','guide-dialog','scanner-dialog','websites-dialog','setup-dialog','sources-dialog'])if($('#'+id).open)$('#'+id).close();
  jobs = [];
  sources = [];
  searchDone = false;
  searchError = '';
  applied = {...current().preferences};
  showSources();
  profileUI();
  clearResultFilters();
  loadCatalog();status();
  if(current().setupComplete)search();else setup.open();
}
function appearance() {
  document.documentElement.dataset.theme = ui.theme === 'dark' ? 'dark' : 'light';
  const dark = ui.theme === 'dark';
  $('#theme-toggle').setAttribute('aria-pressed', String(dark));
  $('#theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  $('#view-grid').classList.toggle('selected', ui.layout !== 'list');
  $('#view-list').classList.toggle('selected', ui.layout === 'list');
  $('#view-grid').setAttribute('aria-pressed', String(ui.layout !== 'list'));
  $('#view-list').setAttribute('aria-pressed', String(ui.layout === 'list'));
}

// Preference and navigation controls.
$('#preferences').onsubmit = event => { event.preventDefault(); search({scroll:true}); };
$('#preferences').oninput = savePreferences;
$('#preferences').onchange = savePreferences;
$('#refresh-search').onclick = () => search();
$('#reset-filters').onclick = () => {
  current().preferences = {...defaults, country:current().preferences.country, model:current().preferences.model, background:current().preferences.background};
  profileUI();
  savePreferences();
  clearResultFilters();
  search();
};
$('#toggle-filters').onclick = () => {
  const expanded = $('#filters-panel').classList.toggle('expanded');
  $('#toggle-filters').setAttribute('aria-expanded', String(expanded));
  $('#toggle-filters').textContent = expanded ? 'Close filters' : 'Edit filters';
};
$('#profiles').onchange = event => { state.active = event.target.value; persist(); resetForProfile(); };
$('#new-profile').onclick = () => { $('#profile-name').value = ''; $('#profile-dialog').showModal(); $('#profile-name').focus(); };
$('#profile-form').onsubmit = event => {
  event.preventDefault();
  const name = $('#profile-name').value.trim();
  if (!name) return;
  const profile = makeProfile(name);
  state.profiles.push(profile);
  state.active = profile.id;
  persist();
  $('#profile-dialog').close();
  resetForProfile();
  toast('Profile created. Your other profiles are unchanged.');
};
for (const button of document.querySelectorAll('[data-view]')) button.onclick = () => setView(button.dataset.view);
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => {if(button.dataset.close==='cv-dialog'){cvRequest++;cvController?.abort();}$('#' + button.dataset.close).close();};
$('#close-dialog').onclick = () => $('#job-dialog').close();
$('#open-backups').onclick = () => $('#backup-dialog').showModal();
$('#theme-toggle').onclick = () => { ui.theme = ui.theme === 'dark' ? 'light' : 'dark'; persistUI(); appearance(); };
for (const layout of ['grid', 'list']) $('#' + 'view-' + layout).onclick = () => { ui.layout = layout; persistUI(); appearance(); render(); };
$('#freshness-filter').onchange = $('#website').onchange = $('#sort').onchange = () => { page = 1; render(); };
$('#quick-search').oninput=()=>{clearTimeout(resultRenderTimer);resultRenderTimer=setTimeout(()=>{page=1;render();},140);};
$('#salary-only').onclick = () => { salaryOnly = !salaryOnly; page = 1; render(); };
$('#toggle-sources').onclick = () => {
  const hidden = !$('#source-status').hidden;
  $('#source-status').hidden = hidden;
  $('#toggle-sources').setAttribute('aria-expanded', String(!hidden));
};
$('#pipeline-stages').onclick = event => {
  const button = event.target.closest('[data-pipeline-stage]');
  if (button) { stage = button.dataset.pipelineStage; page = 1; render(); }
};
for (const [id, change] of [['prev-page', -1], ['next-page', 1]]) $('#' + id).onclick = () => { page += change; render(); $('#results-title').scrollIntoView({block:'start'}); };
$('#cards').onclick = event => {
  const activityButton=event.target.closest('[data-activity]');
  if(activityButton){const job=findJob(activityButton.dataset.id);if(job){if(!commitProfile({tracking:setActivity(current().tracking,job,activityButton.dataset.activity)}))return;render();toast(activityButton.dataset.activity==='hide'?'Job hidden. Find it under Hidden to restore it.':activityButton.dataset.activity==='unseen'?'Job marked unseen.':'Job restored.');}return;}
  const review=event.target.closest('[data-review]');
  if(review){const job=findJob(review.dataset.review);if(job){details(job,'ai');$('#job-dialog').showModal();}return;}
  const save = event.target.closest('[data-save]');
  const open = event.target.closest('[data-open]');
  if (save) toggleSave(save.dataset.save);
  if (open) { const job = findJob(open.dataset.open); if (job) { details(job,'listing'); $('#job-dialog').showModal(); } }
};
$('#cards').onchange = event => {
  const id = event.target.dataset.stage;
  if(id&&current().saved[id]&&updateApplication(id,{stage:event.target.value}))toast('Application stage updated.');
};

// Backup files stay in the browser; they are never posted to the server.
$('#export-backup').onclick = () => {
  savePreferences();
  const blob = new Blob([JSON.stringify(makeBackup(state), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'JobScout-backup-' + new Date().toLocaleDateString('en-CA') + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  $('#backup-status').textContent = 'Backup downloaded. It includes your CV text, background, history, and notes; store it somewhere private.';
};
$('#import-backup').onclick = () => $('#backup-file').click();
$('#backup-file').onchange = async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw Error('This file is too large (maximum 10 MB).');
    const imported = readBackup(JSON.parse(await file.text()));
    const copies = imported.map(profile => ({...profile, id:crypto.randomUUID(), name:profile.name + ' (imported)'}));
    const next = {...state, profiles:[...state.profiles, ...copies]};
    // Commit storage before mutating the visible state. A full disk cannot cause a partial import.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
    profileUI();
    render();
    $('#backup-status').textContent = `${copies.length} profile(s) imported as copies. Choose one in the profile selector. Existing profiles were kept.`;
  } catch (error) { $('#backup-status').textContent = 'Import failed: ' + error.message; }
  finally { event.target.value = ''; }
};
async function status() {
  const owner=current().id;
  try { const result=await api('/api/status');if(owner!==current().id)return;const model=current().preferences.model||result.model;aiConnection={...result,model,installed:(result.models||[]).some(m=>(m.name.includes(':')?m.name:m.name+':latest')===(model.includes(':')?model:model+':latest'))}; }
  catch { if(owner!==current().id)return;aiConnection={online:false,installed:false,unavailable:true}; }
  updateAiUI();if(lastRenderedDay!==localDay())render();
}

const setup=createSetup({current,api,onSave:(patch,owner)=>{
 if(owner!==current().id)return false;
 if(!commitProfile({...patch,preferences:{...current().preferences,...patch.preferences},setupComplete:true},owner))return false;
 resetForProfile();toast('Setup saved. Searching with your country and preferences.');return true;
}});

function renderSavedSearches(){
 const list=current().savedSearches;
 $('#saved-search-count').textContent=list.length+' / 20';
 $('#save-current-search').textContent=searchEdit?'Save edited search':'Save this search';
 $('#cancel-search-edit').hidden=!searchEdit;
 $('#saved-search-list').innerHTML=list.length?list.map(s=>`<article class="saved-search-card"><h3>${esc(s.name)}</h3><p class="small muted">${esc(countryInfo(s.preferences.country).name)} · ${esc(s.preferences.role)} · ${esc(s.preferences.level||'Any level')}</p><p class="small">${esc(s.preferences.skills||'No skill keywords')} · ${s.enabledSources===null?'All feeds':s.enabledSources.length+' feeds'}</p><div class="tool-actions"><button class="primary" data-search-action="run" data-search-id="${esc(s.id)}">Run</button><button class="secondary" data-search-action="edit" data-search-id="${esc(s.id)}">Edit</button><button class="text-button" data-search-action="delete" data-search-id="${esc(s.id)}">Delete</button></div></article>`).join(''):'<p>No saved searches yet. Set your filters and choose Save this search.</p>';
}
$('#open-saved-searches').onclick=()=>{renderSavedSearches();$('#saved-searches-dialog').showModal();};
$('#cancel-search-edit').onclick=()=>{searchEdit=null;renderSavedSearches();toast('Editing ended. Your current filters are unchanged.');};
$('#save-current-search').onclick=()=>{
 searchSaveOwner=current().id;
 const item=current().savedSearches.find(s=>s.id===searchEdit);
 $('#save-search-name').value=item?.name||'';
 $('#save-search-title').textContent=item?'Update saved search':'Save this search';
 $('#save-search-message').textContent='Saves current filters and Job websites choices. CV, background and AI model stay with your profile.';
 $('#save-search-dialog').showModal();$('#save-search-name').focus();
};
$('#save-search-form').onsubmit=event=>{
 event.preventDefault();if(searchSaveOwner!==current().id)return;
 try{
 const savedSearches=saveSearch(current().savedSearches,{id:searchEdit||crypto.randomUUID(),name:$('#save-search-name').value,preferences:{...current().preferences,...preferences()},enabledSources:current().enabledSources});
 if(!commitProfile({savedSearches}))return;
 searchEdit=null;renderSavedSearches();$('#save-search-dialog').close();toast('Search saved for this profile.');
 }catch(error){$('#save-search-message').textContent=error.message;}
};
$('#saved-search-list').onclick=event=>{
 const button=event.target.closest('[data-search-action]');if(!button)return;
 const item=current().savedSearches.find(s=>s.id===button.dataset.searchId);if(!item)return;
 const action=button.dataset.searchAction;
 if(action==='delete'){
 if(!confirm('Delete saved search "'+item.name+'"? Your applications stay saved.'))return;
 if(!commitProfile({savedSearches:current().savedSearches.filter(s=>s.id!==item.id)}))return;
 if(searchEdit===item.id)searchEdit=null;renderSavedSearches();return;
 }
 if(!commitProfile({preferences:{...current().preferences,...item.preferences},enabledSources:item.enabledSources===null?null:[...item.enabledSources]}))return;
 searchEdit=action==='edit'?item.id:null;
 $('#saved-searches-dialog').close();profileUI();clearResultFilters();setView('discover');loadCatalog();
 if(action==='run')search({scroll:true});
 else {openFilters();$('#preferences').elements.role.focus();toast('Edit the filters or Job websites, then choose Save edited search.');}
};

$('#open-settings').onclick=$('#country-settings').onclick=()=>setup.open();
loadCatalog();
profileUI();
appearance();
render();
status();
if(current().setupComplete)search();else queueMicrotask(()=>setup.open());
setInterval(()=>{if(!document.hidden){status();if(searchDone)showSources();}}, 60000);

// Profile-local reading history, source choices, CV text and manual jobs.
function toolkit(){
 const enabled=current().enabledSources===null?sourceCatalog.length:current().enabledSources.length;
 $('#enabled-count').textContent=sourceCatalog.length?`${enabled}/${sourceCatalog.length}`:'';
 $('#cv-indicator').textContent=current().cv.text?'✓':'';
 $('#open-cv').classList.toggle('has-cv',Boolean(current().cv.text));
 updateAiOverview();
 const unseen=jobs.filter(j=>activityMatches(current().tracking,j,'unseen')).length;
 const fresh=jobs.filter(j=>activityMatches(current().tracking,j,'new')).length;
 $('#workspace-summary').textContent=searchDone?`${fresh} new to you · ${unseen} not opened${current().cv.text?' · CV matching on':''}`:'Your history and source choices belong to this profile.';
}
function renderActivity(){
 const labels={all:'All',new:'New',unseen:'Unseen',seen:'Seen',hidden:'Hidden'};
 $('#activity-bar').hidden=currentView!=='discover';
 $('#activity-hint').hidden=currentView!=='discover';
 $('#activity-tabs').innerHTML=Object.entries(labels).map(([key,label])=>`<button class="activity-tab ${activity===key?'selected':''}" data-reading="${key}" aria-pressed="${activity===key}">${label}<span>${jobs.filter(j=>activityMatches(current().tracking,j,key)).length}</span></button>`).join('');
 $('#activity-hint').textContent=activity==='new'?'First discovered after your initial search. Opening a role marks it seen.':activity==='hidden'?'These matching jobs stay hidden until you restore them. Saved applications remain in your pipeline.':'New highlights roles first discovered after your initial search. Hidden jobs stay out of Discover.';
 $('#mark-page-seen').disabled=!visiblePageJobs.length||currentView!=='discover';
}
function commitProfile(patch,profileId=current().id){
 const next={...state,profiles:state.profiles.map(p=>p.id===profileId?{...p,...patch}:p)};
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));state=next;return true;}
 catch{toast('Could not save: browser storage is unavailable or full. Export a backup first.');return false;}
}
async function loadCatalog(){
 const country=current().preferences.country;
 try{const data=await api('/api/sources?country='+country);if(country!==current().preferences.country)return;sourceCatalog=data.sources;sourceRecommendations=data.recommended||[];toolkit();if(searchDone)showSources();}
 catch{sourceCatalog=[];}
}
$('#activity-tabs').onclick=event=>{const button=event.target.closest('[data-reading]');if(button){activity=button.dataset.reading;page=1;render();}};
$('#mark-page-seen').onclick=()=>{
 let next=current().tracking;for(const job of visiblePageJobs)next=setActivity(next,job,'seen');
 if(commitProfile({tracking:next})){render();toast('Jobs on this page marked seen.');}
};
$('#open-sources').onclick=async()=>{
 const owner=current().id;
 if(!sourceCatalog.length)await loadCatalog();
 if(owner!==current().id)return;
 sourcesOwner=owner;$('#source-search').value='';
 $('#source-choices').innerHTML=sourceCatalog.map((s,i)=>`<label class="source-choice" for="source-option-${i}"><input id="source-option-${i}" type="checkbox" value="${esc(s.name)}" ${current().enabledSources===null||current().enabledSources.includes(s.name)?'checked':''}><span><strong>${esc(s.name)}</strong><small>${esc(s.coverage)}</small></span></label>`).join('');
 $('#sources-message').textContent=sourceCatalog.length?'Changes apply to '+current().name+'.':'Could not load the source list. Close this panel and try again.';
 $('#save-sources').disabled=!sourceCatalog.length;
 updateSourceSelection();
 $('#sources-dialog').showModal();
};
for(const [id,checked] of [['sources-all',true],['sources-none',false]])$('#'+id).onclick=()=>{document.querySelectorAll('#source-choices input').forEach(input=>{input.checked=checked;});updateSourceSelection();};
function updateSourceSelection(){
 const total=document.querySelectorAll('#source-choices input').length,selected=document.querySelectorAll('#source-choices input:checked').length;
 $('#source-selection-count').textContent=selected+' of '+total+' websites selected'+(selected?'':'. Searches will return no feed jobs.');
}
$('#source-choices').onchange=updateSourceSelection;
$('#sources-recommended').onclick=()=>{document.querySelectorAll('#source-choices input').forEach(input=>{input.checked=sourceRecommendations.includes(input.value);});updateSourceSelection();};
$('#source-search').oninput=()=>{const query=$('#source-search').value.trim().toLowerCase();let count=0;document.querySelectorAll('#source-choices label').forEach(label=>{label.hidden=!label.textContent.toLowerCase().includes(query);if(!label.hidden)count++;});$('#source-search-empty').hidden=count>0;};
$('#save-sources').onclick=()=>{
 if(sourcesOwner!==current().id){$('#sources-dialog').close();return;}

 const enabledSources=Array.from(document.querySelectorAll('#source-choices input:checked')).map(input=>input.value);
 if(!commitProfile({enabledSources}))return;
 $('#sources-dialog').close();toolkit();clearResultFilters();search();
};
function openManual(job){
 editingManualId=job?.manual?job.id:null;
 $('#manual-form').reset();
 if(editingManualId)for(const field of ['url','title','company','location','work','salary','description'])$('#manual-form').elements.namedItem(field).value=job[field]||'';
 $('#manual-title').textContent=editingManualId?'Refine this opportunity.':'Keep it in one place.';
 $('#manual-message').textContent='The original listing stays linked. No application is sent.';
 $('#manual-dialog').showModal();
}
$('#open-manual').onclick=()=>openManual();
$('#manual-form').onsubmit=event=>{
 event.preventDefault();
 try{
  const input=Object.fromEntries(new FormData($('#manual-form')));
  const id=editingManualId||'manual-'+crypto.randomUUID();
  const old=current().saved[id],job=createManualJob(input,id,old?.job.date);
  if(Object.values(current().saved).some(s=>s.job.id!==id&&safeLink(s.job.url)===job.url))throw Error('This listing link is already in your application pipeline. Open that job to edit it.');
  const saved={...current().saved,[id]:{job,...normalizePlan(old),stage:old?.stage||'Saved',notes:old?.notes||'',savedAt:old?.savedAt||new Date().toISOString()}};
  const reviews={...current().reviews};if(old)delete reviews[id];
  if(!commitProfile({saved,reviews}))return;
  $('#manual-dialog').close();setView('saved');toast(editingManualId?'Manual job updated.':'Job added to your application pipeline.');editingManualId=null;
 }catch(error){$('#manual-message').textContent=error.message;}
};
function updateCvPreview(){
 const text=$('#cv-text').value,skills=cvSkills(text);
 $('#cv-skills').textContent=`${text.length.toLocaleString()} / 16,000 characters · ${skills.length?'Mentioned technical skills: '+skills.join(', '):'No supported technical keywords identified yet.'}`;
}
$('#open-cv').onclick=()=>{
 cvRequest++;cvController?.abort();cvOwner=current().id;cvFileName=current().cv.name;
 $('#save-cv').disabled=false;$('#pick-cv').disabled=false;$('#cv-text').readOnly=false;
 $('#cv-text').value=current().cv.text;
 $('#cv-filename').textContent=cvFileName||'Paste text or choose a file';
 $('#cv-message').textContent=current().cv.text?'Saved in this browser profile. Edit the text and save to update it.':'Review the extracted text before saving it.';
 updateCvPreview();$('#cv-dialog').showModal();
};
$('#cv-text').oninput=updateCvPreview;
$('#pick-cv').onclick=()=>$('#cv-file').click();
$('#cv-file').onchange=async event=>{
 const file=event.target.files?.[0];if(!file)return;
 const owner=cvOwner,token=++cvRequest;cvController?.abort();cvController=new AbortController();
 $('#save-cv').disabled=true;$('#pick-cv').disabled=true;$('#cv-text').readOnly=true;
 $('#cv-message').textContent='Reading the file on your PC…';
 try{
  if(file.size>6*1024*1024)throw Error('Choose a file smaller than 6 MB.');
  if(!/\.(pdf|txt|md)$/i.test(file.name))throw Error('Choose a PDF, plain text, or Markdown file. Paste text copied from a Word document.');
  const response=await fetch('/api/cv/extract',{method:'POST',headers:{'Content-Type':/\.pdf$/i.test(file.name)?'application/pdf':'text/plain'},body:file,signal:cvController.signal});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Could not read the CV.');
  if(token!==cvRequest||owner!==cvOwner||current().id!==owner||!$('#cv-dialog').open)return;
  cvFileName=file.name;$('#cv-filename').textContent=file.name;$('#cv-text').value=result.text;
  $('#cv-message').textContent=`Text extracted${result.totalPages?' from '+result.totalPages+' page(s)':''}. Review it before saving.${result.truncated?' Only the first 16,000 characters were kept.':''}`;
  updateCvPreview();
 }catch(error){if(token===cvRequest&&owner===cvOwner)$('#cv-message').textContent=error.message;}
 finally{if(token===cvRequest&&owner===cvOwner){$('#save-cv').disabled=false;$('#pick-cv').disabled=false;$('#cv-text').readOnly=false;}event.target.value='';}
};
$('#save-cv').onclick=()=>{
 const text=$('#cv-text').value.trim();
 if(text.length<20){$('#cv-message').textContent='Paste at least 20 characters, or use Remove saved CV.';return;}
 if(!commitProfile({cv:normalizeCv({text,name:cvFileName||'Pasted CV text',updatedAt:new Date().toISOString()})}))return;
 $('#cv-dialog').close();render();toast('CV text saved. Local AI reviews will include it.');
};
$('#clear-cv').onclick=()=>{
 if(!commitProfile({cv:normalizeCv()}))return;
 $('#cv-text').value='';cvFileName='';$('#cv-filename').textContent='No saved CV';$('#cv-message').textContent='Saved CV text removed from this profile. Existing backups and old AI reviews are unchanged.';
 updateCvPreview();render();
};

// AI status is separate from feed searches and deterministic text matching.
function connectionCopy(){
 if(!aiConnection)return {label:'Checking local AI…',note:'Checking whether Ollama and the review model are available.',ready:false};
 if(aiConnection.unavailable)return {label:'Cannot check AI connection',note:'Reconnect to the local dashboard, then check again.',ready:false};
 if(!aiConnection.online)return {label:'Ollama is offline',note:'Open Ollama on this PC to enable written AI reviews. You can keep searching and tracking jobs.',ready:false};
 if(!aiConnection.installed)return {label:'Review model needs setup',note:'Install '+(aiConnection.model||'the configured local model')+' in Ollama, then check the connection again.',ready:false};
 return {label:'Ready to review a role',note:'Compares a job with your profile and optional CV when you ask.',ready:true};
}
function updateAiOverview(){
 const info=connectionCopy();
 const scanAI=siteScanRun?.phase==='ai'||aiConnection?.task==='website scan',testingAI=aiConnection?.task==='connection test';
 const busy=Boolean(aiReview)||scanAI||Boolean(aiConnection?.busy),mine=aiReview?.profileId===current().id;
 $('#workspace-ai-state').textContent=testingAI?'Testing local AI':scanAI?'AI is identifying listed roles':busy?'AI review in progress':info.label;
 $('#workspace-ai-explanation').textContent=testingAI?'Running a small sample response. Your CV is not used.':scanAI?'Reading the collected careers-page evidence. You can keep browsing.':busy?(mine?'Reviewing “'+aiReview.title+'”.':'Finishing a review for another profile.'):info.note;
 $('#workspace-ai-action').textContent=busy?'You can keep browsing while it finishes.':info.ready?'One job at a time · starts when you ask':'Job search and tracking remain available.';
 $('#workspace-ai-indicator').dataset.state=busy?'busy':info.ready?'ready':'offline';
 $('#ai-status').textContent=testingAI?'Testing local AI':scanAI?'AI website scan in progress':busy?'AI review in progress':info.ready?'Local AI ready · '+aiConnection.model:info.label;
 $('#ai-status').classList.toggle('offline',!info.ready);
 $('#guide-ai-state').textContent=busy?'Review in progress':info.ready?'AI ready':info.label;
 $('#guide-ai-message').textContent=info.ready?'Ollama and '+aiConnection.model+' are available locally. Reviews start only when you request one.':info.note;
}
function updateAiUI(){
 updateAiOverview();
 const button=$('#review-job'),output=$('#review-result');
 if(!button||!output||!selectedJob||selectedJobOwner!==current().id)return;
 const review=current().reviews[selectedJob.id];
 const running=aiReview?.jobId===selectedJob.id&&aiReview?.profileId===current().id;
 const info=connectionCopy();
 const failure=aiFailures.get(current().id+':'+selectedJob.id);
 const hasSkills=Boolean(current().preferences.skills.trim()),hasCv=Boolean(current().cv.text);
 $('#review-inputs').innerHTML=`<div><span>JOB DESCRIPTION</span><strong>From this listing</strong></div><div><span>YOUR PROFILE</span><strong>${hasSkills?'Skills + experience choices':'Role + experience choices'}</strong></div><div><span>YOUR CV</span><strong>${hasCv?'Saved CV included':'Optional · not added'}</strong></div>`;
 $('#detail-ai-state').textContent=running?'Reviewing…':review?'Saved review':'On request';
 $('#review-state').textContent=running?'Reviewing…':aiReview?'AI is busy with another role':review?'Saved AI review':failure?'Review could not finish':info.ready?'Not reviewed yet':info.label;
 const otherAI=Boolean(siteScanRun)||Boolean(aiConnection?.busy)&&!running;
 button.disabled=Boolean(aiReview)||otherAI||!info.ready;
 button.textContent=running?'Reviewing on your PC…':otherAI?'AI is busy with another request':aiReview?'Another review is running':!info.ready?'AI unavailable':review?'Review again with AI':'Review fit with AI';
 $('#ai-run-hint').textContent=running?'Comparing your information with this role. The first review can take a few minutes while the model starts.':!info.ready?info.note:!hasSkills&&!hasCv?'Add skills or a CV for a more personal review. You can still review the job with your current profile.':'Runs locally when you click. The result is advice to help you decide your next step.';
 output.setAttribute('aria-busy',String(running));
 output.innerHTML=running?'<div class="review-pending" role="status"><span class="ai-pulse" aria-hidden="true">✦</span><div><strong>Reading and comparing</strong><p>The model is preparing strengths, gaps, and location notes from the information supplied.</p></div></div>':failure?`<p class="review-error">${esc(failure)}</p>`:review?reviewHTML(review):'<div class="ai-output-placeholder"><span aria-hidden="true">✦</span><div><strong>Your written review will appear here.</strong><p>Expect a fit summary, potential strengths, gaps to check, and location notes.</p></div></div>';
}
async function startAiReview(job){
 if(siteScanRun||aiConnection?.busy&&!aiReview){toast('Local AI is busy. Finish the current request, then try again.');return;}
 if(aiReview){toast('A local AI review is already running. You can keep browsing.');return;}
 if(!connectionCopy().ready){await status();if(!connectionCopy().ready)return;}
 savePreferences();
 const profileId=current().id,profileSnapshot={...current().preferences},cvSnapshot={...current().cv};
 const key=profileId+':'+job.id;
 aiFailures.delete(key);aiReview={jobId:job.id,profileId,title:job.title};
 render();updateAiUI();
 try{
  const {review:result}=await api('/api/analyze',{id:job.id,profile:profileSnapshot,cv:cvSnapshot,manualJob:job.manual?Object.fromEntries(['id','manual','title','company','location','work','salary','description','url','date'].map(key=>[key,job[key]])):undefined});
  result.cvUpdatedAt=cvSnapshot.updatedAt;
  const target=state.profiles.find(p=>p.id===profileId);
  if(target){target.reviews[job.id]=result;persist();}
 }catch(error){aiFailures.set(key,error.message);}
 finally{aiReview=null;render();updateAiUI();status();}
}
function openGuide(section='overview'){
 guideReturnJob=$('#job-dialog').open&&selectedJobOwner===current().id?{job:selectedJob,profileId:current().id}:null;
 if($('#job-dialog').open)$('#job-dialog').close();
 $('#guide-dialog').showModal();updateAiOverview();
 const target=section==='ai'?$('#guide-ai'):section==='matching'?$('#guide-matching'):$('#guide-title');
 target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start'});
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-guide]');if(button)openGuide(button.dataset.guide);});
$('#guide-dialog').onclose=()=>{const back=guideReturnJob;guideReturnJob=null;if(back&&back.profileId===current().id){details(back.job);$('#job-dialog').showModal();}};
$('#check-ai-connection').onclick=async()=>{const button=$('#check-ai-connection');button.disabled=true;button.textContent='Checking…';await status();button.disabled=false;button.textContent='Check AI connection';};

function setDetailTab(section){
 detailTab=['listing','ai','application','notes'].includes(section)?section:'listing';
 for(const name of ['listing','ai','application','notes']){const selected=name===detailTab;$('#job-pane-'+name).hidden=!selected;const button=$('#job-section-'+name);button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}
 if(detailTab==='ai')updateAiUI();
}


// Local application organiser and shortlist. No AI is invoked by these tools.
function friendlyDay(value){return value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'No date set';}
function dueCopy(entry){const state=followUpStatus(entry);return state==='overdue'?'Overdue · '+friendlyDay(entry.followUp):state==='today'?'Due today':state==='upcoming'?'Follow up '+friendlyDay(entry.followUp):entry.stage==='Closed'?'Closed · no active follow-up':'No follow-up date';}
function planPreview(entry){
 const plan=normalizePlan(entry),due=followUpStatus(entry);
 return '<div class="plan-preview"><div><span class="priority-badge priority-'+plan.priority.toLowerCase()+'">'+esc(plan.priority)+' priority</span><span class="due-badge due-'+due+'">'+esc(dueCopy(entry))+'</span></div>'+(plan.nextAction?'<p>'+esc(plan.nextAction)+'</p>':'')+'<button class="text-button" data-plan-open="'+esc(entry.job.id)+'">Plan next step ↗</button></div>';
}
function notesPaneHTML(saved,job){
 return '<section id="job-pane-notes" class="notes-pane" aria-labelledby="job-section-notes" hidden><span class="method-label method-manual">3. TRACK · YOU CONTROL THIS</span><h3>Your next steps</h3>'+(saved?
 '<p>Keep a small plan for this opportunity. Changes save to this profile as you edit.</p><form id="application-plan" class="application-plan"><div class="two"><label>Application stage<select name="stage">'+APPLICATION_STAGES.map(s=>'<option '+(s===saved.stage?'selected':'')+'>'+s+'</option>').join('')+'</select></label><label>Priority<select name="priority">'+PRIORITIES.map(p=>'<option '+(p===normalizePlan(saved).priority?'selected':'')+'>'+p+'</option>').join('')+'</select></label></div><label>Next action<input name="nextAction" maxlength="240" placeholder="e.g. Check country eligibility or prepare a project example" value="'+esc(normalizePlan(saved).nextAction)+'"></label><div class="followup-field"><label>Follow-up date<input name="followUp" type="date" min="1900-01-01" max="2200-12-31" value="'+esc(normalizePlan(saved).followUp)+'"></label><button class="text-button" id="clear-followup" type="button">Clear date</button></div><span id="plan-due-label" class="due-badge due-'+followUpStatus(saved)+'">'+esc(dueCopy(saved))+'</span><p class="small muted">Dates flag due items while this dashboard is open. No background notification or message is sent. Closed jobs are excluded.</p></form><label class="notes">Application notes<textarea id="job-notes" rows="6" maxlength="3000" placeholder="Questions, interview preparation, recruiter feedback…">'+esc(saved.notes)+'</textarea></label><p id="plan-status" class="small muted" role="status">Saved in this browser profile.</p><button class="secondary" id="notes-pipeline">Open My applications ↗</button>':
 '<p>Save this role to set a priority, next action and follow-up date, and keep your notes.</p><button id="notes-save" class="primary">Save this job & add notes</button>')+'</section>';
}
function updateApplication(id,patch){
 const old=current().saved[id];if(!old)return false;
 const next={...old,...normalizePlan({...old,...patch})};
 if(Object.hasOwn(patch,'stage')&&APPLICATION_STAGES.includes(patch.stage))next.stage=patch.stage;
 if(Object.hasOwn(patch,'notes'))next.notes=String(patch.notes).slice(0,3000);
 if(!commitProfile({saved:{...current().saved,[id]:next}}))return false;
 render();return true;
}
function bindApplicationPlan(job){
 const form=$('#application-plan');
 form.onsubmit=event=>event.preventDefault();
 const save=event=>{
  const field=event.target;if(!field.name)return;
  if(!field.checkValidity()){$('#plan-status').textContent='Choose a valid date between 1900 and 2200.';return;}
  if(updateApplication(job.id,{[field.name]:field.value})){
   $('#plan-status').textContent='Changes saved.';const entry=current().saved[job.id];
   $('#plan-due-label').textContent=dueCopy(entry);$('#plan-due-label').className='due-badge due-'+followUpStatus(entry);
  }
 };
 form.onchange=save;
 form.oninput=event=>{if(event.target.name==='nextAction')save(event);};
 $('#clear-followup').onclick=()=>{form.elements.namedItem('followUp').value='';save({target:form.elements.namedItem('followUp')});};
 $('#job-notes').oninput=event=>{if(updateApplication(job.id,{notes:event.target.value}))$('#plan-status').textContent='Notes saved.';};
}
function renderPlanner(){
 const visible=currentView==='saved';$('#application-hub').hidden=!visible;
 const counts=followUpCounts(current().saved);
 const due=counts.overdue+counts.today;
 $('#followup-alert').hidden=visible||!due;
 $('#followup-alert').textContent=due+' follow-up'+(due===1?' needs':'s need')+' your attention · Open My applications ↗';
 const labels={all:'All saved',overdue:'Overdue',today:'Due today',upcoming:'Upcoming',none:'No active date'};
 $('#followup-summary').innerHTML=Object.entries(labels).map(([key,label])=>'<button class="followup-tile '+(followUpFilter===key?'selected ':'')+'followup-'+key+'" data-followup="'+key+'" aria-pressed="'+(followUpFilter===key)+'"><span>'+label+'</span><strong>'+(key==='all'?Object.keys(current().saved).length:counts[key])+'</strong></button>').join('');
 $('#application-priority').value=plannerPriority;$('#application-order').value=plannerOrder;
 $('#export-applications').disabled=!Object.keys(current().saved).length;
 const board=ui.applicationsLayout==='board';
 for(const name of ['cards','board']){const on=board===(name==='board');$('#applications-'+name).classList.toggle('selected',on);$('#applications-'+name).setAttribute('aria-pressed',String(on));}
 $('.view-switch').hidden=visible&&board;
 $('#sort').disabled=visible&&plannerOrder!=='default';
}
function boardHTML(jobs){
 return APPLICATION_STAGES.filter(s=>stage==='all'||s===stage).map(s=>{
  const entries=jobs.filter(job=>current().saved[job.id]?.stage===s);
  return '<section class="board-column" aria-label="'+s+' applications"><header><h3>'+s+'</h3><span>'+entries.length+'</span></header><div class="board-items">'+(entries.length?entries.map(job=>{
   const entry=current().saved[job.id];
   return '<article class="board-card"><p class="board-company">'+esc(job.company)+'</p><button class="board-job-title" data-open="'+esc(job.id)+'">'+esc(job.title)+'</button><p class="board-location">'+esc(job.location)+'</p>'+freshnessHTML(job)+planPreview(entry)+'<label>Move to<select data-stage="'+esc(job.id)+'" aria-label="Application stage for '+esc(job.title)+'">'+APPLICATION_STAGES.map(value=>'<option '+(s===value?'selected':'')+'>'+value+'</option>').join('')+'</select></label><div class="board-card-actions"><button class="text-button" data-plan-open="'+esc(job.id)+'">Notes & plan ↗</button>'+compareButton(job)+'</div></article>';
  }).join(''):'<p class="board-empty">No matching jobs in this stage.</p>')+'</div></section>';
 }).join('');
}
function compareButton(job){const selected=comparisonJobs.has(job.id);return '<button class="compare-job '+(selected?'selected':'')+'" data-compare="'+esc(job.id)+'" aria-pressed="'+selected+'" aria-label="'+(selected?'Remove from comparison: ':'Compare job: ')+esc(job.title)+'">'+(selected?'✓ Selected':'＋ Compare')+'</button>';}
function toggleComparison(id){
 if(comparisonJobs.has(id))comparisonJobs.delete(id);
 else{const job=findJob(id);if(!job)return;if(comparisonJobs.size>=3){toast('Your shortlist has 3 jobs. Remove one to add another.');return;}comparisonJobs.set(id,job);}
 render();
 if($('#comparison-dialog').open)renderComparison();
 if($('#job-dialog').open&&selectedJobOwner===current().id){const button=$('#job-details [data-compare]');if(button){const on=comparisonJobs.has(selectedJob.id);button.classList.toggle('selected',on);button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',(on?'Remove from comparison: ':'Compare job: ')+selectedJob.title);button.textContent=on?'✓ Selected':'＋ Compare';}}
}
function renderComparisonTray(){
 for(const [id,job] of comparisonJobs)comparisonJobs.set(id,current().saved[id]?.job||jobs.find(j=>j.id===id)||job);
 const count=comparisonJobs.size;
 $('#comparison-tray').hidden=!count;document.body.classList.toggle('has-shortlist',Boolean(count));
 $('#comparison-count').textContent=count;$('#open-comparison').disabled=count<2;$('#compare-now').disabled=count<2;
 $('#comparison-tray-title').textContent=count+' of 3 selected'+(count===1?' · add another job':'');
 $('#comparison-chips').innerHTML=Array.from(comparisonJobs.values()).map(job=>'<button data-compare="'+esc(job.id)+'" title="Remove '+esc(job.title)+'" aria-label="Remove from comparison: '+esc(job.title)+'">'+esc(job.company)+' <span aria-hidden="true">×</span></button>').join('');
}
function renderComparison(){
 const jobs=Array.from(comparisonJobs.values()).map(job=>enrich(current().saved[job.id]?.job||job));
 if(jobs.length<2){$('#comparison-content').innerHTML='<div class="empty"><h3>Select at least two jobs.</h3><p>Close this panel and add another job from the results.</p></div>';return;}
 const rows=[
 ['Salary as listed',job=>esc(job.salary||'Not listed')],['Work arrangement',job=>esc(job.work||'Unspecified')],['Location',job=>esc(job.location)],['Location text check',job=>esc(job.locationCheck.label)+'<small>'+esc(job.locationCheck.note)+'</small>'],['Experience text check',job=>esc(job.experience.levelLabel)+'<small>'+esc(job.experience.label)+'</small>'],
 ['CV keyword overlap',job=>current().cv.text?(job.cvMatch.total?job.cvMatch.count+' of '+job.cvMatch.total+' skills mentioned<small>'+esc(job.cvMatch.shared.join(', ')||'No shared technical keywords identified')+'</small>':'No supported skills found in CV'):'Add a CV to compare keywords'],
 ['Your plan',job=>{const entry=current().saved[job.id];return entry?esc(entry.stage)+' · '+esc(normalizePlan(entry).priority)+' priority<small>'+esc(dueCopy(entry))+'</small><small>'+esc(normalizePlan(entry).nextAction)+'</small>':'Not saved';}],
 ['Saved AI review',job=>{const review=current().reviews[job.id];return review?'<span class="method-label method-ai">AI SUGGESTION</span><strong>'+esc(review.recommendation)+'</strong><p>'+esc(review.summary)+'</p><small>Based on your profile at review time. Confirm details.</small>':'No review yet. Open the job’s AI review panel to request one.';}],
 ['Listing website',job=>sourceBadges(job)],['Original listing',job=>'<a href="'+esc(safeLink(job.url))+'" target="_blank" rel="noopener noreferrer">Open job website ↗</a>']
 ];
 $('#comparison-content').innerHTML='<div class="comparison-scroll" tabindex="0" role="region" aria-label="Side-by-side job details"><table class="comparison-table"><thead><tr><th scope="col">Compare</th>'+jobs.map(job=>'<th scope="col"><span>'+esc(job.company)+'</span><h3>'+esc(job.title)+'</h3><button class="text-button" data-compare="'+esc(job.id)+'">Remove ×</button></th>').join('')+'</tr></thead><tbody>'+rows.map(([name,content])=>'<tr><th scope="row">'+name+'</th>'+jobs.map(job=>'<td>'+content(job)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function openComparison(){if(comparisonJobs.size<2)return;renderComparison();$('#comparison-dialog').showModal();}
$('#open-comparison').onclick=$('#compare-now').onclick=openComparison;
$('#clear-comparison').onclick=()=>{comparisonJobs.clear();render();};
$('#followup-summary').onclick=event=>{const button=event.target.closest('[data-followup]');if(button){followUpFilter=button.dataset.followup;page=1;render();}};
$('#application-priority').onchange=event=>{plannerPriority=event.target.value;page=1;render();};
$('#application-order').onchange=event=>{plannerOrder=event.target.value;page=1;render();};
for(const name of ['cards','board'])$('#applications-'+name).onclick=()=>{ui.applicationsLayout=name;persistUI();render();};
$('#stage-board').onchange=event=>{if(event.target.dataset.stage&&updateApplication(event.target.dataset.stage,{stage:event.target.value}))toast('Application moved.');};
$('#stage-board').onclick=event=>{const open=event.target.closest('[data-open]');if(open){const job=findJob(open.dataset.open);if(job){details(job,'listing');$('#job-dialog').showModal();}}};
// Shared buttons in cards, board, details, and comparison stay available after re-rendering.
document.addEventListener('click',event=>{
 const compare=event.target.closest('[data-compare]');if(compare){toggleComparison(compare.dataset.compare);return;}
 const plan=event.target.closest('[data-plan-open]');if(plan){const job=findJob(plan.dataset.planOpen);if(job){details(job,'notes');$('#job-dialog').showModal();}}
});
$('#export-applications').onclick=()=>{
 const blob=new Blob([applicationsCsv(current().saved)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='JobScout-applications-'+localDay()+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 toast('All saved applications from this profile exported, including notes and plans.');
};

$('#followup-alert').onclick=()=>{setView('saved');$('#application-hub').scrollIntoView({block:'start'});};

$('#planner-add-job').onclick=()=>openManual();


// Full page text stays transient. Saved sites retain bounded role summaries and scan history.
function siteWorkspace(id=current().id){if(!siteWorkspaces.has(id))siteWorkspaces.set(id,{url:'',text:'',report:null,error:'',filter:'',changeFilter:'all',changes:null});return siteWorkspaces.get(id);}
function openSiteScanner(){
 if($('#websites-dialog').open)$('#websites-dialog').close();
 const workspace=siteWorkspace();$('#site-scan-url').value=workspace.url;$('#site-scan-text').value=workspace.text;$('#site-scan-filter').value=workspace.filter;
 renderSiteScanner();$('#scanner-dialog').showModal();$('#site-scan-url').focus();
}
function siteForUrl(profile,url){let key;try{key=canonicalListingUrl(websiteUrl(url));}catch{return null;}return profile.websites.find(site=>canonicalListingUrl(site.url)===key);}
function savedScannedJob(job){return current().saved[job.id]||Object.values(current().saved).find(entry=>sameVacancy(entry.job,job)||canonicalListingUrl(entry.job.url)===canonicalListingUrl(job.url)&&entry.job.title.toLowerCase()===job.title.toLowerCase()&&entry.job.location===job.location);}
function renderSiteScanner(){
 const workspace=siteWorkspace(),report=workspace.report,run=siteScanRun,mine=run?.profileId===current().id,locked=Boolean(run||siteBatchRun);
 const button=$('#start-site-scan');if(!button)return;
 button.disabled=locked;button.textContent=locked?(mine?run.phase==='read'?'Reading public pages…':'AI is identifying roles…':'Another scan is running…'):'Scan for open roles ↗';
 $('#site-scan-url').disabled=$('#site-scan-text').disabled=locked;if(mine){$('#site-scan-url').value=workspace.url;$('#site-scan-text').value=workspace.text;}
 $('#cancel-site-scan').hidden=!mine;$('#scanner-edit-link').hidden=mine;
 $('#save-scan-site').disabled=locked||Boolean(siteForUrl(current(),workspace.url));$('#save-scan-site').textContent=siteForUrl(current(),workspace.url)?'✓ Website saved':'＋ Save website';
 $('#scanner-indicator').textContent=mine?'Working…':report?report.jobs.length+' found':'New';
 $('#site-scan-progress').textContent=run?(mine?run.phase==='read'?'Reading public pages and following careers links…':'Pages collected. Local AI is identifying roles from their text; this can take a few minutes.':'Another profile is scanning. Your results stay separate.'):workspace.cancelled?'Scan cancelled. Listings already read remain available.':report?report.aiComplete?report.cached?'Recent scan reused. Choose Read fresh pages for a new check.':report.aiSkipped?'Published job feed read. No AI extraction was needed.':'Scan complete. Review the source evidence and save the roles you want.':'Pages read. Structured listings appear below; run the AI step for roles in page text.':'Ready for a public careers link. The AI reads only the collected page text.';
 $('#site-scan-error').hidden=!workspace.error;$('#site-scan-error').textContent=workspace.error;
 $('#retry-scan-ai').hidden=!report||report.aiComplete===true;$('#retry-scan-ai').disabled=locked||Boolean(aiReview);
 $('#site-scan-report').hidden=!report;$('#read-fresh-scan').hidden=!report;$('#read-fresh-scan').disabled=locked;
 for(const [id,active,done] of [['read',mine&&run.phase==='read',Boolean(report)],['ai',mine&&run.phase==='ai',Boolean(report?.aiComplete)],['save',false,Boolean(report?.aiComplete)]]){const element=$('#scan-step-'+id);element.classList.toggle('running',active);element.classList.toggle('complete',done&&!active);}
 $('#scan-step-ai small').textContent=report?.aiSkipped?'Not needed':'Local AI';
 if(!report)return;
 const changes=workspace.changes,added=new Set(changes?.addedKeys||[]),needle=workspace.filter.trim().toLowerCase();
 const found=report.jobs.filter(job=>(workspace.changeFilter!=='new'||added.has(roleKey(job)))&&(!needle||[job.title,job.company,job.location].join(' ').toLowerCase().includes(needle)));
 $('#site-scan-count').textContent=report.jobs.length+' listed role'+(report.jobs.length===1?'':'s')+(needle||workspace.changeFilter==='new'?' · '+found.length+' shown':'');
 $('#site-scan-coverage').textContent=(report.pasted?'From text you pasted':report.readCount+' public page or feed'+(report.readCount===1?'':'s')+' read')+(report.cached?' · Recent result reused':'')+' · '+new Date(report.checkedAt).toLocaleString()+(report.limited?' · Scan limit reached; more roles may exist.':' · Availability needs checking.');
 $('#site-scan-summary').hidden=!report.summary;$('#site-scan-summary').textContent=report.summary?'Scan summary: '+report.summary:'';
 $('#scan-change-controls').hidden=!changes;$('#site-scan-changes').disabled=!changes?.compared;$('#site-scan-changes').value=workspace.changeFilter;
 $('#scan-change-summary').textContent=changes?.compared?added.size+' new · '+changes.notSeen.length+' not seen since '+new Date(changes.baselineAt).toLocaleString()+'. Check the watchlist for missing-role links.':changes?.reason||'';
 $('#site-scan-jobs').innerHTML=found.length?found.map(job=>{
  const saved=savedScannedJob(job);
  return '<article class="scan-job"><div class="scan-job-top"><span class="method-label '+(job.method==='ai'?'method-ai':'method-auto')+'">'+(job.method==='ai'?'AI IDENTIFIED · SOURCE TEXT':job.method==='feed'?'PUBLIC JOB FEED':'STRUCTURED LISTING')+'</span><span class="small muted">'+esc(job.company)+'</span></div>'+(added.has(roleKey(job))?'<span class="change-badge">＋ New since last full scan</span>':'')+'<h4>'+esc(job.title)+'</h4><p class="scan-job-location">'+esc(job.location)+' · '+esc(job.work)+'</p><blockquote><span>Source evidence</span>'+esc(job.evidence||job.title)+'</blockquote><div class="scan-job-links"><a href="'+esc(safeLink(job.url))+'" target="_blank" rel="noopener noreferrer">Open listing ↗</a><a href="'+esc(safeLink(job.pageUrl||job.url))+'" target="_blank" rel="noopener noreferrer">Source page ↗</a></div><div class="scan-job-actions"><button class="secondary" data-scan-open="'+esc(job.id)+'">Read details</button><button class="'+(saved?'secondary':'primary')+'" data-scan-save="'+esc(job.id)+'" '+(saved?'disabled':'')+'>'+(saved?'✓ In My applications':'Save job ＋')+'</button></div></article>';
 }).join(''):'<div class="scan-empty"><strong>'+(needle||workspace.changeFilter==='new'?'No roles match this filter.':'No roles could be verified in the text read.')+'</strong><p>'+(needle||workspace.changeFilter==='new'?'Try another filter.':'This does not establish that the company has no vacancies. Try a direct careers link or pasted page text.')+'</p></div>';
 $('#scan-coverage-title').textContent='Pages checked · '+report.pages.length+' read or skipped';
 $('#site-scan-pages').innerHTML=report.pages.map(page=>'<div class="scan-page"><span class="scan-page-state '+(page.status==='skipped'?'skipped':'')+'">'+(page.status==='pasted'?'Pasted':page.status==='read'?'Read':'Skipped')+'</span><div><a href="'+esc(safeLink(page.url))+'" target="_blank" rel="noopener noreferrer">'+esc(page.url)+'</a><p>'+esc(page.note)+'</p></div></div>').join('');
}
function saveScanHistory(owner,siteId,report,options){
 const profile=state.profiles.find(p=>p.id===owner),site=profile?.websites.find(s=>s.id===siteId);if(!site)return;
 let updated;try{updated=recordWebsiteScan(site,report,options);}catch(error){toast(error.message);return;}
 if(commitProfile({websites:profile.websites.map(s=>s.id===siteId?updated:s)},owner))siteWorkspace(owner).changes=updated.changes;
}
async function executeSiteScan(run,{url,text='',force=true,siteId=null,aiOnly=false}){
 const workspace=siteWorkspace(run.profileId),scanModel=state.profiles.find(p=>p.id===run.profileId)?.preferences.model||'';siteScanRun=run;
 workspace.url=url;workspace.text=text;workspace.filter='';workspace.changeFilter='all';workspace.changes=null;workspace.error='';workspace.cancelled=false;if(!aiOnly)workspace.report=null;
 $('#site-scan-filter').value='';renderSiteScanner();renderWebsites();updateAiUI();
 try{
  if(!aiOnly)workspace.report=await api('/api/scan/collect',{url,pastedText:text,force},run.controller.signal);
  run.controller.signal.throwIfAborted();
  if(!workspace.report.aiComplete){
   await status();run.controller.signal.throwIfAborted();
   if(!connectionCopy().ready||aiReview||aiConnection?.busy)throw Error('Pages read. Open Ollama or wait for the current AI request, then choose Try the AI step again.');
   run.phase='ai';renderSiteScanner();renderWebsites();updateAiUI();
   workspace.report=await api('/api/scan/analyze',{scanId:workspace.report.scanId,model:scanModel},run.controller.signal);
  }
 }catch(error){workspace.cancelled=run.controller.signal.aborted;workspace.error=workspace.cancelled?'':error.message;}
 finally{
  if(siteId)saveScanHistory(run.profileId,siteId,workspace.report,{error:workspace.error,cancelled:workspace.cancelled});
  if(siteScanRun===run)siteScanRun=null;
  renderSiteScanner();renderWebsites();updateAiUI();
  if(!siteBatchRun&&workspace.report)revealSiteResults(run.profileId);
  status();
 }
}
async function startSiteScan(force=false){
 if(siteScanRun||siteBatchRun)return;
 const workspace=siteWorkspace(),url=$('#site-scan-url').value.trim(),text=$('#site-scan-text').value;
 const run={profileId:current().id,phase:'read',controller:new AbortController()};
 await executeSiteScan(run,{url,text,force,siteId:siteForUrl(current(),url)?.id});
}
function cancelSiteScans(){if(siteBatchRun)siteBatchRun.cancelled=true;siteScanRun?.controller.abort();renderWebsites();}
$('#open-scanner').onclick=$('#planner-scan-site').onclick=openSiteScanner;
$('#site-scan-url').oninput=event=>{const workspace=siteWorkspace();workspace.url=event.target.value;if(workspace.report&&canonicalListingUrl(workspace.report.root)!==canonicalListingUrl(workspace.url)){workspace.report=null;workspace.changes=null;workspace.error='';workspace.cancelled=false;renderSiteScanner();}else renderSiteSaveButton();};
function renderSiteSaveButton(){const saved=Boolean(siteForUrl(current(),siteWorkspace().url));$('#save-scan-site').disabled=Boolean(siteScanRun||siteBatchRun)||saved;$('#save-scan-site').textContent=saved?'✓ Website saved':'＋ Save website';}
$('#site-scan-text').oninput=event=>{const workspace=siteWorkspace();workspace.text=event.target.value;if(workspace.report){workspace.report=null;workspace.changes=null;workspace.error='';workspace.cancelled=false;renderSiteScanner();}};
$('#site-scan-filter').oninput=event=>{const owner=current().id;siteWorkspace().filter=event.target.value;clearTimeout(scanRenderTimer);scanRenderTimer=setTimeout(()=>{if(current().id===owner)renderSiteScanner();},140);};
$('#site-scan-changes').onchange=event=>{siteWorkspace().changeFilter=event.target.value;renderSiteScanner();};
$('#site-scan-form').onsubmit=event=>{event.preventDefault();startSiteScan();};
$('#read-fresh-scan').onclick=()=>startSiteScan(true);
$('#cancel-site-scan').onclick=$('#cancel-website-batch').onclick=cancelSiteScans;
$('#retry-scan-ai').onclick=async()=>{
 if(siteScanRun||siteBatchRun||aiReview)return;
 const workspace=siteWorkspace();if(!workspace.report)return;
 await executeSiteScan({profileId:current().id,phase:'ai',controller:new AbortController()},{url:workspace.url,text:workspace.text,siteId:siteForUrl(current(),workspace.url)?.id,aiOnly:true});
};
$('#site-scan-jobs').onclick=event=>{
 const save=event.target.closest('[data-scan-save]'),open=event.target.closest('[data-scan-open]');
 const id=save?.dataset.scanSave||open?.dataset.scanOpen,job=siteWorkspace().report?.jobs.find(job=>job.id===id);if(!job)return;
 if(save){if(savedScannedJob(job))return;if(commitProfile({saved:{...current().saved,[job.id]:{job,...normalizePlan(),stage:'Saved',notes:'',savedAt:new Date().toISOString()}}})){render();toast('Discovered role saved to My applications.');}}
 if(open){$('#scanner-dialog').close();details(job,'listing');$('#job-dialog').showModal();}
};
function revealSiteResults(owner){if(owner!==current().id||!$('#scanner-dialog').open||document.activeElement===$('#site-scan-filter'))return;const heading=$('#site-scan-count');heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'smooth'});}
$('#scanner-edit-link').onclick=()=>{$('#site-scan-url').focus();$('#site-scan-form').scrollIntoView({block:'start',behavior:'smooth'});};

function addSavedWebsite(url,name=''){
 try{
  const result=addWebsite(current().websites,{url,name,id:'site-'+crypto.randomUUID()});
  if(!commitProfile({websites:result.sites}))return;
  const workspace=siteWorkspace();if(!result.existing&&workspace.report&&canonicalListingUrl(workspace.report.root)===canonicalListingUrl(result.site.url))saveScanHistory(current().id,result.site.id,workspace.report,{error:workspace.error,cancelled:workspace.cancelled});
  renderWebsites();renderSiteSaveButton();toast(result.existing?'Website is already saved.':'Website saved to this profile’s watchlist.');return true;
 }catch(error){$('#website-form-message').textContent=error.message;toast(error.message);return false;}
}
$('#save-scan-site').onclick=()=>addSavedWebsite($('#site-scan-url').value.trim());
function openWebsites(){if($('#scanner-dialog').open)$('#scanner-dialog').close();renderWebsites();$('#websites-dialog').showModal();}
$('#open-websites').onclick=$('#scanner-saved-sites').onclick=openWebsites;
$('#website-form').onsubmit=event=>{event.preventDefault();$('#website-form-message').textContent='';if(addSavedWebsite($('#website-url').value,$('#website-name').value))$('#website-form').reset();};

function roleLinks(items){return '<ul class="watch-role-links">'+items.map(j=>'<li><a href="'+esc(safeLink(j.url))+'" target="_blank" rel="noopener noreferrer">'+esc(j.title)+' ↗</a><span>'+esc(j.location)+'</span></li>').join('')+'</ul>';}
function renderWebsites(){
 const sites=current().websites,owner=current().id,locked=Boolean(siteScanRun||siteBatchRun),batch=siteBatchRun,mine=batch?.profileId===owner;
 $('#watchlist-indicator').textContent=sites.length?sites.length+'/'+MAX_WEBSITES:'New';
 $('#website-count').textContent=sites.length+' of '+MAX_WEBSITES+' websites · this profile';
 $('#scan-all-websites').disabled=locked||!sites.length;
 const retry=sites.filter(s=>['failed','partial','cancelled'].includes(s.history[0]?.status));
 $('#retry-failed-websites').disabled=locked||!retry.length;$('#retry-failed-websites').textContent='Retry unfinished ('+retry.length+')';
 $('#website-form button').disabled=locked||sites.length>=MAX_WEBSITES;
 $('#website-batch-status').textContent=batch?(mine?(batch.cancelled?'Cancelling… ':batch.completed+' of '+batch.total+' finished · ')+(siteScanRun?.profileId===owner?(siteScanRun.phase==='read'?'reading pages':'local AI checking roles'):'preparing next website'):'Another profile is scanning.'):siteScanRun?(siteScanRun.profileId===owner?'Scanning one website…':'Another profile is scanning.'):siteWorkspace().batchMessage||'Choose Scan all when you want a fresh check. Websites are checked one at a time.';
 $('#website-batch-progress').hidden=!mine;$('#website-batch-progress').max=batch?.total||1;$('#website-batch-progress').value=batch?.completed||0;
 $('#cancel-website-batch').hidden=!locked;
 const openDetails=new Set([...$('#website-list').querySelectorAll('details[open]')].map(d=>d.dataset.detail));
 $('#website-list').innerHTML=sites.length?sites.map(site=>{
  const latest=site.history[0],running=siteScanRun?.profileId===owner&&siteScanRun.siteId===site.id,changes=site.changes,snapshot=site.snapshot;
  const newRoles=snapshot?.items.filter(j=>changes.addedKeys.includes(roleKey(j)))||[];
  const detailId=site.id+'-changes',historyId=site.id+'-history';
  return '<article class="watched-site"><div class="watched-site-heading"><div><h3>'+esc(site.name)+'</h3><a href="'+esc(site.url)+'" target="_blank" rel="noopener noreferrer">'+esc(new URL(site.url).hostname+new URL(site.url).pathname)+' ↗</a></div><span class="watch-status">'+(running?siteScanRun.phase==='read'?'Reading…':'Local AI…':latest?scanStatus[latest.status]:'Not scanned')+'</span></div><p class="watch-last-check">'+(latest?new Date(latest.at).toLocaleString()+' · '+latest.total+' roles read':'Save a baseline with your first full scan.')+'</p>'+(latest&&latest.status!=='complete'?'<p class="watch-limit">'+esc(latest.note)+'</p>':'')+(changes.compared?'<div class="watch-change-counts"><span><strong>'+newRoles.length+'</strong> new</span><span><strong>'+changes.notSeen.length+'</strong> not seen</span></div>':'')+'<div class="watch-actions"><button class="primary" data-website-scan="'+esc(site.id)+'" '+(locked?'disabled':'')+'>'+(latest&&latest.status!=='complete'?'Retry website':'Scan now')+'</button><button class="secondary" data-website-open="'+esc(site.id)+'" '+(locked?'disabled':'')+'>Open scanner</button><button class="text-button" data-website-rename="'+esc(site.id)+'" '+(locked?'disabled':'')+'>Rename</button><button class="text-button" data-website-remove="'+esc(site.id)+'" '+(locked?'disabled':'')+'>Remove</button></div>'+(snapshot?'<details data-detail="'+detailId+'" '+(openDetails.has(detailId)?'open':'')+'><summary>Latest roles & changes</summary><p class="small muted">Full snapshot from '+new Date(snapshot.at).toLocaleString()+'. '+esc(changes.reason)+'</p>'+(changes.compared?'<h4>New since the previous full scan · '+newRoles.length+'</h4>'+roleLinks(newRoles)+'<h4>Not seen in the latest full scan · '+changes.notSeen.length+'</h4><p class="small muted">These roles may have moved or closed. Check each original link; no closure is confirmed.</p>'+roleLinks(changes.notSeen):'')+'<h4>Roles in the full snapshot · '+snapshot.items.length+'</h4>'+roleLinks(snapshot.items)+'</details>':'')+(site.history.length?'<details data-detail="'+historyId+'" '+(openDetails.has(historyId)?'open':'')+'><summary>Scan history · '+site.history.length+' of 8 kept</summary><ol class="watch-history">'+site.history.map(h=>'<li><div><strong>'+scanStatus[h.status]+'</strong><time>'+new Date(h.at).toLocaleString()+'</time></div><p>'+h.total+' roles · '+h.readCount+' pages/feeds · '+h.newCount+' new · '+h.notSeenCount+' not seen</p><small>'+esc(h.note)+'</small></li>').join('')+'</ol></details>':'')+'</article>';
 }).join(''):'<div class="scan-empty"><strong>Keep your favourite employers here.</strong><p>Add a company or careers link, then scan it whenever you want to check for changes.</p></div>';
}
async function scanWebsiteBatch(ids){
 if(siteScanRun||siteBatchRun||!ids.length)return;
 const batch={profileId:current().id,total:ids.length,completed:0,cancelled:false};siteBatchRun=batch;renderWebsites();renderSiteScanner();
 try{await runWebsiteQueue(ids,async id=>{
  const profile=state.profiles.find(p=>p.id===batch.profileId),site=profile?.websites.find(s=>s.id===id);if(!site)return;
  const run={profileId:batch.profileId,siteId:id,phase:'read',controller:new AbortController()};
  await executeSiteScan(run,{url:site.url,siteId:id,force:true});batch.completed++;renderWebsites();
 },()=>batch.cancelled);}finally{siteWorkspace(batch.profileId).batchMessage=(batch.cancelled?'Stopped after ':'Finished ')+batch.completed+' of '+batch.total+' websites. Previous full snapshots are kept for unfinished scans.';if(siteBatchRun===batch)siteBatchRun=null;renderWebsites();renderSiteScanner();updateAiUI();}
}
$('#scan-all-websites').onclick=()=>scanWebsiteBatch(current().websites.map(s=>s.id));
$('#retry-failed-websites').onclick=()=>scanWebsiteBatch(current().websites.filter(s=>['failed','partial','cancelled'].includes(s.history[0]?.status)).map(s=>s.id));
$('#website-list').onclick=event=>{
 const button=event.target.closest('button');if(!button)return;
 const id=button.dataset.websiteScan||button.dataset.websiteOpen||button.dataset.websiteRename||button.dataset.websiteRemove,site=current().websites.find(s=>s.id===id);if(!site)return;
 if(button.dataset.websiteScan)scanWebsiteBatch([id]);
 if(button.dataset.websiteOpen){const workspace=siteWorkspace();if(!workspace.report||canonicalListingUrl(workspace.report.root)!==canonicalListingUrl(site.url)){workspace.report=null;workspace.error='';workspace.filter='';workspace.cancelled=false;workspace.changes=site.changes;}workspace.url=site.url;workspace.text='';openSiteScanner();}
 if(button.dataset.websiteRename){const name=prompt('Website name',site.name);if(name?.trim()&&commitProfile({websites:current().websites.map(s=>s.id===id?{...s,name:name.trim().slice(0,70)}:s)}))renderWebsites();}
 if(button.dataset.websiteRemove&&confirm('Remove '+site.name+' and its scan history from this profile? Your saved applications will stay.')){if(commitProfile({websites:current().websites.filter(s=>s.id!==id)})){renderWebsites();renderSiteSaveButton();}}
};

function matchHTML(job,expanded=false){
 const reasons=job.matchReasons||[];
 return '<details class="why-match" '+(expanded?'open':'')+'><summary>'+(currentView==='saved'?'Match checks':'Why this result?')+' <span>Automatic</span></summary><ul>'+reasons.map(r=>'<li class="reason-'+esc(r.kind)+'"><strong>'+esc(r.label)+'</strong><span>'+esc(r.text)+'</span></li>').join('')+'</ul><p>Based on listing text and '+(currentView==='discover'?'your last search':'your current preferences')+'. Keyword mentions do not verify proficiency.</p></details>';
}
function freshnessHTML(job){
 const f=freshnessFor(job,current().availability),stamp=f.checkedAt||f.fetchedAt;
 return '<div class="listing-freshness state-'+esc(f.state)+'"><span>'+esc(f.label)+'</span><small>'+(stamp?esc((f.checkedAt?'Checked ':'Feed retrieved ')+new Date(stamp).toLocaleString()):'Open the listing to check')+'</small></div>';
}
function updateAvailability(){
 const target=$('#listing-availability');if(!target||!selectedJob||selectedJobOwner!==current().id)return;
 const job=selectedJob,f=freshnessFor(job,current().availability),running=availabilityRun?.key===availabilityKey(job)&&availabilityRun?.owner===current().id;
 target.innerHTML='<section class="availability-panel" aria-label="Source availability"><div><span class="method-label method-auto">SOURCE CHECK · NO AI</span><h3>'+esc(f.label)+'</h3></div><button id="check-listing" class="secondary" '+(availabilityRun?'disabled':'')+'>'+(running?'Checking source…':availabilityRun?'Another check is running':'↻ Check listing status')+'</button><p role="status">'+esc(running?'Reading this listing or its public job API…':f.note||f.hint)+'</p>'+(f.evidence?'<blockquote>'+esc(f.evidence)+'</blockquote>':'')+'<small>'+(f.checkedAt?'Checked '+esc(new Date(f.checkedAt).toLocaleString())+'. ':f.fetchedAt?'Last retrieved from the feed '+esc(new Date(f.fetchedAt).toLocaleString())+'. ':'')+(f.old?'This result is over a day old. ':'')+'Checks may reuse a result for 10 minutes. Your application stage and notes are kept.'+(job.sourceLinks?.length>1?' This check covers the primary source link; other source links may differ.':'')+'</small></section>';
 $('#check-listing').onclick=()=>checkListing(job);
}
async function checkListing(job){
 if(availabilityRun)return;
 const owner=current().id,key=availabilityKey(job);availabilityRun={owner,key};updateAvailability();
 try{const check=await api('/api/jobs/check',{url:job.url,title:job.title});const profile=state.profiles.find(p=>p.id===owner);if(profile){if(!commitProfile({availability:recordAvailability(profile.availability,job,check)},owner))return;if(owner===current().id)toast(check.cached?'Showing a recent source check.':'Source check saved.');}}
 catch(error){if(owner===current().id)toast('Could not check the listing: '+error.message);}
 finally{availabilityRun=null;render();updateAvailability();}
}
