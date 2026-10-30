import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceHealth} from '../source-health.mjs';
const now=Date.parse('2026-10-30T12:00:00Z');
test('failed source without a successful download never invents success',()=>{
 const h=sourceHealth({name:'Test',status:'error',count:0,checkedAt:new Date(now).toISOString(),fetchedAt:null},now);
 assert.equal(h.lastSuccessAt,null);assert.equal(h.label,'No results available');assert.equal(h.minutes,15);assert.equal(h.ready,false);
});
test('failed source preserves cached count and separate successful timestamp',()=>{
 const h=sourceHealth({status:'error',count:12,checkedAt:new Date(now-16*60000).toISOString(),fetchedAt:'2026-10-29T12:00:00Z'},now);
 assert.equal(h.count,12);assert.equal(h.label,'Cached results available');assert.equal(h.ready,true);assert.equal(h.lastSuccessAt,'2026-10-29T12:00:00.000Z');
});
test('successful feeds use six hours, Himalayas uses a day',()=>{
 const source={status:'ok',count:2,fetchedAt:new Date(now).toISOString()};
 assert.equal(sourceHealth(source,now).minutes,360);assert.equal(sourceHealth({...source,name:'Himalayas'},now).minutes,1440);
 assert.equal(sourceHealth(source,now+6*3600000).ready,true);
});
test('invalid dates and counts remain unknown instead of displaying invalid dates',()=>{
 const h=sourceHealth({status:'error',count:-4,fetchedAt:'invalid'},now);assert.equal(h.checkedAt,null);assert.equal(h.count,0);assert.equal(h.ready,true);
});
