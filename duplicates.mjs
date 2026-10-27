// Conservative vacancy identity: preserve different locations, levels and requisitions.
const clean=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}+#.]+/gu,' ').replace(/\s+/g,' ').trim();
export function canonicalListingUrl(value){
 try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return '';
  u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_.+|ref|referrer|source|gh_src|lever-source|trackingId)$/i.test(key))u.searchParams.delete(key);
  u.searchParams.sort();u.hostname=u.hostname.replace(/^www\./,'');u.pathname=u.pathname.replace(/\/+$/,'')||'/';return u.href;
 }catch{return '';}
}
export const companyIdentity=value=>clean(value).replace(/\.(?=\p{L})/gu,' ').replace(/\s+(?:(?:ltd|limited|inc|incorporated|llc|gmbh|plc)\.?\s*)+$/,'').trim();
export const titleIdentity=value=>clean(String(value??'').replace(/\(\s*(?:m\/f\/d|f\/m\/d|w\/m\/d|all genders)\s*\)/gi,''));
export function locationIdentity(value){
 const s=clean(value).replace(/\bunited kingdom\b/g,'uk').replace(/\bunited states(?: of america)?\b/g,'usa').replace(/\bcy\b/g,'cyprus').replace(/\bremote\b/g,'');
 return [...new Set(s.split(' ').filter(Boolean))].sort().join(' ');
}
function comparableDescription(a,b){
 const x=clean(a.description),y=clean(b.description);if(!x||!y)return false;if(x===y)return true;
 if(Math.min(x.length,y.length)>=100&&(x.includes(y)||y.includes(x)))return true;
 const tokens=v=>new Set(v.split(' ').filter(t=>t.length>2)),left=tokens(x),right=tokens(y);
 if(Math.min(left.size,right.size)<25)return false;
 const common=[...left].filter(t=>right.has(t)).length;return common/(left.size+right.size-common)>=0.88;
}
export function sameVacancy(a,b){
 if(titleIdentity(a.title)!==titleIdentity(b.title)||companyIdentity(a.company)!==companyIdentity(b.company))return false;
 const ua=canonicalListingUrl(a.url),ub=canonicalListingUrl(b.url);if(!ua||!ub)return false;
 if(locationIdentity(a.location)!==locationIdentity(b.location))return false;
 const wa=a.work,wb=b.work;if(wa&&wb&&wa!=='Unspecified'&&wb!=='Unspecified'&&wa!==wb)return false;
 if(ua===ub)return true;
 if(a.source&&a.source===b.source)return false;
 return comparableDescription(a,b);
}
export function mergeVacancies(jobs){
 const groups=new Map(),result=[];
 for(const job of jobs){
  if(!canonicalListingUrl(job.url))continue;
  const key=companyIdentity(job.company)+'|'+titleIdentity(job.title)+'|'+locationIdentity(job.location),group=groups.get(key)||[];
  const existing=group.find(item=>sameVacancy(item,job));
  const links=(job.sourceLinks||[{name:job.source,url:job.url}]).filter(link=>canonicalListingUrl(link.url));
  if(existing){for(const link of links)if(!existing.sourceLinks.some(s=>s.name===link.name&&canonicalListingUrl(s.url)===canonicalListingUrl(link.url)))existing.sourceLinks.push({...link});
   existing.duplicateCount=(existing.duplicateCount||1)+1;
  }else{const value={...job,sourceLinks:links.map(link=>({...link})),duplicateCount:1};group.push(value);groups.set(key,group);result.push(value);}
 }
 return result;
}
