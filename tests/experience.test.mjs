import {test} from 'node:test';
import assert from 'node:assert/strict';
import {experienceSignals,locationSignals} from '../matching.mjs';
import {matchJobs,skillMention} from '../lib.mjs';
const job=(description,location='Cyprus')=>({id:'1',title:'Developer',company:'Acme',description,location,remote:true,work:'Remote',url:'https://example.org/job',tags:[]});
test('junior filtering reads numeric experience requirements beyond title',()=>{
 const j=job('Minimum 5 years of work experience in JavaScript development.');
 assert.equal(experienceSignals(j).minimumYears,5);
 assert.equal(matchJobs([j],{level:'Intern / Junior'}).length,0);
 assert.equal(matchJobs([j],{level:'Intern / Junior',experienceMode:'flag'})[0].experienceAboveProfile,true);
 assert.equal(matchJobs([j],{level:'Intern / Junior',years:'5'}).length,1);
});
test('experience ranges use the lower bound and unknown requirements stay unknown',()=>{
 assert.equal(experienceSignals(job('3–5 years of professional experience')).minimumYears,3);
 assert.equal(experienceSignals(job('You will join a team of 20 engineers.')).minimumYears,null);
 assert.equal(matchJobs([job('Python and React')],{years:'0'}).length,1);
});
test('preferred years do not become mandatory experience',()=>{
 assert.equal(experienceSignals(job('3 years of experience preferred.')).minimumYears,null);
});
test('skill boundaries do not confuse Java with JavaScript or C with C++',()=>{
 assert.equal(skillMention('JavaScript developer','java'),false);
 assert.equal(skillMention('C++ developer','c'),false);
 assert.equal(skillMention('C++ developer','c++'),true);
 assert.equal(skillMention('C# and .NET developer','.net'),true);
 assert.equal(skillMention('JavaScript developer','js'),true);
});
test('timezone mismatch is explicit and excluded by the default remote filter',()=>{
 const j={...job('Python','Worldwide'),timezoneRestrictions:[-8,-5]};
 assert.equal(locationSignals(j).tzExcluded,true);
 assert.equal(matchJobs([j],{}).length,0);
 assert.equal(matchJobs([j],{remoteScope:'all'}).length,1);
 assert.equal(locationSignals(job('Python','Worldwide · Timezones: UTC-8, UTC-5')).tzExcluded,true);
});
test('explicit lead mode distinguishes Europe from Cyprus without promising permission',()=>{
 assert.equal(matchJobs([job('Python','Europe')],{remoteScope:'confirmed'}).length,0);
 assert.equal(matchJobs([job('Python','Cyprus')],{remoteScope:'confirmed'}).length,1);
 assert.equal(locationSignals(job('Must be based in Germany.','Worldwide')).confirmedLead,false);
});

test('preferred sections do not become hard junior exclusions and mandatory sections reset the context',()=>{
 const j=job('Requirements:\n- One year of professional experience\nNice to have:\n- Five years of experience with React\nBenefits:\n- Training and flexible hours');
 const check=experienceSignals(j);assert.equal(check.minimumYears,1);assert.equal(check.preferredYears,5);assert.equal(matchJobs([j],{level:'Intern / Junior'}).length,1);
});
test('required and preferred years on the same line retain distinct evidence',()=>{
 const check=experienceSignals(job('Minimum 2 years of experience; ideally 5 years of experience with Java.'));
 assert.equal(check.minimumYears,2);assert.equal(check.preferredYears,5);
});
test('employer history is not candidate experience and unknown does not become junior',()=>{
 const check=experienceSignals(job('Our company has 20 years of experience delivering software.'));assert.equal(check.minimumYears,null);assert.equal(check.category,'unknown');
 assert.equal(matchJobs([job('Five years of experience preferred.')],{level:'Intern / Junior',juniorEvidence:'early'}).length,0);
});
test('a high mandatory requirement still excludes a junior title even in an optional section',()=>{
 const j={...job('Nice to have:\nMinimum 5 years of experience required.'),title:'Junior Developer'};assert.equal(experienceSignals(j).category,'conflict');assert.equal(matchJobs([j],{level:'Intern / Junior'}).length,0);
});

test('a preferred clause after and does not downgrade the preceding required years',()=>{
 const check=experienceSignals(job('Minimum 2 years of experience required and 5 years of experience preferred.'));assert.equal(check.minimumYears,2);assert.equal(check.preferredYears,5);
});
