import {expiryISO} from './freshness.mjs';
import {countryInfo} from './countries.mjs';
import {createHash} from 'node:crypto';
import {text,safeUrl} from './lib.mjs';
import {descriptionFields} from './description.mjs';
const date = v => {const d=new Date(typeof v==='number'?v*1000:v);return Number.isNaN(+d)?'':d.toISOString();};
function salary(low,high,currency,period){
 const values=[low,high].filter(v=>typeof v==='number'&&v>0);
 return values.length?`${currency||''} ${[...new Set(values)].map(v=>v.toLocaleString('en-US')).join('–')}${period?' / '+period:''}`.trim():'';
}
export function parseRemotive(d){
 if(!Array.isArray(d.jobs))throw Error('Unexpected Remotive feed response');
 return d.jobs.map(j=>({id:`remotive-${j.id}`,title:text(j.title),company:text(j.company_name),location:text(j.candidate_required_location)||'Unspecified',remote:true,work:'Remote',...descriptionFields(j.description),url:safeUrl(j.url),tags:j.tags||[],salary:text(j.salary),date:j.publication_date,source:'Remotive',dateLabel:'Posted'}));
}
export function parseLever(d,{board,company,name}){
 if(!Array.isArray(d))throw Error(`Unexpected ${company} feed response`);
 return d.map(j=>({id:`${board}-${j.id}`,title:text(j.text),company,location:[...new Set([j.categories?.location,...(j.categories?.allLocations||[])].filter(Boolean))].map(text).join(' / '),remote:j.workplaceType==='remote'||/remote/i.test(j.categories?.location||''),work:({remote:'Remote',hybrid:'Hybrid','on-site':'On-site'})[j.workplaceType]||'Unspecified',...descriptionFields([j.description||j.descriptionPlain,...(j.lists||[]).map(l=>`<h3>${text(l.text)}</h3>${l.content}`),j.additional||j.additionalPlain].filter(Boolean).join('\n')),url:safeUrl(j.hostedUrl),tags:[text(j.categories?.team)],salary:'',date:j.createdAt?new Date(j.createdAt).toISOString():'',dateLabel:'Posted',source:name}));
}
export function parseGreenhouse(d,{board,company,name}){
 if(!Array.isArray(d.jobs))throw Error(`Unexpected ${company} feed response`);
 return d.jobs.map(j=>({id:`${board}-${j.id}`,title:text(j.title),company,location:text(j.location?.name),remote:/remote/i.test(j.location?.name||''),work:/remote/i.test(j.location?.name||'')?'Remote':/hybrid/i.test(j.location?.name||'')?'Hybrid':'Unspecified',...descriptionFields(j.content),url:safeUrl(j.absolute_url),tags:(j.departments||[]).map(x=>text(x.name)),salary:'',date:j.updated_at,dateLabel:'Updated',source:name}));
}
export function parseJobicy(d){
 if(!Array.isArray(d.jobs)||d.success===false)throw Error('Unexpected Jobicy feed response');
 return d.jobs.map(j=>({id:`jobicy-${j.id}`,title:text(j.jobTitle),company:text(j.companyName),location:text(j.jobGeo)||'Location unspecified',remote:true,work:'Remote',...descriptionFields(j.jobDescription||j.jobExcerpt),url:safeUrl(j.url),tags:j.jobIndustry||[],salary:salary(j.salaryMin,j.salaryMax,j.salaryCurrency,j.salaryPeriod),date:date(j.pubDate),dateLabel:'Posted',source:'Jobicy'}));
}
export function parseHimalayas(d){
 if(!Array.isArray(d.jobs))throw Error('Unexpected Himalayas feed response');
 return d.jobs.filter(j=>!expiryISO(j.expiryDate)||Date.parse(expiryISO(j.expiryDate))>Date.now()).map(j=>{
  const countries=j.locationRestrictions||[],zones=j.timezoneRestrictions||[];
  const location=(countries.length?countries.join(', '):'Worldwide')+(zones.length&&zones.length<30?` · Timezones: ${zones.map(v=>'UTC'+(v>=0?'+':'')+v).join(', ')}`:'');
  // Preserve Himalayas attribution rather than substituting an external application link.
  const url=[j.guid,j.applicationLink].find(v=>{try{return new URL(v).hostname==='himalayas.app';}catch{return false;}})||'';
  return {id:'himalayas-'+createHash('sha256').update(j.guid||url||j.title+j.companyName).digest('hex').slice(0,20),title:text(j.title),company:text(j.companyName),location,timezoneRestrictions:zones,expiresAt:expiryISO(j.expiryDate),remote:true,work:'Remote',...descriptionFields(j.description||j.excerpt),url:safeUrl(url),tags:j.categories||[],salary:salary(j.minSalary,j.maxSalary,j.currency,j.salaryPeriod),date:date(j.pubDate),dateLabel:'Posted',source:'Himalayas'};
 });
}
export const parseQuadcode = d => parseLever(d,{board:'quadcode',company:'Quadcode',name:'Quadcode careers'});
export function parseRemoteOK(d){
 if(!Array.isArray(d))throw Error('Unexpected Remote OK feed response');
 // The first array entry contains legal metadata, not a job. Always link to Remote OK.
 return d.filter(j=>j.id&&j.position).map(j=>({id:`remoteok-${j.id}`,title:text(j.position),company:text(j.company),location:text(j.location)||'Location unspecified',remote:true,work:'Remote',...descriptionFields(j.description),url:safeUrl(j.url),tags:j.tags||[],salary:salary(j.salary_min,j.salary_max,'','')?salary(j.salary_min,j.salary_max,'','')+' (currency / period not supplied)':'',date:date(j.date||j.epoch),dateLabel:'Posted',source:'Remote OK'}));
}
export function parseAshby(d,{board,company,name}){
 if(!Array.isArray(d.jobs))throw Error(`Unexpected ${company} feed response`);
 const location = (label,address) => [...new Set([text(label),text(address?.postalAddress?.addressCountry||address?.addressCountry).replace(/^CY$/,'Cyprus')].filter(Boolean))].join(', ');
 return d.jobs.filter(j=>j.isListed===true).map(j=>({
  id:`${board}-${j.id||createHash('sha256').update(j.jobUrl||j.title).digest('hex').slice(0,20)}`,title:text(j.title),company,
  location:[...new Set([location(j.location,j.address),...(j.secondaryLocations||[]).map(l=>location(l.location,l.address))].filter(Boolean))].join(' / '),
  remote:j.isRemote===true||j.workplaceType==='Remote',work:({Remote:'Remote',Hybrid:'Hybrid',OnSite:'On-site'})[j.workplaceType]||(j.isRemote===true?'Remote':'Unspecified'),
  ...descriptionFields(j.descriptionHtml||j.descriptionPlain),url:safeUrl(j.jobUrl),tags:[j.department,j.team,j.employmentType].filter(Boolean).map(text),
  salary:j.shouldDisplayCompensationOnJobPostings===false?'':text(j.compensation?.scrapeableCompensationSalarySummary||j.compensation?.compensationTierSummary),date:date(j.publishedAt),dateLabel:'Posted',source:name
 }));
}
function lever(board,company){const config={board,company,name:`${company} careers`};return {...config,url:`https://api.eu.lever.co/v0/postings/${board}?mode=json`,parse:d=>parseLever(d,config)};}
function greenhouse(board,company){const config={board,company,name:`${company} careers`};return {...config,url:`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`,parse:d=>parseGreenhouse(d,config)};}
function ashby(board,company){const config={board,company,name:`${company} careers`};return {...config,url:`https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`,parse:d=>parseAshby(d,config)};}
export const sources=[
 {name:'Remotive',url:'https://remotive.com/api/remote-jobs?category=software-dev',parse:parseRemotive,coverage:'Public software-development feed'},
 lever('xm','XM'),greenhouse('workato','Workato'),
 {name:'Jobicy',url:'https://jobicy.com/api/jobs?count=200&industry=engineering',parse:parseJobicy,coverage:'Up to 200 recent engineering jobs'},
 {name:'Himalayas',url:'https://himalayas.app/jobs/api/search?q=software&country=CY&sort=recent',parse:parseHimalayas,ttl:24*3600000,coverage:'First 3 pages of software jobs returned for Cyprus; verify timezones',pages:3},
 lever('quadcode','Quadcode'),
 {name:'Remote OK',url:'https://remoteok.com/api?tag=dev',parse:parseRemoteOK,coverage:'Recent public remote feed; country restrictions still apply'},
 {...greenhouse('gitlab','GitLab'),optional:true,coverage:'GitLab employer feed; country restrictions apply. Optional download.'},
 greenhouse('wheely','Wheely'),greenhouse('wrike','Wrike'),
 ashby('fayaracareers','Fayara'),ashby('welltech','Welltech'),ashby('talos-trading','Talos'),ashby('scorewarrior','Scorewarrior')
].map(s=>({...s,formatVersion:s.name==='Himalayas'?4:3}));

export function sourcesForCountry(code){const c=countryInfo(code);return sources.map(s=>s.name==='Himalayas'?{...s,url:s.url.replace('country=CY','country='+c.code),cacheKey:s.name+':'+c.code,coverage:'First 3 pages of software jobs returned for '+c.name+'; verify restrictions'}:s);}
export function recommendedSources(code){return sourcesForCountry(code).filter(s=>!s.optional&&(countryInfo(code).code==='CY'||['Remotive','Jobicy','Himalayas','Remote OK'].includes(s.name))).map(s=>s.name);}
