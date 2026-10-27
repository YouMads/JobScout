import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseJobicy,parseHimalayas,parseQuadcode,parseRemoteOK,parseAshby,parseGreenhouse,sources} from '../sources.mjs';
import {deduplicate} from '../lib.mjs';
test('Jobicy preserves attribution, salary interval and location restrictions',()=>{
 const [j]=parseJobicy({jobs:[{id:1,jobTitle:'Python Developer',companyName:'Acme',jobGeo:'USA',jobDescription:'<p>Python</p>',url:'https://jobicy.com/jobs/1',pubDate:'2026-10-20',salaryMin:100000,salaryMax:120000,salaryCurrency:'USD',salaryPeriod:'yearly'}]});
 assert.equal(j.source,'Jobicy');assert.equal(j.location,'USA');assert.equal(j.description,'Python');assert.match(j.salary,/yearly/);assert.ok(j.url.startsWith('https://jobicy.com/'));
 assert.throws(()=>parseJobicy({success:false}),/Unexpected/);
});
test('Himalayas retains country and timezone restrictions and original website URL',()=>{
 const [j]=parseHimalayas({jobs:[{title:'Developer',companyName:'Acme',guid:'https://himalayas.app/companies/acme/jobs/1',applicationLink:'https://external.example/apply',locationRestrictions:['Cyprus'],timezoneRestrictions:[2,3],pubDate:1792198336}]});
 assert.equal(j.source,'Himalayas');assert.match(j.location,/Cyprus/);assert.match(j.location,/UTC\+2/);assert.ok(j.url.startsWith('https://himalayas.app/'));assert.ok(j.date.endsWith('Z'));
 assert.equal(parseHimalayas({jobs:[{expiryDate:1}]}).length,0);
});
test('Quadcode preserves hybrid arrangement and all listed locations',()=>{
 const [j]=parseQuadcode([{id:'1',text:'Backend Developer',categories:{location:'Cyprus',allLocations:['Cyprus','Armenia']},workplaceType:'hybrid',hostedUrl:'https://jobs.eu.lever.co/quadcode/1',lists:[]}]);
 assert.equal(j.location,'Cyprus / Armenia');assert.equal(j.work,'Hybrid');assert.equal(j.remote,false);assert.equal(j.source,'Quadcode careers');
});
test('deduplication retains both website links without mutating input',()=>{
 const a={company:'Acme',title:'Developer',location:'Cyprus',description:'Develop Python services.',url:'https://jobicy.com/jobs/1',source:'Jobicy'};
 const b={...a,url:'https://himalayas.app/companies/acme/jobs/1',source:'Himalayas'};
 const result=deduplicate([a,b]);assert.equal(result.length,1);assert.deepEqual(result[0].sourceLinks.map(x=>x.name),['Jobicy','Himalayas']);assert.equal(a.sourceLinks,undefined);
});

test('Remote OK omits legal metadata and keeps the original attribution URL',()=>{
 const [j]=parseRemoteOK([{legal:'Credit Remote OK'},{id:'7',position:'Developer',company:'Acme',description:'<h2>Skills</h2><ul><li>React</li></ul>',location:'Europe',url:'https://remoteok.com/remote-jobs/7',apply_url:'https://external.example/apply',salary_min:50000,salary_max:70000}]);
 assert.equal(j.source,'Remote OK');assert.equal(j.url,'https://remoteok.com/remote-jobs/7');assert.equal(j.location,'Europe');assert.equal(j.descriptionBlocks[1].type,'list');assert.match(j.salary,/currency \/ period not supplied/);
 assert.equal(parseRemoteOK([{id:8,position:'Developer',url:'https://remoteok.com/8'}])[0].location,'Location unspecified');
});
test('Ashby excludes unlisted roles, keeps secondary countries and unknown workplace types',()=>{
 const config={board:'acme',company:'Acme',name:'Acme careers'};
 const jobs=parseAshby({jobs:[{id:'1',title:'Software Engineer',isListed:true,location:'Limassol',address:{postalAddress:{addressCountry:'CY'}},secondaryLocations:[{location:'Prague',address:{addressCountry:'Czechia'}}],descriptionHtml:'<p>Build APIs.</p>',jobUrl:'https://jobs.ashbyhq.com/acme/1',compensation:{compensationTierSummary:'€4K – €6K per month'}},{id:'private',isListed:false}]},config);
 assert.equal(jobs.length,1);assert.match(jobs[0].location,/Limassol, Cyprus \/ Prague, Czechia/);assert.equal(jobs[0].work,'Unspecified');assert.equal(jobs[0].remote,false);assert.match(jobs[0].salary,/per month/);
 const [hidden]=parseAshby({jobs:[{id:'2',isListed:true,shouldDisplayCompensationOnJobPostings:false,compensation:{compensationTierSummary:'Hidden'}}]},config);assert.equal(hidden.salary,'');
});
test('Greenhouse decodes encoded structure and labels dates as updated',()=>{
 const [j]=parseGreenhouse({jobs:[{id:8,title:'Developer',location:{name:'Nicosia, Cyprus'},content:'&lt;h2&gt;Requirements&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Java&lt;/li&gt;&lt;/ul&gt;',absolute_url:'https://job-boards.greenhouse.io/acme/8',updated_at:'2026-10-22'}]},{board:'acme',company:'Acme',name:'Acme careers'});
 assert.equal(j.descriptionBlocks[0].type,'heading');assert.equal(j.descriptionBlocks[1].type,'list');assert.equal(j.dateLabel,'Updated');assert.equal(j.work,'Unspecified');
});
test('all fourteen sources have unique names, secure feed URLs and versioned descriptions',()=>{
 assert.equal(sources.length,14);assert.equal(new Set(sources.map(s=>s.name)).size,14);
 for(const s of sources){assert.match(s.url,/^https:\/\//);assert.ok(s.formatVersion>=2);assert.equal(typeof s.parse,'function');}
});
