import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarDay,localDay,normalizePlan,followUpStatus,followUpCounts,filterApplications,applicationsCsv} from '../workspace.mjs';
import {makeBackup,readBackup} from '../backup.mjs';
const entry=(id,extra={})=>({job:{id,title:'Developer',company:id,url:'https://example.org/'+id,location:'Cyprus',source:'Careers'},stage:'Applied',notes:'My note',savedAt:'2026-10-23',...extra});
test('calendar dates reject impossible days and preserve local calendar days',()=>{
 assert.equal(calendarDay('2026-02-29'),'');assert.equal(calendarDay('2028-02-29'),'2028-02-29');assert.equal(calendarDay('2026-13-01'),'');assert.equal(calendarDay('2026-10-23T00:00:00Z'),'');assert.equal(calendarDay('0099-01-01'),'');assert.equal(localDay(new Date(2026,9,23,0,1)),'2026-10-23');
});
test('old and malformed plans have bounded defaults',()=>{
 assert.deepEqual(normalizePlan(),{priority:'Normal',followUp:'',nextAction:''});assert.deepEqual(normalizePlan({priority:'urgent',followUp:'tomorrow',nextAction:{}}),normalizePlan());assert.equal(normalizePlan({nextAction:'x'.repeat(500)}).nextAction.length,240);
});
test('follow-ups distinguish overdue, today, upcoming, missing, and closed',()=>{
 const saved={a:entry('a',{followUp:'2026-10-22'}),b:entry('b',{followUp:'2026-10-23'}),c:entry('c',{followUp:'2026-10-24'}),d:entry('d'),e:entry('e',{stage:'Closed',followUp:'2026-10-01'})};
 assert.deepEqual(followUpCounts(saved,'2026-10-23'),{overdue:1,today:1,upcoming:1,none:2});assert.equal(followUpStatus(saved.e,'2026-10-23'),'none');
});
test('planner filters compose, sort dates and priorities, and do not mutate jobs',()=>{
 const saved={a:entry('a',{priority:'Low',followUp:'2026-10-24'}),b:entry('b',{priority:'High',followUp:'2026-10-22'}),c:entry('c',{priority:'High'})};const jobs=Object.values(saved).map(s=>s.job);
 assert.deepEqual(filterApplications(jobs,saved,{followUp:'overdue',priority:'High',today:'2026-10-23'}).map(j=>j.id),['b']);assert.deepEqual(filterApplications(jobs,saved,{sort:'followup'}).map(j=>j.id),['b','a','c']);assert.deepEqual(filterApplications(jobs,saved,{sort:'priority'}).map(j=>j.id),['b','c','a']);assert.deepEqual(jobs.map(j=>j.id),['a','b','c']);
});
test('spreadsheet export quotes multiline text and neutralises formula cells',()=>{
 const saved={a:entry('a',{notes:'Line 1\n"quoted"',nextAction:' =HYPERLINK("bad")'})};saved.a.job.title='=1+1';saved.a.job.company='@SUM(A1)';
 const csv=applicationsCsv(saved);assert.ok(csv.startsWith('\uFEFF"Job title"'));assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"\'@SUM(A1)"'));assert.ok(csv.includes('Line 1\n""quoted""'));assert.ok(csv.includes("' =HYPERLINK"));assert.ok(csv.includes('https://example.org/a'));
});
test('backups preserve planning data and continue accepting older saved entries',()=>{
 const profile={name:'Test',preferences:{},reviews:{},saved:{a:entry('a',{priority:'High',followUp:'2026-10-24',nextAction:'Ask about remote eligibility'}),b:entry('b')}};
 const restored=readBackup(makeBackup({profiles:[profile]}))[0];assert.equal(restored.saved.a.followUp,'2026-10-24');assert.equal(restored.saved.a.priority,'High');assert.equal(restored.saved.a.nextAction,'Ask about remote eligibility');assert.equal(restored.saved.b.priority,'Normal');assert.equal(restored.saved.b.notes,'My note');
});
