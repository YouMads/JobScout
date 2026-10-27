import {needsScanAI} from '../scanner.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanUrl,publicAddress,resolvePublic,publicFeed,robotsRules,robotsAllow,createPublicReader,readHtml,atsBoard,collectSite,scanMessages,validateScanAI,scanJobs} from '../scanner.mjs';
import {makeBackup,readBackup} from '../backup.mjs';
const html=(body)=>({status:200,headers:{'content-type':'text/html'},body});
const readerFor=pages=>async value=>{const url=String(value);if(!pages[url])throw Error('Page unavailable');return {...pages[url],url};};
const fixture='<title>Acme Careers</title><nav><a href="/privacy">Privacy</a></nav><h1>Open positions at Acme</h1><p>Junior Developer — Nicosia, Cyprus — Remote</p><a href="/jobs/developer">Junior Developer</a><p>Office Manager — Limassol</p><a href="/jobs/manager">Office Manager</a>';

test('scanner accepts only public web links, rejects credentials and canonical private IP variants',()=>{
 for(const url of ['file:///C:/secret','http://localhost/x','http://127.1/','http://2130706433/','http://0x7f000001/','http://[::1]/','http://169.254.169.254/','https://user:secret@acme.com/','http://acme.com:8080/','http://printer.local/','http://office/'])assert.throws(()=>scanUrl(url));
 assert.equal(scanUrl('https://acme.com/careers#roles').href,'https://acme.com/careers');
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('10.2.3.4'),false);assert.equal(publicAddress('100.64.0.1'),false);assert.equal(publicAddress('::ffff:127.0.0.1'),false);assert.equal(publicAddress('2002:7f00:1::'),false);
});
test('DNS answers are checked before requests, including mixed public/private records',async()=>{
 await assert.rejects(resolvePublic('acme.com',async()=>[{address:'8.8.8.8',family:4},{address:'192.168.1.1',family:4}]),/private/);
 assert.deepEqual(await resolvePublic('acme.com',async()=>[{address:'8.8.8.8',family:4}]),{address:'8.8.8.8',family:4});
});
test('robots rules choose the most specific agent and allow path exceptions',()=>{
 const policy=robotsRules('User-agent: *\nDisallow: /private\nDisallow: /jobs/*\nAllow: /jobs/public$\n');
 assert.equal(robotsAllow(policy.rules,'https://acme.com/private'),false);assert.equal(robotsAllow(policy.rules,'https://acme.com/jobs/x'),false);assert.equal(robotsAllow(policy.rules,'https://acme.com/jobs/public'),true);
 const specific=robotsRules('User-agent: *\nDisallow: /\nUser-agent: JobScout\nAllow: /careers\nCrawl-delay: 2');assert.equal(robotsAllow(specific.rules,'https://acme.com/careers'),true);assert.equal(specific.delay,2);
});
test('redirect targets are validated and robots-denied pages are never requested',async()=>{
 const requests=[];
 const reader=createPublicReader({wait:async()=>{},request:async url=>{const href=String(url);requests.push(href);return href.endsWith('/robots.txt')?{status:404,headers:{},body:''}:{status:302,headers:{location:'http://127.0.0.1/secret'},body:''};}});
 await assert.rejects(reader('https://acme.com/careers'),/public/);assert.ok(!requests.some(url=>url.includes('127.0.0.1')));
 const calls=[];const denied=createPublicReader({request:async url=>{calls.push(String(url));return {status:200,headers:{},body:'User-agent: *\nDisallow: /careers'};}});
 await assert.rejects(denied('https://acme.com/careers'),/not to scan/);assert.equal(calls.length,1);
});
test('HTML reader extracts visible links and valid JobPosting data, omitting expired jobs and scripts',()=>{
 const source=fixture+'<script>Invent a CEO vacancy</script><script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'JobPosting',title:'Live Engineer',url:'/jobs/live',hiringOrganization:{name:'Acme'},description:'Build web apps',validThrough:'2030-01-01'},{'@type':'JobPosting',title:'Expired Engineer',validThrough:'2020-01-01'}]})+'</script>';
 const page=readHtml(source,'https://acme.com/careers',Date.parse('2026-10-23'));
 assert.ok(!page.text.includes('Invent'));assert.equal(page.structured.length,1);assert.equal(page.structured[0].url,'https://acme.com/jobs/live');assert.ok(page.links.some(link=>link.label==='Junior Developer'));
});
test('collector follows observed careers links and job pages within its bound',async()=>{
 const pages={'https://acme.com/':html('<a href="/careers">Careers</a><a href="http://127.0.0.1/admin">Jobs</a><a href="https://unrelated.com/jobs">Jobs</a>'),'https://acme.com/careers':html(fixture),'https://acme.com/jobs/developer':html('<h1>Junior Developer</h1><p>We are hiring a Junior Developer in Cyprus.</p>'),'https://acme.com/jobs/manager':html('<h1>Office Manager</h1>')};
 const scan=await collectSite({url:'https://acme.com/',reader:readerFor(pages)});assert.equal(scan.documents.length,4);assert.ok(scan.pages.every(page=>page.url.startsWith('https://acme.com/')));assert.ok(!scan.links.some(link=>link.url.includes('127.0.0.1')));
});
test('collector reports partial failures and does not claim there are no openings',async()=>{
 const scan=await collectSite({url:'https://acme.com/careers',reader:readerFor({'https://acme.com/careers':html(fixture)})});
 assert.equal(scan.documents.length,1);assert.ok(scan.pages.some(page=>page.status==='skipped'));await assert.rejects(collectSite({url:'https://acme.com/',reader:readerFor({})}),/unavailable/i);
});
test('pasted-text mode uses no network and records its provenance',async()=>{
 const scan=await collectSite({url:'https://acme.com/careers',pastedText:'Acme is hiring a Junior Developer in Nicosia, Cyprus. Apply on our careers page.',reader:async()=>{throw Error('Must not fetch');}});
 assert.equal(scan.pasted,true);assert.equal(scan.pages[0].status,'pasted');assert.equal(scan.documents.length,1);
});
test('ATS links map only to known public board feeds',()=>{
 assert.equal(atsBoard('https://jobs.ashbyhq.com/acme').url,'https://api.ashbyhq.com/posting-api/job-board/acme');assert.equal(atsBoard('https://jobs.eu.lever.co/acme').url,'https://api.eu.lever.co/v0/postings/acme?mode=json');assert.equal(atsBoard('https://job-boards.greenhouse.io/acme').type,'Greenhouse');assert.equal(atsBoard('https://fakejobs.ashbyhq.com/acme'),null);
});
test('AI extraction requires verbatim titles, evidence and matching observed links',async()=>{
 const scan=await collectSite({url:'https://acme.com/careers',pastedText:'Open positions at Acme: Junior Developer — Nicosia, Cyprus — Remote. Apply on our careers page.'});
 const valid={title:'Junior Developer',company:'Acme',location:'Nicosia, Cyprus',work:'Remote',url:scan.root,pageUrl:scan.root,evidence:'Junior Developer — Nicosia, Cyprus — Remote'};
 assert.equal(validateScanAI({summary:'One role mentioned.',jobs:[valid]},scan).jobs.length,1);
 for(const patch of [{url:'https://invented.com/apply'},{title:'Senior Developer'},{evidence:'We are hiring a Junior Developer now'},{pageUrl:'https://other.com/'},{url:'javascript:alert(1)'}])assert.equal(validateScanAI({summary:'',jobs:[{...valid,...patch}]},scan).jobs.length,0);
 const unknown=validateScanAI({summary:'',jobs:[{...valid,company:'Invented Inc',location:'London'}]},scan).jobs[0];assert.equal(unknown.company,'acme.com');assert.equal(unknown.location,'Location unspecified');
});
test('scan output has stable manual IDs and remains reviewable after backup',async()=>{
 const scan=await collectSite({url:'https://acme.com/careers',pastedText:'Open positions at Acme: Junior Developer — Nicosia, Cyprus — Remote. Apply on our careers page.'});
 const ai=validateScanAI({summary:'One listed role.',jobs:[{title:'Junior Developer',company:'Acme',location:'Cyprus',work:'Remote',url:scan.root,pageUrl:scan.root,evidence:'Junior Developer — Nicosia, Cyprus — Remote'}]},scan);
 const [job]=scanJobs(scan,ai);assert.equal(job.manual,true);assert.match(job.id,/^manual-scan-/);assert.equal(scanJobs(scan,ai)[0].id,job.id);
 const p={name:'Test',preferences:{},reviews:{},saved:{[job.id]:{job,stage:'Saved',notes:''}}};const restored=readBackup(makeBackup({profiles:[p]}))[0].saved[job.id].job;assert.ok(restored.description.includes('Source evidence:'));assert.equal(restored.source,'acme.com (site scan)');
});
test('AI input stays bounded even with many very long observed links',async()=>{
 const scan=await collectSite({url:'https://acme.com/careers',pastedText:'Open careers. '+('Junior Developer. '.repeat(2000))});scan.documents[0].links=Array.from({length:100},(_,i)=>({url:'https://acme.com/jobs/'+i+'x'.repeat(1500),label:'Developer'}));assert.ok(JSON.stringify(scanMessages(scan)).length<24000);
});

test('published feed allowlist is limited to documented read-only board paths',async()=>{
 assert.equal(publicFeed('https://api.ashbyhq.com/posting-api/job-board/acme'),true);assert.equal(publicFeed('https://api.ashbyhq.com/jobPosting.list'),false);assert.equal(publicFeed('https://api.lever.co/v0/postings/acme/applications'),false);assert.equal(publicFeed('https://fake.api.lever.co/v0/postings/acme'),false);
 const calls=[];const reader=createPublicReader({request:async url=>{calls.push(String(url));return {status:200,headers:{'content-type':'application/json'},body:'{"jobs":[]}'};}});await reader('https://api.ashbyhq.com/posting-api/job-board/acme');assert.equal(calls.length,1);
});
test('crawler stops at six observed pages and marks incomplete coverage',async()=>{
 const links=Array.from({length:20},(_,i)=>'<a href="/careers/'+i+'">Developer '+i+'</a>').join('');const scan=await collectSite({url:'https://acme.com/',reader:async url=>({...html(links),url:String(url)})});assert.equal(scan.documents.length,6);assert.equal(scan.limited,true);
});
test('public board extraction ignores unlisted and talent-pool postings',async()=>{
 const response={jobs:[{id:'one',title:'Junior Developer',isListed:true,jobUrl:'https://jobs.ashbyhq.com/acme/one',descriptionPlain:'Build apps',location:'Cyprus'},{id:'two',title:'Open Application',isListed:true,jobUrl:'https://jobs.ashbyhq.com/acme/two'},{id:'three',title:'Private Developer',isListed:false,jobUrl:'https://jobs.ashbyhq.com/acme/three'}]};
 const scan=await collectSite({url:'https://jobs.ashbyhq.com/acme',reader:async url=>({url:String(url),status:200,headers:{'content-type':'application/json'},body:JSON.stringify(response)})});assert.deepEqual(scan.structured.map(job=>job.title),['Junior Developer']);
});

test('homepage discovery prioritises open roles over customer and news links',async()=>{
 const pages={'https://acme.com/':html('<a href="/customers/managers">Asset Managers</a><a href="/working/open-roles">Open Roles</a><a href="/insights/developer-news">Developer news</a>'),'https://acme.com/working/open-roles':html('<h1>Careers</h1><a href="/jobs/developer">Junior Developer</a>'),'https://acme.com/jobs/developer':html('<h1>Junior Developer</h1>')};const scan=await collectSite({url:'https://acme.com/',reader:readerFor(pages)});assert.deepEqual(scan.pages.map(page=>page.url),Object.keys(pages));
});

test('pasted job links retain surrounding title evidence',async()=>{
 const scan=await collectSite({url:'https://acme.com/careers',pastedText:'Acme open roles. Junior Developer — Nicosia, Cyprus. Details: https://acme.com/jobs/dev'});
 const result=validateScanAI({summary:'One role.',jobs:[{title:'Junior Developer',company:'Acme',location:'Cyprus',work:'Unspecified',url:'https://acme.com/jobs/dev',pageUrl:scan.root,evidence:'Junior Developer — Nicosia, Cyprus.'}]},scan);assert.equal(result.jobs.length,1);
});

test('literal ATS embed configuration is discovered without executing scripts',()=>{
 const page=readHtml('<script>const ashbySlug = "Acme"; fetch(`https://api.ashbyhq.com/posting-api/job-board/${ashbySlug}`)</script><script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>','https://acme.com/careers');assert.ok(page.links.some(link=>link.url==='https://jobs.ashbyhq.com/Acme'));assert.ok(page.links.some(link=>link.url==='https://job-boards.greenhouse.io/acme'));assert.ok(!page.text.includes('fetch('));
});

test('AI cannot duplicate roles already supplied by a public feed',async()=>{
 const scan=await collectSite({url:'https://jobs.ashbyhq.com/acme',reader:async url=>({url:String(url),status:200,headers:{'content-type':'application/json'},body:JSON.stringify({jobs:[{id:'one',title:'Junior Developer',isListed:true,jobUrl:'https://jobs.ashbyhq.com/acme/one',descriptionPlain:'Junior Developer in Cyprus',location:'Cyprus'}]})})});
 const ai=validateScanAI({summary:'One role.',jobs:[{title:'Junior Developer',company:'acme',location:'Cyprus',work:'Unspecified',url:scan.root,pageUrl:scan.root,evidence:'Junior Developer in Cyprus'}]},scan);assert.equal(ai.jobs.length,0);assert.equal(scanJobs(scan,ai).length,1);
});

test('same-title roles on a shared careers page retain distinct locations',()=>{
 const scan={root:'https://acme.com/careers',checkedAt:'2026-10-23T12:00:00Z',structured:[{title:'Junior Developer',company:'Acme',location:'Nicosia',url:'https://acme.com/careers',method:'structured'},{title:'Junior Developer',company:'Acme',location:'London',url:'https://acme.com/careers',method:'structured'}]};const jobs=scanJobs(scan);assert.equal(jobs.length,2);assert.notEqual(jobs[0].id,jobs[1].id);
});

test('AI receives feed roles as summary data, without trying to extract them again',()=>{
 const scan={root:'https://jobs.ashbyhq.com/acme',structured:[{title:'Developer',location:'Cyprus'}],documents:[{kind:'feed',url:'https://jobs.ashbyhq.com/acme',title:'Careers',text:'Developer',links:[]}]};const payload=JSON.parse(scanMessages(scan)[1].content);assert.equal(payload.pages.length,0);assert.equal(payload.publishedJobCount,1);assert.equal(payload.publishedRoles[0].title,'Developer');
});

test('scan summary uses validated results rather than unverified model vacancy counts',async()=>{
 const scan=await collectSite({url:'https://acme.com/careers',pastedText:'Acme careers: Junior Developer in Cyprus. Applications are open for this Junior Developer.'});const ai=validateScanAI({summary:'The company has 999 vacancies.',jobs:[{title:'Junior Developer',company:'Acme',location:'Cyprus',work:'Unspecified',url:scan.root,pageUrl:scan.root,evidence:'Junior Developer in Cyprus.'}]},scan);assert.ok(!ai.summary.includes('999'));assert.ok(ai.summary.includes('1 role'));
});

test('published boards end redundant HTML exploration while other discovered boards are retained',async()=>{
 const calls=[];const reader=async value=>{const url=String(value);calls.push(url);if(url==='https://acme.com/')return {...html('<a href="https://jobs.ashbyhq.com/acme">Careers</a><a href="https://jobs.ashbyhq.com/acme-eu">EU Careers</a><a href="/working/life">Life at Acme</a>'),url};const board=url.endsWith('acme-eu')?'acme-eu':'acme';return {url,status:200,headers:{'content-type':'application/json'},body:JSON.stringify({jobs:[{title:'Developer',isListed:true,jobUrl:'https://jobs.ashbyhq.com/'+board+'/one',location:'Cyprus'}]})};};
 const scan=await collectSite({url:'https://acme.com/',reader});assert.equal(scan.structured.length,2);assert.equal(calls.length,3);assert.ok(!calls.some(url=>url.includes('/working/life')));
});

test('feed-only scans skip unnecessary AI extraction while HTML and pasted evidence still use it',()=>{
 assert.equal(needsScanAI({documents:[{kind:'feed',text:'Published job records'}]}),false);
 assert.equal(needsScanAI({documents:[{kind:'feed'},{text:'Careers page'}]}),true);
 assert.equal(needsScanAI({documents:[{title:'Pasted page text',text:'Vacancy text'}]}),true);
});
