import {test} from 'node:test';
import assert from 'node:assert/strict';
import {feedbackAdvice,normalizeFeedback,normalizeDrafts,draftContext,draftMessages,validateDraft} from '../application-tools.mjs';
import {makeBackup,readBackup} from '../backup.mjs';
const request={job:{title:'Developer',description:'Java required'},profile:{skills:'Python, React',background:'Built a personal dashboard'},cv:{text:'PRIVATE CV CONTENT'}};
const draft={coverLetter:'Dear hiring team, [Your name]',cvSuggestions:['Explain your dashboard project'],questions:['Confirm work eligibility'],evidence:[{source:'background',quote:'Built a personal dashboard'}]};
test('feedback proposes explicit changes without mutating preferences or inferring a role',()=>{
 const p={level:'Any level',remoteScope:'likely'};assert.deepEqual(feedbackAdvice('country',p).patch,{remoteScope:'confirmed'});assert.deepEqual(feedbackAdvice('seniority',p).patch,{experienceMode:'strict',level:'Intern / Junior'});assert.deepEqual(feedbackAdvice('role',p).patch,{});assert.equal(p.level,'Any level');assert.deepEqual(feedbackAdvice('country',{remoteScope:'confirmed'}).patch,{});
});
test('draft context requires evidence and excludes CV unless explicitly selected',()=>{
 assert.equal(draftContext(request).candidate.cv,'');assert.equal(draftContext({...request,includeCv:true}).candidate.cv,'PRIVATE CV CONTENT');assert.throws(()=>draftContext({job:request.job,profile:{}}),/skills/);assert.throws(()=>draftContext({}),/title/);
 const c=draftContext({...request,includeCv:true,cv:{text:'x'.repeat(12000)}});assert.equal(c.candidate.cv.length,8000);assert.match(draftMessages(c)[0].content,/untrusted DATA/);
});
test('draft validation rejects invented evidence and malformed or excessive output',()=>{
 const c=draftContext(request);assert.deepEqual(validateDraft(draft,c),draft);
 assert.throws(()=>validateDraft({...draft,evidence:[{source:'cv',quote:'PRIVATE CV CONTENT'}]},c),/unsupported/);
 assert.throws(()=>validateDraft({...draft,evidence:[{source:'job',quote:'Java required'}]},c),/unsupported/);
 assert.throws(()=>validateDraft({...draft,evidence:[{source:'skills',quote:'Expert in Java'}]},c),/unsupported/);
 assert.throws(()=>validateDraft({...draft,coverLetter:'x'.repeat(8001)},c),/incomplete/);
 assert.throws(()=>validateDraft({...draft,questions:'bad'},c),/incomplete/);
});
test('feedback and drafts are bounded and reject dangerous keys',()=>{
 assert.deepEqual(normalizeDrafts(undefined),{});assert.deepEqual(normalizeFeedback(undefined),{});
 assert.deepEqual(normalizeFeedback(JSON.parse('{"__proto__":{"reason":"role"}}')),{});
 assert.equal(Object.keys(normalizeDrafts(Object.fromEntries(Array.from({length:60},(_,i)=>['j'+i,draft])))).length,50);
 assert.equal(Object.keys(normalizeFeedback(Object.fromEntries(Array.from({length:310},(_,i)=>['j'+i,{reason:'role'}])))).length,300);
});
test('backups preserve draft edits and feedback independently for each profile',()=>{
 const p={name:'A',preferences:{country:'CY'},saved:{},reviews:{},drafts:{job:{...draft,coverLetter:'Edited letter',model:'local',cvUsed:false}},feedback:{job:{reason:'role',createdAt:'2026-10-31'}}};
 const restored=readBackup(makeBackup({profiles:[p,{...p,name:'B',drafts:{},feedback:{}}]}));
 assert.equal(restored[0].drafts.job.coverLetter,'Edited letter');assert.equal(restored[0].feedback.job.reason,'role');assert.deepEqual(restored[1].drafts,{});assert.deepEqual(restored[1].feedback,{});
});
