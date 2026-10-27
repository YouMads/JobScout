import {normalizeCountryPreferences} from './countries.mjs';
import {mergeVacancies} from './duplicates.mjs';
import {experienceSignals,locationSignals} from './matching.mjs';
export function text(value='') {
  return String(value).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
export function safeUrl(value) { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:''; } catch{return '';} }
export const isCyprus = s => /cyprus|nicosia|limassol|larnaca|paphos|pafos|famagusta|lefkosi/i.test(s);
export function eligibility(job,country='CY') {
 return locationSignals(job,country).label;
}
export function skillMention(hay,skill){
 const variants=({js:['js','javascript'],ts:['ts','typescript'],react:['react','reactjs'],'node.js':['node.js','nodejs'],'c#':['c#','csharp'],'.net':['.net','dotnet']})[skill]||[skill];
 return variants.some(s=>new RegExp('(^|[^a-z0-9+#])'+s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^a-z0-9+#])','i').test(hay));
}
const roles={
 'Software developer':/\bdevelopers?\b|software|programmer|full.?stack|front.?end|back.?end|\b(ai|machine learning|data|platform|devops|cloud)\b.*engineer/i,
 'Frontend developer':/front.?end|\breact(?:js)?\b|\bangular\b|\bvue\b|web developer/i,
 'Backend developer':/back.?end|full.?stack|\bpython\b|\bjava\b|\.net|\bnode(?:\.js)?\b|\bgolang\b|\bgo\b|\bruby\b|\bphp\b|\brust\b|c#/i,
 'Full stack developer':/full.?stack/i,
 'QA / Testing':/\bqa\b|\btest(?:ing)?\b|quality assurance|\bsdet\b/i,
 'DevOps / Cloud':/devops|\bsre\b|(?:cloud|infrastructure|platform|site reliability).*engineer/i,
 'Data / AI':/\bdata\b|machine learning|\bai\b|analytics/i,
 'Any role':/./
};
export function roleMatches(job,role='Software developer'){
 const title=String(job.title||'');if(role==='Any role')return true;
 if(/business develop|developer (?:relations|advocate)|sales engineer/i.test(title))return false;
 if(role==='Backend developer'&&!/back.?end|full.?stack/i.test(title)&&(!/\b(?:developer|engineer|programmer)\b/i.test(title)||/front.?end|\bjavascript\b|\bdata\b|scientist|machine learning|\bmobile\b|\bios\b|\bandroid\b/i.test(title)&&! /\bnode(?:\.js)?\b/i.test(title)))return false;
 return (roles[role]||roles['Software developer']).test(title);
}
export function explainMatch(job,p={}){
 const country=p.country||'CY',location=locationSignals(job,country),experience=experienceSignals(job),skills=[...new Set(String(p.skills||'').split(',').map(s=>s.trim()).filter(Boolean))];
 const hay=[job.title,job.description,...(job.tags||[])].join(' ').toLowerCase(),hits=skills.filter(s=>skillMention(hay,s.toLowerCase())),years=p.years!==''&&p.years!==undefined?Number(p.years):p.level==='Intern / Junior'?2:null;
 const levelConflict=p.level==='Intern / Junior'&&['experienced','conflict','mixed'].includes(experience.category)||p.level==='Mid-level'&&/\b(?:junior|intern|senior|lead|principal|staff|manager|architect|founding)\b/i.test(job.title);
 const role=roleMatches(job,p.role),above=years!==null&&Number.isFinite(years)&&experience.minimumYears!==null&&experience.minimumYears>years;
 return [
 {kind:role?'match':'check',label:'Role',text:role?'Title matches '+(p.role||'Software developer')+'.':'Title does not match your current role filter.'},
 {kind:location.restrictionConflict||location.tzExcluded?'conflict':location.confirmedLead?'match':'check',label:'Location',text:location.label+'.'+(location.restrictionConflict?' '+location.restrictionEvidence:'')},
 {kind:above||levelConflict?'conflict':experience.category==='unknown'||experience.alternativeEvidence?'check':'match',label:'Experience',text:above?experience.minimumYears+'+ required years exceeds your '+years+'-year limit.':levelConflict?'Listing seniority conflicts with your '+p.level+' filter.':experience.alternativeEvidence?experience.label+'. '+experience.alternativeEvidence:experience.levelLabel+'. '+experience.label+'.'},
 {kind:hits.length?'match':'check',label:'Skills',text:skills.length?hits.length+' of '+skills.length+' search skills mentioned'+(hits.length?': '+hits.slice(0,6).join(', '):'')+'.':'Add skills to compare keyword mentions.'}
 ];
}
export function matchJobs(jobs,p={}) {
 p=normalizeCountryPreferences(p);
 const skills=[...new Set(String(p.skills||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean))];
 const userYears=p.years!==''&&p.years!==undefined&&Number.isFinite(Number(p.years))?Number(p.years):null;
 const yearLimit=userYears??(p.level==='Intern / Junior'?2:null);
 return jobs.map(j=>({...j,experience:experienceSignals(j),locationCheck:locationSignals(j,p.country)})).filter(j=>{
  if (!roleMatches(j,p.role)) return false;
  if(p.level==='Intern / Junior'&&p.juniorEvidence==='explicit'&&j.experience.category!=='junior')return false;
  if(p.level==='Intern / Junior'&&p.juniorEvidence==='early'&&!['junior','early'].includes(j.experience.category))return false;
  const cy=j.locationCheck.countryListed;
  if(p.area==='local'&&!cy)return false;
  if(p.area==='remote'&&!j.remote)return false;
  if(p.area==='local_remote'&&!cy&&!j.remote)return false;
  if(p.city&&p.city!=='Any city'&&cy&&!j.location.toLowerCase().includes(p.city.toLowerCase()))return false;
  if(p.remoteScope!=='all'&&j.locationCheck.restrictionConflict)return false;
  if(p.remoteScope==='confirmed'&&j.remote&&!j.locationCheck.confirmedLead)return false;
  if(p.remoteScope!=='all'&&j.remote&&(j.locationCheck.tzExcluded||(!cy&&!j.locationCheck.worldwide&&!j.locationCheck.region)))return false;
  if(p.work&&p.work!=='Any'&&j.work!==p.work)return false;
  if(p.level==='Intern / Junior'&&/senior|\bsr\b|staff|principal|lead|manager|architect|founding|head of/i.test(j.title))return false;
  if(p.level==='Senior'&&!/senior|\bsr\b|staff|principal|lead/i.test(j.title))return false;
  if(p.level==='Mid-level'&&/intern|junior|senior|\bsr\b|staff|principal|lead|manager|architect|founding|head of/i.test(j.title))return false;
  if(p.experienceMode!=='flag'&&yearLimit!==null&&j.experience.minimumYears!==null&&j.experience.minimumYears>yearLimit)return false;
  if(p.query&&!`${j.title} ${j.company} ${j.description}`.toLowerCase().includes(p.query.toLowerCase()))return false;
  return true;
 }).map(j=>{
  const hay=`${j.title} ${j.description} ${(j.tags||[]).join(' ')}`.toLowerCase();
  const hits=skills.filter(s=>skillMention(hay,s));
  return {...j,hits,score:skills.length?Math.round(100*hits.length/skills.length):null,eligibility:j.locationCheck.label,experienceAboveProfile:yearLimit!==null&&j.experience.minimumYears>yearLimit};
 }).sort((a,b)=>(b.score??0)-(a.score??0)||Number(b.locationCheck.countryListed)-Number(a.locationCheck.countryListed)||String(b.date).localeCompare(String(a.date)));
}
export const deduplicate=mergeVacancies;
