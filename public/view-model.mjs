import {explainMatch} from '../lib.mjs';
import {freshnessFor} from '../freshness.mjs';
// Pure view transformations shared by the browser and the test runner.
import {APPLICATION_STAGES} from '../workspace.mjs';
import {experienceSignals,locationSignals} from '../matching.mjs';
import {compareCv} from '../candidate.mjs';
export const STAGES=APPLICATION_STAGES;
export function filterResults(jobs,{website='all',query='',salaryOnly=false,stage='all',saved={},sort='match',availability={},freshness='all'}={}){
 const needle=query.trim().toLowerCase();
 return jobs.filter(j=>{
  const check=freshness!=='all'?freshnessFor(j,availability):null;
  if(freshness==='exclude_closed'&&check.state==='closed'||freshness==='needs_check'&&check.state==='listed'&&!check.old)return false;
  const links=j.sourceLinks||[{name:j.source}];
  return (website==='all'||links.some(s=>s.name===website))&&(!salaryOnly||Boolean(j.salary?.trim()))&&(!needle||`${j.title} ${j.company} ${j.description} ${(j.tags||[]).join(' ')}`.toLowerCase().includes(needle))&&(stage==='all'||saved[j.id]?.stage===stage);
 }).sort((a,b)=>sort==='company'?a.company.localeCompare(b.company):sort==='new'?String(b.date).localeCompare(String(a.date)):sort==='cv'?(b.cvMatch?.count??0)-(a.cvMatch?.count??0)||String(b.date).localeCompare(String(a.date)):(b.score??-1)-(a.score??-1)||String(b.date).localeCompare(String(a.date)));
}
export function paginate(items,page=1,size=12){
 const pages=Math.max(1,Math.ceil(items.length/size));
 const current=Math.min(Math.max(1,page),pages);
 return {items:items.slice((current-1)*size,current*size),page:current,pages,total:items.length,start:items.length?(current-1)*size+1:0,end:Math.min(current*size,items.length)};
}
export function pipelineCounts(saved){
 const result=Object.fromEntries(STAGES.map(s=>[s,0]));
 for(const entry of Object.values(saved)){if(Object.hasOwn(result,entry.stage))result[entry.stage]++;}
 return result;
}

// Keep expensive description checks while the job object and CV text are unchanged.
export function createJobEnricher(){
 const cache=new WeakMap();
 return (job,cv,country='CY',preferences={})=>{
  const cvText=cv?.text||'',prefKey=JSON.stringify([preferences.role,preferences.level,preferences.years,preferences.skills]),hit=cache.get(job);
  if(hit?.cvText===cvText&&hit.country===country&&hit.prefKey===prefKey)return hit.value;
  const value={...job,experience:experienceSignals(job),locationCheck:locationSignals(job,country),cvMatch:compareCv(job,cv||{}),matchReasons:explainMatch(job,{...preferences,country})};
  const record={cvText,country,prefKey,value};cache.set(job,record);cache.set(value,record);return value;
 };
}
