import {countryInfo,countryListed,regionListed,explicitCountries} from './countries.mjs';
import {jobBlocks} from './description.mjs';
// Separate required experience from explicitly optional requirements and employer history.
export function experienceSignals(job){
 const source=String(job.description||''),numbers={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
 const number='(\\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten)';
 const years=number+'(?:\\s*(?:[-–]|to)\\s*(?:\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten))?\\s*\\+?\\s+years?';
 const patterns=[new RegExp(years+'(?:\\s+of)?\\s+(?:(?:relevant|professional|commercial|hands[- ]on|work|software|development|industry|proven|engineering)\\s+){0,4}experience','gi'),new RegExp('experience\\s*(?:of|:)?\\s*(?:at least|minimum(?: of)?)?\\s*'+number+'\\s*\\+?\\s+years?','gi'),new RegExp(years+'\\s+(?:in|with|building|developing|using|working)\\b','gi')];
 const optional=/nice[ -]to[ -]have|preferred|preferably|desirable|a plus|an advantage|bonus|ideally/i;
 const hits=[],preferred=[],alternatives=[];let optionalSection=false;
 for(const block of jobBlocks(job)){
  if(block.type==='heading'){optionalSection=optional.test(block.text);continue;}
  for(const unit of block.type==='list'?block.items:[block.text])for(const sentence of unit.split(/(?<=[.!?;])\s+/)){
   const seen=new Set(),sentenceHits=[];
   for(const re of patterns)for(const m of sentence.matchAll(re)){
    if(seen.has(m.index))continue;seen.add(m.index);
    const n=numbers[m[1]?.toLowerCase()]??Number(m[1]);if(!Number.isFinite(n)||n>40)continue;
    const before=sentence.slice(Math.max(0,m.index-90),m.index),after=sentence.slice(m.index+m[0].length,m.index+m[0].length+90).split(/[;.!?]|\b(?:but|however|and)\b/i)[0];
    if(/(?:our (?:company|team|founders?)|we (?:have|bring)|combined|collective|founded|established)[^;.!?]*$/i.test(before)||/(?:up to|fewer than|less than|maximum(?: of)?)\s*$/i.test(before))continue;
    const clauseBefore=before.split(/[,;]|\b(?:and|but)\b/i).at(-1);
    const explicitRequired=/\b(?:required|must|minimum|at least|essential)\b/i.test(clauseBefore);
    const explicitOptional=optional.test(clauseBefore)||/^(?:\s+\S+){0,7}\s+(?:preferred|desirable|a plus|an advantage|nice[ -]to[ -]have|would be a bonus)/i.test(after)||/^\s*(?:is|are)?\s*(?:preferred|desirable|optional)/i.test(after);
    (explicitOptional||optionalSection&&!explicitRequired?preferred:sentenceHits).push({years:n,evidence:m[0]});
   }
   if(sentenceHits.length>1&&/\bor\b/i.test(sentence)){alternatives.push(sentence.trim().slice(0,220));}else hits.push(...sentenceHits);
  }
 }
 const strongest=hits.sort((a,b)=>b.years-a.years)[0],nice=preferred.sort((a,b)=>b.years-a.years)[0];
 const title=String(job.title||''),junior=/\b(junior|jr|intern|internship|graduate|apprentice)\b|entry[- ]level/i.test(title),senior=/\b(senior|sr|staff|principal|lead|manager|architect|founding)\b|head of/i.test(title);
 const directEntry=/\bno (?:prior |professional |previous )?experience (?:is )?(?:required|necessary)\b|\bthis (?:role|position) is (?:an? )?(?:entry[- ]level|junior)\b/i.exec(source);
 const minimumYears=strongest?.years??null;
 const category=junior&&senior?'mixed':junior&&minimumYears>2?'conflict':senior||minimumYears>2?'experienced':junior?'junior':directEntry||minimumYears!==null&&minimumYears<=2?'early':'unknown';
 const labels={mixed:'Mixed seniority',conflict:'Junior title · check years',experienced:'Experienced role',junior:'Explicit junior / graduate',early:'Early-career requirement',unknown:'Junior suitability unknown'};
 return {alternativeEvidence:alternatives[0]||'',minimumYears,evidence:strongest?.evidence||'',label:strongest?strongest.years+'+ years in requirements':alternatives.length?'Alternative requirements · verify':'Required years not identified',preferredYears:nice?.years??null,preferredEvidence:nice?.evidence||'',preferredLabel:nice?'Preferred: '+nice.years+'+ years · not required':'',category,levelLabel:labels[category],levelEvidence:junior||senior?title:directEntry?.[0]||strongest?.evidence||''};
}
export function locationSignals(job,code='CY'){
 const c=countryInfo(code),loc=String(job.location||''),desc=String(job.description||'');
 const local=countryListed(loc,c.code),worldwide=/worldwide|anywhere|all countries/i.test(loc),region=regionListed(loc,c.code);
 const zones=Array.isArray(job.timezoneRestrictions)?job.timezoneRestrictions:[...loc.matchAll(/UTC([+-]\d+(?:\.\d+)?)/g)].map(m=>Number(m[1]));
 const tzExcluded=zones.length>0&&c.zones.length>0&&!c.zones.some(zone=>zones.includes(zone));
 const descRestriction=/(?:must (?:be (?:based|located)|reside|live)|(?:only|exclusively) (?:open|available) to|(?:location|locations)\s*:)[^.!?]{0,120}/i.exec(desc)?.[0]||'';
 const restrictions=[...desc.matchAll(/(?:must (?:be (?:based|located|resident)|reside|live)|(?:only|exclusively) (?:open|available) to (?:candidates |applicants |residents )?(?:in |of |based in )?)[^.!?\n]{0,140}/gi)].map(m=>m[0]);
 const excluded=/(?:except|excluding|not available in|not open to)[^.!?\n]{0,100}/i.exec(loc)?.[0]||'';
 const conflict=restrictions.find(e=>{const codes=explicitCountries(e),regional=/\b(?:Europe|European Union|EU|EMEA|APAC|LATAM|Americas|North America|Latin America|Asia|Africa|Oceania|Middle East)\b/i.test(e);return (codes.length||regional)&&!codes.includes(c.code)&&!regionListed(e,c.code);});
 const restrictionConflict=Boolean(conflict||excluded&&(countryListed(excluded,c.code)||regionListed(excluded,c.code)));
 const restrictionEvidence=conflict||excluded||'';
 const note=restrictionConflict?'The listing states: “'+restrictionEvidence+'”. This conflicts with '+c.name+'.':tzExcluded?'Listed timezone offsets do not include the standard offsets checked for '+c.name+'.':descRestriction?'Check this restriction in the listing: “'+descRestriction+'”.':'Confirm employer coverage, timezone overlap, and your right to work before applying.';
 const label=restrictionConflict?'Country requirement conflicts':tzExcluded?'Timezone mismatch':local?c.name+' explicitly listed':worldwide?'Worldwide listed · verify terms':region?'Region listed · '+c.name+' unconfirmed':job.remote?'Country restriction / unclear':'Outside '+c.name;
 return {restrictionConflict,restrictionEvidence,label,note,country:c.code,countryListed:local,cyprusListed:c.code==='CY'&&local,worldwide,region,tzExcluded,descriptionRestriction:descRestriction,confirmedLead:(local||worldwide)&&!tzExcluded&&!restrictionConflict&&(!descRestriction||explicitCountries(descRestriction).includes(c.code))};
}
