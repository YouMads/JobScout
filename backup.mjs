import {normalizeSavedSearches} from './saved-searches.mjs';
import {normalizeAvailability,expiryISO} from './freshness.mjs';
import {normalizeCountryPreferences} from './countries.mjs';
import {normalizeWatchlist} from './watchlist.mjs';
import {normalizeTracking,normalizeCv,normalizeEnabled,normalizePlan,APPLICATION_STAGES} from './workspace.mjs';
import {normalizeBlocks} from './description.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const str=(v,max=1000)=>typeof v==='string'?v.slice(0,max):'';
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const link=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const prefs=['country','model','role','area','city','level','work','skills','query','remoteScope','background','years','experienceMode','juniorEvidence'];
export function makeBackup(state){return {format:'jobscout-backup',version:1,exportedAt:new Date().toISOString(),profiles:state.profiles};}
export function readBackup(data){
 if(!object(data)||data.format!=='jobscout-backup'||data.version!==1||!Array.isArray(data.profiles)||!data.profiles.length||data.profiles.length>30)throw Error('Choose a supported JobScout backup containing 1–30 profiles.');
 return data.profiles.map(p=>{
  if(!object(p)||!str(p.name,50).trim()||!object(p.preferences)||!object(p.saved)||!object(p.reviews))throw Error('A profile in this backup is incomplete.');
  if(Object.keys(p.saved).length>500||Object.keys(p.reviews).length>500)throw Error('A backup profile contains too many entries (maximum 500).');
  const preferences=Object.fromEntries(prefs.filter(k=>k in p.preferences).map(k=>[k,str(p.preferences[k],k==='background'?3500:600)]));
  const saved=Object.create(null),reviews=Object.create(null);
  for(const [key,s]of Object.entries(p.saved)){
   if(!id(key)||!object(s)||!object(s.job)||s.job.id!==key||!link(s.job.url)||!str(s.job.title)||!str(s.job.company))throw Error('A saved job has an invalid ID, title, company, or link. Nothing was imported.');
   const j=s.job;
   const job={id:key,title:str(j.title,300),company:str(j.company,200),location:str(j.location,2000),description:str(j.description,40000),url:link(j.url),source:str(j.source,100),remote:j.remote===true,work:str(j.work,50),date:str(j.date,60),dateLabel:str(j.dateLabel,30),salary:str(j.salary,200),tags:Array.isArray(j.tags)?j.tags.slice(0,100).map(t=>str(t,100)):[]};
   if(j.manual===true)job.manual=true;
   job.fetchedAt=expiryISO(j.fetchedAt);job.expiresAt=expiryISO(j.expiresAt);
   if(Array.isArray(j.descriptionBlocks))job.descriptionBlocks=normalizeBlocks(j.descriptionBlocks);
   if(Array.isArray(j.timezoneRestrictions))job.timezoneRestrictions=j.timezoneRestrictions.filter(n=>Number.isFinite(n)&&n>=-12&&n<=14);
   if(Array.isArray(j.sourceLinks))job.sourceLinks=j.sourceLinks.slice(0,15).filter(l=>object(l)&&link(l.url)).map(l=>({name:str(l.name,100),url:link(l.url)}));
   if(!job.sourceLinks?.length)job.sourceLinks=[{name:job.source,url:job.url}];
   saved[key]={job,...normalizePlan(s),stage:APPLICATION_STAGES.includes(s.stage)?s.stage:'Saved',notes:str(s.notes,3000),savedAt:str(s.savedAt,60)};
  }
  for(const [key,r]of Object.entries(p.reviews)){
   if(!id(key)||!object(r)||!Array.isArray(r.strengths)||!Array.isArray(r.gaps))throw Error('An AI review in this backup is invalid. Nothing was imported.');
   reviews[key]={country:str(r.country,2)||'CY',model:str(r.model,160),cvUsed:r.cvUsed===true,reviewedAt:str(r.reviewedAt,60),cvUpdatedAt:str(r.cvUpdatedAt,60),summary:str(r.summary,4000),recommendation:str(r.recommendation,2000),locationNote:str(r.locationNote,2000),strengths:r.strengths.slice(0,10).map(v=>str(v,1000)),gaps:r.gaps.slice(0,10).map(v=>str(v,1000))};
  }
  return {name:str(p.name,50).trim(),preferences:normalizeCountryPreferences(preferences),setupComplete:true,savedSearches:normalizeSavedSearches(p.savedSearches),saved,reviews,availability:normalizeAvailability(p.availability),tracking:normalizeTracking(p.tracking),cv:normalizeCv(p.cv),enabledSources:normalizeEnabled(p.enabledSources),websites:normalizeWatchlist(p.websites)};
 });
}
