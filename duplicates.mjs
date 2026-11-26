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
 if(/timezone|utc|except|exclud|not eligible|only/iu.test(String(value)))return 'restricted:'+clean(String(value).replace(/[-−](?=\d)/g,' minus '));
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
// Only known vacancy routes provide authoritative requisition identity.
export function requisitionIdentity(value){
 try{const u=new URL(value),p=u.pathname.split('/').filter(Boolean),h=u.hostname.replace(/^www\./,'');
  if(['boards.greenhouse.io','job-boards.greenhouse.io'].includes(h)&&p.length===3&&p[1]==='jobs'&&/^\d+$/.test(p[2]))return 'greenhouse:'+p[0]+':'+p[2];
  if(['jobs.lever.co','jobs.eu.lever.co'].includes(h)&&p.length>=2&&p.length<=3&&(!p[2]||p[2]==='apply')&&/^[a-f0-9-]{36}$/i.test(p[1]))return h+':'+p[0]+':'+p[1];
  if(h==='jobs.ashbyhq.com'&&p.length===2&&/^[a-f0-9-]{36}$/i.test(p[1]))return h+':'+p.join(':');
 }catch{}return '';
}
export function sameVacancy(a,b){
 const title=titleIdentity(a.title),company=companyIdentity(a.company);
 if(!title||!company||title!==titleIdentity(b.title)||company!==companyIdentity(b.company))return false;
 const ua=canonicalListingUrl(a.url),ub=canonicalListingUrl(b.url);if(!ua||!ub)return false;
 const location=locationIdentity(a.location);if(location!==locationIdentity(b.location))return false;
 if(JSON.stringify([...(a.timezoneRestrictions||[])].sort())!==JSON.stringify([...(b.timezoneRestrictions||[])].sort()))return false;
 const wa=a.work,wb=b.work;if(wa&&wb&&wa!=='Unspecified'&&wb!=='Unspecified'&&wa!==wb)return false;
 if(ua===ub)return true;
 const ra=requisitionIdentity(a.url),rb=requisitionIdentity(b.url);
 if(ra&&rb)return ra===rb;
 // Different vacancy URLs on the same site or vague locations need manual review.
 if(new URL(ua).hostname===new URL(ub).hostname||!location||/^(?:unspecified|location unspecified|unknown)$/.test(location))return false;
 if(a.source&&a.source===b.source)return false;
 return comparableDescription(a,b);
}
export function mergeVacancies(jobs){
 const groups=new Map(),result=[];
 for(const job of jobs){
  if(!canonicalListingUrl(job.url))continue;
  const key=companyIdentity(job.company)+'|'+titleIdentity(job.title)+'|'+locationIdentity(job.location),group=groups.get(key)||[];
  // Compare every original member so an unspecified workplace cannot bridge conflicts.
  const existing=group.find(item=>item.members.every(member=>sameVacancy(member,job)));
  const links=[{name:job.source,url:job.url,location:job.location,work:job.work},...(job.sourceLinks||[])].filter(link=>canonicalListingUrl(link.url));
  const value=existing?.value||{...job,sourceLinks:[],duplicateCount:1};
  for(const link of links)if(!value.sourceLinks.some(s=>s.name===link.name&&canonicalListingUrl(s.url)===canonicalListingUrl(link.url)))value.sourceLinks.push({...link});
  value.duplicateCount=new Set(value.sourceLinks.map(link=>canonicalListingUrl(link.url))).size;
  if(existing)existing.members.push(job);
  else{group.push({value,members:[job]});groups.set(key,group);result.push(value);}
 }
 return result;
}
