import {canonicalListingUrl,titleIdentity,locationIdentity} from './duplicates.mjs';
export const MAX_WEBSITES=12,MAX_HISTORY=8;
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():'';
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function websiteUrl(value){
 const raw=clean(value,2100),normalized=canonicalListingUrl(raw);if(!normalized||normalized.length>2000)throw Error('Use a public http(s) website link without login details.');
 const u=new URL(raw),host=u.hostname.replace(/^\[|\]$/g,'');
 if(u.port||!host.includes('.')||/(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host)||/^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host))throw Error('Use a public company or careers-page link.');
 u.hash='';return u.href;
}
export function roleKey(job){return canonicalListingUrl(job.url)+'|'+titleIdentity(job.title)+'|'+locationIdentity(job.location);}
function roleSummary(job){
 const url=canonicalListingUrl(job?.url),title=clean(job?.title,300);if(!url||url.length>2000||!title)return null;
 return {title,company:clean(job.company,200),location:clean(job.location,250),url};
}
function summaries(value){return Array.isArray(value)?[...new Map(value.slice(0,60).map(roleSummary).filter(Boolean).map(job=>[roleKey(job),job])).values()]:[];}
function changeData(value){return {at:iso(value?.at),baselineAt:iso(value?.baselineAt),compared:value?.compared===true,reason:clean(value?.reason,350),addedKeys:Array.isArray(value?.addedKeys)?value.addedKeys.slice(0,60).filter(k=>typeof k==='string'&&k.length<3000):[],notSeen:summaries(value?.notSeen)};}
export function normalizeWatchlist(value){
 if(!Array.isArray(value))return [];
 const seen=new Set(),ids=new Set(),out=[];
 for(const raw of value){if(out.length>=MAX_WEBSITES)break;if(!obj(raw)||!/^site-[a-zA-Z0-9_-]{1,90}$/.test(raw.id||'')||ids.has(raw.id))continue;
  let url;try{url=websiteUrl(raw.url);}catch{continue;}const identity=canonicalListingUrl(url);if(seen.has(identity))continue;seen.add(identity);ids.add(raw.id);
  const coverage=Array.isArray(raw.snapshot?.coverage)?raw.snapshot.coverage.filter(u=>canonicalListingUrl(u)).slice(0,10).map(u=>canonicalListingUrl(u)).sort():[];
  const snapshot=iso(raw.snapshot?.at)?{at:iso(raw.snapshot.at),coverage,items:summaries(raw.snapshot.items)}:null;
  const history=Array.isArray(raw.history)?raw.history.slice(0,MAX_HISTORY).filter(h=>obj(h)&&iso(h.at)&&['complete','partial','failed','cancelled'].includes(h.status)).map(h=>({at:iso(h.at),checkedAt:iso(h.checkedAt),status:h.status,total:Math.min(60,Math.max(0,Number(h.total)||0)),readCount:Math.min(6,Math.max(0,Number(h.readCount)||0)),newCount:Math.min(60,Math.max(0,Number(h.newCount)||0)),notSeenCount:Math.min(60,Math.max(0,Number(h.notSeenCount)||0)),note:clean(h.note,400)})):[];
  out.push({id:raw.id,name:clean(raw.name,70)||new URL(url).hostname,url,addedAt:iso(raw.addedAt),snapshot,changes:changeData(raw.changes),history});
 }
 return out;
}
export function addWebsite(value,{url,name='',id,now=new Date().toISOString()}){
 const sites=normalizeWatchlist(value),target=websiteUrl(url),existing=sites.find(site=>canonicalListingUrl(site.url)===canonicalListingUrl(target));
 if(existing)return {sites,site:existing,existing:true};
 if(sites.length>=MAX_WEBSITES)throw Error('You can save up to '+MAX_WEBSITES+' company websites per profile.');
 if(!/^site-[a-zA-Z0-9_-]{1,90}$/.test(id||''))throw Error('Invalid website identifier.');
 const site={id,name:clean(name,70)||new URL(target).hostname,url:target,addedAt:iso(now),snapshot:null,changes:changeData(),history:[]};
 return {sites:[...sites,site],site,existing:false};
}
export function recordWebsiteScan(raw,report,{error='',cancelled=false,now=new Date().toISOString()}={}){
 const site=normalizeWatchlist([raw])[0];if(!site)throw Error('Saved website is unavailable.');
 if(report&&canonicalListingUrl(report.root)!==canonicalListingUrl(site.url))throw Error('This scan belongs to a different website. Scan this link again.');
 const at=iso(now)||new Date().toISOString(),checkedAt=iso(report?.checkedAt),items=summaries(report?.jobs);
 const coverage=(report?.pages||[]).filter(p=>p.status==='read').map(p=>canonicalListingUrl(p.url)).filter(Boolean).sort();
 const complete=Boolean(report?.aiComplete&&!report.pasted&&!report.limited&&coverage.length&&report.pages.every(p=>p.status==='read')&&!error&&!cancelled);
 const status=cancelled?'cancelled':!report?'failed':complete?'complete':'partial';
 if(report?.cached&&site.history.some(h=>h.checkedAt===checkedAt&&h.status===status))return site;
 let reason=cancelled?'Scan cancelled. The previous full comparison is preserved.':!report?'Website could not be read. The previous full comparison is preserved.':!complete?'Limited scan: the previous full snapshot is preserved; missing roles are not inferred.':!site.snapshot?'First full scan saved as your comparison baseline.':'';
 if(status==='partial'){const detail=report.pasted?'Pasted text is not compared with live website scans.':report.limited?'Page or extraction limit reached; try a direct careers or public job-board link.':report.pages.some(p=>p.status!=='read')?'Some pages could not be read.':!report.aiComplete?'The local AI step did not finish.':'The page evidence is incomplete.';reason=detail+' The previous full snapshot is preserved; missing roles are not inferred.';}
 let addedKeys=[],notSeen=[],compared=false,baselineAt=site.snapshot?.at||'';
 if(complete){
  if(site.snapshot&&JSON.stringify(site.snapshot.coverage)===JSON.stringify(coverage)){
   compared=true;const before=new Set(site.snapshot.items.map(roleKey)),after=new Set(items.map(roleKey));
   addedKeys=items.filter(j=>!before.has(roleKey(j))).map(roleKey);notSeen=site.snapshot.items.filter(j=>!after.has(roleKey(j)));
   reason='Compared with the previous full scan of the same pages. Not seen does not mean closed.';
  }else if(site.snapshot)reason='The pages checked changed. A new baseline was saved; missing or newly covered roles are not inferred.';
  site.snapshot={at:checkedAt,coverage,items};
 }
 site.changes={at:checkedAt||at,baselineAt,compared,reason,addedKeys,notSeen};
 const history={at,checkedAt,status,total:items.length,readCount:coverage.length,newCount:addedKeys.length,notSeenCount:notSeen.length,note:clean(error,400)||reason};
 site.history=[history,...site.history.filter(h=>!checkedAt||h.checkedAt!==checkedAt)].slice(0,MAX_HISTORY);
 return site;
}

export async function runWebsiteQueue(ids,worker,shouldStop=()=>false){
 let completed=0;for(const id of ids){if(shouldStop())break;await worker(id);completed++;}return completed;
}
