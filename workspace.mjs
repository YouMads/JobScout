import {descriptionFields} from './description.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():'';
const clean=(v,max)=>String(v??'').trim().slice(0,max);
export function jobKey(job){
 const identity=[job.company,job.title,job.location].map(v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()).join('|');
 let hash=0xcbf29ce484222325n;for(const c of identity){hash^=BigInt(c.codePointAt(0));hash=BigInt.asUintN(64,hash*0x100000001b3n);}
 return 'job:'+hash.toString(16).padStart(16,'0');
}
export function normalizeTracking(value){
 const records=Object.create(null);
 if(object(value?.records))for(const [key,r] of Object.entries(value.records).slice(0,5000)){
  if(!/^job:[a-f0-9]{16}$/.test(key)||!object(r))continue;
  const firstSeenAt=iso(r.firstSeenAt),lastSeenAt=iso(r.lastSeenAt);if(!firstSeenAt)continue;
  records[key]={firstSeenAt,lastSeenAt:lastSeenAt||firstSeenAt,viewedAt:iso(r.viewedAt),hiddenAt:iso(r.hiddenAt)};
 }
 return {baselineAt:iso(value?.baselineAt),lastSearchAt:iso(value?.lastSearchAt),records};
}
export function trackSearch(tracking,jobs,now=new Date().toISOString()){
 const next=normalizeTracking(tracking),stamp=iso(now);if(!stamp)return next;
 if(!next.baselineAt)next.baselineAt=stamp;
 for(const job of jobs){const key=jobKey(job);next.records[key]||={firstSeenAt:stamp,lastSeenAt:stamp,viewedAt:'',hiddenAt:''};next.records[key].lastSeenAt=stamp;}
 next.lastSearchAt=stamp;
 const entries=Object.entries(next.records);if(entries.length>5000){entries.sort((a,b)=>Number(Boolean(b[1].hiddenAt))-Number(Boolean(a[1].hiddenAt))||b[1].lastSeenAt.localeCompare(a[1].lastSeenAt));next.records=Object.fromEntries(entries.slice(0,5000));}
 return next;
}
export function activityFor(tracking,job){
 const record=tracking?.records?.[jobKey(job)];
 return {seen:Boolean(record?.viewedAt),hidden:Boolean(record?.hiddenAt),isNew:Boolean(record&&tracking.baselineAt&&record.firstSeenAt>tracking.baselineAt&&!record.viewedAt),firstSeenAt:record?.firstSeenAt||'',viewedAt:record?.viewedAt||''};
}
export function setActivity(tracking,job,action,now=new Date().toISOString()){
 const next=normalizeTracking(tracking),key=jobKey(job);if(!next.baselineAt)next.baselineAt=now;
 next.records[key]||={firstSeenAt:now,lastSeenAt:now,viewedAt:'',hiddenAt:''};
 if(action==='seen')next.records[key].viewedAt=now;
 if(action==='unseen')next.records[key].viewedAt='';
 if(action==='hide')next.records[key].hiddenAt=now;
 if(action==='restore')next.records[key].hiddenAt='';
 return next;
}
export function activityMatches(tracking,job,filter='all'){
 const a=activityFor(tracking,job);if(filter==='hidden')return a.hidden;if(a.hidden)return false;
 return filter==='new'?a.isNew:filter==='unseen'?!a.seen:filter==='seen'?a.seen:true;
}
export function safeJobUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function createManualJob(input,id,now=new Date().toISOString()){
 const url=safeJobUrl(input.url),title=clean(input.title,300),company=clean(input.company,200);
 if(!url||!title||!company||!/^manual-[a-zA-Z0-9_-]{1,90}$/.test(id))throw Error('Add a title, company, and a valid http(s) listing link without login details.');
 const host=new URL(url).hostname.replace(/^www\./,'');
 const source=({'carierista.com':'Carierista','ergodotisi.com':'Ergodotisi'})[host]||host;
 const work=['Remote','Hybrid','On-site'].includes(input.work)?input.work:'Unspecified';
 return {id,title,company,url,location:clean(input.location,2000)||'Location unspecified',work,remote:work==='Remote',salary:clean(input.salary,200),...descriptionFields(clean(input.description,40000)),source:source+' (manual)',sourceLinks:[{name:source+' (manual)',url}],tags:[],date:iso(now)||new Date().toISOString(),dateLabel:'Added',manual:true};
}
export function normalizeCv(value){return {text:typeof value?.text==='string'?value.text.slice(0,16000):'',name:typeof value?.name==='string'?value.name.slice(0,180):'',updatedAt:iso(value?.updatedAt)};}
export function normalizeEnabled(value){return Array.isArray(value)?[...new Set(value.filter(v=>typeof v==='string').map(v=>v.slice(0,100)))].slice(0,40):null;}

// User-maintained application planning. Dates are local calendar days, never UTC deadlines.
export const APPLICATION_STAGES=['Saved','Applied','Interview','Offer','Closed'];
export const PRIORITIES=['High','Normal','Low'];
export function calendarDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
 const [year,month,day]=value.split('-').map(Number);
 if(year<1900||year>2200)return '';
 const date=new Date(year,month-1,day,12);
 return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?value:'';
}
export function localDay(now=new Date()){
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
export function normalizePlan(value){
 return {priority:PRIORITIES.includes(value?.priority)?value.priority:'Normal',followUp:calendarDay(value?.followUp),nextAction:typeof value?.nextAction==='string'?value.nextAction.slice(0,240):''};
}
export function followUpStatus(entry,today=localDay()){
 const plan=normalizePlan(entry);
 if(entry?.stage==='Closed'||!plan.followUp)return 'none';
 return plan.followUp<today?'overdue':plan.followUp===today?'today':'upcoming';
}
export function followUpCounts(saved,today=localDay()){
 const counts={overdue:0,today:0,upcoming:0,none:0};
 for(const entry of Object.values(saved))counts[followUpStatus(entry,today)]++;
 return counts;
}
export function filterApplications(jobs,saved,{followUp='all',priority='all',today=localDay(),sort='default'}={}){
 const result=jobs.filter(job=>{const entry=saved[job.id];return entry&&(followUp==='all'||followUpStatus(entry,today)===followUp)&&(priority==='all'||normalizePlan(entry).priority===priority);});
 if(sort==='followup')result.sort((a,b)=>{
  const x=followUpStatus(saved[a.id],today)==='none'?'9999-12-31':normalizePlan(saved[a.id]).followUp;
  const y=followUpStatus(saved[b.id],today)==='none'?'9999-12-31':normalizePlan(saved[b.id]).followUp;
  return x.localeCompare(y)||a.company.localeCompare(b.company);
 });
 if(sort==='priority')result.sort((a,b)=>PRIORITIES.indexOf(normalizePlan(saved[a.id]).priority)-PRIORITIES.indexOf(normalizePlan(saved[b.id]).priority));
 return result;
}
export function applicationsCsv(saved){
 const cell=value=>{let text=String(value??'');if(/^[\s\uFEFF]*[=+\-@]/u.test(text)||/^[\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 const rows=[['Job title','Company','Stage','Priority','Follow-up date','Next action','Notes','Location','Work arrangement','Salary as listed','Source','Original link','Saved at']];
 for(const entry of Object.values(saved)){
  const j=entry.job,p=normalizePlan(entry);
  rows.push([j.title,j.company,entry.stage,p.priority,p.followUp,p.nextAction,entry.notes,j.location,j.work,j.salary,j.source,safeJobUrl(j.url),entry.savedAt]);
 }
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
