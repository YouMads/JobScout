import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchJobs,deduplicate,text,safeUrl} from '../lib.mjs';
const job=(id,title,location,remote=false)=>({id,title,company:'Test',location,remote,description:'Python Django React',tags:[],date:'2026-10-20',work:remote?'Remote':'Hybrid',url:'https://example.org/'+id});
test('remote location restrictions remain excluded unless requested',()=>{
 const jobs=[job('1','Python developer','USA',true),job('2','Python developer','Worldwide',true),job('3','Python developer','Nicosia, Cyprus')];
 assert.deepEqual(matchJobs(jobs,{area:'Cyprus + remote',remoteScope:'likely'}).map(j=>j.id),['3','2']);
 assert.equal(matchJobs(jobs,{remoteScope:'all'}).length,3);
});
test('Cyprus and remote filters and junior exclusions apply independently',()=>{
 const jobs=[job('1','Senior developer','Limassol'),job('2','Junior developer','Limassol'),job('3','Junior developer','Worldwide',true)];
 assert.deepEqual(matchJobs(jobs,{area:'Cyprus',level:'Intern / Junior'}).map(j=>j.id),['2']);
 assert.deepEqual(matchJobs(jobs,{area:'Remote',remoteScope:'all'}).map(j=>j.id),['3']);
});
test('skill scores do not fabricate a match without skills',()=>{
 assert.equal(matchJobs([job('1','Python developer','Cyprus')],{})[0].score,null);
 assert.equal(matchJobs([job('1','Python developer','Cyprus')],{skills:'Python, Rust'})[0].score,50);
});
test('business development and service desk titles do not count as software developers',()=>{
 const jobs=[job('1','Business Development Officer','Cyprus'),job('2','Service Desk Engineer','Cyprus'),job('3','Software Engineer','Cyprus')];
 assert.deepEqual(matchJobs(jobs,{}).map(j=>j.id),['3']);
});
test('unsafe links and duplicate jobs are dropped; markup becomes text',()=>{
 assert.equal(safeUrl('javascript:alert(1)'), '');
 assert.equal(deduplicate([job('1','Developer','Cyprus'),job('2','Developer','Cyprus')]).length,1);
 assert.equal(text('&lt;p&gt;Python &amp; Django&lt;/p&gt;'),'Python & Django');
});
