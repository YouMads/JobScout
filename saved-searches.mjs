import {normalizeCountryPreferences} from './countries.mjs';
import {normalizeEnabled} from './workspace.mjs';
export const MAX_SAVED_SEARCHES=20;
const fields=['country','role','area','city','level','work','skills','query','remoteScope','years','experienceMode','juniorEvidence'];
export function searchPreferences(value={}){
 const clean=Object.fromEntries(fields.filter(k=>typeof value?.[k]==='string').map(k=>[k,value[k].slice(0,600)]));
 const normalized=normalizeCountryPreferences({role:'Software developer',city:'Any city',level:'Any level',work:'Any',skills:'',query:'',remoteScope:'likely',years:'',experienceMode:'strict',juniorEvidence:'all',...clean});
 return Object.fromEntries(fields.filter(k=>typeof normalized[k]==='string').map(k=>[k,normalized[k]]));
}
export function normalizeSavedSearches(value){
 const seen=new Set();
 return (Array.isArray(value)?value:[]).filter(s=>{
  if(!s||typeof s.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(s.id)||seen.has(s.id)||typeof s.name!=='string'||!s.name.trim())return false;
  seen.add(s.id);return true;
 }).slice(0,MAX_SAVED_SEARCHES).map(s=>({id:s.id,name:s.name.trim().slice(0,60),preferences:searchPreferences(s.preferences),enabledSources:normalizeEnabled(s.enabledSources)}));
}
export function saveSearch(list,{id,name,preferences,enabledSources}){
 const entries=normalizeSavedSearches(list);
 if(typeof name!=='string'||!name.trim())throw Error('Give your search a name.');
 if(!entries.some(s=>s.id===id)&&entries.length>=MAX_SAVED_SEARCHES)throw Error('You can save up to 20 searches per profile. Delete one first.');
 const item=normalizeSavedSearches([{id,name,preferences,enabledSources}])[0];
 if(!item)throw Error('Invalid saved search.');
 return entries.some(s=>s.id===id)?entries.map(s=>s.id===id?item:s):[...entries,item];
}
