import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jobKey,normalizeTracking,trackSearch,activityFor,setActivity,activityMatches,createManualJob,normalizeCv,normalizeEnabled} from '../workspace.mjs';
import {cvSkills,compareCv} from '../candidate.mjs';
import {experienceSignals} from '../matching.mjs';
import {matchJobs} from '../lib.mjs';
import {makeBackup,readBackup} from '../backup.mjs';
import {filterResults} from '../public/view-model.mjs';
const now='2026-10-22T09:00:00.000Z',later='2026-10-23T09:00:00.000Z';
const job={id:'a',title:'Software Developer',company:'Example',location:'Cyprus',description:'Build React and Python applications',url:'https://example.org/jobs/a',source:'Jobicy',date:now,tags:[]};
test('first search establishes a baseline; later discoveries are new until seen',()=>{
 const t=trackSearch(null,[job],now);assert.equal(activityFor(t,job).isNew,false);assert.equal(activityFor(t,job).seen,false);
 const second={...job,id:'b',title:'Frontend Developer'};const next=trackSearch(t,[job,second],later);
 assert.equal(activityFor(next,second).isNew,true);assert.equal(activityFor(next,job).isNew,false);
 const viewed=setActivity(next,second,'seen',later);assert.equal(activityFor(viewed,second).isNew,false);assert.equal(activityMatches(viewed,second,'seen'),true);assert.equal(activityFor(next,second).seen,false);
});
test('hidden history survives re-fetches and alternate feed IDs; restoring keeps seen status',()=>{
 let t=trackSearch(null,[job],now);t=setActivity(t,job,'seen',now);t=setActivity(t,job,'hide',later);
 const duplicate={...job,id:'another-feed-1',source:'Himalayas',url:'https://other.example/job'};
 t=trackSearch(t,[duplicate],later);assert.equal(jobKey(duplicate),jobKey(job));assert.equal(activityMatches(t,duplicate,'all'),false);assert.equal(activityMatches(t,duplicate,'hidden'),true);
 t=setActivity(t,duplicate,'restore',later);assert.equal(activityMatches(t,job,'all'),true);assert.equal(activityFor(t,job).seen,true);assert.equal(t.lastSearchAt,later);
});
test('reading activity does not change last search time or other profiles',()=>{
 const t=trackSearch(null,[job],now);const other=normalizeTracking();const seen=setActivity(t,job,'seen',later);
 assert.equal(seen.lastSearchAt,now);assert.equal(activityFor(t,job).seen,false);assert.equal(Object.keys(other.records).length,0);
});
test('tracking rejects malformed keys and dates and normalizes source preferences',()=>{
 assert.equal(Object.keys(normalizeTracking({records:{__proto__:{},bad:{firstSeenAt:now},'job:0000000000000000':{firstSeenAt:'bad'}}}).records).length,0);
 assert.equal(normalizeEnabled(undefined),null);assert.deepEqual(normalizeEnabled([]),[]);assert.deepEqual(normalizeEnabled(['Jobicy','Jobicy',4]),['Jobicy']);
});
test('manual imports require safe links and keep source attribution and formatting',()=>{
 const m=createManualJob({...job,url:'https://www.carierista.com/en/jobs/123',work:'Remote',description:'Requirements:\n- React\n- Python'},'manual-demo',now);
 assert.equal(m.manual,true);assert.equal(m.source,'Carierista (manual)');assert.equal(m.descriptionBlocks[1].type,'list');assert.equal(m.remote,true);assert.equal(m.dateLabel,'Added');
 for(const url of ['javascript:alert(1)','file:///secret','https://user:password@example.org'])assert.throws(()=>createManualJob({...job,url},'manual-demo',now),/valid/);
});
test('CV keywords use boundaries, keep absent skills absent and avoid the verb go',()=>{
 assert.deepEqual(cvSkills('I use JavaScript and go to Cyprus.'),['JavaScript']);
 assert.equal(compareCv({...job,description:'Please go to the office',title:'Developer'},{text:'Go developer'}).count,0);
 const cv={text:'Projects: Python, React, Node.js, PostgreSQL. I developed APIs.'};const result=compareCv(job,cv);
 assert.deepEqual(result.shared,['Python','React']);assert.equal(result.total,4);assert.equal(result.count,2);assert.equal(compareCv(job,{}).score,null);
 assert.deepEqual(cvSkills('Go and golang, C++, C#, .NET'),['C#','C++','Go','.NET']);
});
test('junior evidence distinguishes explicit titles, early requirements, conflicts and unknowns',()=>{
 assert.equal(experienceSignals({...job,title:'Junior Developer'}).category,'junior');
 assert.equal(experienceSignals({...job,description:'2 years of software engineering experience'}).category,'early');
 assert.equal(experienceSignals(job).category,'unknown');
 assert.equal(experienceSignals({...job,title:'Junior Developer',description:'Minimum 5 years of professional experience'}).category,'conflict');
 const jobs=[job,{...job,id:'b',title:'Junior Developer'},{...job,id:'c',description:'1 year of software experience'}];
 assert.deepEqual(matchJobs(jobs,{level:'Intern / Junior',juniorEvidence:'explicit'}).map(j=>j.id),['b']);
 assert.deepEqual(matchJobs(jobs,{level:'Intern / Junior',juniorEvidence:'early'}).map(j=>j.id).sort(),['b','c']);
});
test('CV sorting uses overlap counts without inventing scores',()=>{
 const jobs=[{...job,id:'a',cvMatch:{count:1}},{...job,id:'b',cvMatch:{count:3}}];assert.deepEqual(filterResults(jobs,{sort:'cv'}).map(j=>j.id),['b','a']);
});
test('backups retain manual jobs, CV text, history and profile source choices; old backups still import',()=>{
 const m=createManualJob(job,'manual-demo',now),tracking=setActivity(trackSearch(null,[job],now),job,'hide',later);
 const profile={name:'My profile',preferences:{juniorEvidence:'explicit'},saved:{[m.id]:{job:m,stage:'Applied',notes:'Call on Friday'}},reviews:{},tracking,cv:normalizeCv({text:'Python and React experience',name:'cv.pdf',updatedAt:now}),enabledSources:['Jobicy']};
 const restored=readBackup(JSON.parse(JSON.stringify(makeBackup({profiles:[profile]}))))[0];
 assert.equal(restored.saved[m.id].job.manual,true);assert.equal(restored.cv.text,profile.cv.text);assert.equal(activityFor(restored.tracking,job).hidden,true);assert.deepEqual(restored.enabledSources,['Jobicy']);assert.equal(restored.preferences.juniorEvidence,'explicit');
 const legacy=readBackup(makeBackup({profiles:[{name:'Old profile',preferences:{},saved:{},reviews:{}}]}))[0];assert.equal(legacy.cv.text,'');assert.equal(legacy.enabledSources,null);
});
