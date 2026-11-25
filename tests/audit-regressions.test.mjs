import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchJobs,roleMatches} from '../lib.mjs';
import {experienceSignals} from '../matching.mjs';
import {parseAshby} from '../sources.mjs';
const job=(description,extra={})=>({title:'Software Developer',description,location:'Cyprus',remote:true,work:'Remote',tags:[],...extra});
test('hybrid and onsite override remote booleans, including cached jobs',()=>{
 for(const work of ['Hybrid','On-site']){const j=job('Build applications',{work});assert.equal(matchJobs([j],{area:'remote'}).length,0);assert.equal(matchJobs([j],{area:'local_remote'})[0].remote,false);}
 assert.equal(matchJobs([job('Build applications')],{area:'remote'}).length,1);
 const parsed=parseAshby({jobs:[{id:'one',title:'Developer',isListed:true,isRemote:true,workplaceType:'Hybrid',location:'Cyprus',descriptionPlain:'Build software'}]},{board:'fixture',company:'Fixture',name:'Fixture careers'});assert.equal(parsed[0].remote,false);assert.equal(parsed[0].work,'Hybrid');
});
test('software search includes mobile engineers and software-context staff engineers',()=>{
 for(const title of ['iOS Engineer','Android Engineer','Mobile Engineer'])assert.equal(roleMatches(job('Build mobile applications',{title}),'Software developer'),true);
 assert.equal(roleMatches(job('Design backend systems and distributed systems',{title:'Staff Engineer'}),'Software developer'),true);
 for(const title of ['Staff Civil Engineer','Mechanical Engineer','Staff Engineer'])assert.equal(roleMatches(job('Design bridges and roads',{title}),'Software developer'),false);
 assert.equal(roleMatches(job('Selling software engineering tools',{title:'Sales Engineer'}),'Software developer'),false);
});
test('live-audit experience forms retain numeric evidence and filter over-limit jobs',()=>{
 const cases=[['5+ years of professional front-end development experience.',5],['Strong Python & software engineering fundamentals (2–4+ years): APIs and SQL.',2],['5+ years of professional PHP development experience.',5],['3+ years of C++ (17+) or similar experience in client applications.',3],['Minimum 2 years’ experience in test automation.',2],['5+ years of commercial backend development with C#.',5],["7+ years’ experience within cloud infrastructure.",7]];
 for(const [text,years] of cases){assert.equal(experienceSignals(job(text)).minimumYears,years,text);assert.equal(matchJobs([job(text)],{years:String(years-1)}).length,0,text);assert.equal(matchJobs([job(text)],{years:String(years)}).length,1,text);}
});
test('new experience patterns preserve optional requirements and employer-history exclusions',()=>{
 for(const text of ['5+ years of professional PHP development experience preferred.',"Our company has 7 years’ experience building software.",'Nice to have:\n5+ years of commercial backend development.'])assert.equal(experienceSignals(job(text)).minimumYears,null,text);
 assert.equal(experienceSignals(job('We offer 5 years of warranty and 3 years of paid training.')).minimumYears,null);
});
