import {canonicalListingUrl} from './duplicates.mjs';
import {jobKey} from './workspace.mjs';
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
const states=new Set(['listed','closed','unavailable','unknown']);
export const availabilityKey=job=>jobKey({company:canonicalListingUrl(job.url),title:job.title,location:''});
export function normalizeAvailability(value){
 const result=Object.create(null);if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const [key,item] of Object.entries(value).slice(0,1000)){
  if(!/^job:[a-f0-9]{16}$/.test(key)||!item||!states.has(item.state)||!stamp(item.checkedAt)||!canonicalListingUrl(item.url))continue;
  result[key]={state:item.state,checkedAt:stamp(item.checkedAt),url:String(item.url).slice(0,2000),note:String(item.note||'').slice(0,600),evidence:String(item.evidence||'').slice(0,250),reason:['missing_link','redirected','access_blocked','rate_limited','robots_blocked','server_error','browser_check','read_failed'].includes(item.reason)?item.reason:'',via:['api','page'].includes(item.via)?item.via:'page'};
 }
 return Object.fromEntries(Object.entries(result).sort((a,b)=>b[1].checkedAt.localeCompare(a[1].checkedAt)).slice(0,500));
}
export function recordAvailability(records,job,check){const next={...records,[availabilityKey(job)]:check};return normalizeAvailability(next);}
export function expiryISO(value){if(value===null||value===undefined||value==='')return '';let time;if(typeof value==='number'||/^\d{10,13}$/.test(String(value))){const n=Number(value);time=n<1e12?n*1000:n;}else time=Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(String(value))?value+'T23:59:59.999Z':value);return Number.isFinite(time)?new Date(time).toISOString():'';}
export function isExpired(job,now=Date.now()){return Boolean(stamp(job.expiresAt)&&Date.parse(job.expiresAt)<=now);}
function sourceFreshness(job,records={},now=Date.now()){
 const check=records[availabilityKey(job)],record=check&&canonicalListingUrl(check.url)===canonicalListingUrl(job.url)?check:null;
 if(record){const old=now-Date.parse(record.checkedAt)>24*3600000;return {...record,old,label:({listed:'Listing found',closed:'Source reports closed',unavailable:'Link unavailable',unknown:'Status unverified'})[record.state],hint:old?'This check is over a day old. Recheck before applying.':record.note};}
 if(isExpired(job,now))return {state:'closed',label:'Source expiry passed',checkedAt:'',note:'The expiry date supplied by this source has passed. Saved notes are kept.',hint:'The expiry date supplied by this source has passed.',evidence:job.expiresAt,old:false};
 const fetchedAt=stamp(job.fetchedAt),old=fetchedAt&&now-Date.parse(fetchedAt)>24*3600000;
 return {state:'unchecked',label:old?'Older feed snapshot':fetchedAt?'Seen in source feed':'Not checked yet',checkedAt:'',fetchedAt,old:Boolean(old),note:'Feed presence is not a live availability check.',hint:fetchedAt?'Feed presence is not a live availability check.':'Check the source before applying.'};
}

export function freshnessFor(job,records={},now=Date.now()){
 const primary=sourceFreshness(job,records,now);
 const links=[...new Map([{url:job.url},...(job.sourceLinks||[])].filter(l=>canonicalListingUrl(l.url)).map(l=>[canonicalListingUrl(l.url),l])).values()];
 if(links.length<=1)return primary;
 const checks=links.map(link=>sourceFreshness({...job,url:link.url,expiresAt:canonicalListingUrl(link.url)===canonicalListingUrl(job.url)?job.expiresAt:''},records,now));
 const listed=checks.find(check=>check.state==='listed'&&!check.old);
 if(listed)return {...listed,label:'Listing found on a source',note:'A source still lists this role. Other source links can have different statuses; verify the employer page.'};
 if(checks.every(check=>check.state==='closed'))return {...primary,state:'closed',label:'All grouped sources report closed',note:'Each grouped source has closure evidence. Recheck before relying on older checks.',old:checks.some(check=>check.old)};
 if(checks.some(check=>check.state==='closed'))return {...primary,state:'unknown',label:'Source statuses differ',note:'A source reports closure, but other links are unverified or still listed. This group is kept visible; check each source link.',evidence:''};
 return primary;
}
