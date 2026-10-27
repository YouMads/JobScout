import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addWebsite,recordWebsiteScan,normalizeWatchlist,websiteUrl,roleKey,MAX_HISTORY,MAX_WEBSITES,runWebsiteQueue} from '../watchlist.mjs';
import {readBackup,makeBackup} from '../backup.mjs';
const stamp=n=>'2026-10-'+String(n).padStart(2,'0')+'T10:00:00.000Z';
const role=(n,extra={})=>({title:'Developer '+n,company:'Acme',location:'Cyprus',url:'https://acme.com/jobs/'+n,...extra});
const site=()=>addWebsite([],{url:'https://www.acme.com/careers/',name:'Acme',id:'site-acme',now:stamp(20)}).site;
const report=(n,jobs,extra={})=>({root:'https://www.acme.com/careers/',checkedAt:stamp(n),pages:[{url:'https://acme.com/careers',status:'read'}],readCount:1,jobs,aiComplete:true,limited:false,pasted:false,...extra});
test('saved links preserve the actual www hostname and path, and equivalent links are not added twice',()=>{
 const first=addWebsite([],{url:'https://www.acme.com/careers/?utm_source=one',id:'site-1'});
 assert.match(first.site.url,/www\.acme\.com\/careers\//);
 const next=addWebsite(first.sites,{url:'https://acme.com/careers?utm_source=two',id:'site-2'});
 assert.equal(next.existing,true);assert.equal(next.sites.length,1);
 assert.throws(()=>websiteUrl('http://127.0.0.1/'),/public/);assert.throws(()=>websiteUrl('https://user:pass@acme.com/'),/login/);
});
test('the first full scan creates a baseline; a comparable scan reports new and not-seen roles with links',()=>{
 const first=recordWebsiteScan(site(),report(21,[role(1),role(2)]));assert.equal(first.changes.compared,false);assert.equal(first.changes.addedKeys.length,0);
 const next=recordWebsiteScan(first,report(22,[role(2),role(3)]));assert.equal(next.changes.compared,true);assert.deepEqual(next.changes.addedKeys,[roleKey(role(3))]);assert.deepEqual(next.changes.notSeen,[role(1)]);assert.equal(next.changes.baselineAt,stamp(21));assert.equal(first.snapshot.items.length,2);
});
test('empty full results can flag previously seen jobs without claiming closure',()=>{
 const first=recordWebsiteScan(site(),report(21,[role(1)])),next=recordWebsiteScan(first,report(22,[]));
 assert.equal(next.snapshot.items.length,0);assert.equal(next.changes.notSeen.length,1);assert.match(next.changes.reason,/does not mean closed/);
});
test('limited, skipped, pasted, failed and cancelled reads do not replace the last full snapshot',()=>{
 const first=recordWebsiteScan(site(),report(21,[role(1)]));
 for(const [data,options] of [[report(22,[],{limited:true}),{}],[report(22,[],{pages:[{url:'https://acme.com/careers',status:'skipped'}]}),{}],[report(22,[],{pasted:true}),{}],[null,{error:'Blocked'}],[report(22,[role(2)]),{cancelled:true}]]){
  const next=recordWebsiteScan(first,data,options);assert.deepEqual(next.snapshot,first.snapshot);assert.equal(next.changes.compared,false);assert.equal(next.changes.notSeen.length,0);
 }
});
test('a changed set of pages resets the baseline rather than inventing openings or closures',()=>{
 const first=recordWebsiteScan(site(),report(21,[role(1)])),next=recordWebsiteScan(first,report(22,[role(2)],{pages:[{url:'https://acme.com/new-careers',status:'read'}]}));
 assert.equal(next.changes.compared,false);assert.match(next.changes.reason,/pages checked changed/);assert.equal(next.snapshot.items[0].title,'Developer 2');
});
test('recent cached reports do not create another history entry or erase a change highlight',()=>{
 const first=recordWebsiteScan(site(),report(21,[role(1)])),second=recordWebsiteScan(first,report(22,[role(1),role(2)]));
 assert.deepEqual(recordWebsiteScan(second,report(22,[role(1),role(2)],{cached:true})),second);
});
test('finishing a retried AI step upgrades a partial attempt with the same checked time',()=>{
 const first=recordWebsiteScan(site(),report(21,[role(1)],{aiComplete:false}),{error:'AI busy'});
 const next=recordWebsiteScan(first,report(21,[role(1)]));assert.equal(next.history.length,1);assert.equal(next.history[0].status,'complete');assert.equal(next.snapshot.items.length,1);
});
test('tracking parameters and location punctuation do not invent new scanned roles',()=>{
 const first=recordWebsiteScan(site(),report(21,[role(1,{location:'Limassol, Cyprus'})]));
 const next=recordWebsiteScan(first,report(22,[role(1,{url:'https://acme.com/jobs/1?utm_source=email',location:'Limassol / Cyprus'})]));assert.equal(next.changes.addedKeys.length,0);assert.equal(next.changes.notSeen.length,0);
});
test('watchlist retention and snapshots are bounded without keeping page text, CVs or descriptions',()=>{
 let current=site();for(let n=1;n<=20;n++)current=recordWebsiteScan(current,report(n,[role(1,{description:'secret text',cv:'private',evidence:'page quote'})]));
 assert.equal(current.history.length,MAX_HISTORY);const json=JSON.stringify(current);assert.ok(!json.includes('secret text'));assert.ok(!json.includes('private'));assert.ok(!json.includes('page quote'));
 let list=[];for(let n=0;n<MAX_WEBSITES;n++)list=addWebsite(list,{url:'https://acme'+n+'.com',id:'site-'+n}).sites;assert.throws(()=>addWebsite(list,{url:'https://another.com',id:'site-extra'}),/up to/);
});
test('backups round-trip company links and histories while old profiles get an empty watchlist',()=>{
 const watched=recordWebsiteScan(site(),report(21,[role(1)])),profile={name:'One',preferences:{},saved:{},reviews:{},websites:[watched]};
 const restored=readBackup(JSON.parse(JSON.stringify(makeBackup({profiles:[profile,{...profile,name:'Two',websites:[]}]}))));assert.deepEqual(restored[0].websites,[watched]);assert.deepEqual(restored[1].websites,[]);assert.equal(profile.websites[0].history.length,1);
 const legacy={name:'Old',preferences:{},saved:{},reviews:{}};assert.deepEqual(readBackup(makeBackup({profiles:[legacy]}))[0].websites,[]);
});
test('malformed imported sites, unsafe links and unexpected fields are discarded',()=>{
 const safe=site(),result=normalizeWatchlist([{...safe,id:'__proto__'},{...safe,url:'javascript:alert(1)'},{...safe,unexpected:'discard',history:[{status:'made-up',at:stamp(21)}]}]);
 assert.equal(result.length,1);assert.equal(result[0].unexpected,undefined);assert.equal(result[0].history.length,0);
});

test('editing a link cannot attach the previous website report to another saved company',()=>{
 assert.throws(()=>recordWebsiteScan(site(),report(21,[role(1)],{root:'https://other-company.com/careers'})),/different website/);
});
test('website batches run sequentially and cancellation leaves later queue entries untouched',async()=>{
 const visited=[];let stop=false,active=0;
 const completed=await runWebsiteQueue(['first','second','third'],async id=>{active++;assert.equal(active,1);visited.push(id);await Promise.resolve();stop=true;active--;},()=>stop);
 assert.deepEqual(visited,['first']);assert.equal(completed,1);
});
