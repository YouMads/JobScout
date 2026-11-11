import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applicationRequirements} from '../requirements.mjs';
const read=description=>applicationRequirements({description});
test('requirements keep exact positive and negative evidence without deciding eligibility',()=>{
 const text='Applicants must have the right to work in Cyprus. No visa sponsorship is available. Fluent English is required.';
 const result=read(text);assert.deepEqual(result.map(x=>x.id),['authorization','sponsorship','language']);assert.equal(result[1].evidence[0],'No visa sponsorship is available.');assert.equal(result[2].evidence[0],'Fluent English is required.');
 assert.equal(read('Visa sponsorship is available.')[0].evidence[0],'Visa sponsorship is available.');
});
test('HTML lists, preferences and duplicate wording are handled without executing source markup',()=>{
 const result=read('<ul><li>German is preferred.</li><li>German is preferred.</li><li>Work permit required.</li></ul><script>Visa sponsorship is available.</script>');
 assert.deepEqual(result.map(x=>x.id),['authorization','language']);assert.deepEqual(result[1].evidence,['German is preferred.']);
});
test('technical fluency, sponsor marketing and absent wording do not become requirements',()=>{
 for(const text of ['', 'Fluent in Python and proficient in React.', 'We sponsor a local sports team.', 'Build a language model using Python.'])assert.deepEqual(read(text),[],text);
});
test('evidence excerpts per category are bounded and old saved jobs remain supported',()=>{
 assert.equal(read(Array.from({length:8},(_,i)=>'English is required for team '+i+'.').join(' '))[0].evidence.length,3);
 assert.deepEqual(applicationRequirements({}),[]);
});
