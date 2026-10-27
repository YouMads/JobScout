import {expiryISO} from './freshness.mjs';
import {scanUrl,createPublicReader} from './scanner.mjs';
import {canonicalListingUrl,titleIdentity} from './duplicates.mjs';
import {text} from './lib.mjs';
const sameTitle=(a,b)=>Boolean(titleIdentity(a)&&titleIdentity(a)===titleIdentity(b));
const expiry=value=>Date.parse(expiryISO(value));
export function checkTarget(value){
 const url=scanUrl(value),parts=url.pathname.split('/').filter(Boolean),host=url.hostname;
 if(['himalayas.app','www.himalayas.app'].includes(host)&&parts.length===4&&parts[0]==='companies'&&parts[2]==='jobs'&&parts.every(p=>/^[\w-]+$/.test(p)))return {kind:'himalayas',url:'https://himalayas.app/jobs/api'+url.pathname};
 if(['jobs.lever.co','jobs.eu.lever.co'].includes(host)&&parts.length===2&&/^[\w-]+$/.test(parts[0])&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(parts[1]))return {kind:'lever',id:parts[1],url:'https://'+(host.includes('.eu.')?'api.eu.lever.co':'api.lever.co')+'/v0/postings/'+parts.join('/')+'?mode=json'};
 if(['boards.greenhouse.io','job-boards.greenhouse.io'].includes(host)&&parts.length===3&&/^[\w-]+$/.test(parts[0])&&parts[1]==='jobs'&&/^\d+$/.test(parts[2]))return {kind:'greenhouse',id:parts[2],url:'https://boards-api.greenhouse.io/v1/boards/'+parts[0]+'/jobs/'+parts[2]};
 return {kind:'page',url:url.href};
}
export function classifyCheck(job,response,target,now=Date.now()){
 const base={state:'unknown',url:job.url,checkedAt:new Date(now).toISOString(),via:target.kind==='page'?'page':'api',note:'The page was readable, but this role’s current availability could not be verified.',evidence:''};
 if(target.kind!=='page'&&canonicalListingUrl(response.url)!==canonicalListingUrl(target.url))return {...base,note:'The source redirected to another address. Availability remains unverified.'};
 let data;try{data=JSON.parse(response.body);}catch{}
 if(response.status===410&&target.kind==='himalayas'&&Number.isFinite(expiry(data?.expiryDate)))return {...base,state:'closed',note:'Himalayas reports this listing has closed.',evidence:'Source returned closed status (410).'};
 if([404,410].includes(response.status))return {...base,state:'unavailable',note:'The source link is unavailable. It may have moved; this does not confirm the role has closed.',evidence:'HTTP '+response.status};
 if(response.status!==200)return {...base,note:'The source could not confirm this listing. Open the website to check.'};
 if(target.kind!=='page'){
  const row=target.kind==='himalayas'?data?.job:data;
  const title=row?.title||row?.text;
  if(!row||!sameTitle(title,job.title)||target.id&&String(row.id)!==target.id)return {...base,note:'The source returned different or incomplete job details. Check the original page.'};
  if(target.kind==='himalayas'&&canonicalListingUrl(row.guid)!==canonicalListingUrl(job.url))return {...base,note:'The source returned a different listing link.'};
  const expired=row.expiryDate&&Number.isFinite(expiry(row.expiryDate))&&expiry(row.expiryDate)<=now;
  return {...base,state:expired?'closed':'listed',note:expired?'The source reports an expiry date that has passed.':'This specific listing is present in the source’s public jobs API. Confirm requirements and apply on the original website.',evidence:expired?'Source expiry: '+new Date(expiry(row.expiryDate)).toISOString():String(title).slice(0,250)};
 }
 const postings=[];
 for(const match of response.body.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){
  try{const walk=(v,depth=0)=>{if(!v||typeof v!=='object'||depth>10||postings.length>=50)return;if(Array.isArray(v)){v.slice(0,100).forEach(x=>walk(x,depth+1));return;}if([v['@type']].flat().includes('JobPosting'))postings.push(v);for(const [key,child]of Object.entries(v))if(key!=='description')walk(child,depth+1);};walk(JSON.parse(match[1]));}catch{}
 }
 const matching=postings.filter(p=>{try{return sameTitle(p.title,job.title)&&p.url&&canonicalListingUrl(new URL(p.url,response.url).href)===canonicalListingUrl(job.url);}catch{return false;}});
 // Require the matching main heading, original page and a nearby explicit closure notice.
 const visible=response.body.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' '),heading=/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i.exec(visible);
 if(heading&&sameTitle(text(heading[1]),job.title)&&canonicalListingUrl(response.url)===canonicalListingUrl(job.url)&&postings.length<=1){
  const near=text(visible.slice(heading.index+heading[0].length,heading.index+heading[0].length+1000));
  const closed=/\b(?:this (?:job|position|role|vacancy) (?:is (?:no longer available|no longer accepting applications|no longer open|closed)|has (?:been filled|closed|expired))|we are no longer accepting applications for this (?:job|position|role))\b/i.exec(near);
  if(closed)return {...base,state:'closed',note:'The matching listing displays an explicit closure notice.',evidence:closed[0]};
 }
 if(matching.length===1){const p=matching[0],expired=Number.isFinite(expiry(p.validThrough))&&expiry(p.validThrough)<=now;return {...base,state:expired?'closed':'listed',note:expired?'This listing’s structured expiry date has passed.':'Matching job details are still present on the source page. This is not a guarantee the employer is still accepting applications.',evidence:expired?'Listing expiry: '+String(p.validThrough):String(p.title).slice(0,250)};}
 return base;
}
export async function checkVacancy(input,{reader,signal,now=Date.now()}={}){
 const job={url:scanUrl(input?.url).href,title:typeof input?.title==='string'?input.title.trim().slice(0,300):''};if(!job.title)throw Error('A job title is required to verify the listing.');
 const target=checkTarget(job.url),read=reader||createPublicReader({signal,allowNotFound:true});
 try{const response=await read(target.url);signal?.throwIfAborted();return classifyCheck(job,response,target,now);}
 catch(error){if(signal?.aborted)throw error;return {state:'unknown',url:job.url,checkedAt:new Date(now).toISOString(),via:target.kind==='page'?'page':'api',note:'Could not verify this listing automatically. It may be protected, unavailable or temporarily failing. Open the original website to check.',evidence:''};}
}
export function createCheckCache({limit=200,ttl=10*60*1000,clock=Date.now}={}){
 const records=new Map(),key=job=>canonicalListingUrl(job.url)+'|'+titleIdentity(job.title);
 return {get(job){const value=records.get(key(job));return value&&clock()-value.time<ttl?{...value.result,cached:true}:null;},put(job,result){records.delete(key(job));records.set(key(job),{time:clock(),result});while(records.size>limit)records.delete(records.keys().next().value);}};
}
