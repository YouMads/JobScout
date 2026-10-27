import {test} from 'node:test';
import assert from 'node:assert/strict';
import {feedFresh,refreshFeed,mapLimited,RETRY_MS} from '../feed-refresh.mjs';
const source={name:'Fixture',url:'https://example.org/jobs',formatVersion:1,parse:d=>d.jobs};
const now=Date.parse('2026-10-26T12:00:00Z');
test('failed feeds retain successful timestamp and retry earlier than successful TTL',async()=>{
 const previous={formatVersion:1,status:'ok',fetchedAt:new Date(now-86400000).toISOString()};const old=[{id:'kept'}];
 const result=await refreshFeed(source,previous,old,{now,fetcher:async()=>new Response('',{status:503})});
 assert.deepEqual(result.jobs,old);assert.equal(result.fetchedAt,previous.fetchedAt);assert.equal(result.status,'error');
 assert.equal(feedFresh(source,result,now+RETRY_MS-1),true);assert.equal(feedFresh(source,result,now+RETRY_MS),false);
 assert.equal(feedFresh(source,{...result,checkedAt:undefined},now),false);
});
test('conditional refresh reuses listings without downloading or parsing a body',async()=>{
 const first=await refreshFeed(source,null,[],{now,fetcher:async()=>Response.json({jobs:[{id:'one'}]},{headers:{etag:'"abc"'}})});
 let headers;
 const second=await refreshFeed(source,first,first.jobs,{now:now+86400000,fetcher:async(u,o)=>{headers=o.headers;return new Response(null,{status:304});}});
 assert.equal(headers['If-None-Match'],'"abc"');assert.equal(second.status,'ok');assert.equal(second.jobs[0].id,'one');assert.equal(second.revalidated,true);assert.notEqual(second.fetchedAt,first.fetchedAt);
});
test('changed feed replaces listings and validators, including empty results',async()=>{
 const result=await refreshFeed(source,{validator:{url:source.url,etag:'old'},formatVersion:1},[{id:'old'}],{now,fetcher:async()=>Response.json({jobs:[]},{headers:{etag:'new'}})});
 assert.deepEqual(result.jobs,[]);assert.equal(result.validator.etag,'new');
});
test('multi-page feeds and changed parser formats do not use old validators',async()=>{
 for(const s of [{...source,pages:2},{...source,formatVersion:2}]){
 await refreshFeed(s,{formatVersion:1,validator:{url:source.url,etag:'old'}},[],{now,fetcher:async(u,o)=>{assert.equal(o.headers['If-None-Match'],undefined);return Response.json({jobs:[]});}});
 }
});
test('download limit preserves cached jobs and reports error',async()=>{
 const result=await refreshFeed(source,null,[{id:'old'}],{now,maxBytes:4,fetcher:async()=>new Response('more than four bytes')});
 assert.equal(result.status,'error');assert.match(result.error,/limit/);assert.equal(result.jobs[0].id,'old');
});
test('refresh concurrency is bounded and results keep source order',async()=>{
 let active=0,peak=0;
 const result=await mapLimited([1,2,3,4,5,6],3,async n=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return n*2;});
 assert.equal(peak,3);assert.deepEqual(result,[2,4,6,8,10,12]);
});
