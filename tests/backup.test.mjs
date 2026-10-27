import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeBackup,readBackup} from '../backup.mjs';
const profile=()=>({id:'default',name:'My profile',preferences:{role:'Software developer',skills:'Python',years:'2'},saved:{'job-1':{job:{id:'job-1',title:'Developer',company:'Acme',url:'https://example.org/job',source:'Jobicy',location:'Cyprus',description:'Python',remote:true,timezoneRestrictions:[2,3]},stage:'Interview',notes:'Follow up Friday',savedAt:'2026-10-21'}},reviews:{'job-1':{summary:'Check experience',recommendation:'Review',locationNote:'Cyprus listed',strengths:['Python'],gaps:['Unknown years']}}});
test('backup round trip preserves profiles, stages, notes, preferences and reviews',()=>{
 const state={profiles:[profile()]};const backup=JSON.parse(JSON.stringify(makeBackup(state)));const result=readBackup(backup);
 assert.equal(result[0].saved['job-1'].stage,'Interview');assert.equal(result[0].saved['job-1'].notes,'Follow up Friday');assert.equal(result[0].preferences.years,'2');assert.deepEqual(result[0].reviews['job-1'].strengths,['Python']);assert.deepEqual(result[0].saved['job-1'].job.timezoneRestrictions,[2,3]);assert.equal(state.profiles[0].name,'My profile');
});
test('invalid backups and unsafe links are rejected before import',()=>{
 assert.throws(()=>readBackup({}),/supported/);
 const p=profile();p.saved['job-1'].job.url='javascript:alert(1)';assert.throws(()=>readBackup(makeBackup({profiles:[p]})),/invalid/);
});
test('malicious prototype keys are rejected; unknown fields are discarded',()=>{
 const p=profile();p.preferences.unexpected='ignore';const result=readBackup(makeBackup({profiles:[p]}));assert.equal(result[0].preferences.unexpected,undefined);
 p.saved=JSON.parse('{"__proto__":{"job":{"id":"__proto__","title":"x","company":"x","url":"https://example.org"}}}');assert.throws(()=>readBackup(makeBackup({profiles:[p]})),/invalid/);
});
test('every profile is validated before copies can be committed',()=>{
 const p=profile();assert.throws(()=>readBackup(makeBackup({profiles:[p,{name:'Broken'}]})),/incomplete/);
});

test('backup round trip preserves formatted descriptions and ignores unknown block fields',()=>{
 const p=profile();p.saved['job-1'].job.descriptionBlocks=[{type:'heading',text:'Requirements',onclick:'bad()'},{type:'list',ordered:false,items:['TypeScript','React']},{type:'iframe',text:'bad'}];
 const restored=readBackup(makeBackup({profiles:[p]}))[0].saved['job-1'].job.descriptionBlocks;
 assert.deepEqual(restored,[{type:'heading',text:'Requirements'},{type:'list',ordered:false,items:['TypeScript','React']}]);
});
