import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveSearch,normalizeSavedSearches} from '../saved-searches.mjs';
import {makeBackup,readBackup} from '../backup.mjs';
const entry=(id='search-1')=>({id,name:'Cyprus junior',preferences:{country:'CY',role:'Backend developer',level:'Intern / Junior',skills:'Java',background:'private',model:'private-model'},enabledSources:['Jobicy']});
test('saved searches snapshot filters without private AI context or mutable sources',()=>{
 const input=entry(),list=saveSearch([],input);input.enabledSources.push('Remotive');input.preferences.skills='React';
 assert.deepEqual(list[0].enabledSources,['Jobicy']);assert.equal(list[0].preferences.skills,'Java');assert.equal(list[0].preferences.background,undefined);assert.equal(list[0].preferences.model,undefined);
});
test('update preserves other searches and enforces bounded creation',()=>{
 let list=Array.from({length:20},(_,i)=>entry('search-'+i));
 assert.throws(()=>saveSearch(list,entry('extra')),/20/);
 const updated=saveSearch(list,{...entry('search-0'),name:'Edited'});assert.equal(updated.length,20);assert.equal(updated[0].name,'Edited');assert.equal(list[0].name,'Cyprus junior');
 assert.throws(()=>saveSearch([],{...entry(),name:'  '}),/name/);
});
test('normalization supports legacy profiles and removes duplicates and unknown fields',()=>{
 assert.deepEqual(normalizeSavedSearches(undefined),[]);
 const list=normalizeSavedSearches([entry(),entry(),null,{id:'bad id',name:'bad'}]);assert.equal(list.length,1);
 assert.equal(normalizeSavedSearches([{id:'a',name:'Sparse'}])[0].preferences.skills,'');
});
test('backup roundtrip keeps searches separate per profile and preserves empty source selection',()=>{
 const p={name:'One',preferences:{country:'CY'},saved:{},reviews:{},savedSearches:saveSearch([],{...entry(),enabledSources:[]})};
 const restored=readBackup(makeBackup({profiles:[p,{...p,name:'Two',savedSearches:[]}]}));
 assert.equal(restored[0].savedSearches[0].name,'Cyprus junior');assert.deepEqual(restored[0].savedSearches[0].enabledSources,[]);assert.deepEqual(restored[1].savedSearches,[]);
});
