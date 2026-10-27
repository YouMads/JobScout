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
