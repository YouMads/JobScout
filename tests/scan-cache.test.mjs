import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createScanCache,scanCacheKey} from '../scan-cache.mjs';

test('recent scan reuse preserves completed results and the original checked time',()=>{
 let time=1000;const cache=createScanCache({now:()=>time});const record=cache.put('key',{checkedAt:'2026-10-23T10:00:00Z'});cache.complete(record.id,{jobs:[{title:'Developer'}],checkedAt:record.scan.checkedAt,aiComplete:true});time+=10000;assert.equal(cache.find('key').id,record.id);assert.equal(cache.get(record.id).result.aiComplete,true);assert.equal(cache.find('key').result.checkedAt,'2026-10-23T10:00:00Z');
});
test('five-minute reuse ends before the twenty-minute retry session expires',()=>{
 let time=0;const cache=createScanCache({now:()=>time});const record=cache.put('key',{});time=5*60000;assert.equal(cache.find('key'),null);assert.equal(cache.get(record.id).id,record.id);time=20*60000;assert.throws(()=>cache.get(record.id),/expired/);assert.equal(cache.size,0);
});
test('scan memory stays bounded and completion of an evicted record is harmless',()=>{
 const cache=createScanCache({maxEntries:2});const first=cache.put('a',{});cache.put('b',{});cache.put('c',{});assert.equal(cache.size,2);assert.throws(()=>cache.get(first.id),/expired/);assert.doesNotThrow(()=>cache.complete(first.id,{}));assert.equal(cache.find('a'),null);
});
test('cache keys distinguish websites and pasted text, and do not contain pasted content',()=>{
 const a=scanCacheKey({url:'https://acme.com/careers#jobs',pastedText:'private pasted text'});assert.equal(a,scanCacheKey({url:'https://acme.com/careers',pastedText:'private pasted text'}));assert.notEqual(a,scanCacheKey({url:'https://acme.com/careers',pastedText:'different text'}));assert.notEqual(a,scanCacheKey({url:'https://other.com/careers',pastedText:'private pasted text'}));assert.match(a,/^[a-f0-9]{64}$/);
});
