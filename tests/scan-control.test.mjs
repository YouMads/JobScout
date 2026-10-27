import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {scanCancellation} from '../scan-control.mjs';
import {collectSite,createPublicReader} from '../scanner.mjs';
test('disconnecting a scan aborts its signal; normal completion and cleanup do not',()=>{
 const response=new EventEmitter();response.writableEnded=false;const run=scanCancellation(response,5000);response.emit('close');assert.equal(run.signal.aborted,true);run.dispose();assert.equal(response.listenerCount('close'),0);
 const completed=new EventEmitter();completed.writableEnded=true;const second=scanCancellation(completed,5000);completed.emit('close');assert.equal(second.signal.aborted,false);second.dispose();
});
test('collector cancellation prevents later pages and never returns a partial success as completed',async()=>{
 const controller=new AbortController(),calls=[];
 await assert.rejects(collectSite({url:'https://acme.com',signal:controller.signal,reader:async url=>{calls.push(url);controller.abort(Error('Stopped'));return {url,headers:{'content-type':'text/html'},body:'<a href="/careers">Careers</a><p>About us</p>'};}}),/Stopped/);
 assert.equal(calls.length,1);
});
test('a cancelled public reader makes no requests, including robots requests',async()=>{
 const controller=new AbortController();controller.abort();let requests=0;
 const reader=createPublicReader({signal:controller.signal,request:async()=>{requests++;}});await assert.rejects(reader('https://acme.com'));assert.equal(requests,0);
});
