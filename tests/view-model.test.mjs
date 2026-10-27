import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterResults,paginate,pipelineCounts,createJobEnricher} from '../public/view-model.mjs';
const jobs=[{id:'a',title:'Python Developer',company:'Acme',description:'Django',source:'Jobicy',salary:'EUR 40,000',score:50,date:'2026-10-20'},{id:'b',title:'React Developer',company:'Beta',description:'Frontend',source:'Remotive',sourceLinks:[{name:'Remotive'},{name:'Himalayas'}],salary:'',score:100,date:'2026-10-19'},{id:'c',title:'QA Engineer',company:'Cedar',description:'Python testing',source:'Himalayas',salary:'USD 30/hour',score:null,date:'2026-10-21'}];
test('quick filters compose and retain duplicate source links',()=>{assert.deepEqual(filterResults(jobs,{query:'python',salaryOnly:true,website:'Jobicy'}).map(j=>j.id),['a']);assert.deepEqual(filterResults(jobs,{website:'Himalayas',sort:'new'}).map(j=>j.id),['c','b']);assert.deepEqual(jobs.map(j=>j.id),['a','b','c']);});
test('pipeline stages and skill sorting work independently',()=>{const saved={a:{stage:'Saved'},b:{stage:'Interview'},c:{stage:'Applied'}};assert.deepEqual(filterResults(jobs,{stage:'Interview',saved}).map(j=>j.id),['b']);assert.deepEqual(filterResults(jobs).map(j=>j.id),['b','a','c']);assert.deepEqual(pipelineCounts(saved),{Saved:1,Applied:1,Interview:1,Offer:0,Closed:0});});
test('pagination clamps pages when filters shrink results',()=>{const items=Array.from({length:25},(_,i)=>i);assert.deepEqual(paginate(items,3).items,[24]);assert.equal(paginate(items,8).page,3);assert.equal(paginate([1,2],3).page,1);assert.deepEqual(paginate([],2),{items:[],page:1,pages:1,total:0,start:0,end:0});});

test('description checks are reused for an unchanged job and CV, including enriched inputs',()=>{
 const enrich=createJobEnricher(),job={id:'cached',title:'Junior Developer',company:'Acme',description:'Python and React, 1 year experience.',location:'Cyprus',work:'Remote'};
 const result=enrich(job,{text:'Python developer'});assert.equal(enrich(job,{text:'Python developer'}),result);assert.equal(enrich(result,{text:'Python developer'}),result);assert.equal(job.experience,undefined);assert.deepEqual(result.cvMatch.shared,['Python']);
});
test('cached job checks invalidate when CV text or the job object changes',()=>{
 const enrich=createJobEnricher(),job={id:'cached',title:'Junior Developer',company:'Acme',description:'Python and React.',location:'Cyprus'};
 const first=enrich(job,{text:'Python developer'}),second=enrich(job,{text:'React developer'});assert.notEqual(first,second);assert.deepEqual(second.cvMatch.shared,['React']);const changed=enrich({...job,description:'Java developer role'},{text:'React developer'});assert.deepEqual(changed.cvMatch.shared,[]);
});
