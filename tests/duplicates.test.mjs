import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deduplicate} from '../lib.mjs';
import {canonicalListingUrl,sameVacancy} from '../duplicates.mjs';
const base={id:'a',company:'Acme Ltd.',title:'Junior Developer (m/f/d)',location:'Limassol, Cyprus',work:'Remote',description:'Build Python services and React interfaces for customers.',source:'Board One',url:'https://one.com/jobs/1'};
test('cross-site duplicates combine company suffix, gender suffix and location punctuation variants',()=>{
 const other={...base,id:'b',company:'ACME',title:'Junior Developer',location:'Limassol / Cyprus',source:'Board Two',url:'https://two.com/jobs/3'};
 const result=deduplicate([base,other]);assert.equal(result.length,1);assert.equal(result[0].duplicateCount,2);assert.equal(result[0].sourceLinks.length,2);assert.equal(base.sourceLinks,undefined);
});
test('different seniority, workplaces, locations and same-source requisitions stay separate',()=>{
 for(const extra of [{title:'Senior Developer'},{work:'On-site'},{location:'Nicosia, Cyprus'},{source:base.source}])assert.equal(deduplicate([base,{...base,id:'b',url:'https://two.com/job/2',source:'Board Two',...extra}]).length,2);
});
test('same employer/title/location is not sufficient without supporting description or URL evidence',()=>{
 assert.equal(sameVacancy({...base,description:''},{...base,url:'https://two.com/job',source:'Other',description:''}),false);
 assert.equal(sameVacancy(base,{...base,url:'https://two.com/job',source:'Other',description:'Unrelated role on another team.'}),false);
});
test('tracking parameters are ignored but job IDs and technical title distinctions are preserved',()=>{
 assert.equal(canonicalListingUrl('https://www.acme.com/job?id=4&utm_source=x#about'),'https://acme.com/job?id=4');
 assert.equal(sameVacancy(base,{...base,url:base.url+'?utm_source=x'}),true);
 assert.equal(sameVacancy({...base,title:'C# Developer'},{...base,title:'C++ Developer'}),false);
 assert.equal(sameVacancy({...base,url:'https://x.com/job?id=1'},{...base,url:'https://x.com/job?id=2'}),false);
});

test('known employer requisitions merge across board aliases but distinct IDs do not',()=>{
 const a={...base,url:'https://boards.greenhouse.io/acme/jobs/123'};
 assert.equal(deduplicate([a,{...base,source:'Other',url:'https://job-boards.greenhouse.io/acme/jobs/123'}]).length,1);
 assert.equal(deduplicate([a,{...base,source:'Other',url:'https://job-boards.greenhouse.io/acme/jobs/124'}]).length,2);
 assert.equal(deduplicate([base,{...base,source:'Other',url:'https://one.com/jobs/2'}]).length,2);
});
test('vague identities and conflicting location restrictions never merge on boilerplate',()=>{
 for(const patch of [{company:''},{title:''},{location:''},{location:'Unspecified'}])assert.equal(deduplicate([{...base,...patch},{...base,...patch,source:'Other',url:'https://two.com/job'}]).length,2);
 for(const [a,b]of [['Europe except Cyprus','Cyprus except Europe'],['Worldwide UTC-3','Worldwide UTC+3']])assert.equal(deduplicate([{...base,location:a},{...base,location:b,source:'Other',url:'https://two.com/job'}]).length,2);
 assert.equal(deduplicate([{...base,timezoneRestrictions:[-3]},{...base,timezoneRestrictions:[3],source:'Other',url:'https://two.com/job'}]).length,2);
});
test('an unspecified workplace cannot bridge remote and on-site vacancies',()=>{
 const result=deduplicate([{...base,work:'Unspecified'},{...base,source:'Two',url:'https://two.com/1'},{...base,work:'On-site',source:'Three',url:'https://three.com/1'}]);
 assert.equal(result.length,2);assert.equal(result[0].sourceLinks.length,2);
});
test('grouping preserves original links and source locations, without multiplying on regrouping',()=>{
 const other={...base,source:'Other',url:'https://two.com/1',location:'Limassol / Cyprus'};
 const grouped=deduplicate([base,other,base]);assert.equal(grouped.length,1);assert.equal(grouped[0].duplicateCount,2);
 assert.equal(grouped[0].sourceLinks[1].location,other.location);assert.equal(grouped[0].sourceLinks[1].url,other.url);
 assert.deepEqual(deduplicate(grouped),grouped);assert.equal(base.sourceLinks,undefined);
});
